import { useEffect, useState } from "react";
import { BellRing, History } from "lucide-react";
import { loadHistory, type HistoryItem } from "../lib/changes";
import { dateTimeLabel } from "../lib/datetime";
import { useTeam } from "../lib/teamContext";
import { summarize } from "../lib/updates";
import type { TeamEvent } from "../lib/types";

/**
 * 予定の画面の更新表示。
 * 前回見たあとに変わっていれば「🔔 前回から変わったところ」を自動で開き、変更前→変更後を目立たせる（開いた時点で確認済み）。
 * それ以外は「変更履歴」をたたんでおく。
 */
export function ChangeHistory({ event, showLog = true }: { event: TeamEvent; showLog?: boolean }) {
  const t = useTeam();
  // 画面を開いた時点で、この端末が見ていた版（この画面にいる間は固定）
  const [since] = useState(() => (t.isUnread(event) ? t.seen[event.id] ?? 0 : event.version));
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = event.version > since;

  // 変わっていれば履歴を読み込み、見たことにする（画面を開いている間に更新された場合も同じ）
  useEffect(() => {
    if (!changed && !showAll) return;
    let alive = true;
    loadHistory(t.grade, event.id)
      .then((h) => { if (alive) { setItems(h); setError(null); } })
      .catch(() => { if (alive) setError("変更履歴を読み込めませんでした。通信状態を確認してください。"); });
    return () => { alive = false; };
  }, [t.grade, event.id, event.version, changed, showAll]);

  const { markSeen } = t;
  useEffect(() => {
    markSeen({ [event.id]: event.version });
  }, [markSeen, event.id, event.version]);

  const sum = items && changed ? summarize(items, since) : null;

  return (
    <>
      {changed && (
        <section className="whats-new" aria-label="前回から変わったところ">
          <p className="whats-new-head"><BellRing size={17} aria-hidden="true" />前回から変わったところ<small>{dateTimeLabel(event.updatedAt)}</small></p>
          {!sum && !error && <p className="muted">読み込み中…</p>}
          {sum?.added && <p className="whats-new-added">🆕 新しく追加された予定です</p>}
          {sum && sum.changes.length > 0 && (
            <ul className="whats-new-list">
              {sum.changes.map((c) => (
                <li key={c.label}>
                  <b>{c.label}</b>
                  <span className="wn-before">{c.before}</span>
                  <span className="wn-arrow" aria-label="から">→</span>
                  <span className="wn-after">{c.after}</span>
                </li>
              ))}
            </ul>
          )}
          {sum && !sum.added && !sum.changes.length && <p className="muted">表示できる変更はありません。</p>}
        </section>
      )}
      {showLog && <section className="change-callout" aria-label="変更履歴">
        <div className="change-summary">
          <div>
            <b>変更履歴</b>
            <small>{dateTimeLabel(event.updatedAt)}に{event.version === 1 ? "追加" : "更新"}</small>
          </div>
          <button className="btn btn-small" onClick={() => setShowAll((v) => !v)}>
            <History size={15} aria-hidden="true" />{showAll ? "閉じる" : "すべて見る"}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {showAll && items && (
          <div className="history">
            {items.length === 0 && <p className="muted">表示できる変更履歴はありません（移行した予定は、移行後の変更から記録されます）。</p>}
            {items.map((h, i) => (
              <details key={h.id} open={i === 0}>
                <summary>{dateTimeLabel(h.at)}・{h.type === "added" ? "予定を追加" : "予定を変更"}</summary>
                {h.type === "added" ? (
                  <p className="muted">この予定が追加されました。</p>
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
          </div>
        )}
      </section>}
    </>
  );
}
