"""Regression of the three independent P1.2 security-review findings; no network."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
import io
import json
import logging
from types import SimpleNamespace as NS
import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from pydantic import ValidationError

from server.ai.app.errors import AppError
from server.ai.app.factory import create_app
from server.ai.app.privacy_log import PrivacyLogger
from server.ai.app.providers.base import LlmRequest, ProviderResult
from server.ai.app.providers.openai_llm import OpenAiLlmProvider
from server.ai.app.quota.identity import digest
from server.ai.app.quota.pricing import LLM
from server.ai.app.quota.types import Accounting, Counter
from server.ai.tests.quota_fake import SharedState, config, service
from server.ai.tests.support import (
    FakeLlmProvider, FakeSttProvider, FakeVerifier, auth_headers, consult_body, test_settings,
)
from server.ai.tests.test_quota_ledger import accounting, reserve, stage

CLAIM = {"claim_type": "record_references", "fact_indexes": [0]}


class CounterIntegrityTests(unittest.TestCase):
    def assert_corruption(self, mutate, *, unknown=False, marker=False):
        for scope in ("userDay/", "globalDay/"):
            with self.subTest(scope=scope):
                state = SharedState()
                amount = LLM.reserve(450)
                state.data["control/current"] = config(
                    user_budget=amount if scope == "userDay/" else 10 * amount,
                    global_budget=amount if scope == "globalDay/" else 10 * amount)
                usage = Accounting(stage_id="llm", pricing_version=LLM.version,
                    observed_model=LLM.model, usage_status="UNKNOWN" if unknown else "KNOWN",
                    input_usage=None if unknown else 128000, output_usage=None if unknown else 450,
                    parse_status="OK")
                provider = FakeLlmProvider(ProviderResult(CLAIM, usage), ProviderResult(CLAIM, usage))
                app = create_app(settings=test_settings(), verifier=FakeVerifier(), llm_provider=provider,
                    stt_provider=FakeSttProvider(), quota_service=service(state))
                with TestClient(app, raise_server_exceptions=False) as client:
                    first = client.post("/v1/ai/execute", json=consult_body(), headers=auth_headers())
                    self.assertEqual(first.status_code, 200)
                    path = next(k for k in state.data if k.startswith(scope))
                    self.assertEqual(state.data[path]["held"] + state.data[path]["charged"], amount)
                    target = "counterMarkers/" + digest(path) if marker else path
                    mutate(state.data, target)
                    before = deepcopy(state.data)
                    second = client.post("/v1/ai/execute", json=consult_body(), headers=auth_headers())
                self.assertEqual(second.status_code, 503)
                self.assertEqual(second.json()["error"]["code"], "CENTRAL_QUOTA_UNAVAILABLE")
                self.assertEqual(len(provider.requests), 1, "second request must dispatch zero providers")
                self.assertEqual(state.data, before, "no repair/bootstrap/new reservation on corruption")

    def test_missing_charged_after_budget_exhaustion(self):
        self.assert_corruption(lambda data, path: data[path].pop("charged"))

    def test_missing_held_with_outstanding_unknown_charge(self):
        self.assert_corruption(lambda data, path: data[path].pop("held"), unknown=True)

    def test_missing_required_schema_and_accounting_fields(self):
        for field in ("schema_version", "bootstrap_id", "budget", "user_budget", "admissions"):
            with self.subTest(field=field):
                self.assert_corruption(lambda data, path: data[path].pop(field))

    def test_malformed_negative_overflow_and_incompatible_schema(self):
        for field, value in (("charged", "0"), ("charged", False), ("held", 0.0),
                             ("charged", -1), ("held", 2 ** 63), ("schema_version", "counter.v2")):
            with self.subTest(field=field, value=value):
                self.assert_corruption(lambda data, path: data[path].__setitem__(field, value))

    def test_entire_existing_user_or_global_counter_missing(self):
        self.assert_corruption(lambda data, path: data.pop(path))

    def test_counter_without_marker_is_not_silently_adopted(self):
        self.assert_corruption(lambda data, path: data.pop(path), marker=True)

    def test_marker_corruption_or_wrong_bucket_binding_fails_closed(self):
        for field, value in (("schema_version", "unknown"), ("counter_id", "f" * 64),
                             ("bootstrap_id", "e" * 64), ("state_digest", "d" * 64)):
            with self.subTest(field=field):
                self.assert_corruption(lambda data, path: data[path].__setitem__(field, value), marker=True)

    def test_well_typed_accounting_reset_cannot_match_integrity_marker(self):
        self.assert_corruption(lambda data, path: data[path].__setitem__("charged", 0))

    def test_fresh_first_use_bootstraps_both_counters_and_markers_atomically(self):
        async def check():
            s = service()
            r, _ = await reserve(s)
            data = s.repository.store.state.data
            for path in (r.user_bucket, r.global_bucket):
                counter = Counter.model_validate(data[path])
                self.assertEqual(counter.bootstrap_id, r.id)
                self.assertEqual(counter.held, stage().reserved)
                expected = s.repository._counter_marker(path, counter).model_dump()
                self.assertEqual(data["counterMarkers/" + digest(path)], expected)
                self.assertNotIn("expires_at", expected)
        asyncio.run(check())


class IntegrityRaceTests(unittest.IsolatedAsyncioTestCase):
    async def test_corruption_between_reserve_and_dispatch_stops_provider(self):
        for scope in ("user_bucket", "global_bucket"):
            with self.subTest(scope=scope):
                s = service()
                request = LlmRequest("weekly_narrative", "sys", "{}", LLM.model, 220, 20)
                r = await s.begin_llm("u", "weekly_narrative", auth_headers()["Idempotency-Key"], "ko", {}, request)
                del s.repository.store.state.data[getattr(r, scope)]
                provider = FakeLlmProvider(CLAIM)
                with self.assertRaises(AppError): await s.llm(r, "llm", request, provider)
                self.assertEqual(provider.requests, [])

    async def test_corrupt_marker_prevents_reconcile_or_recovery_writes(self):
        for action in ("reconcile", "recover"):
            s = service()
            r, _ = await reserve(s)
            await s.repository.claim(r.id, "llm", digest("owner"), digest("payload"))
            state = s.repository.store.state
            state.now += timedelta(minutes=6)
            del state.data["counterMarkers/" + digest(r.global_bucket)]
            before = deepcopy(state.data)
            with self.assertRaises(AppError):
                if action == "reconcile":
                    await s.repository.reconcile(r.id, "llm", digest("owner"), accounting())
                else:
                    await s.repository.recover(r.id)
            self.assertEqual(state.data, before)

    async def test_500_requests_two_clients_preserve_witnesses_and_exact_budget(self):
        state = SharedState()
        state.data["control/current"] = config(global_budget=stage().reserved * 37)
        clients = [service(state), service(state)]
        async def one(i):
            try: return (await reserve(clients[i % 2], i, user=f"u{i}"))[1]
            except AppError: return False
        self.assertEqual(sum(await asyncio.gather(*(one(i) for i in range(500)))), 37)
        for path, value in state.data.items():
            if path.startswith(("userDay/", "globalDay/")):
                counter = Counter.model_validate(value)
                self.assertLessEqual(counter.held + counter.charged, counter.budget)
                self.assertEqual(state.data["counterMarkers/" + digest(path)],
                    clients[0].repository._counter_marker(path, counter).model_dump())


class LateAccountingTests(unittest.IsolatedAsyncioTestCase):
    async def prepared(self, *, conservative=True):
        s = service()
        r, _ = await reserve(s)
        await s.repository.claim(r.id, "llm", digest("owner"), digest("payload"))
        state = s.repository.store.state
        if conservative:
            state.now += timedelta(minutes=6)
            await s.repository.recover(r.id)
        else:
            await s.repository.reconcile(r.id, "llm", digest("owner"), accounting())
        return s, r, state

    async def test_terminal_less_or_equal_retains_original_money_and_evidence(self):
        for conservative in (True, False):
            for usage in (accounting(), accounting().model_copy(update={"input_usage": 128000, "output_usage": 220})):
                s, r, state = await self.prepared(conservative=conservative)
                before = deepcopy(state.data)
                await s.repository.reconcile(r.id, "llm", digest("owner"), usage)
                self.assertEqual(state.data, before)

    async def test_terminal_overage_preserved_without_refund_or_reexecution(self):
        for conservative in (True, False):
            s, r, state = await self.prepared(conservative=conservative)
            original_stage = deepcopy(state.data["reservations/" + r.id]["stages"][0])
            pending, _ = await reserve(s, 1)
            # Include pending R in the unchanged-ledger assertion.
            original_money = [deepcopy(state.data[p]) for p in (r.user_bucket, r.global_bucket)]
            usage = accounting().model_copy(update={"input_usage": 128000, "output_usage": 221})
            with self.assertRaises(AppError) as error:
                await s.repository.reconcile(r.id, "llm", digest("owner"), usage)
            self.assertEqual(error.exception.code, "ACCOUNTING_INVARIANT_VIOLATION")
            current = state.data["reservations/" + r.id]["stages"][0]
            self.assertEqual(current["state"], original_stage["state"])
            self.assertEqual(current["charged"], original_stage["charged"])
            self.assertEqual(current["accounting"], original_stage["accounting"])
            self.assertEqual(current["observed_cost"], stage().reserved + 1)
            self.assertEqual(current["violation_accounting"], usage.model_dump())
            self.assertIn("blocks/" + LLM.id, state.data)
            self.assertEqual([state.data[p] for p in (r.user_bucket, r.global_bucket)], original_money)
            with self.assertRaises(AppError): await reserve(s, 2)
            with self.assertRaises(AppError):
                await s.repository.claim(pending.id, "llm", digest("next"), digest("payload"))

    async def test_late_violation_blocks_actual_service_dispatch_and_new_reservation(self):
        s = service()
        request = LlmRequest("weekly_narrative", "sys", "{}", LLM.model, 220, 20)
        r = await s.begin_llm("u", "weekly_narrative", auth_headers()["Idempotency-Key"], "ko", {}, request)
        original = FakeLlmProvider(ProviderResult(CLAIM, Accounting(
            stage_id="llm", pricing_version=LLM.version, parse_status="OK")))
        await s.llm(r, "llm", request, original)
        s.repository.store.state.now += timedelta(minutes=6)
        await s.repository.recover(r.id)
        pending = await s.begin_llm("u", "weekly_narrative", auth_headers()["Idempotency-Key"], "ko", {}, request)
        usage = accounting().model_copy(update={"input_usage": 128000, "output_usage": 221})
        with self.assertRaises(AppError):
            await s.repository.reconcile(r.id, "llm",
                s.repository.store.state.data["reservations/" + r.id]["stages"][0]["dispatch_owner"], usage)
        next_provider = FakeLlmProvider(CLAIM)
        with self.assertRaises(AppError): await s.llm(pending, "llm", request, next_provider)
        with self.assertRaises(AppError):
            await s.begin_llm("u", "weekly_narrative", auth_headers()["Idempotency-Key"], "ko", {}, request)
        self.assertEqual(len(original.requests), 1)
        self.assertEqual(next_provider.requests, [])

    async def test_duplicate_late_evidence_100_is_idempotent(self):
        s, r, state = await self.prepared()
        usage = accounting().model_copy(update={"input_usage": 128000, "output_usage": 221})
        with self.assertRaises(AppError): await s.repository.reconcile(r.id, "llm", digest("owner"), usage)
        before = deepcopy(state.data)
        results = await asyncio.gather(*(service(state).repository.reconcile(
            r.id, "llm", digest("owner"), usage) for _ in range(100)), return_exceptions=True)
        self.assertTrue(all(isinstance(e, AppError) and e.code == "ACCOUNTING_INVARIANT_VIOLATION" for e in results))
        self.assertEqual(state.data, before)

    async def test_terminal_rejects_wrong_owner_stage_pricing_and_observed_model(self):
        s, r, state = await self.prepared()
        before = deepcopy(state.data)
        invalid = [(digest("other"), accounting()),
            (digest("owner"), accounting().model_copy(update={"stage_id": "parser"})),
            (digest("owner"), accounting().model_copy(update={"pricing_version": "wrong"})),
            (digest("owner"), accounting().model_copy(update={"observed_model": "wrong-model"}))]
        for owner, usage in invalid:
            with self.assertRaises(AppError): await s.repository.reconcile(r.id, "llm", owner, usage)
            self.assertEqual(state.data, before)


class AccountingPreservationTests(unittest.TestCase):
    def result(self, content, *, usage=True, parser_error=None):
        state = SharedState()
        provider = object.__new__(OpenAiLlmProvider)
        call = AsyncMock(return_value=NS(model=LLM.model,
            usage=NS(prompt_tokens=100, completion_tokens=10) if usage else None,
            choices=[NS(message=NS(content=content))]))
        provider._client = NS(chat=NS(completions=NS(create=call)))
        if parser_error is not None:
            provider._parse_content = lambda _: self.throw(parser_error)
        log = io.StringIO()
        logger = logging.getLogger("quota-followup-private")
        logger.handlers.clear()
        logger.propagate = False
        logger.setLevel(logging.INFO)
        logger.addHandler(logging.StreamHandler(log))
        app = create_app(settings=test_settings(), verifier=FakeVerifier(), llm_provider=provider,
            stt_provider=FakeSttProvider(), quota_service=service(state),
            privacy_logger=PrivacyLogger(logger=logger, hash_salt="synthetic"))
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post("/v1/ai/execute", json=consult_body(), headers=auth_headers())
        record = next(v for k, v in state.data.items() if k.startswith("reservations/"))
        counter = state.data[record["global_bucket"]]
        self.assertEqual(call.await_count, 1)
        for forbidden in ("PRIVATE_PAYLOAD", "valid-token", "Authorization", "user-123", "antibiotics"):
            self.assertNotIn(forbidden, repr(state.data) + log.getvalue() + response.text)
        return response, record["stages"][0], counter

    @staticmethod
    def throw(error):
        raise error

    def assert_known_failure(self, content, error=None):
        response, stage_value, counter = self.result(content, parser_error=error)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(stage_value["state"], "SETTLED")
        self.assertEqual(stage_value["accounting"]["usage_status"], "KNOWN")
        self.assertEqual(stage_value["accounting"]["input_usage"], 100)
        self.assertEqual(stage_value["accounting"]["output_usage"], 10)
        self.assertEqual(stage_value["accounting"]["parse_status"], "INVALID")
        self.assertEqual(stage_value["accounting"]["transport_status"], "RESPONSE")
        self.assertEqual(counter["held"], 0)
        self.assertEqual(counter["charged"], 21)

    def test_invalid_json_keeps_known_usage(self):
        self.assert_known_failure("PRIVATE_PAYLOAD not json")

    def test_deep_json_keeps_known_usage(self):
        response, stage_value, counter = self.result(
            '{"PRIVATE_PAYLOAD":' + '[' * 2000 + '0' + ']' * 2000 + '}')
        # Python's JSON nesting limit differs by runtime. Either decoder failure
        # (502) or product-schema rejection (422) must retain the same billing.
        # The next test independently forces RecursionError at the parser seam.
        self.assertIn(response.status_code, (422, 502))
        self.assertEqual(stage_value["state"], "SETTLED")
        self.assertEqual(stage_value["accounting"]["usage_status"], "KNOWN")
        self.assertEqual(stage_value["accounting"]["input_usage"], 100)
        self.assertEqual(stage_value["accounting"]["output_usage"], 10)
        self.assertEqual(counter["charged"], 21)
        self.assertEqual(counter["held"], 0)

    def test_recursion_error_keeps_known_usage(self):
        self.assert_known_failure("{}", RecursionError("PRIVATE_PAYLOAD"))

    def test_unexpected_parser_exception_keeps_known_usage(self):
        self.assert_known_failure("{}", RuntimeError("PRIVATE_PAYLOAD"))

    def test_parser_schema_validation_exception_keeps_known_usage(self):
        try:
            Counter.model_validate({"PRIVATE_PAYLOAD": True})
        except ValidationError as error:
            self.assert_known_failure("{}", error)

    def test_product_output_validator_rejection_remains_known_and_billed(self):
        response, stage_value, counter = self.result(json.dumps({"answer": "Give antibiotics. PRIVATE_PAYLOAD"}))
        self.assertEqual(response.status_code, 422)
        self.assertEqual(stage_value["accounting"]["usage_status"], "KNOWN")
        self.assertEqual(counter["charged"], 21)
        self.assertEqual(counter["held"], 0)

    def test_parser_failure_with_unknown_usage_keeps_full_hold(self):
        response, stage_value, counter = self.result("PRIVATE_PAYLOAD", usage=False)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(stage_value["state"], "UNKNOWN")
        self.assertEqual(counter["held"], LLM.reserve(450))
        self.assertEqual(counter["charged"], 0)


class FirestoreFollowupTests(unittest.IsolatedAsyncioTestCase):
    def sdk_service(self):
        from google.auth.credentials import AnonymousCredentials
        from google.cloud.firestore_v1 import Client
        from server.ai.app.quota.identity import Fingerprints
        from server.ai.app.quota.service import QuotaService
        from server.ai.tests.quota_fake import KEYS
        from server.ai.tests.test_quota_firestore import FakeGapic
        client = Client(project="synthetic-followup", credentials=AnonymousCredentials())
        rpc = FakeGapic(client)
        client._firestore_api_internal = rpc
        return QuotaService.for_firestore(client, Fingerprints(KEYS), "test", "test-issuer"), rpc

    async def test_bootstrap_markers_are_atomic_and_survive_sdk_round_trip(self):
        s, rpc = self.sdk_service()
        rpc.abort_commits = 3
        with self.assertRaises(AppError): await reserve(s)
        self.assertEqual(set(rpc.data), {"control/current"})
        rpc.abort_commits = 1
        r, _ = await reserve(s)
        for path in (r.user_bucket, r.global_bucket):
            self.assertEqual(rpc.data["counterMarkers/" + digest(path)],
                s.repository._counter_marker(path, Counter.model_validate(rpc.data[path])).model_dump())
        del rpc.data[r.global_bucket]["charged"]
        before = deepcopy(rpc.data)
        with self.assertRaises(AppError): await reserve(s, 1)
        self.assertEqual(rpc.data, before)

    async def test_deleted_counter_is_not_bootstrapped_by_firestore_adapter(self):
        for scope in ("user_bucket", "global_bucket"):
            s, rpc = self.sdk_service()
            r, _ = await reserve(s)
            del rpc.data[getattr(r, scope)]
            before = deepcopy(rpc.data)
            with self.assertRaises(AppError): await reserve(s, 1)
            self.assertEqual(rpc.data, before)

    async def test_terminal_overage_persists_and_blocks_with_real_sdk(self):
        s, rpc = self.sdk_service()
        r, _ = await reserve(s)
        await s.repository.claim(r.id, "llm", digest("owner"), digest("payload"))
        rpc.now += timedelta(minutes=6)
        await s.repository.recover(r.id)
        before = deepcopy(rpc.data[r.global_bucket])
        with self.assertRaises(AppError):
            await s.repository.reconcile(r.id, "llm", digest("owner"),
                accounting().model_copy(update={"input_usage": 128000, "output_usage": 221}))
        self.assertEqual(rpc.data[r.global_bucket], before)
        self.assertEqual(rpc.data["reservations/" + r.id]["stages"][0]["observed_cost"], stage().reserved + 1)
        with self.assertRaises(AppError): await reserve(s, 1)
