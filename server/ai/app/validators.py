from __future__ import annotations

import json
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
    result = _parse(VoiceEventsOutput, raw)
    grounded = set(numbers(transcript))
    for event in result.events:
        serialized = json.dumps(event.model_dump(exclude_none=True), ensure_ascii=False)
        if not set(numbers(serialized)).issubset(grounded):
            raise output_rejected()
        anchors = {
            "배변": r"(?:배변|대변|소변|응가|쉬|기저귀|diaper|stool|urine|poop|pee)",
            "식사": r"(?:식사|수유|모유|분유|이유식|우유|먹|물|feed|milk|formula|food)",
            "수면": r"(?:수면|잠|낮잠|취침|sleep|nap)",
            "키 몸무게의 변화": r"(?:키|신장|몸무게|체중|height|weight)",
            "목욕": r"(?:목욕|씻|bath)",
            "진료": r"(?:진료|병원|의사|검진|hospital|doctor|clinic)",
            "온도/습도": r"(?:체온|온도|습도|temperature|humidity)",
            "영양제": r"(?:영양제|비타민|vitamin|supplement)",
            "터미타임": r"(?:터미|tummy)",
            "간식": r"(?:간식|snack)",
            "복용 약": r"(?:복용|약|medicine|medication)",
        }
        if not re.search(anchors[event.category], transcript, re.IGNORECASE):
            raise output_rejected()
        normalized_transcript = transcript.casefold()
        for field in ("type", "color", "hospital", "reason", "name", "note"):
            value = getattr(event, field)
            if value is not None and str(value).casefold() not in normalized_transcript:
                raise output_rejected()
    return result
