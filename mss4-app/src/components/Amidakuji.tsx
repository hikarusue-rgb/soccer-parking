import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { ladderResults } from "../lib/lottery";
import type { LotteryLadder } from "../lib/types";

const COLORS = ["#0ea5e9", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#22c55e", "#ef4444", "#06b6d4"];

interface Props {
  ladder: LotteryLadder;
  nameOf: (id: string) => string;
  title: string;
  /** 抽選直後は自動で再生する */
  autoplay?: boolean;
  onClose: () => void;
}

/** あみだくじの演出（結果は保存済みのものを再生するだけで、ここでは決めない） */
export function Amidakuji({ ladder, nameOf, title, autoplay = false, onClose }: Props) {
  const n = ladder.order.length;
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [phase, setPhase] = useState<"ready" | "playing" | "done">(autoplay ? "playing" : "ready");
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (boxRef.current) setWidth(boxRef.current.clientWidth - 16);
  }, []);

  const CW = Math.max(34, Math.min(64, Math.floor((width - 24) / Math.max(n, 1))));
  const RH = 24;
  const PX = 12;
  const PY = 40;
  const W = n * CW + PX * 2;
  const H = ladder.rows * RH + PY * 2 + 26;
  const cx = (c: number) => PX + c * CW + CW / 2;
  const results = useMemo(() => ladderResults(ladder), [ladder]);

  const paths = useMemo(() => ladder.order.map((_, start) => {
    let col = start;
    let d = `M${cx(col)},${PY}`;
    ladder.rungs.forEach((row, r) => {
      const mid = PY + (r + 0.5) * RH;
      const next = PY + (r + 1) * RH;
      if (row.includes(col)) { d += `L${cx(col)},${mid}L${cx(col + 1)},${mid}`; col++; }
      else if (row.includes(col - 1)) { d += `L${cx(col)},${mid}L${cx(col - 1)},${mid}`; col--; }
      d += `L${cx(col)},${next}`;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ladder, CW]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (current >= n) { setPhase("done"); return; }
    const el = pathRefs.current[current];
    if (!el) { setCurrent((c) => c + 1); return; }
    const win = results[current] < ladder.slots;
    const len = el.getTotalLength();
    const duration = Math.max(500, 1300 - n * 40);
    el.style.transition = "none";
    el.style.stroke = COLORS[current % COLORS.length];
    el.style.opacity = "1";
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    let t1 = 0;
    let t2 = 0;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `stroke-dashoffset ${duration}ms linear`;
      el.style.strokeDashoffset = "0";
      t1 = window.setTimeout(() => {
        el.style.stroke = win ? "#f59e0b" : "#9aa8ab";
        setRevealed((p) => ({ ...p, [current]: win }));
        t2 = window.setTimeout(() => setCurrent((c) => c + 1), 300);
      }, duration);
    }));
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [phase, current, n, results, ladder.slots]);

  function skip() {
    pathRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.strokeDasharray = "none";
      el.style.opacity = "1";
      el.style.stroke = results[i] < ladder.slots ? "#f59e0b" : "#c3ccce";
    });
    setRevealed(Object.fromEntries(results.map((r, i) => [i, r < ladder.slots])));
    setCurrent(n);
    setPhase("done");
  }

  const winners = ladder.order.filter((_, i) => results[i] < ladder.slots);

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog amida" role="dialog" aria-modal="true" aria-labelledby="amida-title">
        <div className="amida-head">
          <h2 id="amida-title">🎰 {title}</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="muted">{n}人の希望 → 当たり {ladder.slots}枠。並び順は毎回ランダムです。</p>
        <div className="amida-box" ref={boxRef}>
          <svg width={W} height={H} role="img" aria-label="あみだくじ">
            {ladder.order.map((id, i) => (
              <text key={id} x={cx(i)} y={PY - 14} textAnchor="middle" fontSize="11" fontWeight="700"
                fill={revealed[i] === undefined ? (i === current && phase === "playing" ? COLORS[i % COLORS.length] : "#5a6d72") : revealed[i] ? "#b45309" : "#9aa8ab"}>
                {nameOf(id).slice(0, 4)}
              </text>
            ))}
            {ladder.order.map((id, i) => <line key={id} x1={cx(i)} y1={PY} x2={cx(i)} y2={PY + ladder.rows * RH} stroke="#c9d6d4" strokeWidth="2.5" />)}
            {ladder.rungs.flatMap((row, r) => row.map((c) => (
              <line key={`${r}-${c}`} x1={cx(c)} x2={cx(c + 1)} y1={PY + (r + 0.5) * RH} y2={PY + (r + 0.5) * RH} stroke="#c9d6d4" strokeWidth="2.5" />
            )))}
            {paths.map((d, i) => (
              <path key={i} ref={(el) => { pathRefs.current[i] = el; }} d={d} fill="none" stroke="transparent" strokeWidth="3.5" strokeLinecap="round" style={{ opacity: 0 }} />
            ))}
            {ladder.order.map((id, i) => {
              const win = i < ladder.slots;
              return (
                <g key={id}>
                  <rect x={cx(i) - 15} y={PY + ladder.rows * RH + 4} width="30" height="20" rx="5" fill={win ? "#fde68a" : "#e7eded"} />
                  <text x={cx(i)} y={PY + ladder.rows * RH + 18} textAnchor="middle" fontSize="10" fontWeight="800" fill={win ? "#92400e" : "#7a898c"}>{win ? "当選" : "落選"}</text>
                </g>
              );
            })}
          </svg>
        </div>
        {phase === "ready" && <button className="btn btn-primary btn-block" onClick={() => setPhase("playing")}>▶ 再生する</button>}
        {phase === "playing" && (
          <div className="amida-foot">
            <p role="status">{nameOf(ladder.order[current] ?? "")} さんの線をたどっています…</p>
            <button className="btn btn-small" onClick={skip}>結果をすぐ表示</button>
          </div>
        )}
        {phase === "done" && (
          <div className="amida-result" role="status">
            <b>🎉 当選：{winners.map(nameOf).join("、") || "なし"}</b>
          </div>
        )}
      </div>
    </div>
  );
}
