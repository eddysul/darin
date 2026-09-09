"""Conservative, clause-scoped voice evidence. Never logs source content."""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from pydantic import ValidationError

from .errors import AppError
from .models import VoiceEvent, VoiceEventsOutput, StrictModel
from pydantic import Field


class VoiceGroundingError(AppError):
    def __init__(self, reason: str):
        super().__init__("OUTPUT_REJECTED", 422,
                         "The generated result did not pass Darin safety validation.", True)
        self.validation_reason = reason


class EvidenceEvent(VoiceEvent):
    source_text: str | None = Field(default=None, min_length=1, max_length=1200)
    amount_unit: str | None = Field(default=None, max_length=30)


class EvidenceOutput(StrictModel):
    events: list[EvidenceEvent] = Field(max_length=20)


ANCHORS = {
    "식사": r"분유|수유|모유|이유식|우유|먹|\b(?:feed\w*|milk|formula|food)\b|授乳|ミルク|喂奶|餵奶|奶|leche|aliment",
    "수면": r"수면|잠|낮잠|취침|잤|자고|\b(?:sleep\w*|slept|nap\w*)\b|睡|寝|durmi|sueño",
    "배변": r"배변|대변|소변|응가|기저귀|\b(?:diaper|stool|urine|poop|pee)\b|おむつ|尿布|pañal",
    "목욕": r"목욕|씻|\bbath\w*\b|お風呂|入浴|洗澡|bañ",
    "키 몸무게의 변화": r"키|신장|몸무게|체중|height|weight",
    "진료": r"진료|병원|의사|검진|hospital|doctor|clinic",
    "온도/습도": r"체온|온도|습도|temperature|humidity",
    "영양제": r"영양제|비타민|vitamin|supplement",
    "터미타임": r"터미|tummy",
    "간식": r"간식|snack",
    "복용 약": r"복용|약|medicine|medication",
}
UNCONFIRMED = re.compile(
    r"안\s|안(?:했|하|먹|자)|못\s|않|없|아니|하려|할\s*예정|거예요|거야|계획|예정|했나|할까|[?？]|"
    r"\b(?:no|not|never|without|didn't|didn’t|plan|planning|will|going to)\b|"
    r"ない|なかった|ません|予定|没|沒有|没有|不|打算|\b(?:sin|nunca)\b", re.I)
