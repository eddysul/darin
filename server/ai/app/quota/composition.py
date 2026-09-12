"""Runtime wiring only. No resource creation or budget defaults.

Cloud Run mounts a version-pinned Secret Manager JSON keyring as a file. Firestore
credentials come only from the fixed metadata/workload identity endpoint after an
exact expected service-account match; generic ADC discovery is never used.
"""
from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

from .firestore import FirestoreStore
from .identity import Fingerprints
from .repository import CentralQuotaRepository
from .service import QuotaService
from .types import reject
from .workload_credentials import (
    FixedMetadataWorkloadCredentials,
    SERVICE_ACCOUNT_EMAIL,
)


class CompositionError(RuntimeError):
    def __init__(self):
        super().__init__("Central quota runtime configuration is invalid.")


FORBIDDEN_CREDENTIAL_ENVIRONMENT = {
    "FIRESTORE_EMULATOR_HOST",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GCE_METADATA_HOST",
    "GCE_METADATA_ROOT",
    "GCE_METADATA_IP",
}


def _label(value):
    return isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9_.:-]{1,100}", value)


@dataclass(frozen=True, repr=False)
class CentralConfig:
    project: str
    database: str
    environment: str
    namespace: str
    config_version: str
    active_version: str
    historical_versions: tuple[str, ...]
    runtime_service_account: str
    keyring_file: str = field(repr=False)

    @classmethod
    def parse(cls, env: Mapping[str, str]):
        try:
            get = lambda name: env.get("DARIN_" + name, "")
            project, database = get("QUOTA_PROJECT_ID"), get("QUOTA_DATABASE_ID")
            environment, namespace = get("QUOTA_ENVIRONMENT"), get("QUOTA_NAMESPACE")
            version, active = get("QUOTA_CONFIG_VERSION"), get("QUOTA_ACTIVE_KEY_VERSION")
            runtime_service_account = env.get("DARIN_RUNTIME_SERVICE_ACCOUNT", "")
            history = tuple(json.loads(get("QUOTA_HISTORICAL_KEY_VERSIONS")))
            path = get("QUOTA_KEYRING_FILE")
            if (not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", project)
                    or not re.fullmatch(r"[a-z][a-z0-9-]{2,61}[a-z0-9]", database)
                    or not all(_label(x) for x in (environment, namespace, version, active))
                    or not SERVICE_ACCOUNT_EMAIL.fullmatch(runtime_service_account)
                    or environment != get("EXECUTION_ENVIRONMENT")
                    or get("QUOTA_SCHEMA_VERSION") != "p1.2.v1"
                    or get("QUOTA_CONFIG_DOCUMENT") != "control/current"
                    or not isinstance(json.loads(get("QUOTA_HISTORICAL_KEY_VERSIONS")), list)
                    or len(history) > 32 or not all(_label(x) for x in history)
                    or len(set(history)) != len(history) or active in history
                    or not Path(path).is_absolute()):
                raise CompositionError()
            return cls(project, database, environment, namespace, version, active,
                       history, runtime_service_account, path)
        except Exception:
            raise CompositionError() from None

    def fingerprints(self):
        try:
            # Bounded read; never include payload or parsing exceptions in errors.
            with open(self.keyring_file, "rb") as stream:
                raw = stream.read(16_385)
            if len(raw) > 16_384:
                raise CompositionError()
            def unique(pairs):
                result = {}
                for key, value in pairs:
                    if key in result:
                        raise CompositionError()
                    result[key] = value
                return result
            keys = json.loads(raw, object_pairs_hook=unique)
            expected = {self.active_version, *self.historical_versions}
            if not isinstance(keys, dict) or set(keys) != expected:
                raise CompositionError()
            decoded = {key: base64.b64decode(value, validate=True) for key, value in keys.items()}
            if any(not 32 <= len(value) <= 64 for value in decoded.values()):
                raise CompositionError()
            return Fingerprints(decoded)
        except Exception:
            raise CompositionError() from None


class BoundRepository(CentralQuotaRepository):
    """Check pinned deployment metadata in EVERY transaction, not just startup.

The existing ledger paths/identities remain unchanged across config/key rotation.
Budget and pricing remain exclusively in control/current and code-owned profiles.
"""
    def __init__(self, store, fingerprints, config):
        super().__init__(store, fingerprints, config.environment, config.namespace)
        self.binding = config

    def _config(self, tx):
        config = super()._config(tx)
        if (config.version != self.binding.config_version
                or config.fingerprint_version != self.binding.active_version
                or config.user_budget > config.global_budget):
            raise reject()
        # Historical keys have already been validated before the client exists.
        self.fingerprints.calculate(config.fingerprint_version, b"configuration-check")
        return config


def _workload_credentials(expected: str, *, metadata_transport=None):
    """Create a fixed-transport credential after an initial identity match."""
    if not SERVICE_ACCOUNT_EMAIL.fullmatch(expected):
        raise CompositionError()
    # Presence is rejected even when an orchestrator accidentally injects an
    # empty value; silently treating that as absent makes credential drift hard
    # to detect. These overrides are never valid in central runtime.
    if any(name in os.environ for name in FORBIDDEN_CREDENTIAL_ENVIRONMENT):
        raise CompositionError()
    try:
        credentials = FixedMetadataWorkloadCredentials(
            expected,
            transport=metadata_transport,
        )
        credentials.verify_identity()
        return credentials
    except CompositionError:
        raise
    except Exception:
        raise CompositionError() from None


def _firestore_client_with_credentials(config, credentials):
    from google.cloud.firestore import Client
    return Client(project=config.project, database=config.database, credentials=credentials)


def firestore_client(config, *, metadata_transport=None):
    credentials = _workload_credentials(config.runtime_service_account,
                                         metadata_transport=metadata_transport)
    return _firestore_client_with_credentials(config, credentials)


def central_service(config, *, client_factory=None, metadata_transport=None):
    fingerprints = config.fingerprints()
    try:
        if client_factory is None:
            client = firestore_client(config, metadata_transport=metadata_transport)
        else:
            credentials = _workload_credentials(config.runtime_service_account,
                                                metadata_transport=metadata_transport)
            # Explicit constructor injection is test/admin-only; credentials are
            # still verified first and handed to the factory rather than selected
            # by a caller or environment value.
            client = client_factory(config, credentials)
        return QuotaService(BoundRepository(FirestoreStore(client), fingerprints, config), fingerprints)
    except Exception:
        raise CompositionError() from None


def compose_quota(ai_enabled: bool, *, env=None, client_factory=None, metadata_transport=None):
    env = os.environ if env is None else env
    mode = env.get("DARIN_QUOTA_MODE", "")
    if mode == "bootstrap-off":
        # Explicit incomplete bootstrap, never silently promoted to execution.
        if ai_enabled or any(k.startswith("DARIN_QUOTA_") and k != "DARIN_QUOTA_MODE" for k in env):
            raise CompositionError()
        return QuotaService.unavailable()
    if mode != "central":
        raise CompositionError()
    return central_service(CentralConfig.parse(env), client_factory=client_factory,
                           metadata_transport=metadata_transport)
