import { useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Pencil, Share2 } from "lucide-react";
import { dateTimeLabel, dayLabel, jstToday, relativeDay } from "../lib/datetime";
import { draftFromEvent, type EventDraft } from "../lib/eventForm";
import { isInactive } from "../lib/eventView";
import { createIcs, downloadIcs, googleCalendarUrl } from "../lib/ics";
import { useTeam } from "../lib/teamContext";
import { KIND_LABELS, STATUS_LABELS, type TeamEvent } from "../lib/types";
import { AttachmentList } from "../components/AttachmentList";
import { ChangeHistory } from "../components/ChangeHistory";
import { EventBadges } from "../components/EventBadges";
import { EventEditor } from "../components/EventEditor";
import { ParkingPanel } from "../components/ParkingPanel";

const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export function EventDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTeam();
  const event = t.data.events.find((e) => e.id === id);
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!event) {
    return (
      <article className="detail">
        <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />戻る</button>
        <div className="empty">この予定は見つかりません。削除されたか、URLが違う可能性があります。</div>
      </article>
    );
  }

  const today = jstToday(t.now);
  const tournament = t.tournamentOf(event);
  const inactive = isInactive(event);
  const parking = t.parkingOf(event);
  const u = event.uniform;
  const uniform = u.top || u.bottom || u.socks
    ? u.top && u.top === u.bottom && u.bottom === u.socks ? `${u.top}（上下・靴下とも）` : `上 ${u.top || "未確認"}／下 ${u.bottom || "未確認"}／靴下 ${u.socks || "未確認"}`
    : "未確認";
  const hasDetails = Boolean(event.details.format || event.details.referee || event.details.venueNotes);

  async function share(e: TeamEvent) {
    const url = t.eventUrl(e);
    const text = `${dayLabel(e.date)} ${e.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("予定のリンクをコピーしました。LINEに貼り付けて共有できます。");
    } catch {
      /* 共有をキャンセルした場合など */
    }
  }

  return (
    <article className="detail">
      <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />戻る</button>

      <header className="detail-head">
        <p className="detail-date">{dayLabel(event.date)}<small>{relativeDay(event.date, today)}</small></p>
        <EventBadges event={event} unread={t.isUnread(event)} parking={parking} hasDocs={t.hasDocs(event)} />
        <h1 className={`detail-title ${event.status === "canceled" ? "is-canceled" : ""}`}>{event.title}</h1>
        {t.coach && (
          <div className="coach-actions">
            <button className="btn btn-primary" onClick={() => setEditor(draftFromEvent(event))}><Pencil size={16} aria-hidden="true" />この予定を編集</button>
            <button className="btn" onClick={() => setEditor(draftFromEvent(event, { duplicate: true }))}><Copy size={16} aria-hidden="true" />複製</button>
          </div>
        )}
      </header>

      <ChangeHistory event={event} />

      <dl className="detail-list">
        <dt>開催時間</dt>
        <dd>{event.start && event.end ? `${event.start}–${event.end}` : event.start ? `${event.start}〜` : event.end ? `〜${event.end}` : "未定"}</dd>
        {event.kind !== "notice" && (<><dt>集合</dt><dd>{inactive ? "集合不要・再案内を確認" : event.meeting ?? "未確認"}</dd></>)}
        {event.kind === "match" && (<><dt>キックオフ</dt><dd>{event.kickoff ?? "未確認"}</dd></>)}
        <dt>場所</dt>
        <dd>
          {event.venue || "未定"}
          {event.venue && (
            <span className="map-links">
              <a className="btn btn-small" href={mapUrl(event.venue)} target="_blank" rel="noopener noreferrer">🗺 会場の地図</a>
              <a className="btn btn-small" href={mapUrl(`${event.venue} 駐車場`)} target="_blank" rel="noopener noreferrer">🅿️ 周辺の駐車場</a>
            </span>
          )}
        </dd>
        {event.opponent && (<><dt>対戦相手</dt><dd>{event.opponent}</dd></>)}
        {event.kind !== "notice" && (<><dt>ユニフォーム</dt><dd>{uniform}</dd></>)}
        {event.kind !== "notice" && (
          <>
            <dt>持ち物</dt>
            <dd>
              {event.equipmentConfirmed ? event.equipment.join("・") || "指定なし" : "未確認"}
              {!event.equipmentConfirmed && event.equipment.length > 0 && <small className="muted">候補：{event.equipment.join("・")}</small>}
            </dd>
          </>
        )}
        <dt>開催状況</dt><dd>{STATUS_LABELS[event.status]}</dd>
        <dt>種別</dt><dd>{KIND_LABELS[event.kind]}</dd>
      </dl>

      <section className="detail-card" aria-labelledby="message-title">
        <h2 id="message-title">チームからの連絡</h2>
        {event.messages.map((m) => <p key={m}>{m}</p>)}
        {event.note ? <p className="preline">{event.note}</p> : !event.messages.length && <p className="muted">追加の連絡はありません。</p>}
      </section>

      <section className="detail-card" aria-labelledby="docs-title">
        <h2 id="docs-title">📄 試合要項・当日資料</h2>
        {hasDetails && (
          <dl className="detail-list compact">
            {event.details.format && (<><dt>試合形式</dt><dd>{event.details.format}</dd></>)}
            {event.details.referee && (<><dt>審判割当</dt><dd className="preline">{event.details.referee}</dd></>)}
            {event.details.venueNotes && (<><dt>会場・駐車の注意</dt><dd className="preline">{event.details.venueNotes}</dd></>)}
          </dl>
        )}
        <AttachmentList title="この日の当日資料" items={event.attachments} />
        {tournament && (
          <div className="tournament-docs">
            <button className="tournament-link" onClick={() => t.navigate({ name: "tournament", id: tournament.id })}>
              <span>
                <small>🏆 大会共通の要項</small>
                <b>{tournament.name}</b>
                {tournament.regulations && <span className="muted clamp-2">{tournament.regulations}</span>}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <AttachmentList items={tournament.attachments} />
          </div>
        )}
        {!hasDetails && !tournament && !event.attachments.length && <p className="muted">要項・資料はまだありません。</p>}
      </section>

      {event.parking.mode === "lottery" && <ParkingPanel event={event} />}

      <section className="detail-tools" aria-label="カレンダー・共有">
        <button className="btn btn-small" onClick={() => downloadIcs(`mss4-${event.date}.ics`, createIcs([event], "MSS・香澄 4年生", t.eventUrl))}>
          <CalendarPlus size={15} aria-hidden="true" />カレンダーに追加（.ics）
        </button>
        <a className="btn btn-small" href={googleCalendarUrl(event, t.eventUrl(event))} target="_blank" rel="noopener noreferrer">Googleカレンダーに追加</a>
        <button className="btn btn-small" onClick={() => share(event)}><Share2 size={15} aria-hidden="true" />この予定を共有</button>
      </section>
      {notice && <p className="alert alert-info" role="status">{notice}</p>}

      <p className="updated">更新 {event.updatedAt ? dateTimeLabel(event.updatedAt) : "—"}・{event.updatedBy}</p>

      {editor && (
        <EventEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={(savedId) => { setEditor(null); if (savedId !== event.id) t.navigate({ name: "event", id: savedId, from: "home" }); }}
          onDeleted={() => { setEditor(null); t.navigate({ name: "home" }, { replace: true }); }}
        />
      )}
    </article>
  );
}
