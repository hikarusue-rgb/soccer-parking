import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Save, Trash2, X } from "lucide-react";
import { jstToday } from "../lib/datetime";
import {
  EQUIPMENT_CHOICES, MESSAGE_CHOICES, TIME_PRESETS, TITLE_PRESETS, autoDeadline, validateDraft, type EventDraft,
} from "../lib/eventForm";
import { snapshotOfDraft, snapshotOfEvent } from "../lib/changes";
import { parseLineMessage } from "../lib/lineParser";
import { SaveError, deleteEvent, saveEvent } from "../lib/mutations";
import { useTeam } from "../lib/teamContext";
import { deleteFiles } from "../lib/uploads";
import { KIND_LABELS, STATUS_LABELS, type EventKind, type EventStatus } from "../lib/types";
import { FileUploader } from "./FileUploader";
import { Chip, Field, Group, Segmented } from "./FormBits";

interface Props {
  initial: EventDraft;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}

const KINDS = (Object.keys(KIND_LABELS) as EventKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));
const STATUSES = Object.keys(STATUS_LABELS) as EventStatus[];

/** コーチの予定追加・編集（選択式中心。駐車場枠・試合要項も同じフォームで設定する） */
export function EventEditor({ initial, onClose, onSaved, onDeleted }: Props) {
  const t = useTeam();
  const [d, setD] = useState<EventDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lineText, setLineText] = useState("");
  const [lineResult, setLineResult] = useState<string | null>(null);
  /** この編集中に新しくアップロードしたファイル（保存せずに閉じたら削除する） */
  const [uploaded, setUploaded] = useState<string[]>([]);
  const errorRef = useRef<HTMLUListElement>(null);

  const existing = d.id ? t.data.events.find((e) => e.id === d.id) ?? null : null;
  const drawn = Boolean(d.id && t.data.lotteries[d.id]);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const isMatch = d.kind === "match";
  const isNotice = d.kind === "notice";
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

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
      parkingMode: kind === "notice" ? "none" : prev.parkingMode,
    }));
  }

  function changeDate(date: string) {
    setD((prev) => ({
      ...prev,
      date,
      // 締切が自動設定のままなら、日付に合わせて動かす
      deadline: prev.parkingMode === "lottery" && (!prev.deadline || prev.deadline === autoDeadline(prev.date)) ? autoDeadline(date) : prev.deadline,
    }));
  }

  function changeParkingMode(mode: "none" | "lottery") {
    setD((prev) => ({ ...prev, parkingMode: mode, deadline: mode === "lottery" && !prev.deadline ? autoDeadline(prev.date) : prev.deadline }));
  }

  function applyLine() {
    const p = parseLineMessage(lineText, jstToday(t.now));
    const filled: string[] = [];
    const next: EventDraft = { ...d, uniform: { ...d.uniform } };
    if (p.date) { next.date = p.date; filled.push("日付"); }
    if (p.title) { next.title = p.title; filled.push("予定名"); }
    if (p.opponent) { next.opponent = p.opponent; filled.push("対戦相手"); }
    if (p.venue) { next.venue = p.venue; filled.push("場所"); }
    if (p.meeting) { next.meeting = p.meeting; filled.push("集合"); }
    if (p.kickoff) { next.kickoff = p.kickoff; filled.push("キックオフ"); }
    if (p.end) { next.end = p.end; filled.push("終了"); }
    if (p.uniformTop || p.uniformBottom || p.uniformSocks) {
      next.uniform = { top: p.uniformTop ?? next.uniform.top, bottom: p.uniformBottom ?? next.uniform.bottom, socks: p.uniformSocks ?? next.uniform.socks };
      filled.push("ユニフォーム");
    }
    if (p.note) { next.note = next.note ? `${next.note}\n\n${p.note}` : p.note; filled.push("補足（スケジュール）"); }
    if (p.opponent || p.kickoff) next.kind = "match";
    if (next.parkingMode === "lottery" && next.date !== d.date && (!d.deadline || d.deadline === autoDeadline(d.date))) next.deadline = autoDeadline(next.date);
    setD(next);
    setLineResult(filled.length ? `読み取って入力した項目：${filled.join("・")}。内容を確認してください。` : "読み取れる項目がありませんでした。");
  }

  async function save() {
    const problems = validateDraft(d);
    if (existing && existing.version !== d.version) {
      problems.unshift("ほかのコーチがこの予定を先に更新しました。いったん閉じて、最新の内容を確認してから編集し直してください。");
    }
    if (problems.length) {
      setErrors(problems);
      setTimeout(() => errorRef.current?.scrollIntoView({ block: "nearest" }), 0);
      return;
    }
    setBusy(true);
    setErrors([]);
    const nameOf = (id: string | null) => (id ? t.data.tournaments.find((x) => x.id === id)?.name ?? "" : "");
    try {
      const id = await saveEvent(t.grade, d, {
        before: existing ? snapshotOfEvent(existing, nameOf(existing.tournamentId)) : null,
        after: snapshotOfDraft(d, nameOf(d.tournamentId || null)),
      });
      // 外した資料と、アップロードしたが保存しなかった資料の実体を消す
      const kept = new Set(d.attachments.map((a) => a.path));
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
  const tournaments = t.data.tournaments.filter((x) => !x.archived || x.id === d.tournamentId);
  const members = t.data.members.filter((m) => m.active || d.confirmed.includes(m.id));
  const colors = t.data.settings.uniformColors;

  return (
    <div className="editor-backdrop" role="presentation">
      <div className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header className="editor-head">
          <h2 id="editor-title">{d.id ? "予定を編集" : "予定を追加"}</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={close}><X size={20} /></button>
        </header>

        <div className="editor-body">
          {!d.id && (
            <details className="line-import">
              <summary>LINEの文面から入力する</summary>
              <textarea className="input" rows={5} value={lineText} onChange={(e) => setLineText(e.target.value)} placeholder="試合連絡の文面を貼り付けてください" aria-label="LINEの文面" />
              <button type="button" className="btn btn-small" onClick={applyLine} disabled={!lineText.trim()}>読み取って入力</button>
              {lineResult && <p className="field-hint" role="status">{lineResult}</p>}
            </details>
          )}

          <Group label="種別">
            <Segmented label="種別" value={d.kind} options={KINDS} onChange={changeKind} />
          </Group>

          <Field label="日付">
            {(id) => <input id={id} className="input" type="date" value={d.date} onChange={(e) => changeDate(e.target.value)} required />}
          </Field>

          <Field label="予定名">
            {(id) => (
              <>
                <div className="chips">
                  {TITLE_PRESETS[d.kind].map((title) => <Chip key={title} pressed={d.title === title} onClick={() => set("title", title)}>{title}</Chip>)}
                </div>
                <input id={id} className="input" value={d.title} maxLength={100} onChange={(e) => set("title", e.target.value)} placeholder="例: プレミアリーグ vs ○○FC" />
              </>
            )}
          </Field>

          {isMatch && (
            <Field label="大会" hint="大会を選ぶと、大会共通の要項がこの予定の詳細にも表示されます。">
              {(id) => (
                <select id={id} className="input" value={d.tournamentId} onChange={(e) => set("tournamentId", e.target.value)}>
                  <option value="">大会に紐付けない</option>
                  {tournaments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              )}
            </Field>
          )}

          {isMatch && (
            <Field label="対戦相手">
              {(id) => <input id={id} className="input" value={d.opponent} maxLength={60} onChange={(e) => set("opponent", e.target.value)} placeholder="例: ○○FC（複数なら「、」区切り）" />}
            </Field>
          )}

          <Group label="時間" hint="未定の時刻は空欄のままにしてください。">
            {TIME_PRESETS[d.kind].length > 0 && (
              <div className="chips">
                {TIME_PRESETS[d.kind].map(([s, e]) => (
                  <Chip key={s + e} pressed={d.start === s && d.end === e} onClick={() => setD((prev) => ({ ...prev, start: s, end: e }))}>{s}–{e}</Chip>
                ))}
              </div>
            )}
            <div className="time-grid">
              <TimeInput label="開始" value={d.start} onChange={(v) => set("start", v)} />
              <TimeInput label="終了" value={d.end} onChange={(v) => set("end", v)} />
              {!isNotice && <TimeInput label="集合" value={d.meeting} onChange={(v) => set("meeting", v)} />}
              {isMatch && <TimeInput label="キックオフ" value={d.kickoff} onChange={(v) => set("kickoff", v)} />}
            </div>
          </Group>

          <Field label="場所">
            {(id) => (
              <>
                <div className="chips">
                  {venues.map((v) => <Chip key={v} pressed={d.venue === v} onClick={() => set("venue", v)}>{v}</Chip>)}
                </div>
                <input id={id} className="input" value={d.venue} maxLength={120} onChange={(e) => set("venue", e.target.value)} placeholder="会場名（地図の検索にも使います）" />
              </>
            )}
          </Field>

          {!isNotice && (
            <Group label="ユニフォーム">
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
          )}

          {!isNotice && (
            <Group label="持ち物">
              <div className="chips">
                {[...new Set([...EQUIPMENT_CHOICES, ...d.equipment])].map((item) => (
                  <Chip key={item} pressed={d.equipment.includes(item)} onClick={() => set("equipment", toggle(d.equipment, item))}>{item}</Chip>
                ))}
              </div>
              <label className="check-line">
                <input type="checkbox" checked={d.equipmentConfirmed} onChange={(e) => set("equipmentConfirmed", e.target.checked)} />
                持ち物を確認済みとして表示する
              </label>
            </Group>
          )}

          <Group label="チームからの連絡">
            <div className="chips">
              {[...new Set([...MESSAGE_CHOICES, ...d.messages])].map((m) => (
                <Chip key={m} pressed={d.messages.includes(m)} onClick={() => set("messages", toggle(d.messages, m))}>{m}</Chip>
              ))}
            </div>
            <textarea className="input" rows={3} value={d.note} maxLength={2000} onChange={(e) => set("note", e.target.value)} placeholder="補足（自由記述）" aria-label="補足" />
          </Group>

          <Field label="開催状況">
            {(id) => (
              <select id={id} className="input" value={d.status} onChange={(e) => set("status", e.target.value as EventStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            )}
          </Field>

          {!isNotice && (
            <section className="editor-section" aria-labelledby="yokou-title">
              <h3 id="yokou-title">📄 試合要項（任意）</h3>
              <Field label="試合形式">
                {(id) => <input id={id} className="input" value={d.details.format} maxLength={200} onChange={(e) => set("details", { ...d.details, format: e.target.value })} placeholder="例: 8人制 15分ハーフ" />}
              </Field>
              <Field label="審判割当">
                {(id) => <textarea id={id} className="input" rows={2} value={d.details.referee} maxLength={500} onChange={(e) => set("details", { ...d.details, referee: e.target.value })} placeholder="例: 第2試合 主審・副審 MSS" />}
              </Field>
              <Field label="会場・駐車の注意事項">
                {(id) => <textarea id={id} className="input" rows={3} value={d.details.venueNotes} maxLength={1000} onChange={(e) => set("details", { ...d.details, venueNotes: e.target.value })} placeholder="例: 正門側は駐車禁止。保護者の観戦は○○側から" />}
              </Field>
            </section>
          )}

          <section className="editor-section" aria-labelledby="files-title">
            <h3 id="files-title">📄 当日資料（画像・PDF）</h3>
            <p className="field-hint">タイムテーブルやコート図のスクショ、要項のPDFなど。大会共通の要項は「大会・要項」タブで大会に登録すると、紐付けた試合すべてに表示されます。</p>
            <FileUploader attachments={d.attachments} onChange={(a) => set("attachments", a)} onUploaded={(path) => setUploaded((u) => [...u, path])} />
          </section>

          {!isNotice && (
            <section className="editor-section" aria-labelledby="parking-title">
              <h3 id="parking-title">🚗 駐車場抽選</h3>
              <Segmented label="駐車場抽選の有無" value={d.parkingMode} options={[{ value: "none", label: "不要" }, { value: "lottery", label: "抽選あり" }]} onChange={changeParkingMode} />
              {d.parkingMode === "lottery" && (
                <>
                  <Group label="駐車可能台数（上限）">
                    <div className="stepper">
                      <button type="button" className="icon-btn" aria-label="1台減らす" onClick={() => set("parkingLimit", Math.max(1, d.parkingLimit - 1))}><Minus size={18} /></button>
                      <output aria-live="polite">{d.parkingLimit}台</output>
                      <button type="button" className="icon-btn" aria-label="1台増やす" onClick={() => set("parkingLimit", Math.min(50, d.parkingLimit + 1))}><Plus size={18} /></button>
                    </div>
                  </Group>
                  <Field label="応募締切" hint="締切を過ぎると、保護者は車出しの辞退だけができます。空欄にすると締切なしになります。">
                    {(id) => (
                      <div className="inline-row">
                        <input id={id} className="input" type="datetime-local" value={d.deadline} onChange={(e) => set("deadline", e.target.value)} />
                        <button type="button" className="btn btn-small" onClick={() => set("deadline", autoDeadline(d.date))}>2日前17:00</button>
                      </div>
                    )}
                  </Field>
                  <Group label="確定枠（抽選しない車）" hint="コーチの車・用具運搬など。駐車可能台数のうち、この台数は抽選の対象外になります。">
                    <div className="chips">
                      {members.map((m) => (
                        <Chip key={m.id} pressed={d.confirmed.includes(m.id)} onClick={() => set("confirmed", toggle(d.confirmed, m.id))}>#{m.num} {m.name}</Chip>
                      ))}
                    </div>
                  </Group>
                  {drawn && <p className="alert alert-warn">この予定はすでに抽選済みです。台数を変えた場合は、予定の詳細の駐車場欄で再抽選を行ってください。</p>}
                </>
              )}
            </section>
          )}

          {existing && (
            <section className="editor-danger">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}><Trash2 size={16} aria-hidden="true" />この予定を削除</button>
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

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <span className="time-input">
          <input id={id} className="input" type="time" step={300} value={value} onChange={(e) => onChange(e.target.value)} />
          {value && <button type="button" className="time-clear" aria-label={`${label}を未定にする`} onClick={() => onChange("")}>未定</button>}
        </span>
      )}
    </Field>
  );
}
