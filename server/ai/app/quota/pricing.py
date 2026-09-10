"""Server-owned, immutable profiles; never deserialize prices from client inputs.

LLM bound: entire documented context, not a token estimate. Text-only, n=1,
no tools/service-tier uplift/retries. Source: developers.openai.com/api/docs/models/gpt-4o-mini.
Profiles require explicit central approval; there is no default approval in main.
"""
from __future__ import annotations

from dataclasses import dataclass

from .types import Accounting, Stage, add, cost, integer, reject


@dataclass(frozen=True)
class Profile:
    id: str
    model: str
    version: str
    input_price: int
    output_price: int
    input_unit: int
    input_bound: int
    output_limit: int
    duration: bool = False

    def reserve(self, output: int, duration_ms: int | None = None) -> int:
        if integer(self.input_price) == 0 or integer(self.input_unit) == 0:
            raise reject("COST_BOUND_UNAVAILABLE")
        if not self.duration and (integer(self.output_price) == 0 or integer(self.input_bound) == 0):
            raise reject("COST_BOUND_UNAVAILABLE")
        if integer(output) > integer(self.output_limit):
            raise reject("COST_BOUND_UNAVAILABLE")
        if self.duration:
            if duration_ms is None or integer(duration_ms) == 0:
                raise reject("COST_BOUND_UNAVAILABLE")
            return cost(duration_ms, self.input_price, self.input_unit)
        return add(cost(self.input_bound, self.input_price, self.input_unit),
                   cost(output, self.output_price, 1_000_000))

    def actual(self, usage: Accounting) -> int | None:
        if usage.usage_status != "KNOWN":
            return None
        if usage.observed_model not in {self.model, "gpt-4o-mini-2024-07-18" if not self.duration else self.model}:
            return None
        if self.duration:
            if usage.billable_duration_ms is None:
                return None
            return cost(usage.billable_duration_ms, self.input_price, self.input_unit)
        if usage.input_usage is None or usage.output_usage is None:
            return None
        return add(cost(usage.input_usage, self.input_price, self.input_unit),
                   cost(usage.output_usage, self.output_price, 1_000_000))


LLM = Profile("openai-gpt4omini-20260909", "gpt-4o-mini", "20260909.v1",
              150_000, 600_000, 1_000_000, 128_000, 16_384)
# Duration profile only becomes reachable with a trusted proof. No production
# verifier exists in P1.2; rounded-up full minutes deliberately over-reserve.
STT = Profile("openai-whisper1-20260909", "whisper-1", "20260909.v1",
              6_000, 0, 60_000, 0, 0, True)
PROFILES = {p.id: p for p in (LLM, STT)}


@dataclass(frozen=True)
class VerifiedAudioDuration:
    """Internal proof, never constructed from request fields. Test injection only until P1.3."""
    audio_digest: str
    milliseconds: int
    proof_version: str


def make_stage(stage_id: str, model: str, output: int, payload_digest: str | None,
               duration: VerifiedAudioDuration | None = None) -> Stage:
    profile = STT if stage_id == "stt" else LLM
    if model != profile.model:
        raise reject("COST_BOUND_UNAVAILABLE")
    milliseconds = None
    if profile.duration:
        if duration is None or duration.proof_version != "verified-duration.v1":
            raise reject("COST_BOUND_UNAVAILABLE")
        # Full-minute rounding includes a conservative billing-quantum allowance.
        raw = integer(duration.milliseconds)
        milliseconds = integer((raw // 60_000 + int(raw % 60_000 != 0)) * 60_000)
    return Stage(stage_id=stage_id, profile_id=profile.id, pricing_version=profile.version,
                 model=model, output_cap=output, input_bound=profile.input_bound,
                 duration_ms=milliseconds, payload_digest=payload_digest,
                 reserved=profile.reserve(output, milliseconds))
