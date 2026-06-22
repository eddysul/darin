import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MOCK_SCHEDULE_EVENTS } from "../demo/schedules";
import type {
  CareScheduleEvent,
  CounterScheduleInput,
  ProposeScheduleInput,
  ScheduleParticipantRole,
} from "../types/schedule";
import { compareTime, formatDateISO, getWeekDays } from "../utils/scheduleCalendar";
import { CALENDAR_ANCHOR } from "../utils/trialCalendar";
import { createId } from "../utils/id";

type ScheduleContextValue = {
  events: CareScheduleEvent[];
  proposeSchedule: (input: ProposeScheduleInput) => CareScheduleEvent;
  acceptSchedule: (eventId: string, role: ScheduleParticipantRole) => CareScheduleEvent | null;
  declineSchedule: (eventId: string, role: ScheduleParticipantRole) => CareScheduleEvent | null;
  counterSchedule: (
    eventId: string,
    counterInput: CounterScheduleInput,
    role: ScheduleParticipantRole,
  ) => CareScheduleEvent | null;
  cancelSchedule: (eventId: string) => void;
  upsertSchedule: (event: CareScheduleEvent) => void;
  getEventById: (eventId: string) => CareScheduleEvent | undefined;
  getEventsForDate: (date: string) => CareScheduleEvent[];
  getEventsForWeek: (startDate: Date) => CareScheduleEvent[];
  getPendingEventsForRole: (role: ScheduleParticipantRole) => CareScheduleEvent[];
  getUpcomingEvents: (limit?: number) => CareScheduleEvent[];
};

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

