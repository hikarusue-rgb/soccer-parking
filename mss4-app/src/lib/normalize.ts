// Realtime Database から読んだ値を、欠けた項目を補って画面用の型にそろえる。
// （RTDB は null・空配列を保存しないため、読み戻すと項目そのものが無いことがある）
import type {
  Attachment, Entry, EventKind, EventStatus, Lottery, LotteryReason, Member, TeamEvent, TeamMeta, TeamSettings,
} from "./types";

type Raw = Record<string, unknown>;
const KINDS: EventKind[] = ["practice", "match", "notice"];
const STATUSES: EventStatus[] = ["scheduled", "changed", "canceled", "postponed", "unconfirmed"];
const REASONS: LotteryReason[] = ["initial", "cancel", "limit_up", "limit_down"];

export const DEFAULT_UNIFORM_COLORS = ["白", "紺", "青", "赤", "黒", "黄", "緑", "ピンク", "オレンジ"];
export const DEFAULT_VENUES = ["香澄小", "袖ヶ浦東小", "第一カッターフィールド", "芝山東小", "二和小", "さつきが丘西小", "貞元小学校", "鷺沼小"];

const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown): boolean => v === true;
const time = (v: unknown): string | null => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null);

/** RTDB の配列は {0: …, 1: …} で返ることがあるので配列に戻す */
export function asArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined) as T[];
  if (v && typeof v === "object") return Object.values(v as Raw).filter((x) => x !== null && x !== undefined) as T[];
  return [];
}

const strings = (v: unknown): string[] => asArray(v).filter((x): x is string => typeof x === "string");

export function toAttachments(v: unknown): Attachment[] {
  return Object.entries(obj(v))
    .map(([id, raw]): Attachment | null => {
      const a = obj(raw);
      const url = str(a.url);
      if (!url.startsWith("https://") && !url.startsWith("http://")) return null;
      return {
        id,
        label: str(a.label) || "資料",
        type: a.type === "pdf" ? "pdf" : "image",
        contentType: str(a.contentType),
        size: num(a.size),
        width: typeof a.width === "number" ? a.width : undefined,
        height: typeof a.height === "number" ? a.height : undefined,
        path: str(a.path),
        url,
        order: num(a.order),
        uploadedAt: num(a.uploadedAt),
      };
    })
    .filter((a): a is Attachment => a !== null)
    .sort((a, b) => a.order - b.order || a.uploadedAt - b.uploadedAt);
}

export function toEvent(id: string, value: unknown): TeamEvent {
  const e = obj(value);
  const parking = obj(e.parking);
  const uniform = obj(e.uniform);
  const details = obj(e.details);
  const legacy = obj(e.legacy);
  const hp = obj(e.hp);
  return {
    id,
    date: str(e.date),
    kind: KINDS.includes(e.kind as EventKind) ? (e.kind as EventKind) : "practice",
    title: str(e.title) || "（予定名なし）",
    status: STATUSES.includes(e.status as EventStatus) ? (e.status as EventStatus) : "unconfirmed",
    start: time(e.start),
    end: time(e.end),
    meeting: time(e.meeting),
    kickoff: time(e.kickoff),
    venue: str(e.venue),
    opponent: str(e.opponent),
    uniform: { top: str(uniform.top), bottom: str(uniform.bottom), socks: str(uniform.socks) },
    equipment: strings(e.equipment),
    equipmentConfirmed: bool(e.equipmentConfirmed),
    messages: strings(e.messages),
    note: str(e.note),
    tournamentId: str(e.tournamentId) || null,
    details: { format: str(details.format), referee: str(details.referee), venueNotes: str(details.venueNotes) },
    attachments: toAttachments(e.attachments),
    parking: {
      mode: parking.mode === "lottery" ? "lottery" : "none",
      limit: num(parking.limit),
      deadlineAt: typeof parking.deadlineAt === "number" ? parking.deadlineAt : null,
      reserved: num(parking.reserved),
      confirmed: strings(parking.confirmed),
    },
    version: num(e.version, 1),
    createdAt: typeof e.createdAt === "number" ? e.createdAt : null,
    updatedAt: num(e.updatedAt),
    updatedBy: str(e.updatedBy) || "コーチ",
    legacy: Object.keys(legacy).length
      ? {
        ...(str(legacy.calendarId) ? { calendarId: str(legacy.calendarId) } : {}),
        ...(str(legacy.parkingEventId) ? { parkingEventId: str(legacy.parkingEventId) } : {}),
      }
      : null,
    // クラブHPとのひも付けは、そのまま保持する（アプリで保存しても消さない）
    hp: str(hp.key) ? (Object.fromEntries(Object.entries(hp).filter(([, v]) => typeof v === "string" || typeof v === "boolean")) as unknown as TeamEvent["hp"]) : null,
  };
}

