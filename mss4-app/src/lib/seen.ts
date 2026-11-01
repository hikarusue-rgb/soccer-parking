// 「未確認の更新」：保護者がこの端末で確認した予定の版を localStorage に記録する。
// 端末・ブラウザごとの記録で、コーチに既読を知らせる機能ではない。保存できない環境ではこの画面の間だけ有効。
import { useCallback, useEffect, useState } from "react";
import type { GradeCode, Role } from "./grade";
import type { TeamEvent } from "./types";

const RECENT = 30 * 86_400_000;
const keyOf = (grade: GradeCode, role: Role) => `mss4-seen-v1-${grade}-${role}`;

function read(key: string): Record<string, number> {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function isUnread(e: TeamEvent, seen: Record<string, number>, now: number = Date.now()): boolean {
  return e.updatedBy === "コーチ" && e.updatedAt >= now - RECENT && (seen[e.id] ?? 0) < e.version;
}

export function useSeen(grade: GradeCode, role: Role) {
  const key = keyOf(grade, role);
  const [seen, setSeen] = useState<Record<string, number>>(() => read(key));
  const [storable, setStorable] = useState(true);

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === key) setSeen(read(key));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);

  const markSeen = useCallback((eventId: string, version: number) => {
    setSeen((prev) => {
      const next = { ...prev, [eventId]: Math.max(prev[eventId] ?? 0, version) };
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        setStorable(false);
      }
      return next;
    });
  }, [key]);

  return { seen, markSeen, storable };
}
