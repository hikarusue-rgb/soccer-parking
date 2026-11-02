import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayLabel, monthShape } from "../lib/datetime";
import type { ParkingSummary } from "../lib/parking";
import { KIND_LABELS, STATUS_LABELS, type TeamEvent } from "../lib/types";
import type { UpdateState } from "../lib/seen";

interface Props {
  month: string;
  today: string;
  events: TeamEvent[];
  selected: string | null;
  updateState: (e: TeamEvent) => UpdateState;
  parkingOf: (e: TeamEvent) => ParkingSummary | null;
  onSelect: (date: string) => void;
  onMonth: (delta: number | "today") => void;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 月表示：各日のマスに予定名・駐車場の状態を表示する */
export function MonthCalendar({ month, today, events, selected, updateState, parkingOf, onSelect, onMonth }: Props) {
  const { offset, days } = monthShape(month);
  const [y, m] = month.split("-").map(Number);
  const byDate = new Map<string, TeamEvent[]>();
  for (const e of events) if (e.date.startsWith(month)) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <div className="month">
      <div className="month-switch">
        <button className="icon-btn" aria-label="前の月" onClick={() => onMonth(-1)}><ChevronLeft size={20} /></button>
        <h3 className="month-title" aria-live="polite">{y}<small>年</small>{m}<small>月</small></h3>
        <button className="icon-btn" aria-label="次の月" onClick={() => onMonth(1)}><ChevronRight size={20} /></button>
        <button className="btn btn-small" onClick={() => onMonth("today")}>今月</button>
      </div>
      <div className="month-grid" role="grid" aria-label={`${y}年${m}月のカレンダー`}>
        {WEEK.map((w, i) => <div key={w} className={`weekday ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`} role="columnheader">{w}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={`blank${i}`} className="day-blank" />)}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const plans = byDate.get(date) ?? [];
          const weekday = (offset + i) % 7;
          const summary = plans.map((e) => {
            const p = parkingOf(e);
            return `${e.title}（${STATUS_LABELS[e.status]}${p ? `、${p.label.replace("🚗 ", "駐車場 ")}` : ""}${updateState(e) === "unread" ? "、未確認の更新" : updateState(e) === "recent" ? "、最近変更" : ""}）`;
          }).join("、");
          return (
            <button
              key={date}
              role="gridcell"
              className={`day ${plans.length ? "has-events" : ""} ${date === today ? "is-today" : ""} ${weekday === 0 ? "sun" : weekday === 6 ? "sat" : ""}`}
              aria-selected={selected === date}
              aria-label={`${dayLabel(date)} ${plans.length ? summary : "予定なし"}`}
              onClick={() => onSelect(date)}
            >
              <span className="day-number">{i + 1}</span>
              <span className="day-events">
                {plans.slice(0, 3).map((e) => {
                  const p = parkingOf(e);
                  return (
                    <span key={e.id} className={`day-event kind-${e.kind} ${e.status === "canceled" ? "is-canceled" : ""} ${updateState(e) === "unread" ? "is-updated" : updateState(e) === "recent" ? "is-recent" : ""}`}>
                      <b>{e.kind === "notice" ? "連絡" : KIND_LABELS[e.kind]}</b>
                      {updateState(e) === "unread" && <em className="day-update">🔔未確認</em>}
                      {updateState(e) === "recent" && <em className="day-update is-recent">✏️変更</em>}
                      <span className="day-event-title">{e.title}</span>
                      {p && <span className={`day-parking parking-${p.phase}`}>{p.short}</span>}
                    </span>
                  );
                })}
                {plans.length > 3 && <span className="day-more">ほか{plans.length - 3}件</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
