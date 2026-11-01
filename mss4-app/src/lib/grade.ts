import { ACCOUNT_DOMAIN } from "./config";

export type GradeCode = "k" | "g1" | "g2" | "g3" | "g4" | "g5" | "g6";
export type Role = "parent" | "coach";

export const GRADE_LABELS: Record<GradeCode, string> = {
  k: "幼児", g1: "1年生", g2: "2年生", g3: "3年生", g4: "4年生", g5: "5年生", g6: "6年生",
};

/** URL で学年を省略したときは4年生 */
export const DEFAULT_GRADE: GradeCode = "g4";

export function isGradeCode(value: unknown): value is GradeCode {
  return typeof value === "string" && Object.hasOwn(GRADE_LABELS, value);
}

/** `?grade=g4` を読む。指定なし・不正な値は4年生 */
export function parseGrade(search: string): GradeCode {
  const value = new URLSearchParams(search).get("grade");
  return isGradeCode(value) ? value : DEFAULT_GRADE;
}

/** 学年・役割ごとの合言葉用アカウント（合言葉＝パスワード） */
export function accountEmail(grade: GradeCode, role: Role): string {
  return `${grade}-${role}@${ACCOUNT_DOMAIN}`;
}

export function roleOf(email: string | null | undefined, grade: GradeCode): Role | null {
  if (!email) return null;
  if (email === accountEmail(grade, "coach")) return "coach";
  if (email === accountEmail(grade, "parent")) return "parent";
  return null;
}
