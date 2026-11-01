import { describe, expect, it } from "vitest";
import { MAX_PIXELS, targetSize } from "../../src/lib/imageCompress.ts";
import { blankTournament, safeUrl, toStoredTournament, validateTournament } from "../../src/lib/tournamentForm.ts";
import { defaultLabel, formatBytes } from "../../src/lib/uploads.ts";

describe("画像の縮小サイズ", () => {
  it("iPhoneの縦長スクショ（1170×2532）は幅1080px以上を保つ", () => {
    const s = targetSize(1170, 2532);
    expect(s.height).toBe(2400);
    expect(s.width).toBeGreaterThanOrEqual(1080);
  });
  it("スクロールした長いスクショ（1170×6000）も幅1080pxを保つ", () => {
    expect(targetSize(1170, 6000).width).toBe(1080);
  });
  it("12メガピクセルの写真は約400万画素に縮める", () => {
    const s = targetSize(4032, 3024);
    expect(s.width * s.height).toBeLessThanOrEqual(MAX_PIXELS * 1.01);
    expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(2400);
  });
  it("小さい画像は拡大しない", () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("大会フォーム", () => {
  it("公式URLは http(s) だけ", () => {
    expect(safeUrl("https://example.com/league")).toBe("https://example.com/league");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("https://user:pass@example.com")).toBe("");
    expect(safeUrl("")).toBe("");
  });
  it("大会名・期間・URLを検査する", () => {
    expect(validateTournament(blankTournament())).toContain("大会名を入力してください。");
    const d = { ...blankTournament(), name: "リーグ", startDate: "2026-12-01", endDate: "2026-11-01", officialUrl: "ftp://x" };
    expect(validateTournament(d)).toEqual(["終了日は開始日以降にしてください。", "公式URLは https:// から始まるURLを入力してください。"]);
  });
  it("保存形は空欄を含めず、版を上げる", () => {
    const stored = toStoredTournament({ ...blankTournament(), name: " プレミアリーグ ", regulations: "8人制" });
    expect(stored).toMatchObject({ name: "プレミアリーグ", regulations: "8人制", archived: false, version: 1 });
    expect(stored).not.toHaveProperty("officialUrl");
  });
});

describe("アップロードの表示", () => {
  it("拡張子を外した表示名とサイズ表記", () => {
    expect(defaultLabel("タイムテーブル.PNG")).toBe("タイムテーブル");
    expect(defaultLabel(".pdf")).toBe("資料");
    expect(formatBytes(2_621_440)).toBe("2.5MB");
    expect(formatBytes(300_000)).toBe("293KB");
  });
});
