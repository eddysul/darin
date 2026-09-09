from __future__ import annotations

import hashlib
import json
import logging
import secrets
from typing import Any


class PrivacyLogger:
    def __init__(self, logger: logging.Logger | None = None, hash_salt: str = "") -> None:
        self._logger = logger or logging.getLogger("darin.ai")
        self._salt = hash_salt.encode("utf-8") if hash_salt else secrets.token_bytes(32)

    def opaque_user(self, user_id: str) -> str:
        return hashlib.sha256(self._salt + user_id.encode("utf-8")).hexdigest()[:16]

    def event(self, name: str, **fields: Any) -> None:
        allowed = {
            "request_id",
            "operation",
            "user",
            "status",
            "latency_ms",
            "provider",
            "validation",
            "error_code",
            "path",
        }
        payload = {"event": name}
        payload.update({key: value for key, value in fields.items() if key in allowed and value is not None})
        self._logger.info(json.dumps(payload, separators=(",", ":"), sort_keys=True))
