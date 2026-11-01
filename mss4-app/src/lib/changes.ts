// 予定の変更履歴：保存時に「比較用の要約」を残し、保護者には項目ごとの変更前後を表示する
import { get, limitToLast, orderByKey, query, ref } from "firebase/database";
import { firebase } from "./firebase";
import type { GradeCode } from "./grade";
import { dateTimeLabel } from "./datetime";
import { KIND_LABELS, STATUS_LABELS, type EventKind, type EventStatus, type TeamEvent } from "./types";
import type { EventDraft } from "./eventForm";
import { localInputToMs } from "./datetime";

/** 履歴に残す比較用の要約（画面に出す項目だけ） */
export interface EventSnapshot {
  date: string;
  title: string;
  kind: EventKind;
  status: EventStatus;
  start: string;
  end: string;
  meeting: string;
  kickoff: string;
  venue: string;
  opponent: string;
  uniform: string;
  equipment: string;
  messages: string;
  note: string;
  tournament: string;
  format: string;
  referee: string;
  venueNotes: string;
  parking: string;
  files: string;
}

export interface Difference { label: string; before: string; after: string }
export interface HistoryItem { id: string; at: number; version: number; actor: string; type: "added" | "updated"; changes: Difference[] }

const uniformText = (u: { top: string; bottom: string; socks: string }) =>
  u.top || u.bottom || u.socks ? `上 ${u.top || "未確認"}／下 ${u.bottom || "未確認"}／靴下 ${u.socks || "未確認"}` : "";

function parkingText(mode: string, limit: number, deadlineAt: number | null, confirmed: number): string {
  if (mode !== "lottery") return "抽選なし";
  return `抽選あり・${limit}台${deadlineAt ? `・締切 ${dateTimeLabel(deadlineAt)}` : ""}${confirmed ? `・確定枠 ${confirmed}台` : ""}`;
}

export function snapshotOfEvent(e: TeamEvent, tournamentName: string): EventSnapshot {
  return {
    date: e.date, title: e.title, kind: e.kind, status: e.status,
    start: e.start ?? "", end: e.end ?? "", meeting: e.meeting ?? "", kickoff: e.kickoff ?? "",
    venue: e.venue, opponent: e.opponent, uniform: uniformText(e.uniform),
    equipment: e.equipmentConfirmed ? e.equipment.join("・") || "指定なし" : "",
    messages: e.messages.join("\n"), note: e.note, tournament: tournamentName,
    format: e.details.format, referee: e.details.referee, venueNotes: e.details.venueNotes,
    parking: parkingText(e.parking.mode, e.parking.limit, e.parking.deadlineAt, e.parking.confirmed.length),
    files: e.attachments.map((a) => a.label).join("、"),
  };
}

export function snapshotOfDraft(d: EventDraft, tournamentName: string): EventSnapshot {
  return {
    date: d.date, title: d.title.trim(), kind: d.kind, status: d.status,
    start: d.start, end: d.end, meeting: d.meeting, kickoff: d.kickoff,
    venue: d.venue.trim(), opponent: d.opponent.trim(), uniform: uniformText(d.uniform),
    equipment: d.equipmentConfirmed ? d.equipment.join("・") || "指定なし" : "",
    messages: d.messages.join("\n"), note: d.note.trim(), tournament: tournamentName,
    format: d.details.format.trim(), referee: d.details.referee.trim(), venueNotes: d.details.venueNotes.trim(),
    parking: parkingText(d.parkingMode, d.parkingLimit, d.deadline ? localInputToMs(d.deadline) : null, d.confirmed.length),
    files: d.attachments.map((a) => a.label).join("、"),
  };
}

const FIELDS: [keyof EventSnapshot, string, (v: string) => string][] = [
  ["date", "日付", (v) => v.replaceAll("-", "/") || "未定"],
  ["title", "予定名", (v) => v || "未定"],
  ["kind", "種別", (v) => KIND_LABELS[v as EventKind] ?? "未定"],
  ["status", "開催状況", (v) => STATUS_LABELS[v as EventStatus] ?? "未確認"],
  ["start", "開始時刻", (v) => v || "未定"],
  ["end", "終了時刻", (v) => v || "未定"],
  ["meeting", "集合時刻", (v) => v || "未確認"],
  ["kickoff", "キックオフ", (v) => v || "未確認"],
  ["venue", "場所", (v) => v || "未定"],
  ["opponent", "対戦相手", (v) => v || "なし"],
  ["uniform", "ユニフォーム", (v) => v || "未確認"],
  ["equipment", "持ち物", (v) => v || "未確認"],
  ["messages", "チームからの連絡", (v) => v || "なし"],
  ["note", "補足", (v) => v || "なし"],
  ["tournament", "大会", (v) => v || "なし"],
  ["format", "試合形式", (v) => v || "なし"],
  ["referee", "審判割当", (v) => v || "なし"],
  ["venueNotes", "会場・駐車の注意事項", (v) => v || "なし"],
  ["parking", "駐車場", (v) => v || "抽選なし"],
  ["files", "当日資料", (v) => v || "なし"],
];

export function differences(before: Partial<EventSnapshot>, after: Partial<EventSnapshot>): Difference[] {
  return FIELDS.flatMap(([key, label, format]) => {
    const a = format(String(before[key] ?? ""));
    const b = format(String(after[key] ?? ""));
    return a === b ? [] : [{ label, before: a, after: b }];
  });
}

/** 最新30件の履歴（新しい順）。変化のない保存は表示しない */
export async function loadHistory(grade: GradeCode, eventId: string): Promise<HistoryItem[]> {
  const { db } = firebase();
  const snap = await get(query(ref(db, `mss/${grade}/history/${eventId}`), orderByKey(), limitToLast(30)));
  const items: HistoryItem[] = [];
  snap.forEach((child) => {
    const v = child.val() as { at?: number; version?: number; actor?: string; before?: Partial<EventSnapshot>; after?: Partial<EventSnapshot> };
    const added = !v.before;
    const changes = added ? [] : differences(v.before ?? {}, v.after ?? {});
    if (added || changes.length) {
      items.push({ id: child.key!, at: v.at ?? 0, version: v.version ?? 0, actor: v.actor ?? "コーチ", type: added ? "added" : "updated", changes });
    }
  });
  return items.reverse();
}
