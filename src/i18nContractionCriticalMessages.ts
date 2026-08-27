const rows = [
  ["title", "진통 주기", "Contractions", "陣痛周期", "Contracciones", "宫缩周期"],
  ["body", "진통 시작과 끝을 기록해 간격을 확인할 수 있어요.", "Record the start and end of each contraction to see the interval.", "陣痛の開始と終わりを記録して間隔を確認できます。", "Registra el inicio y el fin de cada contracción para ver el intervalo.", "记录宫缩的开始和结束，即可查看间隔。"],
  ["start", "진통 시작", "Start contraction", "陣痛開始", "Iniciar contracción", "开始宫缩"],
  ["end", "진통 종료", "End contraction", "陣痛終了", "Finalizar contracción", "结束宫缩"],
  ["recent", "최근 진통", "Recent contractions", "最近の陣痛", "Contracciones recientes", "最近宫缩"],
  ["duration", "지속", "Duration", "持続", "Duración", "持续"],
  ["interval", "간격", "Interval", "間隔", "Intervalo", "间隔"],
  ["memoPlaceholder", "통증 느낌이나 상황을 적어보세요.", "Note how it felt or what was happening.", "痛みの感じや状況を書いてください。", "Anota la sensación o la situación.", "记下疼痛感觉或当时情况。"],
  ["safetyRecord", "이 기능은 진통 기록을 돕기 위한 도구이며, 의료 판단을 대신하지 않아요.", "This feature helps you record contractions. It does not replace medical judgment.", "この機能は陣痛の記録を助けるためのもので、医学的判断の代わりにはなりません。", "Esta función ayuda a registrar contracciones. No sustituye el criterio médico.", "此功能仅用于协助记录宫缩，不能代替医疗判断。"],
  ["safetyContact", "걱정되는 증상이 있거나 안내받은 기준에 해당하면 담당 의료진이나 병원에 연락해 주세요.", "If you have concerning symptoms or meet the guidance you were given, contact your clinician or hospital.", "気になる症状がある場合や、案内された目安に当てはまる場合は、担当の医療者または病院に連絡してください。", "Si tienes síntomas que te preocupan o coinciden con la indicación que te dieron, contacta con tu profesional sanitario o el hospital.", "如有令你担心的症状，或符合已告知的参考标准，请联系主治医护人员或医院。"],
  ["todayCount", "오늘 진통", "Today’s contractions", "今日の陣痛", "Contracciones de hoy", "今日宫缩"],
  ["lastDuration", "최근 지속", "Latest duration", "直近の持続", "Última duración", "最近持续"],
  ["lastInterval", "최근 간격", "Latest interval", "直近の間隔", "Último intervalo", "最近间隔"],
  ["avgInterval", "기록 기준 평균", "Recorded average", "記録上の平均", "Promedio según registros", "记录平均"],
  ["intensity", "세기", "Intensity", "強さ", "Intensidad", "强度"],
  ["intensityMild", "약함", "Mild", "弱い", "Leve", "较弱"],
  ["intensityModerate", "보통", "Moderate", "中程度", "Moderada", "中等"],
  ["intensityStrong", "강함", "Strong", "強い", "Fuerte", "较强"],
  ["first", "첫 기록", "First record", "最初の記録", "Primer registro", "首次记录"],
  ["none", "아직 기록이 없어요.", "No contractions recorded yet.", "まだ記録がありません。", "Aún no hay registros.", "暂无记录。"],
  ["saved", "진통을 기록했어요.", "Contraction saved.", "陣痛を記録しました。", "Contracción guardada.", "已记录宫缩。"],
  ["endRequired", "종료 시간을 선택해 주세요.", "Choose an end time.", "終了時刻を選んでください。", "Elige la hora de fin.", "请选择结束时间。"],
  ["running", "기록 중", "Recording", "記録中", "Registrando", "记录中"],
  ["continue", "이어서 기록", "Continue recording", "続けて記録", "Seguir registrando", "继续记录"],
  ["hms", "{hours}시간 {minutes}분 {seconds}초", "{hours}h {minutes}m {seconds}s", "{hours}時間{minutes}分{seconds}秒", "{hours} h {minutes} min {seconds} s", "{hours}小时{minutes}分{seconds}秒"],
  ["ms", "{minutes}분 {seconds}초", "{minutes}m {seconds}s", "{minutes}分{seconds}秒", "{minutes} min {seconds} s", "{minutes}分{seconds}秒"],
  ["m", "{minutes}분", "{minutes}m", "{minutes}分", "{minutes} min", "{minutes}分"],
  ["s", "{count}초", "{count}s", "{count}秒", "{count} s", "{count}秒"],
  ["startedAt", "시작 {time}", "Started {time}", "開始 {time}", "Inicio {time}", "开始 {time}"],
] as const;

type ContractionId = typeof rows[number][0];
export type ContractionCriticalKey = `record.contraction.${ContractionId}`;

function resource(index: 1 | 2 | 3 | 4 | 5): { [K in ContractionCriticalKey]: string } {
  return Object.fromEntries(rows.map((row) => [`record.contraction.${row[0]}`, row[index]])) as { [K in ContractionCriticalKey]: string };
}

export const contractionCriticalKo = resource(1);
export const contractionCriticalEn = resource(2);
export const contractionCriticalJa = resource(3);
export const contractionCriticalEs = resource(4);
export const contractionCriticalZhCN = resource(5);
