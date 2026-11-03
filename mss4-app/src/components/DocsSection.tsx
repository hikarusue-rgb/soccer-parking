import { useState } from "react";
import { SaveError } from "../lib/mutations";
import { quickSave } from "../lib/quickSave";
import { useTeam } from "../lib/teamContext";
import { deleteFiles } from "../lib/uploads";
import type { Attachment, TeamEvent } from "../lib/types";
import { AttachmentList } from "./AttachmentList";
import { FileUploader } from "./FileUploader";

/** 予定の「📄 要項」：大会要項・タイムテーブル・コート図などの資料（画像・PDF）。この画面のままアップロード・削除できる */
export function DocsSection({ event }: { event: TeamEvent }) {
  const t = useTeam();
  const [error, setError] = useState<string | null>(null);

  // 資料はアップロード・削除・名前の変更のたびにその場で保存する
  async function saveFiles(next: Attachment[]) {
    const removed = event.attachments.filter((a) => !next.some((b) => b.id === a.id)).map((a) => a.path);
    try {
      await quickSave(t.grade, event, { attachments: next });
      void deleteFiles(removed);
      setError(null);
    } catch (e) {
      setError(e instanceof SaveError ? e.message : "保存できませんでした。");
    }
  }

  return (
    <div className="docs-sec">
      {t.coach ? (
        <div className="yk-item">
          <small>📄 要項・当日資料（大会要項・タイムテーブル・コート図など）</small>
          <AttachmentList items={event.attachments} />
          <FileUploader attachments={event.attachments} onChange={(next) => void saveFiles(next)} onUploaded={() => undefined} />
        </div>
      ) : event.attachments.length ? (
        <AttachmentList items={event.attachments} />
      ) : (
        <div className="empty">要項はまだ届いていません。届きしだい、ここに載ります。</div>
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </div>
  );
}
