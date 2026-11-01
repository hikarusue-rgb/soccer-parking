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
  if (g.confirmed.length || g.winners.length) {
    lines.push("🚗 【車を出す方】");
    if (g.confirmed.length) lines.push(` 🔒確定: ${g.confirmed.map(withCarpool).join(", ")}`);
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

export function reminderText(e: TeamEvent, members: Member[], entries: Record<string, Entry> | undefined, url: string): string {
  const g = groupMembers(e, members, entries, undefined);
  return [
    "📢 回答のお願い",
    LINE,
    `📌 ${e.title}`,
    `🗓 ${dayLabel(e.date)}`,
    `⏰ 締切: ${e.parking.deadlineAt ? dateTimeLabel(e.parking.deadlineAt) : "未設定"}`,
    LINE,
    "📭 【未回答の方】",
    ` ${g.noReply.map(label).join(", ") || "（全員回答済み）"}`,
    LINE,
    "👇 参加・車出しの回答はこちら",
    url,
  ].join("\n");
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
