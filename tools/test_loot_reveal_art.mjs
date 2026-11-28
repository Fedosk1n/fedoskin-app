import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const window = {};
runInNewContext(read('hero.js'), { window });
const { itemArt, itemOf } = window.HERO;
const pools = JSON.parse(read('server/push-worker.js').match(/const DAILY_LOOT_POOLS = (\[[\s\S]*?\]);/)[1]);
const slots = new Map();
for (const [rarity, pool] of pools.entries()) {
  assert(rarity < 4);
  for (const id of pool) {
    const item = itemOf(id);
    assert.equal(item.rar, rarity, id);
    const art = itemArt(id);
    assert.match(art, /^<svg [^>]*viewBox="[\d\s.-]+">/u, id);
    assert.doesNotMatch(art, /undefined|NaN/u, id);
    assert(art.replace(/<defs>[\s\S]*?<\/defs>/gu, '').includes('fill='), id);
    if (!slots.has(item.slot)) slots.set(item.slot, new Set());
    assert(!slots.get(item.slot).has(art), id + ' must have distinct artwork within its slot');
    slots.get(item.slot).add(art);
  }
}
assert(!itemArt('tee').includes('#3E5F8E'), 'Collectible tee has no base jeans');
assert(!itemArt('rallyJacket').includes('#3E5F8E'), 'Collectible track top has no base jeans');
assert.match(itemArt('pulsePhones'), /M31 59 C24 10/u, 'Headphone band stays intact');
assert.match(itemArt('asphaltPants'), /viewBox="24 7 112 157"/u, 'Full-length trousers');
assert.deepEqual([...slots.keys()].sort(), ['bg', 'ears', 'elbows', 'floor', 'fx', 'hands', 'head', 'item', 'kicks', 'knees', 'laces', 'neck', 'pants', 'top', 'wrists']);
console.log(`${pools.flat().length} distinct item renderings across ${slots.size} slots. All rarities match the Worker.`);
