import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { localInputToMs, msToLocalInput } from "../lib/datetime";
import { autoDeadline } from "../lib/eventForm";
import { SaveError } from "../lib/mutations";
import { quickSave } from "../lib/quickSave";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";

/** コーチ：予定の画面から、その場で駐車場台数と回答締切を設定する（試合を別に登録しなくてよい） */
export function ParkingSetup({ event, onDone }: { event: TeamEvent; onDone?: () => void }) {
  const t = useTeam();
  const active = event.parking.mode === "lottery" && event.parking.limit > 0;
  const [limit, setLimit] = useState(active ? event.parking.limit : 3);
  // 自動の締切（2日前17:00）がもう過ぎている直前の予定は、締切なし（抽選するまで受付）から始める
  const future = (v: string) => (localInputToMs(v) ?? 0) > t.now;
  const suggested = future(autoDeadline(event.date)) ? autoDeadline(event.date) : "";
  const [deadline, setDeadline] = useState(event.parking.deadlineAt ? msToLocalInput(event.parking.deadlineAt) : suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entries = Object.keys(t.data.entries[event.id] ?? {}).length;

  async function save(nextLimit: number) {
    if (nextLimit > 0 && deadline && !future(deadline) && !window.confirm("回答締切がすでに過ぎています。このまま保存すると、未回答の方だけが登録できる状態になります。保存しますか？")) return;
    if (nextLimit === 0 && entries > 0 && !window.confirm(`すでに${entries}件の回答があります。駐車場の抽選をやめますか？（回答は残ります）`)) return;
    setBusy(true);
    setError(null);
    try {
      await quickSave(t.grade, event, { parkingLimit: nextLimit, deadline: nextLimit > 0 ? deadline : "" });
      onDone?.();
    } catch (e) {
      setError(e instanceof SaveError ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  const clamp = (n: number) => Math.max(1, Math.min(50, Number.isFinite(n) ? Math.round(n) : 1));

  return (
    <div className="setup-card">
      <p className="setup-title">{active ? "駐車場の設定を変更" : "🚗 この予定で駐車場の抽選をする"}</p>
      <div className="setup-row">
        <span className="setup-label">停められる台数</span>
        <div className="stepper">
          <button type="button" className="icon-btn" aria-label="1台減らす" onClick={() => setLimit((v) => clamp(v - 1))}><Minus size={18} /></button>
          <input className="input stepper-input" type="number" inputMode="numeric" min={1} max={50} value={limit} onChange={(e) => setLimit(clamp(Number.parseInt(e.target.value || "1", 10)))} aria-label="停められる台数" />
          <span className="stepper-unit">台</span>
          <button type="button" className="icon-btn" aria-label="1台増やす" onClick={() => setLimit((v) => clamp(v + 1))}><Plus size={18} /></button>
        </div>
      </div>
      <label className="setup-row">
        <span className="setup-label">回答締切</span>
        <span className="inline-row">
          <input className="input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {suggested && <button type="button" className="btn btn-small" onClick={() => setDeadline(suggested)}>2日前17:00</button>}
          {deadline && <button type="button" className="btn btn-small btn-ghost" onClick={() => setDeadline("")}>締切なし</button>}
        </span>
        {!deadline && <span className="field-hint">締切なし：コーチが抽選するまで受け付けます。</span>}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="inline-row">
        <button className="btn btn-primary" onClick={() => save(limit)} disabled={busy}>{busy ? "保存しています…" : active ? "変更を保存" : "抽選の受付を始める"}</button>
        {active && <button className="btn btn-ghost" onClick={() => save(0)} disabled={busy}>抽選をやめる</button>}
        {onDone && active && <button className="btn btn-ghost" onClick={onDone} disabled={busy}>閉じる</button>}
      </div>
      {!active && <p className="field-hint">保存すると、保護者がこの予定の「駐車場」から申し込めるようになります。確定枠（コーチの車など）は「編集」から設定できます。</p>}
    </div>
  );
}
