import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { SaveError, newMemberId, saveMembers } from "../lib/mutations";
import { useTeam } from "../lib/teamContext";
import type { Member } from "../lib/types";

/** 名簿の管理（コーチのみ）。抽選履歴と結び付いているため削除はせず「名簿から外す」にする */
export function RosterEditor() {
  const t = useTeam();
  const [rows, setRows] = useState<Member[]>(t.data.members);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  // ほかのコーチが名簿を変えたら、未編集のときだけ取り込む
  useEffect(() => {
    if (!dirty) setRows(t.data.members);
  }, [t.data.members, dirty]);

  const change = (id: string, patch: Partial<Member>) => {
    setRows((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setDirty(true);
    setMessage(null);
  };

  function add() {
    const order = Math.max(0, ...rows.map((m) => m.order)) + 1;
    setRows((prev) => [...prev, { id: newMemberId(t.grade), num: 0, name: "", active: true, order }]);
    setDirty(true);
  }

  async function save() {
    const problems = rows.filter((m) => !m.name.trim() || !Number.isInteger(m.num) || m.num < 0 || m.num > 999);
    if (problems.length) {
      setMessage({ kind: "error", text: "名前と背番号（0〜999）を入力してください。" });
      return;
    }
    const before = new Map(t.data.members.map((m) => [m.id, JSON.stringify(m)]));
    const changed = rows.filter((m) => before.get(m.id) !== JSON.stringify({ ...m, name: m.name.trim() }));
    if (!changed.length) {
      setDirty(false);
      return;
    }
    setBusy(true);
    try {
      await saveMembers(t.grade, changed);
      setDirty(false);
      setMessage({ kind: "info", text: `${changed.length}人分を保存しました。` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof SaveError ? error.message : "保存できませんでした。" });
    } finally {
      setBusy(false);
    }
  }

  const duplicates = new Set(rows.filter((m) => m.active).map((m) => m.num).filter((n, i, all) => all.indexOf(n) !== i));

  return (
    <section className="card roster" aria-labelledby="roster-title">
      <div className="section-head">
        <h2 id="roster-title" className="section-title">名簿の管理（コーチ）</h2>
        <span className="section-sub">{rows.filter((m) => m.active).length}人</span>
      </div>
      <ul className="roster-list">
        {rows.map((m) => (
          <li key={m.id} className={m.active ? "" : "is-inactive"}>
            <label className="roster-num">
              <span className="sr-only">背番号</span>
              <input className="input" type="number" inputMode="numeric" min={0} max={999} value={Number.isFinite(m.num) ? m.num : ""} onChange={(e) => change(m.id, { num: Number.parseInt(e.target.value, 10) })} aria-label="背番号" />
            </label>
            <input className="input" value={m.name} maxLength={40} onChange={(e) => change(m.id, { name: e.target.value })} aria-label="名前" placeholder="名前" />
            <label className="check-line roster-active">
              <input type="checkbox" checked={m.active} onChange={(e) => change(m.id, { active: e.target.checked })} />
              在籍
            </label>
            {duplicates.has(m.num) && m.active && <small className="form-error">背番号が重複しています</small>}
          </li>
        ))}
      </ul>
      <p className="muted">チェックを外すと名簿から外れます（過去の抽選記録は残ります）。</p>
      {message && <p className={`alert ${message.kind === "error" ? "alert-error" : "alert-info"}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
      <div className="inline-row">
        <button className="btn" onClick={add}><Plus size={16} aria-hidden="true" />メンバーを追加</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !dirty}><Save size={16} aria-hidden="true" />{busy ? "保存しています…" : "名簿を保存"}</button>
      </div>
    </section>
  );
}
