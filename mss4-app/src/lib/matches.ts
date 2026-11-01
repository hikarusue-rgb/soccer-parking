// 試合の一覧を、旧駐車場抽選アプリと同じく「今週・翌週・その他・過去」に分ける（週は月曜始まり・日本時間）
import { addDays, weekdayOf } from "./datetime";
import type { TeamEvent } from "./types";

export interface MatchGroups {
  thisWeek: { from: string; to: string; items: TeamEvent[] };
  nextWeek: { from: string; to: string; items: TeamEvent[] };
  others: TeamEvent[];
  past: TeamEvent[];
}

export function groupMatches(events: TeamEvent[], today: string): MatchGroups {
  const matches = events.filter((e) => e.kind === "match");
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const sunday = addDays(monday, 6);
  const nextMonday = addDays(monday, 7);
  const nextSunday = addDays(monday, 13);
  const within = (e: TeamEvent, a: string, b: string) => e.date >= a && e.date <= b;
  const future = matches.filter((e) => e.date >= today);
  return {
    thisWeek: { from: monday, to: sunday, items: future.filter((e) => within(e, monday, sunday)) },
    nextWeek: { from: nextMonday, to: nextSunday, items: future.filter((e) => within(e, nextMonday, nextSunday)) },
    others: future.filter((e) => e.date > nextSunday),
    past: matches.filter((e) => e.date < today).reverse(),
  };
}

export const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
