import { describe, expect, it } from "vitest";
import { autoDeadline, blankDraft, draftFromEvent, toStoredEvent, validateDraft } from "../../src/lib/eventForm.ts";
import { differences } from "../../src/lib/changes.ts";
import { createIcs } from "../../src/lib/ics.ts";
import { parseLineMessage } from "../../src/lib/lineParser.ts";
import { parkingSummary } from "../../src/lib/parking.ts";
import { toEvent } from "../../src/lib/normalize.ts";

const base = toEvent("ev1", {
  date: "2026-11-07", kind: "match", title: "TM", status: "scheduled", start: "12:00", end: "17:00",
  venue: "第一カッターフィールド", version: 3, updatedAt: 1, legacy: { calendarId: "initial-20261024-13" },
  parking: { mode: "lottery", limit: 3, deadlineAt: Date.parse("2026-11-05T08:00:00Z"), confirmed: ["m9"] },
});

describe("編集フォーム", () => {
  it("締切の自動設定は試合の2日前17:00", () => {
    expect(autoDeadline("2026-11-07")).toBe("2026-11-05T17:00");
    expect(autoDeadline("2026-03-01")).toBe("2026-02-27T17:00");
    expect(autoDeadline("")).toBe("");
  });
  it("時刻の前後関係・台数・抽選外枠を検査する", () => {
    const d = { ...blankDraft("2026-11-07"), start: "12:00", end: "11:00", meeting: "10:00", kickoff: "09:30" };
    expect(validateDraft(d)).toEqual(expect.arrayContaining([
      "終了は開始より後の時刻にしてください。",
      "集合はキックオフ・開始より前の時刻にしてください。",
    ]));
    const lottery = { ...blankDraft("2026-11-07"), parkingMode: "lottery" as const, parkingLimit: 1, confirmed: ["a", "b"] };
    expect(validateDraft(lottery)).toContain("抽選外枠が合計台数を超えています。");
    expect(validateDraft({ ...blankDraft("2026-11-07"), parkingMode: "lottery" as const, parkingLimit: 3, reserved: 4 })).toContain("抽選外枠が合計台数を超えています。");
    expect(validateDraft({ ...blankDraft("2026-11-07"), parkingMode: "lottery" as const, parkingLimit: 5, reserved: 2 })).toEqual([]);
    expect(validateDraft(blankDraft("2026-11-07"))).toEqual([]);
  });
  it("保存形：版を1つ上げ、空欄は保存せず、値のない項目を含めない", () => {
    const stored = toStoredEvent(draftFromEvent(base));
    expect(stored.version).toBe(4);
    expect(stored).not.toHaveProperty("meeting");
    expect(stored).not.toHaveProperty("opponent");
    expect(stored.legacy).toEqual({ calendarId: "initial-20261024-13" });
    // 以前の確定枠（1名）は、抽選外枠1台として保存する
    expect(stored.parking).toEqual({ mode: "lottery", limit: 3, reserved: 1, deadlineAt: Date.parse("2026-11-05T08:00:00Z"), confirmed: ["m9"] });
    const noneDraft = { ...draftFromEvent(base), parkingMode: "none" as const };
    expect(toStoredEvent(noneDraft).parking).toEqual({ mode: "none", limit: 0 });
    const json = JSON.stringify(stored, (_k, v) => (v === undefined ? "__undefined__" : v));
    expect(json).not.toContain("__undefined__");
  });
  it("複製は新規扱い（版0・確定枠と資料は引き継がない）", () => {
    const dup = draftFromEvent(base, { duplicate: true });
    expect(dup).toMatchObject({ id: null, version: 0, confirmed: [], attachments: [], legacy: null, status: "scheduled" });
  });
});

describe("変更履歴の差分", () => {
  it("変わった項目だけを、表示用の文言で返す", () => {
    const diff = differences({ format: "", parking: "抽選なし", title: "TM" }, { format: "8人制", parking: "抽選あり・3台", title: "TM" });
    expect(diff).toEqual([
      { label: "試合形式", before: "なし", after: "8人制" },
      { label: "駐車場", before: "抽選なし", after: "抽選あり・3台" },
    ]);
  });
});

describe("LINEの文面の読み取り", () => {
  it("日付・大会名・会場・集合・キックオフ〜終了・ユニフォームを読み取る", () => {
    const text = "１１月７日（土）プレミアリーグ\n会場：袖ヶ浦東小\n集合 8:30\n9:30-12:00\nユニフォーム 上:黄 下:緑 靴下:黄\nよろしくお願いします";
    expect(parseLineMessage(text, "2026-11-01")).toEqual({
      date: "2026-11-07", title: "プレミアリーグ", venue: "袖ヶ浦東小", meeting: "08:30", kickoff: "09:30", end: "12:00",
      uniformTop: "黄", uniformBottom: "緑", uniformSocks: "黄",
    });
  });
  it("過ぎた日付は翌年、対戦相手から予定名を作る", () => {
    const r = parseLineMessage("1/10 vs 太陽FC 午後1時半集合", "2026-11-01");
    expect(r.date).toBe("2027-01-10");
    expect(r.opponent).toBe("太陽FC");
    expect(r.title).toBe("vs 太陽FC");
    expect(r.meeting).toBe("13:30");
  });
});

