Mixamo FBX → anim/bboy.json (how it was made 14.11.2026)
1. Put the .fbx files (downloaded by the owner from mixamo.com, FBX Binary, 30 fps) in /tmp/mx/in/.
2. Copy three.js r187 examples/jsm/loaders/FBXLoader.js, libs/fflate.module.js, curves/NURBSCurve.js + NURBSUtils.js
   into /tmp/mx/conv/lib/{loaders,libs,curves}/ and three.module.js + three.core.js into /tmp/mx/conv/; convert.html = /tmp/mx/conv/index.html.
3. Serve /tmp/mx on :8767, open convert.html in Playwright, call convert(file) for each → /tmp/mx/out/<name>.json
   (longest clip, 22 bones, 30 fps), then pack: hips xz minus frame 0, cm ints; quats ×1000 ints → anim/bboy.json.
Never commit the raw .fbx files.

Walk / run (16.11.2026): `drop.html` (live at /tools/mocap/drop.html) does the same in the OWNER'S browser — he downloads the .fbx from
mixamo.com (FBX Binary, Without Skin, 30 fps, NOT «In Place»: the hips' travel gives the clip's natural speed) and drops the files on the
page; three.js + FBXLoader come from a CDN; Claude reads `window.OUT` (already packed like anim/bboy.json) through Claude in Chrome.
`fbx2clip.py` (17.11.2026) does the same conversion offline in Python (binary FBX parser + FBXLoader's euler 'ZYX' / pre-rotation maths):
`python3 tools/mocap/fbx2clip.py Walking.fbx` — checked track by track against drop.html (all 46 tracks of Walking/Running identical).
To add a clip: import it, `convert(path)` → `(clip, rest)`, put `clip` into anim/bboy.json `clips[name]` (compact JSON, same format), bump `?v=`.
