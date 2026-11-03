import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { localInputToMs, msToLocalInput } from "../lib/datetime";
import { autoDeadline } from "../lib/eventForm";
import { reservedOf } from "../lib/lottery";
import { SaveError } from "../lib/mutations";
import { quickSave } from "../lib/quickSave";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";

/**
 * コーチ：予定の画面から、その場で駐車場を設定する
 *  抽選枠＝保護者の申し込みから抽選する台数／抽選外枠＝審判・コーチなど（台数だけ。誰が使うかは審判の方で決める）
 */
export function ParkingSetup({ event, onDone }: { event: TeamEvent; onDone?: () => void }) {
  const t = useTeam();
  const active = event.parking.mode === "lottery" && event.parking.limit > 0;
  const [reserved, setReserved] = useState(active ? reservedOf(event) : 0);
  const [lottery, setLottery] = useState(active ? Math.max(1, event.parking.limit - reservedOf(event)) : 3);
  // 自動の締切（2日前17:00）がもう過ぎている直前の予定は、締切なし（抽選するまで受付）から始める
  const future = (v: string) => (localInputToMs(v) ?? 0) > t.now;
  const suggested = future(autoDeadline(event.date)) ? autoDeadline(event.date) : "";
  const [deadline, setDeadline] = useState(event.parking.deadlineAt ? msToLocalInput(event.parking.deadlineAt) : suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entries = Object.keys(t.data.entries[event.id] ?? {}).length;

  async function save(stop: boolean) {
    if (!stop && deadline && !future(deadline) && !window.confirm("回答締切がすでに過ぎています。このまま保存すると、未回答の方だけが登録できる状態になります。保存しますか？")) return;
    if (stop && entries > 0 && !window.confirm(`すでに${entries}件の回答があります。駐車場の抽選をやめますか？（回答は残ります）`)) return;
    setBusy(true);
    setError(null);
    try {
      await quickSave(t.grade, event, stop
        ? { parkingLimit: 0, reserved: 0, deadline: "" }
        : { parkingLimit: lottery + reserved, reserved, deadline });
      onDone?.();
    } catch (e) {
      setError(e instanceof SaveError ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-card">
      <p className="setup-title">{active ? "駐車場の設定を変更" : "🚗 この試合で駐車場の抽選をする"}</p>
      <div className="parking-split">
        <Counter label="抽選枠" hint="申し込みから抽選する台数" min={1} value={lottery} onChange={setLottery} />
        <Counter label="抽選外枠" hint="審判・コーチなど（誰が使うかは審判の方で決めます）" min={0} value={reserved} onChange={setReserved} />
      </div>
      <p className="parking-total">合計 <b>{lottery + reserved}</b> 台（抽選枠 {lottery}台{reserved ? `・抽選外枠 ${reserved}台` : ""}）</p>
      <label className="setup-row">
        <span className="setup-label">回答締切</span>
        <span className="inline-row">
          <input className="input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {suggested && <button type="button" className="btn btn-small" onClick={() => setDeadline(suggested)}>2日前17:00</button>}
          {deadline && <button type="button" className="btn btn-small btn-ghost" onClick={() => setDeadline("")}>締切なし</button>}
        </span>
        {!deadline && <span className="field-hint">締切なし：抽選するまで受け付けます。</span>}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="inline-row">
        <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>{busy ? "保存しています…" : active ? "変更を保存" : "抽選の受付を始める"}</button>
        {active && <button className="btn btn-ghost" onClick={() => save(true)} disabled={busy}>抽選をやめる</button>}
        {onDone && active && <button className="btn btn-ghost" onClick={onDone} disabled={busy}>閉じる</button>}
      </div>
      {!active && <p className="field-hint">保存すると、保護者がこの試合の「駐車場」から申し込めるようになります。</p>}
    </div>
  );
}

function Counter({ label, hint, min, value, onChange }: { label: string; hint: string; min: number; value: number; onChange: (v: number) => void }) {
  const clamp = (n: number) => Math.max(min, Math.min(50, Number.isFinite(n) ? Math.round(n) : min));
  return (
    <div className="setup-row">
      <span className="setup-label">{label}<small className="setup-hint">{hint}</small></span>
      <div className="stepper">
        <button type="button" className="icon-btn" aria-label={`${label}を1台減らす`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}><Minus size={18} /></button>
        <input className="input stepper-input" type="number" inputMode="numeric" min={min} max={50} value={value} onChange={(e) => onChange(clamp(Number.parseInt(e.target.value || String(min), 10)))} aria-label={label} />
        <span className="stepper-unit">台</span>
        <button type="button" className="icon-btn" aria-label={`${label}を1台増やす`} onClick={() => onChange(clamp(value + 1))}><Plus size={18} /></button>
      </div>
    </div>
  );
}
