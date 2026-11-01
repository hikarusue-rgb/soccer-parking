// 既存の2アプリのデータ → 新スキーマ（/mss/{grade}）への変換。入出力を持たない純粋関数だけを置く。
// 実行は scripts/migrate.ts（node で直接実行。型注釈は Node の型除去で読み飛ばされる）。
import type { Entry, EventKind, EventStatus, LotteryReason } from "../../src/lib/types.ts";

// ── 入力（既存データ）の形 ──
export interface LegacyRosterMember { id?: string; num?: number | string; name?: string; grade?: string }
export interface LegacyParkingEvent {
  id?: string; title?: string; matchDate?: string; deadline?: string; parkingLimit?: number | string;
  confirmedParking?: string[]; location?: string; opponent?: string; meetTime?: string; kickoffTime?: string;
  endTime?: string; notes?: string; uniformTop?: string; uniformBottom?: string; uniformSocks?: string;
}
export interface LegacyResponse { attending?: boolean; parkingNeeded?: boolean; carpoolCapacity?: number; at?: number }
export interface LegacyLottery {
  conducted?: boolean; conductedAt?: number; winners?: string[]; allParticipants?: string[];
  history?: { round?: number; winners?: string[]; at?: number; reason?: string }[];
  lastReLotteryAt?: number; lastLimitChangeAt?: number;
}
export interface CalendarEvent {
  id: string; date: string; title?: string; kind?: string; grades?: string[];
  start?: string | null; end?: string | null; meeting?: string | null; kickoff?: string | null; venue?: string;
  equipment?: string[]; equipmentConfirmed?: boolean; messages?: string[]; note?: string; status?: string;
  parking?: boolean; uniformTop?: string; uniformBottom?: string; uniformSocks?: string;
  version?: number; updatedAt?: string; source?: string | null;
}

// ── 出力（RTDB に保存する形。null と空配列は保存しない） ──
export interface StoredEvent {
  date: string; kind: EventKind; title: string; status: EventStatus;
  start?: string; end?: string; meeting?: string; kickoff?: string;
  venue?: string; opponent?: string; uniform?: { top?: string; bottom?: string; socks?: string };
  equipment?: string[]; equipmentConfirmed: boolean; messages?: string[]; note?: string;
  parking: { mode: "none" | "lottery"; limit: number; deadlineAt?: number; confirmed?: string[] };
  version: number; createdAt: number; updatedAt: number; updatedBy: string;
  legacy: { calendarId?: string; parkingEventId?: string };
}
export interface StoredMember { num: number; name: string; active: boolean; order: number }
export interface StoredLottery {
  status: "drawn"; policy: "random"; slots: number; participants: string[]; winners: string[];
  rounds: { round: number; at: number; reason: LotteryReason; participants: string[]; winners: string[] }[];
  conductedAt: number; updatedAt: number;
}

/** 移行後に「準備中」のまま残す既存カレンダーの定型文（駐車場側に要項があるときは外す） */
export const CALENDAR_IMPORT_NOTE = "既存カレンダーの登録内容を取り込みました。集合・持ち物・最新の開催状況はコーチの確認待ちです。";

const KINDS: EventKind[] = ["practice", "match", "notice"];
const STATUSES: EventStatus[] = ["scheduled", "changed", "canceled", "postponed", "unconfirmed"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const time = (v: unknown): string | undefined => (typeof v === "string" && TIME.test(v) ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : []);
const arrayOf = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter(Boolean) as T[] : v && typeof v === "object" ? Object.values(v).filter(Boolean) as T[] : []);

/** 空文字・undefined・空配列・空オブジェクトの項目を取り除く（RTDB に合わせる） */
export function compact<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = compact(v as object);
      if (Object.keys(inner).length === 0) continue;
      out[k] = inner;
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

/** "2026-10-15T17:00"（日本時間）→ ミリ秒 */
export function localToMs(v: unknown): number | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return undefined;
  const ms = Date.parse(`${v.slice(0, 16)}:00+09:00`);
  return Number.isNaN(ms) ? undefined : ms;
}

export function splitMatchDate(v: unknown): { date: string | null; time: string | undefined } {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return { date: null, time: undefined };
  return { date: v.slice(0, 10), time: time(v.slice(11, 16)) };
}

