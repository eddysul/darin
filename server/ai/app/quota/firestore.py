"""Firestore Native adapter. Explicit injected client; never creates resources/config.

Runtime composition must supply a dedicated database client and Fingerprints.
No ambient credentials or project discovery happens when this module is imported.
"""
from __future__ import annotations

from datetime import datetime
from time import monotonic
from ..telemetry import METRICS


class _BoundedApi:
    """Bound SDK transaction begin/commit/rollback RPCs as well as reads.

    google-cloud-firestore 2.29.0 Transaction does not expose these RPC options.
    The small client proxy is pinned and covered with the real SDK + fake GAPIC.
    """
    def __init__(self, api, deadline):
        self.api, self.deadline = api, deadline

    def __getattr__(self, name):
        method = getattr(self.api, name)
        def call(*args, **kwargs):
            remaining = self.deadline - monotonic()
            if remaining <= 0:
                raise TimeoutError()
            kwargs.update(retry=None, timeout=min(1.0, remaining))
            return method(*args, **kwargs)
        return call


class _BoundedClient:
    def __init__(self, client, deadline):
        self.client = client
        self._firestore_api = _BoundedApi(client._firestore_api, deadline)

    def __getattr__(self, name):
        return getattr(self.client, name)


class FirestoreTransaction:
    def __init__(self, client, transaction, deadline):
        self.client = client
        self.transaction = transaction
        self.deadline = deadline
        self.now: datetime | None = None
        self.writes = {}
        self.reads = {}

    def prefetch(self, paths):
        """Read known documents in one bounded snapshot RPC, not N lock round trips."""
        paths = list(dict.fromkeys(path for path in paths if path not in self.reads))
        if not paths:
            return
        remaining = self.deadline - monotonic()
        if remaining <= 0 or len(paths) > 32:
            raise TimeoutError()
        expected = set(paths)
        received = {}
        snapshots = self.client.get_all([self.client.document(path) for path in paths],
            transaction=self.transaction, retry=None, timeout=min(1.0, remaining))
        for snapshot in snapshots:
            path = snapshot.reference.path
            if path not in expected or path in received or snapshot.read_time is None:
                raise ValueError("Invalid transaction read envelope")
            if self.now is None:
                self.now = snapshot.read_time
            received[path] = snapshot.to_dict() if snapshot.exists else None
        if set(received) != expected:
            raise ValueError("Incomplete transaction read envelope")
        self.reads.update(received)

    def get(self, path):
        if path in self.reads:
            return self.reads[path]
        remaining = self.deadline - monotonic()
        if remaining <= 0:
            raise TimeoutError()
        snapshot = self.client.document(path).get(transaction=self.transaction,
                                                  retry=None, timeout=min(1.0, remaining))
        if self.now is None:
            self.now = snapshot.read_time
        return snapshot.to_dict() if snapshot.exists else None

    def set(self, path, value):
        self.writes[path] = value

    def flush(self):
        if monotonic() >= self.deadline:
            raise TimeoutError()
        for path, value in self.writes.items():
            self.transaction.set(self.client.document(path), value)


class FirestoreStore:
    def __init__(self, client):
        self.client = client

    def run(self, name, action):
        from google.api_core.exceptions import Aborted
        from google.cloud.firestore_v1.transaction import Transaction
        deadline = monotonic() + 3.0
        # Reserve a small part of the existing deadline for releasing locks.
        # SDK2.29 retries only commit ABORTED, not read/begin ABORTED, and its
        # rollback can mask the original error (including a failed begin).
        client = _BoundedClient(self.client, deadline - 0.25)
        transaction = Transaction(client, max_attempts=1)
        started = monotonic()
        retry_id = None

        def rollback():
            if transaction.id is None:
                return
            client._firestore_api.deadline = deadline
            try:
                transaction._rollback()
            except BaseException:
                # Cleanup never authorizes replay and must not replace the
                # original outcome. Server-side lock expiry is the final bound.
                METRICS.add("transaction_cleanup_failure")
            finally:
                client._firestore_api.deadline = deadline - 0.25

        def execute():
            nonlocal retry_id
            for attempt in range(3):
                if monotonic() >= deadline - 0.25:
                    raise TimeoutError()
                if attempt:
                    METRICS.add("transaction_retry")
                transaction._clean_up()
                try:
                    transaction._begin(retry_id=retry_id)
                    if retry_id is None:
                        retry_id = transaction.id
                    view = FirestoreTransaction(self.client, transaction, deadline - 0.25)
                    result = action(view)
                    view.flush()
                    transaction._commit()
                    return result
                except Aborted:
                    # Firestore explicitly aborted this attempt: no commit is
                    # ambiguous. Retry the WHOLE transaction, including reads.
                    METRICS.add("transaction_contention")
                    rollback()
                    if attempt == 2:
                        raise
                except BaseException:
                    rollback()
                    raise

        # Only Firestore's ABORTED transaction retries, no application replay on
        # ambiguous commit. Provider code is never reachable from this callback.
        try:
            result = execute()
            METRICS.add("transaction_success")
            return result
        except BaseException as error:
            METRICS.add("transaction_failure")
            # Finite class mapping only, never exception text or document paths.
            from google.api_core.exceptions import PermissionDenied, DeadlineExceeded, ServiceUnavailable
            category = ("transaction_permission_denied" if isinstance(error, PermissionDenied) else
                        "transaction_timeout" if isinstance(error, (TimeoutError, DeadlineExceeded)) else
                        "transaction_unavailable" if isinstance(error, ServiceUnavailable) else None)
            if category:
                METRICS.add(category)
            raise
        finally:
            METRICS.add("transaction_latency_ms", max(0, int((monotonic() - started) * 1000)))
