// ローカルのエミュレータに、テスト用アカウントと4年生のデータを入れる（本番には接続しない）。
//   1) npm run emulators   2) node scripts/seed-emulator.ts [--synthetic]
// 既定では移行ドライランの出力（../work/migration/mss-g4.json）を使う。--synthetic で架空のデータにする。
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT = "demo-mss4";
const AUTH = "http://127.0.0.1:9099";
const DB = "http://127.0.0.1:9000";
const NS = `${PROJECT}-default-rtdb`;
const DOMAIN = "soccer-parking.firebaseapp.com";

// ローカルのエミュレータ専用のテスト合言葉（本番の合言葉とは無関係）。閲覧は合言葉なしなので、コーチだけ
export const DEV_ACCOUNTS = {
  coach: { email: `g4-coach@${DOMAIN}`, passphrase: "dev-coach-g4" },
} as const;

async function call(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} → HTTP ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function createAccount(email: string, password: string): Promise<string> {
  const body = await call(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return body.localId as string;
}

function synthetic(now: number) {
  const day = (offset: number) => new Date(now + offset * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
  const names = ["あおい", "いぶき", "うた", "えいじ", "おうすけ", "かなた", "きいち", "くうが"];
  return {
    meta: { team: "MSS・香澄", gradeLabel: "4年生", schema: 1 },
    settings: { seasonStart: "04-01" },
    members: Object.fromEntries(names.map((name, i) => [`m${i + 1}`, { num: i + 3, name, active: true, order: i + 1 }])),
    events: {
      ev1: { date: day(1), kind: "practice", title: "トレーニング", status: "scheduled", start: "08:00", end: "10:30", venue: "香澄小", equipmentConfirmed: false, parking: { mode: "none", limit: 0 }, version: 1, createdAt: now, updatedAt: now, updatedBy: "コーチ", legacy: {} },
      ev2: { date: day(6), kind: "match", title: "プレミアリーグ vs テストFC", status: "scheduled", meeting: "08:00", kickoff: "09:00", end: "12:00", venue: "袖ヶ浦東小", equipmentConfirmed: false, parking: { mode: "lottery", limit: 3, deadlineAt: now + 4 * 86_400_000 }, version: 1, createdAt: now, updatedAt: now, updatedBy: "コーチ", legacy: {} },
    },
    entries: {},
    lotteries: {},
  };
}

const now = Date.now();
const migrated = resolve(here, "../../work/migration/mss-g4.json");
const useSynthetic = process.argv.includes("--synthetic") || !existsSync(migrated);
const tree = useSynthetic ? synthetic(now) : JSON.parse(readFileSync(migrated, "utf8"));

await call(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
const coachUid = await createAccount(DEV_ACCOUNTS.coach.email, DEV_ACCOUNTS.coach.passphrase);

const owner = { authorization: "Bearer owner", "content-type": "application/json" };
await call(`${DB}/.json?ns=${NS}`, { method: "DELETE", headers: owner });
await call(`${DB}/mss/g4.json?ns=${NS}`, { method: "PUT", headers: owner, body: JSON.stringify(tree) });
// コーチの登録は誰も読めない場所に置く（ルールが編集権限の判定に使う）
await call(`${DB}/mss_acl/g4.json?ns=${NS}`, { method: "PUT", headers: owner, body: JSON.stringify({ [coachUid]: "coach" }) });

console.log(`エミュレータにデータを入れました（${useSynthetic ? "架空のデータ" : "移行ドライランの出力"}）。`);
console.log("テスト用の合言葉は scripts/seed-emulator.ts の DEV_ACCOUNTS を参照してください。");