export function toMember(id: string, value: unknown): Member {
  const m = obj(value);
  return { id, num: num(m.num), name: str(m.name) || "（名前なし）", active: m.active !== false, order: num(m.order, 999) };
}

export function toEntry(value: unknown): Entry {
  const r = obj(value);
  return { attending: bool(r.attending), parkingNeeded: bool(r.parkingNeeded), carpoolCapacity: num(r.carpoolCapacity), at: num(r.at) };
}

export function toLottery(value: unknown): Lottery {
  const l = obj(value);
  return {
    status: "drawn",
    policy: "random",
    slots: num(l.slots),
    participants: strings(l.participants),
    winners: strings(l.winners),
    rounds: asArray(l.rounds).map((raw, i) => {
      const r = obj(raw);
      return {
        round: num(r.round, i + 1),
        at: num(r.at),
        reason: REASONS.includes(r.reason as LotteryReason) ? (r.reason as LotteryReason) : "initial",
        participants: strings(r.participants),
        winners: strings(r.winners),
      };
    }),
    conductedAt: num(l.conductedAt),
    updatedAt: num(l.updatedAt),
    ladder: toLadder(l.ladder),
  };
}

/** RTDB は空の配列を保存しないため、横線のない段は欠けて返ってくる。段数に合わせて補う */
function toLadder(value: unknown): Lottery["ladder"] {
  const raw = obj(value);
  const order = strings(raw.order);
  const rows = num(raw.rows);
  if (!order.length || rows <= 0 || rows > 60) return null;
  const rungsRaw = raw.rungs as Record<number, unknown> | unknown[] | undefined;
  const rungs = Array.from({ length: rows }, (_, i) =>
    asArray<number>((rungsRaw as Record<number, unknown> | undefined)?.[i]).filter((c) => Number.isInteger(c) && c >= 0 && c < order.length - 1),
  );
  return { order, rows, rungs, slots: Math.max(0, Math.min(num(raw.slots), order.length)) };
}

export function toMeta(value: unknown): TeamMeta {
  const m = obj(value);
  return { team: str(m.team) || "MSS・香澄", gradeLabel: str(m.gradeLabel), schema: num(m.schema, 1) };
}

export function toSettings(value: unknown): TeamSettings {
  const s = obj(value);
  const venues = strings(s.venues);
  const colors = strings(s.uniformColors);
  return {
    seasonStart: /^\d{2}-\d{2}$/.test(str(s.seasonStart)) ? str(s.seasonStart) : "04-01",
    venues: venues.length ? venues : DEFAULT_VENUES,
    uniformColors: colors.length ? colors : DEFAULT_UNIFORM_COLORS,
  };
}

/** 予定の並び順：日付 → 時刻（開始・集合・キックオフの早い方）→ ID */
export function compareEvents(a: TeamEvent, b: TeamEvent): number {
  const t = (e: TeamEvent) => e.start ?? e.meeting ?? e.kickoff ?? "99:99";
  return a.date.localeCompare(b.date) || t(a).localeCompare(t(b)) || a.id.localeCompare(b.id);
}
