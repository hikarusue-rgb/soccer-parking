import { ChevronRight } from "lucide-react";
import { dayLabel, relativeDay } from "../lib/datetime";
import { KIND_LABELS, type TeamEvent } from "../lib/types";

/** コーチ用の短い行：「この予定に駐車場を設定する」「要項を追加する」など、予定からそのまま進む */
export function QuickRow({ event: e, today, action, onOpen }: { event: TeamEvent; today: string; action: string; onOpen: () => void }) {
  return (
    <button className="quick-row" onClick={onOpen}>
      <span className="quick-date"><b>{dayLabel(e.date)}</b><small>{relativeDay(e.date, today)}</small></span>
      <span className="quick-main">
        <span className={`badge kind-${e.kind}`}>{KIND_LABELS[e.kind]}</span>
        <b>{e.title}</b>
      </span>
      <span className="quick-action">{action}<ChevronRight size={16} aria-hidden="true" /></span>
    </button>
  );
}
