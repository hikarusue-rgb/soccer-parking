import type { ParkingSummary } from "../lib/parking";
import { useTeam } from "../lib/teamContext";
import { KIND_LABELS, STATUS_LABELS, type TeamEvent } from "../lib/types";

interface Props {
  event: TeamEvent;
  parking?: ParkingSummary | null;
  hasDocs?: boolean;
}

/** 種別・開催状況・更新あり・駐車場の状態・要項ありのバッジ（学年バッジは出さない） */
export function EventBadges({ event, parking, hasDocs }: Props) {
  const state = useTeam().updateState(event);
  return (
    <span className="badges">
      <span className={`badge kind-${event.kind}`}>{KIND_LABELS[event.kind]}</span>
      {(event.status === "canceled" || event.status === "postponed") && <span className={`badge status-${event.status}`}>{STATUS_LABELS[event.status]}</span>}
      {state === "unread" && <span className="badge badge-update">🔔 未確認の更新</span>}
      {state === "recent" && <span className="badge badge-recent">✏️ 最近変更</span>}
      {parking && <span className={`badge parking-${parking.phase}`}>{parking.label}</span>}
      {hasDocs && <span className="badge badge-docs">📄 要項あり</span>}
    </span>
  );
}
