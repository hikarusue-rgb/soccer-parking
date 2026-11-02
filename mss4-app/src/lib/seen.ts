// 「新しい更新」：この端末で見た予定の版と抽選結果を localStorage に記録し、まだ見ていない変更を目立たせる。
// 端末・ブラウザごとの記録で、ほかの人に既読を知らせる機能ではない。保存できない環境ではこの画面の間だけ有効。
// 初めて開いた端末では、その時点の内容をすべて「見た」ことにする（過去の変更が一度に並ばないように）。
import { useCallback, useEffect, useState } from "react";
import type { GradeCode } from "./grade";
import type { Lottery, TeamData, TeamEvent } from "./types";

/** この日数より前の変更は「新しい更新」に出さない */
const RECENT = 14 * 86_400_000;
const keyOf = (grade: GradeCode) => `mss4-seen-v2-${grade}`;
/** この端末で保存したときに出す合図（自分の変更は「新しい更新」にしない） */
export const SAVED_EVENT = "mss4-saved";
export const lotteryKey = (eventId: string) => `L:${eventId}`;

export type Seen = Record<string, number>;

function read(key: string): Seen | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function write(key: string, value: Seen): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** いまの内容をすべて見たことにする記録 */
export function baseline(data: Pick<TeamData, "events" | "lotteries">): Seen {
  const seen: Seen = {};
  for (const e of data.events) seen[e.id] = e.version;
  for (const [id, l] of Object.entries(data.lotteries)) if (l) seen[lotteryKey(id)] = l.updatedAt;
  return seen;
}

/** 全員に共通で「最近の変更」として見せる日数 */
export const SHARED_DAYS = 3;
const SHARED = SHARED_DAYS * 86_400_000;

/** 全員共通：直近3日以内に追加・変更された予定（移行しただけの予定は除く） */
export function isRecent(e: TeamEvent, now: number = Date.now()): boolean {
  return e.updatedAt >= now - SHARED && !(e.updatedBy === "移行" && e.version <= 1);
}

/** 全員共通：直近3日以内に出た抽選結果 */
export function isLotteryRecent(lottery: Lottery | undefined, now: number = Date.now()): boolean {
  return Boolean(lottery) && lottery!.updatedAt >= now - SHARED;
}

/** 更新の目印：unread＝この端末でまだ見ていない（オレンジ）、recent＝全員共通の最近の変更（見た後も3日間） */
export type UpdateState = "unread" | "recent" | null;

export function isUnread(e: TeamEvent, seen: Seen, now: number = Date.now()): boolean {
  return e.updatedAt >= now - RECENT && (seen[e.id] ?? 0) < e.version;
}

export function isLotteryUnread(eventId: string, lottery: Lottery | undefined, seen: Seen, now: number = Date.now()): boolean {
  return Boolean(lottery) && lottery!.updatedAt >= now - RECENT && (seen[lotteryKey(eventId)] ?? 0) < lottery!.updatedAt;
}

/** この端末で保存したことを知らせる（予定は新しい版、抽選は保存した時刻） */
export function announceSaved(key: string, value: number) {
  window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { key, value } }));
}

export function useSeen(grade: GradeCode, data: Pick<TeamData, "events" | "lotteries"> | null) {
  const key = keyOf(grade);
  const [seen, setSeen] = useState<Seen | null>(() => read(key));
  const [storable, setStorable] = useState(true);

  // 初めての端末：データが届いたら、その時点の内容を見たことにする
  useEffect(() => {
    if (seen !== null || !data) return;
    const first = baseline(data);
    setStorable(write(key, first));
    setSeen(first);
  }, [seen, data, key]);

  const mark = useCallback((entries: Record<string, number>) => {
    setSeen((prev) => {
      const next = { ...(prev ?? {}) };
      for (const [k, v] of Object.entries(entries)) next[k] = Math.max(next[k] ?? 0, v);
      setStorable(write(key, next));
      return next;
    });
  }, [key]);

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === key) setSeen(read(key));
    };
    const saved = (e: Event) => {
      const { key: k, value } = (e as CustomEvent<{ key: string; value: number }>).detail;
      mark({ [k]: value });
    };
    window.addEventListener("storage", sync);
    window.addEventListener(SAVED_EVENT, saved);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SAVED_EVENT, saved);
    };
  }, [key, mark]);

  return { seen: seen ?? {}, ready: seen !== null, mark, storable };
}
