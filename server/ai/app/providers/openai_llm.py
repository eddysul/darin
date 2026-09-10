from __future__ import annotations

import asyncio
import json

from .base import LlmRequest, ProviderResult
from ..quota.types import Accounting, MAX_INT


class OpenAiLlmProvider:
    name = "openai"

    def __init__(self, api_key: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, max_retries=0)

    async def complete_json(self, request: LlmRequest) -> ProviderResult:
        response = await asyncio.wait_for(
            self._client.chat.completions.create(
                model=request.model,
                max_tokens=request.max_output_tokens,
                n=1,
                service_tier="default",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.untrusted_input},
                ],
            ),
            timeout=request.timeout_seconds,
        )
        # Extract numeric metadata BEFORE parsing any model-written content.
        usage = getattr(response, "usage", None)
        observed = getattr(response, "model", None)
        allowed_model = observed in {request.model, "gpt-4o-mini-2024-07-18"}
        counts = (getattr(usage, "prompt_tokens", None), getattr(usage, "completion_tokens", None))
        valid = all(type(v) is int and 0 <= v <= MAX_INT for v in counts)
        accounting = Accounting(stage_id=request.stage_id, pricing_version=request.pricing_version,
            observed_model=observed if allowed_model else None,
            usage_status="KNOWN" if valid and allowed_model else ("UNKNOWN" if usage is None and allowed_model else "CONTRADICTORY"),
            input_usage=counts[0] if valid else None, output_usage=counts[1] if valid else None)
        return ProviderResult.parse_product(accounting, lambda: self._parse_content(response))

    @staticmethod
    def _parse_content(response):
        parsed = json.loads(response.choices[0].message.content)
        if not isinstance(parsed, dict):
            raise ValueError()
        return parsed
