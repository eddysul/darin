const rows = [
  ["001","시간 선택","Select time","時間を選択","Elegir hora","选择时间"],
  ["002","기간 선택","Select duration","時間の長さを選択","Elegir duración","选择时长"],
  ["003","날짜 선택","Select date","日付を選択","Elegir fecha","选择日期"],
  ["004","양 선택","Select amount","量を選択","Elegir cantidad","选择分量"],
  ["005","오전","AM","午前","a. m.","上午"],
  ["006","오후","PM","午後","p. m.","下午"],
  ["007","시","Hr","時","Hora","时"],
  ["008","분","Min","分","Minuto","分"],
  ["009","오전/오후","AM/PM","午前/午後","a. m./p. m.","上午/下午"],
  ["010","시간","Hours","時間","Horas","小时"],
  ["011","년","Year","年","Año","年"],
  ["012","월","Month","月","Mes","月"],
  ["013","일","Day","日","Día","日"],
  ["014","선택 지우기","Clear selection","選択を消去","Borrar selección","清除所选"],
  ["015","선택한 시각을 24시간 형식으로 안전하게 저장해요.","The selected time is stored in 24-hour format.","選んだ時刻は24時間形式で保存します。","La hora elegida se guarda en formato de 24 horas.","所选时间会以24小时制安全保存。"],
  ["016","선택한 기간은 총 분 단위로 저장해요.","The selected duration is stored as total minutes.","選んだ長さは合計の分で保存します。","La duración elegida se guarda en minutos totales.","所选时长会按总分钟数保存。"],
  ["017","년·월·일을 위아래로 스크롤해서 선택해 주세요.","Scroll year, month, and day to choose a date.","年・月・日を上下にスクロールして選んでください。","Desplaza año, mes y día para elegir la fecha.","请上下滚动选择年、月、日。"],
  ["018","선택한 양은 {unit} 단위로 저장해요.","The selected amount is stored in {unit}.","選んだ量は{unit}単位で保存します。","La cantidad elegida se guarda en {unit}.","所选分量会以{unit}为单位保存。"],
  ["019","선택 취소","Cancel selection","選択をキャンセル","Cancelar selección","取消选择"],
  ["020","오전 오후","AM or PM","午前か午後","a. m. o p. m.","上午或下午"],
] as const;

type PickerId = typeof rows[number][0];
export type PickerCriticalKey = `picker.critical.${PickerId}`;

function resource(index: 1 | 2 | 3 | 4 | 5): { [K in PickerCriticalKey]: string } {
  return Object.fromEntries(rows.map((row) => [`picker.critical.${row[0]}`, row[index]])) as { [K in PickerCriticalKey]: string };
}

export const pickerCriticalKo = resource(1);
export const pickerCriticalEn = resource(2);
export const pickerCriticalJa = resource(3);
export const pickerCriticalEs = resource(4);
export const pickerCriticalZhCN = resource(5);
