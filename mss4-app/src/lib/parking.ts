// 駐車場抽選の状態（カード・月カレンダーのバッジ、詳細の見出しで共通に使う）
import type { Entry, Lottery, TeamEvent } from "./types";

export type ParkingPhase = "open" | "closed" | "drawn";

export interface ParkingSummary {
  phase: ParkingPhase;
  limit: number;
  /** 確定枠＋車出し希望（確定枠以外） */
  demand: number;
  applicants: string[];
  /** バッジの文言（例: 🚗 受付中 2/3台） */
  label: string;
  /** 月カレンダーのマス用の短い文言 */
  short: string;
}

export function applicantsOf(e: TeamEvent, entries: Record<string, Entry> | undefined): string[] {
  const confirmed = new Set(e.parking.confirmed);
  return Object.entries(entries ?? {})
    .filter(([memberId, r]) => r.attending && r.parkingNeeded && !confirmed.has(memberId))
    .map(([memberId]) => memberId);
}

export function parkingSummary(
  e: TeamEvent,
  entries: Record<string, Entry> | undefined,
  lottery: Lottery | undefined,
  now: number = Date.now(),
): ParkingSummary | null {
  if (e.parking.mode !== "lottery") return null;
  const applicants = applicantsOf(e, entries);
  const limit = e.parking.limit;
  const demand = e.parking.confirmed.length + applicants.length;
  if (lottery) return { phase: "drawn", limit, demand, applicants, label: "🚗 配車確定", short: "🚗確定" };
  if (e.parking.deadlineAt !== null && now >= e.parking.deadlineAt) {
    return { phase: "closed", limit, demand, applicants, label: `🚗 締切 ${demand}/${limit}台・抽選待ち`, short: "🚗締切" };
  }
  return { phase: "open", limit, demand, applicants, label: `🚗 受付中 ${demand}/${limit}台`, short: `🚗${demand}/${limit}` };
}
