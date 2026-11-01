import { ChevronRight, Clock, MapPin } from "lucide-react";
import { dayLabel, relativeDay } from "../lib/datetime";
import { timeSummary } from "../lib/eventView";
import type { ParkingSummary } from "../lib/parking";
import type { TeamEvent } from "../lib/types";
import { EventBadges } from "./EventBadges";

interface Props {
  event: TeamEvent;
  today: string;
  unread: boolean;
  parking: ParkingSummary | null;
  hasDocs: boolean;
  showDate?: boolean;
  onOpen: () => void;
}

/** 一覧の1行（タップで詳細へ） */
export function EventRow({ event: e, today, unread, parking, hasDocs, showDate = true, onOpen }: Props) {
  return (
    <button className={`event-row ${e.status === "canceled" ? "is-canceled" : ""}`} onClick={onOpen}>
      {showDate && (
        <span className="event-date">
          <b>{dayLabel(e.date)}</b>
          <small>{relativeDay(e.date, today)}</small>
        </span>
      )}
      <span className="event-main">
        <EventBadges event={e} unread={unread} parking={parking} hasDocs={hasDocs} />
        <b className="event-title">{e.title}</b>
        <span className="event-meta"><Clock size={14} aria-hidden="true" />{timeSummary(e)}</span>
        <span className="event-meta"><MapPin size={14} aria-hidden="true" />{e.venue || "場所未定"}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
