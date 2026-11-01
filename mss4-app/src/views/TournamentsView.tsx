import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { dayLabel, jstToday } from "../lib/datetime";
import { blankTournament, type TournamentDraft } from "../lib/tournamentForm";
import { useTeam } from "../lib/teamContext";
import type { Tournament } from "../lib/types";
import { TournamentEditor } from "../components/TournamentEditor";

export const periodLabel = (t: Tournament) =>
  t.startDate ? `${dayLabel(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ` 〜 ${dayLabel(t.endDate)}` : ""}` : "期間未定";

export function TournamentsView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const [editor, setEditor] = useState<TournamentDraft | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = t.data.tournaments.filter((x) => !x.archived);
  const archived = t.data.tournaments.filter((x) => x.archived);

  const card = (x: Tournament) => {
    const matches = t.data.events.filter((e) => e.tournamentId === x.id);
    const next = matches.find((e) => e.date >= today);
    return (
      <li key={x.id}>
        <button className="event-row" onClick={() => t.navigate({ name: "tournament", id: x.id })}>
          <span className="event-main">
            <span className="badges">
              <span className="badge kind-match">{matches.length}試合</span>
              {x.attachments.length > 0 && <span className="badge badge-docs">📄 要項 {x.attachments.length}件</span>}
            </span>
            <b className="event-title">{x.name}</b>
            <span className="event-meta">{periodLabel(x)}{x.organizer && `・${x.organizer}`}</span>
            {next && <span className="event-meta">次の試合：{dayLabel(next.date)} {next.title}</span>}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">TOURNAMENTS</p>
          <h1 className="page-title">大会・要項</h1>
        </div>
        {t.coach && <button className="btn btn-primary" onClick={() => setEditor(blankTournament())}><Plus size={18} aria-hidden="true" />大会を追加</button>}
      </section>
      <p className="muted">大会ごとの共通要項・レギュレーション・公式URLと、その大会の試合をまとめて確認できます。</p>
      {active.length ? <ul className="event-list">{active.map(card)}</ul> : (
        <div className="empty">登録された大会はまだありません。{t.coach && "「大会を追加」から、リーグ戦などの共通要項を登録できます。"}</div>
      )}
      {archived.length > 0 && (
        <section>
          <button className="btn btn-small btn-ghost" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? "終了した大会を隠す" : `終了した大会（${archived.length}件）を表示`}
          </button>
          {showArchived && <ul className="event-list">{archived.map(card)}</ul>}
        </section>
      )}
      {editor && (
        <TournamentEditor initial={editor} onClose={() => setEditor(null)} onSaved={(id) => { setEditor(null); t.navigate({ name: "tournament", id }); }} />
      )}
    </>
  );
}
