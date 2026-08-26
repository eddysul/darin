import { cleanupQaAccounts, createQaAccounts } from "./lib/qa-auth.mjs";

const [owner] = await createQaAccounts(["notification-locale-owner"]);
let babyId = null;
const expected = {
  ko: ["Darin 알림 테스트", "알림이 정상적으로 연결됐어요."],
  en: ["Darin notification test", "Notifications are connected correctly."],
  ja: ["Darin通知テスト", "通知は正常に接続されています。"],
  es: ["Prueba de notificaciones de Darin", "Las notificaciones están conectadas correctamente."],
  "zh-CN": ["Darin通知测试", "通知已正常连接。"],
};

try {
  const { data: baby, error: babyError } = await owner.sb.rpc("create_baby_with_owner", {
    p_name: `Notification locale QA ${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw babyError ?? new Error("baby creation failed");
  babyId = baby.id;

  for (const [locale, [title, body]] of Object.entries(expected)) {
    const { error: profileError } = await owner.sb.from("profiles")
      .update({ preferred_language: locale }).eq("id", owner.user.id);
    if (profileError) throw profileError;
    const marker = `notification-locale-${locale}-${crypto.randomUUID()}`;
    const { error: invokeError } = await owner.sb.functions.invoke("send-push-notification", {
      body: {
        action: "sendToUser", eventType: "test", babyId,
        recipientId: owner.user.id, targetId: marker,
        routeData: { route: "settings", localeQaMarker: marker },
      },
    });
    if (invokeError) throw invokeError;
    const { data: event, error: eventError } = await owner.sb.from("notification_events")
      .select("title,body,data").eq("recipient_id", owner.user.id)
      .contains("data", { localeQaMarker: marker }).single();
    if (eventError || event?.title !== title || event?.body !== body) {
      throw eventError ?? new Error(`${locale} notification copy mismatch: ${event?.title} / ${event?.body}`);
    }
    console.log(`PASS recipient preferred_language ${locale} localizes push/event copy`);
  }
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts([owner]);
}
