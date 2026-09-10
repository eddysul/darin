from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from ..errors import AppError

MAX_INT = (1 << 63) - 1
Money = Annotated[int, Field(strict=True, ge=0, le=MAX_INT)]
Label = Annotated[str, Field(pattern=r"^[a-zA-Z0-9_.:-]{1,100}$")]
Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Operation = Literal["consult_record_question", "weekly_narrative", "insight_phrase", "transcribe"]
State = Literal["RESERVED", "DISPATCHING", "SETTLED", "UNKNOWN", "SETTLED_CONSERVATIVE", "CANCELLED_UNSENT"]
TERMINAL = {"SETTLED", "SETTLED_CONSERVATIVE", "CANCELLED_UNSENT"}


def reject(code: str = "CENTRAL_QUOTA_UNAVAILABLE", status: int = 503) -> AppError:
    return AppError(code, status, "The AI request cannot be safely admitted or completed.", True)


def integer(value: int) -> int:
    if type(value) is not int or not 0 <= value <= MAX_INT:
        raise reject("COST_BOUND_UNAVAILABLE")
    return value


def add(*values: int) -> int:
    return integer(sum(integer(v) for v in values))


def cost(units: int, price: int, divisor: int) -> int:
    product = integer(integer(units) * integer(price))
    if integer(divisor) == 0:
        raise reject("COST_BOUND_UNAVAILABLE")
    # Do not truncate a fractional per-token price or overflow numerator + divisor.
    return integer(product // divisor + int(product % divisor != 0))


class Document(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class QuotaConfig(Document):
    contract: Literal["p1.2.v1"]
    version: Label
    environment: Label
    identity_namespace: Label
    enabled: bool = Field(strict=True)
    fingerprint_version: Label
    profiles: list[Label]
    valid_from: datetime
    valid_until: datetime
    minute_limit: Annotated[int, Field(strict=True, ge=0, le=1_000_000)]
    user_budget: Money
    global_budget: Money


class Accounting(Document):
    stage_id: Literal["llm", "stt", "parser"]
    provider: Literal["openai"] = "openai"
    observed_model: Label | None = None
    pricing_version: Label
    usage_status: Literal["KNOWN", "UNKNOWN", "CONTRADICTORY"] = "UNKNOWN"
    input_usage: Money | None = None
    output_usage: Money | None = None
    billable_duration_ms: Money | None = None
    transport_status: Literal["RESPONSE", "TIMEOUT", "ERROR", "CANCELLED"] = "RESPONSE"
    parse_status: Literal["OK", "INVALID", "NOT_PARSED"] = "NOT_PARSED"
    failure_category: Literal["PROVIDER_ERROR", "PROVIDER_TIMEOUT", "CONTENT_INVALID", "USAGE_INVALID", "CANCELLED"] | None = None


class Stage(Document):
    stage_id: Literal["llm", "stt", "parser"]
    profile_id: Label
    pricing_version: Label
    model: Label
    output_cap: Money
    reserved: Money
    input_bound: Money
    duration_ms: Money | None = None
    payload_digest: Digest | None = None
    state: State = "RESERVED"
    dispatch_owner: Digest | None = None
    charged: Money = 0
    observed_cost: Money | None = None
    accounting: Accounting | None = None
    violation_accounting: Accounting | None = None


class Reservation(Document):
    id: Digest
    subject: Digest
    operation: Operation
    fingerprint: Digest
    fingerprint_version: Label
    config_version: Label
    policy_version: Label
    admitted_at: datetime
    day_end: datetime
    dispatch_before: datetime
    user_bucket: str
    global_bucket: str
    stages: list[Stage]
    expires_at: datetime | None = None


class Counter(Document):
    # Persisted accounting never supplies defaults. Only explicit bootstrap may
    # construct zeros; old/incomplete documents must fail closed.
    schema_version: Literal["counter.v1"]
    bootstrap_id: Digest
    held: Money
    charged: Money
    budget: Money
    # Global day captures the entire daily budget policy once, across revisions.
    user_budget: Money
    admissions: Money


class CounterMarker(Document):
    schema_version: Literal["counter-marker.v1"]
    counter_id: Digest
    bootstrap_id: Digest
    state_digest: Digest


class Minute(Document):
    count: Money
