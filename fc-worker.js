// Frame cache for scrubbing (index.html, «кадры для перемотки»). Runs in the background, off the app's main thread,
// so playback and the interface never stutter because of it.
// - build: a whole lesson file (a Blob already on the phone, or its URL once the player has it all) is decoded once into sharp JPEG frames on a time grid
//   (every `step` seconds), starting from where the viewer is, then the beginning;
// - frame: one frame captured from the playing video (an ImageBitmap) is turned into a JPEG.
// Every frame goes back to the page as {key, k (grid index), t (its real time), h (its short side), blob}.
let MB = null;
const mb = () => MB || (MB = import('./vendor/mediabunny.min.mjs'));
let job = null;

function fit(w, h, max){ const s = Math.min(1, max / Math.min(w, h)); return [Math.max(2, Math.round(w * s / 2) * 2), Math.max(2, Math.round(h * s / 2) * 2)]; }

self.onmessage = e => {
  const m = e.data || {};
  if (m.cmd === 'pause') { if (job) job.paused = true; }
  else if (m.cmd === 'resume') { if (job) { job.paused = false; if (job.wake) job.wake(); } }
  else if (m.cmd === 'stop') { if (job && (!m.key || job.key === m.key)) { job.stop = true; if (job.wake) job.wake(); job = null; } }
  else if (m.cmd === 'frame') frame(m);
  else if (m.cmd === 'build') build(m);
};

async function frame(m){
  const bmp = m.bmp;
  try {
    const [w, h] = fit(bmp.width, bmp.height, m.max || 720);
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: m.q || 0.8 });
    self.postMessage({ key: m.key, k: m.k, t: m.t, h: Math.min(w, h), blob });
  } catch (_) {}
  try { bmp.close(); } catch (_) {}
}

async function build(m){
  if (job) { job.stop = true; if (job.wake) job.wake(); }
  const j = job = { key: m.key, paused: false, stop: false, wake: null };
  try {
    const M = await mb();
    // the file itself (already in memory), or its address: then it is read in pieces, mostly from the browser's cache
    const input = new M.Input({ source: m.blob ? new M.BlobSource(m.blob) : new M.UrlSource(m.url), formats: M.ALL_FORMATS });
    const tr = await input.getPrimaryVideoTrack(); if (!tr) throw new Error('no video');
    const dur = await input.computeDuration();
    const [w, h] = fit(tr.displayWidth, tr.displayHeight, m.max || 720);
    const n = Math.max(1, Math.floor((dur - 0.02) / m.step) + 1);
    const skip = new Set(m.skip || []), k0 = Math.min(n - 1, Math.max(0, m.from | 0));
    const order = [];
    for (let k = k0; k < n; k++) if (!skip.has(k)) order.push(k);
    for (let k = 0; k < k0; k++) if (!skip.has(k)) order.push(k);
    // a new canvas for every frame (no pool): a frame is never overwritten while it is still being encoded
    const sink = new M.CanvasSink(tr, { width: w, height: h, fit: 'fill' });
    const asked = [];
    async function* times(){
      for (const k of order) {
        while (j.paused && !j.stop) await new Promise(r => { j.wake = () => { j.wake = null; r(); }; });
        if (j.stop) return;
        asked.push(k);
        yield Math.min(k * m.step, Math.max(0, dur - 0.02));
      }
    }
    for await (const wc of sink.canvasesAtTimestamps(times())) {
      const k = asked.shift();
      if (j.stop) break;
      if (!wc) continue;
      const blob = await wc.canvas.convertToBlob({ type: 'image/jpeg', quality: m.q || 0.8 });
      if (j.stop) break;
      self.postMessage({ key: m.key, k, t: wc.timestamp, h: Math.min(w, h), blob });
    }
    if (!j.stop) self.postMessage({ key: m.key, done: true, n });
  } catch (err) {
    self.postMessage({ key: m.key, failed: String(err && err.message || err) });
  }
  if (job === j) job = null;
}
