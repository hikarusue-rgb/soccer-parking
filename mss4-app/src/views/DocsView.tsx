import { useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { dayLabel, jstToday } from "../lib/datetime";
import { draftFromEvent, type EventDraft } from "../lib/eventForm";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";
import { AttachmentList } from "../components/AttachmentList";
import { EventEditor } from "../components/EventEditor";

/** 🏆 大会・要項：試合ごとの要項（試合形式・注意事項・資料）を一覧で見る。各試合の画面とつながっている */
export function DocsView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const [showPast, setShowPast] = useState(false);
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const matches = t.data.events.filter((e) => e.kind === "match");
  const upcoming = matches.filter((e) => e.date >= today);
  const past = matches.filter((e) => e.date < today).reverse();

  const card = (e: TeamEvent) => {
    const d = e.details;
    const empty = !e.attachments.length && !d.format && !d.referee && !d.venueNotes;
    return (
      <article key={e.id} className="doc-card">
        <header className="doc-card-head">
          <span>
            <b>{e.title}</b>
            <small>🗓 {dayLabel(e.date)}{e.venue && `・📍 ${e.venue}`}</small>
          </span>
          {t.coach && (
            <button className="btn btn-small" onClick={() => setEditor(draftFromEvent(e))}><Pencil size={14} aria-hidden="true" />要項を編集</button>
          )}
        </header>
        {d.format && <p className="doc-line"><span>試合形式</span>{d.format}</p>}
        {d.referee && <p className="doc-line preline"><span>審判割当</span>{d.referee}</p>}
        {d.venueNotes && <p className="doc-line preline"><span>会場・駐車の注意</span>{d.venueNotes}</p>}
        <AttachmentList items={e.attachments} />
        {empty && <p className="muted">要項はまだありません。{t.coach && "「要項を編集」から資料をアップロードできます。"}</p>}
        <button className="doc-open" onClick={() => t.navigate({ name: "event", id: e.id, from: "tournaments" })}>
          試合の画面（駐車場の申込・詳細）を開く<ChevronRight size={16} aria-hidden="true" />
        </button>
      </article>
    );
  };

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">MATCH GUIDELINES</p>
          <h1 className="page-title">大会・要項</h1>
        </div>
      </section>
      <p className="muted">試合ごとの要項（大会要項・タイムテーブル・コート図など）です。駐車場の申込は各試合の画面からできます。</p>
      {upcoming.length ? upcoming.map(card) : <div className="empty">これからの試合はまだありません。</div>}
      {past.length > 0 && (
        <section>
          <button className="fold-btn" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>📦 過去の試合の要項（{past.length}件） {showPast ? "▲" : "▼"}</button>
          {showPast && <div className="fold-body">{past.map(card)}</div>}
        </section>
      )}
      {editor && <EventEditor initial={editor} onClose={() => setEditor(null)} onSaved={() => setEditor(null)} />}
    </>
  );
}
