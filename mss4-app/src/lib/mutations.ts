// データの保存・削除（権限はルール側でも検査される）
import { child, push, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { DATA_ROOT } from "./config";
import { firebase } from "./firebase";
import type { GradeCode } from "./grade";
import type { Lottery, Member } from "./types";
import { toStoredEvent, type EventDraft } from "./eventForm";
import type { EventSnapshot } from "./changes";

export class SaveError extends Error {}

function explain(error: unknown): SaveError {
  const message = String((error as { message?: string })?.message ?? error);
  console.error("保存に失敗しました:", message);
  if (/permission/i.test(message)) {
    return new SaveError("保存できませんでした。ほかのコーチが先に更新したか、ログインの有効期限が切れた可能性があります。入力はそのままにして、画面上部の最新の内容を確認してから保存し直してください。");
  }
  return new SaveError("保存できませんでした。通信状態を確認して、もう一度お試しください。");
}

/** 予定を保存し、同時に変更履歴を1件追記する（どちらか一方だけ保存されることはない） */
export async function saveEvent(
  grade: GradeCode,
  draft: EventDraft,
  snapshots: { before: EventSnapshot | null; after: EventSnapshot },
): Promise<string> {
  const { db } = firebase();
  const root = ref(db);
  const id = draft.id ?? push(child(root, `${DATA_ROOT}/${grade}/events`)).key!;
  const stored = toStoredEvent(draft);
  const historyId = push(child(root, `${DATA_ROOT}/${grade}/history/${id}`)).key!;
  const updates: Record<string, unknown> = {
    [`${DATA_ROOT}/${grade}/events/${id}`]: stored,
    [`${DATA_ROOT}/${grade}/history/${id}/${historyId}`]: {
      at: serverTimestamp(),
      version: stored.version,
      actor: "コーチ",
      ...(snapshots.before ? { before: snapshots.before } : {}),
      after: snapshots.after,
    },
  };
  try {
    await update(root, updates);
  } catch (error) {
    throw explain(error);
  }
  return id;
}

/** 車出しエントリー（参加・車出し希望・乗合可能人数）。締切後は辞退だけがルールで許可される */
export async function saveEntry(
  grade: GradeCode,
  eventId: string,
  memberId: string,
  entry: { attending: boolean; parkingNeeded: boolean; carpoolCapacity: number },
): Promise<void> {
  const { db } = firebase();
  try {
    await set(ref(db, `${DATA_ROOT}/${grade}/entries/${eventId}/${memberId}`), {
      attending: entry.attending,
      parkingNeeded: entry.attending && entry.parkingNeeded,
      carpoolCapacity: Math.max(0, Math.min(8, Math.round(entry.carpoolCapacity))),
      at: serverTimestamp(),
    });
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? error);
    console.error("エントリーの保存に失敗しました:", message);
    throw new SaveError(/permission/i.test(message)
      ? "送信できませんでした。締切を過ぎた後は、車出しの辞退だけができます。"
      : "送信できませんでした。通信状態を確認して、もう一度お試しください。");
  }
}

/** 抽選結果を保存する（コーチのみ） */
export async function saveLottery(grade: GradeCode, eventId: string, lottery: Omit<Lottery, "updatedAt"> & { ladder?: unknown }): Promise<void> {
  const { db } = firebase();
  try {
    await set(ref(db, `${DATA_ROOT}/${grade}/lotteries/${eventId}`), { ...lottery, updatedAt: serverTimestamp() });
  } catch (error) {
    throw explain(error);
  }
}

/** 抽選結果を取り消す（コーチのみ。エントリーは残る） */
export async function clearLottery(grade: GradeCode, eventId: string): Promise<void> {
  const { db } = firebase();
  try {
    await remove(ref(db, `${DATA_ROOT}/${grade}/lotteries/${eventId}`));
  } catch (error) {
    throw explain(error);
  }
}

/** 名簿の追加・変更（コーチのみ）。過去の抽選と結び付いているため削除はせず、外す場合は active: false */
export async function saveMembers(grade: GradeCode, members: Member[]): Promise<void> {
  const { db } = firebase();
  const updates: Record<string, unknown> = {};
  for (const m of members) {
    updates[`${DATA_ROOT}/${grade}/members/${m.id}`] = { num: m.num, name: m.name.trim().slice(0, 40), active: m.active, order: m.order };
  }
  try {
    await update(ref(db), updates);
  } catch (error) {
    throw explain(error);
  }
}

export function newMemberId(grade: GradeCode): string {
  const { db } = firebase();
  return push(child(ref(db), `${DATA_ROOT}/${grade}/members`)).key!;
}

/** 予定と、その予定のエントリー・抽選結果を削除する（変更履歴は残す） */
export async function deleteEvent(grade: GradeCode, eventId: string): Promise<void> {
  const { db } = firebase();
  try {
    await update(ref(db), {
      [`${DATA_ROOT}/${grade}/events/${eventId}`]: null,
      [`${DATA_ROOT}/${grade}/entries/${eventId}`]: null,
      [`${DATA_ROOT}/${grade}/lotteries/${eventId}`]: null,
    });
  } catch (error) {
    throw explain(error);
  }
}
