// Cloud Storage の権限ルールのテスト（Firebase エミュレータで実行: npm run test:rules）
// 合言葉なしで誰でも画像・PDFを追加・削除できる（2026-11-02 ユーザー判断）。種類・大きさ・上書き・置き場所の制限は残す。
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const EXISTING = "mss/g4/files/existing.jpg";
let env: RulesTestEnvironment;

const guest = () => env.unauthenticatedContext().storage();
const bytes = (size: number) => new Uint8Array(size);
// UploadTask は then を持つが Promise 型ではないため、then で Promise にそろえる
const put = (s: ReturnType<typeof guest>, path: string, size: number, contentType: string) =>
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

describe("アップロード（合言葉なし）", () => {
  it("未ログインでも画像・PDFをアップロードできる（本番・テスト環境）", async () => {
    await assertSucceeds(put(guest(), "mss/g4/files/a.jpg", 2048, "image/jpeg"));
    await assertSucceeds(put(guest(), "mss/g4/files/b.pdf", 2048, "application/pdf"));
    await assertSucceeds(put(guest(), "mss_test/g4/files/t.jpg", 2048, "image/jpeg"));
  });
  it("画像・PDF以外と15MB以上は拒否される", async () => {
    await assertFails(put(guest(), "mss/g4/files/d.html", 100, "text/html"));
    await assertFails(put(guest(), "mss/g4/files/e.pdf", 15 * 1024 * 1024, "application/pdf"));
  });
  it("既存ファイルの上書きはできない", async () => {
    await assertFails(put(guest(), EXISTING, 10, "image/jpeg"));
  });
  it("決められた場所以外には置けない", async () => {
    await assertFails(put(guest(), "other/f.jpg", 10, "image/jpeg"));
    await assertFails(put(guest(), "pro/g4/files/f.jpg", 10, "image/jpeg"));
    await assertFails(put(guest(), "mss/zz/files/f.jpg", 10, "image/jpeg"));
  });
});

describe("読み取り・削除", () => {
  it("未ログインでもメタデータを読め、削除できる", async () => {
    await assertSucceeds(guest().ref(EXISTING).getMetadata());
    await assertSucceeds(guest().ref(EXISTING).delete());
  });
});