describe("カレンダー出力（.ics）", () => {
  it("日本時間の時刻をUTCで出し、中止は CANCELLED、時間未定は終日", () => {
    const canceled = toEvent("ev2", { date: "2026-11-08", kind: "practice", title: "トレーニング", status: "canceled", updatedAt: 1 });
    const ics = createIcs([base, canceled], "MSS・香澄 4年生", (e) => `https://example.com/#event/${e.id}`);
    expect(ics).toContain("DTSTART:20261107T030000Z");
    expect(ics).toContain("DTEND:20261107T080000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261108");
    expect(ics).toContain("STATUS:CANCELLED");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("駐車場の状態", () => {
  const entries = {
    m1: { attending: true, parkingNeeded: true, carpoolCapacity: 0, at: 1 },
    m2: { attending: true, parkingNeeded: false, carpoolCapacity: 0, at: 1 },
    m9: { attending: true, parkingNeeded: true, carpoolCapacity: 0, at: 1 },
  };
  it("受付中は（確定枠＋希望）/上限、締切後は抽選待ち、抽選後は配車確定", () => {
    const before = Date.parse("2026-11-01T00:00:00Z");
    const after = Date.parse("2026-11-06T00:00:00Z");
    expect(parkingSummary(base, entries, undefined, before)).toMatchObject({ phase: "open", label: "🚗 受付中 2/3台", applicants: ["m1"] });
    expect(parkingSummary(base, entries, undefined, after)?.phase).toBe("closed");
    const lottery = { status: "drawn" as const, policy: "random" as const, slots: 2, participants: ["m1"], winners: ["m1"], rounds: [], conductedAt: 1, updatedAt: 1 };
    expect(parkingSummary(base, entries, lottery, after)).toMatchObject({ phase: "drawn", label: "🚗 配車確定" });
    expect(parkingSummary(toEvent("x", { date: "2026-11-07" }), entries, undefined, before)).toBeNull();
  });
});

describe("抽選枠と抽選外枠", () => {
  it("抽選する台数は合計から抽選外枠を引いた数（以前の確定枠の人数も抽選外枠として数える）", async () => {
    const { lotterySlots, reservedOf } = await import("../../src/lib/lottery.ts");
    const ev = (parking: Record<string, unknown>) => ({ parking: { mode: "lottery", deadlineAt: null, confirmed: [], reserved: 0, ...parking } }) as never;
    expect(lotterySlots(ev({ limit: 5, reserved: 2 }))).toBe(3);
    expect(reservedOf(ev({ limit: 4, confirmed: ["a", "b"] }))).toBe(2);
    expect(lotterySlots(ev({ limit: 4, reserved: 1, confirmed: ["a", "b"] }))).toBe(2);
  });
});

describe("当番の方のLINE文面", () => {
  it("受付の案内：台数（抽選枠・抽選外枠）・締切・駐車場の画面へのリンク", async () => {
    const { announceText, reminderText, lineShareUrl } = await import("../../src/lib/lineText.ts");
    const e = { id: "e1", date: "2026-11-07", title: "TM", venue: "第一カッターフィールド", meeting: "11:30", kickoff: "", start: "12:00", end: "17:00",
      parking: { mode: "lottery", limit: 4, reserved: 1, confirmed: [], deadlineAt: Date.parse("2026-11-05T08:00:00Z") } } as never;
    const a = announceText(e, "https://x/#event/e1/parking");
    expect(a).toContain("🚗 駐車場 4台（抽選枠 3台・抽選外枠 1台（審判など））");
    expect(a).toContain("⏳ 回答締切：11/5(木) 17:00");
    expect(a).toContain("⏰ 集合 11:30 ／ 12:00〜17:00");
    expect(a.endsWith("https://x/#event/e1/parking")).toBe(true);
    const members = [{ id: "m1", num: 4, name: "はるか", active: true, order: 1 }, { id: "m2", num: 6, name: "えいた", active: true, order: 2 }] as never;
    const r = reminderText(e, members, { m1: { attending: true, parkingNeeded: true, carpoolCapacity: 0, at: 1 } } as never, "u");
    expect(r).toContain("📊 回答 1/2名・駐車場希望 1名");
    expect(r).toContain("#6 えいた");
    expect(lineShareUrl("あ b")).toBe("https://line.me/R/share?text=%E3%81%82%20b");
  });
});
