// 予定の一部だけをその場で保存する（駐車場台数・要項・資料）。保存の仕組みは編集フォームと同じ（変更履歴も残る）
import { snapshotOfDraft, snapshotOfEvent } from "./changes";
import { draftFromEvent, validateDraft, type EventDraft } from "./eventForm";
import type { GradeCode } from "./grade";
import { SaveError, saveEvent } from "./mutations";
import type { TeamEvent } from "./types";

export async function quickSave(grade: GradeCode, event: TeamEvent, patch: Partial<EventDraft>): Promise<void> {
  const draft: EventDraft = { ...draftFromEvent(event), ...patch };
  draft.parkingMode = draft.parkingLimit > 0 ? "lottery" : "none";
  if (draft.parkingMode === "none") draft.confirmed = [];
  const problems = validateDraft(draft);
  if (problems.length) throw new SaveError(problems[0]);
  await saveEvent(grade, draft, { before: snapshotOfEvent(event), after: snapshotOfDraft(draft) });
}
