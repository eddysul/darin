"""Closed output language: provider strings and source prose are never rendered.

This intentionally narrows v2 staging copy. Fact text/source_sentence are not
typed evidence: they cannot safely be echoed or used to authorize new prose.
"""
from __future__ import annotations

from typing import Literal

from pydantic import Field, StrictInt, ValidationError

from .errors import output_rejected
from .models import (
    ConsultInput, ConsultOutput, InsightPhraseInput, InsightPhraseOutput,
    Locale, MetricKey, StrictModel, WeeklyNarrativeInput, WeeklyNarrativeOutput,
)


class RecordReferences(StrictModel):
    claim_type: Literal["record_references"]
    fact_indexes: list[StrictInt] = Field(min_length=1, max_length=20)


class MetricComparison(StrictModel):
    claim_type: Literal["metric_comparison"]
    metric: MetricKey


class Associations(StrictModel):
    claim_type: Literal["associations"]
    observation_ids: list[str] = Field(min_length=1, max_length=5)


# No question, fact text, source_sentence, provider prose, or arbitrary label is
# interpolated into these templates. Only validated counts and metric numbers.
COPY = {
    "ko": ("제공된 기록 중 {count}개 항목을 참고했어요.", "선택한 항목의 기록 비교예요", "지난 기록 {previous}{unit} → 이번 기록 {current}{unit}", "두 항목이 같은 방향으로 변하는 경향이 기록됐어요.", "두 항목이 서로 반대 방향으로 변하는 경향이 기록됐어요."),
    "en": ("Referenced {count} items in the supplied records.", "Comparison of the selected recorded metric", "Previous: {previous} {unit} → current: {current} {unit}", "The supplied observation shows the two metrics varying in the same direction.", "The supplied observation shows the two metrics varying in opposite directions."),
    "ja": ("提供された記録のうち{count}項目を参照しました。", "選択した項目の記録の比較です", "前回の記録 {previous}{unit} → 今回の記録 {current}{unit}", "記録では、二つの項目が同じ方向に変化する傾向が示されています。", "記録では、二つの項目が逆の方向に変化する傾向が示されています。"),
    "es": ("Se consultaron {count} elementos de los registros proporcionados.", "Comparación del indicador registrado seleccionado", "Anterior: {previous} {unit} → actual: {current} {unit}", "La observación proporcionada muestra que los dos indicadores varían en la misma dirección.", "La observación proporcionada muestra que los dos indicadores varían en direcciones opuestas."),
    "zh-CN": ("已参考所提供记录中的{count}个条目。", "所选项目的记录对比", "上次记录 {previous}{unit} → 本次记录 {current}{unit}", "所提供的观察显示，这两个项目有同向变化的趋势。", "所提供的观察显示，这两个项目有反向变化的趋势。"),
}
UNITS = {
    "ko": {"minutes": "분", "count": "회", "ml": "ml", "g": "g"},
    "en": {"minutes": "minutes", "count": "times", "ml": "ml", "g": "g"},
    "ja": {"minutes": "分", "count": "回", "ml": "ml", "g": "g"},
    "es": {"minutes": "minutos", "count": "veces", "ml": "ml", "g": "g"},
    "zh-CN": {"minutes": "分钟", "count": "次", "ml": "毫升", "g": "克"},
}


def render_claim(operation: str, raw: dict, request, locale: Locale):
    try:
        if operation == "consult_record_question":
            assert isinstance(request, ConsultInput)
            selection = RecordReferences.model_validate(raw)
            ids = selection.fact_indexes
            if len(set(ids)) != len(ids) or any(i < 0 or i >= len(request.facts) for i in ids):
                raise output_rejected()
            return ConsultOutput(answer=COPY[locale][0].format(count=len(ids)), used_fact_indexes=ids)
        if operation == "weekly_narrative":
            assert isinstance(request, WeeklyNarrativeInput)
            selection = MetricComparison.model_validate(raw)
            metric = next((m for m in request.metrics if m.key == selection.metric), None)
            if metric is None or metric.previous is None:
                raise output_rejected()
            return WeeklyNarrativeOutput(
                metric=metric.key, headline=COPY[locale][1],
                body=COPY[locale][2].format(
                    previous=str(metric.previous.avg).removesuffix(".0"),
                    current=str(metric.current.avg).removesuffix(".0"), unit=UNITS[locale][metric.unit],
                ),
            )
        if operation == "insight_phrase":
            assert isinstance(request, InsightPhraseInput)
            selection = Associations.model_validate(raw)
            if selection.observation_ids != [o.id for o in request.observations]:
                raise output_rejected()
            return InsightPhraseOutput(phrases=[
                {"id": o.id, "text": COPY[locale][3 if o.relation == "positive_association" else 4]}
                for o in request.observations
            ])
    except ValidationError as exc:
        raise output_rejected() from exc
    raise output_rejected()
