// Cloudflare's dashboard deploys the standalone Worker, so copy the shared pure judge into it.
import { readFileSync, writeFileSync } from 'node:fs';

const file = path => new URL('../' + path, import.meta.url);
const lean = path => readFileSync(file(path), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const marker = /\/\/ BEGIN FESTIVAL_JUDGE[\s\S]*?\/\/ END FESTIVAL_JUDGE/;
const worker = readFileSync(file('server/push-worker.js'), 'utf8');
if (!marker.test(worker)) throw new Error('Missing Festival judge markers.');
const judge = [lean('city3d-campaign-engine.js'), lean('city3d-festival-exams.js')].join('\n');
const block = `// BEGIN FESTIVAL_JUDGE
const FESTIVAL_JUDGE = (() => {
${judge}
return { specs: FESTIVAL_OFFICIAL, prize: FESTIVAL_PRIZE, period: examPeriod, judge: judgeFestivalExam };
})();
// END FESTIVAL_JUDGE`;
const updated = worker.replace(marker, block);
if (process.argv.includes('--check')) {
  if (worker !== updated) throw new Error('Run node tools/sync_festival_exams.mjs.');
} else if (worker !== updated) writeFileSync(file('server/push-worker.js'), updated);
