# Fedoskin team app — notes for Claude

- Owner writes in Russian; answer in Russian, plain language (he is not a developer).
- Static web alpha, no build step: `index.html` (all UI + JS), `lessons.js` (lesson data, strict JSON after `window.LESSONS_DATA =`),
  `config.js` (settings: alpha, banner, Telegram, review prices/hours, newDays, metrikaId,
  subscription prices subRub/subYearRub/subUsd/subYearUsd — ru UI pays in ₽, all other languages in $; `SUB` in index.html), `v/` (videos).
- `admin.html` — owner's admin panel: edits lessons.js/config.js and uploads videos via the GitHub API (fine-grained token in
  the owner's browser). Keep lessons.js/config.js machine-readable JSON so the admin can parse them. Lesson fields:
  id, sec, name, dur, ru, added, pv (false = no -p3 preview), hidden, new (false = no NEW badge), ks (Kinescope video id),
  vertical (true = portrait video → opens straight in full screen; admin sets it from the file's size on upload).
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
  mirror, loop, own full screen keep working): native HLS on Apple, hls.js 1.5.20 from `vendor/hls.min.js` (Apache-2.0,
  vendored 30.10 via the owner's browser; CDNs only as fallback — Cloudflare CDNs are throttled in Russia). Cover jpg + -p3 preview still live in `v/` on GitHub.
  Admin uploads straight from the browser to `uploader.kinescope.io/v2/init` → POST file to returned endpoint (CORS ok).
  `api.kinescope.io` has NO CORS, and the sandbox can't reach kinescope at all (proxy 403) — don't design around the
  REST API. Kinescope token + project id live only in the owner's localStorage (`fedoskin-ks-token`/`-project`), never in
  config.js. Free plan = 100 min storage; admin «Статистика» shows minutes used. Admin can drop v/<id>.mp4 once ks works.
- Fast lesson start (30.10.2026): `#vload` overlay shows the lesson's -p3 preview + jpg + spinner until `playing`
  (spinner only on mid-play `waiting` >0.5 s); hls.js preloads ~1.2 s after app start on non-Apple; hls.js starts at the
  highest level ≤720p (`autoStartLoad:false` + MANIFEST_PARSED → `startLevel`, `startLoad`), ABR raises it; section open
  warms Kinescope (master + ≤720p media playlist, preconnect to hosts found), stopped by `warmGen` when a lesson opens.
  iPhone plays native HLS (AVFoundation has its own network stack) — there only the overlay helps. Local test with a
  fake HLS + throttling in Playwright: first frame 2.7 s → 1.0 s on Android.
- Instant start (31.10.2026): Kinescope lessons also have `v/<id>-intro.mp4` = first 5 s copied (no re-encode) from the
  480p rendition of the Kinescope HLS (~2 MB; Kinescope 720p is 5.1 Mbit/s — too heavy). `intros.js`
  (`window.LESSON_INTROS`) maps lesson id → "<ks>:480"; the app uses an intro only if it matches (replaced video or
  other quality ⇒ ignored). Player: `#vin` plays the intro on top with sound; `#vid` (stream, muted, paused) starts
  loading only when the intro is fully downloaded, FROM the intro's end (`pendingStart` → hls `startLoad(5)` /
  native currentTime), so 0–5 s is never fetched twice and the two never compete. Its start level is chosen so the
  first 4-s piece arrives before the intro ends (speed measured on the intro download). At the intro's end
  `toStream()`: intro pauses and hides when the stream draws a frame ≥ that time (rVFC). `av` = element seen/heard;
  timeline, speed, loop, stats, mute (`soundOff`) follow it. Seek past the intro ⇒ switch at once.
  Speed (`fedoskin-net`, "Mbps@time", forgotten after 6 h) from hls FRAG_LOADED + intro downloads; intro only if
  unknown or ≥ 6 Mbit/s measured (saveData/`connection.downlink` < 5 ⇒ no). Without intro the stream starts at
  ≤ 0.75×speed (480p if unknown). While a lesson starts, section cover animations stop (`pvStopAll`) and the
  «more lessons» ones wait for `playing` (`pvHold`) — on slow links they used to eat the bandwidth.
  Two intros at the top of an opened section are prefetched into memory (blob:, serial, aborted on lesson open).
  Admin «Уроки» → card «Мгновенный старт»: cuts missing intros with mediabunny (`tracks:'all'`, track ≤480 + pairable
  audio, trim 0–5), commits them + intros.js in its own commit; runs after login, publish, Kinescope processing.
  Realistic test (fake HLS at Kinescope bitrates, 4-s fMP4, real throttled server — NOTE: Playwright route.fulfill
  bypasses CDP throttling, serve media from a real local server): first frame 0.2 s @25 Mbit, 0.4–0.5 s @10, 0.5 s @7
  (stream alone: 2.2 / 2.0–3.5 / 3.1 s); wait at intro end ~0.1–0.35 s. Slow links (≤5) after the first visit go
  stream-only (2.8 s @5, 3.9 s @3). First-ever visit on a slow link with unknown speed (iPhone): fast start, then
  stalls — speed is learned. iPhone native-HLS path not testable here.
- Vertical lessons (31.10.2026): `vertical: true` ⇒ openLesson → `enterVert()`: body `fsmode fs-vert` = video fills the
  screen above, a solid control panel below (`--vpan` 142px + safe area, always visible, never over the dancer's feet):
  timeline + «5 сек / Скорость / ▶ / Зеркало / Повтор», each round icon with a caption (`.fsk`). Top bar over the video:
  ← (leave lesson), name (2 lines), sound, «Подробнее» (= lesson page; video keeps playing). Tap on video = pause/play.
  This full screen pushes no history: system back leaves the lesson (popstate exits fs AND navigates when `vertFs`).
  From the lesson page the ⛶ button opens the same vertical layout (with an fs history step back to the page). Phone
  rotation does not touch the vertical mode. Lessons without the mark: decided on the first loadedmetadata
  (`vertAuto`). Landscape lessons unchanged. Stage click handler checks `composedPath()` (buttons re-render icons).
- Keep each video file well under 25 MB (GitHub web limit) — current lessons are 1.5–7 MB.
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
- Leaderboard (30.10.2026): same Cloudflare worker (`/lb`, one KV key `lb`), URL = `pushUrl`. Phone id = profile id,
  random secret in `fedoskin-lb-secret`; server caps minute growth to real time and first claim to 300. Hidden until pushUrl set.
- iPhone home-screen app (iOS 26, WebKit 301108): the viewport is short by the status bar and nothing is drawn below it.
  Fixed by `@media (display-mode: standalone){ html{min-height:min(100lvh, calc(100% + env(safe-area-inset-top)))} }`.
  Don't push the menu below innerHeight (old «gapfix» did — labels got cut). Bottom-menu buttons: icon + 1 label line max.
- Re-cropping a Kinescope lesson's cover: in the owner's Chrome (Claude in Chrome) mediabunny reads the HLS
  (`UrlSource(master.m3u8)` + HLS_FORMATS); CanvasSink for the jpg, Conversion with `crop` + trim 0–3 for -p3.mp4;
  commit with the admin's GitHub key from that page's localStorage. Kinescope lessons may be 16:9 (landscape).
