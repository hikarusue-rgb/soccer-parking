import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clock, Download, List, MapPin, Plus } from "lucide-react";
import { addDays, dayLabel, jstToday, relativeDay, shiftMonth } from "../lib/datetime";
import { timeSummary } from "../lib/eventView";
import { blankDraft, type EventDraft } from "../lib/eventForm";
import { createIcs, downloadIcs } from "../lib/ics";
import type { EventSection } from "../lib/route";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";
import { EventBadges } from "../components/EventBadges";
import { EventEditor } from "../components/EventEditor";
import { EventRow } from "../components/EventRow";
import { UpdatesPanel } from "../components/UpdatesPanel";
import { MonthCalendar } from "../components/MonthCalendar";

export function HomeView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState<"month" | "list">("month");
  const [day, setDay] = useState<string | null>(null);
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const events = t.data.events;

  const upcoming = useMemo(() => events.filter((e) => e.date >= today && e.date <= addDays(today, 90)).slice(0, 3), [events, today]);
  const monthEvents = events.filter((e) => e.date.startsWith(month));
  const listed = day ? events.filter((e) => e.date === day) : view === "list" ? monthEvents : [];
  const open = (e: TeamEvent, section?: EventSection) => t.navigate({ name: "event", id: e.id, section, from: "home" });

  function changeMonth(delta: number | "today") {
    setMonth(delta === "today" ? today.slice(0, 7) : shiftMonth(month, delta));
    setDay(delta === "today" ? today : null);
  }

  function saveMonthIcs() {
    const target = monthEvents;
    if (!target.length) return;
    downloadIcs(`mss4-${month}.ics`, createIcs(target, `MSS・香澄 ${t.data.meta.gradeLabel || "4年生"}`, t.eventUrl));
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">MSS KASUMI · TEAM SCHEDULE</p>
          <h1 className="page-title">チームの予定</h1>
        </div>
        {t.coach && (
          <button className="btn btn-primary" onClick={() => setEditor(blankDraft(day && day >= today ? day : today))}>
            <Plus size={18} aria-hidden="true" />予定を追加
          </button>
        )}
      </section>

      <UpdatesPanel />

      <section aria-labelledby="upcoming-title">
        <div className="section-head">
          <h2 id="upcoming-title" className="section-title">これからの予定</h2>
          <span className="section-sub">直近3件</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty">これから90日以内の予定はまだありません。</div>
        ) : (
          <div className="upcoming-grid">
            {upcoming.map((e, i) => {
              const parking = t.parkingOf(e);
              const docs = t.hasDocs(e);
              const canPark = e.kind !== "notice";
              return (
                <div key={e.id} className={`upcoming-wrap ${i === 0 ? "is-first" : ""}`}>
                  <button className={`upcoming-card upcoming-${e.kind} ${i === 0 ? "is-first" : ""} ${e.status === "canceled" ? "is-canceled" : ""} ${t.isUnread(e) || t.isLotteryUnread(e) ? "is-updated" : ""}`} onClick={() => open(e)}>
                    <span className="upcoming-date"><b>{dayLabel(e.date)}</b><small>{relativeDay(e.date, today)}</small></span>
                    <EventBadges event={e} unread={t.isUnread(e) || t.isLotteryUnread(e)} />
                    <span className="upcoming-title">{e.title}</span>
                    <span className="event-meta"><Clock size={15} aria-hidden="true" />{timeSummary(e)}</span>
                    <span className="event-meta"><MapPin size={15} aria-hidden="true" />{e.venue || "場所未定"}</span>
                  </button>
                  {(parking || docs || (t.coach && canPark)) && (
                    <div className="card-actions">
                      {parking ? (
                        <button className={`chip-link parking-${parking.phase}`} onClick={() => open(e, "parking")}>{parking.label}<ChevronRight size={15} aria-hidden="true" /></button>
                      ) : t.coach && canPark && (
                        <button className="chip-link is-add" onClick={() => open(e, "parking")}>🚗 駐車場を設定</button>
                      )}
                      {docs ? (
                        <button className="chip-link is-docs" onClick={() => open(e, "docs")}>📄 要項<ChevronRight size={15} aria-hidden="true" /></button>
                      ) : t.coach && canPark && (
                        <button className="chip-link is-add" onClick={() => open(e, "docs")}>📄 要項を追加</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="month-title">
        <div className="section-head">
          <h2 id="month-title" className="section-title">月ごとの予定</h2>
          <div className="section-actions">
            <div className="view-switch" role="group" aria-label="表示の切り替え">
              <button aria-pressed={view === "month"} onClick={() => setView("month")}><CalendarDays size={15} aria-hidden="true" />月表示</button>
              <button aria-pressed={view === "list"} onClick={() => { setView("list"); setDay(null); }}><List size={15} aria-hidden="true" />一覧</button>
            </div>
          </div>
        </div>
        {view === "month" ? (
          <MonthCalendar
            month={month}
            today={today}
            events={events}
            selected={day}
            isUnread={(e) => t.isUnread(e) || t.isLotteryUnread(e)}
            parkingOf={t.parkingOf}
            onSelect={setDay}
            onMonth={changeMonth}
          />
        ) : (
          <div className="month-switch">
            <button className="btn btn-small" onClick={() => changeMonth(-1)}>前の月</button>
            <h3 className="month-title">{month.replace("-", "年")}月</h3>
            <button className="btn btn-small" onClick={() => changeMonth(1)}>次の月</button>
          </div>
        )}

        {(day || view === "list") && (
          <div className="day-list">
            <div className="day-list-head">
              <h3>{day ? dayLabel(day) : `${Number(month.slice(5))}月の予定`}</h3>
              {day && <button className="btn btn-small btn-ghost" onClick={() => setDay(null)}>選択を解除</button>}
            </div>
            {listed.length === 0 ? (
              <p className="muted">{day ? "この日の予定はありません。" : "この月の予定はありません。"}</p>
            ) : (
              <ul className="event-list">
                {listed.map((e) => (
                  <li key={e.id}>
                    <EventRow event={e} today={today} unread={t.isUnread(e) || t.isLotteryUnread(e)} parking={t.parkingOf(e)} hasDocs={t.hasDocs(e)} showDate={!day} onOpen={() => open(e)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="month-tools">
          <button className="btn btn-small" onClick={saveMonthIcs} disabled={!monthEvents.length}>
            <Download size={15} aria-hidden="true" />この月をカレンダーに保存（.ics）
          </button>
          <small className="muted">iPhone・Googleカレンダーに取り込めます。取り込んだ予定は自動では更新されません。</small>
        </div>
      </section>

      {editor && (
        <EventEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={(id) => { setEditor(null); t.navigate({ name: "event", id, from: "home" }); }}
        />
      )}
    </>
  );
}