function sortEvents(list: CareScheduleEvent[]): CareScheduleEvent[] {
  return [...list].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return compareTime(a.startTime, b.startTime);
  });
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CareScheduleEvent[]>(() => sortEvents(MOCK_SCHEDULE_EVENTS));

  const getEventById = useCallback(
    (eventId: string) => events.find((e) => e.id === eventId),
    [events],
  );

  const proposeSchedule = useCallback((input: ProposeScheduleInput): CareScheduleEvent => {
    const now = new Date().toISOString();
    const event: CareScheduleEvent = {
      id: createId(),
      title: input.title,
      childName: input.childName,
      caregiverName: input.caregiverName,
      type: input.type,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      displayTime: input.displayTime,
      locationLabel: input.locationLabel,
      note: input.note,
      proposedBy: input.proposedBy,
      assignedTo: input.proposedBy === "parent" ? "caregiver" : "parent",
      status: "proposed",
      parentAccepted: input.proposedBy === "parent",
      caregiverAccepted: input.proposedBy === "caregiver",
      source: input.source ?? "scheduler",
      linkedThreadId: input.linkedThreadId,
      linkedCaregiverId: input.linkedCaregiverId,
      createdAt: now,
      updatedAt: now,
    };
    setEvents((prev) => sortEvents([...prev, event]));
    return event;
  }, []);

  const upsertSchedule = useCallback((event: CareScheduleEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = event;
        return sortEvents(next);
      }
      return sortEvents([...prev, event]);
    });
  }, []);

  const acceptSchedule = useCallback(
    (eventId: string, role: ScheduleParticipantRole): CareScheduleEvent | null => {
      let updated: CareScheduleEvent | null = null;
      setEvents((prev) =>
        sortEvents(
          prev.map((event) => {
            if (event.id !== eventId || event.status === "cancelled" || event.status === "declined") {
              return event;
            }
            const needsAction =
              (role === "parent" && event.proposedBy === "caregiver") ||
              (role === "caregiver" && event.proposedBy === "parent");
            if (!needsAction && event.status !== "countered") return event;

            const next: CareScheduleEvent = {
              ...event,
              parentAccepted: role === "parent" ? true : event.parentAccepted,
              caregiverAccepted: role === "caregiver" ? true : event.caregiverAccepted,
              updatedAt: new Date().toISOString(),
            };

            if (next.parentAccepted && next.caregiverAccepted) {
              next.status = "accepted";
            }
            updated = next;
            return next;
          }),
        ),
      );
      return updated;
    },
    [],
  );

  const declineSchedule = useCallback(
    (eventId: string, role: ScheduleParticipantRole): CareScheduleEvent | null => {
      let updated: CareScheduleEvent | null = null;
      setEvents((prev) =>
        sortEvents(
          prev.map((event) => {
            if (event.id !== eventId) return event;
            const canDecline =
              (role === "parent" && event.proposedBy === "caregiver") ||
              (role === "caregiver" && event.proposedBy === "parent");
            if (!canDecline) return event;
            updated = {
              ...event,
              status: "declined",
              updatedAt: new Date().toISOString(),
            };
            return updated;
          }),
        ),
      );
      return updated;
    },
    [],
  );

  const counterSchedule = useCallback(
    (
      eventId: string,
      counterInput: CounterScheduleInput,
      role: ScheduleParticipantRole,
    ): CareScheduleEvent | null => {
      const original = events.find((e) => e.id === eventId);
      if (!original) return null;

      const now = new Date().toISOString();
      setEvents((prev) =>
        sortEvents(
          prev.map((event) =>
            event.id === eventId
              ? { ...event, status: "countered" as const, updatedAt: now }
              : event,
          ),
        ),
      );

      const counterEvent: CareScheduleEvent = {
        ...original,
        id: createId(),
        date: counterInput.date,
        startTime: counterInput.startTime,
        endTime: counterInput.endTime,
        displayTime: counterInput.displayTime,
        note: counterInput.note ?? original.note,
        proposedBy: role,
        assignedTo: role === "parent" ? "caregiver" : "parent",
        status: "proposed",
        parentAccepted: role === "parent",
        caregiverAccepted: role === "caregiver",
        counterOfId: eventId,
        source: original.source,
        createdAt: now,
        updatedAt: now,
      };

      setEvents((prev) => sortEvents([...prev, counterEvent]));
      return counterEvent;
    },
    [events],
  );

  const cancelSchedule = useCallback((eventId: string) => {
    setEvents((prev) =>
      sortEvents(
        prev.map((event) =>
          event.id === eventId
            ? { ...event, status: "cancelled" as const, updatedAt: new Date().toISOString() }
            : event,
        ),
      ),
    );
  }, []);

  const getEventsForDate = useCallback(
    (date: string) => sortEvents(events.filter((e) => e.date === date && e.status !== "cancelled")),
    [events],
  );

  const getEventsForWeek = useCallback(
    (startDate: Date) => {
      const weekDays = getWeekDays(startDate).map(formatDateISO);
      return sortEvents(
        events.filter((e) => weekDays.includes(e.date) && e.status !== "cancelled"),
      );
    },
    [events],
  );

  const getPendingEventsForRole = useCallback(
    (role: ScheduleParticipantRole) =>
      sortEvents(
        events.filter((event) => {
          if (event.status !== "proposed") return false;
          return role === "parent"
            ? event.proposedBy === "caregiver"
            : event.proposedBy === "parent";
        }),
      ),
    [events],
  );

  const getUpcomingEvents = useCallback(
    (limit = 3) => {
      const today = formatDateISO(CALENDAR_ANCHOR);
      return sortEvents(
        events.filter((e) => e.status !== "cancelled" && e.status !== "declined" && e.date >= today),
      ).slice(0, limit);
    },
    [events],
  );

  const value = useMemo(
    () => ({
      events,
      proposeSchedule,
      acceptSchedule,
      declineSchedule,
      counterSchedule,
      cancelSchedule,
      upsertSchedule,
      getEventById,
      getEventsForDate,
      getEventsForWeek,
      getPendingEventsForRole,
      getUpcomingEvents,
    }),
    [
      events,
      proposeSchedule,
      acceptSchedule,
      declineSchedule,
      counterSchedule,
      cancelSchedule,
      upsertSchedule,
      getEventById,
      getEventsForDate,
      getEventsForWeek,
      getPendingEventsForRole,
      getUpcomingEvents,
    ],
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
