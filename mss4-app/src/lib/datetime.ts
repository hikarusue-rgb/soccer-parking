// 日付・時刻はすべて日本時間（JST）で扱う。端末のタイムゾーンに左右されない。
const TZ = "Asia/Tokyo";
const DAY = 86_400_000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hm = new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** 例: 2026-11-08 */
export function jstDate(ms: number): string {
  return ymd.format(new Date(ms));
}

export function jstToday(now: number = Date.now()): string {
  return jstDate(now);
}

/** 例: 20:00 */
export function jstTime(ms: number): string {
  return hm.format(new Date(ms));
}

/** 2026-11-08 → JST 0時のミリ秒 */
export function dateToMs(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`);
}

export function weekdayOf(date: string): number {
  return new Date(dateToMs(date) + 9 * 3_600_000).getUTCDay();
}

/** 例: 11/8(土) */
export function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}(${WEEK[weekdayOf(date)]})`;
}

export function addDays(date: string, days: number): string {
  return jstDate(dateToMs(date) + days * DAY + 12 * 3_600_000);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateToMs(to) - dateToMs(from)) / DAY);
}

/** 今日・明日・あさって・n日後・n日前 */
export function relativeDay(date: string, today: string = jstToday()): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  if (diff === 2) return "あさって";
  return diff > 0 ? `${diff}日後` : `${-diff}日前`;
}

/** <input type="datetime-local"> の値（JSTとみなす）→ ミリ秒 */
export function localInputToMs(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00+09:00`);
  return Number.isNaN(ms) ? null : ms;
}

/** ミリ秒 → <input type="datetime-local"> の値（JST） */
export function msToLocalInput(ms: number): string {
  return `${jstDate(ms)}T${jstTime(ms)}`;
}

/** 例: 11/6(木) 20:00 */
export function dateTimeLabel(ms: number): string {
  return `${dayLabel(jstDate(ms))} ${jstTime(ms)}`;
}

/** 締切までの残り時間。過ぎていれば null */
export function timeLeft(deadline: number, now: number = Date.now()): string | null {
  const diff = deadline - now;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 48) return `あと${Math.floor(hours / 24)}日`;
  if (hours >= 1) return `あと${hours}時間${minutes ? `${minutes}分` : ""}`;
  return `あと${Math.max(1, minutes)}分`;
}

/** 月のカレンダー表示用：先頭の空白数と日数 */
export function monthShape(month: string): { offset: number; days: number } {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { offset: weekdayOf(first), days };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
