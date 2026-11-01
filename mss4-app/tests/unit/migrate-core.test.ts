import { describe, expect, it } from "vitest";
import {
  CALENDAR_IMPORT_NOTE, buildTree, convertCalendarEvent, convertEntries, convertLottery, convertParkingEvent,
  localToMs, matchEvents, mergeEvent, type CalendarEvent, type LegacyParkingEvent,
} from "../../scripts/lib/migrate-core.ts";

const NOW = Date.parse("2026-11-01T09:00:00Z");
const parkingEvent: LegacyParkingEvent = {
  id: "um36y6a", title: "プレミアリーグ vsなのはなFC", matchDate: "2026-10-17T09:00", deadline: "2026-10-15T17:00",
  parkingLimit: 5, confirmedParking: ["m9"], location: "さつきが丘西小学校", meetTime: "08:00", endTime: "11:30",
  notes: "サブ、ビブス持参", uniformTop: "緑", uniformBottom: "緑", uniformSocks: "緑",
};
const calendarEvent: CalendarEvent = {
  id: "initial-20261024-06", date: "2026-10-17", kind: "match", title: "プレミアリーグ", grades: ["4年生"],
  start: "08:00", end: "11:30", meeting: null, venue: "さつきが丘西小", equipment: [], equipmentConfirmed: false,
  messages: [], note: CALENDAR_IMPORT_NOTE, status: "unconfirmed", parking: true,
};

describe("駐車場PROの試合の変換", () => {
  it("締切は日本時間として扱う", () => {
    expect(localToMs("2026-10-15T17:00")).toBe(Date.parse("2026-10-15T08:00:00Z"));
    expect(localToMs("")).toBeUndefined();
  });
  it("試合日時の時刻をキックオフに、締切・台数・確定枠を駐車場設定に移す", () => {
    const { id, event } = convertParkingEvent(parkingEvent, NOW)!;
    expect(id).toBe("um36y6a");
    expect(event).toMatchObject({
      date: "2026-10-17", kind: "match", kickoff: "09:00", meeting: "08:00", end: "11:30",
      venue: "さつきが丘西小学校", uniform: { top: "緑", bottom: "緑", socks: "緑" },
      parking: { mode: "lottery", limit: 5, deadlineAt: Date.parse("2026-10-15T08:00:00Z"), confirmed: ["m9"] },
      legacy: { parkingEventId: "um36y6a" },
    });
    expect(event.start).toBeUndefined();
  });
  it("日付やIDが不正な試合は変換しない", () => {
    expect(convertParkingEvent({ id: "x", matchDate: "" }, NOW)).toBeNull();
    expect(convertParkingEvent({ id: "a/b", matchDate: "2026-10-17T09:00" }, NOW)).toBeNull();
  });
});

describe("カレンダーとの統合", () => {
  it("同じ日の試合を組にし、別の日は組にしない", () => {
    const other: LegacyParkingEvent = { id: "p2", matchDate: "2026-07-05T14:15", title: "ブロックリーグ" };
    const r = matchEvents([calendarEvent], [parkingEvent, other]);
    expect(r.pairs).toHaveLength(1);
    expect(r.parkingOnly.map((p) => p.id)).toEqual(["p2"]);
    expect(r.calendarOnly).toHaveLength(0);
  });
  it("同じ日に候補が複数あり決められないときは統合しない", () => {
    const a = { ...calendarEvent, id: "c1", title: "TM" };
    const b = { ...calendarEvent, id: "c2", title: "TM" };
    const r = matchEvents([a, b], [{ id: "p", matchDate: "2026-10-17T15:00", title: "練習試合" }]);
    expect(r.pairs).toHaveLength(0);
    expect(r.ambiguous).toHaveLength(1);
  });
  it("空欄だけを駐車場側で埋め、予定名と会場は駐車場側を使う", () => {
    const merged = mergeEvent(convertCalendarEvent(calendarEvent, NOW)!.event, convertParkingEvent(parkingEvent, NOW)!.event);
    expect(merged).toMatchObject({
      title: "プレミアリーグ vsなのはなFC", start: "08:00", end: "11:30", meeting: "08:00", kickoff: "09:00",
      venue: "さつきが丘西小学校", status: "unconfirmed", parking: { mode: "lottery", limit: 5 },
      legacy: { calendarId: "initial-20261024-06", parkingEventId: "um36y6a" },
    });
    // 駐車場側に集合時刻などがあるので「確認待ち」の定型文は外す
    expect(merged.note).toBe("サブ、ビブス持参");
  });
});

describe("回答・抽選の変換", () => {
  it("名簿にいない子の回答は除き、欠席なのに車出し希望は不要に直す", () => {
    const { entries, dropped } = convertEntries(
      { m1: { attending: false, parkingNeeded: true, carpoolCapacity: 2, at: 1 }, ghost: { attending: true } },
      new Set(["m1"]),
    );
    expect(dropped).toBe(1);
    expect(entries.m1).toEqual({ attending: false, parkingNeeded: false, carpoolCapacity: 2, at: 1 });
  });
  it("名前で記録された当選者をIDに直し、台数減の再抽選を limit_down にする", () => {
    const { event } = convertParkingEvent(parkingEvent, NOW)!;
    const lottery = convertLottery(
      {
        conducted: true, conductedAt: 100, winners: ["m1", "テスト太郎"], allParticipants: ["m1", "m2", "テスト太郎"],
        history: [{ round: 1, winners: ["m1"], at: 100 }, { round: 2, winners: ["m1"], at: 200, reason: "limit_decrease" }],
        lastLimitChangeAt: 200,
      },
      event,
      (v) => ({ m1: "m1", m2: "m2", テスト太郎: "m3" } as Record<string, string>)[v] ?? null,
    )!;
    expect(lottery.winners).toEqual(["m1", "m3"]);
    expect(lottery.participants).toEqual(["m1", "m2", "m3"]);
    expect(lottery.slots).toBe(4);
    expect(lottery.rounds.map((r) => r.reason)).toEqual(["initial", "limit_down"]);
    expect(lottery.updatedAt).toBe(200);
  });
  it("未実施の抽選は移行しない", () => {
    const { event } = convertParkingEvent(parkingEvent, NOW)!;
    expect(convertLottery({ conducted: false }, event, () => null)).toBeNull();
  });
});

describe("全体の組み立て", () => {
  it("統合した予定に回答・抽選を付け替える", () => {
    const { tree, report } = buildTree({
      roster: [{ id: "m1", num: 4, name: "テスト", grade: "4年" }],
      parkingEvents: [parkingEvent],
      responses: { um36y6a: { m1: { attending: true, parkingNeeded: true, carpoolCapacity: 1, at: 5 } } },
      lotteries: { um36y6a: { conducted: true, conductedAt: 9, winners: ["m1"], allParticipants: ["m1"] } },
      calendarEvents: [calendarEvent],
      now: NOW,
    });
    expect(Object.keys(tree.events)).toEqual(["initial-20261024-06"]);
    expect(tree.entries["initial-20261024-06"].m1.parkingNeeded).toBe(true);
    expect(tree.lotteries["initial-20261024-06"].winners).toEqual(["m1"]);
    expect(report.counts).toMatchObject({ members: 1, events: 1, merged: 1, entries: 1, lotteries: 1 });
  });
});
