from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Protocol
from ..quota.types import Accounting


@dataclass(frozen=True, slots=True)
class ProviderResult:
    product: Any
    accounting: Accounting

    @classmethod
    def parse_product(cls, accounting: Accounting, parse: Callable[[], Any]) -> ProviderResult:
        """Accounting is already owned before invoking untrusted-content parsing.

        Every ordinary parsing/schema exception is a product failure, not a
        transport/usage failure. Never include its message or content in metadata.
        Process termination/cancellation still retains the durable reservation.
        """
        try:
            product = parse()
        except Exception:
            return cls(None, accounting.model_copy(update={
                "parse_status": "INVALID", "failure_category": "CONTENT_INVALID"}))
        return cls(product, accounting.model_copy(update={"parse_status": "OK"}))


@dataclass(frozen=True, slots=True)
class LlmRequest:
    operation: str
    system_prompt: str
    untrusted_input: str
    model: str
    max_output_tokens: int
    timeout_seconds: float
    stage_id: str = "llm"
    pricing_version: str = "20260909.v1"


class LlmProvider(Protocol):
    name: str

    async def complete_json(self, request: LlmRequest) -> ProviderResult: ...


@dataclass(frozen=True, slots=True)
class SttRequest:
    data: bytes
    filename: str
    content_type: str
    model: str
    timeout_seconds: float
    stage_id: str = "stt"
    pricing_version: str = "20260909.v1"


class SttProvider(Protocol):
    name: str

    async def transcribe(self, request: SttRequest) -> ProviderResult: ...
