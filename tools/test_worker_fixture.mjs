import { DatabaseSync } from 'node:sqlite';
import worker from '../server/push-worker.js';

export function workerFixture() {
  const raw = new DatabaseSync(':memory:');
  class Query {
    constructor(sql, params = []) { this.sql = sql; this.params = params; }
    bind(...params) { return new Query(this.sql, params); }
    run() { const result = raw.prepare(this.sql).run(...this.params); return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; }
    first() { return raw.prepare(this.sql).get(...this.params) || null; }
    all() { return { results: raw.prepare(this.sql).all(...this.params) }; }
  }
  const DB = {
    prepare: sql => new Query(sql),
    async batch(queries) {
      raw.exec('BEGIN');
      try {
        const results = queries.map(query => query.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const env = { DB, PUSH: { get: async key => key === 'lb:mig' ? '1' : null, put: async () => {} } };
  const fetch = (request, ctx) => worker.fetch(request, env, ctx);
  const store = (path, payload) => fetch(new Request('https://test.invalid' + path, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload),
  }));
  return { raw, fetch, store, env };
}
