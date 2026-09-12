"""Fixed Cloud metadata credentials for the central quota runtime.

The transport deliberately bypasses urllib/requests and their ambient proxy or
metadata-host configuration.  Every token refresh re-checks the current
workload identity before requesting a token for that exact service account.
"""
from __future__ import annotations

import hmac
import http.client
import io
import json
import re
import threading
import time
from functools import partial
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from google.auth.credentials import Credentials
from google.auth.exceptions import RefreshError


SERVICE_ACCOUNT_EMAIL = re.compile(
    r"^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$"
)
METADATA_HOST = "169.254.169.254"
METADATA_PORT = 80
METADATA_PREFIX = "/computeMetadata/v1/instance/service-accounts/"
METADATA_TIMEOUT_SECONDS = 2.0
IDENTITY_MAX_BYTES = 256
TOKEN_MAX_BYTES = 16_384
TOKEN_MAX_CHARS = 8_192
TOKEN_MAX_LIFETIME_SECONDS = 3_600
METADATA_HEADERS = {"Metadata-Flavor": "Google"}


class WorkloadCredentialError(RuntimeError):
    def __init__(self):
        super().__init__("Workload credential metadata is unavailable.")


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise WorkloadCredentialError()
        result[key] = value
    return result


def _parse_identity(raw: bytes) -> str:
    if not isinstance(raw, bytes):
        raise WorkloadCredentialError()
    # The metadata service may terminate the single value with LF or CRLF.
    # No other whitespace normalization is permitted.
    if raw.endswith(b"\r\n"):
        raw = raw[:-2]
    elif raw.endswith(b"\n"):
        raw = raw[:-1]
    try:
        value = raw.decode("ascii")
    except UnicodeDecodeError:
        raise WorkloadCredentialError() from None
    if not SERVICE_ACCOUNT_EMAIL.fullmatch(value):
        raise WorkloadCredentialError()
    return value


def _parse_token(raw: bytes) -> tuple[str, int]:
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    except WorkloadCredentialError:
        raise
    except Exception:
        raise WorkloadCredentialError() from None
    if not isinstance(value, dict) or set(value) != {"access_token", "expires_in", "token_type"}:
        raise WorkloadCredentialError()
    token = value["access_token"]
    expires_in = value["expires_in"]
    if (not isinstance(token, str)
            or not 1 <= len(token) <= TOKEN_MAX_CHARS
            or any(ord(character) < 0x21 or ord(character) > 0x7e for character in token)
            or value["token_type"] != "Bearer"
            or type(expires_in) is not int
            or not 1 <= expires_in <= TOKEN_MAX_LIFETIME_SECONDS):
        raise WorkloadCredentialError()
    return token, expires_in


class _DeadlineReader(io.RawIOBase):
    """Apply the same absolute deadline to every underlying socket read.

    SocketIO owns a makefile reference, preserving HTTPConnection's normal
    connection-close semantics until the response file is closed.
    """

    def __init__(self, sock, deadline):
        self._socket = sock
        self._deadline = deadline
        self._raw = sock.makefile("rb", buffering=0)

    def readable(self):
        return True

    def readinto(self, buffer):
        remaining = self._deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError()
        self._socket.settimeout(remaining)
        count = self._raw.readinto(buffer)
        if time.monotonic() >= self._deadline:
            raise TimeoutError()
        return count

    def close(self):
        try:
            self._raw.close()
        finally:
            super().close()


class _DeadlineResponse(http.client.HTTPResponse):
    def __init__(self, sock, *args, deadline, **kwargs):
        class ResponseSocket:
            def makefile(self, mode):
                return io.BufferedReader(_DeadlineReader(sock, deadline))

        super().__init__(ResponseSocket(), *args, **kwargs)


