import { describe, expect, it } from "vitest";
import { accountEmail, parseGrade, roleOf } from "../../src/lib/grade.ts";
import { parseRoute, routeToHash, tabOf } from "../../src/lib/route.ts";
import {
  addDays, dayLabel, jstDate, jstToday, localInputToMs, monthShape, msToLocalInput, relativeDay, shiftMonth, timeLeft,
} from "../../src/lib/datetime.ts";
import { asArray, toEvent, toLottery } from "../../src/lib/normalize.ts";

describe("学年（?grade=）", () => {
  it("省略・不正な値は4年生", () => {
    expect(parseGrade("")).toBe("g4");
    expect(parseGrade("?grade=g9")).toBe("g4");
    expect(parseGrade("?nocache=20260520")).toBe("g4");
    expect(parseGrade("?grade=g5")).toBe("g5");
  });
  it("合言葉用アカウントと役割の対応", () => {
    expect(accountEmail("g4", "coach")).toBe("g4-coach@soccer-parking.firebaseapp.com");
    expect(roleOf("g4-parent@soccer-parking.firebaseapp.com", "g4")).toBe("parent");
    expect(roleOf("g4-coach@soccer-parking.firebaseapp.com", "g4")).toBe("coach");
    expect(roleOf("g5-coach@soccer-parking.firebaseapp.com", "g4")).toBeNull();
    expect(roleOf(null, "g4")).toBeNull();
  });
});

describe("画面の切り替え（#）", () => {
  it("3タブと詳細のURL", () => {
    expect(parseRoute("#home")).toEqual({ name: "home" });
    expect(parseRoute("#parking")).toEqual({ name: "parking" });
    expect(parseRoute("#tournaments")).toEqual({ name: "tournaments" });
    expect(parseRoute("#event/initial-20261024-06")).toEqual({ name: "event", id: "initial-20261024-06" });
    expect(parseRoute("#tournament/t1")).toEqual({ name: "home" });
  });
  it("空・不明・不正なIDは予定タブ", () => {
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("#unknown")).toEqual({ name: "home" });
    expect(parseRoute("#event/<script>")).toEqual({ name: "home" });
  });
  it("URLへの書き戻しと、詳細を開いたときのタブ", () => {
    expect(routeToHash({ name: "event", id: "abc", from: "parking" })).toBe("#event/abc");
    expect(tabOf({ name: "event", id: "abc", from: "parking" })).toBe("parking");
    expect(tabOf({ name: "event", id: "abc" })).toBe("home");
    expect(tabOf({ name: "event", id: "t", from: "tournaments" })).toBe("tournaments");
  });
  it("予定の中の駐車場・要項（LINEから直接開ける）", () => {
    expect(parseRoute("#event/abc/parking")).toEqual({ name: "event", id: "abc", section: "parking" });
    expect(parseRoute("#event/abc/docs")).toEqual({ name: "event", id: "abc", section: "docs" });
    expect(parseRoute("#event/abc/other")).toEqual({ name: "event", id: "abc" });
    expect(routeToHash({ name: "event", id: "abc", section: "parking" })).toBe("#event/abc/parking");
    expect(routeToHash({ name: "event", id: "abc", section: "info" })).toBe("#event/abc");
    expect(tabOf({ name: "event", id: "abc", section: "parking" })).toBe("parking");
    expect(tabOf({ name: "event", id: "abc", section: "docs" })).toBe("tournaments");
    expect(tabOf({ name: "event", id: "abc", section: "docs", from: "home" })).toBe("home");
  });
});

describe("日付（日本時間）", () => {
  // 2026-11-01 00:30 JST = 2026-10-31 15:30 UTC
  const justAfterMidnight = Date.parse("2026-10-31T15:30:00Z");
  it("UTCではまだ前日でも、日本時間の日付になる", () => {
    expect(jstToday(justAfterMidnight)).toBe("2026-11-01");
    expect(jstDate(justAfterMidnight)).toBe("2026-11-01");
  });
  it("曜日つきの表示と相対表示", () => {
    expect(dayLabel("2026-11-01")).toBe("11/1(日)");
    expect(dayLabel("2026-11-08")).toBe("11/8(日)");
    expect(relativeDay("2026-11-02", "2026-11-01")).toBe("明日");
    expect(relativeDay("2026-11-11", "2026-11-01")).toBe("10日後");
    expect(relativeDay("2026-10-31", "2026-11-01")).toBe("1日前");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("締切の入力値（JST）とミリ秒の相互変換", () => {
    const ms = localInputToMs("2026-11-06T20:00");
    expect(ms).toBe(Date.parse("2026-11-06T11:00:00Z"));
    expect(msToLocalInput(ms!)).toBe("2026-11-06T20:00");
    expect(localInputToMs("2026-11-06")).toBeNull();
  });
  it("締切までの残り時間", () => {
    const now = Date.parse("2026-11-01T00:00:00Z");
    expect(timeLeft(now - 1, now)).toBeNull();
    expect(timeLeft(now + 5 * 60_000, now)).toBe("あと5分");
    expect(timeLeft(now + 3 * 3_600_000 + 15 * 60_000, now)).toBe("あと3時間15分");
    expect(timeLeft(now + 3 * 86_400_000, now)).toBe("あと3日");
  });
  it("月カレンダーの形", () => {
    expect(monthShape("2026-11")).toEqual({ offset: 0, days: 30 });
    expect(monthShape("2027-02")).toEqual({ offset: 1, days: 28 });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("読み込んだデータの補正", () => {
  it("RTDB の {0:…} 形式の配列を配列に戻す", () => {
    expect(asArray({ 0: "a", 1: "b" })).toEqual(["a", "b"]);
    expect(asArray(undefined)).toEqual([]);
  });
  it("欠けた項目を補い、安全でない資料URLは捨てる", () => {
    const e = toEvent("x", {
      date: "2026-11-08", kind: "party", title: "", start: "9:00",
      attachments: { a: { label: "要項", type: "pdf", url: "javascript:alert(1)" }, b: { label: "表", type: "image", url: "https://example.com/a.jpg", order: 1 } },
    });
    expect(e.kind).toBe("practice");
    expect(e.title).toBe("（予定名なし）");
    expect(e.start).toBeNull();
    expect(e.parking).toEqual({ mode: "none", limit: 0, deadlineAt: null, confirmed: [] });
    expect(e.attachments.map((a) => a.id)).toEqual(["b"]);
  });
  it("抽選結果の補正", () => {
    const l = toLottery({ winners: { 0: "m1" }, rounds: [{ winners: ["m1"], reason: "???" }] });
    expect(l.winners).toEqual(["m1"]);
    expect(l.rounds[0]).toMatchObject({ round: 1, reason: "initial" });
  });
});
