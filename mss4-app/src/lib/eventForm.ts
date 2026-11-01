// コーチの予定編集フォーム：下書きの型・初期値・検証・保存形への変換
import { serverTimestamp } from "firebase/database";
import { addDays, localInputToMs, msToLocalInput } from "./datetime";
import type { Attachment, EventDetails, EventKind, EventStatus, TeamEvent, Uniform } from "./types";

export const TITLE_PRESETS: Record<EventKind, string[]> = {
  practice: ["トレーニング", "自主練習", "合同練習"],
  match: ["練習試合（TM）", "プライマリーリーグ", "プレミアリーグ", "ブロックリーグ", "公式戦", "招待大会"],
  notice: ["お休み", "会場使用不可", "チーム行事", "その他のお知らせ"],
};
export const TIME_PRESETS: Record<EventKind, [string, string][]> = {
  practice: [["08:00", "10:30"], ["09:00", "11:00"], ["10:00", "12:00"], ["13:00", "15:00"]],
  match: [["08:00", "12:00"], ["09:00", "13:00"], ["12:00", "17:00"], ["12:45", "17:00"]],
  notice: [],
};
export const EQUIPMENT_CHOICES = ["ボール", "水筒", "すね当て", "タオル", "帽子", "着替え", "ユニフォーム（正）", "ユニフォーム（副）", "サブ・ビブス", "お弁当"];
export const MESSAGE_CHOICES = ["雨天時は改めて連絡します", "集合時刻を確認してください", "ユニフォームは正・副を持参してください", "現地集合・現地解散です"];

export interface EventDraft {
  id: string | null;
  /** 編集元の版（新規は 0） */
  version: number;
  date: string;
  kind: EventKind;
  title: string;
  status: EventStatus;
  start: string;
  end: string;
  meeting: string;
  kickoff: string;
  venue: string;
  opponent: string;
  uniform: Uniform;
  equipment: string[];
  equipmentConfirmed: boolean;
  messages: string[];
  note: string;
  tournamentId: string;
  details: EventDetails;
  parkingMode: "none" | "lottery";
  parkingLimit: number;
  /** <input type="datetime-local"> の値（日本時間）。空は締切なし */
  deadline: string;
  confirmed: string[];
  attachments: Attachment[];
  createdAt: number | null;
  legacy: TeamEvent["legacy"];
}

