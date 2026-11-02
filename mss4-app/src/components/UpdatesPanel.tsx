import { BellRing, CheckCheck, ChevronRight } from "lucide-react";
import { dayLabel, relativeDay, jstToday } from "../lib/datetime";
import { lotteryKey } from "../lib/seen";
import { useTeam } from "../lib/teamContext";
import { summarize, useHistories } from "../lib/updates";
import type { TeamEvent } from "../lib/types";

const ago = (ms: number, now: number) => {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}時間前` : `${Math.round(h / 24)}日前`;
};

/** 予定タブのいちばん上：前回開いたあとに変わった予定を、何が変わったか付きで並べる */
export function UpdatesPanel() {
  const t = useTeam();
  const today = jstToday(t.now);
  const items = t.data.events
    .map((e) => ({ e, changed: t.isUnread(e), drawn: t.isLotteryUnread(e) }))
    .filter((x) => x.changed || x.drawn)
    .sort((a, b) => Math.max(b.e.updatedAt, t.data.lotteries[b.e.id]?.updatedAt ?? 0) - Math.max(a.e.updatedAt, t.data.lotteries[a.e.id]?.updatedAt ?? 0));
  const history = useHistories(t.grade, items.filter((x) => x.changed).map(({ e }) => ({ id: e.id, version: e.version })));

  if (!items.length) {
    return <p className="updates-none"><CheckCheck size={16} aria-hidden="true" />新しい更新はありません（前回から変わった予定はここに出ます）</p>;
  }

  const open = (e: TeamEvent, drawnOnly: boolean) =>
    t.navigate({ name: "event", id: e.id, section: drawnOnly ? "parking" : undefined, from: "home" });
  const markAll = () => {
    const entries: Record<string, number> = {};
    for (const { e, drawn } of items) {
      entries[e.id] = e.version;
      if (drawn) entries[lotteryKey(e.id)] = t.data.lotteries[e.id]!.updatedAt;
    }
    t.markSeen(entries);
  };

  return (
    <section className="updates-panel" aria-labelledby="updates-title">
      <div className="updates-head">
        <h2 id="updates-title"><span className="updates-bell"><BellRing size={18} aria-hidden="true" /></span>新しい更新<b>{items.length}</b>件</h2>
        <button className="btn btn-small btn-ghost" onClick={markAll}>すべて確認済み</button>
      </div>
      <ul className="updates-list">
        {items.map(({ e, changed, drawn }) => {
          const h = changed ? history(e.id, e.version) : [];
          const sum = h ? summarize(h, t.seen[e.id] ?? 0) : null;
          const phrases = [...(drawn ? [{ text: "🎯 駐車場の抽選結果が出ました", tone: "green" as const }] : []), ...(sum?.phrases ?? [])];
          const at = Math.max(changed ? e.updatedAt : 0, drawn ? t.data.lotteries[e.id]!.updatedAt : 0);
          return (
            <li key={e.id}>
              <button className={`update-card ${e.status === "canceled" || e.status === "postponed" ? "is-stop" : ""}`} onClick={() => open(e, drawn && !changed)}>
                <span className="update-when"><b>{dayLabel(e.date)}</b><small>{relativeDay(e.date, today)}</small></span>
                <span className="update-main">
                  <b className="update-title">{e.title}</b>
                  <span className="update-phrases">
                    {phrases.length ? phrases.slice(0, 4).map((p) => <span key={p.text} className={`phrase tone-${p.tone}`}>{p.text}</span>)
                      : <span className="phrase tone-plain">{sum ? "内容が変わりました" : "読み込み中…"}</span>}
                    {phrases.length > 4 && <span className="phrase tone-plain">ほか{phrases.length - 4}件</span>}
                  </span>
                  <small className="update-ago">更新：{ago(at, t.now)}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {!t.seenStorable && <small className="muted">この端末では確認の記録を保存できないため、画面を閉じるまで有効です。</small>}
    </section>
  );
}
