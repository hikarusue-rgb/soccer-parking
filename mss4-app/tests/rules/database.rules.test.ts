// Realtime Database の権限ルールのテスト（Firebase エミュレータで実行: npm run test:rules）
// 閲覧と車出しエントリーは合言葉なし（誰でも）。編集・抽選はコーチだけ。
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-mss4";
const DOMAIN = "soccer-parking.firebaseapp.com";
const TS = { ".sv": "timestamp" };
const HOUR = 3_600_000;

let env: RulesTestEnvironment;
let now: number;

function fixture() {
  now = Date.now();
  return {
    mss_acl: { g4: { coachUid: "coach" }, g5: { g5coachUid: "coach" } },
    mss: {
      g4: {
        meta: { team: "MSS・香澄", gradeLabel: "4年生", schema: 1 },
        members: {
          m1: { num: 4, name: "テスト一郎", active: true, order: 1 },
          m2: { num: 6, name: "テスト二郎", active: true, order: 2 },
        },
        events: {
          evOpen: {
            date: "2026-11-08", kind: "match", title: "受付中の試合", status: "scheduled",
            version: 1, updatedAt: now, parking: { mode: "lottery", limit: 3, deadlineAt: now + 24 * HOUR },
          },
          evClosed: {
            date: "2026-11-01", kind: "match", title: "締切後の試合", status: "scheduled",
            version: 1, updatedAt: now, parking: { mode: "lottery", limit: 2, deadlineAt: now - HOUR },
          },
          evNone: {
            date: "2026-11-02", kind: "practice", title: "練習", status: "scheduled",
            version: 1, updatedAt: now, parking: { mode: "none", limit: 0 },
          },
        },
        entries: {
          evClosed: { m1: { attending: true, parkingNeeded: true, carpoolCapacity: 1, at: now - 2 * HOUR } },
          evOpen: { m2: { attending: true, parkingNeeded: false, carpoolCapacity: 0, at: now - HOUR } },
        },
        history: { evOpen: { h1: { at: now, version: 1, actor: "コーチ", after: { title: "受付中の試合" } } } },
      },
      g5: {
        events: {
          ev5: { date: "2026-11-08", kind: "match", title: "5年生の試合", status: "scheduled", version: 1, updatedAt: now },
        },
      },
    },
    pro: { teams: { LEGACY: { meta: { name: "既存チーム" } } } },
  };
}

const guest = () => env.unauthenticatedContext().database();
const coach = () => env.authenticatedContext("coachUid", { email: `g4-coach@${DOMAIN}` }).database();
const someone = () => env.authenticatedContext("someoneUid", { email: "someone@example.com" }).database();
const g5coach = () => env.authenticatedContext("g5coachUid", { email: `g5-coach@${DOMAIN}` }).database();

const newEvent = (over: Record<string, unknown> = {}) => ({
  date: "2026-11-15", kind: "match", title: "新しい試合", status: "scheduled",
  version: 1, updatedAt: TS, parking: { mode: "lottery", limit: 3, deadlineAt: Date.now() + 48 * HOUR },
  ...over,
});
const entry = (over: Record<string, unknown> = {}) => ({
  attending: true, parkingNeeded: true, carpoolCapacity: 0, at: TS, ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set(fixture());
  });
});

describe("閲覧（合言葉なし）", () => {
  it("未ログインでも予定・名簿・エントリー・抽選・大会・変更履歴を読める", async () => {
    for (const path of ["events", "members", "entries", "lotteries", "tournaments", "meta", "history"]) {
      await assertSucceeds(guest().ref(`mss/g4/${path}`).get());
    }
  });
  it("コーチの登録情報（mss_acl）は誰も読めない", async () => {
    await assertFails(guest().ref("mss_acl").get());
    await assertFails(coach().ref("mss_acl/g4").get());
  });
  it("学年をまたいだ /mss 全体と、存在しない学年コードは読めない", async () => {
    await assertFails(guest().ref("mss").get());
    await assertFails(guest().ref("mss/zz/events").get());
  });
});

