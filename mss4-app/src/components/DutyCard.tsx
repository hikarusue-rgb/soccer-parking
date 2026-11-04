import { useState } from "react";
import { Copy, Send, X } from "lucide-react";
import { announceText, lineShareUrl, reminderText, resultText } from "../lib/lineText";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";

type Step = "announce" | "remind" | "result";

/**
 * 当番の方の LINE 連絡（①受付の案内 ②催促 ③結果）。
 * ボタンを押すと文面を確認・修正でき、「LINEで送る」か「コピー」で保護者グループに送る。
 */
export function DutyCard({ event, closed }: { event: TeamEvent; closed: boolean }) {
  const t = useTeam();
  const entries = t.data.entries[event.id] ?? {};
  const lottery = t.data.lotteries[event.id];
  const url = t.eventUrl(event, "parking");
  const [open, setOpen] = useState<Step | null>(null);
  const noReply = t.data.members.filter((m) => m.active && !entries[m.id]).length;

  const steps: { step: Step; title: string; sub: string; ready: boolean; now: boolean }[] = [
    { step: "announce", title: "① 受付の案内", sub: "台数・締切・回答リンク", ready: true, now: !lottery && !closed && Object.keys(entries).length === 0 },
    { step: "remind", title: "② 回答の催促", sub: noReply ? `未回答 ${noReply}名` : "全員回答済み", ready: !lottery, now: !lottery && !closed && noReply > 0 && Object.keys(entries).length > 0 },
    { step: "result", title: "③ 抽選結果", sub: lottery ? "当選・落選・乗り合わせ" : "抽選後に送れます", ready: Boolean(lottery), now: Boolean(lottery) },
  ];
  const text = (step: Step) =>
    step === "announce" ? announceText(event, url)
      : step === "remind" ? reminderText(event, t.data.members, entries, url)
        : resultText(event, t.data.members, entries, lottery, url);

  return (
    <section className="duty-card" aria-labelledby={`duty-${event.id}`}>
      <h3 id={`duty-${event.id}`}>📣 当番の方へ：LINEでの連絡</h3>
      <div className="duty-steps">
        {steps.map((s) => (
          <button key={s.step} className={`duty-step ${s.now ? "is-now" : ""}`} disabled={!s.ready} onClick={() => setOpen(s.step)}>
            <b>{s.title}</b>
            <small>{s.sub}</small>
            {s.now && <span className="duty-now">いま</span>}
          </button>
        ))}
      </div>
      <p className="muted">押すと文面が開きます。確認・修正して「LINEで送る」で保護者グループに送ってください。</p>
      {open && <ShareDialog key={open} title={steps.find((s) => s.step === open)!.title} initial={text(open)} onClose={() => setOpen(null)} />}
    </section>
  );
}

function ShareDialog({ title, initial, onClose }: { title: string; initial: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState<"ok" | "ng" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("ng");
    }
  }
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog share-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="share-head">
          <b>{title}</b>
          <button className="icon-btn" aria-label="閉じる" onClick={onClose}><X size={20} /></button>
        </div>
        <textarea className="input share-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} aria-label="送る文面" />
        <div className="share-actions">
          <a className="btn btn-line" href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer"><Send size={17} aria-hidden="true" />LINEで送る</a>
          <button className="btn" onClick={copy}><Copy size={17} aria-hidden="true" />コピー</button>
        </div>
        {copied === "ok" && <p className="alert alert-info" role="status">コピーしました。LINEの保護者グループに貼り付けてください。</p>}
        {copied === "ng" && <p className="alert alert-error" role="alert">コピーできませんでした。文面を長押しして選択してください。</p>}
        <p className="muted">「LINEで送る」を押すとLINEが開きます。送り先に保護者グループを選んでください。</p>
      </div>
    </div>
  );
}
