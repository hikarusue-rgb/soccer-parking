// 駐車場抽選のロジック（完全ランダム）。画面から切り離した純粋関数だけを置く。
// あみだくじは横線の入り方によって列ごとの当たりやすさに偏りが出るため、
// 参加者の並び順を毎回ランダムにしてから線を引く。これで全員の当選確率が等しくなる。
import { applicantsOf } from "./parking";
import type { Entry, Lottery, LotteryReason, TeamEvent } from "./types";

export type Random = () => number;

/** 偏りのない乱数（0以上1未満）。使えない環境では Math.random */
export const secureRandom: Random = () => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
};

export function shuffle<T>(items: T[], random: Random = secureRandom): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** あみだくじ：order[i] が i 列目から出発し、results[i] の列に着く。着いた列が当たり枠（左から slots 本）なら当選 */
export interface Ladder {
  order: string[];
  rows: number;
  /** 各段の横線（左側の列番号）。隣り合う横線は引かない */
  rungs: number[][];
  slots: number;
}

export function buildLadder(participants: string[], slots: number, random: Random = secureRandom, rows = 14): Ladder {
  const order = shuffle(participants, random);
  const n = order.length;
  const rungs = Array.from({ length: rows }, () => {
    const row: number[] = [];
    for (let c = 0; c < n - 1; c++) {
      if (random() < 0.42) {
        row.push(c);
        c++;
      }
    }
    return row;
  });
  return { order, rows, rungs, slots: Math.max(0, Math.min(slots, n)) };
}

/** 各列の到着列 */
export function ladderResults(ladder: Ladder): number[] {
  return ladder.order.map((_, start) => {
    let col = start;
    for (const row of ladder.rungs) {
      if (row.includes(col)) col++;
      else if (row.includes(col - 1)) col--;
    }
    return col;
  });
}

export function ladderWinners(ladder: Ladder): string[] {
  const results = ladderResults(ladder);
  return ladder.order.filter((_, i) => results[i] < ladder.slots);
}

/** 抽選の対象になる台数（上限 − 確定枠） */
export function lotterySlots(e: TeamEvent): number {
  return Math.max(0, e.parking.limit - e.parking.confirmed.length);
}

const wantsParking = (entries: Record<string, Entry> | undefined, id: string) => Boolean(entries?.[id]?.attending && entries[id].parkingNeeded);

/** 抽選後の状況：辞退した当選者、残っている当選者、追加抽選の候補 */
export function lotteryState(e: TeamEvent, entries: Record<string, Entry> | undefined, lottery: Lottery) {
  const slots = lotterySlots(e);
  const dropouts = lottery.winners.filter((id) => !wantsParking(entries, id));
  const effective = lottery.winners.filter((id) => wantsParking(entries, id));
  const winners = new Set(lottery.winners);
  // 抽選に外れた人と、抽選後に車出し希望を出した人（締切前のみ可能）が追加抽選の候補
  const candidates = applicantsOf(e, entries).filter((id) => !winners.has(id));
  return {
    slots,
    dropouts,
    effective,
    candidates,
    openSlots: Math.max(0, slots - effective.length),
    overflow: Math.max(0, effective.length - slots),
  };
}

export interface DrawPlan {
  reason: LotteryReason;
  participants: string[];
  slots: number;
  /** 抽選しなくても当選が決まる人（再抽選で残る当選者など） */
  keep: string[];
}

/** いま実行できる抽選（なければ null） */
export function nextDraw(e: TeamEvent, entries: Record<string, Entry> | undefined, lottery: Lottery | undefined): DrawPlan | null {
  if (e.parking.mode !== "lottery") return null;
  if (!lottery) {
    const participants = applicantsOf(e, entries);
    return participants.length ? { reason: "initial", participants, slots: lotterySlots(e), keep: [] } : null;
  }
  const s = lotteryState(e, entries, lottery);
  if (s.overflow > 0) return { reason: "limit_down", participants: s.effective, slots: s.slots, keep: [] };
  if (s.openSlots > 0 && s.candidates.length) {
    return { reason: s.dropouts.length ? "cancel" : "limit_up", participants: s.candidates, slots: s.openSlots, keep: s.effective };
  }
  return null;
}

/** 抽選を実行して保存用の結果を作る（希望者が枠以下なら全員当選。あみだくじは演出と記録のために作る） */
export function runDraw(plan: DrawPlan, previous: Lottery | undefined, now: number, random: Random = secureRandom): { lottery: Omit<Lottery, "updatedAt">; ladder: Ladder } {
  const ladder = buildLadder(plan.participants, plan.slots, random);
  const drawn = ladderWinners(ladder);
  const winners = plan.reason === "limit_down" ? drawn : [...plan.keep, ...drawn];
  const round = (previous?.rounds.length ?? 0) + 1;
  const participants = [...new Set([...(previous?.participants ?? []), ...plan.participants])];
  return {
    ladder,
    lottery: {
      status: "drawn",
      policy: "random",
      // 抽選枠の合計（追加抽選では、残っている当選者の分を足す）
      slots: plan.reason === "limit_down" ? plan.slots : plan.keep.length + plan.slots,
      participants,
      winners,
      rounds: [...(previous?.rounds ?? []), { round, at: now, reason: plan.reason, participants: plan.participants, winners: drawn }],
      conductedAt: previous?.conductedAt ?? now,
    },
  };
}
