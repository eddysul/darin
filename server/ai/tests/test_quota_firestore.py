"""Real pinned Firestore SDK with a fake GAPIC transport: no GCP/emulator access."""
from __future__ import annotations

from copy import deepcopy
from datetime import timedelta
import unittest

from google.api_core.exceptions import Aborted, DeadlineExceeded
from google.auth.credentials import AnonymousCredentials
from google.cloud.firestore_v1 import Client, _helpers
from google.cloud.firestore_v1.types import firestore, document

from server.ai.app.errors import AppError
from server.ai.app.quota.firestore import FirestoreStore
from server.ai.app.quota.identity import Fingerprints, digest
from server.ai.app.quota.repository import CentralQuotaRepository
from server.ai.app.quota.service import QuotaService
from server.ai.tests.quota_fake import NOW, KEYS, config
from server.ai.tests.test_quota_ledger import reserve, accounting


class FakeGapic:
    def __init__(self, client):
        self.client = client
        self.data = {"control/current": config()}
        self.now = NOW
        self.calls = []
        self.serial = 0
        self.abort_commits = 0
        self.lose_commit = False
        self.snapshots = {}
        self.retry_advance = timedelta(0)

    def check(self, name, kwargs):
        assert kwargs.get("retry", "default") is None, "RPC automatic retries must be disabled"
        assert 0 < kwargs["timeout"] <= 1.0, "Every RPC must have a bounded timeout"
        self.calls.append(name)

    def begin_transaction(self, request, **kwargs):
        self.check("begin", kwargs)
        self.serial += 1
        key = str(self.serial).encode()
        self.snapshots[key] = deepcopy(self.data)
        return firestore.BeginTransactionResponse(transaction=key)

    def batch_get_documents(self, request, **kwargs):
        self.check("read", kwargs)
        name = request["documents"][0]
        path = name.split("/documents/", 1)[1]
        data = self.snapshots[request["transaction"]].get(path)
        if data is None:
            yield firestore.BatchGetDocumentsResponse(missing=name, read_time=self.now)
        else:
            yield firestore.BatchGetDocumentsResponse(found=document.Document(name=name,
                fields=_helpers.encode_dict(data), create_time=self.now, update_time=self.now), read_time=self.now)

    def commit(self, request, **kwargs):
        self.check("commit", kwargs)
        if self.abort_commits:
            self.abort_commits -= 1
            self.now += self.retry_advance
            raise Aborted("synthetic contention")
        for write in request["writes"]:
            path = write.update.name.split("/documents/", 1)[1]
            self.data[path] = _helpers.decode_dict(write.update.fields, self.client)
        if self.lose_commit:
            self.lose_commit = False
            raise DeadlineExceeded("synthetic ambiguous commit")
        return firestore.CommitResponse(commit_time=self.now)

    def rollback(self, request, **kwargs):
        self.check("rollback", kwargs)


class FirestoreAdapterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Explicit anonymous test credentials prevent ambient ADC discovery.
        client = Client(project="synthetic-quota-test", database="quota-test", credentials=AnonymousCredentials())
        self.rpc = FakeGapic(client)
        client._firestore_api_internal = self.rpc
        keys = Fingerprints(KEYS)
        self.repo = CentralQuotaRepository(FirestoreStore(client), keys, "test", "test-issuer")
        self.s = QuotaService(self.repo, keys)

    async def test_real_sdk_atomic_round_trip_and_numeric_settlement(self):
        r, new = await reserve(self.s)
        self.assertTrue(new)
        self.assertEqual(r.admitted_at, NOW)
        self.assertTrue(await self.repo.claim(r.id, "llm", digest("owner"), digest("payload")))
        await self.repo.reconcile(r.id, "llm", digest("owner"), accounting())
        self.assertEqual(self.rpc.data[r.global_bucket]["charged"], 21)
        self.assertEqual(self.rpc.data[r.global_bucket]["held"], 0)

    async def test_aborted_commit_retry_uses_final_attempt_time(self):
        self.rpc.abort_commits = 1
        self.rpc.retry_advance = timedelta(minutes=1)
        r, _ = await reserve(self.s)
        self.assertEqual(self.rpc.calls.count("commit"), 2)
        self.assertEqual(r.admitted_at, NOW + timedelta(minutes=1))
        self.assertEqual(self.rpc.data[r.global_bucket]["admissions"], 1)

    async def test_contention_is_bounded_to_three_attempts(self):
        self.rpc.abort_commits = 100
        with self.assertRaises(AppError): await reserve(self.s)
        self.assertEqual(self.rpc.calls.count("commit"), 3)
        self.assertFalse(any(k.startswith("reservations/") for k in self.rpc.data))

    async def test_ambiguous_reserve_commit_is_not_replayed(self):
        self.rpc.lose_commit = True
        with self.assertRaises(AppError): await reserve(self.s)
        self.assertEqual(self.rpc.calls.count("commit"), 1)
        r, new = await reserve(self.s)
        self.assertFalse(new)
        self.assertEqual(self.rpc.data[r.global_bucket]["admissions"], 1)

    async def test_ambiguous_dispatch_commit_has_no_takeover(self):
        r, _ = await reserve(self.s)
        self.rpc.lose_commit = True
        with self.assertRaises(AppError):
            await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        self.assertFalse(await self.repo.claim(r.id, "llm", digest("other"), digest("payload")))
        self.assertGreater(self.rpc.data[r.global_bucket]["held"], 0)

    async def test_no_client_clock_fallback_when_server_time_missing(self):
        self.rpc.now = None
        with self.assertRaises(AppError): await reserve(self.s)
        self.assertFalse(any(k.startswith("reservations/") for k in self.rpc.data))
        with self.assertRaises(AppError):
            await reserve(self.s, key="19700101." + "a" * 32)