export function convertMembers(roster: unknown): { members: Record<string, StoredMember>; warnings: string[] } {
  const members: Record<string, StoredMember> = {};
  const warnings: string[] = [];
  arrayOf<LegacyRosterMember>(roster).forEach((m, i) => {
    const id = text(m.id);
    const name = text(m.name);
    if (!ID.test(id) || !name) {
      warnings.push(`名簿の${i + 1}行目はIDか名前が不正なため移行しません`);
      return;
    }
    const num = Number(m.num);
    members[id] = { num: Number.isFinite(num) ? num : 0, name: name.slice(0, 40), active: true, order: i + 1 };
  });
  return { members, warnings };
}

export function convertParkingEvent(e: LegacyParkingEvent, now: number): { id: string; event: StoredEvent } | null {
  const id = text(e.id);
  const { date, time: matchTime } = splitMatchDate(e.matchDate);
  if (!ID.test(id) || !date) return null;
  const limit = Math.max(0, Math.min(50, Number(e.parkingLimit) || 0));
  const event = compact<StoredEvent>({
    date,
    kind: "match",
    title: (text(e.title) || "試合").slice(0, 100),
    status: "scheduled",
    meeting: time(e.meetTime),
    // 旧アプリは「試合日時」の時刻をキックオフとして優先表示していた（kickoffTime は旧データ用）
    kickoff: matchTime ?? time(e.kickoffTime),
    end: time(e.endTime),
    venue: text(e.location),
    opponent: text(e.opponent),
    uniform: { top: text(e.uniformTop), bottom: text(e.uniformBottom), socks: text(e.uniformSocks) },
    equipmentConfirmed: false,
    note: text(e.notes),
    parking: { mode: "lottery", limit, deadlineAt: localToMs(e.deadline), confirmed: list(e.confirmedParking) },
    version: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: "移行",
    legacy: { parkingEventId: id },
  });
  return { id, event };
}

