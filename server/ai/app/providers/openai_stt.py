from __future__ import annotations

import asyncio

from .base import SttRequest


class OpenAiSttProvider:
    name = "openai"

    def __init__(self, api_key: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, max_retries=0)

    async def transcribe(self, request: SttRequest) -> str:
        response = await asyncio.wait_for(
            self._client.audio.transcriptions.create(
                model=request.model,
                file=(request.filename, request.data, request.content_type),
                response_format="json",
            ),
            timeout=request.timeout_seconds,
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str) or not text.strip():
            raise ValueError("empty transcript")
        return text.strip()
