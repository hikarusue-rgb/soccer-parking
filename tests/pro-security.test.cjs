const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../pro/index.html'), 'utf8');
const source = html.split('// ── Firebase ──')[1].split('// ── Default ──')[0];
function app({ search = '?team=ABC123', savedTeam = null, fetch } = {}) {
  const storage = new Map(savedTeam ? [['parkingApp_teamId', savedTeam]] : []);
  const calls = [];
  const context = vm.createContext({
    URL, URLSearchParams, console: { error() {} },
    window: { location: { search }, dispatchEvent() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    fetch: async (...args) => { calls.push(args); return fetch ? fetch(...args) : { ok: true, status: 200, json: async () => null }; },
  });
  vm.runInContext(source, context);
  return { run: s => vm.runInContext(s, context), calls, storage };
}

test('reject team path and query injection from URL and saved settings', () => {
  for (const id of ['../..', 'ABC123?x=1', 'A/B', '%2e%2e', 'A#B', 'A.B', 'A[B]']) {
    const fromUrl = app({ search: '?team=' + encodeURIComponent(id) });
    assert.equal(fromUrl.run('TEAM_ID'), null, id);
    const saved = app({ search: '', savedTeam: id });
    assert.equal(saved.run('TEAM_ID'), null, id);
    assert.equal(saved.storage.has('parkingApp_teamId'), false);
  }
});

test('retain current generated team codes and LEGACY links', () => {
  for (const id of ['ABC123', 'LEGACY']) assert.equal(app({ search: '?team=' + id }).run('TEAM_ID'), id);
  const a = app();
  assert.throws(() => a.run('setTeamId("../other")'));
  assert.equal(a.run('TEAM_ID'), 'ABC123');
});

test('block malformed database paths before sending any request', async () => {
  const a = app();
  for (const p of ['../maintenance', 'roster?auth=x', '/teams', 'responses//member', 'responses/a#b']) {
    await assert.rejects(a.run(`fbSet(${JSON.stringify(p)}, {})`));
  }
  assert.equal(a.calls.length, 0);
  await a.run('fbSet("responses/event_1/member-2", {attending:true})');
  assert.match(a.calls[0][0], /\/teams\/ABC123\/responses\/event_1\/member-2\.json$/);
});

test('write rejection and connection failure never resolve as success', async () => {
  for (const method of ['fbSet("roster", [])', 'fbDel("responses/event_1")', 'fbRootSet("maintenance", null)']) {
    for (const status of [401, 403, 429, 500]) {
      const a = app({ fetch: async () => ({ ok: false, status }) });
      await assert.rejects(a.run(method));
    }
    const offline = app({ fetch: async () => { throw Error('offline'); } });
    await assert.rejects(offline.run(method));
  }
});

test('permission errors while joining are not reported as a missing team', async () => {
  const a = app({ fetch: async () => ({ ok: false, status: 403 }) });
  await assert.rejects(a.run('checkTeamExists("ABC123")'));
});

test('HTTP and HTTPS documents work; active-content and credential URLs are blocked', () => {
  const a = app();
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///C:/test', '//evil.example', 'https://user:pass@example.com', 'java\nscript:alert(1)', 'https://good.example/\nfoo']) {
    assert.equal(a.run(`safeLinkUrl(${JSON.stringify(url)})`), '', url);
  }
  for (const url of ['https://drive.google.com/file/d/abc/view', 'https://example.com/a?q=1#page=2', 'http://example.com/']) {
    assert.equal(a.run(`safeLinkUrl(${JSON.stringify(url)})`), url);
  }
  assert.equal(a.run('safeLinkUrl(null)'), '');
  assert.equal((html.match(/href=\{safeLinkUrl\(a.url\)\|\|undefined\}/g) || []).length, 2);
});
