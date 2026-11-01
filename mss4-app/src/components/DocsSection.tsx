import { useState } from "react";
import { Pencil } from "lucide-react";
import { SaveError } from "../lib/mutations";
import { quickSave } from "../lib/quickSave";
import { useTeam } from "../lib/teamContext";
import { deleteFiles } from "../lib/uploads";
import type { Attachment, TeamEvent } from "../lib/types";
import { AttachmentList } from "./AttachmentList";
import { FileUploader } from "./FileUploader";

/** 予定の「📄 要項」：試合形式・審判・注意事項と資料。コーチはこの画面のままアップロード・編集できる */
export function DocsSection({ event }: { event: TeamEvent }) {
  const t = useTeam();
  const d = event.details;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(d);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const hasText = Boolean(d.format || d.referee || d.venueNotes);
  const empty = !event.attachments.length && !hasText;

  // 資料はアップロード・削除・名前の変更のたびにその場で保存する
  async function saveFiles(next: Attachment[]) {
    const removed = event.attachments.filter((a) => !next.some((b) => b.id === a.id)).map((a) => a.path);
    try {
      await quickSave(t.grade, event, { attachments: next });
      void deleteFiles(removed);
      setMessage(null);
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof SaveError ? e.message : "保存できませんでした。" });
    }
  }

  async function saveDetails() {
    setBusy(true);
    try {
      await quickSave(t.grade, event, { details: form });
      setEditing(false);
      setMessage({ kind: "info", text: "要項を保存しました。" });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof SaveError ? e.message : "保存できませんでした。" });
    } finally {
      setBusy(false);
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
      ) : (
        event.attachments.length > 0 && <AttachmentList items={event.attachments} />
      )}
      {!editing && (
        <>
          {d.format && <div className="yk-item"><small>⚽ 試合形式</small><b>{d.format}</b></div>}
          {d.referee && <div className="yk-item"><small>🟨 審判割当</small><p className="preline">{d.referee}</p></div>}
          {d.venueNotes && <div className="yk-item"><small>⚠️ 会場・駐車の注意事項</small><p className="preline">{d.venueNotes}</p></div>}
          {empty && !t.coach && <div className="empty">要項はまだ届いていません。届きしだい、ここに載ります。</div>}
          {t.coach && (
            <button className="btn btn-small" onClick={() => { setForm(d); setEditing(true); }}>
              <Pencil size={14} aria-hidden="true" />{hasText ? "試合形式・審判・注意事項を編集" : "試合形式・審判・注意事項を入力"}
            </button>
          )}
        </>
      )}
      {editing && (
        <div className="setup-card">
          <label className="field"><span className="field-label">試合形式</span>
            <input className="input" value={form.format} maxLength={200} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="例: 8人制 15分ハーフ" /></label>
          <label className="field"><span className="field-label">審判割当</span>
            <textarea className="input" rows={2} value={form.referee} maxLength={500} onChange={(e) => setForm({ ...form, referee: e.target.value })} placeholder="例: 第2試合 主審・副審 MSS" /></label>
          <label className="field"><span className="field-label">会場・駐車の注意事項</span>
            <textarea className="input" rows={3} value={form.venueNotes} maxLength={1000} onChange={(e) => setForm({ ...form, venueNotes: e.target.value })} placeholder="例: 正門側は駐車禁止" /></label>
          <div className="inline-row">
            <button className="btn btn-primary" onClick={saveDetails} disabled={busy}>{busy ? "保存しています…" : "保存"}</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>キャンセル</button>
          </div>
        </div>
      )}
      {message && <p className={`alert ${message.kind === "error" ? "alert-error" : "alert-info"}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
    </div>
  );
}
