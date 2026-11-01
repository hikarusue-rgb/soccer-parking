import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, X } from "lucide-react";
import type { Attachment } from "../lib/types";

/** 画像の拡大表示（2本指で拡大・1本指で移動・ダブルタップで2.5倍） */
export function ImageViewer({ images, start, onClose }: { images: Attachment[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; px: number; py: number } | null>(null);
  const lastTap = useRef(0);
  const image = images[index];

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
  const go = (delta: number) => { setIndex((i) => (i + delta + images.length) % images.length); reset(); };
  const zoom = (next: number) => { setScale(Math.min(5, Math.max(1, next))); if (next <= 1) setPos({ x: 0, y: 0 }); };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && images.length > 1) go(1);
      if (e.key === "ArrowLeft" && images.length > 1) go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  });

  function down(e: ReactPointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale, x: pos.x, y: pos.y, px: 0, py: 0 };
    } else if (pts.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) { if (scale > 1) reset(); else zoom(2.5); }
      lastTap.current = now;
      gesture.current = { dist: 0, scale, x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
    }
  }

  function move(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && gesture.current.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoom(gesture.current.scale * (dist / gesture.current.dist));
    } else if (pts.length === 1 && scale > 1) {
      setPos({ x: gesture.current.x + (e.clientX - gesture.current.px), y: gesture.current.y + (e.clientY - gesture.current.py) });
    }
  }

  function up(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const rest = [...pointers.current.values()];
    gesture.current = rest.length === 1 ? { dist: 0, scale, x: pos.x, y: pos.y, px: rest[0].x, py: rest[0].y } : null;
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`${image.label}（拡大表示）`}>
      <div className="viewer-bar">
        <span className="viewer-title">{image.label}{images.length > 1 && `（${index + 1}/${images.length}）`}</span>
        <a className="icon-btn" href={image.url} target="_blank" rel="noopener noreferrer" aria-label="元の画像を別の画面で開く"><ExternalLink size={19} /></a>
        <button className="icon-btn" aria-label="閉じる" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="viewer-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => zoom(scale * (e.deltaY < 0 ? 1.15 : 0.87))}>
        <img src={image.url} alt={image.label} draggable={false} style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }} />
      </div>
      <div className="viewer-tools">
        {images.length > 1 && <button className="icon-btn" aria-label="前の画像" onClick={() => go(-1)}><ChevronLeft size={22} /></button>}
        <button className="icon-btn" aria-label="縮小" onClick={() => zoom(scale / 1.5)}><Minus size={20} /></button>
        <button className="btn btn-small" onClick={reset}>{Math.round(scale * 100)}%</button>
        <button className="icon-btn" aria-label="拡大" onClick={() => zoom(scale * 1.5)}><Plus size={20} /></button>
        {images.length > 1 && <button className="icon-btn" aria-label="次の画像" onClick={() => go(1)}><ChevronRight size={22} /></button>}
      </div>
    </div>
  );
}
