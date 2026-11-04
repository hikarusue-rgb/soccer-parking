// LINE に貼り付ける文面（旧駐車場アプリの形式を引き継ぐ）
import { dateTimeLabel, dayLabel } from "./datetime";
import type { Entry, Lottery, Member, TeamEvent } from "./types";

const LINE = "━━━━━━━━━━━━";
const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const label = (m: Member) => `#${m.num} ${m.name}`;

interface Groups {
  confirmed: Member[];
  winners: Member[];
  losers: Member[];
  walkers: Member[];
  absent: Member[];
  noReply: Member[];
}

export function groupMembers(e: TeamEvent, members: Member[], entries: Record<string, Entry> | undefined, lottery: Lottery | undefined): Groups {
  const active = members.filter((m) => m.active || entries?.[m.id]);
  const byId = new Map(members.map((m) => [m.id, m]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((m): m is Member => Boolean(m));
  const confirmed = new Set(e.parking.confirmed);
  const winnerIds = new Set(lottery?.winners ?? []);
  const wants = (id: string) => Boolean(entries?.[id]?.attending && entries[id].parkingNeeded);
  return {
    confirmed: pick(e.parking.confirmed),
    winners: pick((lottery?.winners ?? []).filter(wants)),
    losers: lottery ? active.filter((m) => wants(m.id) && !winnerIds.has(m.id) && !confirmed.has(m.id)) : [],
    walkers: active.filter((m) => entries?.[m.id]?.attending && !entries[m.id].parkingNeeded && !confirmed.has(m.id)),
    absent: active.filter((m) => entries?.[m.id] && !entries[m.id].attending),
    noReply: active.filter((m) => m.active && !entries?.[m.id] && !confirmed.has(m.id)),
  };
}

export function resultText(e: TeamEvent, members: Member[], entries: Record<string, Entry> | undefined, lottery: Lottery | undefined, url: string): string {
  const g = groupMembers(e, members, entries, lottery);
  const withCarpool = (m: Member) => {
    const cap = entries?.[m.id]?.carpoolCapacity ?? 0;
    return `${label(m)}${cap > 0 ? `(乗合+${cap})` : ""}`;
  };
  const lines = ["🏆 駐車場抽選結果", `📌 ${e.title}`, `🗓 ${dayLabel(e.date)}`];
  if (e.venue) lines.push(`📍 ${e.venue}`, `🗺 ${mapUrl(e.venue)}`);
  lines.push(LINE);
  const reserved = Math.max(e.parking.reserved ?? 0, e.parking.confirmed.length);
  if (reserved > g.confirmed.length) lines.push(`🔒 抽選外枠 ${reserved}台（審判など）`);
  if (g.confirmed.length || g.winners.length) {
    lines.push("🚗 【車を出す方】");
    if (g.confirmed.length) lines.push(` 🔒抽選外: ${g.confirmed.map(withCarpool).join(", ")}`);
    if (g.winners.length) lines.push(` 🎯当選: ${g.winners.map(withCarpool).join(", ")}`);
    lines.push(LINE);
  }
  if (g.losers.length) lines.push("💧 【落選（乗り合わせ等）】", ` ❌ ${g.losers.map(label).join(", ")}`, LINE);
  if (g.walkers.length) lines.push("🚶 【車なし】", ` ${g.walkers.map(label).join(", ")}`, LINE);
  if (g.absent.length || g.noReply.length) {
    lines.push("🏠 【欠席 / 未回答】");
    if (g.absent.length) lines.push(` 欠席: ${g.absent.map(label).join(", ")}`);
    if (g.noReply.length) lines.push(` 未回答: ${g.noReply.map(label).join(", ")}`);
    lines.push(LINE);
  }
  lines.push("👇 詳細・要項はこちら", url);
  return lines.join("\n");
}

const timeLine = (e: TeamEvent) => [e.meeting && `集合 ${e.meeting}`, e.kickoff && `KO ${e.kickoff}`, e.start && e.end ? `${e.start}〜${e.end}` : e.start].filter(Boolean).join(" ／ ");
const slotsLine = (e: TeamEvent) => {
  const reserved = Math.max(e.parking.reserved ?? 0, e.parking.confirmed.length);
  const lottery = Math.max(0, e.parking.limit - reserved);
  return `🚗 駐車場 ${e.parking.limit}台（抽選枠 ${lottery}台${reserved ? `・抽選外枠 ${reserved}台（審判など）` : ""}）`;
};

/** ① 受付開始の案内（当番の方が保護者グループに送る） */
export function announceText(e: TeamEvent, url: string): string {
  const lines = ["📣 駐車場の申し込み受付", LINE, `📌 ${e.title}`, `🗓 ${dayLabel(e.date)}`];
  if (timeLine(e)) lines.push(`⏰ ${timeLine(e)}`);
  if (e.venue) lines.push(`📍 ${e.venue}`);
  lines.push(slotsLine(e));
  lines.push(`⏳ 回答締切：${e.parking.deadlineAt ? dateTimeLabel(e.parking.deadlineAt) : "なし（抽選するまで）"}`);
  lines.push(LINE, "✏️ お子さんの名前を選んで、参加・駐車場の希望を回答してください（駐車場が不要な方も回答をお願いします）", "👇 回答はこちら", url);
  return lines.join("\n");
}

/** ② 回答のお願い（催促） */
export function reminderText(e: TeamEvent, members: Member[], entries: Record<string, Entry> | undefined, url: string): string {
  const g = groupMembers(e, members, entries, undefined);
  const active = members.filter((m) => m.active);
  const answered = active.filter((m) => entries?.[m.id]).length;
  const wants = Object.values(entries ?? {}).filter((r) => r.attending && r.parkingNeeded).length;
  return [
    "📢 回答のお願い",
    LINE,
    `📌 ${e.title}`,
    `🗓 ${dayLabel(e.date)}`,
    `⏳ 締切：${e.parking.deadlineAt ? dateTimeLabel(e.parking.deadlineAt) : "なし（抽選するまで）"}`,
    `📊 回答 ${answered}/${active.length}名・駐車場希望 ${wants}名`,
    slotsLine(e),
    LINE,
    "📭 【未回答の方】",
    ` ${g.noReply.map(label).join(", ") || "（全員回答済み）"}`,
    LINE,
    "👇 参加・駐車場の回答はこちら",
    url,
  ].join("\n");
}

/** LINE アプリで送る画面を開く（スマホ：LINE、PC：LINEのWeb共有） */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** 共有シートがあれば使い、なければクリップボードへ */
export async function shareText(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
