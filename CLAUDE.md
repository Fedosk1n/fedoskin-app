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
- 3D CITY has its OWN dictionary (18.11): every visible text in city3d*.js / city3d.html goes through `_t('русский текст', {vars})`; rows in
  `tools/i18n_city3d.py` (ru + 8 langs, gear names reused from i18n.js) → `python3 tools/i18n_city3d.py` writes `city3d-i18n.js` (bump its ?v in
  city3d.html). Canvas signs go through the district `text()` helpers (translate + shrink to fit, pass maxW when the sign has less room).
  `_t.miss` lists texts with no translation — the Playwright test checks it stays empty in all 8 languages.

## Server (Cloudflare Worker `server/push-worker.js`, owner deploys BY HAND)
- KV `PUSH`, D1 `DB`, R2 `VIDEOS`, Workers AI `AI`, secret `TG_TOKEN` (never ask the owner to send tokens). URL = `pushUrl` in config.
- Admin auth = owner's GitHub token. For every Worker change requiring a deployment, follow the admin banner and version rule in `AGENTS.md`.
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
  Город tab = screen `#cityhub` (launcher of city3d.html + alpha card); the old flat city lives in `#city` (city.js rewrites it — no markup there) — HIDDEN since 17.11 (owner «убери 2д город»): button `#c3Old` stays hidden, city.js still loads only for gear already won there; 2D-only gear (src mc / dj / walls) is listed in the wardrobe only if owned.
- Lesson player: Kinescope HLS via our own <video> (hls.js; Apple: ManagedMediaSource, fallback native), R2 files with pass,
  intros, swipe between lessons, vertical full screen, scrubbing with strips + frame cache, 3-sec loop, repeat, mirror, speed
  (slow = silent), subtitles, saving to the phone (Cache Storage `fedoskin-video-1`, limit sheet), diagnostics `?diag=1`.
- Coaching: services (premium first), order through in-app chat (Telegram bot) or messengers, crypto USDT TRC-20, reviews
  (paying clients via one-time links), coach card last.
- Battles: hero levels by lesson minutes, wardrobe (shop ⭐ items + street gear `c:<id>` from the city, one per slot), rating (top 100,
  cards), rhythm battle by hand (answer within 24 h) or auto cartoon, moves unlocked by STUDYING lessons (3 views with sound + level),
  starter gate for new players, rare/mythic moves, points for fresh lessons, coach bridge.
- Manual rhythm freezes use a four-beat balance check in `rhythm.js`. The first manual round opens with a gesture demo. Freeze gear widens the zone.
- City crews, the underground ring and the park jam share the move chooser, `battle-study.js` lesson gates and the final hold in `city3d-freeze.js`. A jam uses the same selection in each round.
- Drawn City power moves finish on an in-lane release after a whole turn, with up to ten turns. Extra turns add points to a successful move. The 1990 has a smaller lane and ends in a fall as soon as the pointer leaves it.
- Wardrobe rarities are 0–4 (grey → red); equipped slot cards and capped bonuses share `HERO.itemOf/gearBoost/gearChances`. Keep red slots,
  chance thresholds and mythic scores in sync with `BT_GEAR_*` in the Worker. The admin checks `gear: 1` before hiding the Worker update banner.
- City (flat): crews dance-offs, graffiti turf, DJ/MC, deliveries, daily goals; energy from lesson minutes; street gear helps in battles.
- City 3D districts: yard + «Центр» (city3d-center.js, `?d=center`) + «Парк» (city3d-park.js, `?d=park`) + «Промзона» (city3d-prom.js, `?d=prom`) — see the last entries of the full notes.
- City 3D bodies are ONE skinned mesh per person (`skinGeo` in city3d-mocap.js) — don't hang new limb pieces on bones; dancers leave the floor on foot (`W.walk`); fixture brightness = `LAMP_K` / `FILL_K` in city3d.js (owner 16.11: «слишком ярко»).
- City 3D GLARE (17.11): clothes never pass HDR .8 (`tame()` in city3d-mocap.js — use `M()`/`tame()` for new clothing materials; only `glowOf` glows), bloom has a soft knee.
- City 3D MIRRORED moves «<clip>_M» (`MIRROR` in city3d-mocap.js); battle footwork = random COMBO of phrases (`FW`, `makeTurn`, turns via `spinTick`/`turnBy` round the hips).
- City 3D HEAD = `addCityHead` in `city3d-head.js`. The skull, hairstyles and headwear have shared geometries shaped for the view from above.
  Fit head accessories to these profiles and include their silhouette in the support points if they touch the ground during headspins.
