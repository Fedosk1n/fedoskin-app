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
- Hidden for later (do not delete): courses, articles, promo tab, "my reviews", the lesson header's «Проверить на своём видео»
  upload button (owner 31.10 «убери её»; `data-later="own-video"`, a 44px spacer keeps the title centred). Elements carry `hidden data-later="..."`
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
  ← (leave lesson), name (2 lines), sound. Bottom-right corner of the video (owner's request 31.10): `#fsInfo`
  (icon «screen + text lines» = «Подробнее» → lesson page, video keeps playing) and `#fsFull` (standard ⛶ corner icon) =
  `fs-full`: only the video edge to edge (panel + top bar hidden) + browser Fullscreen API where allowed; the same
  button (icon flips) or leaving the phone's full screen returns to the normal vertical view. Tap on video = pause/play.
  Double tap on the video (owner 31.10, own detection in the stage click handler: 2nd tap < 320 ms and < 60 px; a single
  tap waits 280 ms): vertical lesson view ⇄ only the video (`fs-full`); lesson page ⇄ full screen (vertical layout or
  landscape fs). Stage has `touch-action:manipulation` (no browser double-tap zoom).
  This full screen pushes no history: system back leaves the lesson (popstate exits fs AND navigates when `vertFs`).
  From the lesson page the ⛶ button opens the same vertical layout (with an fs history step back to the page). Phone
  rotation does not touch the vertical mode. Lessons without the mark: decided on the first loadedmetadata
  (`vertAuto`). Landscape lessons unchanged. Stage click handler checks `composedPath()` (buttons re-render icons).
- Swipe between lessons (31.10.2026): horizontal swipe on the video (`lessonSwipe()`, touch events on #stage; any
  mode — page, vertical, only-video, landscape fs; fs-rot uses the screen's y) — finger left = next lesson of the
  section, right = previous. Video layers follow the finger via CSS `translate` var `--sx` (independent of the mirror
  `transform`), `#swPeek` shows the neighbour's cover / first frame; `#swLabel` («Следующий/Предыдущий урок» + name) stands still over the
  current video and fades in with the swipe (opacity 0 → 1 at the 25 % switch point; owner 31.10), the top title fades out; switch past 25 % width or a
  flick. No neighbour: little give + chip «Это первый/последний урок раздела». Ignored: starts on .fstop/.fsbottom, own
  video, and the side edges (`EDGE_BACK` 24 px, every mode) — edges = «back»: our iPhone-app edge gesture (now also in the
  vertical full screen, with a label «← Назад к разделу <section>») or the phone's own on Android/browsers (owner 31.10:
  prev-lesson swipe and back swipe must not clash). Switching uses `navReplace` → history.replaceState, so back still goes
  to the section in one step; the full-screen mode is kept. Neighbours (next, prev) are warmed first. One-time tip
  `#swHint` (`fedoskin-swipe-tip`).
  Neighbour preload (31.10): once the lesson plays (+0.6 s, fallback 4 s) its neighbours — next, prev, next+1 — are
  downloaded whole into memory (`introMem`, blob:, serial, max 5, ≤12 MB each): GitHub lessons = the whole mp4
  (`mediaFor`), Kinescope = the intro. Same gate as intros (`introFast`, saveData). GitHub lessons then play from the
  blob (`introSource` → loadVideo non-ks path). The next lesson's first frame is pre-decoded in the hidden
  `#swPeekVid`; while swiping it (not the cover) slides in; at the switch it is copied to `#swPeekCan` (peek video freed)
  and held (`peekhold`, no cover/spinner: `quietOpen`) until the new video's `playing`. Slide 150 ms. Headless test
  @10–25 Mbit: video moving 0.2–0.45 s after letting go, real frame from 0.15 s (was 0.65–0.7 s with cover + spinner).
- Slider scrubbing (31.10.2026, owner's screen recording: video kept playing and pulled the slider back, every move
  cancelled the previous seek ⇒ spinner, jumps): `scrubStart/scrubMove/scrubEnd` on #seek/#fsSeek (pointer/touch/
  change). While dragging: video paused (P.playing kept, `scrub` blocks frame loop, playMain/playIntro, showStall),
  seeks chained (next only after `seeked`), Kinescope stream seeks only inside its buffer or when the finger rests
  140 ms. Picture during the drag = frame strip `v/<id>-sb.jpg` drawn into `#sbCan` (object-fit contain, mirrored
  with the video), replaced by the real frame once `seeked` lands within 0.15 s. `storyboards.js` (`window.LESSON_SB`):
  id → {src: ks id or "gh", every, n, w, h, cols, v}; valid only if src matches. Strips: 180x320 (or 320x180) frames
  every 0.5 s (long lessons: ≤ ~120 frames), 10 per row, JPEG ~q0.7, 140–590 KB; loaded 0.3 s after the lesson plays.
  GitHub strips were made with ffmpeg in the sandbox; the admin card «Мгновенный старт и плавная перемотка» makes
  missing ones itself (mediabunny CanvasSink on the lightest track: Kinescope HLS or v/<id>.mp4 on Pages) and commits
  them + storyboards.js; deleting a lesson removes its -sb.jpg.
  Smoothness fix (owner 31.10 «кадры дергаются туда-сюда»): the finger on .timeline is tracked by OUR pointer handlers
  (setPointerCapture; fs-rot uses clientY); the range inputs are `pointer-events:none!important` (keyboard only) — the
  native slider has a ~50 px dead zone and, in fs-vert (`.fsbar *{pointer-events:auto}`), fired alongside ours with
  lagging values ⇒ back-and-forth. While the finger moves only the strip is shown (frame floor(t) blended into the next
  by the fraction — never ahead of the finger); the sharp frame replaces it only when the finger rests 140 ms / lets go.
  Test (jit.js): steady forward drag ⇒ 0 backward steps, 0 strip↔sharp switches mid-drag.
  Full quality while dragging (owner 31.10 «как в монтажке, без потери качества»): `fqFeed/fqStart` decode the real
  frames with mediabunny (lazy `import('./vendor/mediabunny.min.mjs')`, preloaded 2.5 s after playing on fast links,
  WebCodecs) into `#fqCan` at the video's own size: GitHub lessons from the file (blob from memory or UrlSource), the
  Kinescope intro while < 5 s, beyond that the Kinescope HLS itself (rendition ≤720, only needed pieces fetched).
  `canvasesAtTimestamps(async generator of the newest finger position)` — moving forward it keeps decoding onwards. Sharp
  frames take over once ≤0.2 s behind the finger (never a step back), and give way to the strip when > 1 s behind (a
  quick sweep); sources keep 4-s GOPs (GitHub keyint 250), so fast sweeps show the strip, slow precise scrubbing is
  sharp: headless test 80–99 % of frames full quality at slow speed, both GitHub and Kinescope.
