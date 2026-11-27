import assert from 'node:assert/strict';
import { examPeriod, FESTIVAL_OFFICIAL, FESTIVAL_PRIZE } from '../city3d-festival-exams.js';
import { perfectTrial } from './test_festival.mjs';
import { workerFixture } from './test_worker_fixture.mjs';

const { raw, store } = workerFixture();
const profile = { id: '420109', secret: '0123456789abcdef0123456789abcdef' };
const path = '/hero/festival';
async function request(body, status = 200, target = path) {
  const response = await store(target, { ...profile, ...body });
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
let now = 2_000_000_000_000;
const clock = Date.now;
Date.now = () => now;
try {
  assert.deepEqual((await request({ action: 'status' })).passed, []);
  assert.equal((await request({ action: 'begin', exam: 'final', route: Array(60).fill({ clean: 20 }) }, 409)).error, 'qualify');
  assert.equal((await request({ action: 'award' }, 409)).error, 'exam');
  assert.deepEqual((await request({ eq: FESTIVAL_PRIZE }, 200, '/hero/eq')).eq, []);
  assert.equal((await request({ item: FESTIVAL_PRIZE[0] }, 403, '/hero/buy')).error, 'not in rating');

  const first = FESTIVAL_OFFICIAL[0];
  const preparation = await request({ action: 'begin', exam: first.id, tempo: 'normal' });
  const empty = { action: 'finish', exam: first.id, nonce: preparation.nonce, inputs: [] };
  assert.equal((await request(empty, 409)).error, 'too-soon');
  now += Math.ceil(first.modes.length * 16 * examPeriod(first, preparation.tempo));
  assert.equal((await request({ ...empty, nonce: 'different' }, 409)).error, 'restart');
  assert.equal((await request(empty)).verdict.passed, false);
  assert.equal((await request({ ...profile, secret: '01'.repeat(16), action: 'status' }, 403)).error, 'not in rating');

  for (const [index, trial] of FESTIVAL_OFFICIAL.entries()) {
    const tempo = ['normal', 'training', 'quick'][index % 3];
    const begin = await request({ action: 'begin', exam: trial.id, tempo });
    now += Math.ceil(trial.modes.length * 16 * examPeriod(trial, tempo));
    const proof = { action: 'finish', exam: trial.id, nonce: begin.nonce, inputs: perfectTrial(trial, begin.seed, tempo) };
    const [finish, repeat] = await Promise.all([request(proof), request(proof)]);
    for (const data of [finish, repeat]) {
      assert.equal(data.verdict.passed, true, trial.id);
      assert.equal(data.passed.length, index + 1);
      assert.deepEqual(new Set(data.owned), new Set(trial.id === 'final' ? FESTIVAL_PRIZE : []));
    }
  }
  assert.equal((await request({ action: 'status' })).passed.length, FESTIVAL_OFFICIAL.length);
  assert.deepEqual(new Set((await request({ eq: FESTIVAL_PRIZE }, 200, '/hero/eq')).eq), new Set(FESTIVAL_PRIZE));
  const rows = raw.prepare('SELECT item, paid FROM hero_own WHERE id = ?').all(profile.id);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.paid === 0));
  const loot = await request({ claim: true }, 200, '/hero/loot');
  assert.ok(!FESTIVAL_PRIZE.includes(loot.last.item));
  console.log('Official ordering, time, nonce, AFK, repeated results, canonical wardrobe and loot exclusion passed.');
} finally {
  Date.now = clock;
  raw.close();
}