export function convertCalendarEvent(e: CalendarEvent, now: number): { id: string; event: StoredEvent } | null {
  if (!ID.test(e.id) || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  const updated = typeof e.updatedAt === "string" ? Date.parse(e.updatedAt) : NaN;
  const event = compact<StoredEvent>({
    date: e.date,
    kind: KINDS.includes(e.kind as EventKind) ? (e.kind as EventKind) : "practice",
    title: (text(e.title) || "予定").slice(0, 100),
    status: STATUSES.includes(e.status as EventStatus) ? (e.status as EventStatus) : "unconfirmed",
    start: time(e.start),
    end: time(e.end),
    meeting: time(e.meeting),
    kickoff: time(e.kickoff),
    venue: text(e.venue),
    uniform: { top: text(e.uniformTop), bottom: text(e.uniformBottom), socks: text(e.uniformSocks) },
    equipment: list(e.equipment),
    equipmentConfirmed: e.equipmentConfirmed === true,
    messages: list(e.messages),
    note: text(e.note),
    // カレンダーの「駐車場ボタンを表示」は台数・締切を持たないため、抽選設定は駐車場側と統合したときだけ有効にする
    parking: { mode: "none", limit: 0 },
    version: 1,
    createdAt: Number.isNaN(updated) ? now : updated,
    updatedAt: Number.isNaN(updated) ? now : updated,
    updatedBy: "移行",
    legacy: { calendarId: e.id },
  });
  return { id: e.id, event };
}

/** 同じ日の試合どうしを組にする。候補が複数ある日は時刻・予定名の近さで選び、決められなければ別々に残す */
export function matchEvents(calendar: CalendarEvent[], parking: LegacyParkingEvent[]) {
  const pairs: { calendar: CalendarEvent; parking: LegacyParkingEvent }[] = [];
  const used = new Set<string>();
  const ambiguous: string[] = [];
  for (const p of parking) {
    const { date, time: pTime } = splitMatchDate(p.matchDate);
    if (!date) continue;
    const candidates = calendar.filter((c) => c.date === date && c.kind === "match" && !used.has(c.id));
    let chosen: CalendarEvent | undefined;
    if (candidates.length === 1) chosen = candidates[0];
    else if (candidates.length > 1) {
      const title = text(p.title);
      chosen = candidates.find((c) => c.kickoff === pTime || c.meeting === time(p.meetTime))
        ?? candidates.find((c) => text(c.title) && title.includes(text(c.title)));
      if (!chosen) ambiguous.push(`${date} ${title}`);
    }
    if (chosen) {
      used.add(chosen.id);
      pairs.push({ calendar: chosen, parking: p });
    }
  }
  const pairedParking = new Set(pairs.map((x) => x.parking));
  return {
    pairs,
    calendarOnly: calendar.filter((c) => !used.has(c.id)),
    parkingOnly: parking.filter((p) => !pairedParking.has(p)),
    ambiguous,
  };
}

/** カレンダー側を土台に、駐車場側の要項・駐車場設定を重ねる（空欄だけを埋め、推測で補わない） */
export function mergeEvent(cal: StoredEvent, park: StoredEvent): StoredEvent {
  const parkingHasDetails = Boolean(park.meeting || park.kickoff || park.note);
  const notes = [cal.note === CALENDAR_IMPORT_NOTE && parkingHasDetails ? "" : cal.note, park.note]
    .filter((x): x is string => Boolean(x));
  return compact<StoredEvent>({
    ...cal,
    // 駐車場側の予定名は対戦相手まで入っていることが多い（例: プレミアリーグ vs○○FC）
    title: park.title || cal.title,
    meeting: cal.meeting ?? park.meeting,
    kickoff: cal.kickoff ?? park.kickoff,
    end: cal.end ?? park.end,
    // 駐車場側の会場名は正式名称が多く、地図検索に向く
    venue: park.venue || cal.venue,
    opponent: park.opponent,
    uniform: {
      top: cal.uniform?.top || park.uniform?.top,
      bottom: cal.uniform?.bottom || park.uniform?.bottom,
      socks: cal.uniform?.socks || park.uniform?.socks,
    },
    note: [...new Set(notes)].join("\n\n"),
    parking: park.parking,
    legacy: { ...cal.legacy, ...park.legacy },
  });
}

export function convertEntries(
  responses: unknown,
  memberIds: Set<string>,
): { entries: Record<string, Entry>; dropped: number } {
  const entries: Record<string, Entry> = {};
  let dropped = 0;
  if (!responses || typeof responses !== "object") return { entries, dropped };
  for (const [memberId, raw] of Object.entries(responses as Record<string, LegacyResponse>)) {
    if (!memberIds.has(memberId) || !raw || typeof raw !== "object") {
      dropped++;
      continue;
    }
    const attending = raw.attending === true;
    entries[memberId] = {
      attending,
      parkingNeeded: attending && raw.parkingNeeded === true,
      carpoolCapacity: Math.max(0, Math.min(8, Number(raw.carpoolCapacity) || 0)),
      at: typeof raw.at === "number" ? raw.at : 0,
    };
  }
  return { entries, dropped };
}

/** 当選者が名前で記録された古いデータも、名簿のIDに直して取り込む */
export function convertLottery(
  raw: LegacyLottery | null | undefined,
  event: StoredEvent,
  resolveMember: (idOrName: string) => string | null,
): StoredLottery | null {
  if (!raw || raw.conducted !== true) return null;
  const ids = (v: unknown) => [...new Set(list(v).map(resolveMember).filter((x): x is string => Boolean(x)))];
  const conductedAt = typeof raw.conductedAt === "number" ? raw.conductedAt : 0;
  const history = Array.isArray(raw.history) ? raw.history : [];
  const rounds = history.map((h, i) => ({
    round: typeof h?.round === "number" ? h.round : i + 1,
    at: typeof h?.at === "number" ? h.at : conductedAt,
    reason: (h?.reason === "limit_decrease" ? "limit_down" : i === 0 ? "initial" : "cancel") as LotteryReason,
    participants: [],
    winners: ids(h?.winners),
  }));
  const participants = ids(raw.allParticipants);
  const winners = ids(raw.winners);
  return {
    status: "drawn",
    policy: "random",
    slots: Math.max(0, event.parking.limit - (event.parking.confirmed?.length ?? 0)),
    participants,
    winners,
    rounds: rounds.length ? rounds : [{ round: 1, at: conductedAt, reason: "initial", participants, winners }],
    conductedAt,
    updatedAt: Math.max(conductedAt, raw.lastReLotteryAt ?? 0, raw.lastLimitChangeAt ?? 0),
  };
}

export interface MigrationInput {
  roster: unknown;
  parkingEvents: unknown;
  responses: unknown;
  lotteries: unknown;
  calendarEvents: CalendarEvent[];
  uniformColors?: string[];
  now: number;
}

export function buildTree(input: MigrationInput) {
  const { members, warnings } = convertMembers(input.roster);
  const memberIds = new Set(Object.keys(members));
  const byName = new Map<string, string[]>();
  for (const [id, m] of Object.entries(members)) byName.set(m.name, [...(byName.get(m.name) ?? []), id]);
  const resolveMember = (v: string) => (memberIds.has(v) ? v : byName.get(v)?.length === 1 ? byName.get(v)![0] : null);

  const parkingEvents = arrayOf<LegacyParkingEvent>(input.parkingEvents);
  const calendarEvents = input.calendarEvents.filter((c) => !c.grades || c.grades.includes("4年生"));
  const { pairs, calendarOnly, parkingOnly, ambiguous } = matchEvents(calendarEvents, parkingEvents);

  const events: Record<string, StoredEvent> = {};
  const parkingIdToEventId = new Map<string, string>();
  const merged: { date: string; calendarTitle: string; parkingTitle: string; title: string }[] = [];
  for (const { calendar, parking } of pairs) {
    const c = convertCalendarEvent(calendar, input.now);
    const p = convertParkingEvent(parking, input.now);
    if (!c || !p) continue;
    events[c.id] = mergeEvent(c.event, p.event);
    parkingIdToEventId.set(p.id, c.id);
    merged.push({ date: c.event.date, calendarTitle: c.event.title, parkingTitle: p.event.title, title: events[c.id].title });
  }
  for (const calendar of calendarOnly) {
    const c = convertCalendarEvent(calendar, input.now);
    if (c) events[c.id] = c.event;
  }
  for (const parking of parkingOnly) {
    const p = convertParkingEvent(parking, input.now);
    if (!p) continue;
    if (events[p.id]) warnings.push(`予定ID ${p.id} が重複したため、駐車場側の予定を移行しません`);
    else {
      events[p.id] = p.event;
      parkingIdToEventId.set(p.id, p.id);
    }
  }

  const entries: Record<string, Record<string, Entry>> = {};
  let droppedEntries = 0;
  const responses = (input.responses ?? {}) as Record<string, unknown>;
  for (const [legacyId, byMember] of Object.entries(responses)) {
    const eventId = parkingIdToEventId.get(legacyId);
    if (!eventId) {
      droppedEntries += Object.keys((byMember as object) ?? {}).length;
      continue;
    }
    const converted = convertEntries(byMember, memberIds);
    droppedEntries += converted.dropped;
    if (Object.keys(converted.entries).length) entries[eventId] = converted.entries;
  }

  const lotteries: Record<string, StoredLottery> = {};
  let skippedLotteries = 0;
  for (const [legacyId, raw] of Object.entries((input.lotteries ?? {}) as Record<string, LegacyLottery>)) {
    const eventId = parkingIdToEventId.get(legacyId);
    const lottery = eventId ? convertLottery(raw, events[eventId], resolveMember) : null;
    if (eventId && lottery) lotteries[eventId] = lottery;
    else skippedLotteries++;
  }

  const venues = [...new Set(Object.values(events).map((e) => e.venue).filter((v): v is string => Boolean(v)))];
  const tree = {
    meta: { team: "MSS・香澄", gradeLabel: "4年生", schema: 1, migratedAt: input.now },
    settings: compact({ seasonStart: "04-01", venues, uniformColors: input.uniformColors ?? [] }),
    members,
    events,
    entries,
    lotteries,
  };

  const parkingButtonWithoutLottery = Object.values(events)
    .filter((e) => e.parking.mode === "none" && calendarEvents.some((c) => c.id === e.legacy.calendarId && c.parking === true))
    .map((e) => ({ date: e.date, title: e.title }));

  return {
    tree,
    report: {
      counts: {
        members: memberIds.size,
        events: Object.keys(events).length,
        merged: pairs.length,
        calendarOnly: calendarOnly.length,
        parkingOnly: parkingOnly.length,
        entries: Object.values(entries).reduce((n, e) => n + Object.keys(e).length, 0),
        lotteries: Object.keys(lotteries).length,
        droppedEntries,
        skippedLotteries,
      },
      merged,
      ambiguous,
      parkingButtonWithoutLottery,
      warnings,
    },
  };
}
