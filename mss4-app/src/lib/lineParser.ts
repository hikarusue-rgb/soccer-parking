// コーチがLINEで受け取った試合連絡の文面から、予定の項目を読み取る（旧駐車場アプリの機能を移植）。
// 読み取れた項目だけを返し、読み取れないものは推測で補わない。
import { jstToday } from "./datetime";

export interface ParsedLine {
  date?: string;
  title?: string;
  opponent?: string;
  venue?: string;
  meeting?: string;
  kickoff?: string;
  end?: string;
  uniformTop?: string;
  uniformBottom?: string;
  uniformSocks?: string;
  note?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const validTime = (h: number, m: number) => h >= 0 && h <= 23 && m >= 0 && m <= 59;
const toHM = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;
const COLORS = "白黒紺青赤緑黄橙桃ピンクオレンジ";

export function parseLineMessage(text: string, today: string = jstToday()): ParsedLine {
  if (!text.trim()) return {};
  const result: ParsedLine = {};
  // 全角→半角、行頭の箇条書き記号を除く
  let t = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":").replace(/／/g, "/").replace(/＝/g, "=").replace(/＠/g, "@")
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/^[\s■・▼▽◆◇●○◯◎★☆▶▷▪▫►]+/gm, "");
  // 「X時半」→「X:30」を先に直してから、PM/AM・午後/午前 → 24時間表記（「午後1時半」→ 13:30）
  t = t
    .replace(/(\d{1,2})時半/g, "$1:30")
    .replace(/(?:pm|午後)\s*(\d{1,2})\s*[:時]?\s*(\d{0,2})/gi, (_m, h, mi) => toHM((parseInt(h) % 12) + 12, parseInt(mi || "0")))
    .replace(/(?:am|午前)\s*(\d{1,2})\s*[:時]?\s*(\d{0,2})/gi, (_m, h, mi) => toHM(parseInt(h) % 12, parseInt(mi || "0")))
    .replace(/(集合|キックオフ|KO|ko|試合開始|開始|終了|終了予定|解散|会場|場所|対戦相手|お相手|対戦|相手|本日の?相手)(?:は|が|に|を)(?=\S)/g, "$1 ");

  // 日付（M/D、M月D日）。今日より前なら翌年とみなす
  const dm = t.match(/(\d{1,2})\s*[/月.-]\s*(\d{1,2})(?:日)?/);
  if (dm) {
    const m = parseInt(dm[1]);
    const d = parseInt(dm[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const year = parseInt(today.slice(0, 4));
      let date = `${year}-${pad2(m)}-${pad2(d)}`;
      if (date < today) date = `${year + 1}-${pad2(m)}-${pad2(d)}`;
      result.date = date;
    }
  }

  // 「スケジュール」「タイムテーブル」などの見出し以降は補足に回す
  const sched = /(?:^|\n)\s*(スケジュール|タイムスケジュール|タイテ|タイムテーブル|試合予定|対戦予定|試合順|対戦表|試合スケジュール)\s*\n/.exec(text);
  let schedIdx = -1;
  if (sched) {
    schedIdx = sched.index + sched[0].indexOf(sched[1]);
    result.note = text.substring(schedIdx).trim();
  }
  const main = schedIdx >= 0 ? t.substring(0, Math.min(schedIdx, t.length)) : t;
  const cleanName = (s: string) => s.trim()
    .replace(/[様さま]+$/, "")
    .replace(/(?:でした|になります|となります|です|だ|なり|だよ|だと思います|になる予定)[。.]?$/, "")
    .replace(/[。.，,、]+$/, "")
    .trim();

  // 大会・リーグ名
  const league = main.match(/([^\s\n,、。「『【(（)）[\]【】|=:]+(?:リーグ|大会|杯|フェスタ|フェスティバル|トーナメント|カップ|交流戦))/);
  if (league) result.title = league[1].trim();

  // 対戦相手
  const vsPatterns = [
    /(?:対戦相手|対戦チーム|お相手|対戦|相手|本日の?相手)\s*[:・\-=]?\s*([^\s\n,、。(（様]+(?:FC|SC|サッカー|サッカークラブ)?)/,
    /(?:vs\.?|VS\.?)\s*([^\s\n,、。(（様]+(?:FC|SC|サッカー)?)/i,
    /([^\s\n,、。(（]+(?:FC|SC))\s*戦/,
    /対\s+([^\s\n,、。(（様]+(?:FC|SC|サッカー)?)/,
  ];
  for (const re of vsPatterns) {
    const m = main.match(re);
    if (!m) continue;
    const opp = cleanName(m[1]);
    if (opp && !["の", "に", "は", "を", "と", "練習試合", "TM"].includes(opp)) {
      result.opponent = opp;
      if (!result.title) result.title = `vs ${opp}`;
      break;
    }
  }
  if (!result.title) {
    if (/練習試合/.test(main)) result.title = "練習試合（TM）";
    else if (/(?:^|\s)TM(?:$|\s)/.test(main)) result.title = "練習試合（TM）";
  }

  // 会場
  const locPatterns = [
    /(?:会場|場所|於)\s*[:・\-=]?\s*([^\n(（,、]+?)(?=\s*(?:集合|キックオフ|KO|ko|ユニ|終了|解散|相手|対戦|配車|vs|VS|対\s|$|\n|時|\d))/,
    /@\s*([^\n(（,、\s]+)/,
    /(?:^|\n)\s*([^\s\n,、]+(?:グラウンド|グランド|公園|小学校|中学校|高校|球場|サッカー場|フィールド|スタジアム|体育館))(?=\s|$|\n)/,
  ];
  for (const re of locPatterns) {
    const m = main.match(re);
    if (!m) continue;
    const loc = cleanName(
      m[1].trim().replace(/[「『【［[(]/g, "").replace(/[」』】］\])]/g, "")
        .replace(/\s+[白黒紺青赤緑黄橙桃](?:ユニ|シャツ)?\s*$/, "").trim()
        .replace(/\s*\d{1,2}[:時].*$/, "").trim(),
    );
    if (loc && loc.length < 60) {
      result.venue = loc;
      break;
    }
  }

  // 集合
  for (const re of [
    /(\d{1,2})[:時](\d{0,2})分?集合/,
    /集合(?:は|が|時刻)?[ \t]*[:\s=]*[ \t]*(\d{1,2})[:時](?:(\d{1,2})\s*分?)?(?![:\d時])/,
    /(\d{1,2})[:時](\d{0,2})分?[ \t]+集合/,
  ]) {
    const m = t.match(re);
    if (m && validTime(parseInt(m[1]), parseInt(m[2] || "0"))) {
      result.meeting = toHM(parseInt(m[1]), parseInt(m[2] || "0"));
      break;
    }
  }

  // 「9:30-12:00」はキックオフと終了
  const range = t.match(/(\d{1,2}):(\d{2})\s*[-〜～]\s*(\d{1,2}):(\d{2})/) ?? t.match(/(\d{1,2})\s*時\s*(\d{0,2})\s*分?\s*[-〜～]\s*(\d{1,2})\s*時\s*(\d{0,2})\s*分?/);
  if (range) {
    const [h1, m1, h2, m2] = [range[1], range[2], range[3], range[4]].map((x) => parseInt(x || "0"));
    if (validTime(h1, m1) && validTime(h2, m2)) {
      result.kickoff = toHM(h1, m1);
      result.end = toHM(h2, m2);
    }
  }
  if (!result.kickoff) {
    let ko: RegExpMatchArray | null = null;
    for (const re of [
      /(\d{1,2})[:時](\d{0,2})分?(?:KO|ko|キックオフ|試合開始|開始)/,
      /(?:KO|ko|キックオフ|試合開始|開始)[ \t]*[:\s=]*[ \t]*(\d{1,2})[:時](?:(\d{1,2})\s*分?)?(?![:\d時])/,
      /(\d{1,2})[:時](\d{0,2})分?[ \t]+(?:KO|ko|キックオフ|試合開始|開始)/,
    ]) {
      ko = t.match(re);
      if (ko) break;
    }
    if (!ko && schedIdx >= 0) ko = t.substring(schedIdx).match(/(\d{1,2})[:時](\d{0,2})\s*分?\s*[〜～\-から]/);
    if (!ko) ko = t.match(/(\d{1,2})[:時](\d{0,2})\s*分?\s*[〜～から]/);
    if (ko && validTime(parseInt(ko[1]), parseInt(ko[2] || "0"))) result.kickoff = toHM(parseInt(ko[1]), parseInt(ko[2] || "0"));
  }
  if (!result.end) {
    const m = t.match(/(?:終了|解散|終わり|終了予定)\s*予?定?\s*[:\s=]*(\d{1,2})\s*[:時]\s*(\d{0,2})\s*分?/);
    if (m && validTime(parseInt(m[1]), parseInt(m[2] || "0"))) result.end = toHM(parseInt(m[1]), parseInt(m[2] || "0"));
  }

  // ユニフォーム（上・下・靴下。単色指定なら全部同じ色）
  const color = `[${COLORS}]+`;
  const top = t.match(new RegExp(`(?:上|シャツ|トップス)\\s*[:\\s=]*(${color})`));
  const bottom = t.match(new RegExp(`(?:下|パンツ|ズボン|ショーツ|ボトムス)\\s*[:\\s=]*(${color})`));
  const socks = t.match(new RegExp(`(?:靴下|ソックス|くつした|ストッキング)\\s*[:\\s=]*(${color})`));
  if (top) result.uniformTop = top[1];
  if (bottom) result.uniformBottom = bottom[1];
  if (socks) result.uniformSocks = socks[1];
  if (!top && !bottom && !socks) {
    const uni = t.match(/([白黒紺青赤緑黄橙桃])(?:ユニ|シャツ|の?ユニフォーム)/) ?? t.match(new RegExp(`(?:ユニ(?:フォーム)?|シャツ)\\s*[:\\s=]+(${color})`));
    if (uni) result.uniformTop = result.uniformBottom = result.uniformSocks = uni[1];
  }
  return result;
}
