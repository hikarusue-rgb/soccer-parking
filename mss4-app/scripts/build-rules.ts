// Realtime Database のルール（database.rules.json）を作る。
//   node scripts/build-rules.ts
// 本番 /mss・テスト環境 /mss_test とも「合言葉なしで誰でも閲覧・編集できる」（2026-11-02 ユーザー判断：コーチの合言葉も不要）。
// 車出しの回答の締切ルールと、データの形の検査は残す。
// どちらも同じデータの形の検査を使う（テストで作ったデータが本番と同じ形になるように）。
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TIME = "/^([01][0-9]|2[0-3]):[0-5][0-9]$/";
const ID = "/^[A-Za-z0-9_-]{1,64}$/";

function gradeRules(root: string, coach: string) {
  const grade = `root.child('${root}').child($grade)`;
  const event = `${grade}.child('events').child($eventId)`;
  const deadline = `${event}.child('parking/deadlineAt')`;
  const lottery = `${grade}.child('lotteries').child($eventId)`;
  const versioned = "(data.exists() ? newData.child('version').val() === data.child('version').val() + 1 : newData.child('version').val() === 1)";
  const time = { ".validate": `newData.isString() && newData.val().matches(${TIME})` };

  // 車出しの回答（旧駐車場抽選アプリの仕様）
  //  ・駐車場不要／欠席／辞退 への変更はいつでもできる
  //  ・すでに駐車場を希望している人は、そのまま（乗合人数の変更など）にできる
  //  ・新しく駐車場を希望できるのは抽選前だけ。締切後は、まだ回答していない人だけ登録できる
  const entryWrite = [
    "newData.exists()",
    `${grade}.child('members').child($memberId).exists()`,
    `${event}.child('parking/mode').val() === 'lottery'`,
    `(newData.child('parkingNeeded').val() === false || data.child('parkingNeeded').val() === true || (!${lottery}.exists() && (!data.exists() || !${deadline}.exists() || now < ${deadline}.val())))`,
  ].join(" && ");

  return {
    ".read": "$grade.matches(/^(k|g[1-6])$/)",
    meta: { ".write": coach },
    settings: { ".write": coach },
    events: {
      ".indexOn": ["date"],
      $eventId: {
        ".write": coach,
        ".validate": `$eventId.matches(${ID}) && newData.hasChildren(['date', 'kind', 'title', 'status', 'version', 'updatedAt']) && ${versioned}`,
        date: { ".validate": "newData.isString() && newData.val().matches(/^20[0-9][0-9]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/)" },
        kind: { ".validate": "newData.isString() && newData.val().matches(/^(practice|match|notice)$/)" },
        status: { ".validate": "newData.isString() && newData.val().matches(/^(scheduled|changed|canceled|postponed|unconfirmed)$/)" },
        title: { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 100" },
        start: time, end: time, meeting: time, kickoff: time,
        tournamentId: { ".validate": `newData.isString() && newData.val().matches(${ID})` },
        version: { ".validate": "newData.isNumber()" },
        updatedAt: { ".validate": "newData.val() === now" },
        parking: {
          mode: { ".validate": "newData.isString() && newData.val().matches(/^(none|lottery)$/)" },
          limit: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 50" },
          deadlineAt: { ".validate": "newData.isNumber()" },
        },
      },
    },
    history: {
      $eventId: {
        $historyId: {
          ".write": `${coach} && !data.exists() && newData.exists()`,
          ".validate": "newData.hasChildren(['at', 'version', 'after']) && newData.child('at').val() === now",
        },
      },
    },
    tournaments: {
      $tournamentId: {
        ".write": coach,
        ".validate": `$tournamentId.matches(${ID}) && newData.hasChildren(['name', 'version', 'updatedAt']) && ${versioned}`,
      },
    },
    members: {
      $memberId: {
        ".write": coach,
        ".validate": `$memberId.matches(${ID}) && newData.hasChildren(['num', 'name', 'active'])`,
        num: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 999" },
        name: { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40" },
        active: { ".validate": "newData.isBoolean()" },
        order: { ".validate": "newData.isNumber()" },
        $other: { ".validate": false },
      },
    },
    entries: {
      $eventId: {
        ".write": coach,
        $memberId: {
          ".write": entryWrite,
          ".validate": "newData.hasChildren(['attending', 'parkingNeeded', 'carpoolCapacity', 'at']) && (newData.child('attending').val() === true || newData.child('parkingNeeded').val() === false)",
          attending: { ".validate": "newData.isBoolean()" },
          parkingNeeded: { ".validate": "newData.isBoolean()" },
          carpoolCapacity: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 8" },
          at: { ".validate": "newData.isNumber() && newData.val() === now" },
          $other: { ".validate": false },
        },
      },
    },
    lotteries: {
      $eventId: {
        ".write": coach,
        ".validate": "newData.hasChildren(['status', 'updatedAt'])",
        status: { ".validate": "newData.isString() && newData.val().matches(/^(drawn)$/)" },
        updatedAt: { ".validate": "newData.val() === now" },
      },
    },
    $other: { ".validate": false },
  };
}

const coach = "auth != null && root.child('mss_acl').child($grade).child(auth.uid).val() === 'coach'";
const rules = {
  rules: {
    mss_acl: { ".read": false, ".write": false },
    // 学年コードが正しい場所なら誰でも書ける。車出しの締切（締切後は辞退だけ等）は画面側で守る（全員がコーチと同じ扱いのため）
    mss: { $grade: gradeRules("mss", "$grade.matches(/^(k|g[1-6])$/)") },
    // テスト環境：合言葉なしで誰でもコーチの操作を試せる（本番とは別のデータ）
    mss_test: { $grade: gradeRules("mss_test", "$grade.matches(/^(k|g[1-6])$/)") },
    // 旧アプリ（/pro ほか）は従来どおり
    $legacy: { ".read": true, ".write": true },
  },
};

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../database.rules.json");
writeFileSync(out, JSON.stringify(rules, null, 2) + "\n");
console.log(`書き出しました: ${out}`);
