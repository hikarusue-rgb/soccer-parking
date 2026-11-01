import { useState } from "react";
import { ChevronLeft, ExternalLink, Pencil, Plus } from "lucide-react";
import { jstToday } from "../lib/datetime";
import { blankDraft, type EventDraft } from "../lib/eventForm";
import { draftFromTournament, safeUrl, type TournamentDraft } from "../lib/tournamentForm";
import { useTeam } from "../lib/teamContext";
import { AttachmentList } from "../components/AttachmentList";
import { EventEditor } from "../components/EventEditor";
import { EventRow } from "../components/EventRow";
import { TournamentEditor } from "../components/TournamentEditor";
import { periodLabel } from "./TournamentsView";

export function TournamentDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTeam();
  const tournament = t.data.tournaments.find((x) => x.id === id);
  const [editor, setEditor] = useState<TournamentDraft | null>(null);
  const [matchEditor, setMatchEditor] = useState<EventDraft | null>(null);
  const today = jstToday(t.now);

  if (!tournament) {
    return (
      <article className="detail">
        <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />大会一覧へ</button>
        <div className="empty">この大会は見つかりません。削除された可能性があります。</div>
      </article>
    );
  }

  const matches = t.data.events.filter((e) => e.tournamentId === tournament.id);
  const url = safeUrl(tournament.officialUrl);

  function addMatch() {
    setMatchEditor({ ...blankDraft(today), kind: "match", title: tournament!.name, tournamentId: tournament!.id });
  }

  return (
    <article className="detail">
      <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />大会一覧へ</button>
      <header className="detail-head">
        <p className="detail-date">🏆 {periodLabel(tournament)}</p>
        <h1 className="detail-title">{tournament.name}</h1>
        {tournament.organizer && <p className="muted">主催：{tournament.organizer}</p>}
        {t.coach && (
          <div className="coach-actions">
            <button className="btn btn-primary" onClick={() => setEditor(draftFromTournament(tournament))}><Pencil size={16} aria-hidden="true" />大会を編集</button>
            <button className="btn" onClick={addMatch}><Plus size={16} aria-hidden="true" />この大会の試合を追加</button>
          </div>
        )}
      </header>

      <section className="detail-card" aria-labelledby="t-docs-title">
        <h2 id="t-docs-title">📄 大会共通の要項</h2>
        {tournament.regulations && (<><p className="field-label">基本レギュレーション</p><p className="preline">{tournament.regulations}</p></>)}
        {tournament.notes && (<><p className="field-label">共通の注意事項</p><p className="preline">{tournament.notes}</p></>)}
        <AttachmentList items={tournament.attachments} />
        {url && <a className="btn btn-small" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />公式サイトを開く</a>}
        {!tournament.regulations && !tournament.notes && !tournament.attachments.length && !url && <p className="muted">共通の要項はまだ登録されていません。</p>}
      </section>

      <section aria-labelledby="t-matches-title">
        <div className="section-head">
          <h2 id="t-matches-title" className="section-title">この大会の試合</h2>
          <span className="section-sub">{matches.length}件</span>
        </div>
        {matches.length ? (
          <ul className="event-list">
            {matches.map((e) => (
              <li key={e.id}>
                <EventRow event={e} today={today} unread={t.isUnread(e)} parking={t.parkingOf(e)} hasDocs={t.hasDocs(e)} onOpen={() => t.navigate({ name: "event", id: e.id, from: "tournaments" })} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">まだ試合が紐付いていません。{t.coach && "予定の編集で大会を選ぶか、「この大会の試合を追加」から登録できます。"}</div>
        )}
      </section>

      {editor && (
        <TournamentEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => setEditor(null)}
          onDeleted={() => { setEditor(null); t.navigate({ name: "tournaments" }, { replace: true }); }}
        />
      )}
      {matchEditor && (
        <EventEditor initial={matchEditor} onClose={() => setMatchEditor(null)} onSaved={(eventId) => { setMatchEditor(null); t.navigate({ name: "event", id: eventId, from: "tournaments" }); }} />
      )}
    </article>
  );
}
