from __future__ import annotations

import asyncio
import io
import json
import logging
from types import SimpleNamespace as NS
import unittest
from unittest.mock import AsyncMock

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError

from server.ai.app.audio import ValidatedAudio
from server.ai.app.errors import AppError
from server.ai.app.factory import create_app
from server.ai.app.privacy_log import PrivacyLogger
from server.ai.app.providers.base import LlmRequest, ProviderResult, SttRequest
from server.ai.app.providers.openai_llm import OpenAiLlmProvider
from server.ai.app.quota.pricing import LLM, VerifiedAudioDuration
from server.ai.app.quota.service import QuotaService
from server.ai.app.quota.types import Accounting
from server.ai.tests.quota_fake import SharedState, config, service
from server.ai.tests.support import (FakeLlmProvider, FakeSttProvider, FakeVerifier, VALID_M4A,
    auth_headers, consult_body, test_settings, verified_duration)

CLAIM = {"claim_type": "record_references", "fact_indexes": [0]}
EVENTS = {"events": [{"category": "식사", "time": "15:00", "type": "분유", "amount": 120, "note": None}]}


class QuotaRouteTests(unittest.TestCase):
    def setUp(self):
        self.state = SharedState()
        self.quota = service(self.state)
        self.llm = FakeLlmProvider(CLAIM)
        self.stt = FakeSttProvider()

    def client(self, *, duration=None, settings=None, logger=None, quota=None):
        app = create_app(settings=settings or test_settings(), verifier=FakeVerifier(),
            llm_provider=self.llm, stt_provider=self.stt,
            quota_service=quota or self.quota, duration_verifier=duration, privacy_logger=logger)
        return TestClient(app, raise_server_exceptions=False)

    def execute(self, client=None, body=None, headers=None):
        return (client or self.client()).post("/v1/ai/execute", json=body or consult_body(),
                                            headers=headers if headers is not None else auth_headers())

    def voice(self, *, duration=None, client=None, headers=None):
        return (client or self.client(duration=duration)).post("/v1/transcribe",
            files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
            headers=headers if headers is not None else auth_headers())

    def record(self):
        return next(v for k, v in self.state.data.items() if k.startswith("reservations/"))

    def global_counter(self):
        return next(v for k, v in self.state.data.items() if k.startswith("globalDay/"))

    def test_unconfigured_runtime_never_falls_back_to_local_limiter(self):
        r = self.execute(self.client(quota=QuotaService.unavailable()))
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["error"]["code"], "CENTRAL_QUOTA_UNAVAILABLE")
        self.assertEqual(self.llm.requests, [])

    def test_real_style_audio_without_duration_proof_calls_neither_provider(self):
        r = self.voice()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["error"]["code"], "COST_BOUND_UNAVAILABLE")
        self.assertEqual(self.stt.requests, [])
        self.assertEqual(self.llm.requests, [])
        self.assertFalse(any(k.startswith("reservations/") for k in self.state.data))

    def test_invalid_or_mismatched_duration_proof_cannot_enable_stt(self):
        for proof in [None, {"duration": 4095}, VerifiedAudioDuration("wrong", 4095, "verified-duration.v1")]:
            with self.subTest(proof=proof):
                r = self.voice(duration=lambda _: proof)
                self.assertEqual(r.status_code, 503)
        self.assertEqual(self.stt.requests, [])

    def test_verified_fixture_reserves_both_stages_before_stt_and_reconciles(self):
        outer = self
        class InspectingStt(FakeSttProvider):
            async def transcribe(self, request):
                record = outer.record()
                outer.assertEqual([s["state"] for s in record["stages"]], ["DISPATCHING", "RESERVED"])
                outer.assertEqual(outer.global_counter()["held"], sum(s["reserved"] for s in record["stages"]))
                return await super().transcribe(request)
        self.stt = InspectingStt()
        self.llm = FakeLlmProvider(EVENTS)
        r = self.voice(duration=verified_duration)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(r.json()["events"]), 1)
        self.assertEqual([s["state"] for s in self.record()["stages"]], ["SETTLED", "SETTLED"])
        self.assertEqual(self.global_counter()["admissions"], 1)
        self.assertEqual(self.global_counter()["held"], 0)
        self.assertEqual(len(self.stt.requests), 1)
        self.assertEqual(len(self.llm.requests), 1)

    def test_stt_timeout_holds_stt_and_cancels_only_unsent_parser(self):
        self.stt = FakeSttProvider(asyncio.TimeoutError())
        r = self.voice(duration=verified_duration)
        self.assertEqual(r.status_code, 504)
        stages = self.record()["stages"]
        self.assertEqual([s["state"] for s in stages], ["UNKNOWN", "CANCELLED_UNSENT"])
        self.assertEqual(self.global_counter()["held"], stages[0]["reserved"])
        self.assertEqual(self.llm.requests, [])

    def test_stt_success_parser_failure_keeps_stt_charge_and_parser_hold(self):
        self.llm = FakeLlmProvider(RuntimeError("PRIVATE_PROVIDER_ERROR"))
        r = self.voice(duration=verified_duration)
        self.assertEqual(r.status_code, 502)
        stages = self.record()["stages"]
        self.assertEqual([s["state"] for s in stages], ["SETTLED", "UNKNOWN"])
        self.assertGreater(self.global_counter()["charged"], 0)
        self.assertEqual(self.global_counter()["held"], stages[1]["reserved"])
        self.assertNotIn("PRIVATE_PROVIDER_ERROR", r.text)
        self.assertNotIn("PRIVATE_PROVIDER_ERROR", repr(self.state.data))

    def test_oversized_transcript_stops_parser_without_topup(self):
        self.stt = FakeSttProvider("a" * 12001)
        r = self.voice(duration=verified_duration)
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.llm.requests, [])
        self.assertEqual(self.record()["stages"][1]["state"], "CANCELLED_UNSENT")

    def test_output_rejection_is_still_billed(self):
        self.llm = FakeLlmProvider({"answer": "Give the baby antibiotics."})
        r = self.execute()
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.global_counter()["charged"], 21)
        self.assertEqual(self.record()["stages"][0]["state"], "SETTLED")

    def test_unknown_usage_can_return_valid_product_without_refund(self):
        self.llm = FakeLlmProvider(ProviderResult(CLAIM, Accounting(stage_id="llm",
            pricing_version=LLM.version, parse_status="OK")))
        r = self.execute()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.record()["stages"][0]["state"], "UNKNOWN")
        self.assertGreater(self.global_counter()["held"], 0)

    def test_deterministic_boundary_needs_neither_idempotency_nor_quota_store(self):
        headers = {"Authorization": "Bearer valid-token"}
        r = self.execute(self.client(quota=QuotaService.unavailable()),
                         consult_body("Is this normal? Diagnose it."), headers)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["source"], "deterministic_policy")
        self.assertEqual(self.llm.requests, [])

    def test_kill_switch_and_central_switch_prevent_calls(self):
        r = self.execute(self.client(settings=test_settings(ai_enabled=False)))
        self.assertEqual(r.json()["error"]["code"], "AI_DISABLED")
        self.state.data["control/current"]["enabled"] = False
        r = self.execute()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(self.llm.requests, [])

    def test_switch_off_between_stt_and_parser_stops_second_call(self):
        outer = self
        class DisableAfterStt(FakeSttProvider):
            async def transcribe(self, request):
                result = await super().transcribe(request)
                outer.state.data["control/current"]["enabled"] = False
                return result
        self.stt = DisableAfterStt()
        r = self.voice(duration=verified_duration)
        self.assertEqual(r.status_code, 503)
        self.assertEqual(self.llm.requests, [])
        self.assertGreater(self.global_counter()["charged"], 0)

    def test_missing_idempotency_key_is_not_replaced_with_random_key(self):
        r = self.execute(headers={"Authorization": "Bearer valid-token"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.llm.requests, [])

    def test_retry_same_key_reuses_accounting_not_product_dispatch(self):
        headers = auth_headers()
        client = self.client()
        self.assertEqual(self.execute(client, headers=headers).status_code, 200)
        r = self.execute(client, headers=headers)
        self.assertEqual(r.json()["error"]["code"], "IDEMPOTENCY_REPLAY")
        self.assertEqual(len(self.llm.requests), 1)
        self.assertEqual(self.global_counter()["admissions"], 1)

    def test_same_key_different_locale_conflicts(self):
        headers = auth_headers()
        self.assertEqual(self.execute(headers=headers).status_code, 200)
        body = consult_body()
        body["locale"] = "en"
        r = self.execute(body=body, headers=headers)
        self.assertEqual(r.json()["error"]["code"], "IDEMPOTENCY_CONFLICT")
        self.assertEqual(len(self.llm.requests), 1)

    def test_commit_response_loss_never_dispatches(self):
        for step in ("reserve", "claim"):
            with self.subTest(step=step):
                self.setUp()
                self.quota.repository.store.lose_response.add(step)
                headers = auth_headers()
                r = self.execute(headers=headers)
                self.assertEqual(r.status_code, 503)
                self.execute(headers=headers)
                self.assertEqual(self.llm.requests, [])
                self.assertEqual(self.global_counter()["admissions"], 1)

    def test_quota_exhaustion_rejects_before_provider(self):
        self.state.data["control/current"] = config(global_budget=0)
        r = self.execute()
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["error"]["code"], "GLOBAL_BUDGET_EXCEEDED")
        self.assertEqual(self.llm.requests, [])

    def test_store_and_log_contain_no_product_or_private_payload(self):
        stream = io.StringIO()
        logger = logging.getLogger("quota-privacy")
        logger.handlers.clear()
        logger.propagate = False
        logger.setLevel(logging.INFO)
        logger.addHandler(logging.StreamHandler(stream))
        r = self.execute(self.client(logger=PrivacyLogger(logger=logger, hash_salt="test")),
                         consult_body("PRIVATE_MEMO 기록을 요약해줘"))
        self.assertEqual(r.status_code, 200)
        stored = repr(self.state.data) + stream.getvalue()
        for forbidden in ("PRIVATE_MEMO", "valid-token", "Bearer", "Authorization", "user-123",
                          "수면 기록은", "record_references", "fact_indexes", "PRIVATE_PROVIDER_ERROR"):
            self.assertNotIn(forbidden, stored)
        self.assertNotIn("product", self.record()["stages"][0]["accounting"])


class QuotaAsyncRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_two_apps_100_duplicate_requests_dispatch_once(self):
        state = SharedState()
        llm = FakeLlmProvider(CLAIM)
        apps = [create_app(settings=test_settings(ai_requests_per_minute=1000), verifier=FakeVerifier(),
            llm_provider=llm, stt_provider=FakeSttProvider(), quota_service=service(state)) for _ in range(2)]
        headers = auth_headers()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=apps[0]), base_url="http://local") as a, \
                   httpx.AsyncClient(transport=httpx.ASGITransport(app=apps[1]), base_url="http://local") as b:
            clients = [a, b]
            responses = await asyncio.gather(*(clients[i % 2].post("/v1/ai/execute", json=consult_body(), headers=headers) for i in range(100)))
        self.assertEqual(sum(r.status_code == 200 for r in responses), 1)
        self.assertEqual(sum(r.status_code == 409 for r in responses), 99)
        self.assertEqual(len(llm.requests), 1)

    async def test_materialized_parser_input_over_bound_never_dispatches(self):
        s = service()
        audio = ValidatedAudio(VALID_M4A, "audio/m4a", "recording.m4a")
        r = await s.begin_voice("u", auth_headers()["Idempotency-Key"], "ko", audio,
                               verified_duration(audio), "whisper-1", "gpt-4o-mini")
        await s.stt(r, SttRequest(audio.data, audio.safe_filename, audio.content_type, "whisper-1", 45), FakeSttProvider())
        llm = FakeLlmProvider(EVENTS)
        with self.assertRaises(AppError) as e:
            await s.llm(r, "parser", LlmRequest("voice_event_parse", "sys", "x" * 128_001, LLM.model, 900, 20), llm)
        self.assertEqual(e.exception.code, "COST_BOUND_UNAVAILABLE")
        await s.cancel_unsent(r)
        self.assertEqual(llm.requests, [])

    async def test_stt_actual_request_must_match_reserved_audio(self):
        s = service()
        audio = ValidatedAudio(VALID_M4A, "audio/m4a", "recording.m4a")
        r = await s.begin_voice("u", auth_headers()["Idempotency-Key"], "ko", audio,
                               verified_duration(audio), "whisper-1", LLM.model)
        stt = FakeSttProvider()
        with self.assertRaises(AppError):
            await s.stt(r, SttRequest(b"different", audio.safe_filename, audio.content_type, "whisper-1", 45), stt)
        self.assertEqual(stt.requests, [])

    async def test_provider_bills_then_process_crash_does_not_refund_or_reexecute(self):
        class ProcessDeath(BaseException): pass
        class BilledProvider:
            calls = 0
            billed = 0
            async def complete_json(self, request):
                self.calls += 1
                self.billed += 21
                raise ProcessDeath()
        s = service()
        q = LlmRequest("weekly_narrative", "sys", "{}", LLM.model, 220, 20)
        r = await s.begin_llm("u", "weekly_narrative", auth_headers()["Idempotency-Key"], "ko", {}, q)
        provider = BilledProvider()
        with self.assertRaises(ProcessDeath): await s.llm(r, "llm", q, provider)
        with self.assertRaises(AppError): await s.llm(r, "llm", q, provider)
        counter = s.repository.store.state.data[r.global_bucket]
        self.assertGreaterEqual(counter["held"], provider.billed)
        self.assertEqual(provider.calls, 1)


