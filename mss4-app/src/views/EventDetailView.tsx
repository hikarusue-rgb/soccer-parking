import { useState } from "react";
import { ChevronLeft, Copy, Pencil, Share2 } from "lucide-react";
import { dateTimeLabel, dayLabel, jstToday, relativeDay } from "../lib/datetime";
import { draftFromEvent, type EventDraft } from "../lib/eventForm";
import { isInactive } from "../lib/eventView";
import { createIcs, downloadIcs, googleCalendarUrl } from "../lib/ics";
import { useTeam } from "../lib/teamContext";
import { STATUS_LABELS, type TeamEvent } from "../lib/types";
import { AttachmentList } from "../components/AttachmentList";
import { ChangeHistory } from "../components/ChangeHistory";
import { EventBadges } from "../components/EventBadges";
import { EventEditor } from "../components/EventEditor";
import { ParkingSection } from "../components/ParkingSection";

const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export function EventDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTeam();
  const event = t.data.events.find((e) => e.id === id);
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!event) {
    return (
      <article className="detail">
        <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />一覧</button>
        <div className="empty">この予定は見つかりません。削除されたか、URLが違う可能性があります。</div>
      </article>
    );
  }

  const today = jstToday(t.now);
  const isMatch = event.kind === "match";
  const hasParking = event.kind !== "notice" && event.parking.mode === "lottery" && event.parking.limit > 0;

  async function share(e: TeamEvent) {
    const url = t.eventUrl(e);
    const text = `${dayLabel(e.date)} ${e.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("この試合のリンクをコピーしました。LINEに貼り付けて共有できます。");
    } catch {
      /* 共有をキャンセルした場合など */
    }
  }

  return (
    <article className="detail">
      <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />一覧</button>

      <header className="detail-head">
        <p className="detail-date">{dayLabel(event.date)}<small>{relativeDay(event.date, today)}</small></p>
        <EventBadges event={event} unread={t.isUnread(event)} parking={t.parkingOf(event)} hasDocs={t.hasDocs(event)} />
        <h1 className={`detail-title ${event.status === "canceled" ? "is-canceled" : ""}`}>{event.title}</h1>
        {t.coach && (
          <div className="coach-actions">
            <button className="btn btn-primary" onClick={() => setEditor(draftFromEvent(event))}><Pencil size={16} aria-hidden="true" />{isMatch ? "試合を編集" : "予定を編集"}</button>
            <button className="btn" onClick={() => setEditor(draftFromEvent(event, { duplicate: true }))}><Copy size={16} aria-hidden="true" />複製</button>
          </div>
        )}
      </header>

      {event.status !== "scheduled" && (
        <div className={`change-banner ${isInactive(event) ? "is-stop" : ""}`}>☔ 開催状況：{STATUS_LABELS[event.status]}{isInactive(event) && "（集合不要・再案内を確認してください）"}</div>
      )}

      <ChangeHistory event={event} />

      <Yokou event={event} />

      {hasParking ? <ParkingSection event={event} /> : isMatch && <p className="muted center">🚗 この試合は駐車場の抽選はありません。</p>}

      <div className="detail-tools">
        <button className="btn btn-small" onClick={() => share(event)}><Share2 size={15} aria-hidden="true" />この{isMatch ? "試合" : "予定"}をLINEで共有</button>
      </div>
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

/** 📋 要項（旧アプリの要項カードと同じ並び。練習・連絡は必要な項目だけ） */
function Yokou({ event: e }: { event: TeamEvent }) {
  const t = useTeam();
  const isMatch = e.kind === "match";
  const u = e.uniform;
  const times = [
    ["⏰ 集合", e.meeting],
    ["🏆 キックオフ", e.kickoff],
    ["▶ 開始", e.start],
    ["🏁 終了予定", e.end],
  ].filter(([, v]) => v) as [string, string][];
  const hasUniform = Boolean(u.top || u.bottom || u.socks);
  const hasAny = Boolean(e.opponent || e.venue || times.length || hasUniform || e.note || e.messages.length || e.attachments.length || e.details.format || e.details.referee || e.details.venueNotes);

  return (
    <section className="yokou" aria-labelledby="yokou-title">
      <h2 id="yokou-title">📋 {isMatch ? "要項" : "詳細"}</h2>
      {e.opponent && e.opponent !== e.title && (
        <div className="yk-item"><small>🆚 対戦相手</small><b>{e.opponent}</b></div>
      )}
      {e.venue && (
        <div className="yk-item">
          <small>📍 {isMatch ? "会場" : "場所"}</small>
          <b>{e.venue}</b>
          <a className="btn btn-small btn-block map-btn" href={mapUrl(`${e.venue} 駐車場`)} target="_blank" rel="noopener noreferrer">🗺 {isMatch ? "会場" : "場所"} & 周辺の駐車場をマップで見る</a>
        </div>
      )}
      {times.length > 0 && (
        <div className="yk-tiles">
          {times.map(([label, value]) => <div key={label} className="yk-tile"><small>{label}</small><b>{value}</b></div>)}
        </div>
      )}
      {!times.length && <div className="yk-item"><small>⏰ 時間</small><b>未定</b></div>}
      {hasUniform && (
        <div className="yk-item">
          <small>👕 ユニフォーム</small>
          <div className="yk-tiles">
            {([["👕 上", u.top], ["🩳 下", u.bottom], ["🧦 靴下", u.socks]] as const).map(([label, value]) => (
              <div key={label} className="yk-tile"><small>{label}</small><b>{value || "—"}</b></div>
            ))}
          </div>
        </div>
      )}
      {e.details.format && <div className="yk-item"><small>⚽ 試合形式</small><b>{e.details.format}</b></div>}
      {e.details.referee && <div className="yk-item"><small>🟨 審判割当</small><p className="preline">{e.details.referee}</p></div>}
      {e.details.venueNotes && <div className="yk-item"><small>⚠️ 会場・駐車の注意事項</small><p className="preline">{e.details.venueNotes}</p></div>}
      {(e.messages.length > 0 || e.note) && (
        <div className="yk-item">
          <small>📝 備考・チームからの連絡</small>
          {e.messages.map((m) => <p key={m}>{m}</p>)}
          {e.note && <p className="preline">{e.note}</p>}
        </div>
      )}
      {e.equipmentConfirmed && <div className="yk-item"><small>🎒 持ち物</small><b>{e.equipment.join("・") || "指定なし"}</b></div>}
      {e.attachments.length > 0 && (
        <div className="yk-item">
          <small>📄 要項・当日資料</small>
          <AttachmentList items={e.attachments} />
        </div>
      )}
      <div className="yk-item">
        <small>📅 カレンダーに追加</small>
        <div className="inline-row">
          <a className="btn btn-small" href={googleCalendarUrl(e, t.eventUrl(e))} target="_blank" rel="noopener noreferrer">🅖 Googleカレンダー</a>
          <button className="btn btn-small" onClick={() => downloadIcs(`mss4-${e.date}.ics`, createIcs([e], "MSS・香澄 4年生", t.eventUrl))}>📥 .ics ダウンロード</button>
        </div>
        <p className="muted">※ iPhone の標準カレンダーは .ics をご利用ください</p>
      </div>
      {!hasAny && <p className="muted center">※ 要項はまだ未入力です</p>}
    </section>
  );
}