class _DeadlineConnection(http.client.HTTPConnection):
    def __init__(self, host, port, *, timeout):
        self._deadline = time.monotonic() + timeout
        super().__init__(host, port, timeout=timeout)
        self.response_class = partial(_DeadlineResponse, deadline=self._deadline)

    def connect(self):
        super().connect()
        remaining = self._deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError()
        self.sock.settimeout(remaining)


class FixedMetadataTransport:
    """Direct link-local metadata transport with no proxy or redirect support."""

    def __init__(self, *, connection_factory=None):
        self._connection_factory = connection_factory or _DeadlineConnection

    def _read(self, path: str, max_bytes: int) -> bytes:
        connection = None
        response = None
        try:
            connection = self._connection_factory(
                METADATA_HOST,
                METADATA_PORT,
                timeout=METADATA_TIMEOUT_SECONDS,
            )
            connection.request("GET", path, headers=METADATA_HEADERS)
            response = connection.getresponse()
            if response.status != 200 or response.getheader("Metadata-Flavor") != "Google":
                raise WorkloadCredentialError()
            content_length = response.getheader("Content-Length")
            if content_length is not None:
                if not content_length.isascii() or not content_length.isdigit():
                    raise WorkloadCredentialError()
                if int(content_length) > max_bytes:
                    raise WorkloadCredentialError()
            raw = response.read(max_bytes + 1)
            if len(raw) > max_bytes:
                raise WorkloadCredentialError()
            return raw
        except WorkloadCredentialError:
            raise
        except Exception:
            raise WorkloadCredentialError() from None
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass
            if connection is not None:
                try:
                    connection.close()
                except Exception:
                    pass

    def service_account_email(self) -> str:
        raw = self._read(METADATA_PREFIX + "default/email", IDENTITY_MAX_BYTES)
        return _parse_identity(raw)

    def access_token(self, service_account_email: str) -> tuple[str, int]:
        if not SERVICE_ACCOUNT_EMAIL.fullmatch(service_account_email):
            raise WorkloadCredentialError()
        path = METADATA_PREFIX + quote(service_account_email, safe="") + "/token"
        return _parse_token(self._read(path, TOKEN_MAX_BYTES))


class FixedMetadataWorkloadCredentials(Credentials):
    """Google Auth credential bound to one verified Cloud workload identity."""

    def __init__(self, expected_service_account: str, *, transport=None):
        super().__init__()
        if not SERVICE_ACCOUNT_EMAIL.fullmatch(expected_service_account):
            raise WorkloadCredentialError()
        self._expected_service_account = expected_service_account
        self._transport = transport or FixedMetadataTransport()
        self._refresh_lock = threading.Lock()

    @property
    def service_account_email(self) -> str:
        return self._expected_service_account

    def verify_identity(self) -> None:
        actual = self._transport.service_account_email()
        if (not isinstance(actual, str)
                or not SERVICE_ACCOUNT_EMAIL.fullmatch(actual)
                or not hmac.compare_digest(actual, self._expected_service_account)):
            raise WorkloadCredentialError()

    def refresh(self, request) -> None:
        # The Google transport request is intentionally ignored: it may honor
        # ambient proxy or GCE metadata configuration.  The fixed transport is
        # the sole token source for every refresh.
        del request
        # Do not allow a queue of refreshes to accumulate unbounded wait time.
        # A waiter must not clear the token being published by the lock owner.
        if not self._refresh_lock.acquire(timeout=2 * METADATA_TIMEOUT_SECONDS):
            raise RefreshError("Workload credential refresh failed.") from None
        try:
            try:
                self.verify_identity()
                token, expires_in = self._transport.access_token(
                    self._expected_service_account
                )
                expiry = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
                    seconds=expires_in
                )
            except Exception:
                self.token = None
                self.expiry = None
                raise RefreshError("Workload credential refresh failed.") from None
            # Publish the token last so concurrent readers never observe a new
            # token paired with an old expiry.
            self.expiry = expiry
            self.token = token
        finally:
            self._refresh_lock.release()
