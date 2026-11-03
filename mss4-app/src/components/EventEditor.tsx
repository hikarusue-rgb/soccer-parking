import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Save, Trash2, X } from "lucide-react";
import { MESSAGE_CHOICES, TIME_PRESETS, TITLE_PRESETS, autoDeadline, validateDraft, type EventDraft } from "../lib/eventForm";
import { snapshotOfDraft, snapshotOfEvent } from "../lib/changes";
import { SaveError, deleteEvent, saveEvent } from "../lib/mutations";
import { useTeam } from "../lib/teamContext";
import { deleteFiles } from "../lib/uploads";
import type { EventKind } from "../lib/types";
import { FileUploader } from "./FileUploader";
import { Chip, Field, Group, Segmented } from "./FormBits";

interface Props {
  initial: EventDraft;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}

/** 追加・編集できる種別は練習と試合だけ（2026-11-03 ユーザー指定。「連絡・休み」は選べない） */
const KINDS: { value: EventKind; label: string }[] = [
  { value: "practice", label: "練習" },
  { value: "match", label: "試合" },
];

/**
 * 予定の追加・編集
 *  練習：日付・時間（開始〜終了）・場所・備考だけ
 *  試合：日付・タイトル・対戦相手・会場・時間・駐車場（抽選枠／抽選外枠・締切）・ユニフォーム・要項（資料）・備考
 */
