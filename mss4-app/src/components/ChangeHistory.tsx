import { useEffect, useState } from "react";
import { Check, History } from "lucide-react";
import { loadHistory, type HistoryItem } from "../lib/changes";
import { dateTimeLabel } from "../lib/datetime";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";

/** 「未確認の更新があります」→「変更内容を見る」→「この更新を確認済みにする」 */
export function ChangeHistory({ event }: { event: TeamEvent }) {
  const t = useTeam();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [loadedVersion, setLoadedVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unread = t.isUnread(event);
  const byCoach = event.updatedBy === "コーチ";

  useEffect(() => {
    setItems(null);
    setError(null);
  }, [event.id]);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      setItems(await loadHistory(t.grade, event.id));
      setLoadedVersion(event.version);
    } catch {
      setError("変更履歴を読み込めませんでした。通信状態を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  const stale = items !== null && loadedVersion !== event.version;

  return (
    <section className={`change-callout ${unread ? "is-unread" : ""}`} aria-label="この予定の更新">
      <div className="change-summary">
        <div>
          <b>{unread ? "未確認の更新があります" : byCoach && !t.coach ? "この端末では確認済み" : "登録・変更の履歴"}</b>
          {byCoach && <small>{dateTimeLabel(event.updatedAt)}・コーチが{event.version === 1 ? "追加" : "変更"}しました</small>}
        </div>
        <button className="btn btn-small" onClick={open} disabled={loading}>
          <History size={15} aria-hidden="true" />{loading ? "読み込み中…" : items ? "再読み込み" : "変更内容を見る"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {stale && <p className="field-hint" role="status">新しい更新があります。「再読み込み」で最新の履歴を確認してください。</p>}
      {items && (
        <div className="history">
          {items.length === 0 && <p className="muted">表示できる変更履歴はありません（移行した予定は、移行後の変更から記録されます）。</p>}
          {items.map((h, i) => (
            <details key={h.id} open={i === 0}>
              <summary>{dateTimeLabel(h.at)}・{h.type === "added" ? "予定を追加" : "予定を変更"}</summary>
              {h.type === "added" ? (
                <p className="muted">この予定が追加されました。現在の内容を下で確認してください。</p>
              ) : (
                <div className="changes">
                  {h.changes.map((c) => (
                    <div className="change" key={c.label}>
                      <b>{c.label}</b>
                      <div className="change-before"><small>変更前</small><span>{c.before}</span></div>
                      <div className="change-after"><small>変更後</small><span>{c.after}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          ))}
          {!t.coach && unread && !stale && (
            <button className="btn btn-primary btn-block" onClick={() => t.markSeen(event.id, event.version)}>
              <Check size={17} aria-hidden="true" />この更新を確認済みにする
            </button>
          )}
        </div>
      )}
    </section>
  );
}
