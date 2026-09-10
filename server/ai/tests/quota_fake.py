"""Test-only central store. Never imported by application bootstrap."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from threading import RLock

from server.ai.app.quota.identity import Fingerprints
from server.ai.app.quota.pricing import LLM, STT
from server.ai.app.quota.repository import CentralQuotaRepository
from server.ai.app.quota.service import QuotaService

NOW = datetime(2026, 9, 9, 12, tzinfo=timezone.utc)
KEYS = {"k1": b"synthetic-fingerprint-test-key-v1--", "k2": b"synthetic-fingerprint-test-key-v2--"}


def config(**changes):
    return {"contract": "p1.2.v1", "version": "c1", "environment": "test",
        "identity_namespace": "test-issuer", "enabled": True, "fingerprint_version": "k1",
        "profiles": [LLM.id, STT.id], "minute_limit": 1000,
        "valid_from": NOW - timedelta(days=1),
        "valid_until": NOW + timedelta(days=30),
        "user_budget": 100_000_000, "global_budget": 1_000_000_000, **changes}


class SharedState:
    def __init__(self, data=None, lock=None):
        self.data = data if data is not None else {"control/current": config()}
        self.lock = lock if lock is not None else RLock()
        self.now = NOW


class FakeTransaction:
    def __init__(self, data, now):
        self.data = deepcopy(data)
        self.now = now
        self.writes = {}

    def get(self, path):
        if self.writes:
            raise AssertionError("Firestore transactions require all reads before writes")
        return deepcopy(self.data.get(path))

    def set(self, path, value):
        self.writes[path] = deepcopy(value)


class FakeStore:
    def __init__(self, state=None):
        self.state = state or SharedState()
        self.fail_before = set()
        self.lose_response = set()
        self.retry_count = 0
        self.on_retry = None

    def run(self, name, action):
        with self.state.lock:
            if name in self.fail_before:
                raise TimeoutError("synthetic datastore outage")
            if self.retry_count >= 3:
                raise TimeoutError("bounded contention")
            for attempt in range(self.retry_count + 1):
                tx = FakeTransaction(dict(self.state.data), self.state.now)
                result = action(tx)
                if attempt < self.retry_count:
                    if self.on_retry:
                        self.on_retry()
                    continue
                self.state.data.update(tx.writes)
                if name in self.lose_response:
                    self.lose_response.remove(name)
                    raise TimeoutError("synthetic commit response loss")
                return result


def service(state=None, keys=None):
    store = FakeStore(state)
    fingerprints = Fingerprints(KEYS if keys is None else keys)
    repo = CentralQuotaRepository(store, fingerprints, "test", "test-issuer")
    return QuotaService(repo, fingerprints)
