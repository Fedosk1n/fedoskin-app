# Fedoskin team app — notes for Claude (short version)

Full history of every feature and decision (who asked what, when, how it was tested): `docs/claude-notes-full.md`.
grep it by feature name / element id BEFORE changing a feature you don't know well; don't read it whole.
When you finish a change, add 1–3 lines here only if it changes a rule or the map below; details go to the end of the full notes file.

## Owner and priorities
- Owner (Fedor, coach Fedosk1n) writes Russian; answer in Russian, plain language — he is not a developer.
- PRIORITY: money in dollars from the foreign audience. Don't design around Russian users; ru UI stays, no special effort.
- English texts for his audience: give a simple version AND a slang version.
- Say in one line when a task clearly needs Claude Fable 5.2 instead of Opus (hard creative / precision work), and the reverse.
- Don't promise video calls or reply times anywhere in coaching texts. Toprock/footwork are «танцуют», only power moves «крутят».
- Product plan + designs: claude.ai Project docs (`claude/fedoskin-app-plan.md`, `-city-game-plan.md`, `-rhythm-battle-plan.md`,
  `-courses.md`, `-content-protection.md`).

## Stack (static, no build step, GitHub Pages: fedosk1n.github.io/fedoskin-app)
- `index.html` = all UI + JS. `config.js` (settings JSON), `lessons.js` (strict JSON after `window.LESSONS_DATA =`), `reviews.js`,
  `subs.js` + `subs/`, `intros.js`, `storyboards.js`, `sw.js` (service worker), `admin.html` (owner's panel, Russian only).
- Game files: `hero.js` (HERO: levels, looks, SHOP, GEAR, svg/topDown/rig/MOVES), `rhythm.js` (RB: rhythm battle, jam, bgm, sfx),
  `city.js` + `city-gfx.js` + `city-data.js` + `city-balance.js` (flat 2D city), `city3d.html` + `city3d.js` (3D draft, three.js).
- Vendored: `vendor/hls.min.js`, `vendor/mediabunny.min.mjs` (PATCHED line 2 Symbol.dispose for Safari — keep; imports `?v=2`),
  `vendor/qr.js` (own), `vendor/three/` (MIT, importmap).
- Every script tag carries `?v=N` — BUMP it when the file changes (phones cache hard). Admin shows «версия N» — bump on admin changes.
- Keep `lessons.js` / `config.js` machine-readable JSON (admin parses and commits them via the GitHub API).
- Design: dark, Anton + Inter, accent #E2611A, NEW green #3BD16F.
- Hidden-for-later UI carries `hidden data-later="..."` — do not delete.

## i18n
- ru source + en, es, pt, fr, de, ja, ko, zh. Russian strings in code go through `T('текст', {vars})`; fixed HTML by exact match
  (`translateDom`). Every new visible Russian string needs a key in `tools/i18n_src.py`, then `python3 tools/i18n_src.py i18n.js`.
- App language = phone's (`phoneLang()`) unless picked (`fedoskin-lang`). Lesson speech is Russian; move names international.

## Server (Cloudflare Worker `server/push-worker.js`, owner deploys BY HAND)
- KV `PUSH`, D1 `DB`, R2 `VIDEOS`, Workers AI `AI`, secret `TG_TOKEN` (never ask the owner to send tokens). URL = `pushUrl` in config.
- Admin auth = owner's GitHub token. After server changes: `/visits` returns a feature flag (e.g. `cg: 1`, `rb2: 3`); admin shows the
  «обновите код сервера» banner until the owner pastes the new code. Always tell him when he must update the server.
- Covers: push, visits/sources/events stats, rating (D1 `lb`), battles + points + shop, R2 video + passes (`/pass`, `?p=`), chat via
  Telegram bot (+ translator), reviews invites, courses/orders.
- Test the worker locally with node:sqlite as D1 (sandbox can't reach workers.dev or install wrangler).

## Hard rules
- NEVER commit a full lesson mp4 to the repo (public). Lessons live in Cloudflare R2 (pass-protected) or Kinescope. In `v/` only
  covers, `-p3` previews, `-intro.mp4`, `-sb.jpg` strips.
- Kinescope token/project only in the owner's localStorage. api.kinescope.io has no CORS; the sandbox can't reach Kinescope.
- KEEP EQUAL pairs (change both): rhythm rules = `tools/rb2.js` block → `python3 tools/rb2_sync.py` (never edit copies in rhythm.js /
  worker; bump `RB2.R` on any table change); `btRare` hash (index.html ↔ worker); HERO.SHOP prices ↔ worker `SHOP`; HERO.GEAR ids/slots ↔
  worker `CGEAR`.
- rhythm.js: never reuse a helper name in its scope (two `function hiss` once caused an endless hiss).
- hero.js `svg()` / `topDown()` output must stay byte-identical for old looks when adding things (compare before/after).
- Apple/iPhone is fragile: many video paths are OFF or different on Apple (sw.js, MMS player, memory caps). Read the iPhone sections
  of the full notes before touching video loading.

## Main app map (grep the full notes for details)
- Tabs: Главная / Коучинг / Батлы / Город (only if `cityEnabled` or `?city=play`) / Профиль (+ Курсы when a course has videos).
  Город tab = screen `#cityhub` (launcher of city3d.html + alpha card); the old flat city lives in `#city` (city.js rewrites it — no markup there).
- Lesson player: Kinescope HLS via our own <video> (hls.js; Apple: ManagedMediaSource, fallback native), R2 files with pass,
  intros, swipe between lessons, vertical full screen, scrubbing with strips + frame cache, 3-sec loop, repeat, mirror, speed
  (slow = silent), subtitles, saving to the phone (Cache Storage `fedoskin-video-1`, limit sheet), diagnostics `?diag=1`.
- Coaching: services (premium first), order through in-app chat (Telegram bot) or messengers, crypto USDT TRC-20, reviews
  (paying clients via one-time links), coach card last.
- Battles: hero levels by lesson minutes, wardrobe (shop ⭐ items + street gear `c:<id>` from the city, one per slot), rating (top 100,
  cards), rhythm battle by hand (answer within 24 h) or auto cartoon, moves unlocked by STUDYING lessons (3 views with sound + level),
  starter gate for new players, rare/mythic moves, points for fresh lessons, coach bridge.
- City (flat): crews dance-offs, graffiti turf, DJ/MC, deliveries, daily goals; energy from lesson minutes; street gear helps in battles.
- City 3D districts: yard + «Центр» (city3d-center.js, `?d=center`) + «Парк» (city3d-park.js, `?d=park`) + «Промзона» (city3d-prom.js, `?d=prom`) — see the last entries of the full notes.
- City 3D bodies are ONE skinned mesh per person (`skinGeo` in city3d-mocap.js) — don't hang new limb pieces on bones; dancers leave the floor on foot (`W.walk`); fixture brightness = `LAMP_K` / `FILL_K` in city3d.js (owner 16.11: «слишком ярко»).
- City 3D WALK / RUN = real mocap (Mixamo «Walking» + «Running» in anim/bboy.json, `gaitPose` in city3d-mocap.js) blended by speed in `stride()` (city3d.js) for
  everyone who walks; phase driven by distance (no skating). Hero top speed `HERO_SPD` 5.2 m/s. Never go back to the hand-made sine gait. Hands and sneakers are part of the skinned body.
- City 3D CUSTOM (17.11): tailor «Игла» in the yard (city3d-game.js `CUS`, save `S.cus` {kicks, top, pants, head} 0…3, paid with ⚡, levels 2/3 gated by rank);
  details drawn on the hero from `look.cus` (city3d-mocap.js, `?cus=3333` = test look); bonuses go through `buff()` → `makeTurn` (step pts, style, freeze / power falls).
- City 3D PEOPLE have BODIES: `bodyOf(seed, {type, girl, old, …})` → `mocapPerson(look, { body })` (city3d-mocap.js: BODY_TYPES avg / slim / lanky /
  athl / stocky / heavy / big / small, skin, hair colour + style, beard, backpack, coat). Every new person gets a body; the hero keeps the plain one.
- City 3D SPEED (17.11): shadows were ~80% of the draw calls. `city3d-perf.js` merges the shadows of everything static (layer 1, self-healing
  watcher), people's parts on one bone cast one merged piece, tiny parts cast nothing, bodies are frustum-culled, the moon's shadow is fitted
  to the screen, lamp shadows redraw only when on screen. New casters need nothing special; `userData.dyn = true` keeps one out. `?fps` shows the worst frame.
- City 3D CAMERA reads `W.hero` every frame (rewear() replaces the hero object — never cache it); player zoom `W.uZoom` (pinch / wheel, .7…3,
  saved), W.camT overrides it in battles/actions. Crew members are dressed one by one (`dress` / `crewLook` in city3d-game.js, yard palettes `CSTY`).
- City 3D: own page city3d.html, OPEN TO EVERYONE from the Город tab since 17.11 (alpha notice on the first visit, texts inside Russian only).
  Standing = `Stand` / `Stand_Calm` loops (`makeStand`, never loop raw «Breakdance_Ready» — it is a sidestep); clips with a big seam play once (`userData.once`). Owner's direction 14.11: top-down 3D like his
  reference video. Dancers now play REAL motion capture (Mixamo, `anim/bboy.json`, `city3d-mocap.js`) — never hand-pose dance moves again;
  missing moves (windmill, airflare, backspin, 2000) need mocap from a video-capture service. Game layer `city3d-game.js`: crews, AUTO battles
  (random sets, falls, judges), energy from lessons, respect ranks; its save is separate from the flat city (merge gear later).

## Testing habits
- Local server: `python3 -m http.server 8765` in the repo; Playwright headless at 390×844 (iPhone) and 375×667, ru + en.
- WebGL headless: chromium args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Playwright route.fulfill bypasses throttling — serve media from a real local server. CDP touch is too slow for flicks: use in-page
  TouchEvents. Claude has never heard the sounds and can't test on a real iPhone — say so and ask the owner.

## Git
- Commit and push when the owner asks for the change to be live: `git -c push.negotiate=true push origin HEAD`.
