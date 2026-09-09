from __future__ import annotations

import re
from collections import Counter
from typing import Any

from pydantic import ValidationError

from .errors import output_rejected
from .models import (
    ConsultInput,
    ConsultOutput,
    InsightPhraseInput,
    InsightPhraseOutput,
    VoiceEventsOutput,
    WeeklyNarrativeInput,
    WeeklyNarrativeOutput,
    Locale,
)
from .policy import (
    makes_absolute_absence_claim,
    number_counter,
    numbers,
    output_is_safe,
    output_locale_is_safe,
)


def _parse(model: type, raw: dict[str, Any]):
    try:
        return model.model_validate(raw)
    except ValidationError as exc:
        raise output_rejected() from exc


def validate_consult_output(raw: dict[str, Any], request: ConsultInput, locale: Locale) -> ConsultOutput:
    result = _parse(ConsultOutput, raw)
    if not output_is_safe(result.answer) or not output_locale_is_safe(result.answer, locale):
        raise output_rejected()
    evidence = " ".join(item.text for item in request.facts)
    if not set(numbers(result.answer)).issubset(set(numbers(evidence))):
        raise output_rejected()
    if not request.history_complete and makes_absolute_absence_claim(result.answer):
        raise output_rejected()
    if not result.used_fact_indexes or any(
        index < 0 or index >= len(request.facts) for index in result.used_fact_indexes
    ):
        raise output_rejected()
    return result


def validate_weekly_output(
    raw: dict[str, Any],
    request: WeeklyNarrativeInput,
    locale: Locale,
) -> WeeklyNarrativeOutput:
    result = _parse(WeeklyNarrativeOutput, raw)
    selected = next((metric for metric in request.metrics if metric.key == result.metric), None)
    if selected is None or selected.previous is None:
        raise output_rejected()
    combined = f"{result.headline} {result.body}"
    if not output_is_safe(combined) or not output_locale_is_safe(combined, locale) or numbers(result.headline):
        raise output_rejected()
    expected = Counter(
        [
            *numbers(str(selected.previous.avg)),
            *numbers(str(selected.current.avg)),
        ]
    )
    if number_counter(result.body) != expected:
        raise output_rejected()
    unit_patterns = {
        "minutes": r"(?:minutes?|mins?|분|分|分钟|分鐘|minutos?)",
        "count": r"(?:times?|counts?|entries|회|건|回|次|件|veces?)",
        "ml": r"(?:ml|millilit(?:er|re)s?|毫升|ミリリットル|mililitros?)",
        "g": r"(?:g|grams?|그램|克|グラム|gramos?)",
    }
    if not re.search(unit_patterns[selected.unit], result.body, re.IGNORECASE):
        raise output_rejected()
    return result


def validate_insight_output(
    raw: dict[str, Any],
    request: InsightPhraseInput,
    locale: Locale,
) -> InsightPhraseOutput:
    result = _parse(InsightPhraseOutput, raw)
    if [item.id for item in result.phrases] != [item.id for item in request.observations]:
        raise output_rejected()
    for phrase, observation in zip(result.phrases, request.observations, strict=True):
        if not output_is_safe(phrase.text) or not output_locale_is_safe(phrase.text, locale):
            raise output_rejected()
        required = number_counter(observation.source_sentence)
        allowed = required + number_counter(str(observation.sample_days))
        actual = number_counter(phrase.text)
        if any(actual[value] < count for value, count in required.items()):
            raise output_rejected()
        if any(count > allowed[value] for value, count in actual.items()):
            raise output_rejected()
    return result


def validate_voice_events(raw: dict[str, Any], transcript: str) -> VoiceEventsOutput:
    from .voice_grounding import validate
    return validate(raw, transcript)