/** 試合の2日前の17:00（旧駐車場アプリと同じ） */
export function autoDeadline(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${addDays(date, -2)}T17:00` : "";
}

export function blankDraft(date: string): EventDraft {
  return {
    id: null, version: 0, date, kind: "practice", title: "トレーニング", status: "scheduled",
    start: "", end: "", meeting: "", kickoff: "", venue: "", opponent: "",
    uniform: { top: "", bottom: "", socks: "" }, equipment: [], equipmentConfirmed: false, messages: [], note: "",
    tournamentId: "", details: { format: "", referee: "", venueNotes: "" },
    parkingMode: "none", parkingLimit: 0, deadline: "", confirmed: [], attachments: [], createdAt: null, legacy: null,
  };
}

export function draftFromEvent(e: TeamEvent, options: { duplicate?: boolean } = {}): EventDraft {
  const dup = options.duplicate === true;
  return {
    id: dup ? null : e.id,
    version: dup ? 0 : e.version,
    date: e.date, kind: e.kind, title: e.title, status: dup ? "scheduled" : e.status,
    start: e.start ?? "", end: e.end ?? "", meeting: e.meeting ?? "", kickoff: e.kickoff ?? "",
    venue: e.venue, opponent: e.opponent, uniform: { ...e.uniform },
    equipment: [...e.equipment], equipmentConfirmed: e.equipmentConfirmed, messages: [...e.messages], note: e.note,
    tournamentId: e.tournamentId ?? "", details: { ...e.details },
    parkingMode: e.parking.mode === "lottery" && e.parking.limit > 0 ? "lottery" : "none", parkingLimit: e.parking.mode === "lottery" ? e.parking.limit : 0,
    deadline: e.parking.deadlineAt ? msToLocalInput(e.parking.deadlineAt) : "",
    confirmed: dup ? [] : [...e.parking.confirmed],
    // 複製では資料（ファイル）は引き継がない
    attachments: dup ? [] : e.attachments,
    createdAt: dup ? null : e.createdAt,
    legacy: dup ? null : e.legacy,
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateDraft(d: EventDraft): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.push("日付を選んでください。");
  if (!d.title.trim()) errors.push("予定名を入力してください。");
  if (d.title.trim().length > 100) errors.push("予定名は100文字以内にしてください。");
  for (const [label, v] of [["開始", d.start], ["終了", d.end], ["集合", d.meeting], ["キックオフ", d.kickoff]] as const) {
    if (v && !TIME.test(v)) errors.push(`${label}の時刻を確認してください。`);
  }
  if (d.start && d.end && d.end <= d.start) errors.push("終了は開始より後の時刻にしてください。");
  const reference = d.kickoff || d.start;
  if (d.meeting && reference && d.meeting > reference) errors.push("集合はキックオフ・開始より前の時刻にしてください。");
  if (d.parkingMode === "lottery") {
    if (!Number.isInteger(d.parkingLimit) || d.parkingLimit < 1 || d.parkingLimit > 50) errors.push("駐車可能台数は1〜50台で入力してください。");
    if (d.deadline && localInputToMs(d.deadline) === null) errors.push("応募締切の日時を確認してください。");
    if (d.confirmed.length > d.parkingLimit) errors.push("確定枠が駐車可能台数を超えています。");
  }
  return errors;
}

const clean = (s: string) => s.trim();
const nonEmpty = (list: string[]) => [...new Set(list.map(clean).filter(Boolean))];

/** RTDB に保存する形（空の項目は保存しない。版番号を1つ上げ、更新時刻はサーバー時刻） */
export function toStoredEvent(d: EventDraft): Record<string, unknown> {
  const opt = <T,>(v: T, ok: boolean) => (ok ? v : undefined);
  const uniform = { top: clean(d.uniform.top), bottom: clean(d.uniform.bottom), socks: clean(d.uniform.socks) };
  const details = { format: clean(d.details.format), referee: clean(d.details.referee), venueNotes: clean(d.details.venueNotes) };
  const deadlineAt = d.parkingMode === "lottery" && d.deadline ? localInputToMs(d.deadline) : null;
  const stored: Record<string, unknown> = {
    date: d.date,
    kind: d.kind,
    title: clean(d.title).slice(0, 100),
    status: d.status,
    start: opt(d.start, Boolean(d.start)),
    end: opt(d.end, Boolean(d.end)),
    meeting: opt(d.meeting, Boolean(d.meeting)),
    kickoff: opt(d.kickoff, Boolean(d.kickoff)),
    venue: opt(clean(d.venue), Boolean(clean(d.venue))),
    opponent: opt(clean(d.opponent), Boolean(clean(d.opponent))),
    uniform: opt(uniform, Boolean(uniform.top || uniform.bottom || uniform.socks)),
    equipment: opt(nonEmpty(d.equipment), nonEmpty(d.equipment).length > 0),
    equipmentConfirmed: d.equipmentConfirmed,
    messages: opt(nonEmpty(d.messages), nonEmpty(d.messages).length > 0),
    note: opt(d.note.trim(), Boolean(d.note.trim())),
    tournamentId: opt(d.tournamentId, Boolean(d.tournamentId)),
    details: opt(details, Boolean(details.format || details.referee || details.venueNotes)),
    attachments: opt(
      // RTDB は undefined を保存できないため、値のない項目（画像以外の幅・高さ）は除く
      Object.fromEntries(d.attachments.map(({ id, ...rest }) => [id, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))])),
      d.attachments.length > 0,
    ),
    parking: d.parkingMode === "lottery"
      ? { mode: "lottery", limit: d.parkingLimit, ...(deadlineAt ? { deadlineAt } : {}), ...(d.confirmed.length ? { confirmed: d.confirmed } : {}) }
      : { mode: "none", limit: 0 },
    version: d.version + 1,
    createdAt: d.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: "コーチ",
    legacy: opt(
      Object.fromEntries(Object.entries(d.legacy ?? {}).filter(([, v]) => typeof v === "string" && v)),
      Boolean(d.legacy && (d.legacy.calendarId || d.legacy.parkingEventId)),
    ),
  };
  for (const key of Object.keys(stored)) if (stored[key] === undefined) delete stored[key];
  return stored;
}
