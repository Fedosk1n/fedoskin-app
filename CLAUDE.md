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
- Lesson player: Kinescope HLS via our own <video> (hls.js; Apple: ManagedMediaSource, fallback native), R2 files with pass,
  intros, swipe between lessons, vertical full screen, scrubbing with strips + frame cache, 3-sec loop, repeat, mirror, speed
  (slow = silent), subtitles, saving to the phone (Cache Storage `fedoskin-video-1`, limit sheet), diagnostics `?diag=1`.
- Coaching: services (premium first), order through in-app chat (Telegram bot) or messengers, crypto USDT TRC-20, reviews
  (paying clients via one-time links), coach card last.
- Battles: hero levels by lesson minutes, wardrobe (shop ⭐ items + street gear `c:<id>` from the city, one per slot), rating (top 100,
  cards), rhythm battle by hand (answer within 24 h) or auto cartoon, moves unlocked by STUDYING lessons (3 views with sound + level),
  starter gate for new players, rare/mythic moves, points for fresh lessons, coach bridge.
- City (flat): crews dance-offs, graffiti turf, DJ/MC, deliveries, daily goals; energy from lesson minutes; street gear helps in battles.
- City 3D (draft, separate page, not linked): see the last section of the full notes. Owner's direction 14.11: top-down 3D like his
  reference video; next = correct the dance moves from his element videos (frames → key poses), then port mechanics one by one.

## Testing habits
- Local server: `python3 -m http.server 8765` in the repo; Playwright headless at 390×844 (iPhone) and 375×667, ru + en.
- WebGL headless: chromium args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Playwright route.fulfill bypasses throttling — serve media from a real local server. CDP touch is too slow for flicks: use in-page
  TouchEvents. Claude has never heard the sounds and can't test on a real iPhone — say so and ask the owner.

## Git
- Commit and push when the owner asks for the change to be live: `git -c push.negotiate=true push origin HEAD`.
