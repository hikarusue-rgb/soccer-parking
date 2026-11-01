import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { DATA_ROOT } from "./config";
import { firebase } from "./firebase";
import type { GradeCode } from "./grade";
import {
  compareEvents, toEntry, toEvent, toLottery, toMember, toMeta, toSettings,
} from "./normalize";
import type { Entry, Lottery, TeamData } from "./types";

const PARTS = ["meta", "settings", "events", "members", "entries", "lotteries"] as const;
type Part = (typeof PARTS)[number];
type Raw = Record<string, unknown>;

function build(raw: Partial<Record<Part, unknown>>): TeamData {
  const map = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
  const entries: Record<string, Record<string, Entry>> = {};
  for (const [eventId, byMember] of Object.entries(map(raw.entries))) {
    entries[eventId] = Object.fromEntries(Object.entries(map(byMember)).map(([memberId, e]) => [memberId, toEntry(e)]));
  }
  const lotteries: Record<string, Lottery> = {};
  for (const [eventId, l] of Object.entries(map(raw.lotteries))) lotteries[eventId] = toLottery(l);
  return {
    meta: toMeta(raw.meta),
    settings: toSettings(raw.settings),
    events: Object.entries(map(raw.events)).map(([id, e]) => toEvent(id, e)).filter((e) => e.date).sort(compareEvents),
    members: Object.entries(map(raw.members)).map(([id, m]) => toMember(id, m))
      .sort((a, b) => a.order - b.order || a.num - b.num),
    entries,
    lotteries,
  };
}

/** チームのデータをリアルタイムで購読する（変更履歴は詳細画面で必要なときだけ読む） */
export function useTeamData(grade: GradeCode): { data: TeamData | null; error: string | null } {
  const [raw, setRaw] = useState<Partial<Record<Part, unknown>>>({});
  const [loaded, setLoaded] = useState<Set<Part>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { db } = firebase();
    setRaw({});
    setLoaded(new Set());
    setError(null);
    const stops = PARTS.map((part) =>
      onValue(
        ref(db, `${DATA_ROOT}/${grade}/${part}`),
        (snapshot) => {
          setRaw((prev) => ({ ...prev, [part]: snapshot.val() }));
          setLoaded((prev) => (prev.has(part) ? prev : new Set(prev).add(part)));
        },
        () => {
          setError("データを読み込めませんでした。通信状態を確認して、画面を再読み込みしてください。");
        },
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [grade]);

  const ready = loaded.size === PARTS.length;
  const data = useMemo(() => (ready ? build(raw) : null), [ready, raw]);
  return { data, error };
}
