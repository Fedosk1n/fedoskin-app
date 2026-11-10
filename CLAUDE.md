# Fedoskin team app — notes for Claude

- PRIORITY (owner 09.11.2026): «забудь вообще про русских, не надо под них подстраиваться» — the primary goal is money in
  dollars from the foreign audience. Don't design features, hosting or legal setups around Russian users; existing ru UI
  stays as is but gets no special effort.
- Owner writes in Russian; answer in Russian, plain language (he is not a developer).
- Static web alpha, no build step: `index.html` (all UI + JS), `lessons.js` (lesson data, strict JSON after `window.LESSONS_DATA =`),
  `config.js` (settings: alpha, banner, Telegram, review prices/hours, newDays, metrikaId,
  subscription prices subRub/subYearRub/subUsd/subYearUsd — ru UI pays in ₽, all other languages in $; `SUB` in index.html), `v/` (videos).
- `admin.html` — owner's admin panel: edits lessons.js/config.js and uploads videos via the GitHub API (fine-grained token in
  the owner's browser). Keep lessons.js/config.js machine-readable JSON so the admin can parse them. Lesson fields:
  id, sec, name, dur, ru, added, pv (false = no -p3 preview), hidden, new (false = no NEW badge), ks (Kinescope video id),
  vertical (true = portrait video → opens straight in full screen; admin sets it from the file's size on upload).
  r2 (file name in Cloudflare R2, e.g. `tr-x-<random>.mp4` — see «Cloudflare R2» below).
  `vendor/mediabunny.min.mjs` (MPL-2.0) does in-browser compression: admin quality choice 720p (~1 Mbit/s) / 1080p
  (~3.5 Mbit/s at 60 fps) / «Без сжатия» (`fedoskin-admin-quality`).
  Vendored mediabunny is PATCHED (04.11.2026): line 2 sets `Symbol.dispose ??= Symbol.for('Symbol.dispose')` (+asyncDispose) —
  Safari has no Symbol.dispose, and the stock build then throws «Object not disposable» on every re-encode on iPhone.
  Keep the patch if mediabunny is ever updated; imports carry `?v=2` (bump it on any change of the file).
- Languages: ru (source) + en, es, pt, fr, de, ja, ko, zh. UI texts in index.html stay Russian; `T('русский текст', {vars})`
  translates in JS, `translateDom()` translates fixed HTML text/aria/placeholder by exact match. Dictionary is generated:
  edit `tools/i18n_src.py`, then `python3 tools/i18n_src.py i18n.js`. Every new visible Russian string needs a key there.
  Language = the phone's (`phoneLang()`: first supported of navigator.languages; CIS -> ru, ro only ro-MD -> ru, unknown -> en)
  unless picked by hand (RU pill / Профиль → Язык saves `fedoskin-lang`). First option «Как на телефоне» removes it (`LANG_AUTO`);
  in auto mode a `languagechange` while open reloads (owner 01.11.2026).
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
- Hidden for later (do not delete): courses, articles, promo tab, "my reviews", the lesson page «Скачать» button (a mock;
  owner 05.11 «уберём кнопку качать», `data-later="download"`, tools row now 2 columns: Зеркало / Повтор), the lesson header's «Проверить на своём видео»
  upload button (owner 31.10 «убери её»; `data-later="own-video"`; its place on the right is now the share button `#lessonShare`). Elements carry `hidden data-later="..."`
  or are commented out in TABS.
- NO LESSON VIDEOS ON GITHUB (owner 09.11.2026 «ссылки открытые — исправь»): the 17 former GitHub lessons were moved to
  Cloudflare R2 (checksums verified on read-back) and all 25 lesson mp4 paths ever committed (incl. old pw-* 720p copies)
  were purged from the whole git history (filter-branch + force push 09.11; old commits may stay reachable on GitHub by
  exact SHA until GitHub's GC — GitHub Support can purge). Only covers, -p3 previews, 5-s -intro.mp4 and -sb.jpg strips
  remain in v/. New lessons go to R2 or Kinescope via the admin (the sandbox can't reach workers.dev). Never commit a
  full lesson mp4 to the repo again (it is public).
- (old) Adding a lesson: encode to 720p H.264 60fps CRF 26 (`-preset veryfast`), cover jpg 480px wide from 2s,
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
  Owner 31.10 19:22: the animation (then 60 % opacity over the cover jpg) over the loading video's picture looked
  messy ⇒ the overlay is now only the -p3 animation at full strength on solid #0B0B0C (no jpg, nothing of the video
  behind); the spinner is small (28 px) in the top-right corner (fullscreen: below the top bar).
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
  timeline + «3 сек / Скорость / ▶ / Зеркало / Повтор», each round icon with a caption (`.fsk`). Top bar over the video:
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
- Swipe UP = «Подробнее» (owner 31.10; first asked for down, then «поменяй местами»): in the vertical lesson view (fs-vert,
  also «only video») an upward drag on the video (lessonSwipe mode 3, decided like the side swipe: |dy| > 1.3·|dx|, not
  from .fstop/.fsbottom/edges) moves the video up (`.stage.pulling`, --sy = −0.6·dy, slight scale) with a chip
  «↑ Подробнее» (#pullLabel) fading in; past 18 % of the height or a flick (> 40 px fast: < 300 ms or > 0.4 px/ms) ⇒ `#fsInfo` click (lesson page, video
  keeps playing); otherwise springs back. Down drag: nothing.
- Swipe distances (owner 01.11.2026, iPad: «не работает свайп в Подробнее»): thresholds were shares of the screen
  (18 % height / 25 % width = 200+ px on iPad ⇒ springs back). Now `PULL_GO`/`SIDE_GO` = min(share, 100 px), flick > 36/45 px
  fast. In fsmode the stage is `touch-action:none` and touchmove is preventDefault'ed from the very first move (iOS Safari
  decides on the first move whether the page pans). Test with in-page TouchEvents on rAF (CDP touch is too slow for flicks).
- Loop buttons (owner 03.11.2026): «Повтор» (`#btnLoop`/`#fsLoop`) = the WHOLE lesson repeats (`P.repeat`, `setRepeat`), ON
  by default; the old 3-second loop moved to the round button left of ▶ / first in the fs panel (`#btnLoop3`/`#fsLoop3`,
  «3 сек», replaced «назад 5 сек» which is gone). openLesson: `setRepeat(true)` unless opened by a swipe (`navReplace`) —
  then the viewer's choice is kept. frame(): 3-s piece first (b capped at dur−0.05), else repeat ⇒ seekTo(0) at dur−0.05,
  else stop; `ended` does the same as a fallback.
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
- Slow motion is silent (owner 08.11.2026 «при 0.5 и 0.25 звук выключался автоматически без возможности включить»):
  `quiet()` = soundOff || P.rate < 1 drives `applyMute()` and `paintMute()` (which paints what is heard); at < 1x all sound
  buttons get `.snd-lock` (dimmed, aria-disabled) and `toggleSound()` only flashes + toast «На замедлении звук выключен — он
  вернётся на скорости 1x» (≤ once per 2.5 s); the saved choice `fedoskin-mute` is never touched by the slow-down; the
  speed handler calls applyMute + paintMute.
- Video file size: admin publishes via the Git Data API (MAX_FILE 70 MB). Most lessons are 1.5–7 MB (720p); short
  lessons moved from Kinescope are 1080p60 copies, ~20–35 MB.
- Short Kinescope lessons → GitHub (owner 31.10: «1080, 60 кадров, не урезай»): admin «Уроки» → card «Короткие уроки из
  Kinescope — на GitHub» (`#moveCard`, lessons with ks and dur ≤ 60): mediabunny copies the Kinescope HLS rendition with
  short side 1080 (or best below) + pairable audio into a faststart mp4 WITHOUT re-encoding, cuts its strip from the
  blob, one commit: v/<id>.mp4 + -sb.jpg, lessons.js without `ks` (dur from the file), intros.js entry and
  -intro.mp4 removed. Kinescope keeps its copy (owner may delete it there). Tested with fake HLS → 1080x1920, 60 fps, AAC.
- Videos on the phone (sw.js, 31.10): v/*.mp4 (not -p3) are downloaded ONCE whole by the service worker; player range
  requests, app preloads and the frame-cache build all read that one download (streamed 206 answers; a jump > 3 MB ahead
  of the download goes to the network). Finished files go to Cache Storage `fedoskin-video-1` (≤ the person's limit, default 1 GB, see «Память на телефоне»,
  oldest out; ETag/Last-Modified rechecked by HEAD at most hourly — a replaced video is dropped). Apple: the player's
  nothing goes through the SW (see the iPhone note below).
  App: `introSource` for GitHub lessons tries `fromSaved()` (caches.match → blob:) first, so a reopened lesson plays
  without internet. Neighbour preload now takes files ≤ 40 MB (MEM_TOTAL 100 MB). fcBuild without a memory blob:
  saved copy, or (non-Apple, SW controlling) fetch through the shared download; otherwise capture only.
  SW registers on https and on localhost (tests).
- iPhone «cover stays, time and sound run» (owner's screen recording 31.10, lesson CC at 0:08–0:11 showing the 2-s cover
  frame): on Apple the background frame-cache build (worker VideoDecoder during playback) is OFF (`fcBuild` returns when
  `isApple`; capture from the screen still works), memory caps lower (introMem 3 files / 60 MB, frame cache 40 MB).
  Watchdog (GitHub lessons): `vid` playing, readyState ≥ 3, t ≥ 1 s, but no rVFC frame for 1.5 s ⇒ reload the same src at
  the same time once per lesson (`wdLesson`). Tested: never fires in normal use; simulated no-frames ⇒ 1 reload, keeps playing.
  Still frozen on the owner's iPhone after that (17:48, «зависает на старте, зашёл из раздела») ⇒ everything new in
  video loading is OFF on Apple: sw.js does not touch any video request (`if (APPLE) return`), no `fromSaved()` (a saved
  copy as blob: was the prime suspect — played sound/time, drew only the poster). The watchdog reloads from the site URL
  when the stuck source is a blob:. loadVideo's async-source path clears the previous lesson's src first and playMain
  skips while no src (the old lesson used to play meanwhile).
- Back from sheets (owner's recording 31.10 17:57: on iPhone the phone's own edge back-swipe — iOS 26 web apps have
  one — from the language sheet went to an old Powermove section): every `.sheet-bg` and `#story` is a history step of
  its own (MutationObserver on `hidden` → pushState {…, ov:id}; closing by tap → history.back with `ovPop`; popstate
  with a sheet open just closes it). Language change / pull-to-refresh use `reloadClean()`: history.go(-navDepth) to the
  app's start entry, then reload; the screen to reopen goes via sessionStorage `fedoskin-restore`. popstate with
  navDepth 0 (an entry from before the app started) ⇒ home. Our iPhone edge swipe now also works over sheets (moves the
  sheet) and steps aside on touchcancel (the system took the gesture).
- First-run profile tip (owner 01.11.2026): `#profTip` (a .sheet-bg ⇒ own history step) after the install guide closes:
  dims the screen (`.tiphole` box-shadow spotlight on the Profile tab), bouncing arrow, «Заполни профиль» + «Заполнить»
  (→ Профиль + profile sheet) / «Позже»; tap on the tab = fill, elsewhere = close. Once (`fedoskin-prof-tip`), skipped
  if a nick is set; waits until home is shown with no sheet/full screen.
- Profile form step by step (owner 07.11.2026 «пошаговая инструкция… чтобы подсвечивались шаги»): `#profForm` fields are
  numbered steps `.pst` (1 Имя, 2 Страна, 3 Город) + progress bar `.psteps` + «Шаг N из 3» (`#pStepT`): the active step
  (focused field, else the first empty one) is orange with a pulsing ring and its hint `.phint` (NOT `.ph` — that class is
  the hatched placeholder background), filled ones get a green ✓, later ones are dimmed; all filled ⇒ «Всё заполнено —
  нажми «Сохранить»» + the save button pulses. Enter / keyboard «Далее» (enterkeyhint) moves to the next field.
  `openProf()` focuses step 1 when no nick yet. `paintSteps()`. Translated in 9 languages.
- Tablets (owner 01.11.2026 «приложение должно быть качественным»): CSS only at `(min-width:680px) and (min-height:560px)`
  (a phone on its side is never 560 tall ⇒ phones unchanged): .app up to 1180, sections 4 columns, lesson covers auto-fill
  176px, reading screens ≤ 760 centred, sheets = centred cards (handle hidden), fs buttons ≤ 620 wide. ≥ 960 wide: lesson page
  = 2 columns (`.lcol-a` player sticky — `body.fsmode .lcol-a{position:static}` or the fs video ends up UNDER the right
  column; `.lcol-b` title/text/«Ещё в разделе»), profile 2 columns (`.pcol-a/.pcol-b`), services 2 columns. Sideways tablet
  (≥900, aspect ≥ 5/4) vertical lesson: video full height, controls in a right panel `--vside` with name+meta (`.fsside`,
  copied by MutationObserver). `placeCorners()` sets `--cx` so .fscorner buttons sit at the video's edge. JS `TABLET`
  (screen's short side ≥ 600 + touch): no fs-rot, no orientation lock, no auto full screen on turning, «телефон» texts →
  «планшет»; iPad install guide: Share is in Safari's top bar.
- Visit counter (owner 01.11.2026 «посещаемость и охваты»; Metrika stays OFF): app `visitCounter()` → POST `/hit`
  {id: prof.id, p: ios|android|desktop|other, a: standalone} via sendBeacon (text/plain, no preflight), only on https,
  only after 30+ min away (`fedoskin-active` touched on hide/pagehide/every minute — NOT `fedoskin-seen`, that is the
  list of opened lessons for NEW badges; until 05.11 the counter overwrote it ⇒ NEW came back daily, old value migrated), skipped when `fedoskin-noping`='1'
  (admin sets it on load in its browser, switch «Не считать мои заходы»). Worker: D1 binding `DB` (KV's 1000 writes/day is
  too little), tables made on first call: hits(day: visits/uniq/fresh/app), seen(day,id) pruned, devices(id hash,first,
  country,plat), geo(day,country). Moscow days. GET `/visits` (admin) → today/all/30 days/countries/platforms. Admin
  «Статистика» → «Посещаемость»; old worker (404) or no DB ⇒ setup steps + «Скопировать код сервера» (fetches
  server/push-worker.js from Pages). Tested with node:sqlite as a D1 stand-in (sandbox can't install wrangler).
  «Обновить» (owner 06.11.2026 «чтобы было видно, что нажал»): icon spins + «Обновляю…», data dims (≥ 0.65 s), then
  «Обновлено ✓» green + toast with how many numbers changed (changed KPI numbers flash orange) + «Обновлено в HH:MM:SS».
- Admin chart «По дням» (owner 07.11.2026 «подробнее и анимированную при наведении курсора»): `drawChart()` (data kept in
  `lastVis`), period 7/14/30 (`fedoskin-admin-per`, default = smallest covering the data), tiles `#visSum` (average people/day
  over full days vs the previous period, best day, new + visits), bars per day: visits grey behind, people = new (accent) +
  returned (half accent), count on top (≤14 days), dashed y grid with nice steps, x labels with weekday (weekend tinted,
  today «сег.» hatched), 3-day average line (SVG in real pixels — a stretched viewBox broke the dash animation; redrawn
  on resize), grow-in animation (staggered scaleY) + line drawing, hover tooltip (date, weekday, people/new/returned/
  visits, visits per person, % vs the day before) with other columns dimmed; touch = tap. Admin «версия 16».
- Kinescope token on the phone (owner 07.11 «Токен вставлен, что не так?» — 401 on upload): `ksClean()` strips «Bearer », quotes,
  spaces/newlines from the pasted token; `#ksTokHint` shows the saved token as first4…last4 + length (password field — he
  can't see it); the 401 text says how to make a new token. iPhone home-screen admin has its own storage. Admin «версия 17».
- «Добавить видео»: the lesson name is NOT taken from the file name any more (owner 07.11 «оставь пустым, введу вручную»);
  the file-name field (id) still fills itself from the typed name. Admin «версия 18».
- Lesson order by drag (owner 07.11.2026 «стрелками неудобно, если роликов много»): admin «Уроки» rows have a grip `.grip`
  (6 dots, right side) instead of ↑/↓: pointer events from the grip (touch-action:none, pointer capture), the row follows
  the finger, other rows of the section slide by one step, auto-scroll near the top/bottom edge (bottom zone above the
  save bar), drop ⇒ the section's lessons are reordered in place (`dragStart/dragLay/dragTick/dragEnd`), row flashes +
  toast. Arrow keys on the focused grip still move by one (`move()`). Disabled while the search filter is used.
  Tested with mouse and CDP touch. Admin «версия 19».
- Squashed cover animations (owner 07.11.2026 «анимированная обложка … сплюснутая»): Baby love and Indian step were added
  from the iPhone; Safari ignored mediabunny's built-in `crop` (drawImage of a VideoFrame with a source rect) ⇒ the whole 9:16
  frame was squeezed into 360x480. admin `convert()` now does crop+scale itself when `video.crop` + width/height are given:
  mediabunny `process` callback (frames arrive already upright) → createImageBitmap → drawImage(crop) on a canvas,
  `processedWidth/Height`. Verified in Chromium on a normal and a rotation-metadata (iPhone-style) source: matches the
  <video> picture. Both previews re-cut with ffmpeg (Baby love from its 480p intro). Check: compare a -p3 frame with the
  source's centre 3:4 crop vs the whole frame squeezed. Admin «версия 20».
- Traffic sources (owner 05.11.2026: funnel = Instagram + Facebook, «400 подписок за день» — where do they go?): app
  `SRC` = first touch, saved in `fedoskin-src`: `?from=` (bio links ig/fb/yt/tg/tt) > in-app browser UA (Instagram, FBAN/FBAV,
  TikTok, Telegram) > referrer host > `direct`. Sent as `s` with every `/hit`; `sendEv('tg', svcId)` on «Написать в
  Telegram» → POST `/ev` (same gates as the counter). Worker: tables `src(day, src, kind, n)` — kinds visit/uniq/new/tg/tgu/
  svc:<id> — and `contacted(id)` (first tap per device ⇒ tgu); `/visits` returns `sources {all, today, contacted}`. Admin
  «Посещаемость» → «Откуда приходят люди»: per source new people (+today), people who wrote, % of new; «До подсчёта» =
  devices from before 05.11; old worker ⇒ «обновите код сервера» + copy button; tagged bio links with copy buttons.
  Tested: worker with node:sqlite on an old-schema DB, app UA/param detection, admin table on a phone.
- Ready texts for reels (owner 07.11.2026 «чтобы каждый раз не печатал»; then «в отдельную вкладку, не в статистике»):
  admin tab «Соцсети» (`data-pane="social"`): card `#ptCard` «Тексты для рилсов и постов» + card «Ссылки с меткой»
  (`#srcLinks`, `renderLinks()`, moved out of the sources card). Texts: switch Facebook / Instagram
  (`fedoskin-admin-pt`), groups (caption, pinned comment, end-of-reel on-screen text, bio, IG bio link), each English text
  in a simple + a slang version (owner's standing wish) with «Копировать». FB texts carry the tagged link `?from=fb`
  (clickable there); IG says «link in bio». Texts are editable in place, edits per device in `fedoskin-admin-posts`
  («Вернуть как было»). Templates = `PT` in admin.html. Admin «версия 15».
- Interest in online services (owner 07.11.2026 «отдельную статистику… сколько ей интересовались»): app `go('review')`
  sends `sendEv('sv')` when the person comes to the «Онлайн услуги» tab from another screen (not «back» from a service, not
  in the first 2.5 s = start-up restore); `openService(s)` sends `sendEv('so', s.id)` (`openService(s, true)` = quiet, used by
  the crypto restore). Worker `/ev` e=sv|so: table `evu(e, id, day)` (who did what which day) + `src` kinds sv / so /
  so:<id> and u:<kind> for the first time that day; tg also goes to evu as tg and tg:<svc>. `/visits` → `svc {days (30 d,
  [day, kind, n]), all, people {today, d7, all} = distinct ids per kind, since}`. Admin «Статистика» → «Интерес к
  онлайн-услугам» (`renderServices`, period today/7 days/all `fedoskin-admin-svper`): funnel tab → service page →
  «Написать тренеру» (+ crypto opened / «Я оплатил»), % of tab openers, % of all visitors; per-service table (opened /
  wrote / %); 14-day bars of people opening the tab. Old worker ⇒ «обновите код сервера». Tested: worker on node:sqlite,
  app events over a local https server, admin card on phone/desktop. Admin «версия 21».
  Owner couldn't find the copy button (07.11): stats now show a big orange banner `#wkNew` with its own «Скопировать код
  сервера» (`#wkCopy`) + steps whenever `/visits` lacks `sources` or `svc` (worker older than the admin); `#svCopy` in the
  services card too. Admin «версия 22».
- Calm coaching call in lessons (owner 08.11.2026 «не кричащий, спокойный призыв к действию с переходом на услуги»):
  lesson page card `#ctaCard` (pale transparent green — owner 08.11: rgba(59,209,111,.07) bg, .28 border, link #7BE3A0) under the description («Не получается? Федоскин поможет» — owner 08.11; en «Stuck? Fedosk1n will help», his nick in Latin = Fedosk1n / «Попробуй личный коучинг 1‑на‑1 с одним
  из опытнейших тренеров мира. / Онлайн-услуги →», owner's wording) and a small chip `#ctaChip` at the top of the video («Не получается? Федоскин поможет →»)
  (below the fs top bar) shown only when the person seems stuck: `ctaNote()` meter +1 per second played slowed (rate < 1) or
  in the 3-sec loop, +18 per full repeat (in frame()); at 40 ⇒ fades in for 9 s; once per lesson a day, ≤ 3 a day, «×» = no
  more today (`fedoskin-cta`); hidden on openLesson. Tap ⇒ pause, `go('review')`, `sendEv('cta', 'card'|'chip')`; shown chip
  ⇒ `sendEv('ctas')`. Worker kinds cta / ctas / cta:card / cta:chip; admin services card: row «Пришли из урока по призыву» +
  note with card/chip numbers. «1‑на‑1» uses non-breaking hyphens (U+2011) so the chip stays one line. Admin «версия 23».
- Share (owner 05.11.2026 «кнопку поделиться с другом»): lesson header right `#lessonShare` (link `?lesson=<id>&from=share`)
  and Профиль → «Поделиться приложением» `#shareApp` (`?from=share`) → `shareLink()` = navigator.share, else copy + toast.
  `share` is its own row («Поделились друзья») in admin sources. The «Приведи друга» card in the hidden promo tab is still a mock.
- Messenger choice (owner 07.11.2026: in the US few use Telegram): service page button `#tgLink` = «Написать тренеру» →
  sheet `#contactSheet` with Instagram (`ig.me/m/<ig>`, text copied + toast — IG can't prefill), WhatsApp (`wa.me/<wa>?text=`),
  Telegram, Messenger (`m.me/<fb>?text=`, only if `fb` set). Config keys `wa` (digits), `ig`, `fb` (admin «Настройки»;
  empty = not shown). Order: SRC ig ⇒ IG first; ru ⇒ TG first; SRC fb ⇒ Messenger first; else IG, WA, TG. `sendEv('tg', svc,
  m)` ⇒ worker kind `via:<m>`; admin sources card shows «Какой мессенджер выбирают». Service texts no longer say «в Telegram».
- Crypto payment (owner 07.11.2026, option 1 «свой кошелёк»): service page `#cryptoBtn` «Оплатить криптой (USDT)» — only
  non-ru UI (rubles there; RU law 259-FZ) and services with a $ price → `#cryptoSheet`: amount = service USD in USDT
  (copy), network USDT · TRON (TRC-20), QR drawn from the address by `vendor/qr.js` (own encoder: byte mode, ECC M, v1–10;
  verified 215/215 codes with OpenCV decoders), address + copy, warnings, «Я оплатил» → contact sheet with
  `openContact(text)` prefilled «Оплатил N USDT (TRC-20) за: …». Config key `usdtTrc20` (empty = off). Owner's wallet
  TAiZXgpruhXQTKcwshqo9mFLADgUNJXv3z. Admin «Настройки» → card «Оплата криптой» (owner «менять кошелёк самому, с
  подсказками»): state badge, field `#sUsdt` with live checks (base58check; recognises 0x/BTC/TON addresses; a seed phrase
  or private key is wiped and never stored), the setting changes ONLY for a valid address or empty (typo ⇒ old address
  stays), preview QR + first/last 4 chars, «Вставить из буфера», «Выключить», step-by-step + safety tips. Worker `/ev`
  e='cr' (opened) / 'crp' (tapped «Я оплатил») → admin sources card line «Оплата криптой».
  First-timer guide (owner 07.11 «понятны ли шаги, если ни разу не делали так»): the sheet is 5 numbered steps (app →
  network TRON «TRX/Tron» → address + copy → check «Receive amount» = price, exchanges deduct ~1 USDT → send + screenshot),
  `<details>` «Ни разу не платил криптой?» (exchange + ID check; buy USDT by card; Coinbase/PayPal/Cash App can't send
  TRC-20 — verified 07.11; own wallets need TRX for the fee) + «Задать вопрос тренеру». QR only behind a button on touch
  (useless on the same phone), shown at once on desktop. Open sheet remembered in `fedoskin-crypto` (1 h) and reopened
  on start — iPhone often reloads the app while the client is in his exchange app; closing it on purpose forgets it.
  Prefilled message asks to attach the transfer screenshot.
- Admin bottom bar on iPhone (owner 07.11.2026 screenshot: «Всё опубликовано» bar hung mid-screen over statistics —
  Safari keeps fixed elements shifted, e.g. after the keyboard): `stickBar()` (last script in admin.html) compares the
  bar's bottom with visualViewport bottom and translateY's it back only when they differ (> 2 px); hides it (`.kb`) while
  the keyboard is open. Checked on vv resize/scroll, scroll/scrollend, focusout and every 1 s. 10.11.2026 (owner: «плашка съезжает при скролинге вверх»): it never measures while the page moves (scroll /
  vv resize / touchmove / top bounce scrollY < 0) — waits for 250 ms of rest, then measures with the transform removed (no
  added-up error); a focused SELECT no longer counts as «keyboard open». Admin «версия 9» (12 since the crypto wallet card, 13: «Скопировать код сервера» works on the first tap — fetches + copies via ClipboardItem).
- Admin icon (owner 02.11.2026): admin.html has its own `admin.webmanifest` (id admin, start/scope admin.html, standalone),
  orange icons `icons/admin-{180,192,512}.png` (black logo + «АДМИНКА» band, Inter Black), status bar `black` (not
  translucent — avoids the iOS 26 short-viewport bug), og preview `icons/admin-share.png` 1200×630. On iPhone the
  home-screen admin has its own storage ⇒ the GitHub key is entered once more there.
- Share rating to Instagram stories (owner 31.10): opening the card (`openStory`) pre-renders a 1080×1920 PNG on a canvas
  (`storyImage`: same look as #storyCard — logo, avatar incl. its SVG, nick, alpha badge, minutes, 3 stats, CTA, and the
  app link pill `APP_LINK` = CFG.appUrl or the page URL). «Поделиться в сторис» (must stay synchronous for iPhone's
  user-gesture rule): copies APP_LINK to the clipboard, then navigator.share({files:[png]}) → phone share menu →
  Instagram → «История»; a web page can't add a link sticker, so the hint under the card (#storyHint) tells to paste the
  link into the «Ссылка» sticker. No file sharing ⇒ the PNG is downloaded + toast. The link is shown on the card too (#stLink).
- Subtitles (owner 03.11.2026 «субтитры под 8 языков»): speech recognised in the owner's Chrome (transformers.js 3.7.5,
  whisper-large-v3-turbo_timestamped, WebGPU; Kinescope HLS audio via mediabunny AudioBufferSink) → word timings
  committed to `subs/raw/<id>.json`. `python3 tools/subs_build.py cues` → `subs/work/<id>.ru.json`; Claude proofreads the
  Russian and writes `subs/work/<id>.tr.json` ({ru,en,es,pt,fr,de,ja,ko,zh}: one line per cue, same order, empty ru =
  dropped cue); `python3 tools/subs_build.py build` → `subs/<id>.json` ({ks, cues:[[a,b,{lang:text}]]}) + `subs.js`
  (`window.LESSON_SUBS`, valid only if ks matches). Player: CC buttons `#btnSubs`/`#fsSubsC`/`#fsSubsTop` → sheet
  `#subsSheet` (language or off), pref `fedoskin-subs` = JSON {c, app} — valid only while the app language is still `app`
  (owner 04.11: subtitles follow the app language; a choice made in another language is ignored); default = app language, off for ru. Glossary: гелик=windmill,
  флай=flare, твист=airflare, бочка/мачмил=munchmill, 99/наинтинайн=1990, спичак=handstand press (owner to confirm),
  промокашка=low windmill (to confirm). All 12 long Kinescope lessons done 03.11.
- Pull to refresh (owner 05.11.2026: canvas particle vortex «тормозит», then a plain ring «хочу анимацию на лого»): `#ptr`
  = logo layers: ghost (16 %), `#ptrInk` white logo revealed left→right by clip-path as you pull with a spray dot `#ptrCan`
  riding the edge; full = ready (pop + vibrate). Release ⇒ `.spin`: `icons/logo-paint.png` (orange-filled logo, made with
  PIL) rises through the letters from the bottom (clip-path loop 1.24 s) while the logo nods on a beat (0.62 s); ≥ 0.82 s,
  ≤ 4 s; `.done` = fully orange + pop ⇒ `reloadClean()`. Only transform/opacity/clip-path animate (60 fps in tests).
- The b-boy hero + levels (owner 10.11.2026 «человечек в хип-хоп стиле… промежутки значительно шире»; chose 8 levels up to
  100 h, flat cartoon, shown in profile / level-up screen / leaderboard / story): `hero.js` (`window.HERO`: LEVELS minutes
  [0, 60, 240, 600, 1200, 2100, 3600, 6000], NAMES + PERKS = Russian i18n keys, RING colours, `levelFor(mins)`,
  `svg(level, {uid, bust, bg, size})` — our own character, no brands; each level adds clothes: cap+kicks → black tee+track
  pants → orange track jacket+headphones → chain+shades → black bomber+high-tops → gold+boombox → champion belt, rays, fist
  up). index.html: `LEVELS = HERO.LEVELS`; profile `#heroCard` (hero + level + name + bar + «Ещё {t} тренировок — и новый
  образ: {perk}», `hmFmt`) → sheet `#heroSheet` gallery (locked = black silhouette + «Через {t}»); `#lvlUp` level-up screen
  (old look flashes into the new, rays, vibration, «Поделиться в сторис» → openStory) — `lvlCheck()` never over a lesson /
  sheet / story, not in the first 2.5 s, re-checked by go() after leaving the lesson; celebrated level in `fedoskin-lvl`
  (first run with the new levels just saves the current one — old 11-level users silently get the new, lower level).
  v2 detailed outfits (owner 10.11 «детальнее… заморачиваются над шмотками»): `fit` per level {hat, top, pants, shoe} — sneakers in
  profile (tread, midsole, toe cap, overlays, eyelets, laces, high-top strap), caps with panels/eyelets/flat brim + sticker, beanie,
  bucket hat, backwards cap with snap strap, rib collars/cuffs, zips, patches, rope chain; mirrored halves via `MIR()`.
  Leaderboard rows: `heroMini()` bust + level badge from the row's minutes (replaced the preset avatar there). Story card
  and the 1080×1920 PNG show the hero + «Уровень N · name». `window.fedoskinLevelUp(a,b)` / `fedoskinStoryImage()` for checks.
- Hero battles (owner 10.11.2026 «батлить друг с другом… ради интерактива»; audience = kids / bored viewers for reach;
  wins will later give points to buy hero accessories): leaderboard rows (only when `/lb` answers `bt: true`) get a «Батл»
  button `.btbtn` + «🏆 w–l» after the city. `btCall()` → worker POST /bt/call {id, secret = the rating's, to} (text/plain):
  both must be in the KV board; 3 judges vote at random, p(challenger) = 0.5 + 0.05·(level diff) clamped .3–.7; limits 15
  a day per phone, 3 a day vs the same person (429 ⇒ toast); D1 `bt` (n, a, b, la, lb, na, nb, seed, votes, win, t, seen),
  `bt_score (id, w, l)`, `bt_sub (id, sub, lang)`; the challenged phone gets a push at most once per 6 h (sw.js `battle` ⇒
  `?battle=1` / message open-battle). /bt/inbox → unseen battles + score; /bt/seen {n} marks n ≤ given; /bt/sub links the
  phone's push subscription (`btLinkPush`, once per endpoint+language in `fedoskin-bt-push`). /lb GET adds `bt` [w, l] per
  row + `mine`. App: `btPlay(battle, side)` = overlay `#battle` (.sheet-bg ⇒ history step): this phone always on the LEFT
  (orange), opponent right (blue); seed (mulberry32) picks moves/shouts so both phones see the same show: 2 rounds × 2
  turns (toprock .6 s + one of spin/mill/head/freeze/flare 1.9 s, crowd shouts), then 3 judges flip cards one by one,
  «Победа!» + confetti / «Поражение», «Судьи: 2 : 1», «Реванш» / «Закрыть»; «Пропустить» jumps to the judges. Incoming:
  `btInbox()` 4 s after start, on Profile, on push ⇒ sheet `#btCallSheet` «{name} вызывает тебя на батл!» → «Смотреть
  батл» / «Позже» (both mark seen); never over a lesson/sheet (re-checked in go()). Profile hero card `#btScore`. Server
  code must be updated by the owner (copy server code). `window.fedoskinBattle(la, lb, win, side)` replays a demo; the link `?battle=demo` shows one on any phone (no server).
  Cartoon v2 (owner 10.11.2026 «конечности отдельно… мульт на 12 секунд»): `HERO.svg(level, {rig: true})` = the same drawing cut
  into joint groups (`data-j`/`data-p` pivots: root, torso, head, shL/elL/shR/elR, hipL/kneeL/ankL/hipR/kneeR/ankR; pants and
  sleeves split at knee/elbow with clipPaths + a filler ellipse/circle; static output byte-identical — checked). `HERO.setPose
  (HERO.rigJoints(svg), pose)` sets rotate() per joint (limb angles «outward-positive», right side mirrored) + root
  translate/rotate/scale about (px, py). `HERO.MOVES` {dur, f(u)}: idle (crossed arms, nod), toprock, windmill, headspin,
  flare, sixstep, backspin, freeze, burn (points at the opponent), win, lose — each starts/ends standing. btPlay builds one
  timeline from the seed: round 1 = toprock + power, round 2 = power + freeze|burn, challenger first (~12 s), then judges;
  rAF sets both rigs every frame; events: camera `#btCam` zoom toward the dancer, other one dimmed, spin ring `.spinfx`,
  dust `.puff`, arena shake + «FREEZE!», crowd hype + shouts; after the verdict win/lose loops. Right fighter = CSS
  scaleX(-1). Headless ~30 fps with both rigs.
  Owner 10.11.2026 update: NO rematch button; ONE challenge per 30 min per phone (server `BT_REST`, 429 {error:'rest', rest};
  `#btRest` bar «Твой би-бой отдыхает» + time left, battle buttons hidden meanwhile; `fedoskin-bt-rest`), 3 a day vs the
  same person; being challenged doesn't tire you. Points + shop (owner: for retention, NEVER sold for money; losses give
  nothing): server-side wallet = 10 × wins + 20 × full hours of the rating's minutes − prices of owned items. `HERO.SHOP` in
  hero.js (10 items, one per slot: neon laces 80, fingerless gloves 100, cardboard 100, knee pads 120, bandana 150 (replaces
  the hat), graffiti wall bg 200, night city bg 200, red kicks 250, boombox 300, fire aura 500) — prices repeated in the
  worker `SHOP`, keep equal. D1 `hero_own (id, item)`, `hero_eq (id, eq JSON)`; POST /hero/buy {item} (402 if short),
  /hero/eq {eq} (only owned, one per slot); /bt/inbox returns pts/earned/owned/eq/rest; /lb rows + battle sides carry `eq`.
  App: `HERO.svg(level, {acc})`; `myEq` (`fedoskin-eq` copy) drawn in profile, level-up, story card + PNG, battles,
  leaderboard busts; profile row `#shopRow` (⭐ points) → sheet `#shopSheet` (preview of each item on my hero; Купить ·
  ⭐ N / не хватает / Надеть / Снять; buying wears it). Tested:
  worker on node:sqlite (auth, limits, self, inbox/seen, lb scores), app flow with mocked server (iPhone en).
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
- Rating moved to D1 (owner 10.11.2026 «сотни тысяч пользователей… все захотят батлить»; also a friend «много смотрел, а в
  рейтинге нет» — the single KV key was read-modify-written by everyone: lost updates between edge locations + KV free plan's
  1000 writes/day ⇒ people silently missing): D1 table `lb` (id, n, nl lower-case nick, c, cn normalised city, co, a, m, v, s,
  h, f, t, lvl, rk random, hid) with indexes (hid, m DESC, f) / (cn, hid, m DESC, f) / (lvl, rk) / (nl); place = 1 + COUNT of
  better rows; hiding sets hid = 1 (row kept for points/battles). `lbMigrate()` copies the old KV board once (flag KV
  `lb:mig`; the KV key stays as a backup); no DB ⇒ old `leaderboardKV`. GET /lb adds `big: 1`. New: POST /bt/find (random
  active phone (30 d) of level ±1…any via (lvl, rk ≥ random) not met today, then the normal /bt/call), GET /lb/search?q=
  (nick prefix, 20 rows, visible only), GET /lb/who?id= (name, level, eq for a friend's link). App (only when `big`): tools
  `#btTools` — «Найти соперника» `#btFind` (btCall(null)), «Вызвать друга» `#btFriend` (shareLink `?vs=<my id>&from=battle`),
  search `#lbQ` (results replace the list via `LBQ`); `?vs=` ⇒ `vsOpen()` sheet `#vsSheet` «{name} вызывает тебя на батл!» →
  «Принять вызов» turns «show me» on, `lbSend(0, true)` (joins even with < 1 min) and battles that id. Owner chose nick search
  despite my child-safety note (only nick/level/country shown, as in the rating). D1 at large scale needs Workers Paid ($5/mo).
- Leaderboard (30.10.2026): same Cloudflare worker (`/lb`, one KV key `lb`), URL = `pushUrl`. Phone id = profile id,
  random secret in `fedoskin-lb-secret`; server caps minute growth to real time and first claim to 300. Hidden until pushUrl set.
- iPhone home-screen app (iOS 26, WebKit 301108): the viewport is short by the status bar and nothing is drawn below it.
  Fixed by `@media (display-mode: standalone){ html{min-height:min(100lvh, calc(100% + env(safe-area-inset-top)))} }`.
  Don't push the menu below innerHeight (old «gapfix» did — labels got cut). Bottom-menu buttons: icon + 1 label line max.
- Re-cropping a Kinescope lesson's cover: in the owner's Chrome (Claude in Chrome) mediabunny reads the HLS
  (`UrlSource(master.m3u8)` + HLS_FORMATS); CanvasSink for the jpg, Conversion with `crop` + trim 0–3 for -p3.mp4;
  commit with the admin's GitHub key from that page's localStorage. Kinescope lessons may be 16:9 (landscape).
- Cloudflare R2 for lesson videos (owner 09.11.2026 «чтобы я мог сам выгружать на выбор и туда тоже»; «не переноси туда
  ничего» — existing lessons stay where they are, the owner moves/uploads himself). Admin «Добавить видео» → 3rd destination
  «Cloudflare R2» (`fedoskin-admin-dest`='r2'): optional compression (720p/1080p without the GitHub 60 MB cap, or as is) →
  multipart upload in 16 MB pieces (XHR, 3 tries each) to the worker: POST /r2/mpu → PUT /r2/mpu?n= → POST /r2/done
  (abort on error/cancel); admin auth = GitHub token as for /stats. Lesson gets `r2` = file name (`<id>-<random>.mp4`, new per
  upload ⇒ immutable caching). Worker: binding `VIDEOS` (bucket fedoskin-video), GET/HEAD /v/<file> with Range → 206,
  CORS (Range allowed, Content-Range exposed), GET /r2/usage (bytes/count/files), DELETE /r2/obj. No binding ⇒ 409
  {error:'no-bucket'}; old worker ⇒ 404 — admin shows the setup card `#r2Setup` (bucket, binding, copy server code,
  «Проверить»). Deleting a published lesson removes its R2 file after «Опубликовать»; an unpublished one at once. Stats KPI
  shows R2 usage; edit card «играет из Cloudflare R2». Strips: stripSrc = 'r2:<file>' (app `sbFor` matches it).
  App: `fileFor(l)` = `${CFG.r2Base || CFG.pushUrl}/v/<r2>` else v/<id>.mp4; mediaFor/openLesson/watchdog use it;
  cross-origin file ⇒ `vid.crossOrigin='anonymous'` (frames can be captured for the frame cache); sw.js also keeps
  cross-origin https /v/*.mp4 (and localhost for tests). Tested: worker with an in-memory R2 (ranges, 416, multipart,
  delete, auth), admin upload of a 29 MB file (2 pieces, byte-identical), app playback Android/desktop via SW + frame
  cache, admin strip cutting reads the R2 file by ranges. Admin «версия 24».
- «Память на телефоне» (owner 09.11.2026 «кнопку очистить кэш… ограничения как в телеграм, не более 5гб»): Профиль → row
  `#storeItem` (shows used size) → sheet `#storeSheet` (a .sheet-bg ⇒ own history step): used MB/GB + bar vs the limit,
  limit seg `#storeLimits` «Не хранить / 500 МБ / 1 ГБ / 2 ГБ / 5 ГБ» (default 1 GB) written by the PAGE to cache
  `fedoskin-vcfg` key `vlimit.json` (resolved against the app folder = SW scope) — sw.js `getLimit()` reads it, `save()`
  skips files over it (0 = keep nothing), `trim()` drops oldest-saved first (count cap 500); list of saved lessons grouped
  by lesson (`stLesson`: v/<id>.mp4, -intro, or r2 file name) with sizes and × per lesson; «Очистить всё» asks on the same
  button (2nd tap within 4 s, no confirm()). Page changes the cache itself and posts {type:'vcache', cmd: limit|drop|reset}
  so the SW re-reads the limit and forgets in-memory copies. Apple: nothing is saved there ⇒ note `#storeApple`, limit
  hidden. sw.js recheck drops a copy whose file is 404/410 on the server. 17 new i18n keys. Tested (Pixel 7 / desktop en /
  iPhone): sizes, limit 0 ⇒ nothing saved, 500 MB, × on one lesson, clear all, back closes the sheet.
- Closed video links (owner 09.11.2026 «ссылки на видео открытые… исправь это сейчас»): R2 videos need a pass. Worker
  GET /pass (only when Origin/Referer is https://fedosk1n.github.io or localhost) → {p: "<exp base36>.<HMAC-SHA256 32 chars>",
  exp} valid 24 h, secret `vpass` in KV made on first call, nothing stored per pass; GET/HEAD /v/<file>?p= without a valid
  pass ⇒ 403 (with CORS). App: `getPass()` (localStorage `fedoskin-vpass`, renewed in the background when < 12 h left),
  `fileFor` appends ?p=; `introSource` waits for a pass when there is none (offline: falls back, the SW copy plays);
  sw.js saves/serves under the address WITHOUT the query (startDl fetches req.url with the pass), fromSaved uses
  ignoreSearch. Admin: `r2GetPass()` in r2Check, `r2Url` appends it (strips, «Смотреть»). The «Короткие уроки из Kinescope»
  card now moves into R2 (not GitHub); the add-video GitHub choice warns that GitHub files are public. Limits (honest):
  anyone who opens the app can get a pass — this stops shared/permanent links and «download everything from GitHub», not a
  determined scraper; real protection = accounts + subscription check (plan in the Project doc
  claude/fedoskin-content-protection.md). Tested: forged/expired/missing pass 403, ranges with pass, app playback + SW copy
  offline, admin upload and strip cutting with pass.
- iPhone R2 fix (owner 09.11.2026 «видео не воспроизводится», R2 lesson stuck on the big play button; a check page in
  Safari showed pass, ranges and direct R2 playback all fine, with and without crossorigin): the video's address is now set
  only through `setSrc(el, u)` — crossorigin="anonymous" ONLY for a direct R2 address (starts with R2_BASE), never for a
  blob: copy from `introMem` (neighbour preload) or anything else; Kinescope removes it. NOTE: the owner found it playing
  again BEFORE this fix was deployed ⇒ the real cause is unconfirmed; most likely his home-screen app still ran code loaded
  before the worker started requiring passes (no ?p= ⇒ 403) and got fresh code on reopening. The blob/crossorigin guard is
  kept as a precaution. If it recurs: ask how the lesson was opened (section / swipe / search) and whether the app was reopened.
  Recurred 09.11 15:03 (whole Tricks section stuck on ▶, mid-deploy of 15:05): R2 files, pass, ranges, moov-first and codecs
  all checked fine (same as Freezes); fully closing + reopening the home-screen app fixed it ⇒ stale code on the phone.
- «Новые уроки» row order (owner 10.11.2026 «редактировать последовательность роликов»): config key `newRow` = lesson ids in
  the owner's order; app `paintNewRow()` shows those (hidden/deleted skipped), empty/none ⇒ 10 newest by `added`. Admin
  «Уроки» → card `#nrCard` (folded by default, `fedoskin-admin-nr`; summary of the first 3): rows with the same drag grip as
  the lesson list (dragStart handles `data-nr` rows), × removes, «+ Добавить урок в ряд…» puts one first, «Вернуть по дате»
  deletes `newRow`. A lesson added via «Добавить видео» goes first in a manual row. Save bar item «порядок в ряду «Новые
  уроки»» (newRow is left out of normCfg). Admin «версия 27».
- Usability pass (owner 09.11.2026 «переделай все это»): home row «Новые уроки» (`#newHome/#newRow`, `paintNewRow()`:
  10 newest by `added`, repainted on going home after a lesson was seen — `newRowDirty`); section tiles say «N новых»
  (1 новый); NEW pill sits on the lesson cover (`.covernew`). Tab «Онлайн» renamed «Коучинг» with a chat icon. Lesson page:
  one row of round captioned buttons `.pkrow` like the fs panel — «Цикл 3 сек» / «Скорость» (#btnSpeed cycles 1→0.5→0.25,
  #speedSeg kept hidden) / ▶ / «Зеркало» / «Повтор»; old tool grid hidden. Service cards: «Написать тренеру» (opens the
  contact sheet straight away) + «Подробнее». Profile: compact alpha card, settings list right under the stats, empty nick
  shows «+ Добавить имя». Install guide no longer pops up on the very first start: `installWanted` → shown after the first
  lesson watched ≥ 8 s, on returning from it (`installAfterLesson`); profile tip only after 2+ lessons seen.
- Loading bar on the video (owner 09.11.2026 «шкалу загрузки в сам ролик… процесс загрузки в кэш»): `.track .load`
  (`#loadBar`, `#fsLoadBar`) = light layer under the orange line; label `#tLoad`/`#fsLoad` between the times: «Загрузка N %» →
  «✓ Сохранён на телефоне» (5 s after finishing, 2.5 s if already saved; «Загружен целиком» when the limit keeps nothing).
  `ldStart(l)` in openLesson, `ldTick` polls every 0.5 s (3 s once complete): Android/desktop ask sw.js by MessageChannel
  `{type:'vprog', url}` → {st: dl|saved|done|none|off, got, total} (sw `progress()`, `fin` map of finished downloads,
  `save()` returns whether it kept the file; old SW = no answer in 0.8 s ⇒ fallback). Fallback / iPhone / Kinescope: the
  player's own `buffered` ranges (bar; label only while it grows, non-Kinescope). Tested with a 1.2 MB/s server.
- VPN hint for Russians (owner 09.11.2026 «плашку для русских над видео с r2 "может понадобиться впн"… когда видос не
  прогружается»): `#vpnChip` (same look as #ctaChip, top-left of the video) «Видео не грузится? Может понадобиться VPN» —
  only when LANG === 'ru', only for R2 lessons (no ks), shown after 6 s of wanting to play (P.playing, page visible) with no
  playing picture, or at once on a video error from an R2 address; hidden on `playing`; «×» = off until the app is reopened
  (`vpnOff`). `vpnArm(l)` in openLesson. Text is set in JS for ru only (no i18n key needed). Tested headless: blocked /
  hanging server ⇒ shown (2 s / 5 s), working ⇒ never, en UI ⇒ never.
- Coaching tab pass (owner 09.11.2026, points 1–5 «как видишь», 7 «строгий стиль, без лишних обещаний»): NO title / description on top (owner 09.11 «пусть всё
  начинается с меня») — the tab opens with the coach card; coach card `.coachcard` (photo `icons/coach.jpg?v=2` = owner's red-light handstand photo 09.11, circle crop, name «Федоскин»/Fedosk1n, role, YouTube youtube.com/fe_dosk1n + Instagram from CFG.ig, tiles 28 years in breaking /
  19 coaching / 11 countries — owner's own facts; add titles/reviews when he gives them); NO «Рекомендую» badge (owner 09.11: it read as «don't
  bother with the $1000») — every card has a `fit` line «для кого» (`.fit`: Разово разобрать элемент / Стабильный прогресс
  по одному элементу / Для тренеров / Подготовка к крупным соревнованиям), all write buttons `.btn-line`; full coaching =
  `prem: true` ⇒ quiet gold look `.svccard.prem`, short + body say «Количество элементов не ограничено» and «Отлично подходит
  для подготовки к крупным соревнованиям: полное сопровождение до выхода на батл» (owner's words); NO 20-min video calls in full coaching (owner 09.11 «уберём их, сейчас неприемлемо») — don't promise calls anywhere; `#svcStart` hint (intl only) under the cards; «Как это
  работает» `#svcHow` 4 steps (write → discuss, free → payment agreed in chat (+USDT intl; ru «Реквизиты пришлю в чате») →
  answer/first task within reviewHours); `#svcHours` = only intl «Переписка — на твоём языке» (owner 09.11 removed the reply-time line there; the online-
  coaching rule about reply hours removed too — «decide after the first sales»; `HRS` kept for later) (owner 09.11: he chats in the client's language and translates both ways). Consultation (intl) =
  breakdown of the person's video in text with screenshots (owner: «консультация это и есть разбор видео»), «за 1 видео»,
  video requirements, `['go', text, 'online']` body item = tappable link to another service. Service page: «Оплата — после
  того, как обсудим задачу.»; crypto button `.btn-crypto` (green-tinted, no longer looks disabled).
- Student reviews (owner 09.11.2026 «куча отзывов… на всех 8 языков, подумай где раздел»): `reviews.js`
  (`window.REVIEWS_DATA`, strict JSON: id, n {ru, lat}, d, s [rv|online|coach|full], t {ru original + 8 translations}) —
  20 reviews from his VK group (screenshots 09.11; Ivan Alekseevich had no text ⇒ skipped). Names = first name + surname
  initial (Latin outside ru), no photos. Translations faithful (Fedor stays «Fedor»; флаер=flare, гелик=windmill,
  спичаг=press to handstand). Coaching tab: `#rvHead` + row `#rvRow` of `.rvcard` (first 10, clamp 6 lines, + «Все отзывы
  (N) →») between the coach card and the prices; tap ⇒ sheet `#rvSheet` (.sheet-bg ⇒ own history step) with all reviews,
  scrolled to + flashing the tapped one, non-ru «Показать оригинал / перевод» per review; NO note about VK or «переведено с русского»
  (owner 09.11 «отзыв есть отзыв» — the reviews are real, the translation is ordinary localization); service page `#svcRv` = up to 2 reviews tagged for that service (consult/review ⇒ rv) above
  «Написать тренеру» (`rvForService`). Order in the file = display order (strongest first). NO dates shown (owner 09.11; `RV_SHOW_DATE = false`, `d` kept in the data). Code sits BEFORE openService
  (const REVIEWS — TDZ if openService runs first).
- Reviews from paying clients only (owner 09.11.2026 «оставить отзыв может только клиент, который оплатил»): no payment
  system yet ⇒ the owner confirms payment himself: admin tab «Отзывы» (`data-pane="reviews"`, admin «версия 25») → «Создать
  ссылку» (service + private note) → worker POST /rv/invite → one-time code (10 chars) → link `<app>/?review=<code>` + ready
  messages (English simple + slang, Español, Português, Русский) to paste in the chat. App: `?review=` (startup, URL cleaned)
  ⇒ Коучинг tab + sheet `#rvFormSheet`: GET /rv/inv checks the code (bad / used ⇒ message), stars + name (prefilled from the
  profile nick) + text, draft kept in `fedoskin-rvdraft` per code; POST /rv/submit (text/plain, no pre-flight) burns the
  code atomically (UPDATE … WHERE used = 0) and stores {name, stars, text, lang = app language, country = Cloudflare
  cf.country} in D1 `rv_sub` (status new/ok/no); `rv_inv` holds the codes. Admin list (GET /rv/list + current reviews.js):
  «Опубликовать» = own commit putting {id: 'c-<subId>', n {ru, lat} = name, d, s [svc], st, cc, o = lang, t {o: text}} at the
  TOP of reviews.js + /rv/set ok; «Не публиковать» (2-tap) = no; «Убрать из приложения» removes it; unused links listed
  with show / delete (/rv/delinv). App shows client reviews in their own language until translated (rvText falls back to
  t[o]; «Показать оригинал» only when a translation exists), flag after the name on cards, flag + country name in the sheet,
  ☆ for < 5 stars. To translate later: add t[<lang>] for the other 8 languages in reviews.js. Old worker ⇒ admin banner
  `#rvOld` with «Скопировать код сервера» (reuses #visCopy). Tested: worker on node:sqlite (invite, check, short text,
  double submit, delete), app form en/es (validation, done, used, bad link), admin create → client submits → publish →
  app shows it first with 🇪🇸.
- Chat with the coach through Telegram (owner 09.11.2026 «клиент работает в интерфейсе приложения, я ему отвечаю в тг»;
  messengers stay as the backup): app screen `#chat` (Коучинг → coach card «Написать в чат» `#ccChat`, and the first item
  «Чат в приложении» in the contact sheet, prefilled with the service text) — shown only when GET /chat/on says the bot is
  connected. Thread = random `fedoskin-chat-id` + `fedoskin-chat-key` (server stores only hashes); name asked once
  (`fedoskin-chat-name`); text POST /chat/send, photo/video POST /chat/file (≤95 MB, R2 `chat/<thr>/…`); poll /chat/get every
  4 s while the screen is open (`chShown`/`chatHidden` from go()), 60 s in the background + unread dot on the tab; messages
  cached in `fedoskin-chat`. Note in the chat: iPhone not on Home Screen ⇒ install hint, else «Включить» notifications;
  POST /chat/push links the push subscription so replies arrive as a push (sw.js opens `./?chat=1`).
  Worker: tables chat_thr / chat_msg / chat_map; bot token = Cloudflare secret `TG_TOKEN` (owner puts it there himself —
  NEVER ask him to send it); admin «Клиенты» → card «Чат с клиентами через Telegram» → «Подключить» (/tg/setup sets the
  webhook with a secret in KV tg:hook, gives a /start link that binds the owner's Telegram as KV tg:owner) → «Проверить»
  (/tg/status). To the owner: «💬 Name 🇺🇸 · service · lang · #id»; media as photo/video (big ones as a 30-day signed link).
  Owner answers by REPLYING to a client's message (text/photo/video) ⇒ saved + web push + 👍 reaction; a non-reply gets a
  hint. Client media URLs are signed (/chat/m/<key>?s=). 30 messages/hour per thread. No reply-time promise in the chat
  header (owner removed those). Tested with a fake Telegram API (node:sqlite D1, in-memory R2/KV). Admin «версия 26».
  iPhone home-screen fix (owner 10.11.2026 screenshot «некуда вводить текст»: the chat sat ~60 pt lower and the input bar
  fell below the drawn area): `#chat` is now position:fixed to the whole screen; `chFit()` only moves/shrinks it to the
  visualViewport while the keyboard is open (`.kb`, vv.height < innerHeight − 120).
  Pull mode (10.11.2026, live setup failed: setWebhook «bad webhook: Failed to resolve host» — Telegram couldn't resolve
  fedoskin-push.fedosk1n.workers.dev although public DNS answers fine): /tg/setup falls back to deleteWebhook + D1 table
  `tgs` (mode hook|pull, off, lock, cron); `tgPull()` = getUpdates → `tgUpdate()` (the same handler the webhook uses), offset
  saved before handling (no doubles), one pull at a time via a conditional UPSERT on `lock`, ≥3 s apart from /chat/get
  (the open chat polls every 4 s ⇒ replies in seconds), gap 0 from the admin's «Проверить» (/tg/status — also binds the
  owner after Start) and from the Cron trigger (`scheduled()`, owner adds «* * * * *» in Cloudflare; status `cron` = a tick
  within 5 min). Without cron, a closed app gets the reply (and push) only on the next pull. Admin «версия 28»: `#tgPull`
  explains the mode + cron steps. Tested on a fake Telegram (srv3: failing setWebhook, getUpdates queue, /__cron).
  Topics (owner 10.11.2026 «от всех клиентов в один общий чат — неудобно»): with BotFather → Open (mini app) → bot → Bot
  Settings → «Threaded mode» on, `chatTopic()` creates one topic per client in the owner's bot chat (Bot API 9.4
  createForumTopic in private chats; name «Mike 🇺🇸 · service»; D1 `chat_top (thr, top)`) + an intro message; client texts /
  media go there without the header; the owner just writes in the topic (tgUpdate maps message_thread_id → thread, then
  falls back to Reply mapping). Deleted topic ⇒ recreated on the next client message. createForumTopic failing (mode off)
  ⇒ old single chat with header + «Reply», retried after 10 min (tgs 'notop'). Admin «версия 29»: card explains enabling.
  /tg/status returns `topics {on: getMe.has_topics_enabled, err: last createForumTopic error (tgs 'notopErr')}` and resets
  'notop' (so «Проверить» makes the next client message retry at once); admin `#tgTop` shows it. Admin «версия 30».
  Live 10.11 11:49–11:51: owner's first messages came without topics (cause unknown yet — threaded mode maybe switched on
  after the first try, cached 10 min); his Reply on the header message worked (👍).
  Translator (owner 10.11.2026 «оригинальный текст, затем перевод… я пишу на своём языке, ему приходит только на его»):
  Workers AI binding `AI` (owner adds: worker → Settings → Bindings → Workers AI, name AI), model @cf/google/gemma-3-12b-it
  (free 10k neurons/day ≈ 400+ short messages). Client text/caption → `trNote()`: model returns «<iso>\n---\n<Russian>»;
  the coach sees original + «🇷🇺 перевод»; the detected language is kept in tgs 'tl:<thread>' (fallback app language).
  Coach's text with Cyrillic → `trOut()` into that language; the client gets ONLY the translation (also in the push); the bot
  answers in the topic «↪️ Клиент получил (англ): …». «!» at the start = send as is. Translator error ⇒ NOT sent + warning.
  Russian clients: nothing translated. Glossary: move names stay English (TR_RULES). No binding ⇒ as before. /tg/status
  `ai`; admin `#tgAi` = status or setup steps. Admin «версия 31». Tested with a fake AI (srv3); real gemma output untested.
  Hints (owner 10.11.2026 «сделай подсказку в админку или в бота» about «!»): bot command /help (also /памятка; menu set
  once via setMyCommands from /tg/status, tgs 'cmds') = `TG_HELP`; a new topic's intro mentions translation + «!» + /help;
  the first «↪️ Клиент получил» per thread adds «Без перевода — начните с «!»» (tgs 'trhint:<thr>'). Admin card: always
  visible «Памятка» box. Admin «версия 32».
  Live 10.11 12:16: topics fail with «BOT_TOPIC_WRONG_HOME» = Telegram-wide outage since 09.11 ~15:00 UTC
  (github.com/tdlib/telegram-bot-api/issues/944, open) ⇒ fallback to the single chat works; on WRONG_HOME the retry waits
  6 h (refused tries may leave ghost topic notices); admin explains it. Translation did not show (cause unknown) ⇒ aiRun
  accepts {response} and OpenAI {choices}, strips ``` fences; trIn parses leniently («**es**», «Language: es»); errors go to
  tgs 'trErr' (status `trErr`); admin «Проверить переводчик» → POST /tg/trtest (raw answer + parsed + reply direction).
  Admin «версия 34» (banner «Код сервера устарел» also when the server lacks `trErr`).
  Live 12:22: «5018: This account is not allowed to access @cf/google/gemma-3-12b-it» ⇒ `TR_MODELS` chain (mistral-small-3.1
  → llama-3.3-70b → gemma-3-12b → llama-3.1-8b-fp8-fast), first that answers is kept in tgs 'trModel', refused ones (5018 /
  not found) skipped for 24 h in 'trBad'; all refused ⇒ m2m100-1.2b (no detection: thread language / 'en' as source).
  /tg/trtest returns `model`; admin shows «Переводит: …». Admin «версия 35». 10.11.2026 (owner: no copy button on «Статистика»): always-visible «Скопировать код сервера» `#visCopyTop` next to «Обновить»; /visits returns `bt: 1` and the `#wkNew` banner also shows when the server lacks it (battles/points/shop). Admin «версия 36».
