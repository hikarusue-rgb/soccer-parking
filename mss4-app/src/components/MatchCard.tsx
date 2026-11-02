import { dateTimeLabel, dayLabel, timeLeft } from "../lib/datetime";
import { applicantsOf } from "../lib/parking";
import { lotterySlots } from "../lib/lottery";
import { useTeam } from "../lib/teamContext";
import type { TeamEvent } from "../lib/types";

/** 試合カード（旧駐車場抽選アプリと同じ情報：回答済み・駐車場希望・何台まで可・締切） */
export function MatchCard({ event: e, onOpen }: { event: TeamEvent; onOpen: () => void }) {
  const t = useTeam();
  const entries = t.data.entries[e.id] ?? {};
  const lottery = t.data.lotteries[e.id];
  const members = t.data.members.filter((m) => m.active);
  const answered = members.filter((m) => entries[m.id]).length;
  const hopefuls = applicantsOf(e, entries).length;
  const parking = e.parking.mode === "lottery" && e.parking.limit > 0;
  const slots = lotterySlots(e);
  const deadline = e.parking.deadlineAt;
  const closed = deadline !== null && t.now >= deadline;
  const left = deadline !== null && !closed ? timeLeft(deadline, t.now) : null;
  const time = [e.meeting && `集合${e.meeting}`, e.kickoff && `KO${e.kickoff}`, e.end && `終了${e.end}`].filter(Boolean).join(" / ");
  const u = e.uniform;
  const updated = t.isUnread(e) || t.isLotteryUnread(e);

  let badge: { label: string; tone: string } | null = null;
  if (e.status === "canceled") badge = { label: "中止", tone: "red" };
  else if (e.status === "postponed") badge = { label: "延期", tone: "red" };
  else if (!parking) badge = null;
  else if (lottery) badge = { label: "✅ 抽選完了", tone: "green" };
  else if (closed && hopefuls > slots && slots > 0) badge = { label: "⚠️ 抽選待ち", tone: "amber" };
  else if (closed && hopefuls > 0) badge = { label: "✅ 全員OK", tone: "green" };
  else if (closed) badge = { label: "締切済", tone: "gray" };
  else if (left) badge = { label: `⏱ ${left}`, tone: "blue" };

  return (
    <button className={`match-card ${e.status === "canceled" ? "is-canceled" : ""} ${updated ? "is-updated" : ""}`} onClick={onOpen}>
      <span className="match-card-head">
        <span>
          {updated && <span className="new-flag">🔔 {t.isLotteryUnread(e) ? "抽選結果" : "更新"}</span>}
          <b className="match-title">{e.title}</b>
          <span className="match-date">🗓 {dayLabel(e.date)}{e.kickoff ? ` ${e.kickoff}` : e.start ? ` ${e.start}` : ""}</span>
        </span>
        {badge && <span className={`tag tag-${badge.tone}`}>{badge.label}</span>}
      </span>
      {(e.opponent || e.venue || time || u.top) && (
        <span className="match-info">
          {e.opponent && e.opponent !== e.title && <span>🆚 {e.opponent}</span>}
          {e.venue && <span>📍 {e.venue}</span>}
          {time && <span>⏰ {time}</span>}
          {(u.top || u.bottom || u.socks) && <span>👕 {u.top && u.top === u.bottom && u.bottom === u.socks ? u.top : [u.top, u.bottom, u.socks].map((x) => x || "—").join("/")}</span>}
          {e.attachments.length > 0 && <span className="match-docs">📄 要項あり</span>}
        </span>
      )}
      {parking ? (
        <>
          <span className="stats">
            <span className="stat"><b>{answered}<small>/{members.length}名</small></b><small>回答済み</small></span>
            <span className="stat"><b className="amber">{hopefuls}</b><small>駐車場希望</small></span>
            <span className="stat"><b className="blue">{e.parking.limit}</b><small>台まで可</small></span>
          </span>
          {e.parking.confirmed.length > 0 && <span className="match-note blue">🔒 確定枠{e.parking.confirmed.length}台 ／ 抽選枠{slots}台</span>}
          {deadline !== null && <span className="match-note">締切: {dateTimeLabel(deadline)}</span>}
        </>
      ) : (
        <span className="match-note">🚗 駐車場の抽選はありません</span>
      )}
    </button>
  );
}
