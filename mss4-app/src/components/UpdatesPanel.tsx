import { BellRing, Check, ChevronRight } from "lucide-react";
import { dayLabel, relativeDay, jstToday } from "../lib/datetime";
import { lotteryKey, SHARED_DAYS } from "../lib/seen";
import { useTeam } from "../lib/teamContext";
import { summarize, useHistories } from "../lib/updates";
import type { HistoryItem } from "../lib/changes";
import type { TeamEvent } from "../lib/types";

const ago = (ms: number, now: number) => {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}時間前` : `${Math.round(h / 24)}日前`;
};

/**
 * 予定タブのいちばん上：「最近の変更」
 *  ・全員共通：直近3日間に追加・変更された予定と抽選結果（だれが見ても同じ並び）
 *  ・個人：この端末でまだ見ていないものはオレンジで「未確認」（見たら白に戻る）
 */
export function UpdatesPanel() {
  const t = useTeam();
  const today = jstToday(t.now);
  const cutoff = t.now - SHARED_DAYS * 86_400_000;
  const items = t.data.events
    .map((e) => {
      const lottery = t.data.lotteries[e.id];
      const state = t.updateState(e);
      const changedAt = e.updatedBy === "移行" && e.version <= 1 ? 0 : e.updatedAt;
      const drawnAt = lottery?.updatedAt ?? 0;
      const drawnNew = t.isLotteryUnread(e);
      const drawn = drawnNew || drawnAt >= cutoff;
      return { e, state, drawn, drawnNew, changed: t.isUnread(e) || changedAt >= cutoff, at: Math.max(changedAt, drawn ? drawnAt : 0) };
    })
    .filter((x) => x.state !== null)
    .sort((a, b) => Number(b.state === "unread") - Number(a.state === "unread") || b.at - a.at);
  const unread = items.filter((x) => x.state === "unread");
  const history = useHistories(t.grade, items.filter((x) => x.changed).map(({ e }) => ({ id: e.id, version: e.version })));

  if (!items.length) {
    return <p className="updates-none"><Check size={16} aria-hidden="true" />直近{SHARED_DAYS}日間に変わった予定はありません</p>;
  }

  const open = (e: TeamEvent, drawnOnly: boolean) =>
    t.navigate({ name: "event", id: e.id, section: drawnOnly ? "parking" : undefined, from: "home" });
  const markAll = () => {
    const entries: Record<string, number> = {};
    for (const { e } of unread) {
      entries[e.id] = e.version;
      const l = t.data.lotteries[e.id];
      if (l) entries[lotteryKey(e.id)] = l.updatedAt;
    }
    t.markSeen(entries);
  };
  // 未確認：この端末で前回見た版から。確認済み：直近3日間の変更
  const sinceOf = (e: TeamEvent, unreadNow: boolean, h: HistoryItem[]) => {
    if (unreadNow && t.isUnread(e)) return t.seen[e.id] ?? 0;
    const inWindow = h.filter((x) => x.at >= cutoff).map((x) => x.version);
    return inWindow.length ? Math.min(...inWindow) - 1 : e.version;
  };

  return (
    <section className={`updates-panel ${unread.length ? "has-unread" : ""}`} aria-labelledby="updates-title">
      <div className="updates-head">
        <h2 id="updates-title">
          <span className="updates-bell"><BellRing size={18} aria-hidden="true" /></span>
          最近の変更<b>{items.length}</b>件
          {unread.length > 0 && <span className="unread-pill">未確認 {unread.length}</span>}
        </h2>
        {unread.length > 0 && <button className="btn btn-small btn-ghost" onClick={markAll}>すべて確認済み</button>}
      </div>
      <p className="updates-note">直近{SHARED_DAYS}日間に変わった予定です（全員に同じものが出ます）。<span className="dot-unread" aria-hidden="true" />オレンジは、この端末でまだ開いていないものです。</p>
      <ul className="updates-list">
        {items.map(({ e, state, drawn, drawnNew, changed, at }) => {
          const h = changed ? history(e.id, e.version) : [];
          const sum = h ? summarize(h, sinceOf(e, state === "unread", h)) : null;
          const phrases = [...(drawn ? [{ text: "🎯 駐車場の抽選結果が出ました", tone: "green" as const }] : []), ...(sum?.phrases ?? [])];
          const isUnread = state === "unread";
          return (
            <li key={e.id}>
              <button className={`update-card ${isUnread ? "is-unread" : "is-seen"} ${e.status === "canceled" || e.status === "postponed" ? "is-stop" : ""}`} onClick={() => open(e, drawnNew && !t.isUnread(e))}>
                <span className="update-when"><b>{dayLabel(e.date)}</b><small>{relativeDay(e.date, today)}</small></span>
                <span className="update-main">
                  <span className="update-top">
                    {isUnread ? <span className="tag-unread">未確認</span> : <span className="tag-seen"><Check size={12} aria-hidden="true" />確認済み</span>}
                    <b className="update-title">{e.title}</b>
                  </span>
                  <span className="update-phrases">
                    {phrases.length ? phrases.slice(0, 4).map((p) => <span key={p.text} className={`phrase tone-${p.tone}`}>{p.text}</span>)
                      : <span className="phrase tone-plain">{!sum ? "読み込み中…" : h && h.length ? "↩ 変更後、元に戻りました" : "内容が変わりました"}</span>}
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
