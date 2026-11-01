import type { TeamEvent } from "./types";

/** 一覧に出す時刻の要約（推測で補わない） */
export function timeSummary(e: TeamEvent): string {
  if (e.start && e.end) return `${e.start}–${e.end}`;
  if (e.kickoff) return `キックオフ ${e.kickoff}`;
  if (e.meeting) return `集合 ${e.meeting}`;
  if (e.start) return `${e.start}〜`;
  if (e.end) return `〜${e.end}`;
  return "時間未定";
}

export function isInactive(e: TeamEvent): boolean {
  return e.status === "canceled" || e.status === "postponed";
}
