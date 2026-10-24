// All database traffic is intercepted. This test never writes production data.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../pro/index.html'));
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo' });
    const errors = [], writes = [];
    const fixtures = {
      meta: { name: '検証用FC', createdAt: Date.now() },
      roster: [{ id: 'member_1', num: 1, name: 'テスト選手', grade: '4年' }],
      events: [{ id: 'event_1', title: 'セキュリティ検証試合', matchDate: '2026-10-25T10:00', deadline: '2026-10-25T09:00', location: '検証グラウンド', meetTime: '09:30', inviteGrades: ['4年'], parkingLimit: 1, attachments: [
        { id: 'safe', name: '正常な資料', url: 'https://example.com/guide.pdf' },
        { id: 'unsafe', name: '危険な資料', url: 'javascript:alert(1)' },
      ] }],
    };
    await context.route('**/*.firebasedatabase.app/**', route => {
      const request = route.request();
      if (request.method() !== 'GET') {
        writes.push(request.method());
        return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Permission denied"}' });
      }
      const key = new URL(request.url()).pathname.split('/').pop().replace(/\.json$/, '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures[key] ?? null) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}/pro/?team=ABC123`;
    await page.goto(base);
    await page.getByText('セキュリティ検証試合', { exact: true }).waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(__dirname, '../../pro-home-verified.png'), fullPage: true });
    await page.getByText('セキュリティ検証試合', { exact: true }).click();
    const blocked = page.locator('a', { hasText: '危険な資料' });
    assert.equal(await blocked.getAttribute('href'), null);
    assert.equal(await blocked.getAttribute('aria-disabled'), 'true');
    assert.equal(await page.getByRole('link', { name: '🔗 正常な資料' }).getAttribute('href'), 'https://example.com/guide.pdf');
    await page.goto(base);
    await page.getByRole('button', { name: '⚙️ 管理者メニュー' }).click();
    await page.getByRole('button', { name: '👦 名簿', exact: true }).click();
    await page.getByPlaceholder('名前', { exact: true }).fill('保存失敗でも残る入力');
    await page.getByRole('button', { name: '💾 保存する', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /保存できませんでした/);
    assert.equal(await page.getByPlaceholder('名前', { exact: true }).inputValue(), '保存失敗でも残る入力');
    assert.equal(await page.getByText('✅ 保存しました！', { exact: true }).count(), 0);
    await page.screenshot({ path: path.join(__dirname, '../../pro-save-error-verified.png'), fullPage: true });
    assert.deepEqual(writes, ['PUT']);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ jsxAndRender: 'PASS', safeLinks: 'PASS', deniedSaveRetainsInput: 'PASS', noFalseSuccess: 'PASS', pageErrors: errors.length, mockedWrites: writes.length, productionWrites: 0 }));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
