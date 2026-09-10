"""Firestore Native adapter. Explicit injected client; never creates resources/config.

Runtime composition must supply a dedicated database client and Fingerprints.
No ambient credentials or project discovery happens when this module is imported.
"""
from __future__ import annotations

from datetime import datetime
from time import monotonic


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

    def get(self, path):
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
        from google.cloud.firestore_v1 import transactional
        from google.cloud.firestore_v1.transaction import Transaction
        deadline = monotonic() + 3.0
        transaction = Transaction(_BoundedClient(self.client, deadline), max_attempts=3)

        @transactional
        def execute(tx):
            view = FirestoreTransaction(self.client, tx, deadline)
            result = action(view)
            view.flush()
            return result

        # Only Firestore's ABORTED transaction retries, no application replay on
        # ambiguous commit. Provider code is never reachable from this callback.
        return execute(transaction)
