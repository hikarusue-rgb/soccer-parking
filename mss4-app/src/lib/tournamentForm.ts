// 大会（複数日にまたがるリーグ戦など）：共通要項・レギュレーション・公式URL
import { child, push, ref, remove, serverTimestamp, set } from "firebase/database";
import { firebase } from "./firebase";
import type { GradeCode } from "./grade";
import type { Attachment, Tournament } from "./types";

export interface TournamentDraft {
  id: string | null;
  version: number;
  name: string;
  startDate: string;
  endDate: string;
  organizer: string;
  officialUrl: string;
  regulations: string;
  notes: string;
  attachments: Attachment[];
  archived: boolean;
}

export function blankTournament(): TournamentDraft {
  return { id: null, version: 0, name: "", startDate: "", endDate: "", organizer: "", officialUrl: "", regulations: "", notes: "", attachments: [], archived: false };
}

export function draftFromTournament(t: Tournament): TournamentDraft {
  return {
    id: t.id, version: t.version, name: t.name, startDate: t.startDate ?? "", endDate: t.endDate ?? "",
    organizer: t.organizer, officialUrl: t.officialUrl, regulations: t.regulations, notes: t.notes,
    attachments: t.attachments, archived: t.archived,
  };
}

/** http(s) のURLだけを許可（資格情報付き・空白を含むものは不可） */
export function safeUrl(value: string): string {
  const text = value.trim();
  if (!text || /\s/.test(text)) return "";
  try {
    const url = new URL(text);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function validateTournament(d: TournamentDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push("大会名を入力してください。");
  if (d.name.trim().length > 100) errors.push("大会名は100文字以内にしてください。");
  if (d.startDate && d.endDate && d.endDate < d.startDate) errors.push("終了日は開始日以降にしてください。");
  if (d.officialUrl.trim() && !safeUrl(d.officialUrl)) errors.push("公式URLは https:// から始まるURLを入力してください。");
  return errors;
}

export function toStoredTournament(d: TournamentDraft): Record<string, unknown> {
  const stored: Record<string, unknown> = {
    name: d.name.trim().slice(0, 100),
    archived: d.archived,
    version: d.version + 1,
    updatedAt: serverTimestamp(),
  };
  const put = (key: string, value: string) => { if (value.trim()) stored[key] = value.trim(); };
  put("startDate", d.startDate);
  put("endDate", d.endDate);
  put("organizer", d.organizer);
  put("officialUrl", safeUrl(d.officialUrl));
  put("regulations", d.regulations);
  put("notes", d.notes);
  if (d.attachments.length) {
    stored.attachments = Object.fromEntries(d.attachments.map(({ id, ...rest }) => [id, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))]));
  }
  return stored;
}

export async function saveTournament(grade: GradeCode, d: TournamentDraft): Promise<string> {
  const { db } = firebase();
  const id = d.id ?? push(child(ref(db), `mss/${grade}/tournaments`)).key!;
  try {
    await set(ref(db, `mss/${grade}/tournaments/${id}`), toStoredTournament(d));
  } catch (error) {
    console.error("大会の保存に失敗しました:", String((error as { message?: string })?.message ?? error));
    throw new Error("保存できませんでした。ほかのコーチが先に更新した可能性があります。いったん閉じて最新の内容を確認してください。");
  }
  return id;
}

export async function deleteTournament(grade: GradeCode, id: string): Promise<void> {
  const { db } = firebase();
  await remove(ref(db, `mss/${grade}/tournaments/${id}`));
}
