"""Bounded EN/KO clock parsing; no wall-clock defaults or inferred precision."""
import re

APPROXIMATE = re.compile(r"쯤|무렵|정도|전후|경에|(?<=[시분])경|조금\s*전|\b(?:about|around|roughly|approximately|ish)\b", re.I)
PATTERNS = [
    # Broad digit ranges are consumed before validation to avoid accepting a
    # valid-looking substring of an invalid clock such as 8:99 PM.
    (re.compile(r"(?<![\w:.])(\d{1,2})(?::(\d{1,2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)(?!\w)", re.I), "en"),
    (re.compile(r"(?<![\w:.])(\d{1,2})(?::(\d{1,2}))?\s+in the (morning|afternoon|evening)(?!\w)", re.I), "daypart"),
    (re.compile(r"(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?"), "ko"),
    (re.compile(r"(?<![\w:.])(\d{1,2}):(\d{1,2})(?![A-Za-z0-9:.])"), "24h"),
    # Bare Korean hours cannot establish AM/PM, but still must be excluded
    # from duration evidence (8시 30분 is not 30 minutes of sleep).
    (re.compile(r"(?<!\d)(\d{1,2})시(?:\s*(\d{1,2})분)?"), "unspecified"),
]


def clocks(text: str):
    occupied = []
    values = set()
    invalid = False
    for pattern, kind in PATTERNS:
        for match in pattern.finditer(text):
            if any(match.start() < end and start < match.end() for start,end in occupied):
                continue
            occupied.append(match.span())
            if kind == "ko":
                period,h,m = match.groups(); pm = period == '오후'
            elif kind in {"en", "daypart"}:
                h,m,period = match.groups(); pm = period.lower().startswith('p') or period.lower() in {'afternoon','evening'}
            else:
                h,m = match.groups(); pm = False
            hour,minute = int(h),int(m or 0)
            if kind == "unspecified" or minute > 59 or (kind == "24h" and hour > 23) or (kind != "24h" and not 1 <= hour <= 12):
                invalid = True
                continue
            if kind != "24h":
                hour = hour % 12 + (12 if pm else 0)
            values.add(f"{hour:02}:{minute:02}")
    if invalid or APPROXIMATE.search(text):
        values.clear()
    return values, occupied


def without_clocks(text: str) -> str:
    _, spans = clocks(text)
    chars = list(text)
    for start,end in spans:
        chars[start:end] = ' ' * (end-start)
    return ''.join(chars)
