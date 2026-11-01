import { useState } from "react";
import { FileText } from "lucide-react";
import { formatBytes } from "../lib/uploads";
import type { Attachment } from "../lib/types";
import { ImageViewer } from "./ImageViewer";

/** 資料の表示：画像はサムネイル（タップで拡大）、PDFはファイル名付きのボタン */
export function AttachmentList({ title, items }: { title?: string; items: Attachment[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (!items.length) return null;
  const images = items.filter((a) => a.type === "image");
  const pdfs = items.filter((a) => a.type === "pdf");
  return (
    <div className="attachments">
      {title && <p className="attachments-title">{title}</p>}
      {images.length > 0 && (
        <div className="thumbs">
          {images.map((a, i) => (
            <button key={a.id} className="thumb" onClick={() => setViewing(i)} aria-label={`${a.label}を拡大して見る`}>
              <img src={a.url} alt="" loading="lazy" />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
      {pdfs.map((a) => (
        <a key={a.id} className="pdf-link" href={a.url} target="_blank" rel="noopener noreferrer">
          <FileText size={20} aria-hidden="true" />
          <span><b>{a.label}</b><small>PDF・{formatBytes(a.size)}・タップで開く</small></span>
        </a>
      ))}
      {viewing !== null && <ImageViewer images={images} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
