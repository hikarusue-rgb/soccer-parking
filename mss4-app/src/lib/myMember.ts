// 「お子さんの名前」をこの端末に記憶する（エントリーのたびに選び直さなくてよいように）
import { useCallback, useEffect, useState } from "react";
import type { GradeCode } from "./grade";

const keyOf = (grade: GradeCode) => `mss4-my-member-v1-${grade}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useMyMember(grade: GradeCode): [string | null, (id: string | null) => void] {
  const key = keyOf(grade);
  const [id, setId] = useState<string | null>(() => read(key));

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === key) setId(read(key));
    };
    const local = (e: Event) => setId((e as CustomEvent<string | null>).detail);
    window.addEventListener("storage", sync);
    window.addEventListener(`mss4-my-member-${grade}`, local);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(`mss4-my-member-${grade}`, local);
    };
  }, [key, grade]);

  const choose = useCallback((next: string | null) => {
    try {
      if (next) window.localStorage.setItem(key, next);
      else window.localStorage.removeItem(key);
    } catch {
      /* 保存できない環境では、この画面の間だけ有効 */
    }
    setId(next);
    // 同じ画面内のほかの部品（駐車場タブと詳細）にも知らせる
    window.dispatchEvent(new CustomEvent(`mss4-my-member-${grade}`, { detail: next }));
  }, [key, grade]);

  return [id, choose];
}
