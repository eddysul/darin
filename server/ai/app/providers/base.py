from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class LlmRequest:
    operation: str
    system_prompt: str
    untrusted_input: str
    model: str
    max_output_tokens: int
    timeout_seconds: float


class LlmProvider(Protocol):
    name: str

    async def complete_json(self, request: LlmRequest) -> dict[str, Any]: ...


@dataclass(frozen=True, slots=True)
class SttRequest:
    data: bytes
    filename: str
    content_type: str
    model: str
    timeout_seconds: float


class SttProvider(Protocol):
    name: str

    async def transcribe(self, request: SttRequest) -> str: ...
