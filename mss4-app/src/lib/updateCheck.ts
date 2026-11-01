// 新しい版の自動切り替え。GitHub Pages は index.html を最大10分ほどブラウザに覚えさせるため、
// 公開直後は古い画面が出ることがある。起動時・画面に戻ったとき・30分ごとに最新の index.html を確かめ、
// 読み込んでいるプログラムと違えば1回だけ読み直す。
const SCRIPT = /assets\/index-[\w-]+\.js/;
const KEY = "mss4-reloaded-for";

function currentScript(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(SCRIPT);
    if (m) return m[0];
  }
  return null;
}

async function check() {
  const current = currentScript();
  if (!current) return;
  const page = window.location.href.split("#")[0];
  try {
    // cache: "reload" で取り直すと、ブラウザが覚えている index.html も新しくなる
    const html = await (await fetch(page, { cache: "reload" })).text();
    const latest = html.match(SCRIPT)?.[0];
    if (!latest || latest === current) return;
    let already: string | null = null;
    try { already = sessionStorage.getItem(KEY); } catch { /* 保存できない端末 */ }
    if (already === latest) return; // 読み直しても変わらなかった場合は繰り返さない
    try { sessionStorage.setItem(KEY, latest); } catch { /* 保存できない端末 */ }
    window.location.reload();
  } catch {
    /* 圏外など。次の機会に確かめる */
  }
}

export function startUpdateCheck() {
  if (import.meta.env.DEV) return;
  void check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.setInterval(() => void check(), 30 * 60 * 1000);
}
