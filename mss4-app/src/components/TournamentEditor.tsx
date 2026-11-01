import { useEffect, useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import { deleteTournament, saveTournament, validateTournament, type TournamentDraft } from "../lib/tournamentForm";
import { useTeam } from "../lib/teamContext";
import { deleteFiles } from "../lib/uploads";
import { FileUploader } from "./FileUploader";
import { Field } from "./FormBits";

interface Props {
  initial: TournamentDraft;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}

/** 大会の追加・編集（共通要項ファイル・基本レギュレーション・公式URL） */
export function TournamentEditor({ initial, onClose, onSaved, onDeleted }: Props) {
  const t = useTeam();
  const [d, setD] = useState<TournamentDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const existing = d.id ? t.data.tournaments.find((x) => x.id === d.id) ?? null : null;
  const linked = d.id ? t.data.events.filter((e) => e.tournamentId === d.id) : [];
  const set = <K extends keyof TournamentDraft>(key: K, value: TournamentDraft[K]) => setD((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function close() {
    if (dirty && !window.confirm("編集中の内容を保存せずに閉じますか？")) return;
    void deleteFiles(uploaded);
    onClose();
  }

  async function save() {
    const problems = validateTournament(d);
    if (existing && existing.version !== d.version) problems.unshift("ほかのコーチがこの大会を先に更新しました。いったん閉じて最新の内容を確認してください。");
    if (problems.length) return setErrors(problems);
    setBusy(true);
    setErrors([]);
    try {
      const id = await saveTournament(t.grade, d);
      const kept = new Set(d.attachments.map((a) => a.path));
      void deleteFiles([...initial.attachments.map((a) => a.path), ...uploaded].filter((p) => !kept.has(p)));
      onSaved(id);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "保存できませんでした。"]);
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (linked.length) {
      window.alert(`この大会には${linked.length}件の試合が紐付いているため削除できません。終わった大会は「終了した大会として一覧から隠す」を使ってください。`);
      return;
    }
    if (!window.confirm(`大会「${existing.name}」を削除します。共通要項のファイルも削除され、元に戻せません。よろしいですか？`)) return;
    setBusy(true);
    try {
      await deleteTournament(t.grade, existing.id);
      void deleteFiles([...existing.attachments.map((a) => a.path), ...uploaded]);
      onDeleted?.();
    } catch {
      setErrors(["削除できませんでした。"]);
      setBusy(false);
    }
  }

  return (
    <div className="editor-backdrop" role="presentation">
      <div className="editor" role="dialog" aria-modal="true" aria-labelledby="t-editor-title">
        <header className="editor-head">
          <h2 id="t-editor-title">{d.id ? "大会を編集" : "大会を追加"}</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={close}><X size={20} /></button>
        </header>
        <div className="editor-body">
          <Field label="大会名">
            {(id) => <input id={id} className="input" value={d.name} maxLength={100} onChange={(e) => set("name", e.target.value)} placeholder="例: 2026 プレミアリーグ" />}
          </Field>
          <div className="time-grid">
            <Field label="開始日">{(id) => <input id={id} className="input" type="date" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />}</Field>
            <Field label="終了日">{(id) => <input id={id} className="input" type="date" value={d.endDate} onChange={(e) => set("endDate", e.target.value)} />}</Field>
          </div>
          <Field label="主催">
            {(id) => <input id={id} className="input" value={d.organizer} maxLength={100} onChange={(e) => set("organizer", e.target.value)} placeholder="例: ○○市サッカー協会 少年部" />}
          </Field>
          <Field label="公式URL" hint="大会のホームページなど（https:// から）">
            {(id) => <input id={id} className="input" type="url" inputMode="url" value={d.officialUrl} maxLength={500} onChange={(e) => set("officialUrl", e.target.value)} placeholder="https://" />}
          </Field>
          <Field label="基本レギュレーション">
            {(id) => <textarea id={id} className="input" rows={4} value={d.regulations} maxLength={3000} onChange={(e) => set("regulations", e.target.value)} placeholder="例: 8人制・15分ハーフ（ハーフタイム5分）・交代自由・ボール4号" />}
          </Field>
          <Field label="共通の注意事項">
            {(id) => <textarea id={id} className="input" rows={3} value={d.notes} maxLength={3000} onChange={(e) => set("notes", e.target.value)} placeholder="例: 保護者の駐車は会場ごとの台数制限あり。ゴミは各自持ち帰り" />}
          </Field>
          <section className="editor-section" aria-labelledby="t-files-title">
            <h3 id="t-files-title">📄 大会共通の要項（画像・PDF）</h3>
            <FileUploader attachments={d.attachments} onChange={(a) => set("attachments", a)} onUploaded={(p) => setUploaded((u) => [...u, p])} />
          </section>
          {d.id && (
            <label className="check-line">
              <input type="checkbox" checked={d.archived} onChange={(e) => set("archived", e.target.checked)} />
              終了した大会として一覧から隠す
            </label>
          )}
          {existing && (
            <section className="editor-danger">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}><Trash2 size={16} aria-hidden="true" />この大会を削除</button>
            </section>
          )}
        </div>
        <footer className="editor-foot">
          {errors.length > 0 && <ul className="form-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="editor-actions">
            <button type="button" className="btn" onClick={close} disabled={busy}>キャンセル</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}><Save size={17} aria-hidden="true" />{busy ? "保存しています…" : "保存"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