describe("編集はコーチだけ", () => {
  it("未ログイン・コーチ以外のログインユーザーは予定・名簿・抽選・大会・設定を書けない", async () => {
    for (const db of [guest(), someone()]) {
      await assertFails(db.ref("mss/g4/events/evX").set(newEvent()));
      await assertFails(db.ref("mss/g4/members/m9").set({ num: 9, name: "追加", active: true }));
      await assertFails(db.ref("mss/g4/lotteries/evOpen").set({ status: "drawn", updatedAt: TS }));
      await assertFails(db.ref("mss/g4/tournaments/t1").set({ name: "大会", version: 1, updatedAt: TS }));
      await assertFails(db.ref("mss/g4/settings").set({ seasonStart: "04-01" }));
      await assertFails(db.ref("mss/g4/events/evNone").remove());
    }
  });
  it("誰も mss_acl を書けない（コーチを名乗る登録はできない）", async () => {
    await assertFails(guest().ref("mss_acl/g4/someoneUid").set("coach"));
    await assertFails(coach().ref("mss_acl/g4/someoneUid").set("coach"));
  });
  it("コーチは予定を新規作成できる（version 1、更新時刻はサーバー時刻）", async () => {
    await assertSucceeds(coach().ref("mss/g4/events/evNew").set(newEvent()));
  });
  it("新規作成で version が1でない・更新時刻が端末時刻だと失敗", async () => {
    await assertFails(coach().ref("mss/g4/events/evNew").set(newEvent({ version: 2 })));
    await assertFails(coach().ref("mss/g4/events/evNew").set(newEvent({ updatedAt: Date.now() })));
  });
  it("更新は version を1つ上げたときだけ成功する（同時編集の検出）", async () => {
    const db = coach();
    await assertSucceeds(db.ref("mss/g4/events/evOpen").set(newEvent({ title: "変更後", version: 2 })));
    await assertFails(db.ref("mss/g4/events/evOpen").set(newEvent({ title: "古い版から", version: 2 })));
    await assertFails(db.ref("mss/g4/events/evOpen/title").set("部分だけ変更"));
  });
  it("不正な日付・種別・時刻・大会ID・予定IDは失敗", async () => {
    const db = coach();
    await assertFails(db.ref("mss/g4/events/evBad").set(newEvent({ date: "2026-13-01" })));
    await assertFails(db.ref("mss/g4/events/evBad").set(newEvent({ kind: "party" })));
    await assertFails(db.ref("mss/g4/events/evBad").set(newEvent({ start: "25:00" })));
    await assertFails(db.ref("mss/g4/events/evBad").set(newEvent({ tournamentId: "../x" })));
    await assertFails(db.ref("mss/g4/events/ev bad").set(newEvent()));
  });
  it("コーチは予定を削除でき、名簿を追加でき、余計な項目は拒否される", async () => {
    await assertSucceeds(coach().ref("mss/g4/events/evNone").remove());
    await assertSucceeds(coach().ref("mss/g4/members/m3").set({ num: 7, name: "テスト三郎", active: true, order: 3 }));
    await assertFails(coach().ref("mss/g4/members/m4").set({ num: 8, name: "四郎", active: true, phone: "000" }));
  });
  it("コーチは大会を作成でき、公式URLは http(s) のみ", async () => {
    const db = coach();
    await assertSucceeds(db.ref("mss/g4/tournaments/t1").set({ name: "プレミアリーグ", officialUrl: "https://example.com/", version: 1, updatedAt: TS }));
    await assertFails(db.ref("mss/g4/tournaments/t2").set({ name: "大会", officialUrl: "javascript:alert(1)", version: 1, updatedAt: TS }));
  });
  it("4年生のコーチは5年生のデータを書けず、5年生のコーチは4年生を書けない", async () => {
    await assertFails(coach().ref("mss/g5/events/ev5").set(newEvent({ version: 2 })));
    await assertFails(g5coach().ref("mss/g4/events/evNew").set(newEvent()));
  });
  it("未定義のノードは作れない", async () => {
    await assertFails(coach().ref("mss/g4/secret").set({ a: 1 }));
  });
});

