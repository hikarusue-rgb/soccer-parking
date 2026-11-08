import { useState } from "react";
import { addDays, jstToday } from "../lib/datetime";
import { groupMatches, hasParking, md } from "../lib/matches";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";
import { MatchCard } from "../components/MatchCard";
import { QuickRow } from "../components/QuickRow";

/** 🚗 駐車場：抽選がある予定のカード（旧アプリと同じ今週・翌週・その他・過去）。タップでその予定の「駐車場」へ */
export function ParkingView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const g = groupMatches(t.data.events, today, hasParking);
  const [showOthers, setShowOthers] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const open = (e: TeamEvent) => t.navigate({ name: "event", id: e.id, section: "parking", from: "parking" });
  const cards = (items: TeamEvent[]) => items.map((e) => <MatchCard key={e.id} event={e} onOpen={() => open(e)} />);

  // コーチ：まだ駐車場を設定していない、これからの試合
  const unset = t.coach
    ? t.data.events.filter((e) => e.date >= today && e.date <= addDays(today, 60) && e.kind === "match" && e.status !== "canceled" && !hasParking(e))
    : [];
  const shownUnset = showAll ? unset : unset.slice(0, 4);
  const nothing = !g.thisWeek.items.length && !g.nextWeek.items.length && !g.others.length;

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">PARKING LOTTERY</p>
          <h1 className="page-title">駐車場の抽選</h1>
        </div>
      </section>
      <p className="lead">試合をタップ → お子さんの名前を選ぶ → 参加・駐車場の希望を回答。締切を過ぎると自動で抽選します。</p>

      <section aria-labelledby="this-week">
        <h2 id="this-week" className="week-title">🌟 今週（{md(g.thisWeek.from)}〜{md(g.thisWeek.to)}）</h2>
        {g.thisWeek.items.length ? cards(g.thisWeek.items) : <div className="empty">今週は駐車場の抽選はありません</div>}
      </section>

      <section aria-labelledby="next-week">
        <h2 id="next-week" className="week-title blue">📅 翌週（{md(g.nextWeek.from)}〜{md(g.nextWeek.to)}）</h2>
        {g.nextWeek.items.length ? cards(g.nextWeek.items) : <div className="empty">翌週は駐車場の抽選はありません</div>}
      </section>

      {g.others.length > 0 && (
        <section>
          <button className="fold-btn" onClick={() => setShowOthers((v) => !v)} aria-expanded={showOthers}>📅 その先の抽選（{g.others.length}件） {showOthers ? "▲" : "▼"}</button>
          {showOthers && <div className="fold-body">{cards(g.others)}</div>}
        </section>
      )}

      {t.coach && unset.length > 0 && (
        <section className="coach-box" aria-labelledby="unset-title">
          <h2 id="unset-title" className="coach-box-title">⚙ 駐車場を設定する（コーチ）</h2>
          <p className="muted">予定を選んで台数を入れるだけで受付が始まります。{nothing && "まだ抽選中の予定はありません。"}</p>
          <div className="quick-list">
            {shownUnset.map((e) => <QuickRow key={e.id} event={e} today={today} action="台数を設定" onOpen={() => open(e)} />)}
          </div>
          {unset.length > shownUnset.length && <button className="btn btn-small btn-ghost" onClick={() => setShowAll(true)}>ほかの予定も表示（{unset.length - shownUnset.length}件）</button>}
        </section>
      )}

      {g.past.length > 0 && (
        <section>
          <button className="fold-btn" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>📦 終わった抽選（{g.past.length}件） {showPast ? "▲" : "▼"}</button>
          {showPast && <div className="fold-body">{cards(g.past)}</div>}
        </section>
      )}

    </>
  );
}
