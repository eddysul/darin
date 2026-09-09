"""External provider adapters."""

from .base import LlmProvider, LlmRequest, SttProvider, SttRequest
from .openai_llm import OpenAiLlmProvider
from .openai_stt import OpenAiSttProvider

__all__ = [
    "LlmProvider",
    "LlmRequest",
    "OpenAiLlmProvider",
    "OpenAiSttProvider",
    "SttProvider",
    "SttRequest",
]
