import { useId, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { formatBytes, uploadFile, type UploadStage } from "../lib/uploads";
import { useTeam } from "../lib/teamContext";
import type { Attachment } from "../lib/types";

interface Props {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  /** 新しくアップロードしたファイル（保存せずに閉じたら消すため） */
  onUploaded: (path: string) => void;
}

interface Pending { key: string; name: string; stage: UploadStage; percent: number; error?: string }

/** 📁 スマホから画像・PDFをアップロード（画像は自動で圧縮） */
export function FileUploader({ attachments, onChange, onUploaded }: Props) {
  const t = useTeam();
  const inputId = useId();
  const [pending, setPending] = useState<Pending[]>([]);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    let list = attachments;
    let order = Math.max(0, ...attachments.map((a) => a.order)) + 1;
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setPending((p) => [...p, { key, name: file.name, stage: "compressing", percent: 0 }]);
      try {
        const attachment = await uploadFile(t.grade, file, order++, (stage, percent) =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, stage, percent } : x))));
        onUploaded(attachment.path);
        list = [...list, attachment];
        onChange(list);
        setPending((p) => p.filter((x) => x.key !== key));
      } catch (error) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: error instanceof Error ? error.message : "アップロードできませんでした。" } : x)));
      }
    }
  }

  const rename = (id: string, label: string) => onChange(attachments.map((a) => (a.id === id ? { ...a, label } : a)));
  const remove = (id: string) => onChange(attachments.filter((a) => a.id !== id));

  return (
    <div className="uploader">
      <label className="btn upload-btn" htmlFor={inputId}>
        <Upload size={17} aria-hidden="true" />📁 スマホから画像・PDFをアップロード
      </label>
      <input id={inputId} className="sr-only" type="file" accept="image/*,application/pdf" multiple onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
      <small className="field-hint">画像は文字が読める大きさのまま自動で軽くします。PDFは15MBまで。</small>

      {pending.map((p) => (
        <div key={p.key} className={`upload-row ${p.error ? "is-error" : ""}`} role="status">
          <span className="upload-name">{p.name}</span>
          {p.error ? (
            <>
              <span className="form-error">{p.error}</span>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>閉じる</button>
            </>
          ) : (
            <span className="upload-progress">
              <span className="spinner" aria-hidden="true" />
              {p.stage === "compressing" ? "画像を軽くしています…" : `アップロード中 ${p.percent}%`}
            </span>
          )}
        </div>
      ))}

      {attachments.length > 0 && (
        <ul className="attachment-edit">
          {attachments.map((a) => (
            <li key={a.id}>
              {a.type === "image" ? <img src={a.url} alt="" loading="lazy" /> : <span className="pdf-icon"><FileText size={22} aria-hidden="true" /></span>}
              <span className="attachment-edit-main">
                <input className="input" value={a.label} maxLength={60} onChange={(e) => rename(a.id, e.target.value)} aria-label="表示名" />
                <small className="muted">{a.type === "pdf" ? "PDF" : "画像"}・{formatBytes(a.size)}</small>
              </span>
              <button type="button" className="icon-btn" aria-label={`${a.label}を削除`} onClick={() => remove(a.id)}><Trash2 size={18} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