- Frame cache for scrubbing (owner 31.10: clients disliked the blur): `fc-worker.js` (module Worker, OffscreenCanvas,
  mediabunny) keeps the lesson's frames as sharp JPEGs (≤720 short side, q0.8) in memory on a grid `step` =
  max(0.1 s, dur/600). Sources: (1) short GitHub lessons — whole file (blob from `introMem`, or fetched on a fast link)
  decoded in the worker ~1.8 s after `playing`, starting 4 s ahead of playback, paused while the finger drags;
  (2) capture of whatever plays on screen (rVFC → createImageBitmap → worker) — Kinescope lessons get sharp frames
  for every watched part (iPhone native HLS refuses the copy ⇒ only the intro). Cap 90 MB total, other lessons evicted
  first. Drag: `fcShow` (cached frame, drawn on #fqCan, `fcId/fcT`) → else fq decode → else strip. Unwatched Kinescope
  parts still fall back to fq/strip. `window.fedoskinFrames()` shows the cache state. Headless: 33-s lesson cached in
  ~8 s paused / ~16 s while playing (0 dropped frames), 26 MB; drags 100 % sharp, 0 backward steps.
  Dot on the slider: `.knob` (#knob, #fsKnob) at the position, ×1.55 while dragging (`.timeline.drag`).
- Sound button (owner 31.10): vertical full screen — `#fsSoundC` in the video's bottom-right corner, LEFT of «Подробнее»
  and «во весь экран» (right:114px; 62px in «only video» where «Подробнее» is hidden), orange when muted; landscape full
  screen — «Звук / Без звука» 6th captioned button of the bottom row (`#fsSound`, hidden in fs-vert); `#btnMute` on the
  page player; the old top-bar icon `#fsMute` is not shown. `toggleSound()`: one state `soundOff`, remembered in
  `fedoskin-mute`, short centre sign `#sndFlash`. Autoplay-blocked fallback still mutes without saving.
- Video file size: admin publishes via the Git Data API (MAX_FILE 70 MB). Most lessons are 1.5–7 MB (720p); short
  lessons moved from Kinescope are 1080p60 copies, ~20–35 MB.
- Short Kinescope lessons → GitHub (owner 31.10: «1080, 60 кадров, не урезай»): admin «Уроки» → card «Короткие уроки из
  Kinescope — на GitHub» (`#moveCard`, lessons with ks and dur ≤ 60): mediabunny copies the Kinescope HLS rendition with
  short side 1080 (or best below) + pairable audio into a faststart mp4 WITHOUT re-encoding, cuts its strip from the
  blob, one commit: v/<id>.mp4 + -sb.jpg, lessons.js without `ks` (dur from the file), intros.js entry and
  -intro.mp4 removed. Kinescope keeps its copy (owner may delete it there). Tested with fake HLS → 1080x1920, 60 fps, AAC.
- Videos on the phone (sw.js, 31.10): v/*.mp4 (not -p3) are downloaded ONCE whole by the service worker; player range
  requests, app preloads and the frame-cache build all read that one download (streamed 206 answers; a jump > 3 MB ahead
  of the download goes to the network). Finished files go to Cache Storage `fedoskin-video-1` (≤ 300 MB / 20 files,
  oldest out; ETag/Last-Modified rechecked by HEAD at most hourly — a replaced video is dropped). Apple: the player's
  own requests (`destination === 'video'`) bypass the SW (AVFoundation not risked); the app's fetches still go through.
  App: `introSource` for GitHub lessons tries `fromSaved()` (caches.match → blob:) first, so a reopened lesson plays
  without internet. Neighbour preload now takes files ≤ 40 MB (MEM_TOTAL 100 MB). fcBuild without a memory blob:
  saved copy, or (non-Apple, SW controlling) fetch through the shared download; otherwise capture only.
  SW registers on https and on localhost (tests).
- iPhone «cover stays, time and sound run» (owner's screen recording 31.10, lesson CC at 0:08–0:11 showing the 2-s cover
  frame): on Apple the background frame-cache build (worker VideoDecoder during playback) is OFF (`fcBuild` returns when
  `isApple`; capture from the screen still works), memory caps lower (introMem 3 files / 60 MB, frame cache 40 MB).
  Watchdog (GitHub lessons): `vid` playing, readyState ≥ 3, t ≥ 1 s, but no rVFC frame for 1.5 s ⇒ reload the same src at
  the same time once per lesson (`wdLesson`). Tested: never fires in normal use; simulated no-frames ⇒ 1 reload, keeps playing.
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
- Leaderboard (30.10.2026): same Cloudflare worker (`/lb`, one KV key `lb`), URL = `pushUrl`. Phone id = profile id,
  random secret in `fedoskin-lb-secret`; server caps minute growth to real time and first claim to 300. Hidden until pushUrl set.
- iPhone home-screen app (iOS 26, WebKit 301108): the viewport is short by the status bar and nothing is drawn below it.
  Fixed by `@media (display-mode: standalone){ html{min-height:min(100lvh, calc(100% + env(safe-area-inset-top)))} }`.
  Don't push the menu below innerHeight (old «gapfix» did — labels got cut). Bottom-menu buttons: icon + 1 label line max.
- Re-cropping a Kinescope lesson's cover: in the owner's Chrome (Claude in Chrome) mediabunny reads the HLS
  (`UrlSource(master.m3u8)` + HLS_FORMATS); CanvasSink for the jpg, Conversion with `crop` + trim 0–3 for -p3.mp4;
  commit with the admin's GitHub key from that page's localStorage. Kinescope lessons may be 16:9 (landscape).
