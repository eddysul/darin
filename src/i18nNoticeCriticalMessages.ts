const rows = [
  ["001","전체","All","すべて","Todo","全部"],
  ["002","요청","Requests","リクエスト","Solicitudes","请求"],
  ["003","가족","Family","家族","Familia","家人"],
  ["004","요약","Summary","まとめ","Resumen","概览"],
  ["005","이벤트","Events","イベント","Eventos","活动"],
  ["006","오늘","Today","今日","Hoy","今天"],
  ["007","이번 주","This week","今週","Esta semana","本周"],
  ["008","이전 알림","Earlier","以前の通知","Anteriores","更早"],
  ["009","알림을 불러오는 중이에요.","Loading notifications…","通知を読み込み中です。","Cargando notificaciones…","正在加载通知。"],
  ["010","알림을 불러오지 못했어요","Couldn't load notifications","通知を読み込めませんでした","No se pudieron cargar las notificaciones","无法加载通知"],
  ["011","네트워크 상태를 확인한 뒤 다시 시도해 주세요.","Check your network and try again.","ネットワークを確認して再試行してください。","Comprueba la red y vuelve a intentarlo.","请检查网络后重试。"],
  ["012","다시 시도","Try again","再試行","Reintentar","重试"],
  ["013","새 알림이 없어요","No new notifications","新しい通知はありません","No hay notificaciones nuevas","没有新通知"],
  ["014","가족 초대, 공유 기록, 요약과 리마인더가 여기에 모여요.","Family invites, shared logs, summaries, and reminders appear here.","家族招待、共有記録、まとめとリマインダーがここに集まります。","Aquí aparecen invitaciones, registros compartidos, resúmenes y recordatorios.","家人邀请、共享记录、概览和提醒会显示在这里。"],
  ["015","알림 설정","Notification settings","通知設定","Ajustes de notificaciones","通知设置"],
  ["016","알림이 없어요","No notifications","通知はありません","No hay notificaciones","没有通知"],
  ["017","수락됨","Accepted","承認済み","Aceptada","已接受"],
  ["018","거절됨","Declined","拒否済み","Rechazada","已拒绝"],
  ["019","만료됨","Expired","期限切れ","Caducada","已过期"],
  ["020","처리 완료","Processed","処理済み","Procesada","已处理"],
  ["021","거절","Decline","拒否","Rechazar","拒绝"],
  ["022","수락","Accept","承認","Aceptar","接受"],
  ["023","요청을 수락했어요","Request accepted","リクエストを承認しました","Solicitud aceptada","已接受请求"],
  ["024","요청을 거절했어요","Request declined","リクエストを拒否しました","Solicitud rechazada","已拒绝请求"],
  ["025","공유 멤버 연결이 완료되었어요.","Sharing member connected.","共有メンバーの接続が完了しました。","El miembro compartido ya está conectado.","共享成员已连接。"],
  ["026","요청을 처리하지 못했어요","Couldn't process the request","リクエストを処理できませんでした","No se pudo procesar la solicitud","无法处理请求"],
  ["027","잠시 후 다시 시도해 주세요.","Please try again shortly.","しばらくしてからもう一度お試しください。","Vuelve a intentarlo en unos momentos.","请稍后重试。"],
  ["028","QA 샘플 알림","QA sample notification","QAサンプル通知","Notificación de prueba QA","QA示例通知"],
  ["029","실제 초대 요청에서 수락과 거절을 확인할 수 있어요.","Use a real invite request to check accept and decline.","実際の招待リクエストで承認と拒否を確認できます。","Usa una invitación real para comprobar aceptar y rechazar.","请使用真实邀请请求确认接受和拒绝。"],
  ["030","새 공유 기록","New shared log","新しい共有記録","Registro compartido nuevo","新的共享记录"],
  ["031","오늘의 요약","Today's summary","今日のまとめ","Resumen de hoy","今日摘要"],
  ["032","예방접종 리마인더","Vaccination reminder","予防接種リマインダー","Recordatorio de vacunación","预防接种提醒"],
  ["033","민지님이 돌봄 멤버로 함께하기를 요청했어요.","Minji asked to join as a care member.","ミンジさんがケアメンバーとして参加をリクエストしました。","Minji pidió unirse como miembro de cuidado.","敏智申请加入照护成员。"],
  ["034","아빠가 수유 기록을 공유했어요.","Dad shared a feeding log.","パパが授乳記録を共有しました。","Papá compartió un registro de toma.","爸爸分享了一次喂奶记录。"],
  ["035","오늘의 수유와 수면 기록을 확인해 보세요.","Check today's feeding and sleep logs.","今日の授乳と睡眠の記録を確認しましょう。","Revisa las tomas y el sueño de hoy.","查看今天的喂奶和睡眠记录。"],
  ["036","내일 오전 10시, 예방접종 일정이 있어요.","There's a vaccination appointment tomorrow at 10 a.m.","明日午前10時に予防接種の予定があります。","Mañana a las 10 hay una cita de vacunación.","明天上午10点有预防接种安排。"],
] as const;

type NoticeId = typeof rows[number][0];
export type NoticeCriticalKey = `notice.critical.${NoticeId}`;

function resource(index: 1 | 2 | 3 | 4 | 5): { [K in NoticeCriticalKey]: string } {
  return Object.fromEntries(rows.map((row) => [`notice.critical.${row[0]}`, row[index]])) as { [K in NoticeCriticalKey]: string };
}

export const noticeCriticalKo = resource(1);
export const noticeCriticalEn = resource(2);
export const noticeCriticalJa = resource(3);
export const noticeCriticalEs = resource(4);
export const noticeCriticalZhCN = resource(5);