- City 3D CLOTHING (25.11): sleeve openings and trouser seats join their limbs through `G.bridge`. Shirt hems blend with the hips and thighs.
  Fit pockets, knee pads and sewn patches to the garment surface with `G.panel` or `G.badges` so they follow the same rig.
  `G.trace` and `G.cord` follow the garment surface for seams and drawstrings. `city3d-hood.js` shapes the folded hood and its lining.
- City 3D CREW BEATS (17.11, owner «разные биты под батлы с разными бандами… как фоновая музыка»): rhythm.js `LOOPS` (yard = the old background,
  13 crews by `c.id`, `jam`, `ring`; each `{name, bpm, vol, play()}`, 16-step pattern strings). `startBattle` → `ctx.music(id)`, `endBattle` → `ctx.music(null)`
  (city3d.js `setMusic`, 40 ms debounce so jam rounds don't re-scratch); `RB.bgm(true, id)` swaps with a DJ scratch; speakers pump on `RB.bgmBeat()`.
  `vol` levelled with `RB._bgmRender(id, bars)` (offline render) — re-measure when a loop changes.
  BATTLE TEMPOS sped up 17.11 (owner «ускорь биты на батлах, фон оставь»): crews/jam/ring 110…138 BPM (= 110 + (old − 80) × .54), yard stays 88.
  BATTLE PUNCH 17.11 (owner «энергичнее и басовее»): every non-yard loop plays through `hotRig` (HOT set only inside `loopBar`): heavier kick/808 dry +
  sidechain pump, held saturated «phone bass» 140–460 Hz (level `hb` per loop) + sub, crash / snare roll + riser / pickup kick (`hotDrums`). Yard and the
  rhythm battle never see HOT. Re-level `vol` (target yard +3.5 dB, double 150 Hz highpass) after any change.
- City 3D DRAWN POWER (17.11, owner «авто скучно, но и в бит тапать не надо… идеально сделать элемент, нарисовав»): `city3d-power.js` — the hero's
  power step in battles hangs (clock stops), the finger leads his legs round a line MEASURED from the mocap (`DRAW` per clip, `table()`/`timeAt()`),
  the clip's time follows the finger; perfect ×1.5 / clean / fall; no touch → old auto outcome; replay at real tempo after. `makeTurn` builds both
  endings (`s.tails`), `drawn()` re-times the set. Test with `?pm=FLARE` + `GAME._pm()` / `_pmLast()`.
- City 3D MUSIC (17.11, iPhone silent until the 🎵 button was toggled): on a phone no sound before the first real touch (touchend / pointerup / click),
  the loop restarts once `RB.audioState()` is running, after the background the next touch makes a new context (`RB.fresh`). Zoom tip `#ztip`: once ever (`fedoskin-city3d-ztip`).
- City 3D WALK / RUN = real mocap (Mixamo «Walking» + «Running» in anim/bboy.json, `gaitPose` in city3d-mocap.js) blended by speed in `stride()` (city3d.js) for
  everyone who walks, including entries to the floor; phase driven by distance and scaled to the person's build. Hero top speed `HERO_SPD` 5.2 m/s.
  Never go back to the hand-made sine gait. Hands and sneakers are part of the skinned body.
- City 3D CUSTOM (17.11): tailor «Игла» in the yard (city3d-game.js `CUS`, save `S.cus` {kicks, top, pants, head} 0…3, paid with ⚡, levels 2/3 gated by rank);
  details drawn on the hero from `look.cus` (city3d-mocap.js, `?cus=3333` = test look); bonuses go through `buff()` → `makeTurn` (step pts, style, freeze / power falls).
- City 3D PEOPLE have BODIES: `bodyOf(seed, {type, girl, old, …})` → `mocapPerson(look, { body })` (city3d-mocap.js: BODY_TYPES avg / slim / lanky /
  athl / stocky / heavy / big / small, skin, hair colour + style, beard, backpack, coat). Every new person gets a body; the hero keeps the plain one.
- City 3D SPEED (17.11): shadows were ~80% of the draw calls. `city3d-perf.js` merges the shadows of everything static (layer 1, self-healing
  watcher), people's parts on one bone cast one merged piece, tiny parts cast nothing, bodies are frustum-culled, the moon's shadow is fitted
  to the screen, lamp shadows redraw only when on screen. New casters need nothing special; `userData.dyn = true` keeps one out. `?fps` shows the worst frame.
- City 3D SPEED 2 (22.11, owner «проверь почему город притормаживает»): a PERSON = ONE draw call — `mergeParts` (city3d-mocap.js) bakes every rigid
  piece in plain clothing materials (M/M2/MV) INTO the skinned body (weight 1 to its bone; colour + roughness/metalness `rm` + `rim` per vertex,
  SKIN_MAT reads them; two-sided pieces → one extra skinned `parts2`); the originals stay hidden (`layers.disableAll()`, `userData.merged`) for
  ground contacts. New body attributes `rm`/`rim` are REQUIRED by SKIN_MAT (G.build adds them). All skinned meshes use `DEPTH_SKIN` as
  customDepthMaterial (else three re-derived the shared depth program ~50×/frame). Boot WARM-UP compiles every shader (render target set, the
  real variant) and uploads every texture. OutputPass + grade = one pass (`out`, old name `fin`). `?fps` shows ЦП ms, jerks/10 s and a frame strip.
  Shadow batcher takes multi-material boxes. `?set=classic|rock|drop|powerFirst` forces the hero's set shape (tests).
- City 3D SETS: `makeTurn` rotates through seven `SHAPES` and three `ENTRIES` independently for the hero and each opponent. Final holds
  use mirrored clips from `FREEZE` (air from lv 2). `?set=<shape>` forces the hero's set for testing.
- City 3D CAMERA reads `W.hero` every frame (rewear() replaces the hero object — never cache it); player zoom `W.uZoom` (pinch / wheel, .7…3,
  saved), W.camT overrides it in battles/actions. Crew members are dressed one by one (`dress` / `crewLook` in city3d-game.js, yard palettes `CSTY`).
- City 3D: own page city3d.html, OPEN TO EVERYONE from the Город tab since 17.11 (alpha notice on the first visit; ALL texts translated since 18.11 — see i18n).
  Standing uses five loops from `makeStand` (never loop raw «Breakdance_Ready», a sidestep); clips with a big seam play once (`userData.once`). Owner's direction 14.11: top-down 3D like his
  reference video. Dancers now play REAL motion capture (Mixamo, `anim/bboy.json`, `city3d-mocap.js`) — never hand-pose dance moves again;
  missing moves (windmill, airflare, backspin, 2000) need mocap from a video-capture service. Game layer `city3d-game.js`: crews, AUTO battles
  (random sets, falls, judges), energy from lessons, respect ranks; its save is separate from the flat city (merge gear later).
- City 3D ENERGY (22.11, owner): every new day free top-up to FULL (`BAL.daily` = `enMax` 100); lessons (+5/min) and every reward (goals, tea, OG, stash)
  stack ABOVE 100 up to `BAL.enCap` 300 (gold HUD `#g3en.over`); lessons are added AFTER the new-day top-up in `refill()`.

## Testing habits
- Local server: `python3 -m http.server 8765` in the repo; Playwright headless at 390×844 (iPhone) and 375×667, ru + en.
- WebGL headless: chromium args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Playwright route.fulfill bypasses throttling — serve media from a real local server. CDP touch is too slow for flicks: use in-page
  TouchEvents. Claude has never heard the sounds and can't test on a real iPhone — say so and ask the owner.

## Git
- Publish app changes after verification by default. Follow the publishing workflow in `AGENTS.md`.
