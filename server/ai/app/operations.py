from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from .config import POLICY_VERSION, Settings
from .errors import AppError, invalid_input
from .models import (
    ConsultInput,
    ExecuteResponse,
    InsightPhraseInput,
    Locale,
    WeeklyNarrativeInput,
)
from .policy import (
    BOUNDARY_RESPONSE,
    requests_clinical_judgment,
    system_prompt,
    untrusted_payload,
)
from .providers import LlmProvider, LlmRequest
from .safe_claims import render_claim


@dataclass(frozen=True, slots=True)
class OperationDefinition:
    input_model: type
    max_output_tokens: int


OPERATIONS: dict[str, OperationDefinition] = {
    "consult_record_question": OperationDefinition(ConsultInput, 450),
    "weekly_narrative": OperationDefinition(WeeklyNarrativeInput, 220),
    "insight_phrase": OperationDefinition(InsightPhraseInput, 300),
}


def parse_operation_input(operation: str, raw: dict[str, Any]):
    definition = OPERATIONS.get(operation)
    if definition is None:
        raise AppError("INVALID_OPERATION", 400, "The requested AI operation is not allowed.")
    try:
        return definition.input_model.model_validate(raw)
    except ValidationError as exc:
        raise invalid_input() from exc


async def execute_operation(
    operation: str,
    operation_input: Any,
    locale: Locale,
    settings: Settings,
    provider: LlmProvider,
) -> ExecuteResponse:
    if operation == "consult_record_question" and requests_clinical_judgment(operation_input.question):
        return ExecuteResponse(
            operation=operation,
            result={"answer": BOUNDARY_RESPONSE[locale], "used_fact_indexes": []},
            source="deterministic_policy",
            policy_version=POLICY_VERSION,
        )

    definition = OPERATIONS[operation]
    request = LlmRequest(
        operation=operation,
        system_prompt=system_prompt(operation, locale),
        untrusted_input=untrusted_payload(operation_input.model_dump(mode="json")),
        model=settings.llm_model,
        max_output_tokens=definition.max_output_tokens,
        timeout_seconds=settings.llm_timeout_seconds,
    )
    try:
        raw = await provider.complete_json(request)
    except (asyncio.TimeoutError, TimeoutError) as exc:
        raise AppError(
            "PROVIDER_TIMEOUT",
            504,
            "The AI provider did not respond in time.",
            fallback_recommended=True,
        ) from exc
    except Exception as exc:
        raise AppError(
            "PROVIDER_ERROR",
            502,
            "The AI provider request failed.",
            fallback_recommended=True,
        ) from exc

    result = render_claim(operation, raw, operation_input, locale)
    return ExecuteResponse(
        operation=operation,
        result=result.model_dump(mode="json"),
        policy_version=POLICY_VERSION,
    )
