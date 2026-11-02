// 「新しい更新」の中身：前回見た版からの変更を、ひと目で分かる短い言葉にする
import { useEffect, useState } from "react";
import { loadHistory, type Difference, type HistoryItem } from "./changes";
import type { GradeCode } from "./grade";

export interface UpdateSummary {
  /** 新しく追加された予定 */
  added: boolean;
  /** 前回見た版からの変更（項目ごとに、最初の変更前と最新の変更後） */
  changes: Difference[];
  /** カードに出す短い言葉（例：⏰ 集合 8:00→8:30、🚗 駐車場の抽選が始まりました） */
  phrases: { text: string; tone: "red" | "amber" | "blue" | "green" | "plain" }[];
}

const SHORT = new Set(["日付", "開始時刻", "終了時刻", "集合時刻", "キックオフ", "場所", "対戦相手", "開催状況", "予定名", "種別"]);
const ICON: Record<string, string> = {
  日付: "📅", 開始時刻: "⏰", 終了時刻: "⏰", 集合時刻: "⏰", キックオフ: "⏰", 場所: "📍", 対戦相手: "🆚", 予定名: "✏️", 種別: "🏷",
  ユニフォーム: "👕", 持ち物: "🎒", チームからの連絡: "📝", 補足: "📝",
};
const NAME: Record<string, string> = { 開始時刻: "開始", 終了時刻: "終了", 集合時刻: "集合" };

/** 版 since より新しい履歴をまとめる（items は新しい順） */
export function summarize(items: HistoryItem[], since: number): UpdateSummary {
  const fresh = items.filter((h) => h.version > since);
  const added = fresh.some((h) => h.type === "added");
  const merged = new Map<string, Difference>();
  // 古い順にたどり、変更前は最初のもの・変更後は最新のものを残す
  for (const h of [...fresh].reverse()) {
    for (const c of h.changes) {
      const prev = merged.get(c.label);
      merged.set(c.label, { label: c.label, before: prev ? prev.before : c.before, after: c.after });
    }
  }
  const changes = [...merged.values()].filter((c) => c.before !== c.after);
  const phrases: UpdateSummary["phrases"] = [];
  if (added) phrases.push({ text: "🆕 新しい予定", tone: "green" });
  let docs = false;
  for (const c of changes) {
    if (c.label === "開催状況") {
      const stop = /中止|延期/.test(c.after);
      phrases.push({ text: `${stop ? "☔" : "📣"} ${c.after}`, tone: stop ? "red" : "amber" });
    } else if (c.label === "駐車場") {
      phrases.push(
        c.before === "抽選なし"
          ? { text: "🚗 駐車場の受付が始まりました", tone: "green" }
          : c.after === "抽選なし"
            ? { text: "🚗 駐車場の抽選はなくなりました", tone: "amber" }
            : { text: "🚗 駐車場の条件が変わりました", tone: "amber" },
      );
    } else if (["当日資料", "試合形式", "審判割当", "会場・駐車の注意事項"].includes(c.label)) {
      if (docs) continue;
      docs = true;
      phrases.push({ text: c.label === "当日資料" && c.before === "なし" ? "📄 要項・資料が届きました" : "📄 要項が更新されました", tone: "blue" });
    } else if (SHORT.has(c.label) && c.after.length <= 16 && c.before.length <= 16) {
      phrases.push({ text: `${ICON[c.label] ?? "•"} ${NAME[c.label] ?? c.label} ${c.before}→${c.after}`, tone: "amber" });
    } else {
      phrases.push({ text: `${ICON[c.label] ?? "•"} ${c.label}が変わりました`, tone: "plain" });
    }
  }
  return { added, changes, phrases };
}

const cache = new Map<string, HistoryItem[]>();

/** 予定ごとの変更履歴を読み込む（同じ版は1回だけ） */
export function useHistories(grade: GradeCode, targets: { id: string; version: number }[]) {
  const [, setTick] = useState(0);
  const key = targets.map((t) => `${t.id}@${t.version}`).join(",");
  useEffect(() => {
    let alive = true;
    for (const t of targets) {
      const k = `${t.id}@${t.version}`;
      if (cache.has(k)) continue;
      loadHistory(grade, t.id)
        .then((items) => { cache.set(k, items); if (alive) setTick((n) => n + 1); })
        .catch(() => { cache.set(k, []); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, key]);
  return (id: string, version: number) => cache.get(`${id}@${version}`) ?? null;
}