export function EventEditor({ initial, onClose, onSaved, onDeleted }: Props) {
  const t = useTeam();
  const [d, setD] = useState<EventDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /** この編集中に新しくアップロードしたファイル（保存せずに閉じたら削除する） */
  const [uploaded, setUploaded] = useState<string[]>([]);
  const errorRef = useRef<HTMLUListElement>(null);

  const existing = d.id ? t.data.events.find((e) => e.id === d.id) ?? null : null;
  const drawn = Boolean(d.id && t.data.lotteries[d.id]);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const isMatch = d.kind === "match";
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const lotteryCount = Math.max(0, d.parkingLimit - d.reserved);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function close() {
    if (dirty && !window.confirm("編集中の内容を保存せずに閉じますか？")) return;
    void deleteFiles(uploaded);
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function changeKind(kind: EventKind) {
    setD((prev) => ({
      ...prev,
      kind,
      title: !prev.title || TITLE_PRESETS[prev.kind].includes(prev.title) ? TITLE_PRESETS[kind][0] : prev.title,
    }));
  }

  function changeDate(date: string) {
    setD((prev) => ({
      ...prev,
      date,
      // 締切が自動設定のままなら、試合日に合わせて動かす
      deadline: prev.parkingLimit > 0 && (!prev.deadline || prev.deadline === autoDeadline(prev.date)) ? autoDeadline(date) : prev.deadline,
    }));
  }

  /** 抽選枠・抽選外枠の台数（合計が駐車可能台数）。抽選枠が0なら駐車場の抽選なし */
  function changeParking(lottery: number, reserved: number) {
    const lot = Math.max(0, Math.min(50, Math.round(lottery) || 0));
    const res = lot > 0 ? Math.max(0, Math.min(50 - lot, Math.round(reserved) || 0)) : 0;
    const limit = lot + res;
    setD((prev) => ({
      ...prev,
      parkingLimit: limit,
      reserved: res,
      parkingMode: lot > 0 ? "lottery" : "none",
      deadline: lot > 0 && !prev.deadline ? autoDeadline(prev.date) : prev.deadline,
      confirmed: lot > 0 ? prev.confirmed : [],
    }));
  }

  async function save() {
    // 練習では駐車場・ユニフォーム・資料を使わない（以前に入れた資料は残す）
    const draft: EventDraft = isMatch ? d : { ...d, meeting: "", kickoff: "", opponent: "" };
    const problems = validateDraft(draft);
    if (existing && existing.version !== d.version) {
      problems.unshift("ほかの人がこの予定を先に更新しました。いったん閉じて、最新の内容を確認してから編集し直してください。");
    }
    if (problems.length) {
      setErrors(problems);
      setTimeout(() => errorRef.current?.scrollIntoView({ block: "nearest" }), 0);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const id = await saveEvent(t.grade, draft, { before: existing ? snapshotOfEvent(existing) : null, after: snapshotOfDraft(draft) });
      // 外した資料と、アップロードしたが保存しなかった資料の実体を消す
      const kept = new Set(draft.attachments.map((a) => a.path));
      void deleteFiles([...initial.attachments.map((a) => a.path), ...uploaded].filter((p) => !kept.has(p)));
      onSaved(id);
    } catch (error) {
      setErrors([error instanceof SaveError ? error.message : "保存できませんでした。もう一度お試しください。"]);
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!window.confirm(`「${existing.title}」（${existing.date.replaceAll("-", "/")}）を削除します。\nこの予定のエントリーと抽選結果も削除され、元に戻せません。よろしいですか？`)) return;
    setBusy(true);
    try {
      await deleteEvent(t.grade, existing.id);
      void deleteFiles([...existing.attachments.map((a) => a.path), ...uploaded]);
      onDeleted?.();
    } catch (error) {
      setErrors([error instanceof SaveError ? error.message : "削除できませんでした。"]);
      setBusy(false);
    }
  }

  const venues = [...new Set([...t.data.settings.venues, d.venue].filter(Boolean))].slice(0, 14);
  const colors = t.data.settings.uniformColors;
  const what = isMatch ? "試合" : "練習";

  return (
    <div className="editor-backdrop" role="presentation">
      <div className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header className="editor-head">
          <h2 id="editor-title">{d.id ? `${what}を編集` : `${what}を追加`}</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={close}><X size={20} /></button>
        </header>

        <div className="editor-body">
          <Group label="種別">
            <Segmented label="種別" value={d.kind === "notice" ? "" : d.kind} options={KINDS} onChange={changeKind} />
          </Group>

          <Field label={isMatch ? "試合日" : "日にち"}>
            {(id) => <input id={id} className="input" type="date" value={d.date} onChange={(e) => changeDate(e.target.value)} required />}
          </Field>

          {isMatch && (
            <>
              <Field label="タイトル">
                {(id) => (
                  <>
                    <div className="chips">
                      {TITLE_PRESETS.match.map((title) => <Chip key={title} pressed={d.title === title} onClick={() => set("title", title)}>{title}</Chip>)}
                    </div>
                    <input id={id} className="input" value={d.title} maxLength={100} onChange={(e) => set("title", e.target.value)} placeholder="例: プレミアリーグ" />
                  </>
                )}
              </Field>
              <Field label="🆚 対戦相手">
                {(id) => <input id={id} className="input" value={d.opponent} maxLength={60} onChange={(e) => set("opponent", e.target.value)} placeholder="例: ○○FC（複数なら「、」区切り）" />}
              </Field>
            </>
          )}

          <Group label="⏰ 時間" hint="未定の時刻は空欄のままにしてください。">
            <div className="chips">
              {TIME_PRESETS[isMatch ? "match" : "practice"].map(([s, e]) => (
                <Chip key={s + e} pressed={d.start === s && d.end === e} onClick={() => setD((prev) => ({ ...prev, start: s, end: e }))}>{s}–{e}</Chip>
              ))}
            </div>
            <div className="time-grid">
              {isMatch && <TimeInput label="集合" value={d.meeting} onChange={(v) => set("meeting", v)} />}
              {isMatch && <TimeInput label="キックオフ" value={d.kickoff} onChange={(v) => set("kickoff", v)} />}
              <TimeInput label="開始" value={d.start} onChange={(v) => set("start", v)} />
              <TimeInput label="終了" value={d.end} onChange={(v) => set("end", v)} />
            </div>
          </Group>

          <Field label={isMatch ? "📍 会場" : "📍 場所"}>
            {(id) => (
              <>
                <div className="chips">
                  {venues.map((v) => <Chip key={v} pressed={d.venue === v} onClick={() => set("venue", v)}>{v}</Chip>)}
                </div>
                <input id={id} className="input" value={d.venue} maxLength={120} onChange={(e) => set("venue", e.target.value)} placeholder="会場名（地図の検索にも使います）" />
              </>
            )}
          </Field>

          {isMatch && (
            <section className="editor-section" aria-labelledby="parking-title">
              <h3 id="parking-title">🚗 駐車場</h3>
              <div className="parking-split">
                <Stepper label="抽選枠" hint="保護者の申し込みから抽選する台数。0台なら抽選なし" value={lotteryCount} onChange={(v) => changeParking(v, d.reserved)} />
                <Stepper label="抽選外枠" hint="審判・コーチなど抽選しない台数（誰が使うかは審判の方で決めます）" value={d.reserved} disabled={lotteryCount === 0} onChange={(v) => changeParking(lotteryCount, v)} />
              </div>
              {lotteryCount > 0 && (
                <>
                  <p className="parking-total">合計 <b>{d.parkingLimit}</b> 台（抽選枠 {lotteryCount}台{d.reserved ? `・抽選外枠 ${d.reserved}台` : ""}）</p>
                  <Field label="回答締切" hint="空欄にすると締切なしになります。">
                    {(id) => (
                      <div className="inline-row">
                        <input id={id} className="input" type="datetime-local" value={d.deadline} onChange={(e) => set("deadline", e.target.value)} />
                        <button type="button" className="btn btn-small" onClick={() => set("deadline", autoDeadline(d.date))}>2日前17:00</button>
                      </div>
                    )}
                  </Field>
                  {drawn && <p className="alert alert-warn">この試合はすでに抽選済みです。台数を変えた場合は、試合の画面で再抽選してください。</p>}
                </>
              )}
            </section>
          )}

          {isMatch && (
            <section className="editor-section" aria-labelledby="yokou-title">
              <h3 id="yokou-title">📋 要項</h3>
              <Group label="👕 ユニフォーム">
                <div className="uniform-grid">
                  {(["top", "bottom", "socks"] as const).map((part) => (
                    <label key={part} className="uniform-select">
                      <span>{part === "top" ? "上" : part === "bottom" ? "下" : "靴下"}</span>
                      <select className="input" value={d.uniform[part]} onChange={(e) => set("uniform", { ...d.uniform, [part]: e.target.value })}>
                        <option value="">未確認</option>
                        {[...new Set([...colors, d.uniform[part]].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </Group>
              <Group label="📄 要項・当日資料（画像・PDF）">
                <FileUploader attachments={d.attachments} onChange={(a) => set("attachments", a)} onUploaded={(path) => setUploaded((u) => [...u, path])} />
              </Group>
            </section>
          )}

          <Group label="📝 備考">
            {/* 定型文（サブ・ビブス・着替え持参）は試合だけ。練習は自由記述だけ（2026-11-03 ユーザー指定） */}
            {(isMatch || d.messages.length > 0) && <div className="chips">
              {[...new Set([...(isMatch ? MESSAGE_CHOICES : []), ...d.messages])].map((m) => (
                <Chip key={m} pressed={d.messages.includes(m)} onClick={() => set("messages", toggle(d.messages, m))}>{m}</Chip>
              ))}
            </div>}
            <textarea className="input" rows={3} value={d.note} maxLength={2000} onChange={(e) => set("note", e.target.value)} aria-label="備考" />
          </Group>

          {existing && (
            <section className="editor-danger">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}><Trash2 size={16} aria-hidden="true" />この{what}を削除</button>
            </section>
          )}
        </div>

        <footer className="editor-foot">
          {errors.length > 0 && (
            <ul className="form-errors" role="alert" ref={errorRef}>
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="editor-actions">
            <button type="button" className="btn" onClick={close} disabled={busy}>キャンセル</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              <Save size={17} aria-hidden="true" />{busy ? "保存しています…" : "保存"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Stepper({ label, hint, value, disabled, onChange }: { label: string; hint: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="stepper">
          <button type="button" className="icon-btn" aria-label={`${label}を1台減らす`} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}><Minus size={18} /></button>
          <input id={id} className="input stepper-input" type="number" inputMode="numeric" min={0} max={50} value={value} disabled={disabled} onChange={(e) => onChange(Number.parseInt(e.target.value || "0", 10))} />
          <span className="stepper-unit">台</span>
          <button type="button" className="icon-btn" aria-label={`${label}を1台増やす`} disabled={disabled} onClick={() => onChange(value + 1)}><Plus size={18} /></button>
        </div>
      )}
    </Field>
  );
}

/** 時刻の候補：08:00から始まる15分刻み（〜20:45）。早朝（05:00〜07:45）は後ろにまとめる */
const TIME_OPTIONS = (() => {
  const list: string[] = [];
  const add = (from: number, to: number) => {
    for (let m = from; m < to; m += 15) list.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  };
  add(8 * 60, 21 * 60);
  add(5 * 60, 8 * 60);
  return list;
})();

/** 時刻は選ぶだけ（スマホで開くと 08:00 から並ぶ。いまの時刻から探さなくてよい） */
function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const options = value && !TIME_OPTIONS.includes(value) ? [value, ...TIME_OPTIONS] : TIME_OPTIONS;
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className="input time-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">未定</option>
          {options.map((t, i) => (
            <option key={t} value={t}>{t}{i > 0 && t === "05:00" ? "（早朝）" : ""}</option>
          ))}
        </select>
      )}
    </Field>
  );
}
