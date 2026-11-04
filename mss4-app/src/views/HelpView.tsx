import { useState } from "react";
import { ChevronLeft } from "lucide-react";

type Who = "parent" | "duty" | "coach";

/** 使い方（コーチ・当番・保護者が、それぞれ何をすればよいか）。#help で開ける */
export function HelpView({ onBack }: { onBack: () => void }) {
  const [who, setWho] = useState<Who>("parent");
  return (
    <article className="help">
      <button className="back-link" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />戻る</button>

      <header className="page-head">
        <div>
          <p className="eyebrow">HOW TO USE</p>
          <h1 className="page-title">使い方</h1>
        </div>
      </header>

      <section className="help-card">
        <h2>このアプリでできること</h2>
        <p>4年生の <b>予定・駐車場の申し込みと抽選・試合の要項</b> を、ひとつのURLで見られます。合言葉は不要です。ホーム画面に追加しておくと便利です。</p>
      </section>

      <section className="help-card">
        <h2>これまで → これから</h2>
        <table className="help-table">
          <thead><tr><th>やること</th><th>これまで</th><th>これから</th></tr></thead>
          <tbody>
            <tr><td>予定を見る</td><td>カレンダーアプリ（合言葉）・LINEの週1通知</td><td>このアプリの「📅 予定」。クラブHPの予定を毎朝8時に自動で取り込み（LINEの週1通知はこれまでどおり）</td></tr>
            <tr><td>駐車場の申し込み</td><td>当番がLINEで呼びかけ → 駐車場抽選アプリで回答</td><td>当番がアプリのボタンで呼びかけ → このアプリの試合の「🚗 駐車場」で回答</td></tr>
            <tr><td>抽選</td><td>当番が手動であみだくじ</td><td>締切を過ぎると<b>自動で抽選</b>（15分以内）。手動でも抽選できる</td></tr>
            <tr><td>結果の連絡</td><td>当番が結果を書いてLINEに投稿</td><td>当番がアプリの「③ 抽選結果」ボタンで文面を作ってLINEに送る</td></tr>
            <tr><td>要項・資料</td><td>LINEに画像・PDFを投稿</td><td>試合の「📄 要項」に写真・PDFを載せる（あとから探せる）</td></tr>
          </tbody>
        </table>
      </section>

      <section className="help-card">
        <h2>1試合の流れ（誰が・いつ・何をするか）</h2>
        <table className="help-table">
          <thead><tr><th>いつ</th><th>コーチ</th><th>当番</th><th>保護者</th></tr></thead>
          <tbody>
            <tr><td>試合が決まったら</td><td>「🚗 駐車場」で抽選枠・抽選外枠・締切を入れる</td><td>「① 受付の案内」を送る</td><td>—</td></tr>
            <tr><td>締切まで</td><td>要項（写真・PDF）を載せる</td><td>前日などに「② 回答の催促」</td><td>お子さんを選んで回答</td></tr>
            <tr><td>締切（例：2日前17:00）</td><td>—（自動で抽選）</td><td>抽選後に「③ 抽選結果」を送る</td><td>当選・落選を確認</td></tr>
            <tr><td>当日まで</td><td>変更があれば予定を直す</td><td>追加抽選があれば③をもう一度</td><td>車を出せなくなったら「駐車場を辞退する」</td></tr>
          </tbody>
        </table>
      </section>

      <div className="segmented help-tabs" role="tablist" aria-label="誰の使い方か">
        {([["parent", "👪 保護者"], ["duty", "📣 当番"], ["coach", "🧑‍🏫 コーチ"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={who === v} className={who === v ? "is-active" : ""} onClick={() => setWho(v)}>{label}</button>
        ))}
      </div>

      {who === "parent" && (
        <section className="help-card">
          <h2>👪 保護者がやること</h2>
          <ol className="help-steps">
            <li><b>予定を見る</b>：「📅 予定」タブ。直近の予定・月のカレンダー。変わった予定は「最近の変更」に出ます（オレンジ＝まだ開いていないもの）。</li>
            <li><b>駐車場に回答する</b>（試合ごと）：当番からのLINEのリンク、または「🚗 駐車場」タブから試合を開く
              <ol>
                <li>「👦 選手を選んでください」でお子さんを選ぶ（次から自動で選ばれます）</li>
                <li>「🏆 試合に参加しますか？」→ 参加する／欠席</li>
                <li>「🚗 駐車場を希望しますか？」→ 希望する／不要です</li>
                <li>希望する場合は「🚙 他の人を乗合できますか？」を選んで「登録する」</li>
              </ol>
              <span className="help-note">駐車場が不要な方・欠席の方も回答してください（未回答のままだと催促の対象になります）。</span>
            </li>
            <li><b>結果を見る</b>：締切後に自動で抽選されます。同じ画面に「🎉 当選しました」「😢 落選しました」が出ます。当番からもLINEで結果が届きます。</li>
            <li><b>要項を見る</b>：試合の「📄 要項」にタイムテーブル・コート図などが載ります。</li>
          </ol>
          <h3>こんなときは</h3>
          <ul className="help-faq">
            <li><b>回答を変えたい</b>：締切までは「内容を修正する」で自由に変えられます。締切後は「欠席に変更」「駐車場の辞退」だけできます。</li>
            <li><b>当選したけど車を出せなくなった</b>：「🚶 駐車場を辞退する」を押してください。空いた枠は自動で追加抽選されます。</li>
            <li><b>締切を過ぎてしまった</b>：抽選前なら、まだ回答していない方は登録できます。</li>
            <li><b>予定を変えないで</b>：このアプリは誰でも編集できます。予定の追加・変更・削除はコーチにお任せください。</li>
          </ul>
        </section>
      )}

      {who === "duty" && (
        <section className="help-card">
          <h2>📣 当番がやること（試合ごと）</h2>
          <p>試合の「🚗 駐車場」画面の <b>「📣 当番の方へ：LINEでの連絡」</b> にボタンが3つあります。押すと文面ができるので、確認して <b>「LINEで送る」</b>（保護者グループを選ぶ）か「コピー」で送ってください。送るべきものには「いま」が付きます。</p>
          <ol className="help-steps">
            <li><b>① 受付の案内</b>：コーチが台数を入れたら送る（台数・締切・回答リンク入り）</li>
            <li><b>② 回答の催促</b>：締切の前日などに送る（未回答の名前・回答状況入り）</li>
            <li><b>③ 抽選結果</b>：締切を過ぎて自動抽選が終わったら送る（当選・落選・乗り合わせ・あみだくじのリンク入り）</li>
          </ol>
          <h3>こんなときは</h3>
          <ul className="help-faq">
            <li><b>締切前に全員そろった</b>：「🎰 いま抽選する（手動）」で前倒しで抽選できます。</li>
            <li><b>締切を「なし」にした試合</b>：自動抽選しません。「いま抽選する」で抽選してください。</li>
            <li><b>当選者が辞退した</b>：自動で追加抽選されます。終わったら③をもう一度送ってください。</li>
          </ul>
        </section>
      )}

      {who === "coach" && (
        <section className="help-card">
          <h2>🧑‍🏫 コーチがやること</h2>
          <ol className="help-steps">
            <li><b>予定</b>：クラブHPの予定は毎朝8時に自動で入ります。HPにない予定は「📅 予定」→「予定を追加」（練習：日にち・時間・場所・備考／試合：タイトル・対戦相手・時間・会場・駐車場・ユニフォーム・要項・備考）。</li>
            <li><b>駐車場を設定する</b>（試合ごと）：試合の「🚗 駐車場」→ <b>抽選枠</b>（申し込みから抽選する台数）と <b>抽選外枠</b>（審判・コーチなど。台数だけ）と <b>回答締切</b>（初期値は2日前17:00）→「抽選の受付を始める」。そのあと当番に「① 受付の案内」をお願いします。</li>
            <li><b>要項を載せる</b>：試合の「📄 要項」で写真・PDFを選ぶだけ（その場で保存されます）。</li>
            <li><b>予定を直す</b>：予定を開いて「試合を編集」「練習を編集」。直した内容は全員の「最近の変更」に出ます。</li>
            <li><b>名簿</b>：「📅 予定」タブのいちばん下「👦 名簿の管理」。</li>
          </ol>
          <h3>知っておくこと</h3>
          <ul className="help-faq">
            <li>HPの内容とアプリで直した内容が違う項目は、アプリの内容を残します（HPの自動取り込みで上書きされません）。</li>
            <li>台数を減らす・増やすと、抽選後でも自動で再抽選・追加抽選されます。</li>
            <li>抽選結果の取り消しは、駐車場画面の下「抽選結果を取り消す」。</li>
          </ul>
        </section>
      )}

      <section className="help-card">
        <h2>🤖 自動で動くもの</h2>
        <ul className="help-faq">
          <li><b>毎朝8時</b>：クラブHPの予定をアプリに取り込み（変わった予定は「最近の変更」に表示）</li>
          <li><b>締切後15分以内</b>：駐車場の自動抽選（希望が枠以内なら全員当選）。辞退が出たら追加抽選</li>
          <li><b>毎週月曜10時</b>：これまでどおり、LINEの予定通知（カッターフィールドの空き通知もこれまでどおり）</li>
        </ul>
      </section>
    </article>
  );
}
