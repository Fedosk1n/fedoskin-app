// Keep the Worker prize pools in sync with the playable wardrobe.
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const source = path => new URL(path, root);
const context = { window: {} };
runInNewContext(readFileSync(source('hero.js'), 'utf8'), context);
const { SHOP, GEAR } = context.window.HERO;
const pools = Array.from({ length: 4 }, (_, rarity) => [
  ...SHOP.filter(item => item.rar === rarity).map(item => item.id),
  ...Object.entries(GEAR).filter(([, item]) => item.rar === rarity).map(([id]) => 'c:' + id),
]);
if (pools.some(pool => !pool.length)) throw new Error('A drawable rarity has no wardrobe items.');
const workerPath = source('server/push-worker.js');
const worker = readFileSync(workerPath, 'utf8');
const block = '// BEGIN DAILY_LOOT_POOLS\nconst DAILY_LOOT_POOLS = [\n' +
  pools.map(pool => '  ' + JSON.stringify(pool)).join(',\n') +
  '\n];\n// END DAILY_LOOT_POOLS';
const region = /\/\/ BEGIN DAILY_LOOT_POOLS[\s\S]*?\/\/ END DAILY_LOOT_POOLS/;
if (!region.test(worker)) throw new Error('Daily loot pool markers were not found.');
const updated = worker.replace(region, block);
if (process.argv.includes('--check')) {
  if (worker !== updated) throw new Error('Run node tools/sync_daily_loot.mjs after editing the wardrobe.');
} else if (worker !== updated) writeFileSync(workerPath, updated);
console.log(pools.map(pool => pool.length).join(' / '));
