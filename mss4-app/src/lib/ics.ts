// カレンダーアプリ（iPhone・Googleなど）に取り込む .ics と、Googleカレンダー追加リンク
import { addDays } from "./datetime";
import { STATUS_LABELS, type TeamEvent } from "./types";

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const jst = (date: string, time: string) => Date.parse(`${date}T${time}:00+09:00`);

function fold(line: string): string {
  const out: string[] = [];
  let part = "";
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 75) {
      out.push(part);
      part = " ";
      bytes = 1;
    }
    part += ch;
    bytes += n;
  }
  out.push(part);
  return out.join("\r\n");
}

function description(e: TeamEvent, url: string): string {
  return [
    `集合：${e.meeting ?? "未確認"}`,
    `キックオフ：${e.kickoff ?? "未確認"}`,
    e.opponent && `対戦相手：${e.opponent}`,
    `開催状況：${STATUS_LABELS[e.status]}`,
    e.equipmentConfirmed && `持ち物：${e.equipment.join("・") || "指定なし"}`,
    ...e.messages,
    e.note,
    `最新の情報：${url}`,
    "取り込んだ予定は自動では更新されません。",
  ].filter(Boolean).join("\n");
}

/** 予定の開始・終了（集合 → キックオフ → 開始 の早い方から） */
function span(e: TeamEvent): { start: number; end: number | null } | null {
  const begin = e.meeting ?? e.kickoff ?? e.start;
  if (!begin) return null;
  const start = jst(e.date, begin);
  const end = e.end ? jst(e.date, e.end) : null;
  return { start, end: end && end > start ? end : null };
}

export function createIcs(events: TeamEvent[], calendarName: string, urlOf: (e: TeamEvent) => string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MSS Kasumi//Team App//JA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calendarName)}`];
  for (const e of events) {
    const label = e.status === "canceled" ? "【中止】" : e.status === "postponed" ? "【延期】" : "";
    const stamp = utc(e.updatedAt || Date.now());
    const s = span(e);
    lines.push("BEGIN:VEVENT", `UID:${esc(e.id)}@mss-kasumi-app`, `DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`, `SEQUENCE:${Math.max(0, e.version)}`, `SUMMARY:${esc(label + e.title + (s ? "" : "（時間未定）"))}`);
    if (s) {
      lines.push(`DTSTART:${utc(s.start)}`);
      if (s.end) lines.push(`DTEND:${utc(s.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${e.date.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replaceAll("-", "")}`);
    }
    lines.push(
      `LOCATION:${esc(e.venue || "場所未定")}`,
      `DESCRIPTION:${esc(description(e, urlOf(e)))}`,
      `STATUS:${e.status === "canceled" ? "CANCELLED" : e.status === "unconfirmed" || e.status === "postponed" ? "TENTATIVE" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function googleCalendarUrl(e: TeamEvent, url: string): string {
  const s = span(e);
  const dates = s
    ? `${utc(s.start)}/${utc(s.end ?? s.start + 2 * 3_600_000)}`
    : `${e.date.replaceAll("-", "")}/${addDays(e.date, 1).replaceAll("-", "")}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, location: e.venue, details: description(e, url) });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
