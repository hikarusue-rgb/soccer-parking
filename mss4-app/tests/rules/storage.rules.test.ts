// Cloud Storage の権限ルールのテスト（Firebase エミュレータで実行: npm run test:rules）
// 画像・PDFの表示はトークン付きのダウンロードURLで行うため、ルール上の操作はコーチだけ。
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const DOMAIN = "soccer-parking.firebaseapp.com";
const EXISTING = "mss/g4/files/existing.jpg";
let env: RulesTestEnvironment;

const coach = () => env.authenticatedContext("coachUid", { email: `g4-coach@${DOMAIN}` }).storage();
const someone = () => env.authenticatedContext("someoneUid", { email: "someone@example.com" }).storage();
const g5coach = () => env.authenticatedContext("g5coachUid", { email: `g5-coach@${DOMAIN}` }).storage();
const guest = () => env.unauthenticatedContext().storage();
const bytes = (size: number) => new Uint8Array(size);
// UploadTask は then を持つが Promise 型ではないため、then で Promise にそろえる
const put = (s: ReturnType<typeof coach>, path: string, size: number, contentType: string) =>
  s.ref(path).put(bytes(size), { contentType }).then((snapshot) => snapshot);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mss4",
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await put(ctx.storage(), EXISTING, 1024, "image/jpeg");
  });
});

describe("ルール上の読み取り（一覧・メタデータ）", () => {
  it("その学年のコーチは読める", async () => {
    await assertSucceeds(coach().ref(EXISTING).getMetadata());
  });
  it("未ログイン・コーチ以外・他学年は読めない（表示はトークン付きURLで行う）", async () => {
    await assertFails(guest().ref(EXISTING).getMetadata());
    await assertFails(someone().ref(EXISTING).getMetadata());
    await assertFails(g5coach().ref(EXISTING).getMetadata());
  });
});

describe("アップロード", () => {
  it("コーチは画像・PDFをアップロードできる", async () => {
    await assertSucceeds(put(coach(), "mss/g4/files/a.jpg", 2048, "image/jpeg"));
    await assertSucceeds(put(coach(), "mss/g4/files/b.pdf", 2048, "application/pdf"));
  });
  it("未ログイン・コーチ以外・他学年のコーチはアップロードできない", async () => {
    await assertFails(put(guest(), "mss/g4/files/c.jpg", 2048, "image/jpeg"));
    await assertFails(put(someone(), "mss/g4/files/c.jpg", 2048, "image/jpeg"));
    await assertFails(put(g5coach(), "mss/g4/files/c.jpg", 2048, "image/jpeg"));
  });
  it("画像・PDF以外と15MB以上は拒否される", async () => {
    await assertFails(put(coach(), "mss/g4/files/d.html", 100, "text/html"));
    await assertFails(put(coach(), "mss/g4/files/e.pdf", 15 * 1024 * 1024, "application/pdf"));
  });
  it("既存ファイルの上書きはできない", async () => {
    await assertFails(put(coach(), EXISTING, 10, "image/jpeg"));
  });
  it("決められた場所以外には置けない", async () => {
    await assertFails(put(coach(), "other/f.jpg", 10, "image/jpeg"));
  });
});

describe("テスト環境（mss_test）", () => {
  it("誰でも画像・PDFをアップロード・削除できるが、種類と大きさの制限は本番と同じ", async () => {
    await assertSucceeds(put(guest(), "mss_test/g4/files/t.jpg", 2048, "image/jpeg"));
    await assertSucceeds(guest().ref("mss_test/g4/files/t.jpg").delete());
    await assertFails(put(guest(), "mss_test/g4/files/t.html", 100, "text/html"));
    await assertFails(put(guest(), "mss_test/g4/files/big.pdf", 15 * 1024 * 1024, "application/pdf"));
  });
});

describe("削除", () => {
  it("コーチは削除でき、それ以外は削除できない", async () => {
    await assertFails(guest().ref(EXISTING).delete());
    await assertFails(someone().ref(EXISTING).delete());
    await assertSucceeds(coach().ref(EXISTING).delete());
  });
});
