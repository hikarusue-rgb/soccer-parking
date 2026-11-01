import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { addDays, dayLabel, jstToday, relativeDay } from "../lib/datetime";
import { hasDocs } from "../lib/matches";
import { useTeam } from "../lib/teamContext";
import { KIND_LABELS, type TeamEvent } from "../lib/types";
import { QuickRow } from "../components/QuickRow";

/** 📄 要項：要項が届いている予定の一覧。タップでその予定の「要項」へ。コーチは予定を選んでそのまま資料を追加 */
export function DocsView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const [showPast, setShowPast] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const withDocs = t.data.events.filter(hasDocs);
  const upcoming = withDocs.filter((e) => e.date >= today);
  const past = withDocs.filter((e) => e.date < today).reverse();
  const open = (e: TeamEvent) => t.navigate({ name: "event", id: e.id, section: "docs", from: "tournaments" });

  // コーチ：要項がまだの、これからの試合・イベント（練習は後ろへ）
  const missing = t.coach
    ? t.data.events
        .filter((e) => e.date >= today && e.date <= addDays(today, 60) && e.kind !== "notice" && e.status !== "canceled" && !hasDocs(e))
        .sort((a, b) => Number(a.kind === "practice") - Number(b.kind === "practice") || a.date.localeCompare(b.date))
    : [];
  const shownMissing = showAll ? missing : missing.slice(0, 4);

  const card = (e: TeamEvent) => {
    const d = e.details;
    const images = e.attachments.filter((a) => a.type === "image");
    const pdfs = e.attachments.length - images.length;
    const parts = [images.length > 0 && `🖼 画像${images.length}`, pdfs > 0 && `📑 PDF${pdfs}`, Boolean(d.referee || d.venueNotes) && "📝 注意事項"].filter(Boolean);
    return (
      <button key={e.id} className="doc-card" onClick={() => open(e)}>
        <span className="doc-card-head">
          <span className="quick-date"><b>{dayLabel(e.date)}</b><small>{relativeDay(e.date, today)}</small></span>
          <span className={`badge kind-${e.kind}`}>{KIND_LABELS[e.kind]}</span>
        </span>
        <b className="doc-title">{e.title}</b>
        {d.format && <span className="doc-line"><span>試合形式</span>{d.format}</span>}
        {images.length > 0 && (
          <span className="doc-thumbs">
            {images.slice(0, images.length > 3 ? 2 : 3).map((a) => <img key={a.id} src={a.url} alt="" loading="lazy" />)}
            {images.length > 3 && <span className="doc-more">+{images.length - 2}</span>}
          </span>
        )}
        <span className="doc-foot">
          <span>{parts.join("・") || "📝 要項"}</span>
          <span className="quick-action">要項を見る<ChevronRight size={16} aria-hidden="true" /></span>
        </span>
      </button>
    );
  };

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">GUIDELINES</p>
          <h1 className="page-title">大会・要項</h1>
        </div>
      </section>
      <p className="lead">大会要項・タイムテーブル・コート図など、予定ごとの資料です。</p>

      {upcoming.length ? <div className="doc-grid">{upcoming.map(card)}</div> : <div className="empty">これからの予定に、届いている要項はまだありません。</div>}

      {t.coach && missing.length > 0 && (
        <section className="coach-box" aria-labelledby="missing-title">
          <h2 id="missing-title" className="coach-box-title">⚙ 要項を追加する（コーチ）</h2>
          <p className="muted">予定を選んで、写真やPDFをそのままアップロードできます。</p>
          <div className="quick-list">
            {shownMissing.map((e) => <QuickRow key={e.id} event={e} today={today} action="要項を追加" onOpen={() => open(e)} />)}
          </div>
          {missing.length > shownMissing.length && <button className="btn btn-small btn-ghost" onClick={() => setShowAll(true)}>ほかの予定も表示（{missing.length - shownMissing.length}件）</button>}
        </section>
      )}

      {past.length > 0 && (
        <section>
          <button className="fold-btn" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>📦 過去の要項（{past.length}件） {showPast ? "▲" : "▼"}</button>
          {showPast && <div className="fold-body doc-grid">{past.map(card)}</div>}
        </section>
      )}
    </>
  );
}
