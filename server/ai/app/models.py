from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Locale = Literal["ko", "en", "ja", "es", "zh-CN"]
OperationName = Literal["consult_record_question", "weekly_narrative", "insight_phrase"]
MetricKey = Literal[
    "feedCount",
    "feedVolume",
    "feedIntervalAvg",
    "firstFeedMinutes",
    "lastFeedMinutes",
    "sleepMinutes",
    "nightSleepMinutes",
    "longestSleepMinutes",
    "sleepCount",
    "diaperCount",
    "stoolCount",
    "tummyMinutes",
    "playMinutes",
    "bathMinutes",
    "waterVolume",
    "foodAmount",
    "milkVolume",
]

ShortText = Annotated[str, Field(min_length=1, max_length=500)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class ExecuteEnvelope(StrictModel):
    operation: str = Field(min_length=1, max_length=64)
    input: dict[str, Any]
    locale: Locale = "ko"


class FactItem(StrictModel):
    kind: str = Field(min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    text: ShortText
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class DateRange(StrictModel):
    start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def ordered(self) -> "DateRange":
        if self.start > self.end:
            raise ValueError("date range must be ordered")
        return self


class ConsultInput(StrictModel):
    question: str = Field(min_length=1, max_length=2_000)
    facts: list[FactItem] = Field(min_length=1, max_length=80)
    date_range: DateRange
    history_complete: bool


class MetricWindow(StrictModel):
    avg: float = Field(ge=0, le=100_000)
    min: float = Field(ge=0, le=100_000)
    max: float = Field(ge=0, le=100_000)
    days: int = Field(ge=1, le=14)

    @model_validator(mode="after")
    def valid_range(self) -> "MetricWindow":
        if self.min > self.avg or self.avg > self.max:
            raise ValueError("metric window values are inconsistent")
        return self


class WeeklyMetricInput(StrictModel):
    key: MetricKey
    unit: Literal["minutes", "count", "ml", "g"]
    current: MetricWindow
    previous: MetricWindow | None
    daily: list[Annotated[float, Field(ge=0, le=100_000)] | None] = Field(min_length=1, max_length=14)
    change_ratio: float | None = Field(default=None, ge=-1000, le=1000)


class WeeklyPeriod(StrictModel):
    date_keys: list[str] = Field(min_length=1, max_length=14)
    recorded_days: int = Field(ge=0, le=14)
    age_months: float | None = Field(default=None, ge=0, le=360)

    @field_validator("date_keys")
    @classmethod
    def valid_dates(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values):
            raise ValueError("date keys must be unique")
        for value in values:
            date.fromisoformat(value)
        return values


class WeeklyNarrativeInput(StrictModel):
    period: WeeklyPeriod
    metrics: list[WeeklyMetricInput] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def consistent_table(self) -> "WeeklyNarrativeInput":
        if len({metric.key for metric in self.metrics}) != len(self.metrics):
            raise ValueError("metric keys must be unique")
        if any(len(metric.daily) != len(self.period.date_keys) for metric in self.metrics):
            raise ValueError("daily values must align with date keys")
        if not any(metric.previous is not None for metric in self.metrics):
            raise ValueError("at least one metric must have a previous window")
        return self


class InsightObservation(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.:-]+$")
    input_metric: MetricKey
    output_metric: MetricKey
    relation: Literal["positive_association", "negative_association"]
    source_sentence: str = Field(min_length=1, max_length=500)
    sample_days: int = Field(ge=3, le=365)

    @model_validator(mode="after")
    def different_metrics(self) -> "InsightObservation":
        if self.input_metric == self.output_metric:
            raise ValueError("an insight must relate two different metrics")
        return self


class InsightPhraseInput(StrictModel):
    observations: list[InsightObservation] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def unique_ids(self) -> "InsightPhraseInput":
        if len({item.id for item in self.observations}) != len(self.observations):
            raise ValueError("observation ids must be unique")
        return self


class ConsultOutput(StrictModel):
    answer: str = Field(min_length=1, max_length=1_200)
    used_fact_indexes: list[int] = Field(max_length=20)

    @field_validator("used_fact_indexes")
    @classmethod
    def unique_fact_indexes(cls, values: list[int]) -> list[int]:
        if len(set(values)) != len(values):
            raise ValueError("fact indexes must be unique")
        return values


class WeeklyNarrativeOutput(StrictModel):
    metric: MetricKey
    headline: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=500)


class InsightPhraseItem(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=300)


class InsightPhraseOutput(StrictModel):
    phrases: list[InsightPhraseItem] = Field(min_length=1, max_length=5)


class ExecuteResponse(StrictModel):
    operation: OperationName
    result: dict[str, Any]
    source: Literal["provider", "deterministic_policy"] = "provider"
    policy_version: str = Field(serialization_alias="policyVersion")


class VoiceEvent(StrictModel):
    category: Literal[
        "배변",
        "식사",
        "수면",
        "키 몸무게의 변화",
        "목욕",
        "진료",
        "온도/습도",
        "영양제",
        "터미타임",
        "간식",
        "복용 약",
    ]
    time: str | None = Field(default=None, max_length=40)
    time_start: str | None = Field(default=None, max_length=40)
    time_end: str | None = Field(default=None, max_length=40)
    duration_min: float | None = Field(default=None, ge=0, le=1_440)
    type: str | None = Field(default=None, max_length=80)
    amount: float | str | None = None
    color: str | None = Field(default=None, max_length=80)
    height_cm: float | None = Field(default=None, ge=0, le=300)
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    hospital: str | None = Field(default=None, max_length=160)
    reason: str | None = Field(default=None, max_length=300)
    body_temp: float | None = Field(default=None, ge=20, le=50)
    room_temp: float | None = Field(default=None, ge=-20, le=60)
    humidity: float | None = Field(default=None, ge=0, le=100)
    name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("amount")
    @classmethod
    def bounded_amount(cls, value: float | str | None) -> float | str | None:
        if isinstance(value, str) and len(value) > 80:
            raise ValueError("amount is too long")
        return value


class VoiceEventsOutput(StrictModel):
    events: list[VoiceEvent] = Field(max_length=20)


class TranscribeResponse(StrictModel):
    events: list[VoiceEvent]
    date: str
    raw_text: str
