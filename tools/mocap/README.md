Mixamo FBX → anim/bboy.json (how it was made 14.11.2026)
1. Put the .fbx files (downloaded by the owner from mixamo.com, FBX Binary, 30 fps) in /tmp/mx/in/.
2. Copy three.js r187 examples/jsm/loaders/FBXLoader.js, libs/fflate.module.js, curves/NURBSCurve.js + NURBSUtils.js
   into /tmp/mx/conv/lib/{loaders,libs,curves}/ and three.module.js + three.core.js into /tmp/mx/conv/; convert.html = /tmp/mx/conv/index.html.
3. Serve /tmp/mx on :8767, open convert.html in Playwright, call convert(file) for each → /tmp/mx/out/<name>.json
   (longest clip, 22 bones, 30 fps), then pack: hips xz minus frame 0, cm ints; quats ×1000 ints → anim/bboy.json.
Never commit the raw .fbx files.
