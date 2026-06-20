import { useState } from "react";
import type { CaregiverMatch } from "../demo/caregivers";
import { CaregiverChatScreen } from "./CaregiverChatScreen";
import { CaregiverDetailScreen } from "./CaregiverDetailScreen";
import { MatchScreen } from "./tabs/MatchScreen";

type FindView =
  | { screen: "list" }
  | { screen: "detail"; caregiver: CaregiverMatch }
  | { screen: "chat"; caregiver: CaregiverMatch };

export function FindNavigator() {
  const [view, setView] = useState<FindView>({ screen: "list" });

  if (view.screen === "chat") {
    return (
      <CaregiverChatScreen
        caregiver={view.caregiver}
        onBack={() => setView({ screen: "detail", caregiver: view.caregiver })}
      />
    );
  }

  if (view.screen === "detail") {
    return (
      <CaregiverDetailScreen
        caregiver={view.caregiver}
        onBack={() => setView({ screen: "list" })}
        onContact={() => setView({ screen: "chat", caregiver: view.caregiver })}
        onInterviewScheduled={() => setView({ screen: "list" })}
      />
    );
  }

  return (
    <MatchScreen onViewProfile={(caregiver) => setView({ screen: "detail", caregiver })} />
  );
}
