import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import worker from '../server/push-worker.js';

const raw = new DatabaseSync(':memory:');
class Query {
  constructor(sql) { this.sql = sql; this.params = []; }
  bind(...values) { this.params = values; return this; }
  run() { return { meta: { changes: Number(raw.prepare(this.sql).run(...this.params).changes) } }; }
  first() { return raw.prepare(this.sql).get(...this.params) || null; }
  all() { return { results: raw.prepare(this.sql).all(...this.params) }; }
}
const DB = {
  prepare: sql => new Query(sql),
  async batch(queries) {
    raw.exec('BEGIN');
    try { const results = queries.map(query => query.run()); raw.exec('COMMIT'); return results; }
    catch (error) { raw.exec('ROLLBACK'); throw error; }
  },
};
const env = { DB, PUSH: { get: async key => key === 'lb:mig' ? '1' : null, put: async () => {} } };
const store = (path, payload) => worker.fetch(new Request('https://test.invalid' + path, {
  method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload),
}), env);
if (process.argv.includes('--serve')) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const response = await worker.fetch(new Request('https://test.invalid' + req.url, {
      method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body } : {}),
    }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  server.listen(8770, '127.0.0.1', () => console.log('Daily loot Worker at http://127.0.0.1:8770'));
} else {
  const login = { id: '420108', secret: '0123456789abcdef0123456789abcdef' };
  let now = 2000000000000;
  const clock = Date.now;
  Date.now = () => now;
  try {
    let res = await store('/hero/loot', login);
    assert.equal(res.status, 200, await res.clone().text());
    assert.deepEqual((await res.json()).odds, [8000, 1600, 350, 50, 0]);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM lb').get().n, 0);
    const claims = await Promise.all(Array.from({ length: 8 }, () => store('/hero/loot', { ...login, claim: true }))).then(list => Promise.all(list.map(r => r.json())));
    const granted = claims.filter(x => x.claimed);
    assert.equal(granted.length, 1);
    const item = granted[0].last.item;
    assert.equal(new Set(claims.map(x => x.last.item)).size, 1);
    assert.ok(granted[0].owned.includes(item));
    assert.equal(raw.prepare('SELECT paid FROM hero_own WHERE id = ? AND item = ?').get(login.id, item).paid, 0);
    assert.equal(raw.prepare('SELECT hid FROM lb WHERE id = ?').get(login.id).hid, 1);
    assert.equal(raw.prepare('SELECT h FROM lb WHERE id = ?').get(login.id).h, createHash('sha256').update('lb:' + login.secret).digest('base64url').slice(0, 32));
    res = await store('/hero/loot', { ...login, secret: '01'.repeat(16), claim: true });
    assert.equal(res.status, 403);
    now += 86400000 - 1;
    res = await store('/hero/loot', { ...login, claim: true });
    assert.equal((await res.json()).claimed, false);
    now += 1;
    res = await store('/hero/loot', { ...login, claim: true });
    assert.equal((await res.json()).claimed, true);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM hero_loot WHERE id = ?').get(login.id).n, 2);
    console.log('Fresh profile, concurrent claims, authentication, persistence and exact 24-hour boundary passed.');
  } finally { Date.now = clock; raw.close(); }
}
