import { BellRing, ChevronDown, ChevronRight } from "lucide-react";
import { dayLabel } from "../lib/datetime";
import { isInitialOnly, lotteryKey, SHARED_DAYS } from "../lib/seen";
import { useTeam } from "../lib/teamContext";
import { summarize, useHistories } from "../lib/updates";
import type { HistoryItem } from "../lib/changes";
import type { TeamEvent } from "../lib/types";


/**
 * 予定タブのいちばん上：「最近の変更」
 *  ・全員共通：直近3日間に追加・変更された予定と抽選結果（だれが見ても同じ並び）
 *  ・個人：この端末でまだ見ていないものはオレンジで「未確認」（見たら白に戻る）
 */
export function UpdatesPanel() {
  const t = useTeam();
  const cutoff = t.now - SHARED_DAYS * 86_400_000;
  const items = t.data.events
    .map((e) => {
      const lottery = t.data.lotteries[e.id];
      const state = t.updateState(e);
      const changedAt = isInitialOnly(e) ? 0 : e.updatedAt;
      const drawnAt = lottery?.updatedAt ?? 0;
      const drawnNew = t.isLotteryUnread(e);
      const drawn = drawnNew || drawnAt >= cutoff;
      return { e, state, drawn, drawnNew, changed: t.isUnread(e) || changedAt >= cutoff, at: Math.max(changedAt, drawn ? drawnAt : 0) };
    })
    .filter((x) => x.state !== null)
    .sort((a, b) => Number(b.state === "unread") - Number(a.state === "unread") || b.at - a.at);
  const unread = items.filter((x) => x.state === "unread");
  const history = useHistories(t.grade, items.filter((x) => x.changed).map(({ e }) => ({ id: e.id, version: e.version })));

  // 変わった予定がなければ何も出さない（画面を広く使う）
  if (!items.length) return null;

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

  // ふだんは1行にたたんでおく（開くと1件1行の一覧）
  return (
    <details className={`updates-bar ${unread.length ? "has-unread" : ""}`}>
      <summary>
        <BellRing size={16} aria-hidden="true" />
        <span>最近の変更 <b>{items.length}</b>件</span>
        {unread.length > 0 && <span className="unread-pill">未確認 {unread.length}</span>}
        <ChevronDown size={16} aria-hidden="true" className="updates-chev" />
      </summary>
      <ul className="upd-list">
        {items.map(({ e, state, drawn, drawnNew, changed }) => {
          const h = changed ? history(e.id, e.version) : [];
          const sum = h ? summarize(h, sinceOf(e, state === "unread", h)) : null;
          const phrases = [...(drawn ? ["🎯 抽選結果"] : []), ...(sum?.phrases.map((p) => p.text) ?? [])];
          return (
            <li key={e.id}>
              <button className={`upd-row ${state === "unread" ? "is-unread" : ""}`} onClick={() => open(e, drawnNew && !t.isUnread(e))}>
                <span className="upd-date">{dayLabel(e.date)}</span>
                <span className="upd-main"><b>{e.title}</b><small>{phrases.length ? phrases.slice(0, 2).join("・") + (phrases.length > 2 ? ` ほか${phrases.length - 2}` : "") : sum ? "内容が変わりました" : "…"}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="upd-foot">
        <small className="muted">直近{SHARED_DAYS}日間に変わった予定（オレンジ＝まだ開いていないもの）</small>
        {unread.length > 0 && <button className="btn btn-small btn-ghost" onClick={markAll}>すべて確認済み</button>}
      </div>
    </details>
  );
}
