import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { addDays, dateTimeLabel, dayLabel, jstToday, relativeDay, timeLeft } from "../lib/datetime";
import { cumulativeStats, seasonStartDate } from "../lib/lottery";
import { useMyMember } from "../lib/myMember";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";
import { RosterEditor } from "../components/RosterEditor";

export function ParkingView() {
  const t = useTeam();
  const today = jstToday(t.now);
  const [myId, setMyId] = useMyMember(t.grade);
  const [showPast, setShowPast] = useState(false);
  const lotteryEvents = t.data.events.filter((e) => e.parking.mode === "lottery");
  const upcoming = lotteryEvents.filter((e) => e.date >= today);
  const past = lotteryEvents.filter((e) => e.date < today).reverse();
  const activeMembers = t.data.members.filter((m) => m.active);
  const from = seasonStartDate(today, t.data.settings.seasonStart);
  // 年度末まで（抽選済みなら、これからの試合も数える）
  const until = addDays(`${Number(from.slice(0, 4)) + 1}-${t.data.settings.seasonStart}`, -1);
  const stats = useMemo(
    () => cumulativeStats(t.data.events, t.data.lotteries, t.data.members, from, until),
    [t.data.events, t.data.lotteries, t.data.members, from, until],
  );

  const myStatus = (e: TeamEvent): string | null => {
    if (!myId) return null;
    if (e.parking.confirmed.includes(myId)) return "確定枠";
    const l = t.data.lotteries[e.id];
    const entry = t.data.entries[e.id]?.[myId];
    if (l?.winners.includes(myId)) return entry?.parkingNeeded ? "当選" : "当選後に辞退";
    if (l?.participants.includes(myId)) return "落選";
    if (!entry) return "未回答";
    if (!entry.attending) return "欠席";
    return entry.parkingNeeded ? "車出し希望" : "車なしで参加";
  };

  const row = (e: TeamEvent) => {
    const s = t.parkingOf(e);
    const mine = myStatus(e);
    return (
      <li key={e.id}>
        <button className="event-row" onClick={() => t.navigate({ name: "event", id: e.id, from: "parking" })}>
          <span className="event-date"><b>{dayLabel(e.date)}</b><small>{relativeDay(e.date, today)}</small></span>
          <span className="event-main">
            <span className="badges">{s && <span className={`badge parking-${s.phase}`}>{s.label}</span>}{mine && <span className="badge badge-mine">あなた：{mine}</span>}</span>
            <b className="event-title">{e.title}</b>
            {e.parking.deadlineAt && (
              <span className="event-meta">締切 {dateTimeLabel(e.parking.deadlineAt)}{timeLeft(e.parking.deadlineAt, t.now) ? `（${timeLeft(e.parking.deadlineAt, t.now)}）` : ""}</span>
            )}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">PARKING LOTTERY</p>
          <h1 className="page-title">駐車場抽選</h1>
        </div>
      </section>

      <section className="card my-child">
        <label className="field">
          <span className="field-label">お子さんの名前（この端末に記憶）</span>
          <select className="input" value={myId ?? ""} onChange={(e) => setMyId(e.target.value || null)}>
            <option value="">選んでください</option>
            {activeMembers.map((m) => <option key={m.id} value={m.id}>#{m.num} {m.name}</option>)}
          </select>
        </label>
        <p className="muted">車出しのエントリーは、各試合の詳細画面からできます。抽選は全員同じ確率のあみだくじです（並び順も毎回ランダム）。</p>
      </section>

      <section aria-labelledby="open-title">
        <div className="section-head">
          <h2 id="open-title" className="section-title">これからの抽選</h2>
          <span className="section-sub">{upcoming.length}件</span>
        </div>
        {upcoming.length ? <ul className="event-list">{upcoming.map(row)}</ul> : (
          <div className="empty">駐車場抽選のある予定はまだありません。{t.coach && "予定の編集で「抽選あり」にすると、ここに表示されます。"}</div>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-title">
          <div className="section-head">
            <h2 id="past-title" className="section-title">これまでの抽選</h2>
            <button className="btn btn-small btn-ghost" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>{showPast ? "閉じる" : `${past.length}件を表示`}</button>
          </div>
          {showPast && <ul className="event-list">{past.map(row)}</ul>}
        </section>
      )}

      <section aria-labelledby="stats-title">
        <div className="section-head">
          <h2 id="stats-title" className="section-title">今年度の累計</h2>
          <span className="section-sub">{from.replaceAll("-", "/")}〜</span>
        </div>
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr><th scope="col">背番号</th><th scope="col">名前</th><th scope="col">応募</th><th scope="col">当選</th><th scope="col">落選</th><th scope="col">確定枠</th></tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => {
                const s = stats.get(m.id) ?? { applied: 0, won: 0, lost: 0, confirmed: 0 };
                return (
                  <tr key={m.id} className={m.id === myId ? "is-mine" : ""}>
                    <td>{m.num}</td><th scope="row">{m.name}</th><td>{s.applied}</td><td>{s.won}</td><td>{s.lost}</td><td>{s.confirmed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">抽選結果から毎回数えています。当選後の辞退も当選に数えます。確定枠（抽選なし）は別に数えます。</p>
      </section>

      {t.coach && <RosterEditor />}
    </>
  );
}
