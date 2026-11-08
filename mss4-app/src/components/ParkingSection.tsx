import { useEffect, useState } from "react";
import { Share2, Undo2 } from "lucide-react";
import { dateTimeLabel, timeLeft } from "../lib/datetime";
import { groupMembers } from "../lib/lineText";
import { lotterySlots, reservedOf, lotteryState, nextDraw, runDraw } from "../lib/lottery";
import { SaveError, clearLottery, saveEntry, saveLottery } from "../lib/mutations";
import { useMyMember } from "../lib/myMember";
import { DutyCard } from "./DutyCard";
import { applicantsOf } from "../lib/parking";
import { useTeam } from "../lib/teamContext";
import type { LotteryLadder, Member, TeamEvent } from "../lib/types";
import { Amidakuji } from "./Amidakuji";

/** 試合の画面の「🚗 駐車場」（旧駐車場抽選アプリと同じ流れ：選手を選ぶ → 参加しますか → 駐車場を希望しますか → 乗合） */
export function ParkingSection({ event }: { event: TeamEvent }) {
  const t = useTeam();
  const entries = t.data.entries[event.id] ?? {};
  const lottery = t.data.lotteries[event.id];
  const byId = new Map(t.data.members.map((m) => [m.id, m]));
  const activeMembers = t.data.members.filter((m) => m.active);
  const confirmed = event.parking.confirmed;
  const confirmedMembers = confirmed.map((id) => byId.get(id)).filter((m): m is Member => Boolean(m));
  const slots = lotterySlots(event);
  const reserved = reservedOf(event);
  const hopefuls = applicantsOf(event, entries);
  const answered = activeMembers.filter((m) => entries[m.id]).length;
  const deadline = event.parking.deadlineAt;
  const closed = deadline !== null && t.now >= deadline;
  const left = deadline !== null && !closed ? timeLeft(deadline, t.now) : null;
  const groups = groupMembers(event, t.data.members, entries, lottery);
  const state = lottery ? lotteryState(event, entries, lottery) : null;
  const plan = t.coach ? nextDraw(event, entries, lottery) : null;
  const [replay, setReplay] = useState<{ ladder: LotteryLadder; autoplay: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const nameOf = (id: string) => byId.get(id)?.name ?? "（名簿外）";

  async function draw() {
    if (!plan) return;
    if (plan.reason === "initial" && !closed && !window.confirm("回答締切の前ですが、いま手動で抽選しますか？\nこの時点で駐車場を希望している人だけが対象になり、締切後の自動抽選は行いません。")) return;
    setBusy(true);
    setMessage(null);
    try {
      const { lottery: result, ladder } = runDraw(plan, lottery, Date.now());
      await saveLottery(t.grade, event.id, { ...result, ladder });
      if (plan.participants.length > plan.slots) setReplay({ ladder, autoplay: true });
      else setMessage({ kind: "info", text: "希望者が枠以内のため、全員当選で確定しました。" });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof SaveError ? error.message : "抽選結果を保存できませんでした。" });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!window.confirm("抽選結果を取り消して、抽選前の状態に戻します。よろしいですか？（回答は残ります）")) return;
    setBusy(true);
    try {
      await clearLottery(t.grade, event.id);
      setMessage({ kind: "info", text: "抽選結果を取り消しました。" });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof SaveError ? error.message : "取り消せませんでした。" });
    } finally {
      setBusy(false);
    }
  }


  const drawButton = plan && (
    <button className="btn btn-yellow btn-block" onClick={draw} disabled={busy}>
      {busy ? "抽選しています…"
        : plan.reason === "initial" ? (plan.participants.length <= plan.slots ? "✅ いま全員当選で確定する（手動）" : "🎰 いま抽選する（手動）")
        : plan.reason === "limit_down" ? `☔ 台数減の再抽選（当選${plan.participants.length}名 → ${plan.slots}台）`
        : `🔄 再抽選を実施（空き${plan.slots}枠 / 候補${plan.participants.length}名）`}
    </button>
  );

  return (
    <section className="parking-sec" aria-labelledby="parking-sec-title">
      <h2 id="parking-sec-title">🚗 駐車場 {lottery && <span className="tag tag-green">抽選済</span>}</h2>

      <div className="stats">
        <span className="stat"><b>{answered}<small>/{activeMembers.length}</small></b><small>回答済み</small></span>
        <span className="stat"><b className="amber">{hopefuls.length}<small>/{slots}</small></b><small>駐車場希望</small></span>
        <span className="stat"><b className="blue">{slots}</b><small>抽選枠</small></span>
      </div>

      {reserved > 0 && (
        <div className="lock-card">
          <p className="lock-title">🔒 抽選外枠 {reserved}台（審判など）</p>
          {confirmedMembers.length > 0 && <ul className="member-chips">{confirmedMembers.map((m) => <li key={m.id}>#{m.num} {m.name}</li>)}</ul>}
          <p className="muted">合計 {event.parking.limit}台のうち、抽選するのは {slots}台です。抽選外枠を誰が使うかは審判の方で決めます。</p>
        </div>
      )}

      {deadline !== null && (
        <div className={`deadline-card ${closed ? "is-closed" : ""}`}>
          <span><small>回答締切</small><b>{dateTimeLabel(deadline)}</b></span>
          {closed ? <span className="tag tag-red">締切済み</span> : left && <span className="left">⏱ {left}</span>}
        </div>
      )}

      {lottery && (
        <Results event={event} onReplay={lottery.ladder ? () => setReplay({ ladder: lottery.ladder!, autoplay: false }) : undefined}
/>
      )}

      {state && state.dropouts.length > 0 && (
        <div className="notice notice-amber">
          <b>⚠️ 当選者キャンセル発生</b>
          <p>当選者{state.dropouts.length}名が欠席／駐車場不要に変更しました。{state.openSlots > 0 && state.candidates.length > 0 ? `空き枠${state.openSlots}台分を落選者${state.candidates.length}名から再抽選できます。` : ""}</p>
          {t.coach && plan && drawButton}
        </div>
      )}
      {state && state.overflow > 0 && (
        <div className="notice notice-amber">
          <b>☔ 駐車場台数が減りました</b>
          <p>当選者{state.effective.length}名に対して枠が{state.slots}台です。当選者の中から再抽選してください。</p>
          {t.coach && plan && drawButton}
        </div>
      )}

      {!lottery && event.parking.mode === "lottery" && <AutoDrawNote deadline={deadline} closed={closed} canceled={event.status === "canceled" || event.status === "postponed"} />}
      {!lottery && hopefuls.length > slots && slots > 0 && (
        <div className="notice notice-amber">
          <b>⚠️ 抽選が必要です</b>
          <p>希望 {hopefuls.length}名 ＞ 抽選枠 {slots}台</p>
          {t.coach && drawButton}
        </div>
      )}
      {!lottery && hopefuls.length > 0 && hopefuls.length <= slots && (
        <div className="notice notice-green">
          <b>✅ 全員分の駐車場が確保できます</b>
          <p>希望 {hopefuls.length}名 ≦ {slots}台</p>
          {t.coach && drawButton}
        </div>
      )}

      <EntryCard event={event} closed={closed} />

      <DutyCard event={event} closed={closed} />

      {groups.noReply.length > 0 && (
        <div className="unanswered">
          <div className="unanswered-head">
            <span>📭 未回答 {groups.noReply.length}名</span>
          </div>
          <ul className="member-chips">{groups.noReply.map((m) => <li key={m.id}>#{m.num} {m.name}</li>)}</ul>
        </div>
      )}

      {t.coach && lottery && (
        <button className="btn btn-small btn-ghost" onClick={undo} disabled={busy}><Undo2 size={15} aria-hidden="true" />抽選結果を取り消す</button>
      )}

      {message && <p className={`alert ${message.kind === "error" ? "alert-error" : "alert-info"}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}

      {replay && <Amidakuji ladder={replay.ladder} nameOf={nameOf} title={`${event.title} の抽選`} autoplay={replay.autoplay} onClose={() => setReplay(null)} />}
    </section>
  );
}

/** 自動抽選の案内（締切後にGASが15分ごとに確認して抽選する。締切なしは手動だけ） */
function AutoDrawNote({ deadline, closed, canceled }: { deadline: number | null; closed: boolean; canceled: boolean }) {
  if (canceled) return null;
  if (deadline === null) return <p className="auto-note">✋ 回答締切がないため、自動では抽選しません。「いま抽選する」ボタンで抽選してください。</p>;
  return closed
    ? <p className="auto-note is-soon">🤖 締切を過ぎました。15分以内に自動で抽選します（待たずに手動で抽選することもできます）。</p>
    : <p className="auto-note">🤖 回答締切（{dateTimeLabel(deadline)}）を過ぎると、自動で抽選します。全員の回答がそろっていれば、手動でいま抽選することもできます。</p>;
}

/** 抽選結果（旧アプリの結果画面と同じ並び） */
function Results({ event, onReplay, onShare }: { event: TeamEvent; onReplay?: () => void; onShare?: () => void }) {
  const t = useTeam();
  const entries = t.data.entries[event.id] ?? {};
  const g = groupMembers(event, t.data.members, entries, t.data.lotteries[event.id]);
  const carpool = (m: Member) => (entries[m.id]?.carpoolCapacity ? `（乗合+${entries[m.id].carpoolCapacity}）` : "");
  const lot = t.data.lotteries[event.id];
  const last = lot?.rounds[lot.rounds.length - 1];
  return (
    <div className="results">
      {last && <p className="draw-by">{last.by === "auto" ? "🤖 自動抽選" : "✋ 手動で抽選"}・{dateTimeLabel(last.at)}{lot && lot.rounds.length > 1 ? `（${lot.rounds.length}回目）` : ""}</p>}
      <div className="result-block win">
        <p>🚗 当選 {g.winners.length}名</p>
        {g.winners.length ? <ul>{g.winners.map((m) => <li key={m.id}>🎊 #{m.num} {m.name}{carpool(m)}</li>)}</ul> : <span className="muted">当選者なし</span>}
      </div>
      {g.losers.length > 0 && (
        <div className="result-block">
          <p>😢 落選 {g.losers.length}名（乗り合わせにご協力ください）</p>
          <ul className="member-chips">{g.losers.map((m) => <li key={m.id}>#{m.num} {m.name}</li>)}</ul>
        </div>
      )}
      {g.walkers.length > 0 && (
        <div className="result-block">
          <p>🚶 車なしで参加 {g.walkers.length}名</p>
          <ul className="member-chips">{g.walkers.map((m) => <li key={m.id}>#{m.num} {m.name}</li>)}</ul>
        </div>
      )}
      {g.absent.length > 0 && (
        <div className="result-block">
          <p>🏠 欠席 {g.absent.length}名</p>
          <ul className="member-chips">{g.absent.map((m) => <li key={m.id}>#{m.num} {m.name}</li>)}</ul>
        </div>
      )}
      <div className="inline-row">
        {onReplay && <button className="btn btn-small" onClick={onReplay}>🎰 あみだくじを見る</button>}
        {onShare && <button className="btn btn-small" onClick={onShare}><Share2 size={15} aria-hidden="true" />結果をLINEに共有</button>}
      </div>
    </div>
  );
}

/** ✏️ 参加登録（選手を選ぶ → 参加しますか？ → 駐車場を希望しますか？ → 乗合） */
function EntryCard({ event, closed }: { event: TeamEvent; closed: boolean }) {
  const t = useTeam();
  const [myId, setMyId] = useMyMember(t.grade);
  const entries = t.data.entries[event.id] ?? {};
  const lottery = t.data.lotteries[event.id];
  const members = t.data.members.filter((m) => m.active || entries[m.id]);
  const entry = myId ? entries[myId] : undefined;
  const isConfirmed = Boolean(myId && event.parking.confirmed.includes(myId));
  const slots = lotterySlots(event);
  const [editing, setEditing] = useState(false);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [parking, setParking] = useState<boolean | null>(null);
  const [carpool, setCarpool] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 選手を選び直したら、その選手の回答を読み込む
  useEffect(() => {
    setAttending(entry ? entry.attending : null);
    setParking(entry ? entry.parkingNeeded : null);
    setCarpool(entry?.carpoolCapacity ?? 0);
    setEditing(false);
    setError(null);
    setDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, event.id]);

  const locked = closed || Boolean(lottery); // 締切後・抽選後は、回答済みの内容は辞退だけ
  const showForm = Boolean(myId) && (!entry || editing);
  const askParking = !isConfirmed && !lottery;

  async function send(next: { attending: boolean; parkingNeeded: boolean; carpoolCapacity: number }, confirmText?: string) {
    if (!myId) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await saveEntry(t.grade, event.id, myId, next);
      setEditing(false);
      setDone(true);
    } catch (e) {
      setError(e instanceof SaveError ? e.message : "登録できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (attending === null) return setError("参加・欠席を選んでください。");
    if (attending && askParking && parking === null) return setError("駐車場の希望を選んでください。");
    const parkingNeeded = attending && (isConfirmed || (askParking && parking === true));
    void send({ attending, parkingNeeded, carpoolCapacity: parkingNeeded ? carpool : 0 });
  }

  const won = Boolean(myId && lottery?.winners.includes(myId));
  return (
    <div className="entry-card">
      <p className="entry-title">✏️ 参加登録{closed ? "（締切後）" : ""}</p>
      {closed && !lottery && !entry && <p className="warn">⚠️ 締切を過ぎていますが、まだ回答していない方は登録できます</p>}
      {lottery && !entry && <p className="muted">抽選は終わりました。まだ回答していない方は、参加・欠席の連絡だけできます。</p>}

      <label className="field">
        <span className="field-label">👦 選手を選んでください</span>
        <select className="input" value={myId ?? ""} onChange={(e) => setMyId(e.target.value || null)}>
          <option value="">─ 選んでください ─</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>#{m.num} {m.name}{entries[m.id] ? " ✓" : ""}{event.parking.confirmed.includes(m.id) ? " 🔒" : ""}</option>
          ))}
        </select>
      </label>

      {myId && isConfirmed && (
        <div className="lock-card">
          <p className="lock-title">🔒 駐車場確定枠です</p>
          <p className="muted">抽選なしで駐車場を利用できます</p>
        </div>
      )}

      {myId && entry && !editing && (
        <div className="my-resp">
          <div>
            <p>{entry.attending ? "✅ 参加" : "❌ 欠席"}</p>
            {entry.attending && <p>{entry.parkingNeeded ? `🚗 駐車場希望${entry.carpoolCapacity > 0 ? `（乗合+${entry.carpoolCapacity}）` : ""}` : "🚶 駐車場不要"}</p>}
            {lottery && entry.parkingNeeded && !isConfirmed && <p className="my-result">{won ? "🎉 当選しました。当日は車でお越しください。" : "😢 落選しました。乗り合わせにご協力ください。"}</p>}
            {done && <p className="ok">✅ 登録しました！</p>}
          </div>
          {!locked ? (
            <button className="btn btn-small" onClick={() => { setEditing(true); setDone(false); }}>内容を修正する</button>
          ) : (
            <div className="decline">
              <span className="muted">締切後は、辞退への変更だけできます</span>
              {entry.attending && entry.parkingNeeded && !isConfirmed && (
                <button className="btn btn-small" disabled={busy}
                  onClick={() => send({ attending: true, parkingNeeded: false, carpoolCapacity: 0 }, won ? "当選した駐車場を辞退します。よろしいですか？\n空いた枠は自動で追加抽選します。" : "駐車場の希望を取り下げます。よろしいですか？")}>
                  🚶 駐車場を辞退する
                </button>
              )}
              {entry.attending && (
                <button className="btn btn-small" disabled={busy} onClick={() => send({ attending: false, parkingNeeded: false, carpoolCapacity: 0 }, "欠席に変更します。よろしいですか？")}>❌ 欠席に変更</button>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="entry-form">
          <p className="q">🏆 試合に参加しますか？</p>
          <div className="choices">
            <button className={`choice ${attending === true ? "on-green" : ""}`} onClick={() => setAttending(true)}>✅ 参加する</button>
            <button className={`choice ${attending === false ? "on-red" : ""}`} onClick={() => { setAttending(false); setParking(false); }}>❌ 欠席</button>
          </div>
          {attending === true && askParking && (
            <>
              <p className="q">🚗 駐車場を希望しますか？</p>
              <div className="choices">
                <button className={`choice ${parking === true ? "on-amber" : ""}`} onClick={() => setParking(true)}>🚗 希望する</button>
                <button className={`choice ${parking === false ? "on-green" : ""}`} onClick={() => { setParking(false); setCarpool(0); }}>🚶 不要です</button>
              </div>
            </>
          )}
          {attending === true && (isConfirmed || (askParking && parking === true)) && (
            <label className="field carpool">
              <span className="field-label">🚙 他の人を乗合できますか？</span>
              <select className="input" value={carpool} onChange={(e) => setCarpool(Number(e.target.value))}>
                <option value={0}>乗合不可（自分の分のみ）</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>乗合可：{n}人まで</option>)}
              </select>
            </label>
          )}
          {attending === true && askParking && <p className="muted center">抽選枠 {slots}台・超過時はあみだくじ</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? "送信中…" : entry ? "変更を保存 →" : "登録する →"}</button>
          {editing && <button className="btn btn-ghost btn-block" onClick={() => setEditing(false)} disabled={busy}>キャンセル</button>}
        </div>
      )}
      {error && !showForm && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