describe("変更履歴", () => {
  it("コーチは追記でき、既存の履歴は上書き・削除できない", async () => {
    const db = coach();
    await assertSucceeds(db.ref("mss/g4/history/evOpen/h2").set({ at: TS, version: 2, actor: "コーチ", after: { title: "x" } }));
    await assertFails(db.ref("mss/g4/history/evOpen/h1").set({ at: TS, version: 9, actor: "コーチ", after: { title: "改ざん" } }));
    await assertFails(db.ref("mss/g4/history/evOpen/h1").remove());
  });
  it("コーチ以外は履歴を書けない", async () => {
    await assertFails(guest().ref("mss/g4/history/evOpen/h3").set({ at: TS, version: 2, actor: "保護者", after: {} }));
  });
});

describe("車出しエントリー（合言葉なし）", () => {
  it("未ログインでも締切前にエントリーを作成・変更できる", async () => {
    const db = guest();
    await assertSucceeds(db.ref("mss/g4/entries/evOpen/m1").set(entry()));
    await assertSucceeds(db.ref("mss/g4/entries/evOpen/m1").set(entry({ parkingNeeded: false, carpoolCapacity: 0 })));
  });
  it("形の不正なエントリーは拒否される", async () => {
    const db = guest();
    await assertFails(db.ref("mss/g4/entries/evOpen/m1").set(entry({ attending: false, parkingNeeded: true })));
    await assertFails(db.ref("mss/g4/entries/evOpen/m1").set(entry({ carpoolCapacity: 9 })));
    await assertFails(db.ref("mss/g4/entries/evOpen/m1").set(entry({ note: "余計な項目" })));
    await assertFails(db.ref("mss/g4/entries/evOpen/m1").set(entry({ at: Date.now() })));
    await assertFails(db.ref("mss/g4/entries/evOpen/m1").set({ attending: true, parkingNeeded: true, at: TS }));
  });
  it("締切後は新しい車出し希望を出せない", async () => {
    await assertFails(guest().ref("mss/g4/entries/evClosed/m2").set(entry()));
  });
  it("締切後でも辞退（欠席・車出し不要）はできる", async () => {
    const db = guest();
    await assertSucceeds(db.ref("mss/g4/entries/evClosed/m1").set(entry({ parkingNeeded: false })));
    await assertSucceeds(db.ref("mss/g4/entries/evClosed/m2").set(entry({ attending: false, parkingNeeded: false })));
  });
  it("締切後も、すでに出している車出し希望の乗合人数は変えられる", async () => {
    await assertSucceeds(guest().ref("mss/g4/entries/evClosed/m1").set(entry({ carpoolCapacity: 3 })));
  });
  it("抽選なしの予定・名簿にない子にはエントリーできない", async () => {
    const db = guest();
    await assertFails(db.ref("mss/g4/entries/evNone/m1").set(entry()));
    await assertFails(db.ref("mss/g4/entries/evOpen/ghost").set(entry()));
  });
  it("コーチ以外はエントリーを削除できない。コーチは予定ごとにまとめて削除できる", async () => {
    await assertFails(guest().ref("mss/g4/entries/evClosed/m1").remove());
    await assertFails(guest().ref("mss/g4/entries/evClosed").remove());
    await assertSucceeds(coach().ref("mss/g4/entries/evClosed").remove());
  });
  it("コーチは締切後でも代理で修正できる", async () => {
    await assertSucceeds(coach().ref("mss/g4/entries/evClosed/m2").set(entry()));
  });
});

describe("抽選結果", () => {
  it("コーチは抽選結果を保存できる", async () => {
    await assertSucceeds(coach().ref("mss/g4/lotteries/evClosed").set({
      status: "drawn", policy: "random", slots: 2, participants: ["m1"], winners: ["m1"], conductedAt: TS, updatedAt: TS,
    }));
  });
  it("コーチ以外は抽選結果を保存できない", async () => {
    await assertFails(guest().ref("mss/g4/lotteries/evClosed").set({ status: "drawn", updatedAt: TS }));
  });
});

describe("旧アプリのパス（並行運用中）", () => {
  it("/pro は従来どおり未ログインで読み書きできる", async () => {
    const db = guest();
    await assertSucceeds(db.ref("pro/teams/LEGACY/meta").get());
    await assertSucceeds(db.ref("pro/teams/LEGACY/meta/name").set("既存チーム"));
  });
});
