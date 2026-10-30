# Fedoskin team app — notes for Claude

- Owner writes in Russian; answer in Russian, plain language (he is not a developer).
- Static web alpha, no build step: `index.html` (all UI + JS), `lessons.js` (lesson data, strict JSON after `window.LESSONS_DATA =`),
  `config.js` (settings: alpha, banner, Telegram, review prices/hours, newDays, metrikaId,
  subscription prices subRub/subYearRub/subUsd/subYearUsd — ru UI pays in ₽, all other languages in $; `SUB` in index.html), `v/` (videos).
- `admin.html` — owner's admin panel: edits lessons.js/config.js and uploads videos via the GitHub API (fine-grained token in
  the owner's browser). Keep lessons.js/config.js machine-readable JSON so the admin can parse them. Lesson fields:
  id, sec, name, dur, ru, added, pv (false = no -p3 preview), hidden, new (false = no NEW badge), ks (Kinescope video id).
  `vendor/mediabunny.min.mjs` (MPL-2.0) does in-browser compression: admin quality choice 720p (~1 Mbit/s) / 1080p
  (~3.5 Mbit/s at 60 fps) / «Без сжатия» (`fedoskin-admin-quality`).
- Languages: ru (source) + en, es, pt, fr, de, ja, ko, zh. UI texts in index.html stay Russian; `T('русский текст', {vars})`
  translates in JS, `translateDom()` translates fixed HTML text/aria/placeholder by exact match. Dictionary is generated:
  edit `tools/i18n_src.py`, then `python3 tools/i18n_src.py i18n.js`. Every new visible Russian string needs a key there.
  Language is picked from the phone (CIS -> ru, unknown -> en), changed via the RU pill / Профиль → Язык (`fedoskin-lang`).
  Lesson videos are Russian speech; move names are international. Admin stays Russian only.
- Analytics: owner decided NO Yandex Metrika (29.10.2026, legal/consent hassle). `metrikaId` stays empty; the dormant
  code in index.html loads nothing. Admin hides the Metrika field/instructions (`data-later="metrika"`).
- Push notifications: `server/push-worker.js` = Cloudflare Worker + KV binding `PUSH` (owner deploys it by hand, steps in
  server/README.md); its URL goes to `pushUrl` in config.js. Admin auth on the worker = the owner's GitHub token (checked via
  GitHub API, push permission). Payload is RFC 8291 aes128gcm (verified against the RFC test vector). App: home card +
  Профиль → «Уведомления о новых уроках»; sw.js shows the push and opens `./?lesson=<id>`. Admin auto-sends 3 min after
  publishing new lessons (timer bar) or manually in «Статистика». Free plan: fan-out in pages of 40.
- Dark hip-hop design: Anton + Inter, accent #E2611A, NEW badge #3BD16F. Keep the look consistent.
- Alpha mode: `alpha: true` in config.js — all lessons free, "Free" tags hidden; review (Разбор) is paid via Telegram
  link `t.me/Fe_DoSk1n?text=...` (`tg` in config.js).
- Hidden for later (do not delete): courses, articles, promo tab, "my reviews". Elements carry `hidden data-later="..."`
  or are commented out in TABS.
- Adding a lesson: encode to 720p H.264 60fps CRF 26 (`-preset veryfast`), cover jpg 480px wide from 2s,
  preview `<id>-p3.mp4` = first 3s, crop 720:960 → 360x480, 30fps, no audio; add a row to `lessons.js` with `added` date.
- Kinescope (since 30.10.2026): lessons with `ks` play `https://kinescope.io/<ks>/master.m3u8` in OUR <video> (so slow-mo,
  mirror, loop, own full screen keep working): native HLS on Apple, hls.js 1.5.20 from cdnjs/jsdelivr/unpkg elsewhere
  (lazy-loaded; no npm access from the sandbox to vendor it). Cover jpg + -p3 preview still live in `v/` on GitHub.
  Admin uploads straight from the browser to `uploader.kinescope.io/v2/init` → POST file to returned endpoint (CORS ok).
  `api.kinescope.io` has NO CORS, and the sandbox can't reach kinescope at all (proxy 403) — don't design around the
  REST API. Kinescope token + project id live only in the owner's localStorage (`fedoskin-ks-token`/`-project`), never in
  config.js. Free plan = 100 min storage; admin «Статистика» shows minutes used. Admin can drop v/<id>.mp4 once ks works.
- Keep each video file well under 25 MB (GitHub web limit) — current lessons are 1.5–7 MB.
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
- iPhone home-screen app (iOS 26, WebKit 301108): the viewport is short by the status bar and nothing is drawn below it.
  Fixed by `@media (display-mode: standalone){ html{min-height:min(100lvh, calc(100% + env(safe-area-inset-top)))} }`.
  Don't push the menu below innerHeight (old «gapfix» did — labels got cut). Bottom-menu buttons: icon + 1 label line max.
- Re-cropping a Kinescope lesson's cover: in the owner's Chrome (Claude in Chrome) mediabunny reads the HLS
  (`UrlSource(master.m3u8)` + HLS_FORMATS); CanvasSink for the jpg, Conversion with `crop` + trim 0–3 for -p3.mp4;
  commit with the admin's GitHub key from that page's localStorage. Kinescope lessons may be 16:9 (landscape).
