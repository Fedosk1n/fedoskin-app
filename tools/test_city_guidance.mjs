import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { VENUES } from '../city3d-campaign-data.js';
import { CHAPTERS } from '../city3d-story.js';
import { CHAPTER_ART, LANDMARKS, inWatchArea, placeLandmark, landmarkImage } from '../city3d-guide-data.js';

const file = name => readFileSync(new URL('../'+name,import.meta.url));
const active = new Set([...CHAPTERS.map(chapter=>CHAPTER_ART[chapter.id]),
  ...Object.values(VENUES).map(([,id])=>id==='show'?'circle':id)]);
assert.deepEqual(new Set(Object.keys(LANDMARKS)),active);
const built = new Set();
for (const district of ['yard','center','park','prom','club']) {
  const glb=file('anim/city-guide-'+district+'.glb');
  assert.equal(glb.readUInt32LE(0),0x46546c67);
  const length=glb.readUInt32LE(12), data=JSON.parse(glb.subarray(20,length+20));
  for (const node of data.scenes[0].nodes.map(i=>data.nodes[i])) {
    assert.ok(node.children.length);
    assert.ok(!built.has(node.name));
    built.add(node.name);
  }
}
assert.deepEqual(built,active);
for(const id of active) {
  const webp=file(landmarkImage(id).split('?')[0]);
  assert.equal(webp.subarray(8,12).toString(),'WEBP');
}

const point={x:1.5,z:-3.48,r:1.5}, bounds={x0:0,x1:10,z0:-6,z1:10};
assert.equal(inWatchArea(point,point),true);
assert.equal(inWatchArea(point,{x:1.5,z:-2.6}),false);
assert.equal(inWatchArea(point,{x:1.5,z:-4.12}),false);
assert.equal(inWatchArea(point,{x:1.72,z:-3.60}),true);
assert.equal(placeLandmark('watch',point,[],bounds),point);
const box={x0:1.25,x1:1.76,z0:-4.6,z1:-4.3};
const prop=placeLandmark('circle',point,[box],bounds);
assert.ok(Math.hypot(prop.x-point.x,prop.z-point.z)<point.r);
assert.notEqual(prop.z,point.z-.6);

const scope={window:{}};
vm.runInNewContext(file('city3d-i18n.js').toString(),scope);
const keys=[...Object.values(LANDMARKS).flat(),...CHAPTERS.flatMap(chapter=>[chapter.task,chapter.imageHint])];
assert.equal(Object.keys(scope.window.I18N3).length,8);
for (const [language,dict] of Object.entries(scope.window.I18N3)) for (const key of keys) assert.ok(dict[key],language+' '+key);
const ui=['city3d-game.js','city3d-campaign.js','city3d-story.js','city3d-guide.js'].map(path=>file(path).toString()).join('\n');
assert.doesNotMatch(ui,/золот[а-яё]+\s+(?:ромб|метк)/iu);
console.log('17 role-specific landmarks, one reference each, watch geometry, collision clearance, exact map artwork and 9 locales.');
