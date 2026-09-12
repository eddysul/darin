from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from dataclasses import replace
from typing import Callable

from ..config import POLICY_VERSION
from ..telemetry import METRICS
from ..providers.base import LlmRequest, ProviderResult, SttRequest
from .identity import Fingerprints, digest
from .pricing import VerifiedAudioDuration, make_stage
from .repository import CentralQuotaRepository, QuotaRepository, UnavailableStore
from .types import Accounting, Reservation, reject


def wire_bytes(request: LlmRequest) -> bytes:
    return json.dumps({"model": request.model, "max_tokens": request.max_output_tokens,
        "n": 1, "service_tier": "default", "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": request.system_prompt},
                     {"role": "user", "content": request.untrusted_input}]},
        sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


def audio_wire_bytes(request: SttRequest) -> bytes:
    return json.dumps({"model": request.model, "audio_digest": hashlib.sha256(request.data).hexdigest(),
        "filename": request.filename, "content_type": request.content_type, "response_format": "json"},
        sort_keys=True, separators=(",", ":")).encode()


class QuotaService:
    def __init__(self, repository: QuotaRepository, fingerprints: Fingerprints):
        self.repository = repository
        self.fingerprints = fingerprints

    @classmethod
    def unavailable(cls):
        keys = Fingerprints({})
        return cls(CentralQuotaRepository(UnavailableStore(), keys, "unconfigured", "unconfigured"), keys)

    @classmethod
    def for_firestore(cls, client, fingerprints: Fingerprints, environment: str, namespace: str):
        """Explicit composition only; callers own database/IAM/key provisioning."""
        from .firestore import FirestoreStore
        return cls(CentralQuotaRepository(FirestoreStore(client), fingerprints, environment, namespace), fingerprints)

    async def begin_llm(self, user, operation, nonce, locale, value, request: LlmRequest):
        config = await self.repository.configuration()
        payload = wire_bytes(request)
        stage = make_stage("llm", request.model, request.max_output_tokens,
                           self.fingerprints.calculate(config.fingerprint_version, payload))
        self._check_input(stage, payload)
        record, new = await self.repository.reserve(user, operation, nonce,
            self.fingerprints.canonical(operation, locale, value), [stage], config.version, POLICY_VERSION)
        if not new:
            raise reject("IDEMPOTENCY_REPLAY", 409)
        return record

    async def begin_voice(self, user, nonce, locale, audio, duration: VerifiedAudioDuration | None,
                          stt_model, llm_model):
        audio_digest = hashlib.sha256(audio.data).hexdigest()
        if (duration is None or not isinstance(duration, VerifiedAudioDuration)
                or duration.audio_digest != audio_digest):
            raise reject("COST_BOUND_UNAVAILABLE")
        config = await self.repository.configuration()
        canonical = self.fingerprints.canonical("transcribe", locale,
            {"audio_digest": audio_digest, "content_type": audio.content_type})
        stt = make_stage("stt", stt_model, 0,
            self.fingerprints.calculate(config.fingerprint_version,
                audio_wire_bytes(SttRequest(audio.data, audio.safe_filename, audio.content_type, stt_model, 45))), duration)
        parser = make_stage("parser", llm_model, 900, None)
        record, new = await self.repository.reserve(user, "transcribe", nonce, canonical,
                                                    [stt, parser], config.version, POLICY_VERSION)
        if not new:
            raise reject("IDEMPOTENCY_REPLAY", 409)
        return record

    @staticmethod
    def _check_input(stage, payload):
        # This byte gate is NOT used as a token estimator. We reserve the entire
        # model context. Oversized materialized parser inputs fail before dispatch.
        if len(payload) > stage.input_bound:
            raise reject("COST_BOUND_UNAVAILABLE")

    async def llm(self, record: Reservation, stage_id: str, request: LlmRequest, provider):
        stage = next(s for s in record.stages if s.stage_id == stage_id)
        payload = wire_bytes(request)
        self._check_input(stage, payload)
        if request.model != stage.model or request.max_output_tokens != stage.output_cap:
            raise reject("COST_BOUND_UNAVAILABLE")
        signature = self.fingerprints.calculate(record.fingerprint_version, payload)
        bound = replace(request, stage_id=stage_id, pricing_version=stage.pricing_version)
        return await self._call(record, stage, signature, lambda: provider.complete_json(bound))

    async def stt(self, record, request: SttRequest, provider):
        stage = next(s for s in record.stages if s.stage_id == "stt")
        if request.model != stage.model:
            raise reject("COST_BOUND_UNAVAILABLE")
        bound = replace(request, stage_id="stt", pricing_version=stage.pricing_version)
        signature = self.fingerprints.calculate(record.fingerprint_version, audio_wire_bytes(request))
        return await self._call(record, stage, signature, lambda: provider.transcribe(bound))

    async def _call(self, record, stage, signature, invoke: Callable):
        owner = digest("dispatch-owner", uuid.uuid4().hex)
        if not await self.repository.claim(record.id, stage.stage_id, owner, signature):
            raise reject("IDEMPOTENCY_REPLAY", 409)
        # Never retry/reacquire after an ambiguous claim commit. Exceptions from
        # claim above leave provider calls at zero, even if the store committed.
        try:
            METRICS.add("provider_dispatch")
            result = await invoke()
        except asyncio.CancelledError:
            await self._unknown_best_effort(record, stage, owner)
            raise
        except Exception as exc:
            timeout = isinstance(exc, (asyncio.TimeoutError, TimeoutError))
            accounting = Accounting(stage_id=stage.stage_id, pricing_version=stage.pricing_version,
                transport_status="TIMEOUT" if timeout else "ERROR",
                failure_category="PROVIDER_TIMEOUT" if timeout else "PROVIDER_ERROR")
            await self.repository.reconcile(record.id, stage.stage_id, owner, accounting)
            raise reject("PROVIDER_TIMEOUT" if timeout else "PROVIDER_ERROR", 504 if timeout else 502) from None
        if not isinstance(result, ProviderResult):
            await self._unknown_best_effort(record, stage, owner)
            raise reject("PROVIDER_ERROR", 502)
        await self.repository.reconcile(record.id, stage.stage_id, owner, result.accounting)
        if result.accounting.parse_status != "OK":
            raise reject("PROVIDER_ERROR", 502)
        return result.product

    async def _unknown_best_effort(self, record, stage, owner):
        try:
            await self.repository.mark_unknown(record.id, stage.stage_id, owner)
        except Exception:
            pass  # DISPATCHING already holds the full R; never refund on failure.

    async def cancel_unsent(self, record):
        for stage in record.stages:
            try:
                await self.repository.cancel_unsent(record.id, stage.stage_id)
            except Exception:
                pass  # Failed cleanup retains funds; it does not reopen a stage.
