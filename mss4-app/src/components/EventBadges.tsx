import type { ParkingSummary } from "../lib/parking";
import { KIND_LABELS, STATUS_LABELS, type TeamEvent } from "../lib/types";

interface Props {
  event: TeamEvent;
  unread?: boolean;
  parking?: ParkingSummary | null;
  hasDocs?: boolean;
}

/** 種別・開催状況・更新あり・駐車場の状態・要項ありのバッジ（学年バッジは出さない） */
export function EventBadges({ event, unread, parking, hasDocs }: Props) {
  return (
    <span className="badges">
      <span className={`badge kind-${event.kind}`}>{KIND_LABELS[event.kind]}</span>
      {event.status !== "scheduled" && <span className={`badge status-${event.status}`}>{STATUS_LABELS[event.status]}</span>}
      {unread && <span className="badge badge-update">更新あり</span>}
      {parking && <span className={`badge parking-${parking.phase}`}>{parking.label}</span>}
      {hasDocs && <span className="badge badge-docs">📄 要項あり</span>}
    </span>
  );
}
