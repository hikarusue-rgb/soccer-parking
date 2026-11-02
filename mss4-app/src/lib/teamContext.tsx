import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GradeCode, Role } from "./grade";
import type { Route } from "./route";
import { isLotteryRecent, isLotteryUnread, isRecent, isUnread as unreadOf, type Seen, type UpdateState } from "./seen";
import { hasDocs } from "./matches";
import { parkingSummary, type ParkingSummary } from "./parking";
import type { TeamData, TeamEvent } from "./types";

export interface TeamContextValue {
  grade: GradeCode;
  role: Role;
  coach: boolean;
  data: TeamData;
  now: number;
  navigate: (route: Route, options?: { replace?: boolean; keepScroll?: boolean }) => void;
  /** この端末で見た予定の版・抽選結果の時刻 */
  seen: Seen;
  /** 見たことにする（予定は {予定ID: 版}、抽選は {L:予定ID: 時刻}） */
  markSeen: (entries: Record<string, number>) => void;
  seenStorable: boolean;
  /** まだ見ていない変更がある予定 */
  isUnread: (e: TeamEvent) => boolean;
  /** まだ見ていない抽選結果がある予定 */
  isLotteryUnread: (e: TeamEvent) => boolean;
  /** 目印の種類（未確認＝オレンジ、最近の変更＝全員共通） */
  updateState: (e: TeamEvent) => UpdateState;
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
  seen: { seen: Seen; mark: (entries: Record<string, number>) => void; storable: boolean };
  children: ReactNode;
}

export function TeamProvider({ grade, role, data, navigate, seen: seenState, children }: ProviderProps) {
  const now = useNow();
  const { seen, mark: markSeen, storable } = seenState;
  const coach = role === "coach";

  const value = useMemo<TeamContextValue>(() => {
    const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return {
      grade, role, coach, data, now, navigate, seen, markSeen, seenStorable: storable,
      isUnread: (e) => unreadOf(e, seen, now),
      isLotteryUnread: (e) => isLotteryUnread(e.id, data.lotteries[e.id], seen, now),
      updateState: (e) =>
        unreadOf(e, seen, now) || isLotteryUnread(e.id, data.lotteries[e.id], seen, now) ? "unread"
          : isRecent(e, now) || isLotteryRecent(data.lotteries[e.id], now) ? "recent" : null,
      parkingOf: (e) => parkingSummary(e, data.entries[e.id], data.lotteries[e.id], now),
      hasDocs,
      eventUrl: (e) => `${base}#event/${e.id}`,
    };
  }, [grade, role, coach, data, now, navigate, seen, markSeen, storable]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