UNIT_PATTERNS = {
    "ml": r"ml\b|밀리리터|millilit(?:er|re)s?\b|ミリリットル|毫升|mililitros?\b",
    "minutes": r"분|minutes?\b|mins?\b|分(?:钟|鐘)?|minutos?\b",
    "g": r"g\b|그램|grams?\b|グラム|克|gramos?\b",
    "kg": r"kg\b|킬로그램|kilograms?\b",
    "cm": r"cm\b|센티미터|centimet(?:er|re)s?\b",
    "celsius": r"°\s*c\b|도|degrees?\b",
    "percent": r"%|퍼센트|percent\b",
}
WORDS = dict(zip("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(), range(20)))
WORDS.update(dict(zip("twenty thirty forty fifty sixty seventy eighty ninety".split(), range(20,100,10))))
WORD_NUMBER = re.compile(r"\b(?:" + "|".join(WORDS) + r"|hundred)(?:[ -]+(?:" + "|".join(WORDS) + r"|hundred))*\b", re.I)


def normalized(text: str) -> str:
    def convert(match):
        tokens = re.split(r"[ -]+", match.group().lower())
        # A small exact grammar; no guesses for unsupported number phrases.
        if len(tokens) >= 2 and tokens[0] in WORDS and 1 <= WORDS[tokens[0]] <= 9 and tokens[1] == "hundred":
            base, tokens = WORDS[tokens[0]] * 100, tokens[2:]
        else:
            base = 0
        if not tokens:
            return str(base)
        if len(tokens) == 1 and tokens[0] in WORDS:
            return str(base + WORDS[tokens[0]])
        if len(tokens) == 2 and WORDS.get(tokens[0],0) >= 20 and 1 <= WORDS.get(tokens[1],0) <= 9:
            return str(base + WORDS[tokens[0]] + WORDS[tokens[1]])
        return match.group()
    return WORD_NUMBER.sub(convert, text).casefold()


def clauses(transcript: str) -> list[str]:
    # Commas stay within a clause ("At three PM, formula feeding, 120 ml").
    # Split a comma only if both sides independently identify an event.
    parts = [p.strip() for p in re.split(r"[;；\n]|(?<!\d)[.!。](?!\d)", transcript) if p.strip()]
    result = []
    has_anchor = lambda s: any(re.search(p, s, re.I) for p in ANCHORS.values())
    for part in parts:
        start = 0
        # A connector alone is not an event boundary. Keep trailing context in
        # "목욕했다고 안 했어요" and "bath and not done" with its event.
        for m in re.finditer(r"[,，]|(?<=고)\s+|\band\b|그리고", part):
            if has_anchor(part[start:m.start()]) and has_anchor(part[m.end():]):
                result.append(part[start:m.start()].strip()); start = m.end()
        result.append(part[start:].strip())
    return result


def fail(reason: str):
    raise VoiceGroundingError(reason)


def validate(raw: dict[str, Any], transcript: str) -> VoiceEventsOutput:
    try:
        parsed = EvidenceOutput.model_validate(raw)
    except ValidationError:
        fail("STRUCTURE_INVALID")
    parts = clauses(transcript)
    result = []
    used = set()
    for event in parsed.events:
        candidates = [p for p in parts if re.search(ANCHORS[event.category], p, re.I)]
        copied = None
        if event.source_text is not None:
            # Match literal continuous evidence, but retain the enclosing server
            # clause as the owner of negation, modality and event-type context.
            copied = event.source_text.strip().rstrip('.!。').strip()
            if not copied:
                fail("SOURCE_EVIDENCE_MISMATCH")
            occurrences = list(re.finditer(r"(?=" + re.escape(copied) + r")", transcript))
            if not occurrences:
                fail("SOURCE_EVIDENCE_MISMATCH")
            if len(occurrences) != 1:
                fail("SOURCE_AMBIGUOUS")
            start = occurrences[0].start()
            end = start + len(copied)
            # A substring must not turn 120ml into 20ml or minutes into min.
            if (start and re.match(r"[A-Za-z0-9.]", transcript[start-1])
                    and re.match(r"[A-Za-z0-9.]", copied[0])) or (
                    end < len(transcript) and re.match(r"[A-Za-z0-9.]", transcript[end])
                    and re.match(r"[A-Za-z0-9.]", copied[-1])
                    and transcript[end] != '.'):
                fail("SOURCE_EVIDENCE_MISMATCH")
            candidates = [p for p in candidates if copied in p]
            if not candidates:
                fail("SOURCE_EVIDENCE_MISMATCH")
        if len(candidates) != 1:
            fail("EVENT_TYPE_NOT_GROUNDED")
        source = candidates[0]
        if UNCONFIRMED.search(source):
            fail("EVENT_NOT_CONFIRMED")
        categories = [c for c,p in ANCHORS.items() if re.search(p, source, re.I)]
        if categories != [event.category]:
            fail("AMBIGUOUS_EVENT_SPAN")
        if source in used:
            fail("DUPLICATE_SOURCE_EVENT")
        used.add(source)
        # Values/units/text come only from selected evidence, never the global
        # transcript. Omitted source_text retains the unique-clause legacy path.
        evidence = normalized(copied if copied is not None else source)
        def quantity(value, unit):
            pairs = re.findall(r"(?<![\w.])([0-9]+(?:\.[0-9]+)?)\s*(?:" + UNIT_PATTERNS[unit] + r")", evidence, re.I)
            if len(pairs) > 1:
                fail("AMBIGUOUS_EVENT_SPAN")
            if not pairs or Decimal(str(value)) not in {Decimal(x) for x in pairs}:
                fail("NUMBER_UNIT_NOT_GROUNDED")
        if event.amount is not None:
            if event.category != "식사" or isinstance(event.amount, str):
                fail("UNSUPPORTED_QUANTITY")
            unit = event.amount_unit or "ml"  # existing numeric feeding amount contract
            canonical = next((u for u,p in UNIT_PATTERNS.items() if re.fullmatch(p,unit,re.I)), None)
            if canonical not in {"ml", "g"}:
                fail("UNIT_NOT_GROUNDED")
            # Client numeric amount has no unit field: only volume is representable.
            if canonical != "ml":
                fail("UNSUPPORTED_QUANTITY")
            quantity(event.amount, canonical)
        elif event.amount_unit is not None:
            fail("UNIT_NOT_GROUNDED")
        if event.duration_min is not None:
            if event.category not in {"수면", "터미타임"}:
                fail("UNSUPPORTED_QUANTITY")
            quantity(event.duration_min, "minutes")
        for field, unit, category, label in [("height_cm","cm","키 몸무게의 변화",r"키|신장|height"),("weight_kg","kg","키 몸무게의 변화",r"몸무게|체중|weight"),("body_temp","celsius","온도/습도",r"체온|body temperature"),("room_temp","celsius","온도/습도",r"실온|실내 온도|room temperature"),("humidity","percent","온도/습도",r"습도|humidity")]:
            value = getattr(event,field)
            if value is not None:
                if event.category != category:
                    fail("UNSUPPORTED_QUANTITY")
                found = re.findall(r"(?:"+label+r")\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:"+UNIT_PATTERNS[unit]+r")",evidence,re.I)
                if len(found) != 1 or Decimal(found[0]) != Decimal(str(value)):
                    fail("NUMBER_UNIT_NOT_GROUNDED")
        for field in ("time", "time_start", "time_end"):
            value = getattr(event,field)
            if value is not None:
                # No inferred AM/PM, date or cross-clause time borrowing.
                found = re.findall(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)\s*(am|pm)?",evidence)
                valid = {f"{(int(h)%12+(12 if p=='pm' else 0)) if p else int(h):02}:{m}" for h,m,p in found if not p or 1 <= int(h) <= 12}
                for h, period in re.findall(r"\b(1[0-2]|[1-9])\s*(am|pm)\b",evidence):
                    valid.add(f"{int(h)%12+(12 if period=='pm' else 0):02}:00")
                if len(valid) != 1 or value not in valid:
                    fail("TIME_NOT_GROUNDED")
        for field in ("type", "color", "hospital", "reason", "name", "note"):
            value = getattr(event,field)
            if value is not None and str(value).casefold() not in (copied if copied is not None else source).casefold():
                fail("TEXT_FIELD_NOT_GROUNDED")
        result.append(VoiceEvent.model_validate(event.model_dump(exclude={"source_text","amount_unit"})))
    return VoiceEventsOutput(events=result)
