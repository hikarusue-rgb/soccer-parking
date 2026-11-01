import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GradeCode, Role } from "./grade";
import type { Route } from "./route";
import { isUnread as unreadOf, useSeen } from "./seen";
import { parkingSummary, type ParkingSummary } from "./parking";
import type { TeamData, TeamEvent } from "./types";

export interface TeamContextValue {
  grade: GradeCode;
  role: Role;
  coach: boolean;
  data: TeamData;
  now: number;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
  seen: Record<string, number>;
  markSeen: (eventId: string, version: number) => void;
  seenStorable: boolean;
  isUnread: (e: TeamEvent) => boolean;
  parkingOf: (e: TeamEvent) => ParkingSummary | null;
  hasDocs: (e: TeamEvent) => boolean;
  /** LINE などで共有する予定の固定URL */
  eventUrl: (e: TeamEvent) => string;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function useTeam(): TeamContextValue {
  const value = useContext(TeamContext);
  if (!value) throw new Error("TeamProvider の外で useTeam が呼ばれました");
  return value;
}

/** 締切のカウントダウンなどのため、1分ごとに現在時刻を更新する */
function useNow(interval = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    const wake = () => setNow(Date.now());
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [interval]);
  return now;
}

interface ProviderProps {
  grade: GradeCode;
  role: Role;
  data: TeamData;
  navigate: TeamContextValue["navigate"];
  children: ReactNode;
}

export function TeamProvider({ grade, role, data, navigate, children }: ProviderProps) {
  const now = useNow();
  const { seen, markSeen, storable } = useSeen(grade, role);
  const coach = role === "coach";

  const value = useMemo<TeamContextValue>(() => {
    const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return {
      grade, role, coach, data, now, navigate, seen, markSeen, seenStorable: storable,
      isUnread: (e) => !coach && unreadOf(e, seen, now),
      parkingOf: (e) => parkingSummary(e, data.entries[e.id], data.lotteries[e.id], now),
      hasDocs: (e) => e.attachments.length > 0,
      eventUrl: (e) => `${base}#event/${e.id}`,
    };
  }, [grade, role, coach, data, now, navigate, seen, markSeen, storable]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
