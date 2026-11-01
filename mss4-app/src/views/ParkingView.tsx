import { useState } from "react";
import { Plus } from "lucide-react";
import { jstToday } from "../lib/datetime";
import { blankDraft, type EventDraft } from "../lib/eventForm";
import { groupMatches, md } from "../lib/matches";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";
import { EventEditor } from "../components/EventEditor";
import { MatchCard } from "../components/MatchCard";
import { RosterEditor } from "../components/RosterEditor";

/** 🚗 駐車場抽選：旧アプリと同じく、試合ごとのカードから試合の画面（要項・駐車場の申込）へ進む */
export function ParkingView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const g = groupMatches(t.data.events, today);
  const [showOthers, setShowOthers] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const open = (e: TeamEvent) => t.navigate({ name: "event", id: e.id, from: "parking" });
  const cards = (items: TeamEvent[]) => items.map((e) => <MatchCard key={e.id} event={e} onOpen={() => open(e)} />);

  return (
    <>
      <section className="parking-hero">
        <div className="parking-hero-icon" aria-hidden="true">🏆</div>
        <h1>駐車場 抽選</h1>
        <p>MSS香澄 4年生</p>
        {t.coach && (
          <button className="btn btn-primary" onClick={() => setEditor({ ...blankDraft(today), kind: "match", title: "練習試合（TM）" })}>
            <Plus size={18} aria-hidden="true" />試合を追加
          </button>
        )}
      </section>

      <section aria-labelledby="this-week">
        <h2 id="this-week" className="week-title">🌟 今週の試合（{md(g.thisWeek.from)}・{md(g.thisWeek.to)}）</h2>
        {g.thisWeek.items.length ? cards(g.thisWeek.items) : <div className="empty">今週の試合はありません</div>}
      </section>

      <section aria-labelledby="next-week">
        <h2 id="next-week" className="week-title blue">📅 翌週の試合（{md(g.nextWeek.from)}・{md(g.nextWeek.to)}）</h2>
        {g.nextWeek.items.length ? cards(g.nextWeek.items) : <div className="empty">翌週の試合はありません</div>}
      </section>

      {g.others.length > 0 && (
        <section>
          <button className="fold-btn" onClick={() => setShowOthers((v) => !v)} aria-expanded={showOthers}>📅 その他の試合（{g.others.length}件） {showOthers ? "▲" : "▼"}</button>
          {showOthers && <div className="fold-body">{cards(g.others)}</div>}
        </section>
      )}

      {g.past.length > 0 && (
        <section>
          <button className="fold-btn" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>📦 過去の試合（{g.past.length}件） {showPast ? "▲" : "▼"}</button>
          {showPast && <div className="fold-body">{cards(g.past)}</div>}
        </section>
      )}

      {t.coach && (
        <section>
          <button className="fold-btn" onClick={() => setShowRoster((v) => !v)} aria-expanded={showRoster}>👦 名簿の管理（コーチ） {showRoster ? "▲" : "▼"}</button>
          {showRoster && <div className="fold-body"><RosterEditor /></div>}
        </section>
      )}

      {editor && (
        <EventEditor initial={editor} onClose={() => setEditor(null)} onSaved={(id) => { setEditor(null); t.navigate({ name: "event", id, from: "parking" }); }} />
      )}
    </>
  );
}
