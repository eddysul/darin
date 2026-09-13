"""Real pinned Firestore SDK with a fake GAPIC transport: no GCP/emulator access."""
from __future__ import annotations

from copy import deepcopy
from datetime import timedelta
import unittest

from google.api_core.exceptions import Aborted, DeadlineExceeded, PermissionDenied
from unittest.mock import patch
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
        self.abort_reads = 0
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
        if self.abort_reads:
            self.abort_reads -= 1
            raise Aborted("synthetic read contention")
        for name in reversed(request["documents"]):
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

    async def test_reserve_batches_reads_without_weakening_accounting(self):
        record, fresh = await reserve(self.s)
        self.assertTrue(fresh)
        self.assertEqual(self.rpc.calls.count("read"), 2)
        self.assertEqual(self.rpc.data[record.global_bucket]["admissions"], 1)
        self.assertGreater(self.rpc.data[record.global_bucket]["held"], 0)

    async def test_incomplete_batch_fails_closed_without_commit(self):
        original = self.rpc.batch_get_documents
        def incomplete(request, **kwargs):
            yield next(original(request, **kwargs))
        with patch.object(self.rpc, "batch_get_documents", side_effect=incomplete):
            with self.assertRaises(AppError):
                await reserve(self.s)
        self.assertNotIn("commit", self.rpc.calls)

    async def test_batch_abort_discards_cached_reads_before_retry(self):
        original = self.rpc.batch_get_documents
        batches = 0
        def interrupted(request, **kwargs):
            nonlocal batches
            batches += 1
            if batches == 1:
                yield next(original(request, **kwargs))
                self.rpc.now += timedelta(minutes=1)
                raise Aborted("synthetic interrupted batch")
            yield from original(request, **kwargs)
        with patch.object(self.rpc, "batch_get_documents", side_effect=interrupted):
            record, _ = await reserve(self.s)
        self.assertEqual(record.admitted_at, NOW + timedelta(minutes=1))
        self.assertEqual(self.rpc.calls.count("commit"), 1)

    async def test_aborted_commit_retry_uses_final_attempt_time(self):
        self.rpc.abort_commits = 1
        self.rpc.retry_advance = timedelta(minutes=1)
        r, _ = await reserve(self.s)
        self.assertEqual(self.rpc.calls.count("commit"), 2)
        self.assertEqual(r.admitted_at, NOW + timedelta(minutes=1))
        self.assertEqual(self.rpc.data[r.global_bucket]["admissions"], 1)

    async def test_read_abort_retries_entire_transaction_once(self):
        self.rpc.abort_reads = 1
        r, new = await reserve(self.s)
        self.assertTrue(new)
        self.assertEqual(self.rpc.calls.count("begin"), 2)
        self.assertEqual(self.rpc.calls.count("commit"), 1)
        self.assertEqual(self.rpc.data[r.global_bucket]["admissions"], 1)

    async def test_contention_backoff_is_bounded_and_only_for_aborts(self):
        self.rpc.abort_reads = 2
        with patch('server.ai.app.quota.firestore.sleep') as pause, \
             patch('server.ai.app.quota.firestore.uniform', return_value=.02):
            await reserve(self.s)
        self.assertEqual([call.args[0] for call in pause.call_args_list], [.02, .04])
        self.assertEqual(self.rpc.calls.count('commit'), 1)

    async def test_ambiguous_commit_never_enters_backoff(self):
        self.rpc.lose_commit = True
        with patch('server.ai.app.quota.firestore.sleep') as pause:
            with self.assertRaises(AppError):
                await reserve(self.s)
        pause.assert_not_called()

    async def test_read_abort_retries_are_bounded(self):
        self.rpc.abort_reads = 100
        with self.assertRaises(AppError):
            await reserve(self.s)
        self.assertEqual(self.rpc.calls.count("begin"), 3)
        self.assertNotIn("commit", self.rpc.calls)

    def test_begin_failure_is_not_masked_or_retried(self):
        for error in (PermissionDenied("synthetic"), DeadlineExceeded("synthetic")):
            with patch.object(self.rpc, "begin_transaction", side_effect=error) as begin:
                with self.assertRaises(type(error)):
                    self.repo.store.run("probe", lambda tx: tx.get("control/current"))
                self.assertEqual(begin.call_count, 1)
        self.assertNotIn("rollback", self.rpc.calls)

    async def test_ambiguous_commit_cleanup_failure_does_not_replay(self):
        self.rpc.lose_commit = True
        with patch.object(self.rpc, "rollback", side_effect=DeadlineExceeded("synthetic cleanup")):
            with self.assertRaises(AppError):
                await reserve(self.s)
        self.assertEqual(self.rpc.calls.count("commit"), 1)
        r, new = await reserve(self.s)
        self.assertFalse(new)
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
