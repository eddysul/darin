from __future__ import annotations

import hashlib
import hmac
import json
import re
from datetime import datetime, timedelta, timezone

from .types import reject


def digest(*parts: str) -> str:
    return hashlib.sha256(json.dumps(parts, ensure_ascii=True, separators=(",", ":")).encode()).hexdigest()


def nonce_end(nonce: str | None) -> datetime:
    if not isinstance(nonce, str) or not re.fullmatch(r"[0-9]{8}\.[0-9a-f]{32}", nonce):
        raise reject("IDEMPOTENCY_INVALID", 400)
    try:
        return datetime.strptime(nonce[:8], "%Y%m%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
    except (ValueError, OverflowError):
        raise reject("IDEMPOTENCY_INVALID", 400) from None


class Fingerprints:
    def __init__(self, keys: dict[str, bytes]):
        self._keys = dict(keys)

    def calculate(self, version: str, canonical_input: bytes) -> str:
        key = self._keys.get(version)
        if not isinstance(key, bytes) or len(key) < 32:
            raise reject()
        return hmac.new(key, b"darin-input-v1\0" + canonical_input, hashlib.sha256).hexdigest()

    @staticmethod
    def canonical(operation: str, locale: str, value: dict) -> bytes:
        try:
            return json.dumps({"v": 1, "operation": operation, "locale": locale, "input": value},
                              sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                              allow_nan=False).encode()
        except (ValueError, TypeError):
            raise reject("COST_BOUND_UNAVAILABLE") from None
