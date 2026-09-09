from __future__ import annotations

import asyncio
import json
from typing import Any

from .base import LlmRequest


class OpenAiLlmProvider:
    name = "openai"

    def __init__(self, api_key: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, max_retries=0)

    async def complete_json(self, request: LlmRequest) -> dict[str, Any]:
        response = await asyncio.wait_for(
            self._client.chat.completions.create(
                model=request.model,
                max_tokens=request.max_output_tokens,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.untrusted_input},
                ],
            ),
            timeout=request.timeout_seconds,
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("empty provider response")
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("provider response must be an object")
        return parsed