class AdapterAccountingTests(unittest.IsolatedAsyncioTestCase):
    async def run_adapter(self, content, usage, model="gpt-4o-mini"):
        provider = object.__new__(OpenAiLlmProvider)
        call = AsyncMock(return_value=NS(model=model, usage=usage, choices=[NS(message=NS(content=content))]))
        provider._client = NS(chat=NS(completions=NS(create=call)))
        result = await provider.complete_json(LlmRequest("weekly_narrative", "private prompt", "{}", LLM.model, 220, 20))
        self.assertEqual(call.await_count, 1)
        self.assertEqual(call.call_args.kwargs["n"], 1)
        self.assertEqual(call.call_args.kwargs["service_tier"], "default")
        return result

    async def test_invalid_json_preserves_known_billing_without_raw_content(self):
        result = await self.run_adapter("PRIVATE_RAW_NOT_JSON", NS(prompt_tokens=100, completion_tokens=10))
        self.assertIsNone(result.product)
        self.assertEqual(result.accounting.usage_status, "KNOWN")
        self.assertEqual(result.accounting.input_usage, 100)
        self.assertEqual(result.accounting.parse_status, "INVALID")
        self.assertNotIn("PRIVATE_RAW", repr(result.accounting))

    async def test_missing_usage_is_unknown_not_zero(self):
        result = await self.run_adapter(json.dumps(CLAIM), None)
        self.assertEqual(result.accounting.usage_status, "UNKNOWN")
        self.assertIsNone(result.accounting.input_usage)

    async def test_malformed_usage_and_unexpected_model_are_not_trusted(self):
        for counts in [(-1, 0), (True, 1), (1.5, 0), ("100", 2)]:
            result = await self.run_adapter(json.dumps(CLAIM), NS(prompt_tokens=counts[0], completion_tokens=counts[1]))
            self.assertEqual(result.accounting.usage_status, "CONTRADICTORY")
            self.assertIsNone(result.accounting.input_usage)
        result = await self.run_adapter(json.dumps(CLAIM), NS(prompt_tokens=1, completion_tokens=1), "PRIVATE_MODEL_PAYLOAD")
        self.assertIsNone(result.accounting.observed_model)
        self.assertNotIn("PRIVATE_MODEL", repr(result.accounting))

    async def test_accounting_schema_forbids_raw_content(self):
        for field in ("prompt", "transcript", "audio", "provider_response", "email", "baby_id", "authorization"):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                Accounting(stage_id="llm", pricing_version=LLM.version, **{field: "PRIVATE"})
