const rows = [
  ["001","DEV 전용 · 운영 빌드에는 표시되지 않음","DEV only · Hidden in production builds","開発専用・本番ビルドには出ません","Solo DEV · Oculto en producción","仅开发用 · 正式版不显示"],
  ["002","QA 작업에 실패했어요.","QA action failed.","QA作業に失敗しました。","Falló la acción de QA.","QA操作失败。"],
  ["003","QA Debug 열기","Open QA Debug","QAデバッグを開く","Abrir depuración QA","打开QA调试"],
  ["004","QA Debug 메뉴","QA Debug menu","QAデバッグメニュー","Menú de depuración QA","QA调试菜单"],
  ["005","장애 주입·데모 데이터·백업 복원","Fault injection, demo data, and backup restore","障害注入・デモデータ・バックアップ復元","Inyección de fallos, datos demo y restauración","故障注入、演示数据与备份恢复"],
  ["006","QA Debug 닫기","Close QA Debug","QAデバッグを閉じる","Cerrar depuración QA","关闭QA调试"],
  ["007","장애 주입 · 다음 1회","Fault injection · next once","障害注入・次の1回","Inyección de fallos · la próxima vez","故障注入 · 下一次"],
  ["008","다음 AI 요청 1회 실패시키기","Fail the next AI request once","次のAIリクエストを1回失敗させる","Hacer fallar la próxima petición de IA","让下一次AI请求失败一次"],
  ["009"," · 준비됨"," · armed"," · 準備済み"," · listo"," · 已就绪"],
  ["010","다음 AI 요청이 1회 실패합니다.","The next AI request will fail once.","次のAIリクエストは1回失敗します。","La próxima petición de IA fallará una vez.","下一次AI请求将失败一次。"],
  ["011","다음 저장 1회 실패시키기","Fail the next save once","次の保存を1回失敗させる","Hacer fallar el próximo guardado","让下一次保存失败一次"],
  ["012","다음 저장이 1회 실패합니다.","The next save will fail once.","次の保存は1回失敗します。","El próximo guardado fallará una vez.","下一次保存将失败一次。"],
  ["013","다음 불러오기 1회 실패시키기","Fail the next load once","次の読み込みを1回失敗させる","Hacer fallar la próxima carga","让下一次加载失败一次"],
  ["014","다음 앱 재시작/hydrate에서 불러오기가 1회 실패합니다.","The next app restart/hydrate load will fail once.","次の再起動/hydrateの読み込みは1回失敗します。","La próxima carga al reiniciar/hydrate fallará una vez.","下次应用重启/hydrate加载将失败一次。"],
  ["015","데이터 상태","Data state","データの状態","Estado de los datos","数据状态"],
  ["016","현재 로컬 데이터 백업","Back up current local data","現在のローカルデータをバックアップ","Copia de seguridad de datos locales","备份当前本地数据"],
  ["017","현재 로컬 데이터를 QA backup key에 저장했습니다.","Saved current local data to the QA backup key.","現在のローカルデータをQAバックアップキーに保存しました。","Se guardaron los datos locales en la clave de copia QA.","已将当前本地数据保存到QA备份键。"],
  ["018","데모 데이터 채우기 (한눈에)","Fill demo data (Overview)","デモデータを入れる（一覧）","Rellenar datos demo (Resumen)","填入演示数据（概览）"],
  ["019","한눈에 탭 데모 데이터를 채웠습니다.","Filled Overview tab demo data.","一覧タブのデモデータを入れました。","Se rellenaron los datos demo de Resumen.","已填入概览页演示数据。"],
  ["020","QA용 빈 데이터로 전환","Switch to empty QA data","QA用の空データに切り替え","Cambiar a datos QA vacíos","切换为空的QA数据"],
  ["021","QA용 빈 데이터로 전환했습니다.","Switched to empty QA data.","QA用の空データに切り替えました。","Se cambió a datos QA vacíos.","已切换为空的QA数据。"],
  ["022","샘플 데이터 복원","Restore sample data","サンプルデータを復元","Restaurar datos de ejemplo","恢复示例数据"],
  ["023","샘플 데이터를 복원했습니다.","Restored sample data.","サンプルデータを復元しました。","Se restauraron los datos de ejemplo.","已恢复示例数据。"],
  ["024","백업 데이터 복원","Restore backup data","バックアップを復元","Restaurar la copia de seguridad","恢复备份数据"],
  ["025","백업 데이터를 복원했습니다.","Restored backup data.","バックアップを復元しました。","Se restauró la copia de seguridad.","已恢复备份数据。"],
  ["026","QA 상담 테스트 기록 정리","Clear QA consult test turns","QA相談テスト記録を整理","Limpiar turnos de prueba de consulta QA","清理QA咨询测试记录"],
  ["027","QA로 시작하는 상담 테스트 턴을 정리했습니다.","Cleared consult test turns that start with QA.","QAで始まる相談テストターンを整理しました。","Se limpiaron los turnos de prueba que empiezan por QA.","已清理以QA开头的咨询测试回合。"],
] as const;

type QaId = typeof rows[number][0];
export type QaCriticalKey = `qa.critical.${QaId}`;

function resource(index: 1 | 2 | 3 | 4 | 5): { [K in QaCriticalKey]: string } {
  return Object.fromEntries(rows.map((row) => [`qa.critical.${row[0]}`, row[index]])) as { [K in QaCriticalKey]: string };
}

export const qaCriticalKo = resource(1);
export const qaCriticalEn = resource(2);
export const qaCriticalJa = resource(3);
export const qaCriticalEs = resource(4);
export const qaCriticalZhCN = resource(5);
