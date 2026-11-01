// 移行ドライラン：既存データを読み取り、新スキーマのJSONと報告書を作る。本番DBへは書き込まない。
//   node scripts/migrate.ts [--calendar <カレンダーのバックアップJSON>] [--out <出力先>]
// 出力の mss-g4.json と source-*.json には名簿（子どもの名前）が入るため、リポジトリに入れないこと。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTree, type CalendarEvent } from "./lib/migrate-core.ts";

const here = dirname(fileURLToPath(import.meta.url));
const LEGACY_URL = "https://soccer-parking-default-rtdb.asia-southeast1.firebasedatabase.app/pro/teams/LEGACY";
const DEFAULT_SEED = "C:/Users/USER/.codex/visualizations/2026/10/24/01a16e2d-3c8e-73e1-a387-5354613639c1/mss-calendar/lib/server/seed.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function readLegacy(part: string): Promise<unknown> {
  const res = await fetch(`${LEGACY_URL}/${part}.json`);
  if (!res.ok) throw new Error(`${part} の読み取りに失敗しました（HTTP ${res.status}）`);
  return res.json();
}

function readCalendar(): { events: CalendarEvent[]; source: string } {
  const file = arg("calendar");
  if (file) {
    const backup = JSON.parse(readFileSync(file, "utf8"));
    if (backup?.format !== "mss-calendar-v1" || !Array.isArray(backup.events)) throw new Error("カレンダーのバックアップJSONの形式が違います");
    return { events: backup.events, source: `カレンダーのバックアップJSON（${backup.exportedAt ?? "日時不明"}）` };
  }
  const seed = readFileSync(arg("calendar-seed") ?? DEFAULT_SEED, "utf8");
  const events = JSON.parse(seed.slice(seed.indexOf("["), seed.lastIndexOf("]") + 1));
  return { events, source: "カレンダーの初期データ（2026-10-24 取込時点の seed.ts。コーチによるその後の修正は含まない）" };
}

const out = resolve(arg("out") ?? resolve(here, "../../work/migration"));
mkdirSync(out, { recursive: true });
const now = Date.now();
const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");

const [roster, parkingEvents, responses, lotteries, meta] = await Promise.all(
  ["roster", "events", "responses", "lotteries", "meta"].map(readLegacy),
);
writeFileSync(resolve(out, `source-legacy-${stamp}.json`), JSON.stringify({ roster, events: parkingEvents, responses, lotteries, meta }, null, 2));

const calendar = readCalendar();
const uniformColors = Array.isArray((meta as { settings?: { uniformOptions?: unknown } })?.settings?.uniformOptions)
  ? ((meta as { settings: { uniformOptions: string[] } }).settings.uniformOptions)
  : undefined;
const { tree, report } = buildTree({ roster, parkingEvents, responses, lotteries, calendarEvents: calendar.events, uniformColors, now });
writeFileSync(resolve(out, "mss-g4.json"), JSON.stringify(tree, null, 2));

const count = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).length : v && typeof v === "object" ? Object.keys(v).length : 0);
const responseTotal = Object.values((responses ?? {}) as Record<string, object>).reduce((n, r) => n + count(r), 0);
const c = report.counts;
const lines = [
  "# 移行ドライラン報告（4年生）",
  "",
  `- 実行日時：${new Date(now).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
  "- 本番DBへの書込み：なし（読み取りのみ）",
  "",
  "## 入力",
  `- 駐車場抽選PRO（LEGACY／MSS香澄U10）：名簿 ${count(roster)}人、試合 ${count(parkingEvents)}件、回答 ${responseTotal}件（${count(responses)}試合分）、抽選 ${count(lotteries)}件`,
  `- カレンダー：${calendar.source}、${calendar.events.length}件`,
  "",
  "## 出力（/mss/g4）",
  `- 名簿 ${c.members}人`,
  `- 予定 ${c.events}件（統合 ${c.merged}／カレンダーのみ ${c.calendarOnly}／駐車場のみ ${c.parkingOnly}）`,
  `- エントリー ${c.entries}件、抽選結果 ${c.lotteries}件`,
  "",
  "## 統合した予定（同じ日の試合）",
  "| 日付 | カレンダーの予定名 | 駐車場の予定名 | 統合後の予定名 |",
  "|---|---|---|---|",
  ...report.merged.map((m) => `| ${m.date} | ${m.calendarTitle} | ${m.parkingTitle} | ${m.title} |`),
  "",
  "## 要確認",
  report.parkingButtonWithoutLottery.length
    ? `- カレンダーで「駐車場ボタンを表示」になっているが、抽選の台数・締切がない予定（${report.parkingButtonWithoutLottery.length}件。新アプリで抽選ありにする場合はコーチが設定）：\n${report.parkingButtonWithoutLottery.map((e) => `  - ${e.date} ${e.title}`).join("\n")}`
    : "- 駐車場ボタンありで抽選設定のない予定：なし",
  report.ambiguous.length ? `- 同じ日に候補が複数あり、統合せず別々に残した予定：\n${report.ambiguous.map((x) => `  - ${x}`).join("\n")}` : "- 統合の判定に迷った予定：なし",
  `- 移行しなかった回答：${c.droppedEntries}件（名簿にいない・予定が見つからない）`,
  `- 移行しなかった抽選：${c.skippedLotteries}件（未実施など）`,
  ...report.warnings.map((w) => `- ${w}`),
  "",
];
writeFileSync(resolve(out, "migration-report.md"), lines.join("\n"));
writeFileSync(resolve(out, "migration-report.json"), JSON.stringify({ at: now, calendarSource: calendar.source, ...report }, null, 2));
console.log(lines.join("\n"));
console.log(`\n出力先: ${out}`);
