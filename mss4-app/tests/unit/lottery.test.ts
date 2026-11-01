import { describe, expect, it } from "vitest";
import {
  buildLadder, cumulativeStats, ladderResults, ladderWinners, lotteryState, nextDraw, runDraw, seasonStartDate, shuffle,
} from "../../src/lib/lottery.ts";
import { toEvent, toMember } from "../../src/lib/normalize.ts";
import type { Entry, Lottery } from "../../src/lib/types.ts";

/** 再現できる乱数（テスト用） */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const event = toEvent("ev", { date: "2026-11-07", kind: "match", title: "TM", parking: { mode: "lottery", limit: 3, confirmed: ["c"] } });
const want = (ids: string[]): Record<string, Entry> =>
  Object.fromEntries(ids.map((id) => [id, { attending: true, parkingNeeded: true, carpoolCapacity: 0, at: 1 }]));

describe("あみだくじ", () => {
  it("到着列は重複しない（全員がちょうど1つの列に着く）", () => {
    const ladder = buildLadder(["a", "b", "c", "d", "e", "f"], 2, seeded(1));
    expect([...ladderResults(ladder)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ladderWinners(ladder)).toHaveLength(2);
  });
  it("並び順をランダムにするので、全員の当選確率が等しい（2万回）", () => {
    const random = seeded(42);
    const people = ["a", "b", "c", "d", "e"];
    const wins = Object.fromEntries(people.map((p) => [p, 0]));
    const trials = 20_000;
    for (let i = 0; i < trials; i++) for (const w of ladderWinners(buildLadder(people, 2, random))) wins[w]++;
    for (const p of people) expect(wins[p] / trials).toBeGreaterThan(0.38);
    for (const p of people) expect(wins[p] / trials).toBeLessThan(0.42);
  });
  it("シャッフルは要素を失わない", () => {
    expect(shuffle([1, 2, 3, 4], seeded(3)).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("抽選の流れ", () => {
  it("初回：確定枠を除いた枠で、確定枠以外の希望者が対象", () => {
    const plan = nextDraw(event, want(["a", "b", "c", "d"]), undefined)!;
    expect(plan).toMatchObject({ reason: "initial", slots: 2, keep: [] });
    expect(plan.participants.sort()).toEqual(["a", "b", "d"]);
    const { lottery } = runDraw(plan, undefined, 100, seeded(5));
    expect(lottery.winners).toHaveLength(2);
    expect(lottery.slots).toBe(2);
    expect(lottery.rounds[0]).toMatchObject({ round: 1, reason: "initial", at: 100 });
  });
  it("希望が枠以内なら全員当選", () => {
    const plan = nextDraw(event, want(["a"]), undefined)!;
    expect(runDraw(plan, undefined, 1, seeded(1)).lottery.winners).toEqual(["a"]);
  });
  it("当選者が辞退したら、落選者から追加抽選（残った当選者はそのまま）", () => {
    const lottery: Lottery = { status: "drawn", policy: "random", slots: 2, participants: ["a", "b", "d"], winners: ["a", "b"], rounds: [{ round: 1, at: 1, reason: "initial", participants: ["a", "b", "d"], winners: ["a", "b"] }], conductedAt: 1, updatedAt: 1 };
    const entries = { ...want(["a", "d"]), b: { attending: true, parkingNeeded: false, carpoolCapacity: 0, at: 2 } };
    expect(lotteryState(event, entries, lottery)).toMatchObject({ dropouts: ["b"], effective: ["a"], openSlots: 1, candidates: ["d"] });
    const plan = nextDraw(event, entries, lottery)!;
    expect(plan).toMatchObject({ reason: "cancel", slots: 1, participants: ["d"], keep: ["a"] });
    const next = runDraw(plan, lottery, 5, seeded(1)).lottery;
    expect(next.winners).toEqual(["a", "d"]);
    expect(next.slots).toBe(2);
    expect(next.rounds.map((r) => r.reason)).toEqual(["initial", "cancel"]);
  });
  it("台数が減ったら、当選者の中から再抽選", () => {
    const fewer = toEvent("ev", { date: "2026-11-07", kind: "match", title: "TM", parking: { mode: "lottery", limit: 2, confirmed: ["c"] } });
    const lottery: Lottery = { status: "drawn", policy: "random", slots: 2, participants: ["a", "b"], winners: ["a", "b"], rounds: [], conductedAt: 1, updatedAt: 1 };
    const plan = nextDraw(fewer, want(["a", "b"]), lottery)!;
    expect(plan).toMatchObject({ reason: "limit_down", slots: 1 });
    expect(runDraw(plan, lottery, 5, seeded(2)).lottery.winners).toHaveLength(1);
  });
  it("やることがなければ null", () => {
    const lottery: Lottery = { status: "drawn", policy: "random", slots: 2, participants: ["a", "b"], winners: ["a", "b"], rounds: [], conductedAt: 1, updatedAt: 1 };
    expect(nextDraw(event, want(["a", "b"]), lottery)).toBeNull();
    expect(nextDraw(event, {}, undefined)).toBeNull();
  });
});

describe("年度の累計", () => {
  it("年度は4/1始まり", () => {
    expect(seasonStartDate("2026-11-01")).toBe("2026-04-01");
    expect(seasonStartDate("2027-03-31")).toBe("2026-04-01");
    expect(seasonStartDate("2027-04-01")).toBe("2027-04-01");
  });
  it("応募・当選・落選・確定枠を数え、年度外は数えない", () => {
    const e1 = toEvent("e1", { date: "2026-06-01", parking: { mode: "lottery", limit: 2, confirmed: ["c"] } });
    const e2 = toEvent("e2", { date: "2026-03-01", parking: { mode: "lottery", limit: 2 } });
    const lotteries: Record<string, Lottery> = {
      e1: { status: "drawn", policy: "random", slots: 1, participants: ["a", "b"], winners: ["a"], rounds: [], conductedAt: 1, updatedAt: 1 },
      e2: { status: "drawn", policy: "random", slots: 1, participants: ["a"], winners: ["a"], rounds: [], conductedAt: 1, updatedAt: 1 },
    };
    const members = ["a", "b", "c"].map((id) => toMember(id, { num: 1, name: id }));
    const stats = cumulativeStats([e1, e2], lotteries, members, "2026-04-01", "2026-11-01");
    expect(stats.get("a")).toEqual({ applied: 1, won: 1, lost: 0, confirmed: 0 });
    expect(stats.get("b")).toEqual({ applied: 1, won: 0, lost: 1, confirmed: 0 });
    expect(stats.get("c")).toEqual({ applied: 0, won: 0, lost: 0, confirmed: 1 });
  });
});
