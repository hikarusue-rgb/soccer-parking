import { useEffect, useState } from "react";
import { Minus, Plus, Shuffle, Share2, Undo2 } from "lucide-react";
import { dateTimeLabel, timeLeft } from "../lib/datetime";
import { groupMembers, reminderText, resultText, shareText } from "../lib/lineText";
import { lotterySlots, lotteryState, nextDraw, runDraw } from "../lib/lottery";
import { SaveError, clearLottery, saveEntry, saveLottery } from "../lib/mutations";
import { useMyMember } from "../lib/myMember";
import { useTeam } from "../lib/teamContext";
import type { LotteryLadder, Member, TeamEvent } from "../lib/types";
import { Amidakuji } from "./Amidakuji";
import { Segmented } from "./FormBits";

const REASON_LABELS = { initial: "抽選", cancel: "キャンセルによる追加抽選", limit_up: "台数増による追加抽選", limit_down: "台数減による再抽選" } as const;

/** 予定詳細の「🚗 駐車場・抽選」：保護者はその場でエントリー、コーチはその場で抽選 */
export function ParkingPanel({ event }: { event: TeamEvent }) {
  const t = useTeam();
  const entries = t.data.entries[event.id];
  const lottery = t.data.lotteries[event.id];
  const summary = t.parkingOf(event);
  const [myId, setMyId] = useMyMember(t.grade);
  const [replay, setReplay] = useState<{ ladder: LotteryLadder; autoplay: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  if (!summary) return null;
  const members = t.data.members.filter((m) => m.active || entries?.[m.id]);
  const byId = new Map(t.data.members.map((m) => [m.id, m]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "（名簿外）";
  const deadline = event.parking.deadlineAt;
  const closed = deadline !== null && t.now >= deadline;
  const groups = groupMembers(event, t.data.members, entries, lottery);
  const applicants = summary.applicants.map((id) => byId.get(id)).filter((m): m is Member => Boolean(m));
  const plan = t.coach ? nextDraw(event, entries, lottery) : null;
  const state = lottery ? lotteryState(event, entries, lottery) : null;
  const slots = lotterySlots(event);

  async function draw() {
    if (!plan) return;
    if (plan.reason === "initial" && !closed && !window.confirm("応募締切の前ですが、抽選しますか？\nこの時点で車出しを希望している人だけが対象になります。")) return;
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
    if (!window.confirm("抽選結果を取り消して、抽選前の状態に戻します。よろしいですか？\n（エントリーは残ります）")) return;
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

  async function share(text: string) {
    const r = await shareText(text);
    if (r === "copied") setMessage({ kind: "info", text: "コピーしました。LINEに貼り付けてください。" });
    if (r === "failed") setMessage({ kind: "error", text: "共有できませんでした。" });
  }

  const drawLabel = !plan ? "" : plan.reason === "initial"
    ? plan.participants.length <= plan.slots ? `全員当選で確定する（希望${plan.participants.length}台・抽選枠${plan.slots}台）` : `抽選する（希望${plan.participants.length}人 → ${plan.slots}台）`
    : plan.reason === "limit_down" ? `再抽選する（当選${plan.participants.length}人 → ${plan.slots}台）`
    : `追加抽選する（空き${plan.slots}台・候補${plan.participants.length}人）`;

  return (
    <section className="detail-card parking-panel" aria-labelledby="parking-title">
      <h2 id="parking-title">🚗 駐車場・抽選</h2>
      <div className="parking-head">
        <span className={`badge parking-${summary.phase}`}>{summary.label}</span>
        <p className="muted">
          駐車できる台数 {event.parking.limit}台
          {event.parking.confirmed.length > 0 && `（確定枠 ${event.parking.confirmed.length}台・抽選枠 ${slots}台）`}
        </p>
        <p className={closed ? "deadline is-closed" : "deadline"}>
          {deadline === null ? "応募締切：未設定" : closed ? `応募締切 ${dateTimeLabel(deadline)}（締め切りました。辞退のみできます）` : `応募締切 ${dateTimeLabel(deadline)}（${timeLeft(deadline, t.now)}）`}
        </p>
      </div>

      <MyEntry event={event} members={members} myId={myId} onChoose={setMyId} closed={closed} />

      <div className="parking-groups">
        {groups.confirmed.length > 0 && <MemberGroup title="🔒 確定枠" members={groups.confirmed} tone="lock" />}
        {lottery ? (
          <>
            <MemberGroup title={`🎯 当選 ${groups.winners.length}人`} members={groups.winners} tone="win" empty="当選者なし" />
            {state && state.dropouts.length > 0 && <MemberGroup title={`⚠️ 当選後に辞退 ${state.dropouts.length}人`} members={state.dropouts.map((id) => byId.get(id)).filter((m): m is Member => Boolean(m))} tone="warn" />}
            {groups.losers.length > 0 && <MemberGroup title={`落選 ${groups.losers.length}人（乗り合わせにご協力ください）`} members={groups.losers} />}
          </>
        ) : (
          <MemberGroup title={`車出し希望 ${applicants.length}人`} members={applicants} tone="apply" empty="まだ希望はありません" />
        )}
        <details className="more-groups">
          <summary>車なしで参加 {groups.walkers.length}・欠席 {groups.absent.length}・未回答 {groups.noReply.length}</summary>
          <MemberGroup title="🚶 車なしで参加" members={groups.walkers} empty="なし" />
          <MemberGroup title="🏠 欠席" members={groups.absent} empty="なし" />
          <MemberGroup title="📭 未回答" members={groups.noReply} empty="全員回答済み" />
        </details>
      </div>

      {lottery && (
        <div className="lottery-log">
          {lottery.rounds.map((r) => (
            <p key={r.round} className="muted">{dateTimeLabel(r.at)}・{REASON_LABELS[r.reason]}（{r.participants.length || lottery.participants.length}人から{r.winners.length}人当選）</p>
          ))}
          {lottery.ladder && (
            <button className="btn btn-small" onClick={() => setReplay({ ladder: lottery.ladder!, autoplay: false })}>🎰 あみだくじを見る</button>
          )}
        </div>
      )}

      {t.coach && (
        <div className="coach-box">
          <p className="coach-box-title">コーチの操作</p>
          {plan ? (
            <button className="btn btn-primary btn-block" onClick={draw} disabled={busy}><Shuffle size={17} aria-hidden="true" />{busy ? "抽選しています…" : drawLabel}</button>
          ) : !lottery ? (
            <p className="muted">車出しの希望が出ると抽選できます。</p>
          ) : (
            <p className="muted">再抽選が必要な状態ではありません（辞退で空きが出たときや台数を変えたときに表示されます）。</p>
          )}
          <div className="coach-box-row">
            {lottery && <button className="btn btn-small" onClick={() => share(resultText(event, t.data.members, entries, lottery, t.eventUrl(event)))}><Share2 size={15} aria-hidden="true" />結果をLINEで共有</button>}
            <button className="btn btn-small" onClick={() => share(reminderText(event, t.data.members, entries, t.eventUrl(event)))}><Share2 size={15} aria-hidden="true" />未回答の方へのお願い文</button>
            {lottery && <button className="btn btn-small btn-ghost" onClick={undo} disabled={busy}><Undo2 size={15} aria-hidden="true" />抽選結果を取り消す</button>}
          </div>
        </div>
      )}

      {message && <p className={`alert ${message.kind === "error" ? "alert-error" : "alert-info"}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}

      {replay && (
        <Amidakuji
          ladder={replay.ladder}
          nameOf={nameOf}
          title={`${event.title} の抽選`}
          autoplay={replay.autoplay}
          onClose={() => setReplay(null)}
        />
      )}
    </section>
  );
}

function MemberGroup({ title, members, tone, empty }: { title: string; members: Member[]; tone?: "lock" | "win" | "apply" | "warn"; empty?: string }) {
  if (!members.length && !empty) return null;
  return (
    <div className={`member-group ${tone ? `tone-${tone}` : ""}`}>
      <p className="member-group-title">{title}</p>
      {members.length ? (
        <ul className="member-chips">{members.map((m) => <li key={m.id}>#{m.num} {m.name}</li>)}</ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </div>
  );
}

/** 自分の子のエントリー（参加・車出し希望・乗合可能人数） */
function MyEntry({ event, members, myId, onChoose, closed }: { event: TeamEvent; members: Member[]; myId: string | null; onChoose: (id: string | null) => void; closed: boolean }) {
  const t = useTeam();
  const entry = myId ? t.data.entries[event.id]?.[myId] : undefined;
  const lottery = t.data.lotteries[event.id];
  const confirmed = Boolean(myId && event.parking.confirmed.includes(myId));
  const [editing, setEditing] = useState(false);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [parking, setParking] = useState<boolean | null>(null);
  const [carpool, setCarpool] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 子どもを選び直したら、その子の回答を読み込む
  useEffect(() => {
    setAttending(entry ? entry.attending : null);
    setParking(entry ? entry.parkingNeeded : null);
    setCarpool(entry?.carpoolCapacity ?? 0);
    setEditing(!entry);
    setError(null);
    setDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, event.id]);

  const member = myId ? members.find((m) => m.id === myId) : undefined;
  const wantsCar = attending === true && (confirmed || parking === true);
  // 締切後は、新しく車出しを希望することはできない（すでに希望している人は乗合人数の変更・辞退ができる）
  const canApply = !closed || entry?.parkingNeeded === true || confirmed;

  async function submit() {
    if (!myId) return;
    if (attending === null) return setError("参加・欠席を選んでください。");
    if (attending && !confirmed && parking === null) return setError("車出しの希望を選んでください。");
    const won = lottery?.winners.includes(myId);
    if (won && entry?.parkingNeeded && !(attending && (parking || confirmed)) && !window.confirm("当選した車出しを辞退します。よろしいですか？\n空いた枠はコーチが追加抽選します。")) return;
    setBusy(true);
    setError(null);
    try {
      await saveEntry(t.grade, event.id, myId, { attending, parkingNeeded: attending && (confirmed || parking === true), carpoolCapacity: wantsCar ? carpool : 0 });
      setEditing(false);
      setDone(true);
    } catch (e) {
      setError(e instanceof SaveError ? e.message : "送信できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  const result = myId && lottery
    ? confirmed ? "🔒 確定枠です（抽選なし）"
      : lottery.winners.includes(myId) ? (entry?.attending && entry.parkingNeeded ? "🎉 当選しました。当日は車でお越しください。" : "当選後に辞退しました。")
      : lottery.participants.includes(myId) ? "落選しました。乗り合わせにご協力ください。" : null
    : confirmed ? "🔒 確定枠です（抽選なし）" : null;

  return (
    <div className="my-entry">
      <label className="field">
        <span className="field-label">お子さんの名前</span>
        <select className="input" value={myId ?? ""} onChange={(e) => onChoose(e.target.value || null)}>
          <option value="">選んでください</option>
          {members.map((m) => <option key={m.id} value={m.id}>#{m.num} {m.name}</option>)}
        </select>
        <small className="field-hint">この端末に記憶します。</small>
      </label>

      {member && (
        <>
          {result && <p className="my-result" role="status">{result}</p>}
          {!editing && entry ? (
            <div className="my-entry-summary">
              <p>
                <b>#{member.num} {member.name}</b>：{entry.attending ? "参加" : "欠席"}
                {entry.attending && (entry.parkingNeeded ? `・車出し${confirmed ? "（確定枠）" : "希望"}${entry.carpoolCapacity ? `・乗合 ${entry.carpoolCapacity}人まで` : ""}` : "・車なし")}
              </p>
              {done && <p className="field-hint" role="status">送信しました。</p>}
              <button className="btn btn-small" onClick={() => { setEditing(true); setDone(false); }}>回答を変更する</button>
            </div>
          ) : (
            <div className="my-entry-form">
              <Segmented label="参加・欠席" value={attending === null ? "" : attending ? "yes" : "no"}
                options={[{ value: "yes", label: "参加する" }, { value: "no", label: "欠席する" }]}
                onChange={(v) => setAttending(v === "yes")} />
              {attending && !confirmed && (
                <>
                  <Segmented label="車出しの希望" value={parking === null ? "" : parking ? "yes" : "no"}
                    options={[{ value: "yes", label: "車を出したい（抽選）" }, { value: "no", label: "車は出さない" }]}
                    onChange={(v) => setParking(v === "yes")} />
                  {!canApply && parking && <p className="form-error">締切を過ぎたため、新しく車出しを希望することはできません。</p>}
                </>
              )}
              {wantsCar && (
                <div className="field">
                  <span className="field-label">乗合可能人数（お子さん以外に乗せられる人数）</span>
                  <div className="stepper">
                    <button type="button" className="icon-btn" aria-label="1人減らす" onClick={() => setCarpool((c) => Math.max(0, c - 1))}><Minus size={18} /></button>
                    <output aria-live="polite">{carpool}人</output>
                    <button type="button" className="icon-btn" aria-label="1人増やす" onClick={() => setCarpool((c) => Math.min(6, c + 1))}><Plus size={18} /></button>
                  </div>
                </div>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="inline-row">
                <button className="btn btn-primary" onClick={submit} disabled={busy || (!canApply && parking === true && !confirmed)}>{busy ? "送信しています…" : "送信する"}</button>
                {entry && <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>やめる</button>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
