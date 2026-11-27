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
  desc {ru,en,es,pt,fr,de,ja,ko,zh} = lesson description (13.11.2026, owner «делай»: the lesson page showed the placeholder
  «[Описание урока…]» to everyone) — app `#lessonDesc`: own language, else en (non-ru), none ⇒ hidden; admin lesson card «Описание
  по-русски / по-английски» + «Описание на других языках» (toast when ru changed but translations stayed; admin «версия 47»).
  The 14 lessons with subtitles got descriptions drafted by Claude from the subtitles (move names in English); short clips have none.
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
  Saved lessons (owner 11.11.2026 «чтобы анимационная обложка не пыталась влезть перед просмотром, если ролик уже загружен на
  телефон»): openLesson → `coverOrNot(l)`: in memory (introMem) / Kinescope pieces saved (ksSaved) / the file in Cache Storage
  (caches.match(vKey(fileFor(l))), answer awaited ≤ 0.2 s) ⇒ NO -p3 cover, `quietStart` = only the small spinner if still not
  moving after 0.9 s; otherwise showLoad as before. Tested headless: saved ⇒ no cover frames, not saved ⇒ cover as before.
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
  Row playlists (owner 11.11.2026: from «Новые уроки» a swipe said «последний урок раздела» although the row had more): cards
  know their row (`lessonCard(l, list)`; paintNewRow passes its list) ⇒ `openLesson(id, {list})` sets `curList`; a swipe
  (navReplace) or a history restore (`{keep:true}`) keeps it, any other open clears it. `lessonList()` = curList or the section —
  used by swipe neighbours, the peek prime and openLesson (meta «Новые уроки · урок n из m», `#nextHead` «Ещё новые уроки»,
  near preload). End chip «Это последний/первый из новых уроков»; swipe-down / edge-back labels say just «Назад» (back goes
  home). Tested: row swipes 1→2→3, last ⇒ chip, a section still walks the section.
  Stacked picture (owner 11.11.2026 screenshot: swiping «Новые уроки» from a vertical to a landscape lesson in the vertical
  view showed the neighbour's cover zoomed above and below its frame): `.swpeek` background is now `#0B0B0C center/contain`
  (was cover), and the cover jpg is dropped (`backgroundImage none`) whenever the real first frame is there (memory blob at
  swipe start, or the peekhold canvas copy). Landscape lessons reached by swipe stay in the vertical view with black bars.
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
- Swipe DOWN = back to the section (owner 11.11.2026 «при свайпе вниз… возврат в раздел»): in ANY full screen (fs-vert, only-video,
  landscape fs, fs-rot — uses the picture's own down via pt()) a downward drag (lessonSwipe mode 4, same decision as mode 3)
  moves the video down (`.stage.pulling`, --sy = +0.6·dy) with #pullLabel «↓ Назад к разделу <section>» (`#pullLabel b` set to ↑/↓
  per mode); past PULL_GO or a flick ⇒ `leaveToSection()`: a full screen opened from the lesson page has its own history step ⇒
  history.back() first, then (once popstate) `#lessonBack` click; otherwise exitFs() + `#lessonBack` (= goBack / openSection).
  The lesson page itself (not full screen) keeps up/down for page scrolling. Tested with in-page TouchEvents: vertical lesson
  160 px ⇒ section, 30 px ⇒ springs back, landscape fs from the page (2 steps) ⇒ section, fs-rot ⇒ section.
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
- See-through controls in landscape full screen (owner 11.11.2026 «сильно прозрачных кнопок управления, можно без шкалы…
  без тапания на экран»): `#fsGhost` = column on the right of the stage, shown only while the landscape panel is hidden
  (`fsmode.fs-hide:not(.fs-vert)`): Цикл 3 сек / Скорость (text 1x/0.5x/0.25x) / ▶❚❚ / Зеркало / Повтор / Звук, no captions,
  no timeline; buttons ~42 % white on 20 % black, switched-on = faded orange; a tap lights the button for 0.45 s. Each button
  clicks its panel twin (`data-for`), then puts `fs-hide` back (pause would otherwise bring the panel up); `syncGhost()` from
  syncFs + paintMute. `placeGhost()` sets `--gx` = middle of the black side bar beside the video (bar ≥ 62 px) else 10 px,
  never closer than safe-area-right + 4 (notch). Stage click handler and lessonSwipe ignore taps on it; the container is
  pointer-events:none (only the buttons catch taps). Subtitles in that state are narrowed (100 % − 150 px). Works in
  fs-rot too (stage is rotated, the column follows). Tested headless 844×390 and 390×844 rotated.
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
- Animated cover start (owner 11.11.2026 «сдвигать анимационную обложку… на пару секунд вперёд в админке»): lesson card
  `#pvBox` «Анимационная обложка»: current -p3 (`#pvNow`) + the frame at the chosen start cut to 3:4 (`#pvFrame`, mediabunny
  CanvasSink.getCanvas on the lesson's own video — `pvSrc(l)`: unpublished upload blob / Kinescope HLS (best ≤1080 track,
  `pvPick`) / R2 with pass / v/<id>.mp4), slider `#pvAt` 0…dur−3 (0.1 s) + ±0,5 с, «Сделать анимацию» = Conversion trim
  [start, start+3], crop+scale on a canvas (as convert()), 360×480, 30 fps, 600 kbit/s, no audio; «Картинку обложки — с того
  же кадра» (on by default) = jpg 480×640 from that frame, else the current jpg is fetched. Kept in uploads[id] {pvOnly: true}
  (list pill «НОВАЯ ОБЛОЖКА», save bar «анимация обложки», commit «анимация обложки: …»); lesson gets `pvAt` (start, admin
  only) and `cv` = remote cv + 1. App: `jpgUrl(l)` / `pvUrl(l)` add `?c=<cv>` so phones fetch the new files (Pages caches
  10 min, phones longer). Admin «версия 44». Tested headless with a colour-coded R2 test video (start 4.2 s ⇒ first frame
  blue, +2 s yellow, 360×480, 3 s). Kinescope HLS path not reachable from the sandbox — same reader as cutStrip/cutIntro.
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
- Order through the chat (owner 12.11.2026: «кнопка "чат с тренером" выглядит будто можно бесплатно решить свой вопрос… один уже так
  писал»; «её надо вместо кнопки на конкретной услуге, а выбор мессенджеров — доп. кнопкой»): the coach card has NO free-chat button; it
  offers the cheapest shown service `#ccOffer` («Разбор твоего видео» + price + «Заказать разбор» `#ccOrder`; tap on the text = service page).
  Service cards «Заказать», service page `#tgLink` «Заказать · $N` → `orderSvc(s)`: chat on ⇒ `openChat(orderText(s), s.id)` straight away
  (prefill «Привет! Хочу заказать: {s} ({p})» whenever the field is empty; sendEv tg/chat), chat off ⇒ the messenger sheet as before.
  Messengers = extra button `#svcMsgr` «Написать в мессенджере» (only when chat on) and the chat's order banner `#chatOrder` («Заказ: {s} · {p}» +
  «Оплата — после того, как обсудим задачу.» + «Удобнее в мессенджере?» `#chatMsgr`) → `openContact(text, noChat=true)`. Ordered service kept in
  `fedoskin-chat-svc`. `#ccChat` = «Переписка по заказу», only for phones that already wrote (chHas). Chat empty state «Опиши задачу… подтвердит
  задачу и пришлёт способ оплаты». «Как это работает» no longer says «Это бесплатно» (step 1 «Выбери услугу»).
- Push subscribers by day (owner 12.11.2026, after the team tee): worker /subscribe keeps the FIRST `t` and writes it into the KV key metadata;
  /stats returns {subscribers, subDays [[msk day, n]], noDate, tee (hero_own tee count), today} (old records read by value); /visits `sd: 1`.
  Admin «Статистика» → «Уведомления» `#pushDays` (`paintSubDays`): Сегодня / Вчера / 7 дней / с футболкой + 14-day bars. Phones that turned
  notifications off are not counted. Admin «версия 45». The owner must update the server code.
- Paid video courses (owner 12.11.2026 «раздел КУРСЫ… кнопку добавить курс… пока курсов нет — меню без курсов… место под ссылку на оплату
  (paypal)… продумай оплату и получение курса. Он будет чисто в видео формате»). Data: config.js `courses` = [{id /^[a-z0-9]{2,24}$/,
  n {ru,en}, d {ru,en}, tag {ru,en}, usd, pay (own PayPal link), hidden}] + `payUrl` (default PayPal link); course videos = lessons with
  `sec: 'course:<id>'` (+ `free: true` = preview anyone can watch), ordered like other lessons. Other languages fall back to EN texts.
  App: LESSONS excludes course lessons (no sections/search/«Новые уроки»/push); `C_LESSONS[cid]` copies with sec = course name + `course`
  in BY_ID. Tab «Курсы» (`TABS.splice`) and home block `#homeCourses` ONLY when a visible course has ≥1 video. Screens `#courses`
  (`.crcard`, old look) and `#course` (cover, desc, «Купить за $X», `#crLessons` lesson cards with `.llock` / «Пробный урок»); history
  state `crs`. Locked card / openLesson / swipe ⇒ `crsOpenBuy` (swipe list = only watchable). Buy sheet `#buySheet`: 1 order code
  (POST /course/order → «FT-XXXXX», copied also when tapping PayPal) 2 «Оплатить $X через PayPal» (course.pay || CFG.payUrl; none ⇒
  «напиши тренеру») 3 «Я оплатил» (POST /course/paid) ⇒ wait view; + crypto (curSvc pseudo-service), ask coach (chat/messengers),
  «Есть код доступа» → `#codeSheet` (POST /course/redeem; link `?ca=<code>`). Buyer = random `fedoskin-crs-id`/`-key` (server keeps the
  key's hash); state `fedoskin-crs` {own, pass, orders}; POST /course/my at start, on «Курсы», on visible, every 30 s while an order
  waits ⇒ toast «Курс открыт» + repaint. Video: paid course lesson ⇒ `fileFor` uses the COURSE pass `<cid>.<exp>.<sig>`; `?c=<cid>`
  opens a course; push `{course}` (sw.js) ⇒ `?c=` / message open-course. Events cb (opened buy) / cp (to PayPal).
  Worker: R2 files of course videos are `crs-<cid>-<id>-<rand>.mp4`; /v/ → `crsNeed()`: KV `crs` {c names/prices, open [free/moved-out
  crs- files], lock {file: cid}} ⇒ needs `cpassOk(p, cid)` (fail-closed for crs- prefix), else the normal pass; private cache. D1
  crs_dev / crs_ord (code, id, pid, course, usd, st new|paid|ok|no, t, tp, td, co, lang, name) / crs_own / crs_code. Telegram note to the
  coach on order and on «Я оплатил» (crsTell, if the bot is on). Admin endpoints /course/list|grant|deny|undo|code|delcode|sync|apass;
  grant pushes to the buyer's phone via bt_sub(pid). /visits `crs: 1`.
  Admin tab «Курсы» (`data-pane="courses"`, admin «версия 46»): how-it-works, PayPal link `#crPayUrl` (+ «Где взять ссылку»), course list
  `#crList` + sheet `#crSheet` (names/descr/tag ru+en, price, own link, show, videos ↑↓ + «пробный», «+ Добавить видео в курс» → Add tab
  with the course preselected, R2 forced, id prefix c..), orders `#crOrders` («Оплата пришла — открыть курс» / «Отклонить» / «Забрать
  доступ», funnel line), access codes with ready messages (EN simple + slang, ES, PT, RU). Lesson list groups «Курс «…»». Publish calls
  POST /course/sync BEFORE committing (paid course videos ⇒ refuses to publish when the server is old). Kinescope videos in a course are
  NOT protected (pill warns). Tested: worker on node:sqlite (31 checks: passes, order/paid/grant/undo, codes, funnel), app headless en
  (no courses ⇒ no tab; tab, home block, list, page, free preview plays with the normal pass, locked ⇒ buy sheet, paid ⇒ wait, grant ⇒
  toast + paid lesson with the course pass), admin with mocked GitHub (create course, pay link, add-video preset, orders, grant).
  The owner must update the server code; PayPal confirms by hand (no PayPal API yet — Lemon Squeezy / PayPal webhooks later).
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
  R2 lessons (11.11.2026, AIRCHAIR `tr-airchair` + Reverse 1990 `pw-reverse-1990`): recognised by Claude in the owner's Chrome on the
  admin page (same origin ⇒ worker /pass; mediabunny AudioBufferSink on the R2 file → mono → OfflineAudioContext 16 kHz →
  transformers.js 3.7.5 pipeline, whisper-large-v3-turbo_timestamped fp16/fp16 from the browser's transformers-cache, WebGPU,
  chunk 30 s / stride 5 s, word timestamps; 522 s took 92 s, 1020 s took 180 s), raw committed via the GitHub contents API.
  subs_build writes `r2` (file name) for lessons without ks; app subsInfo also requires x.r2 === l.r2. Glossary: чер = air chair
  (Whisper writes «черт»), реверс = reverse 1990, дрил = drill, складка = pike, верёвка = SIDE split / straddle (owner 11.11.2026: «поперечный шпагат»; ru subs say «поперечный шпагат»), складка = pike (owner: folding the body as close to the legs as possible), спичак = press handstand. subs.js `v` is bumped by hand after re-translating (build resets it to 1 — bump again).
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
  Cartoon v3 (owner 10.11.2026 «больше деталей, больше вариаций»): 34 moves in `HERO.MOVES` — walk-in, toprocks (toprock,
  kickstep, salsa, indian), power/footwork (sixstep, ccs, backspin, swipe, windmill, backflip, headspin, flare, airflare,
  ninety), freezes (freeze = baby, headstand, handstand, airchair, hollowback), taunts (burn, brush, comehere), watcher loops
  (idle, bounce, clap, nah) + shock, endings win/win2/win3, lose/lose2/lose3 (lose3 = respectful clap). Pools grow with the
  hero's level (`BT_POOL`/`BT_FRZ`: lvl 3 adds windmill/backflip/handstand/airchair, lvl 5 headspin/flare/airflare/1990/
  hollowback); a dancer never repeats a power move. Timeline in VIRTUAL time `vt` (`rate` < 1 = slow motion on freezes and at
  the backflip's top); poses cross-fade 0.16 s when a fighter's segment changes (`mix`); all random picks are made from the
  seed while building the timeline (same show on both phones). Details: move-name chip `#btMove` (international names),
  speakers `.spk`, spotlight follows (`.arena.on-l/.on-r`), white flash + stars + shake + vibration on a freeze, camera
  flashes + raised hands in the crowd on hype, shadow shrinks in the air, judges lean toward the dancer (`.judges.wl/.wr`,
  `.think`), fire aura / cardboard accessories as CSS on the fighter (`.fire`, `.cardb`). `fedoskinBattle(la, lb, win, side,
  seed)`; `?battle=demo` uses a random seed.
  Owner 11.11.2026: rest 30 → 15 min (server BT_REST, app BT_REST bar, text «раз в 15 минут»); the DJ's track slot stays 30 min
  (`DJ_SLOT`). Points for fresh lessons (owner «+10 очков тому, кто посмотрел НОВОЕ видео в течение первого часа после
  загрузки»): admin publish → POST /lesson/fresh {ids} (admin auth) → D1 `lfresh (id, t)` (INSERT OR IGNORE: re-publishing keeps
  the first time); GET /lesson/fresh (public) → lessons < 1 h old; app `freshLoad()` (1.5 s after start + on return after 10
  min) ⇒ gold chip `.lfresh` «+10 ⭐» on those covers; watched in one go ≥ min(30 s, 60 % of dur) ⇒ `freshTick` → POST
  /hero/fresh {lesson} (battle auth; 403 ⇒ lbSend(0, true) and retry; hidden from the rating ⇒ a toast, nothing forced) ⇒
  D1 `pts_bonus (id, ref 'fresh:<lesson>', pts)` once per lesson, server window 1 h + 10 min grace; wallet earned += SUM(bonus);
  toast «+10 ⭐ — ты посмотрел новый урок в первый час!»; local `fedoskin-fresh-got`. Shop sheet `.ptsinfo` «Как получить ⭐»
  (+10 win / +20 hour / +10 new lesson, loss = 0, not for money); shop row subtitle lists the three. /visits `pf: 1` (admin
  banner otherwise; admin «версия 39»). Tested: worker (admin only, claim once, late, republish), app (chip, claim after 30 s).
  Team tee for notifications (owner 11.11.2026 «шмотку за подписку на уведомления… без цены, с подписью «за подписку»»):
  HERO.SHOP item `tee` (slot top, price 0, `sub: true`, «Футболка Fedoskin team») — `fit.top = 'teeTeam'` replaces the level's
  top: white tee, orange round «FT» print + black band «FEDOSKIN TEAM» (SVG text with textLength), short white sleeves (also
  the raised arm at level 8 and the rig). Server SHOP tee: ['top', 0]; wallet() gives it (hero_own) whenever the phone has a
  `bt_sub` row (its push subscription linked — also existing subscribers); /bt/sub answers the wallet; /hero/buy tee ⇒ 402
  {error:'sub'}. App: shop lists `sub` items first; not owned ⇒ green card `.subit`, caption «🔔 За подписку на уведомления»,
  button «Включить уведомления» → window.fedoskinPushOn() (turnOn now returns true/false and calls window.fedoskinPushed) /
  already on ⇒ `teeAfterPush()` = btLinkPush(true) → tee owned ⇒ toast «Футболка Fedoskin team — твоя! 🎉» + worn at once;
  iPhone not on the home screen ⇒ install guide + toast. «Как получить ⭐» lists 🎁 the tee. /visits `tee: 1` (admin
  banner; admin «версия 40»), hero.js `?v=7`. Tested: worker (402 without sub, sub ⇒ owned, eq, old subscribers), drawings
  levels 1–8 + rig + bust, shop before/after (ru).
  Rare battle-deciding moves (owner 11.11.2026 «редкую анимацию… решающей в победе на "авто"… в 1 % батлов… стойки, вращения или
  акробатика… 3 разных»): HERO.MOVES r2000 (spin «2000»: inverted on stacked hands, V legs, accelerating 6 turns, legs open into a
  split), rflip (DOUBLE BACKFLIP, high, tucked, 720°), rhollow (ONE-HAND HOLLOWBACK, long hold, free arm out). `btRare(seed)` — same
  hash in index.html and push-worker.js (KEEP EQUAL): 1 seed in 100 ⇒ {side a|b, mv by (x>>>9)%3}; the worker's auto /bt/call then
  sets votes = [side ×3] (hand battles untouched). btPlay: shown only if win + all votes agree (older server ⇒ nothing); in round 2
  the rare dancer goes last and his finisher becomes the rare move: arena `.legend` (dim, gold spotlight), gold banner `#btLegend`
  «LEGENDARY MOVE» + name (`.long` 17 px for long names, no normal caption), gold spin ring (`.fighter.gold`), slow motion at the
  peak, double stars, gold rain, «UNREAL!/LEGEND!/NO WAY!»; winner keeps the gold glow; result line `#btResR` «Редкий приём {move}
  решил батл — такое бывает 1 раз из 100». Demo: `?battle=rare` / `rare1` / `rare2` / `rare3` (`window.fedoskinRare(k)`). hero.js `?v=8`.
  Tested: 2 M seeds ⇒ 1.007 %, sides/kinds even; worker on node:sqlite with a forced rare seed ⇒ votes bbb; demos ru 390×844.
  The owner must update the server code for the 1 % to happen in real battles.
  Mythic tier (owner 11.11.2026 «ещё 3 с вероятностью 0,5 %… красный фон и слегка трясущийся экран… вибрацию»): btRare also returns
  {myth: true} when x % 200 === 1 (disjoint from x % 100 === 0; worker formula updated the same way) ⇒ BT_MYTH rone (REAL ONE HAND —
  owner 11.11 «джекхаммер — элемент новичка… real one hand = airflare через 1 руку, самый мощный»: airflare turns over ONE arm, the
  other folded, legs in a wide V, accelerating, red spin ring), rcork (CORKSCREW: very high layout flip with a full twist, arms hugged),
  rplanche (PLANCHE: body flat in the air on straight arms, long hold). Arena `.legend.myth`: red spotlight + red-tinted floor,
  inset red glow, continuous tremble `mythq` (also after the peak shake: `.arena.myth.shake` chains both; off for reduced
  motion), red banner «MYTHIC MOVE», red glow `.fighter.red`, red rain, «INSANE!/MYTHIC!/IMPOSSIBLE!», vibration patterns at
  start / peak / end (Android only — iPhone Safari has no vibration API), result line «Мифический приём {move} решил батл —
  такое бывает 1 раз из 200». Demos `?battle=rare4|5|6`. Measured on 4 M seeds: legendary 1.00 %, mythic 0.50 %. hero.js `?v=9`.
  Points for the move itself (owner 11.11.2026 «+10 за красное, +5 за золотое»): worker btRare → 'gold' | 'red' + btRareSide(seed);
  auto /bt/call inserts pts_bonus (performer's id, ref 'rare:<n>', PTS_GOLD 5 / PTS_RED 10) on top of the win's +10; app result
  line adds «· +N ⭐ за редкий приём» when this phone did it (real battles only, n > 0); shop «Как получить ⭐» lists +5 / +10.
  Tested on node:sqlite: performer earned +15 (win + gold).
- B-girl look (owner 11.11.2026 «женский образ… выбрать пол в профиле… девчата одеваются как парни с небольшими тонкостями»):
  hero.js girl = opt.g === 'f' || acc has 'girl': long hair behind the head to the shoulders + a braid over the right shoulder
  with an orange hair tie, a bun + middle part when there's no hat (level 1), hoop earrings (silver, gold from level 5), lashes,
  thinner brows, a touch of colour on the lips; clothes unchanged; works in rig mode (hair is part of the head joint). App:
  profile form first row «Твой персонаж» `#fG` = B-boy / B-girl buttons with the person's bust, saved as `prof.g` ('m'|'f') on
  «Сохранить». `myLook()` = myEq + 'girl' — used for EVERY drawing of me (profile, battles tab, level-up, story card + PNG, shop
  previews, battles, rhythm game, rating card, VS / call sheets, hero gallery via g). The server keeps 'girl' inside hero_eq
  (/hero/eq lets the token through, not an item) ⇒ others see her in the rating, battles and friend links; setMyEq strips it
  (myEq = items only); btWallet re-sends the look via `lookSync()` when the server's 'girl' differs from prof.g. Gendered texts:
  rest bar / rest toast «Твоя би-гёрл отдыхает», late-battle notes («не ответила… её би-гёрл» by the opponent's eq), rhythm auto
  button «би-гёрл станцует сама». /visits `lk: 1` (admin banner; admin «версия 41»), hero.js `?v=10`, rhythm.js `?v=6`. Tested
  headless ru/en: picker, save, battle with both girls (demo opponent Ana is a b-girl), shop list.
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
- Wardrobe (owner 11.11.2026 «как человек меняет одежду… инвентаря не предусмотрено?» → «делай»): the shop sheet `#shopSheet` is now
  «Гардероб» with tabs `#wdSeg` «Мои вещи» / «Магазин» (`wdTab`; `openWd(tab)`: hero card `#heroCard` «Гардероб →» ⇒ mine, shop row
  «Гардероб и магазин» ⇒ shop; no wallet yet ⇒ tabs + points hidden, only looks). «Мои вещи» (`minePaint`): `.mtop` = my hero now +
  «Образ: ур. N · name» + worn items; «Образ» grid `#mLooks` = all 8 level looks (3 columns): unlocked ⇒ tap = wear (`setLook`),
  locked = silhouette «Через {t}»; «Аксессуары» `#mItems` = owned items as shop cards (`itemCard(it, pre)` shared with the shop;
  Надеть/Снять) or `#mEmpty` + «В магазин». The hidden pane is emptied on switch (same SVG ids twice ⇒ gradients broke).
  Older look = `myLv` (`fedoskin-look`, 0 = always the newest; ≥ level ⇒ 0) ⇒ token 'lv<N>' rides in the look like 'girl':
  `withLook(eq)` / `myLook()`; hero.js svg draws min(level, N) (hero.js `?v=11`); server /hero/eq keeps one /^lv[1-7]$/ (others
  see it in the rating/battles); setMyEq strips 'girl' + lv. Level-up ⇒ myLv = 0 (the new look is put on) + lookSync. Old server drops
  'lv' ⇒ btWallet re-syncs once per session (`BT.lvTried`). /visits `wd: 1` (admin banner; admin «версия 42»). Old gallery
  `openHeroes`/#heroSheet kept, unused. Tested headless ru/en, b-boy/b-girl, mocked server (wear look, take off, shop tab, level-up reset).
- 3-second loop on the slider (owner 11.11.2026 «как понять, где он начинается, где заканчивается… выделить на строке»): `.loopzone`
  (#loopZone/#fsLoopZone) moved OUT of the 4-px `.track` (overflow hidden, same colour as the load layer ⇒ invisible) into `.timeline`:
  gold band 14 px with gold brackets at both ends, above the line, under the knob; `paintLoop()` (setLoop + syncFs) also sets labels
  `#tLoop`/`#fsTLoop` «↻ 0:12–0:15» (gold) in the time row — body `.loop3` hides the load label meanwhile; `lapFlash()` flashes the band
  at every jump back (frame()) and on turning on. With the loop on, the finger on the slider MOVES the window (`lzMove`: grabbed on
  the band ±14 px ⇒ keeps its offset, elsewhere ⇒ starts at the finger; picture = window start; release ⇒ plays from it, toolHint
  updated). One-time toast «Цикл — золотая полоска на шкале. Потяни её, чтобы сдвинуть» (`fedoskin-loop-tip`). Landscape «ghost»
  buttons (no timeline) unchanged. Tested headless on a vertical R2 lesson (mock 206 ranges): drag 0:05 → 0:11, loops 0:11–0:14.
- B-girl rest text: the code already says «Твоя би-гёрл отдыхает» when prof.g = 'f'; profile save now repaints the rest bar at once
  (was up to 15 s late). Owner reported the male text 11.11 18:26 — if it recurs after a full app restart, ask for a screenshot.
- Rhythm battle, step 1 of 4 (owner 10.11.2026 «что-то похожее на настоящую игру» → chose option 1: a game on the current
  heroes, not a rebuild; plan = Project doc `claude/fedoskin-rhythm-battle-plan.md`): `rhythm.js` (`?v=1`, `window.RB`) — overlay
  `#rbGame` (.sheet-bg ⇒ history step; inner HTML + CSS built by rhythm.js). Setup «Собери связку»: 3 rows (TOPROCK / POWER /
  FREEZE) of ≤3 cards by hero level (`NEED`, next locked one as a teaser), difficulty 1–3 (`DIFF`, ×1 / 1.35 / 1.7), tapped card
  previews on the hero. Round = 100 BPM: count-in 4 beats, toprock 8, power 12, freeze 4 (big «FRZ» note on beat 3, ×3), ~19 s.
  Beat = WebAudio synth (kick/snare/hat/bass/stab), the whole round scheduled at once; clock = performance.now tied to the audio
  clock minus output latency; one-button taps anywhere (pointerdown on the box, `data-nt` = not a tap): PERFECT ±80 ms, GOOD
  ±160 ms, stray tap or miss breaks the combo (hero stumbles); score = base × difficulty × combo (≤ +60 %) × (1 + 1 %·level);
  `notesFor(picks, seed)` / `maxScore()` are deterministic (server will check scores). Missed big note ⇒ no freeze (shock).
  Auto mode (owner 11.11.2026 «часть людей как я, просто готовы на рандом»): setup button «Играть на авто» `#rbAuto` ⇒
  `start(true)`: random cards of the shown ones, the hero taps himself (per note: miss chance (0.2 − 0.015·level)·(0.5…1.5 luck),
  else timing jitter ~±110 ms ⇒ PERFECT/GOOD), player's taps ignored, pad says «Авто». rhythm.js `?v=2`.
  Four beats (owner 11.11.2026 «ещё 3 разных бита, с разной сложностью»): `BEATS` — LO-FI 84 BPM (notes one level sparser,
  ×0.8), BOOM BAP 100 (the original, ×1), FUNK BREAK 114 (×1.25), RAW BREAKS 128 (notes one level denser, ×1.55); row «BEAT» at the
  top of the setup (4 cards, ●○○○ + × + BPM), tap = 2-bar preview (green dot; same card again = stop), choice kept in
  `fedoskin-rb-beat`, auto play uses the chosen beat. Sound per beat in `STY` (swing, kick patterns, ghost snares, open hats,
  rim, bass wave/filter, chords: lo-fi keys + vinyl crackle, funk horn stabs, raw amen-like ghosts). `BEAT`/`TRAVEL` are set
  per round in start(); `notesFor/maxScore(…, beat)` and the result carry the beat id; the computer is a bit weaker on harder
  beats. `RB._render(beat[, bars])` renders a beat offline → loudness per second (check: all four ~0.1–0.2 RMS). rhythm.js `?v=3`.
  IN THE MAIN BATTLE since 11.11.2026 (owner «не надо тренировку оставлять, просто встрой всё в основной батл… сразу выбрать авто
  или руками»; «трек выбирается автоматически, якобы диджей»; then 15:38 «когда руками играем — не показывать авто-анимацию,
  соперник должен ответить в течение суток; если авто — старый вариант анимации, без тапов»). The trial card is gone.
  A SET = 4 rows as in real breaking (owner 15:38 «в топроке нет Топрок, есть cross step; CC — футворк»): TOPROCK (toprock shown as
  «CROSS STEP», kickstep, salsa, indian) / FOOTWORK (sixstep, ccs) / POWER (backspin, swipe, windmill, headspin, flare, airflare,
  1990 — backflip not in the game) / FREEZE. Beats: count 4, top 8, foot 8, power 8, freeze 4 (big FRZ on its 3rd), outro 3 ≈ 21 s.
  Flow: «Батл» on a rating card / «Найти соперника» / «Принять вызов» ⇒ `btStart(r)` → POST /bt/ready {to | find:1} (limits
  checked BEFORE: rest / 3 a day / gone / 403) → {opp, dj, lvl} → `RB.open({level: server lvl, me, opp, dj, onEnd, onAuto})` =
  screen «Как будешь танцевать?» (`choose()`: VS strip, DJ chip `#rbDj` «Трек ставит диджей» (tap = 2-bar preview)):
  «Сам» `#rbHand` → card setup without the BEAT row → «Начать батл» → round by hand → `btSendHand` → POST /bt/call {to, round {p, s,
  b, h, k}} → pending battle: «Раунд отправлен! {name} ответит своим раундом в течение суток…» + «Готово» (NO cartoon);
  «Авто» `#rbAutoGo` → `btAuto` → old /bt/call without round → old random-by-level result → btPlay cartoon (no tapping).
  Answer: /bt/inbox {v:2} → `calls` (challenges to answer), `results` (my challenges decided, unseen), `out` (my challenges
  waiting), `lvl`, `now`; `#btCallSheet` shows one at a time (`btNext`: call → result → old news; `#btCallP` subtitle; «Позже» on a
  call/result = not again this session, `BT.later`); list `#btLists` on the Battles tab (⚔️ «{name} вызывает тебя на батл ·
  осталось t» «Ответить» / 🏆 «Батл с {name}: судьи решили» «Смотреть» / ⏳ «Ждём ответа от {name}»). `btAnswer(bt)` → RB.open
  answer mode (h3 «Ответь на вызов», same DJ track): by hand or auto → POST /bt/answer {n, round | auto:1} → `RB.result`-style
  `showResult` in rhythm.js: both scores, 3 judge cards one by one, Победа/Поражение, PERFECT/GOOD/MISS, note (late). Challenger
  sees it via results → `btOpenRes` (/bt/seen {n, side:'a'}). Hand battles NEVER go to btPlay; news with `hand` ⇒ result screen.
  Server (push-worker.js; rbNotes/rbScore/RB_ROWS/DIFF/NEED/BEATS — KEEP EQUAL to rhythm.js notesFor/scoreOf): DJ `rbDj(a, b,
  half-hour slot)`; `rbCheck` (4 picks in rows, ≤ NEED for the server level, DJ track, hits) recounts the score; D1 `bt_h (n, a, b,
  dj, ra, rb, st wait|done, exp = +24 h, late, done, sa)`, bt row has win '' while waiting (old /bt/seen only marks win != '');
  `btResolve` = judges p = logistic((sa − sb)/(.04·max)) per vote, bt_score, push to the challenger (BT_TITLE_R/BT_BODY_R);
  `btExpire` (on /bt/inbox, /bt/ready and the cron `scheduled()`): no answer in 24 h ⇒ `rbStand` = the other phone's dancer
  (its last hand round's picks + miss/perfect shares from `bt_def`, else by level, a bit weaker than a person) ⇒ late = 1, seen = 0
  ⇒ it reaches the challenged phone as news (result screen) and the challenger as a result. Challenge push for hand battles is
  always sent (BT_BODY_H «ответь… в течение суток»). Old apps: /bt/call without round = old instant result; inbox without v:2 never
  sees pending ones. App with an old server (/bt/ready 404) ⇒ hand round still played, old /bt/call returns a decided battle ⇒ cartoon.
  /visits returns `rb: 1` (admin banner «обновите код сервера» otherwise; admin «версия 38»). Tested: worker on node:sqlite (parity
  client = server score, pending/answer by hand/auto/twice, results + seen, expiry with stand-in, old inbox, 3-pick refused, auto
  instant), app headless ru (auto ⇒ cartoon, by hand ⇒ sent screen + ⏳ row, opponent answers ⇒ result sheet ⇒ judges screen,
  incoming call sheet + ⚔️ row ⇒ answer on auto ⇒ result).
  Moves opened by lessons (owner 11.11.2026 «открывать движения в игре через уроки… посмотрел уроки по Powermove — открыл windmill и
  flare»): a move counts as known by level (NEED) OR when one of its lessons is watched — stats.watched ≥ max(5, min(½ dur, 120 s)).
  index.html `UL_RX` finds a move's lessons by NAME (new lessons «Air chair» etc. map themselves; flare regex skips «airflare»),
  `UL_SEC` = moves without own lesson (airchair: 2 Freezes lessons, hollowback: 3); `ulState()` → {have, hint (shortest lesson
  or section n/need)} passed as `RB.open({ul})` ONLY when the server said `ul: 1` (/bt/ready, /bt/inbox; BT.ul, sessionStorage
  `fedoskin-ul-srv`) — an older server refuses such rounds. rhythm.js: up to 2 lesson-opened moves always get a card (🎬 corner),
  a hinted locked move is always shown as a teaser (dashed «🔒 🎬 Урок», row goes to 4 columns `b4`); tap ⇒ `#rbUl` how-to +
  «Открыть урок/раздел» → D.onUl closes the game (its history step) and opens the lesson 350 ms later. round.u = picks above
  the level; worker rbCheck accepts them (rbStand reuses any own saved pick). Toast «🎮 Открыто в батле: …» once per move
  (`fedoskin-ul`; first run silent); lesson page `#lessonUl` «Посмотри урок — откроешь в батле: X» / «Открыто…». /visits `ul: 1`
  (admin banner; admin «версия 43»), rhythm.js `?v=7`. `window.fedoskinUl(check)`.
  Explanation (owner 11.11.2026 «ты сделал подсказку?» → «делай»): when ul is on, the setup shows `.rbulnote` «🎬 Смотри уроки —
  открывай новые движения раньше уровня» under the heading, and ONCE (`fedoskin-ul-tip`) a yellow bubble `#rbTip` under the row of the
  first lesson-locked card (arrow at the card via --ax, card pulses) «Это движение откроется, если посмотреть его урок. Нажми на
  карточку.» + «Понятно»; tapping the card or «Понятно» removes it. rhythm.js `?v=8`. Tested: worker rbCheck (u accepted / not
  for other moves), app headless ru/en (cards, hint, button → lesson, toast once, round.u).
  v2 RULE (owner 13.11.2026 «элемент открывается только после 3 полных просмотров одной обучалки: 1 раз от начала до конца и 2 раза —
  сумма минут, равная двум просмотрам» + «как бы открылся, но ждал уровня героя»): a move of UL_NEED (level > 1) is usable only
  when its lesson is STUDIED (coverage: every second seen at least once — `fedoskin-ulcov` {lesson id: base64 bitset, 1 bit per
  second}, filled by the 1-s playback tick from the last position, a jump/`seeking` breaks the run; full = ≥ 97 % or ≤ 2 s
  missing — AND real playback stats.watched ≥ 3 × dur; loops / slow motion count) AND the hero level ≥ NEED. Section moves
  (UL_SEC): N section lessons each seen whole. Moves without lessons: level alone. Already usable before (snapshot at the first
  run of v2: moves of the level then + the old toasted `fedoskin-ul`) stay: `fedoskin-ul-old`. `ulState2()` → {allow, have,
  hint {id, name, p, pf, full, st, lvOk, lv} | {sec, n, need, st, lvOk, lv}, v2, keys}; always passed to RB.open (no BT.ul gate —
  the rule is client-side; the server still accepts by level + round.u). rhythm.js know(): keys ⇒ allow, others ⇒ level; locked
  teaser captions «🔒 🎬 Урок · Ур. N» / studied «🎬✓ · Ур. N» (green `.st`), how-to `ulText2`, note «🎬 Новые движения открывают
  уроки: посмотри урок 3 раза и дорасти до нужного уровня героя». Lesson page `#lessonUl`: progress bar + «{p} из 3 просмотров ·
  целиком — есть ✓ / ещё нужно один раз досмотреть…» (+ level), studied ⇒ «изучено ✓ — откроется на уровне N (сейчас c)», open ⇒
  «Открыто в батле». Toasts `ulCheck2` (`fedoskin-ul2`): usable ⇒ «🎮 Открыто в батле: X», studied early ⇒ «🎬 X изучено — откроется
  в батле на уровне N»; re-checked after a level-up. rhythm.js `?v=9`. Tested headless (states partial / studied lvl 1 / studied lvl 3
  / lvl 3 not studied / old user keeps windmill; setup cards + how-to texts).
  Ring + sound only (owner 13.11.2026 «незаметный кружочек с зелёной шкалой… без звука не считаются»): `#ulRing` = small green progress ring
  in the video's bottom-left corner (landscape fs: top-left under the top bar; hidden while swiping), shown only on lessons that teach a
  move not yet studied/grandfathered; p = views/3 (≤ 97 % until the one full view is there); muted ⇒ grey 🔇; done ⇒ ✓ for 5 s, then
  hidden; tap ⇒ toast «Изучение X для батла: N %…». Time for studying = `stats.ulw[id]` (seconds played WITH sound; slow motion counts —
  it mutes without soundOff), NOT stats.watched (progress before 13.11 started over; coverage kept); coverage marked only with sound;
  one toast «🔇 Без звука просмотр не засчитывается…» per session. rhythm.js `?v=10` (how-to says «со звуком»).
  Starter battles (owner 13.11.2026 «для новичков сделай батлы закрытыми с подсказкой… посмотри видео и выучи элемент… Теперь ты выучил
  кросс степ… но этого мало для полноценного раунда»; my recommended option «по 1 элементу на каждую часть» — the owner didn't object):
  `fedoskin-starter` = new | open | old, set at the first run: old if the phone ever touched battles (fedoskin-bt-rest / rb-beat / ul-tip /
  rb-mute / eq), else new; `?starter=new|old` for checks. new/open ⇒ the basic moves WITH a lesson (ST_RX: cross step, kick step, indian,
  6-step, CC, swipe; `freeze` = any lesson of section Freezes) are in ulState2 keys and open only when that lesson is studied (same 3-views-
  with-sound rule, no level); salsa / backspin (no lesson) by level. new ⇒ battles locked (`stGate()` at the top of btStart / btAnswer ⇒
  sheet `#skSheet`) until each part of the round (ST_ROWS TOPROCK / FOOTWORK / POWER / FREEZE) has a studied move ⇒ stMode 'open'.
  Battles tab card `#skCard` (4 part chips with progress, «Смотреть: <next lesson>» — order Cross step → 6-step → Easy chair → Swipes,
  or the one already started); ring + #lessonUl work for these lessons (`ulMovesOf`). Studied a basic move (stCheck from ulCheck2):
  toast at once, sheet «Теперь ты выучил X! Он доступен у тебя в батлах, но этого мало…» (gendered) after leaving the lesson
  (stShowPending in go()); last part ⇒ «Батлы открыты! 🔥». `fedoskin-st-seen`, `window.fedoskinStarter()`. Server unchanged.
  `?battle=play` / `window.fedoskinRhythm()` = the old trial vs the computer, kept for checks only (no UI). Sound mute
  `fedoskin-rb-mute`. Tested headless (bot taps, real touch, iPhone SE/13, Pixel 7, back button); the beat itself was never
  heard by Claude and iPhone audio latency is untested — ask the owner how it feels.
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
- Rhythm battle RULES v2 (owner 13.11.2026 «продумай систему батлов, сложность элементов, подсчёт очков, сложные диджейские биты,
  рисование траектории… Делай»). ONE source of the rules: `tools/rb2.js` (block `// <RB2> … // </RB2>`), copied by
  `python3 tools/rb2_sync.py` into rhythm.js and server/push-worker.js — never edit the copies. `RB2.D` = difficulty 1–10 per move
  (Claude's draft, THE OWNER CORRECTS IT — he knows difficulty): multiplier ×(1 + 0.1·(d−1)), note density tier (≤2 / ≤5 / else),
  trajectory corridor 30−d px. Score = 100 perfect / 50 good × weight (tap 1, trajectory 5, freeze hit 3) × move × beat × combo
  (+2 % a note, ≤ +60 %) ; clean round (no miss, no stray tap) = FULL COMBO ×1.1; × (1 + 1 %·hero level).
  Hard beats (v2 only, `g: 2` in BEATS): DJ CUTS 104 BPM ×1.75 (syncopated taps, the sound is cut for 1.5 beats every 2nd bar,
  scratches), TRIPLET FLIP 96 ×1.9 (triplets, 30 % straight bars), DOUBLE TIME 140 ×2.1 (fast bar / half-time bar); a wood block
  plays every tap on them (schedule(…, cues)). DJ pool on the server: 5 tracks while one dancer is below level 3, else all 7.
  Trajectory: power phase = 1 bar of taps, then note `draw` (beats 24–27.5): canvas `#rbDraw` over arena…pad, shape per power move
  (`SHAPES`), finger follows from the yellow dot; cover × (0.6 + 0.4·closeness) ≥ .85 PERFECT, ≥ .5 GOOD, else MISS; in the hits
  string it is one more 1/2/3. Auto mode draws by itself.
  Versions: app sends `g: 2` to /bt/ready; a new server answers `g: 2` (+ v2 DJ) ⇒ RB.open({g: 2}) ⇒ round.g = 2. Old server ⇒ old
  rules (v1 code kept: DIFF/MULT/notesFor/scoreOf + rbNotes/rbScore). The answerer plays by the challenger's rules (`bt.ra.g`); an
  old app answering a v2 challenge ⇒ its stand-in dances (no error). rbPub adds g, dr (trajectory 1/2/3), fc (clean). /visits
  `rb2: 1` (admin banner; admin «версия 48»). Practice (`fedoskinRhythm()`) is always v2. rhythm.js `?v=10`. Tested 13.11: node —
  phone = server score on 2 800 random rounds, old rounds pass, old round on a new beat refused, DJ pools; headless phone — full
  rounds by hand on 5 beats with drawn flare / airflare / headspin / 1990 / windmill (perfect, sloppy ⇒ GOOD, a third ⇒ MISS),
  v1 battle round unchanged, result screen. NOT tested on a real phone (finger feel, tap windows on 140 BPM).
  Owner's table (13.11.2026 10:48 «добавь ещё… исправь…»): RB2 now holds MULTIPLIERS `RB2.M` (his numbers, no 1–10 scale): toprock 1,
  kickstep 1.1, salsa 1.1, indian 1.3 · footwork hook 1, sixstep 1.1, kickout 1.1, ccs 1.2, babylove / onestep / russian 1.3 · power
  backspin 1.1, swipe 1.3, windmill 1.4, headspin 1.4, ninety 2, rninety (REVERSE 1990) 2, twok (2000) 2, flare 2.2, airflare 2.5 ·
  freeze 1.1, nike (HEADFREEZE NIKE, replaced headstand) 1.3, onehand (ONE HAND FREEZE, replaced handstand) 1.4, hollowback 1.7,
  airchair 1.8. Tier (tap density) by multiplier: ≤ 1.1 / ≤ 1.4 / above; corridor 30 − 8·(m − 1) px, ≥ 17. v2 has its OWN `RB2.ROWS` and
  `RB2.NEED` (babylove / onestep / russian 2, onehand 3, rninety / twok 6; rest as before) — rhythm.js `rowsOf()` / `needOf()`, worker
  rbCheck / rbStand; v1 rows untouched. `RB2.R` = tables revision (now 2): the app sends `r` to /bt/ready (NOT g — a server with the
  first v2 tables would accept g), the server plays v2 only when r === its R; rounds carry r; rbCheck refuses another revision; an
  answer by another revision ⇒ stand-in. BUMP R on any change of the tables. /visits `rb2: R` (admin wants ≥ 2; «версия 49»).
  New hero moves in hero.js (`?v=12`): hook, kickout, babylove, onestep, russian, rninety, twok, onehand, nike — quick drafts by
  Claude, NOT reviewed by the owner (ask him how they look). SHAPES rninety / twok. index.html: BT_NAME, UL_NEED / UL_RX babylove
  (lesson «Baby love») and rninety («Reverse 1990»; ninety's regex now skips «reverse»). rhythm.js `?v=11`.
  Revision 3 (owner 13.11.2026 14:24, the three ideas from the plan — «делай и запускай, хочу попробовать»), `RB2.R = 3`, rhythm.js `?v=12`:
  (1) HELD FREEZE: the last note is `hold` (beat 31 → 33, weight 4): hit in time, keep the finger down and within 48 px for 2 beats
  (`holdStart/holdEnd/holdPaint`, ring over the hero fills; `n.hs` = started); held ≥ 92 % = the hit's grade, ≥ 50 % = GOOD, else MISS;
  still ONE char in the hits string. (2) SECOND TRAJECTORY for moves ≥ ×2 (1990, reverse 1990, 2000, flare, airflare): the power phase
  has no taps — draw at beats 20–23.5 and a mirrored one (`mir`) at 24–27.5; `G.dns` = all draw notes, `G.dn` = the current one
  (drawTick switches). (3) NEW SET bonus: +2 % per move that differs from the same row of this phone's previous round (max +8 %):
  `RB2.score(…, prev)`, `RB2.fresh`; server prev = bt_def picks read BEFORE saving (`rbPrev`), round gets `nv`; app keeps
  `fedoskin-rb-prev` (battles) / `fedoskin-rb-prev-t` (practice) — the two can differ (other phone, failed send): the server's
  score is the real one. /visits rb2 = 3 (admin wants ≥ 3; «версия 50»).
  Bridge to coaching: after a battle with the coach (config `coachId` = his rating id if ever set, else nick ~ fedosk1n / федоскин —
  the owner was told a same-named player would trigger it too) the hand-battle result / «round sent» screen (rhythm.js `coachCard`,
  D.isCoach / D.onCoach) and the cartoon result (`#btCoach`) show a calm green card «Ты батлил с Федоскиным… Онлайн-ведение →» ⇒
  Коучинг tab, sendEv('cta', 'battle'); at most once a day (`fedoskin-bt-coach`). Tested headless: full hold PERFECT, let go at 60 %
  GOOD, at 20 % MISS; flare / airflare two trajectories; parity phone = server incl. prev; coach card → Коучинг, not twice a day.
  NOT done: hiring an animator (the owner's decision, not code).
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
- Press feedback (owner 11.11.2026 «легкую анимацию нажатия на любую кнопку»): CSS right after `.ico` — every button / .btn /
  [role=button] shrinks to scale .95 while pressed (`:where(...)` = lowest priority), wide ones (.list-item, button.card,
  .svccard, coach card buttons) to .98; uses the separate `scale` property (adds to transform positioning); .fsk / .fsghost /
  .fscorner keep their own. A no-op document touchstart listener makes iPhone apply :active.
- Tab «Батлы» (owner 11.11.2026 «плашку БАТЛЫ… из профиля перенести все туда»): TABS = Главная / Коучинг / Батлы (icon: a «VS» plate, letters cut out by an SVG mask `vsCut` — owner picked variant 10 of a 10-icon sheet on 11.11.2026 after two face-to-face versions)
  / Профиль; `.tabs-in` is grid-auto-flow:column (any number of tabs). Screen `#battles` (h1 «Батлы»): `#heroCard` (level, outfits,
  `#btScore`), `#shopRow`, the whole rating section (rankSoon/rankBox, rest bar, btTools, `#leaders`, show-me switch,
  `#shareRank`) — moved out of `#profile` (ids unchanged). go('battles') does what go('profile') did for the rating
  (renderStats, btInbox, lbSend/lbLoad); `heroShown()` = profile or battles visible; btPaintRest ticks on #battles.
  Rating = top 100 (worker LIMIT 100 / KV slice 100 — the owner must update the server code; old server = 50): only the first
  `LB_SHOW` = 10 rows until `.lbmore` «Показать весь рейтинг (N)» / «Свернуть» (`lbAll`, scrolls back to the list); search
  results are never cut. Tested headless iPhone ru 390×844 / en 375×667 with a mocked /lb of 100 rows.
  Hero cards (owner 11.11.2026 «как раздел, 3 окошка в ряду… видно бибоя, одежду и уровень; 1–3 место разными цветами»): `#leaders`
  gets class `.lbgrid` (3 columns; tablets auto-fill 150 px), each row = `.lbc` card: place (`.lbpl`, places 1–3 = medal circle,
  cards `.p1/.p2/.p3` gold / silver / bronze border, tint, glow, name colour), full-length hero with the person's level look +
  worn shop items (incl. backgrounds) as an <img> from `heroImg(level, eq)` — each look drawn once into a blob: SVG and reused
  (an inline hero is ~40 KB), level chip `.lblv` in the level's RING colour, nick, city · country, minutes, 🏆 w–l, «Батл» at the
  bottom. Own card `.me` = accent border. Search results use the same cards without places.
  Names (owner 11.11.2026 «имя не влезает… B-boy вверху, остальное под ним, по центру»): a leading b-boy / bboy / b_boy / b boy /
  b-girl / bgirl (any case) goes to its own small centred line `.lbpre`, the rest `.lbrest` below (up to 2 lines, wraps anywhere).
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
- iPhone/iPad keep watched lessons too (owner 11.11.2026 «чтобы видео автоматически после загрузки оставались
  загруженными»; until then nothing was saved on Apple). The player there still streams from the network (sw.js never
  streams a download in progress on Apple — that showed only the cover on 31.10). The PAGE saves the whole file itself
  (`keepOnPhone(u, blob?)`, `KEEP` map): 1.5 s after `playing` (8 s on a slow link) it fetches fileFor(l) whole (≤ 120 MB,
  ≤ the person's limit) and `cache.put`s it into `fedoskin-video-1` under the address without the query (same key as
  Android), + X-Saved; a finished neighbour preload (`nextIntro` blob) is saved the same way; then stPing('limit') ⇒ sw.js
  trims; `navigator.storage.persist()` asked once. Playing it: `introSource` → `savedSv(u)` = the same address + `sv=1`
  when saved (also without a pass / offline). sw.js on APPLE answers ONLY `sv=1` requests (`serveSaved`: Blob slices from
  the cache, 206 ranges; missing ⇒ `netNoSv` = network without sv); everything else on Apple still bypasses sw.js. Old
  sw.js ⇒ the sv=1 address simply goes to the network (worker ignores sv). Watchdog: a stuck sv=1 source reloads from the
  network. Saved neighbours are not preloaded into memory again on Apple; fq (full-quality scrubbing) reads the saved
  blob. Load label on Apple = `keepProg()` (background save progress → «Сохранён на телефоне»). Store sheet now shows
  limit + list on Apple too (`#storeApple` note hidden, kept). Kinescope lessons: see the next note. Tested in Chromium with sw.js APPLE forced + iPhone UA and a local mock R2
  (save, 2nd visit = 0 video downloads, offline + no pass, store sheet) and Android regression; real Safari untested.
- Kinescope lessons kept piece by piece (owner 11.11.2026 «Делаем»): real Kinescope HLS (checked in the owner's Chrome
  11.11): master → media.m3u8?quality=&type=(&lang=) per quality + a separate audio playlist; each quality is ONE fMP4 file
  on `edge-<pop>.kinescopecdn.net/<uuid>/videos/<uuid>/assets/<uuid>/0/<n>/<q>.mp4?kcd=<16-char token>`, EXT-X-MAP + 4-s
  pieces as EXT-X-BYTERANGE; paths stable across fetches, only kcd changes. `ksLoaders(Hls, ks, env)` = hls.js fLoader/pLoader
  subclasses of Hls.DefaultConfig.loader: a fragment is looked up in `fedoskin-video-1` under `<app>/__ks/<ks><path>@<a>-<b>`
  (`ksPieceKey`, rangeEnd exclusive as in hls.js) → served from the phone (fake stats, `frag._fromPhone` ⇒ no noteSpeed),
  else network + `ksPut` (Blob copied BEFORE onSuccess — hls.js transfers the buffer to its worker). Playlists network-first,
  saved copy (`ksListKey`, query without kcd/token-like keys) only on error/timeout ⇒ offline works. `ksSaved`
  (`fedoskin-kss`: ks → {h = short side of the saved quality}) ⇒ next open: startLevel = that quality + autoLevelCapping,
  capLevelToPlayerSize off, NO intro (introSource returns null). With an intro the stream starts at 5 s ⇒ `ksSaveHead()`
  (3 s after the stream plays) fetches the pieces with start < 6 s of the current video + audio playlists. ksPut is serial;
  stPing('limit') at most every 15 s / 24 MB; sw.js trim keeps a `sizeOf` map + one matchAll pass, VMAX_FILES 40000.
  Store sheet groups `__ks/<ks>/…` by lesson (stLesson), stList uses keys()+matchAll() (same order), deleting/clearing
  forgets ksSaved; stRender drops ksSaved entries with no pieces left.
  iPhone/iPad: hls.js on ManagedMediaSource when `mmsOk()` (window.ManagedMediaSource = iOS 17.1+, and not
  `fedoskin-mms-off` within 7 days); hls.js 1.5.20 handles MMS + disableRemotePlayback itself; the lib is preloaded on
  Apple too then. `toNative()` = Apple's own player at the same moment + sets fedoskin-mms-off: on a fatal NON-network hls
  error (media error after one recoverMediaError), or time running with no rVFC frame for 2.5 s (700 ms interval), or
  !Hls.isSupported(). Network errors never switch (offline must not disable saving). Old iOS ⇒ native as before.
  Tested in Chromium with a fake Kinescope (ffmpeg single_file fmp4 byterange HLS, 480/720 + separate audio, changing kcd,
  /tmp/tst/ksmock.js): Android + iPhone UA with MediaSource aliased as ManagedMediaSource — 1st view saves all pieces,
  2nd view 0 CDN requests (also after seeking), offline plays, intro start saves 0–4 s, fallback to native on no frames;
  network failure doesn't switch. Real iPhone MMS never tested by Claude.
  Repeat stuck at 0:00 (owner 11.11.2026 screenshot, Baby love first view on iPhone: buffer 4–46 s, time 0:00, «playing»): with
  MMS Safari sends `endstreaming` ⇒ hls.js pauseBuffering(); after the intro start 0–4 s were never streamed and the repeat's
  jump back got no `startstreaming`. Fix: `hlsKick()` on vid seeking/waiting — position not in vid.buffered ⇒
  hls.resumeBuffering(); and a 500 ms check: playing, readyState < 3, not buffered for 2.5 s ⇒ resumeBuffering + startLoad(t).
  Reproduced in Chromium by dispatching `endstreaming` on a MediaSource subclass aliased as ManagedMediaSource (/tmp/tst/rep.js).
  White screen ⇒ app restarted on home (owner 11.11.2026 17:25: Windmill(head), 9.5-min landscape Kinescope lesson from «Новые
  уроки», ~1 min in, iPhone) = the phone closed the app, most likely for memory. hls.js defaults kept everything watched
  (backBufferLength Infinity) and ran ahead up to 60 MB (8·maxBufferSize/bitrate, ≤ 600 s — the fake 3-min lesson was buffered
  whole). Now Apple: backBufferLength 8, maxBufferLength 24, maxMaxBufferLength 40, maxBufferSize 18 MB; others 30/30/60/40 MB
  (tested: Apple buffer ≈ t−10…t+42). Safety net at start: while a lesson plays the app writes `fedoskin-run` {id, t, ts, m =
  Apple+hls.js} every 3 s, wiped on hidden/pagehide/leaving the lesson; a note < 90 s old at start = closed under the person ⇒
  m ⇒ MMS_OFF (Apple's own player for 7 days), the lesson reopens and seeks to t on `playing`, toast «Приложение
  перезапустилось — продолжаем с M:SS»; not again within 10 min (`fedoskin-run-rec`). Tested with CDP Page.crash (Android UA:
  resumed 0:23; iPhone UA: mms-off set). The real cause on the phone is not confirmed — ask the owner if it happens again.
  Happened again 17:43 (crash ~0:35, the safety net reopened the lesson — worked). Next suspect = on-screen frame capture,
  new on iPhone with MMS (native HLS refused the copy, R2 lessons are short): createImageBitmap every ~1 s + fc-worker made a
  NEW OffscreenCanvas per frame (graphics memory freed late). Now fc-worker reuses one canvas; fcCapture skips `vid` on
  Apple while hls.js drives it (intro still captured). MMS_OFF values older than `MMS_FIX` (17:45) are ignored, so the
  owner's phone tries the fixed MMS player once more; a new crash sets MMS_OFF anew. The run note also keeps the row
  (`r` = curList ids) ⇒ reopened «Новые уроки · урок n из m».
  13.11.2026 (owner: «Airflare(airtwist) на ~40 с перезагрузился и начал сначала», iPhone; cause unknown — no log then). Fixed the
  ways a lesson could come back at 0: (1) the safety-net reopen jumped only after `playing`, and a 5-s intro reset pendingStart
  to the intro's end ⇒ now `resumeAt {id, t}` makes loadVideo START there (no intro for ks, pendingStart = t ⇒ hls startLoad(t)
  / currentTime at loadedmetadata), the old jump stays as a fallback only if > 3 s off; (2) toNative (MMS → Apple player)
  set the moment only at loadedmetadata ⇒ `nativeWant` re-applies it on loadeddata/canplay/playing for 15 s; (3) recoverMediaError
  now startLoad(at); (4) pull-to-refresh no longer starts from the video (`#stage`), and reloadClean saves the lesson's moment
  + row (`lt`, `lr` in fedoskin-restore) ⇒ continues there. Diagnostics: `diag()` ring of 40 events in localStorage
  `fedoskin-diag` (lesson open + player kind, toNative why/at, hls fatal errors, restarts, reloads); `?diag=1` shows it on
  screen, `window.fedoskinDiag()`. If it recurs: ask the owner for a screenshot of `?diag=1`. Tested: crash at 26 s ⇒
  reopened «from 26», plays on from 26 (intro skipped); restore after reload at 40 ⇒ plays from 40.
  Owner confirmed on his real iPhone 11.11.2026 13:07: «проверил все работает» (Baby love repeat with our MMS player).
  Load bar for Kinescope lessons (owner 11.11.2026 13:19 screenshot «скачался, но полоска глючит» — it showed only the player's
  ~30 s buffer with holes where he had scrubbed): `KS_HAVE` (ks → Set of saved piece keys; filled once per lesson by
  `ksHaveLoad` in ldStart, kept up to date by ksPut, cleared by ksForget) + `ksSavedSegs(l)` = the current quality's fragments
  whose key is saved ⇒ ldTick paints `mergeSegs(buffered ∪ saved)`; all saved ⇒ «✓ Сохранён на телефоне».
  Offline with a partly saved lesson (found while testing): a failed unsaved piece used to be fatal ⇒ dropHls + «Видео не
  загрузилось» although the start was on the phone. Now a fatal NETWORK_ERROR on a fragment with something buffered/saved
  ⇒ keep playing, `hls.startLoad(t)` again in 4 s (and on `online`; the stall check retries too). Tested: 3-min fake lesson,
  pieces 1:00–2:00 deleted, server off ⇒ plays from the phone, bar 0–33 % + 67–100 %.
- «Память на телефоне» (owner 09.11.2026 «кнопку очистить кэш… ограничения как в телеграм, не более 5гб»): Профиль → row
  `#storeItem` (shows used size) → sheet `#storeSheet` (a .sheet-bg ⇒ own history step): used MB/GB + bar vs the limit,
  limit seg `#storeLimits` «Не хранить / 500 МБ / 1 ГБ / 2 ГБ / 5 ГБ» (default 1 GB) written by the PAGE to cache
  `fedoskin-vcfg` key `vlimit.json` (resolved against the app folder = SW scope) — sw.js `getLimit()` reads it, `save()`
  skips files over it (0 = keep nothing), `trim()` drops oldest-saved first (count cap 500); list of saved lessons grouped
  by lesson (`stLesson`: v/<id>.mp4, -intro, or r2 file name) with sizes and × per lesson; «Очистить всё» asks on the same
  button (2nd tap within 4 s, no confirm()). Page changes the cache itself and posts {type:'vcache', cmd: limit|drop|reset}
  so the SW re-reads the limit and forgets in-memory copies. Apple: since 11.11.2026 saved by the page (see the iPhone note above); `#storeApple` stays hidden. sw.js recheck drops a copy whose file is 404/410 on the server. 17 new i18n keys. Tested (Pixel 7 / desktop en /
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
- Home row «Недавно просмотренные» (owner 13.11.2026 «поменять "новые уроки" на "недавно просмотренные"… хочется вернуться к тому видео,
  которое он смотрел последний раз»): `#newHome/#newRow` (ids kept) = `fedoskin-recent` (lesson ids, last opened first, ≤ 20, shown 15;
  `noteRecent` in openLesson, no course lessons), hidden while empty; row playlist labels «Недавно просмотренные · урок n из m» /
  «Ещё из недавних» / «Это последний/первый из недавних». Admin `newRow` card is hidden (data-later="newrow"), config key unused.
  NEW badge = 24 h (owner «new в течение суток»): lesson `at` (ms, set by the admin on add and when NEW is switched on again) else the
  start of its `added` day Moscow time; `newDays` unused (admin field hidden data-later="newdays"). Admin «версия 49».
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
- Coaching tab order (owner 13.11.2026 «на самый верх вынесем прайм и вниз уберём отзывы и мою фотку с описанием и ссылками»):
  #review = service cards (premium «Полное ведение» first — renderServices sorts `prem` to the top; tablets: the premium card
  spans both columns) → consultation hint → «Как это работает» → «Отзывы учеников» → the coach card (photo, facts, links,
  cheapest-service offer) LAST. The 09.11 «starts with the coach» order is replaced. Tested headless en/ru 390×844, tablet 820.
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
  /tg/trtest returns `model`; admin shows «Переводит: …». Admin «версия 35». 10.11.2026 (owner: no copy button on «Статистика»): always-visible «Скопировать код сервера» `#visCopyTop` next to «Обновить»; /visits returns `bt: 1` and the `#wkNew` banner also shows when the server lacks it (battles/points/shop). Admin «версия 36». Services by country (owner 10.11.2026): /visits `svc.countries {today, d7, all}` = [country, sv/so/tg, people] (evu ⋈ devices, first-seen country, XX unknown); admin table `#svCountry` «По странам» under the per-service table, follows the period switch. Admin «версия 37».
- Swipe tip `#swHint` wraps (max-width 100 % − 20 px) — on a landscape lesson in the narrow page player it was cut off (13.11.2026).
- Sheets never taller than the screen (owner 12.11.2026 «ощущение будто нельзя доскролить до своего языка»): `.sheet` got
  max-height calc(100dvh − max(12px, safe-area top)) + overflow-y auto + overscroll contain. Before, the subtitles sheet
  (10 rows ≈ 870 px) was bottom-aligned with no scroll ⇒ its top (Off, Русский…; sideways also EN–FR) was off screen.
  Subtitles and app-language sheets scroll the checked row into view on open. Tested headless iPhone 390×664, 844×340
  (touch swipes reach 中文, tap selects, reopen shows it) and a tablet 820×1180 (unchanged).
- City mini-game «Город» (owner 13.11.2026; design + status = Project doc `claude/fedoskin-city-game-plan.md`): top-down city behind the flag
  `cityEnabled` (config.js; ON for everyone 13.11.2026 20:53, OFF again 21:02 — owner «надо улучшать… скрой город»: graphics rework first) or the trial link `?city=play` (kept in sessionStorage `fedoskin-city-on`) ⇒ tab «Город» before «Профиль»
  (5 tabs; with a published course it would be 6 — ASK the owner, options are in the doc). Files: `city-balance.js` (ALL numbers,
  `window.CITY_BAL`), `city-data.js` (map rows, places, NPCs, items, schedules — `window.CITY_DATA`; a new district = data only), `city.js`
  (`window.CITY` {init, show, hide}; canvas 2D drawn by code, 44-px tiles, fog, BFS path on tap, clock 1 game hour = 1 real minute only
  while the tab is shown, 60 fps only while walking else a 240-ms tick, pause on hidden; DOM HUD + dialogs; save `fedoskin-city` {v: 1}).
  No server, no rating. Strength comes ONLY from lessons: moves = ulState2 (same as battles), new phones go through `stGate`.
  Battles / shows run on rhythm.js: `RB.open({ city: {ban, fw, cor}, dj, opp, ul, onCity })` — no auto, DJ chip instead of the beat row,
  `ban` closes moves (a bruise leaves only backspin in POWER — the engine needs 4 picks), `fw` = extra tap window (s) in footwork (sneakers),
  `cor` = extra headspin corridor px (beanie); finish() → `cityEnd(res)` (res.maxFor(picks, lvl) for the NPC's score) → city returns
  {my, their, votes, won, extra, btn, done} (battle: showResult) or {title, extra} (show). rhythm.js `?v=13`. Leaving the round early = stake/energy lost.
  Slice done: district «Двор» (home/sleep, dumpster cardboard, kiosk, tent shop pads/kicks/beanie, show spot, 3 b-boys Витёк 1 / Лёха 2 /
  Гарик 3 boss, 2 stashes, gate to Центр = «скоро»). City-only finds (owner «добавь вещи, которые выпадают только в городе»): tape, thermos,
  chalk, cassette, lucky lace, district patch (more planned in the doc). 112 i18n keys (names of NPCs are translated too). Checks:
  `CITY._s()` state, `_reset()`, `_go(x, y)`, `_t(hour)`, `_cam()`. Tested headless 390×844 / 375×667 ru + en; NOT on a real phone.
  Joystick (13.11 evening): a drag on the map (> 16 px) = joystick (pointer down/move/up on the canvas; hero walks while held, axis-separated
  collision, settles on the cell at release); a short touch = tap-to-walk. city.js `?v=2`. City maths checked with a stubbed RB.open
  (win, −12 % asphalt, bruise, «read» −20 %, boss drops lace + patch, loss) — `CITY._pos()`.
  «Разогрет уроком» (owner 13.11.2026 20:38 «делай»): index.html counts real lesson seconds of today (`stats.dk` = todayKey, `stats.ds`);
  CITY deps `todaySec / day / home`; ≥ `CITY_BAL.warm.sec` (300) ⇒ warm(): energy cap +20 (`emax()`; +20 given once a real day, `S.warmDay`,
  toast), respect of a win ×1.1 (line in the result), HUD chip «🔥 Разогрет»; not warm ⇒ the tip in «Как играть» / backpack + «К урокам».
  city.js `?v=3`, city-balance.js `?v=2`. Tested headless en (cold tip, warm toast, en 120, win +22 instead of +20).
  Graphics rework (owner 13.11.2026 21:02 «надо улучшать» → picked variant 2 of 3 sketches: «чёткая графика, строго сверху», spirit of
  early top-down city games, nothing copied): new file `city-gfx.js` (`window.CITY_GFX`, `?v=1`) = ALL the picture, no game logic; city.js
  only says what goes where. Tile 52 px (was 44). Map: drawn once in 6×6-tile pieces (`chunk`, ≤ 12 kept, oldest freed — iPhone memory),
  ground + shadows of tall things + things (roofs with parapets / vents / hatches / antennas / skylights, garages with rust + graffiti tags,
  concrete fence, kiosk, tent umbrella, dumpsters, made-up cars, lamps, benches, sandbox, cracks / patches / manholes / puddles / litter by
  the cell's hash). New blocked cells in city-data.js: `C` car (two in a row), `L` lamp, `B` bench (BLOCK in city.js; all places still
  reachable — checked by flood fill). People: `GFX.person(ctx, x, y, look, dir 0–7, frame)` — sprite cache look × direction × frame
  (`w0…w5` walk, `i0 i1` sway, `t0…t3` toprock on the spot); the hero turns where he walks, now and then does a toprock; b-boys sway, turn
  to the hero when he is near, warm up (toprock) when you come up to them (`warmUp`). Clothes: ONE table in hero.js — `FIT` + `lookOf()`
  feed both `svg()` (output byte-identical to before — compared on 200 drawings) and the new `HERO.topDown(level, acc)` (types + flat
  colours); city adds its own things on top (`heroLook()`: headspin hat = blue beanie with a pad, city kicks = teal, pads, cardboard on the
  back while S.card > 0). B-boys: `look` in city-data.js {base level look, acc, col overrides, big}. hero.js `?v=13`.
  Night: half-resolution darkness layer with holes of light (lamps, door, kiosk while open, some skylights / windows — new every game day,
  a small glow round the hero, fire aura) + warm additive glow. Fog: 1 px per cell texture stretched with smoothing = soft darkness.
  Signs over places = drawn badges (`GFX.sign`), dimmed when the place is closed, faded when they would cover the hero; pigeons
  (`birds` in the data) fly off when you come close. HUD emoji (cash, bag, energy) unchanged. city.js `?v=4`, city-data.js `?v=2`.
  Tested headless 390×844 ru + 375×667 en: day / dusk / night in every corner, tap walk, joystick, dialogs, a round opens from the city,
  save, fog, no tab without the link, 60 fps while walking (desktop Chrome), no errors. NOT on a real phone (smoothness, memory, how
  readable the clothes are on a small screen).
  Graphics v2 (owner 13.11.2026 21:56 «слишком плоская картинка, добавь объёма… дома разной высоты… граффити на стены… застройку плотнее…
  добавь красок… уныло… изобилие как в Heroes III»): the world shows the ROOF AND THE SOUTH WALL of everything with height (old strategy-map
  look); people stay strictly top-down. A building keeps its cells: top = roof, bottom `wh` px = wall. `setMap` finds things as groups of
  touching cells (`comps`: houses `# b h`, garages G, kiosk K, tent S, court a, cars C — all rectangles); `house(B)` derives wall colour
  (WALLS), roof (ROOFS flat / tile / metal), height (home 88 px, tall block 136, `h` 36 / 50 / 64), windows, doors, shop fronts, graffiti spots
  from the place (seed) — new houses = just letters on the map. `piece()` = big graffiti letters (made-up), on walls, garage doors, the far
  fence. Chunks draw ground → court → shadows (`boxShadow`, to the right) → cell things row by row with the comps whose bottom row it is.
  New map letters: `h` house / shed / shop, `u` bush, `f` flower bed (walkable), `a` sports court (walkable), `P` playground (swing / slide /
  carousel / spring horse), `k` crates / barrels / tyres, `M` market stall; BLOCK in city.js = 'F#bGTKSXctDCLBhuPkM'. Yard map is much denser
  (reachability of every place and b-boy checked by flood fill). Brighter palette, chalk drawings, leaves, zebra, 4 tree colours, lit windows
  at night (`glow`, new every game day). city-gfx.js `?v=2`, city-data.js `?v=3`, city.js `?v=5`.
  Same day: b-boys got NICKNAMES instead of names (owner: «Витёк "Шаг" звучит некорректно» — his list: Хромосома, Винт, Ураган, Амёба,
  Кюрасао, Клик, Коготь, Нож; more in that style may be invented): yard = Клик (1) / Амёба (2) / Ураган (3, boss); ids vitek / lyoha / garik
  stay (saves). The rest of the list is for the next districts (Project doc). WORDING RULE (owner): toprock and footwork are DANCED
  («танцуют»), only powermoves are spun («крутят») — never «крутит топрок / футворк».
  Pull-to-refresh no longer starts from the city map (`#city` in the ptr touchstart guard): a drag down there is the joystick.
  Things to do, v3 (owner 13.11.2026 22:11 «ещё улучшай графику и добавь активностей… просто бегает по большой карте и нечем заняться…
  затягивающий»). All numbers in city-balance.js (`goals`, `pick`, `tag`, `job`, `stretch`); new save fields are filled from `fresh()` on load
  (old saves work). (1) DAILY FINDS: `picks()` = B.pick.n things per game day on reachable free cells (`freeCells()`, same places all day):
  coins (+2…5 cash), spray cans (item `can`), apples (+8 energy); `collect()` in step() when the hero is within .62 cell; numbers fly up
  (`pop` / `floats`). (2) TO-DO LIST: `goals()` = 3 of coins / win / show / deliver / stretch / tag per game day, `bump(kind)` from the
  events; +10 cash each, all three ⇒ +5 respect + a random find; HUD button `#cyGoals` «📋 n / 3» ⇒ `goalsDlg`. (3) TAGS: places type
  `wall` (3 in the yard, `ty` = where the wall is on the picture) — 2 cans ⇒ the player's tag stays there for good (`S.tags`, drawn by
  `GFX.mytag`: crown + «FT×»), +6 respect, all walls +10. (4) DELIVERY: kiosk button ⇒ `takeJob()` picks a door from `drops` (path > 8
  cells), timer in real seconds (4 + .3 × path), HUD chip «🌯 s», green ring at the door or an arrow at the screen edge; in time ⇒ pay
  6 + .4 × path (+5 tip when > 35 % of the time is left), late ⇒ nothing; 3 a game day, −3 energy; the timer waits while a dialog is open.
  (5) WARM-UP: place `gym` at the court ⇒ `stretch()` mini-game in the dialog (a runner on a bar, 4 taps in the green zone, faster each
  time): +5 energy a hit, 4 of 4 also cures the bruise; once a game day. Life (picture only): `walkers` (residents on the pavements 7–22 h,
  `walkerAt`), `traffic` (a car along the road), kiosk smoke, pink dawn / orange sunset tint. The idle loop is now a steady ~15 fps (66 ms)
  instead of the rare tick; 60 fps while walking, with a delivery or flying numbers. The camera may slide the map down from under the top
  panel (cam.y clamp − 112 px) so the far wall is visible. Signs `wall` / `gym` / `job`. 31 new i18n keys (901). city.js `?v=6`,
  city-gfx.js `?v=3`, city-data.js `?v=4`, city-balance.js `?v=3`. `CITY._picks()` for checks. Tested headless ru 390×844 + en 375×667 from
  an OLD save: finds, to-do sheet, tag, delivery in time / late, warm-up 4 of 4, reload keeps everything, day / sunset / night pictures,
  no errors. NOT on a real phone (battery at 15 fps, how tight the delivery timer feels with a finger).
  CREWS, v4 (owner 13–14.11.2026 «как крипы, но без убийств: победил в танце — банда исчезает и тебе что-то достаётся… затягивающий с
  первых секунд… уникальные шмотки… диджеинг, граффити, MC… хип-хоп проект»). Numbers: city-balance.js `duel`, `dj`, `goals.gang`.
  (1) `gangs` in city-data.js (yard: Ржавые 1, Кислотные 2, Ночные совы 3 — only 20–6 h, Золотые зубы 4): `gangsNow()` — every game day
  each crew dances in a slowly turning circle at one of its `spots`; a beaten one is gone till the next day; level +1 per `grow` (5) wins,
  size 2–5. Walking within 1.15 cells opens the challenge by itself (`gangCool` 5–7 s between), a tap works too. (2) THE DANCE-OFF
  `duel(o)` = layer `#cyDu` over the map: arrows ↑→↓← to SWIPE before the ring closes (arrow keys on a desktop), the last move of the last
  dancer = FREEZE (press and hold `holdMs`); 3 lives (+gear), combo, PERFECT when faster than 55 % of the time; time per move = ms − msLvl ×
  (crew level − 1), × (1 + lvlK × (hero level − crew level)) — the hero level comes ONLY from lessons (said in the dialogs, loss ⇒ button
  «К урокам»), × gear, × DJ. On the stage two rigged figures from hero.js (`HERO.svg(…, {rig})`, `setPose`, MOVES): mine does toprock /
  sixstep / windmill / swipe / freeze per swipe, shock on a miss; theirs taunts (burn), loses, the next one steps in. Beat = `RB.jam(id,
  bars)` (new export of rhythm.js, `?v=14`; respects `fedoskin-rb-mute`). `CITY._duel()` {need, hit, left}, `CITY._gangs()` for checks.
  (3) LOOT: cash 8 + 5 × level (up to +50 % for clean play), respect, sometimes a spray can, and GEAR — `DATA.gear`, 10 unique pieces
  (slot hat / top / kicks / ears / neck / hands, rarity 0–3, look `f` / `col` applied in `heroLook()` on top of the profile look, one perk:
  time / life / cash / rep / show / en / coin). A crew's first defeat always drops its first piece, later `drop` 35 %. Worn / taken off in
  the backpack (`S.gear {own, on}`), `perk(kind)` sums what is worn. (4) FIRST SECONDS: a new player gets no text — `hook()`: «Твой двор
  заняли» → «В круг!» → an easy tutorial dance-off with the Rusty crew (`tut`, 2 dancers × 3 moves, 1.7 s each, 5 lives, free) → the first
  piece. «Как играть» is still in the backpack. (5) MC Рупор (place `mc` on the court): the CYPHER — 5 dancers in a row at the top crew
  level, once a game day, −10 energy ⇒ cash + 6 respect + the legendary «Бомбер Сайфера» the first time. DJ Винт (place `dj` by the tent,
  drawn deck `GFX.deck`): mix mini-game = `barGame()` (shared with the warm-up), 5 cash, ≥ 3 of 4 ⇒ «Бит качает» till the end of the game
  day (+15 % time in dance-offs, +20 % hat at shows), 4 of 4 the first time ⇒ «Перчатки диджея». To-do list: one of the three is always
  «Разгони банды» (2). 54 new i18n keys (955). city.js `?v=7`, city-gfx.js `?v=4`, city-data.js `?v=5`, city-balance.js `?v=4`.
  Tested headless ru 390×844 + en 375×667 with REAL touch swipes: hook → tutorial → loot → worn on the hero; walking into a crew; a loss on
  purpose (energy −5, nothing else) and a win; backpack; DJ 4 of 4; cypher 25 moves; owls only at night; next day the crews are back;
  reload keeps gear. NOT on a real phone: swipe feel, time per move, the beat's sound (never heard by Claude), iPhone audio start.
  Not done yet: guard, other districts, balance by real play (no hand-played win yet), passers-by.
  GRAFFITI + TURF, v5 (owner 14.11.2026 «граффити точно сделай по районам… в разных стилях, а не простенький тег. Нужны большие классные граффити»;
  «сделай как будет лучше» about turf + arrows on the beat). Numbers: city-balance.js `turf` (+ `tag`, `price.can`).
  (1) THE PIECES — `GFX.graf({ word, style, pal, w, h, seed, extra, scale })` in city-gfx.js → a cached canvas. Our OWN letters: `GLY` = every letter
  (Latin, Cyrillic, digits, ! - .) as a few strokes on a 4 × 6 grid; `grafWord()` keeps only what can be written (≤ 8). The style decides how fat /
  round / tilted the strokes are and what is around: `tag` (slanted hand, underline with an arrow), `bubble` (throw-up: cloud, puffy letters leaning
  on each other, shine, bubbles, drips), `block` (blockbuster: rolled-on band, two-tone straight letters, hard shadow), `wild` (burst, leaning letters,
  light edge, arrows), `d3` (no outline, depth to a vanishing point). `GRAF_PALS` (6 for the player: fire / ice / candy / chrome / toxic / sunset; 4 crews),
  `GRAF_EXTRA` = signs beside the word: cog (Rusty), slime (Acid), owl (Owls), tooth (Gold), small crown on the player's first letter. No fonts, nothing copied.
  (2) WALLS — places with `wall: { x0, x1, row, hmax }`: GFX.setMap keeps that part of a house wall / garage doors / fence clean (no windows, doors,
  random scribbles; garages got taller doors, 64 px) and gives `GFX.wallRect(id)`; city.js draws the piece on top of the map every frame. Yard: type
  `turf` (with `gang` + `art`) = t_home (Rusty, RUST block, 188×67 on the player's own house), t_gar (Acid, ACID bubble, garages), t_tower (Owls, OWLS
  wild, 196×104 on the tall block), t_big (Gold, GOLD 3D, same block); type `wall` = 3 small free walls (2 fence, 1 garage). Crew spots moved next to
  their walls. A new district = its own walls and crew styles, data only.
  (3) RULES — beat a crew ⇒ `S.gt[gang] = S.t` ⇒ its wall is «open» for `turf.open` (24) game hours: sign turns green «Закрась!», the win dialog has
  «К стене банды» (`goPlace`). `paintDlg`: preview, the word (`S.word`, default = nick, else FT), style chips (a crew's style opens with the FIRST win
  over that crew — `styleOpen`; locked chip says which crew), 6 colour sets; cost 3 cans (small wall 2, repaint 1; «Кеды райтера» −1). `sprayGame`
  (overlay `#cySp`): the old piece on the wall, a faint sketch of the new one, the finger sprays it in (mask canvas + source-in), coarse grid counts
  coverage; ≥ 60 % ⇒ «Готово», 97 % ⇒ finishes itself; standing still 0.6 s ⇒ a drip (and paint lost); ≥ 93 % with ≤ 2 drips ⇒ «чисто» +2 ★; paint
  = 4 neat passes of the wall, out of paint below 60 % ⇒ nothing lost, try again. THE «Готово» BUTTON KEEPS ITS PLACE (visibility) — when it appeared
  with `hidden`, the wall jumped 28 px under the finger. Pointer moves use getCoalescedEvents. Spray hiss = `RB.hiss(on)` (rhythm.js `?v=15`).
  `painted()`: `S.tags[id] = { s, p, t }` (old saves `1` = tag); first capture +5 + 2 × crew level ★ (again +2); the point pays 6 + 3 × crew level cash
  every game day (`turfTick`, toast); not beating that crew for `hold` (3) game days ⇒ it paints the wall back (toast, ⚠ label with hours in the last
  day). All four ⇒ +15 ★ and gear «Кеды райтера» (perk `can`). Tutorial win gives 3 cans. Cans are sold in the tent (12). HUD chip «👑 n / 4».
  Goal «Нарисуй граффити». `CITY._walls()`, `CITY._spray()` for checks.
  (4) DANCE-OFF ON THE BEAT — `RB.jam()` returns stop with `t0` (when beat 0 is heard) and `spb`; duel(): every arrow appears exactly on a beat /
  half-beat (`onGrid`), looped dancer moves run in beat time, stage line + ring pulse (`--bp`), arrow pops. Time per move unchanged (level rule kept).
  No sound ⇒ the same grid silently. 42 new i18n keys (997). city.js `?v=8`, city-gfx.js `?v=5`, city-data.js `?v=6`, city-balance.js `?v=5`.
  Tested headless ru 390×844 + en 375×667 with real touch: tutorial → cans + style → walk to the wall → paint over RUST → point mine; guarded wall;
  beat Acid → paint with another word (Cyrillic); too few cans; lazy painting + «Готово»; income next day; wall lost after 3 days; free wall; night;
  reload; an old save with a tag; arrows on the grid; crews / DJ / cypher regression; a full rhythm round still opens. NOT on a real phone: how the
  finger painting feels, the hiss and the beat (never heard by Claude), whether arrows FEEL on the beat with iPhone / Bluetooth audio delay.
  HISS BUG + BACKGROUND BEAT (owner 14.11.2026 15:10 «шипение после батла с бандой… не ушло»; «хип-хоп музыку фоном… цикл бита, с басом»):
  rhythm.js had TWO `function hiss` in one scope — the spray one (v5) replaced the drum helper, so every snare / hat of EVERY beat (city
  jam AND the main rhythm battle) started an endless looping spray hiss. Spray is now `sprayHiss` (exported as RB.hiss); never reuse a
  helper's name there. City music: `RB.bgm(on)` = 2-bar boom-bap loop 88 BPM (kick, snare, swung hats, triangle bass A–C / G–F, soft keys),
  timer-scheduled 0.6 s ahead into its own gain → destination (.34). city.js `music()` (on show/hide/visibility + every 400 ms from frame):
  on only while the city is shown, page visible, and no round / dance-off / spray overlay; duel() and openRound() stop it first. HUD button
  `#cyMus` 🎵/🔇 = `fedoskin-city-music` ('0' = off). rhythm.js `?v=16`, city.js `?v=9`, i18n key «Музыка». Tested headless: a jam makes 0
  looping sources; city on ⇒ beat, 🔇 / home tab ⇒ silent, dance-off ⇒ off, after it ⇒ back. Sound itself never heard by Claude.
  WALL CLARITY + TAP FEEDBACK (owner 14.11.2026 15:16 «непонятно, как рисовать и куда точно подойти»; «анимацию кнопок всех, чтобы понятно было
  что нажал»). city.js: `paintable(pl)` (no own piece and: free wall, or crew wall with openLeft > 0) ⇒ on the map a dashed green moving frame + soft
  fill over the wall rect and a pulsing green ring + 🎨 + «Рисовать здесь» on the STANDING cell `standOf(pl)` (pl.at if walkable, else the walkable
  neighbour, below first; goPlace uses it too). A tap ON THE WALL PICTURE (it sits on a building) walks to standOf and opens it. Stepping onto the
  ring opens the wall dialog by itself (step(): < .6 cell, no path left; `wallNear` = not again until the hero is > 1.4 away). Tap ripple `tapFx`
  on the map where the finger touched. Spray overlay: clearer text, a moving 👆 «Води пальцем здесь» over the wall until the first touch (`#cySpH`),
  two labelled bars «Закрашено» (green, %) and «Краска» (paint left). index.html: `.tapfx` squeeze-and-bounce + light flash on EVERY button
  (`button, .btn, [role=button], .cychip, .cysw`), added from a capture pointerdown listener (iPhone barely shows :active), 8 ms vibration on touch
  (Android), off with reduced motion. #cyMus toggles in place (no HUD rebuild). 5 i18n keys (1003), city.js `?v=10`. Tested headless 390×844 ru:
  frame + ring visible, tap on RUST walks to (8,6) and opens the dialog, guarded wall explains, spray hint shows and goes on touch, stepping on the
  ring opens it, tapfx class on a HUD button. NOTE for tests: CITY._go into a building cell leaves the hero with no route at all.
  PICKUP FEEDBACK (owner 14.11.2026 15:48 «при поднятии предметов сделай звук или вибрацию»): collect() calls `RB.sfx(kind)` (rhythm.js, synth:
  coin = two bright bell notes, can = rattle of the mixing ball, apple/snack = soft crunch; quiet, off with `fedoskin-rb-mute`, not tied to the
  city music switch) + navigator.vibrate (coin 15 ms, others 12-40-12; Android only, iPhone web pages can't vibrate). rhythm.js `?v=17`,
  city.js `?v=11`. Tested headless: coin / can / snack each fire their sound and buzz once. Sounds never heard by Claude.
  ONE WARDROBE (owner 14.11.2026 15:51 «шмотки города и в инвентаре и на тебе в батле должны быть одни и те же… в городе можно найти уникальные или
  выиграть, которых нет в магазине… должно быть пересечение»). The 11 street pieces moved from city-data.js to hero.js `HERO.GEAR` (slot names =
  SHOP slots: head / top / kicks / ears / neck / hands; `src` gang:<id> | mc | dj | walls; f / col / perk as before) + `HERO.itemOf(token)`.
  Worn as the token `c:<id>` in the SAME list as shop items (`myEq`, `fedoskin-eq`, server hero_eq) ⇒ the same hero in the city, battles (cartoon
  + rhythm), rating, story, wardrobe. hero.js lookOf: gear f.hat / f.top win, flags gf (phones, chain, gloves), colour overrides co (topDown names);
  topDown merges them; svg() reads CO / GF / HC at shoes, sleeves, cuffs, track yoke/trim, bomber body/trim/hem, bandana / bucket, phones, chain,
  gloves. Without c: tokens svg + topDown are BYTE-IDENTICAL to before (compared 120 combos). One item per slot across both (`slotOf`, `eqWith`).
  Owned street pieces stay in the city save (`S.gear.own`; app reads `CITY.owned()` or localStorage `fedoskin-city`). City: worn = D.eq() c: tokens,
  wear(id) ⇒ D.wear('c:'+id, on) = app `wearCity` ⇒ shopWear; old `S.gear.on` migrated once into myEq at init; perks from worn c: items (city) + battle boosts (see below);
  gear cards say «видна на тебе и в батлах». App wardrobe: «Мои вещи» lists owned street pieces (blue `.cityit`, «🏙️ Из города») next to shop
  items; «Магазин» has a block `#cityShop` «Только в городе» with all 11 (owned ⇒ Надеть/Снять, locked = dark + where from + «В город →» which
  opens the city tab; no city flag ⇒ «Только в городе», disabled). shopWear: street-gear-only changes work offline / without a wallet; the server
  answer's eq is merged with local c: tokens (an old server drops them). btWallet keeps local c: tokens over the server's and lookSyncs once
  (`BT.cTried`). Server push-worker.js: `CGEAR` (ids → slot, keep equal to hero.js) — /hero/eq accepts c: tokens WITHOUT an ownership check (won
  offline on the phone), one per slot with SHOP; /visits `cg: 1` (admin banner until the owner updates the server code; admin «версия 51»). Until
  then other players don't see street pieces on him (he does). 9 i18n keys (1011). hero.js `?v=14`, city.js `?v=12`, city-data.js `?v=7`.
  Tested headless ru 390×844 with a mocked OLD server: migration city→wardrobe, wardrobe cards, wear acid kicks, shop bandana replaces the
  street bandana (same slot), «Только в городе» block, «В город →» opens the city, city backpack shows ✓ Снять, server got the c: tokens.
  CITY ⇄ BATTLES ⇄ LESSONS (owner 14.11.2026 16:01 «наоборот сделай, чтобы влиял город на батлы — лишний повод зависнуть в городе, а чтобы
  восстановить энергию для города нужно смотреть видео. Все пути ведут к видео»). (1) Street gear helps in RHYTHM battles (players, answers,
  practice, city rounds): HERO.GEAR[id].bt = { win ms | cor px | hold | save } (bandana/track +10 ms, acid kicks / owl phones / writer kicks +15,
  cypher bomber +20, acid bucket cor 4, owl hoodie cor 6, DJ gloves cor 8, gold chain hold, gold cap save) → `HERO.gearBoost(eq)` sums with caps
  win 30 / cor 12 / hold 1 / save 1. rhythm.js start(): `G.gb` from G.eq (= myLook()), `G.save`; tap windows + the miss sweep get +win;
  trajectory corridor +cor; hold: 72 px instead of 48 and grade kept from 82 % (else ≥ 40 % GOOD); save: the first MISS of the round becomes GOOD
  («SAVED 👕»). Only hitting is easier — scoring rules unchanged ⇒ the server's recount (from the hits string) still matches; auto play untouched.
  Setup screen line `.rbgear` «👕 Шмотки из города: …». Wardrobe cards + city gear cards show «⚔️ В батлах: …». Shop ⭐ items stay cosmetic.
  (2) City energy from LESSONS: city-balance `energy.perMin` 5 ⚡ per real minute of lesson playback (`stats.sec` via dep `lessonSec`), credited
  on CITY.show (`lessonEnergy()`, cursor S.lsec; a new save starts from now, no backlog; capped at emax, toast «🎬 Ты занимался по урокам N мин
  — +E ⚡»); sleep only lifts energy to `energy.sleep` 40 (toast says lessons refill the rest); low-energy buttons are now «🎬 Мало энергии —
  посмотри урок: 1 мин = +5 ⚡» → D.home(); the energy bar opens `enDlg()` (how energy works + «К урокам»); «Как играть» text updated. Food, nap,
  warm-up and «Разогрет уроком» unchanged. 15 i18n keys (1026). hero.js `?v=15`, rhythm.js `?v=18`, city.js `?v=13`, city-balance.js `?v=6`.
  Tested headless: gearBoost caps, setup note, a played round with the gold cap (1 miss forgiven) and synthetic taps 85 ms late (PERFECT with
  +20 ms; no-gear behaviour same as the previous version), 7 lesson minutes ⇒ +35 ⚡, energy dialog, sleep ⇒ 40. NOT on a real phone.
- City in 3D, draft 1 (owner 14.11.2026 17:25 sent a top-down 3D reference: «вот так надо было с самого начала… а не этот тетрис»; 18:54 «начинай»):
  separate page `city3d.html` + `city3d.js` (ES module, NOT linked from the app yet; the flat city stays as is). three.js r18x vendored in
  `vendor/three/` (MIT, three.module.js + three.core.js + addons used: RoundedBoxGeometry, EffectComposer/RenderPass/UnrealBloomPass/OutputPass/
  ShaderPass) via an importmap. Everything is built in code: low-poly props (crates, barrels, pallets, tyres, wood/chain fences, jersey barriers,
  dumpster, cars, hoop, speakers, boombox), canvas textures (concrete, asphalt, worn paint), ground decals (CYPHER ZONE, hazard bands, arrows,
  FEDOSKIN TEAM stencil, puddles), two buildings with lit windows + graffiti from CITY_GFX.graf, garages, lamps = SpotLights with shadows + fake
  light cones + dust motes; dusk hemisphere + moon; bloom + vignette + grain; perspective camera ~61° from the south following the hero.
  People = joint rigs from HERO.topDown looks (hero = my look incl. street gear); the crew of 5 dances in the cypher in turns on the city beat
  (RB.bgm, 🎵 button). Drag = joystick. Auto quality: fps < 40 ⇒ fewer pixels, then no bloom; `?fps` shows fps. Tested headless 390×844
  (swiftshader): renders, walks, no errors. NOT seen on a real phone yet (speed, heat, battery).
- City 3D dancers on MOTION CAPTURE (owner 14.11.2026: «элементы выглядят неправильно, кроме хедспина»; Fable's note: hand-posed from one
  angle can't be right; owner asked to copy a PS game's library — refused (copyright), Mixamo chosen instead; owner logged in, Claude
  downloaded 24 clips via Claude in Chrome — Chrome blocks multiple downloads until mixamo.com is allowed in
  chrome://settings/content/automaticDownloads). `anim/bboy.json` (~800 KB, 316 KB gzip): 24 clips (uprocks ×5, uprock→ground, footwork 1–3,
  footwork→freeze, swipes, 1990, flair, headspin start/spin/end, freezes ×6, ready, ending), 22-bone Mixamo rest pose. Converter: tools/mocap.
  `city3d-mocap.js` (`?v=1`): loadMocap(), mocapPerson(look) = THREE.Bone skeleton + our own low-poly body/clothes per bone (HERO.topDown
  colours, hats, chain, stripes, cuffs, girl ponytail), AnimationMixer, J.play(name, {fade, speed, once, at}). city3d.js `?v=2`: the crew =
  mocap persons; SETS = rounds toprock (stepping in) → to ground → footwork → power → freeze (cut lengths in s), then Bboy_Uprock back; watchers
  loop Ready. `?set=N` starts with round N. Hero still uses the old hand-made rig (no walk clip in Mixamo). Missing in Mixamo: windmill,
  airflare, backspin, 2000 (need video capture service later). Checked headless with side views of every clip (poses correct).
- City 3D GAME, step 1 (owner 14.11.2026 20:30 «продолжай… интересно: понятная система прогресса, ограниченная энергия, батлы на авто, но
  красиво — случайные комбинации, случайные исходы, падения; тапание — только во вкладке Батлы с реальными людьми»): `city3d-game.js` (`?v=3`,
  initGame(ctx) from city3d.js). Save `fedoskin-city3d` {en, day, lsec, rep, wins, beat, own, fights} — SEPARATE from the flat city save for now
  (street gear won here is NOT yet in the app wardrobe — merge when the 3D city replaces the flat one). BAL: energy max 100, start 60, battle 20,
  +5 per lesson minute (stats.sec delta, no backlog), new day → at least 40; respect for wins (12 × crew lv + 6 clean) → 6 ranks (Новичок двора …
  Легенда района) with a bar; HUD chips ⚡ / ★ (tap = explanation sheet + «К урокам»). CREWS: Ржавые 1, Кислотные 2, Ночные совы 3, Золотые
  зубы 4 — mocap people in their gear, ground ring + name sprite; within 3.1 m a button «⚔️ Батл с … · −20 ⚡» (low energy ⇒ «посмотри урок»).
  AUTO BATTLE: camera zooms in, both step in with toprock; turns opp → me (×2 rounds for lv ≥ 3); a turn = random toprock → Uprock_To_Ground →
  footwork → power (by level: swipes 1, headspin 2, flare 3, 1990 4) → freeze (Footwork_To_Freeze from 1.3 s / Crossleg) with outcomes:
  power fail chance .13 + risk − .06 × (lv − move lv) ⇒ CRASH (procedural fall: rig tilts and drops, slow-mo, camera shake, gets up), +0.5 for
  the try, no freeze; freeze fail ⇒ soft fall. Points: top 1, footwork 1.5, power 2–4, freeze 2, style .15 × lv + random. 3 judges = score diff +
  noise; win ⇒ respect, gear (1st win → 1st piece, 3rd → 2nd), crew gone till tomorrow; loss ⇒ «К урокам — стать сильнее». Simulated win rates:
  equal level 50 %, +1 ≈ 70 %, +2 ≈ 80 %. «Пропустить» counts the rest instantly. Hero = mocap person too: Ready / Bboy_Uprock base +
  procedural walk swings on the bones (UpLeg/Leg about local X, Arms about local Z — signs found numerically). `?lv=N` overrides the level.
  Tested headless 390×844: approach → button → battle → falls / clean → judges → reward → save; no errors. NOT on a real phone. Texts Russian only.
- City 3D transitions + light (owner 14.11.2026 20:57 «иногда фигурка телепортируется куда-то за круг. Добавь больше освещения»): the clips
  carry hips travel on the floor (Uprock_To_Ground 1.1 m, Swipes up to 1.6 m, Freeze vars 1.2–2 m), and every new clip started at 0 ⇒ jumps.
  ROOT MOTION in city3d-mocap.js (`?v=3`): loadMocap keeps the hips xz curve per clip (RM) and puts only y in the track; `J.tick(dt)` (use it
  INSTEAD of mixer.update) moves the rig by the active clip's own travel (wrap-aware), with a soft pull back (`J.pull` .55/s) and an edge
  (`J.maxR` .95 m); loops play the detrended curve (in place), travelling moves (TRAVEL regex: To_Ground, Footwork, Freeze, Headspin_Start/End,
  Ending) use the real travel; `play(name, {travel})` overrides. Checked frame by frame in node (60 fps): max step 3.6 cm per frame, never
  further than 0.95 m from the spot. Battle crossfades .3–.45 s. Light: exposure 1.62, hemisphere 1.55, lamps ×3.2 power, 3 new lamps
  (rusty / owls corners, yard middle) + warm/tinted PointLights over the cypher and each crew (no shadows — phone cost).
- City 3D, 14.11.2026 21:39 (owner «фоновую музыку как было; проработай передвижение человечка; при падении не проваливался под землю»):
  MUSIC: RB.unlock() (= audioOn, new export, rhythm.js `?v=19` in index.html + city3d.html); city3d startMusic on ANY pointerdown / touchend /
  click / keydown anywhere (capture) + a try 0.6 s after load; music keeps playing through battles. GAIT: hero walks on a still frame of Ready
  (timeScale 0) + gait on bones: phase advanced by distance covered / stride (1.25 m walk … 2.15 m run) ⇒ no skating; thighs (UpLeg X),
  knee bend on the swinging leg (Leg −X), toes roll (Foot −X), arms opposite (Arm Z: left +fwd? both −armA·sin), elbows (Left ForeArm +Z,
  Right −Z), forward lean (Spine +X), chest twist (Spine1 Y), hips bob ×2 per cycle. GROUND: J.tick measures the lowest real surface point
  each frame (capsule ends + radius, sphere centre + radius, box corners of other meshes) and lifts the rig at once (lowers softly);
  J.rest = lie exactly on the ground (falls). Falls no longer move rig y. Measured in node on real vertices: falls during headspin /
  1990 / flare / swipes 0 cm (were −48…−109 cm), normal dancing never below 0.
- City 3D walk fix (owner 14.11.2026 21:45 «он кувырками передвигается»): with the base clip paused (timeScale 0) the mixer stopped
  re-applying the bones, so the gait's quaternion multiplies piled up frame after frame ⇒ somersaults. Now `poseOf(clip, t)` (city3d-mocap
  `?v=5`) gives a fixed still pose of Ready (t .05); every walking frame first copies it into the GAIT bones (+ hips height), then adds the
  gait. RULE: never multiply onto bone rotations that the mixer may not rewrite — always start from a known base. Checked: 25 s of joystick
  walking, head stays 0.49 m above the hips (was going below the hips after ~10 s).
- City 3D, 16.11.2026 (owner «продолжи работу над городом»): (1) ONE WARDROBE: a won street piece goes into S.own AND is put on at once
  (`wearGear` → fedoskin-eq, one per slot via HERO.itemOf().slot; city3d `rewear()` rebuilds the hero person in place); app `cityOwned()`
  in index.html now unions the flat city's gear with `fedoskin-city3d`.own. (2) DAILY GOALS: 3 a day (seeded by the date) from GOALS (win,
  win ×2, clean win, paint a wall, 3 lesson minutes, watch the cypher 8 s, beat a crew lv ≥ 2); each +5 ★, all three +15 ⚡ once; HUD chip
  📋 n/3 → sheet. (3) CREW WALLS: a free-standing slab per crew placed ~2.9 m from its spot on a free side (colliders checked), art =
  CITY_GFX.graf (RUST block / ACID bubble / OWLS wild / GOLD d3, same as the flat city); after beating a crew that day ⇒ button «🎨
  Закрасить стену» (−10 ⚡): hero walks up, sprays (RB.hiss), my piece (profile nick or FT, crew's style, fire palette, crown) wipes in
  from left to right on the canvas texture ⇒ S.turf[id], +8 ★, every new day +3 ★ per wall; crew not beaten for 3 days paints it back.
  HUD chip 🎨 n/4 → sheet. Save fields added: turf, last, goals, goalsDay, goalsPaid, lday, word. Tested headless 390×844: win → bandana on
  the hero + in fedoskin-eq → paint → turf + goal; no errors. city3d-game `?v=7`, city3d.js `?v=9`.
- City 3D battle sounds (16.11.2026): RB.sfx new kinds hit / crash / win / lose (own synth + filtered-noise crowd; rhythm.js `?v=20` in
  index.html + city3d.html); clean power/freeze ⇒ 'hit' + short camera punch (zoom .34 → .4), fall ⇒ 'crash', verdict ⇒ 'win'/'lose' after
  the judges' cards. city3d-game `?v=8`, city3d.js `?v=10`. Sounds never heard by Claude.
- City 3D places (16.11.2026 09:14 «додумывай… добавляй локации и действия»), all in city3d-game.js (`?v=11`), PLACES + placeBtn/placeRun,
  shared proximity button (key() compares crews / walls / places): (1) CYPHER «Выйти в круг» — free once a day, my own random set (makeTurn
  with buffs), crew steps back and watches (`W.cyBusy` hook at the top of updateCrew in city3d.js), +4 ★ (+3 clean), goal show; (2) DJ
  booth by the cypher (table, spinning records, glowing strip, DJ mocap person) — «Заказать бит» −5 ⚡ ⇒ today in battles −3 % falls and
  +0.4 style (`buff()`), goal dj; (3) PRACTICE MAT (blue padded mat, cones) — −8 ⚡, plays my best power move (30 % fall), +1 form (max 3
  a day) ⇒ −3 % falls and +0.15 style per point today, goal train; (4) GATE «ЦЕНТР →» (arch + chain) — opens with rank «Уважаемый»
  (BAL.gateRank 2), until then shows how much ★ is missing; after that «строится — скоро» (the next district is the next big step).
  Positions found by `freeNear()` against the colliders. New goals: show, train ×2, dj. Lights trimmed to 6 PointLights (phone cost: were 9).
  Emulator note: swiftshader runs ~0.1 game s per real s here — give tests minutes, not seconds. Tested all four places headless, no errors.
- City 3D DISTRICTS + «ЦЕНТР» (owner 16.11.2026 09:39 «продолжаем 3D-город, строим Центр»). One page, the district is chosen at load:
  `?d=center` (test link, opens it whatever the rank) or the save's `where` (city3d.js DISTS / DIST; W.dist, W.bounds, W.tickers — per-frame
  hooks of a district). `build()` = shared textures → `buildYard()` or `buildCenter(TK)` (NEW city3d-center.js, gets the toolkit of city3d.js)
  → the hero at the district's spawn. The gait is now `stride(H, s, sp, moving, k, dt)` + `standPose(H)` — shared by the hero and walking
  people. lamp() takes `col`. CENTRE scene: pavers, the mall «КРУГ» (own facade canvas: glass storeys, shop windows with dummies, lit
  entrance, canopy with a leaning sign — signs lean back ~0.6 rad or they can't be read from the camera; roof sign, a screen with 3 adverts),
  glossy tiled apron, fountain with a bronze b-boy (mocap Freeze_Var_2 @2.0 s, paused), metro pavilion open to the SOUTH (anything that must
  be read faces +z: the camera looks from the south), tea kiosk, bus stop, benches, trees only on the east edge (tall things south of the
  walking area hide the hero), street with a passing car, houses west/east. People: GUARD walks z −13.5, x ±11 (1.25 m/s, 4.5 s pause),
  red ring = `see` 3.2 m; 5 passers-by on a loop, 2 idlers at the doors; `W.center = { show, guard, crowd(on), kiosk, metro, gateYard, gatePark }`.
  GAME (city3d-game `?v=12`): CREWS have `d`, `wall` [x, z], `base` + `fix(look)`, `boss`; HERE = crews of this district. Centre crews:
  Трафареты 3 (stencil), Турникеты 4 (tile mosaic), Хромированные 5 (chrome, boss «Хромосома», first win ⇒ «хозяин Центра»). New graffiti
  styles in city-gfx.js `?v=6`: stencil / chrome / tile (NOT in GRAF_STYLES — the flat city's picker is unchanged), pals stencil / metro,
  signs can / token / chromo. 6 new gear pieces in hero.js `?v=16` (stencilBandana, stencilBomber, turnBucket, turnKicks, chromeKicks,
  chromeTrack) + CGEAR in server/push-worker.js (NEEDS A SERVER REDEPLOY by the owner) + names in 9 languages; index.html cityGang knows
  the 3 crews. Places: yard gate now really leads to the Centre (rank «Уважаемый»); Centre: «Шоу у ТЦ» (−10 ⚡, 2 a day, my random set,
  tiles −4 % falls, +6 ★ +4 clean; guard within 3.2 m ⇒ cut, +2 ★ — start right after he has passed: ≈18 s free vs a 13.5 s set),
  tea kiosk (+5 ⚡ per my Centre wall, once a day), metro = map of the city + ride to the yard, arch «← ДВОР», arch «ПАРК →» (closed; after
  the boss «скоро»). Ranks +2 (1100 Голос улиц, 1700 Имя города). Goals mall / cwin join the pool after the first visit. Save fields:
  where, seen, mallDay, teaDay. Tested headless 390×844: show clean / caught / limit, battle + gear, painting, metro map, yard ⇄ centre,
  yard unchanged; no errors. NOT on a real phone (speed with ~18 animated people!). Texts Russian only. Emulator: dt-driven things
  (painting, guard) crawl — wait a minute or move them by hand.
- City 3D PEOPLE + «ПАРК» (owner 16.11.2026 14:00 «продолжи работу над городом и так же улучши визуал человечков, добавь разнообразия (разный
  вес, рост, типаж)»). (1) BODIES, city3d-mocap.js `?v=6`: BODY_TYPES (avg, slim, lanky, athl, stocky, heavy, big, small) = numbers that reshape
  our figure on the SAME mocap skeleton: h (whole rig scale), limb / arm radii, chest / waist / hip widths (clavicle and hip-joint offsets are
  scaled — the only change to the skeleton, moves untouched), belly (a sphere on Spine), head size. `bodyOf(seed, o)` = a seeded person: type,
  ±5 % jitter, skin (6 tones), hair colour (10) and style (short, buzz, bald, afro, top, mohawk, dreads, curly, long, tail, bun, buns, braids),
  beard, optional pack / coat / hood / dye. mocapPerson(look, { body }) — without a body the plain average figure (the hero). Also new for
  everyone: tapered torso (hips in trousers + hem + chest + shoulders), eyes, ears, nose, thumbs, bare forearm under a short sleeve, headphones,
  wristband and knee pads (they were in the look but never drawn in 3D), hair tucked under hats. Crews carry `bodies` (a type or a full body per
  member), the DJ is heavy with dreads, the guard is big, the Centre's passers-by are townsfolk (old man in a coat, schoolgirl with a backpack…).
  Cost: ~10 more meshes per person — watch the speed on a real phone. (2) PARK: NEW city3d-park.js (`?v=1`), `?d=park`; DISTS.park in city3d.js
  (`?v=15`). Scene: grass + gravel alleys, the granite embankment (z −12) with globe lamps, the river (emissive streak texture that drifts, a
  boat with a garland every 46 s, the far bank), the stage «ЭСТРАДА · JAM» (round wooden floor r 3.1 at −6.6, −5.9, a shell behind, garland),
  chess tables with the old-timer «Маятник», a street-workout corner, park lamps (only 5 carry a PointLight), fireflies, walkers on the ring
  alley (granny, heavy man, kid) and two joggers. Tall things only on the edges / north. W.park = { stage, dancers[3], og, bars, crowd,
  gateCenter, gateProm }. GAME (city3d-game `?v=14`): crews Фанк-бригада 5 (FUNK, bubble, sign boom), Корни 6 (ROOTS, wild, leaf), Волна 7
  (WAVE, d3, surf; boss «Кюрасао» ⇒ «хозяин Парка»); pals funk / roots / wave + the 3 signs in city-gfx.js `?v=7`; gear funkTrack, rootsBeanie,
  waveKicks (one per crew, first win) in hero.js `?v=17` + CGEAR in the worker (SERVER REDEPLOY) + 9 languages. Places: JAM on the stage
  (−25 ⚡, once a day): three battles in a row on the normal battle engine — the «crew» is one stage dancer with `c.tour` (no energy per
  battle, 1 round, jamResult() instead of the crew rewards, endBattle starts the next round), lv 5 / 6 / 7 (Шуруп, Ртуть, Кобра), +10 / +16 /
  +24 ★ and +30 for all three; a lost battle ends the jam. «Маятник»: once a day +8 ★ +10 ⚡ if ≥ 5 lesson minutes today (else the button
  leads to the lessons). Warm-up at the bars: free, once a day, −4 % falls today (buff()). Arches «← ЦЕНТР» and «ПРОМЗОНА →» (closed; after
  the boss «скоро»). The Centre's park arch now opens after beating Хромированные (or once the Park was seen); the metro map rides to the
  Park. Goals pwin / jam / og after the first visit. Save fields: jamDay, ogDay, warmDay, jamWon, seen.park. Tested headless 390×844: people
  line-ups in all districts, warm-up, mentor button, jam (lost in round 1 three times with real votes; all three rounds with forced votes),
  boss win → gear + «хозяин Парка», Centre ⇄ Park, metro map, yard unchanged; no errors. BALANCE NOTE: with both sides lv ≥ 4 a one-round
  battle is close to a coin flip (same power list, style differs by .15 per level, judges ±1.2), so winning the whole jam is rare — tune
  jamLv or the vote noise after the owner tries it. NOT on a real phone (speed: ~20 animated people in the Park), sounds never heard.

### City 3D — smooth bodies, dimmer fixtures, walking off the floor, district «Промзона» (16.11.2026, evening)
Owner: «Продолжи работу над городом, а так же улучши визуализацию человечков (меньше шарнирности), так же слегка уменьши яркость освещения от световых приборов (слишком ярко), так же проработай уход человечка с танцпола (можно просто шагами, не надо танцем)».
- **People** (`city3d-mocap.js`, `skinGeo`): torso + arms + legs are ONE `SkinnedMesh` per person (rings of vertices along the bones, two-bone blend near joints, vertex colours for top / sleeves / skin / trousers, small inner balls at knees, elbows, shoulders). Head, hands, shoes, accessories stay rigid on the bones. Jacket zip and trouser stripe are skinned strips. Ground contact points of the body now come from the bones (`PTS` with `m: bone`). `J.body` = the mesh; `rig.scale` is set AFTER binding. `J.play` of the clip that is already current keeps its weight (a fade-in from 0 mixed in the T-pose).
- **Light**: `LAMP_K` 3.2 → 2.5 (spots), glowing strip 3.2 → 2.5, fake cone .085 → .066, fill PointLights × `FILL_K` .8 (also in Centre / Park / Промзона via `TK.FILL_K`), speaker rings and bloom a little lower (.55 → .46, threshold .84), Park globes 1.5 → 1.25.
- **Leaving the floor**: `W.walk = { start, move, pose }` in `city3d.js`. `start(J)` once (absorbs the root-motion offset, remembers the pose, pauses «Ready»), `move(J, dt, tx, tz, k, endFace)` BEFORE `J.tick`, `pose(J, dt)` AFTER it; clear with `J.ws = null`. Used by the yard cypher (2.2 s walk + turn), battles and shows (`OUT` 2.3 s, `OUTW` 1.7 s in `city3d-game.js`). `stride()` got `s.from` = blend from the pose the dance ended in.
- **Промзона** (`city3d-prom.js`, `?d=prom`, `W.prom`): foundry hall with a glowing gate and a welder, chimney, rail trolley with hot metal, containers, transformer yard, fire barrels, the RING. Crews: Арматура lv 6 (`rebar`), Высоковольтные lv 7 (`volt`), Литейка lv 8 (`forge`, boss Коготь). Gear: `rebarCap`, `voltKicks`, `forgeChain` (hero.js GEAR + worker CGEAR + 9 languages). Graffiti palettes `rebar / volt / forge`, signs `nut / zap / drop`.
  - Ring: −15 ⚡, 2 a day, one round vs a random regular lv 6–8; win = 14 ★ + 4 ★ per win already in the streak (max 5 steps); the streak survives the night, a loss resets it (`S.streak`, `S.best`, `S.ringDay`; battle flag `c.ringB`).
  - Stashes: 3 of 7 spots a day (seeded by the date), +6 ⚡ and +3 ★, or (1 in 3) +6 ★ (`S.stash`).
  - Entry: the Park's arch opens after the first win over «Волна» (`S.wins.wave || S.seen.prom`). Arch «КЛУБ →» is closed («скоро» after Литейка).
- Testing: the cypher runs on `performance.now()`, the emulator is slow ⇒ tests replace `performance.now` / `requestAnimationFrame` with a virtual clock (33 ms per rendered frame). Checked headless: all four districts load with no errors, cypher walk-off, ring battle (loss), boss battle (win → gear), stash.
- Not checked: a live phone (speed with skinned bodies, sound). The server must be re-published from the admin for the three new gear ids.

### City 3D — hero without hinges, real walk/run, clothes custom (16–17.11.2026, owner «улучши визуал главного персонажа, он всё ещё слишком шарнирный, улучши бег (выглядит не естественно), добавь механику улучшения одежды… нашивки»)
- BODY (city3d-mocap.js `skinGeo` + body block): hands are no longer boxes on the wrist — palm, knuckles, curled fingers and a thumb grow out of the arm's skin;
  sneakers are a closed sole + upper bending at the toes (laces, toe cap, heel); the top is its own layer over the trousers (hem / rib band, chest, sloped
  shoulders, crew neck / stand collar / rib collar, yoke colour on the shoulders, zip line), sleeves end in a rib cuff or an open sleeve, trousers are roomier
  and stack on the shoe (track pants end in a cuff), paint-shading under arms / between legs, a soft rim light (SKIN_MAT.onBeforeCompile). `{ hero: true }`
  = more segments for the hero. All 8 body types, girls, coats, backpacks checked in a line-up render.
- WALK / RUN: the owner downloaded «Walking» + «Running» from his Mixamo account (X Bot, FBX without skin, 30 fps) and attached them in chat; converted with
  tools/mocap/drop.html in his Chrome AND tools/mocap/fbx2clip.py here — identical on all 46 tracks; same skeleton as anim/bboy.json. Walk 1.78 m/s 1.84 m/loop,
  run 5.92 m/s 3.75 m/loop; phase 0 = left foot furthest ahead (walk frame 8/31, run 4/19). `stride()` blends Ready → walk by speed, walk → run between 2.1 and
  4.3 m/s, phase advanced by distance / loop length (shorter steps when slow). Hero `HERO_SPD` 3.6 → 5.2; a tap further than 4.5 m = run, nearer = walk; the idle
  animation waits until the step settles (s.wk < .03). Side-view strips at 1.6 / 3.2 / 5.2 m/s: feet on the ground, natural arms, flight phase in the run.
- CUSTOM: «Ателье «Игла»» in the yard at freeNear(8.6, −2.2) (between the DJ and the mat, facing the camera): rug, table, sewing machine, spools, rack of jackets
  with patches, a dummy with a back patch, neon «КАСТОМ», a bulb + SpotLight 46, the tailor (slim girl, bun). The sheet: 4 parts × 3 details —
  Кроссы (fat laces / gum sole / glowing strips: +.15 pts per level on toprock & footwork), Верх (chest patch / sleeve patches / back patch: +.15 style),
  Штаны (reinforced knees / cargo pockets / wallet chain: −2% freeze falls), Голова (pin on the hat or a sweatband / spin pad / glowing band: −2% power falls,
  headspin another −2%). Cost 25 / 50 / 80 ⚡, level 2 from «Свой», level 3 from «Авторитет». While the sheet is open the hero stands by the stall and turns
  slowly (turntable) under a close camera. Headless note: full-page screenshots with a transparent full-screen overlay sometimes show the page colour instead
  of the canvas — the renderer's own output is fine (checked by reading the composer output); not a game bug.

### City 3D — standing people without jerks, one-shot moves, texture check, open to everyone with an alpha warning (17.11.2026, owner «улучши движения фигурок пока те находятся на месте (сейчас они глючат слегка), проверь текстуры… добавь город в открытый доступ для пользователей, предупреди ещё раз, что это альфа»)
- WHY THEY JERKED: everybody standing looped «Breakdance_Ready», but that recording is a 1-second SIDESTEP into the stance (hips travel 43 cm, left hand 52°),
  not an idle — looped, every standing person snapped back by up to 38° (hand 12 cm in one frame) once a second.
- STANDING LOOPS (city3d-mocap.js `makeStand`): built at load from real looping mocap, played softly over the calm first frame of Ready
  (q = slerp(start pose, recorded frame, a); a = upper body, al = hips + legs so the feet don't skate). «Stand» = from Bboy_Uprock (a .2, al .07) — b-boys
  bobbing to the beat (crews, the hero, DJ, jam/ring dancers, the old-timer); «Stand_Calm» = from Walking slowed to .45 (a .28) — weight shift for
  passers-by, the guard, workers, the tailor (`J.setIdle('Stand_Calm')` or `mocapPerson(look, { idle })`). `J.play('Breakdance_Ready')` now means
  «this person's standing loop» (`{ raw: true }` for the real recording); replaying the loop that is already on does nothing (no restart from frame 0).
  The first clip of a new person starts at full weight (it used to fade in from the T-pose: a flash at load and after changing clothes).
- GAIT over the loop: `standPose` no longer PAUSES Ready on a frame (walkers stopped as statues, then jerked); `stride` takes its base from `standAt(loop,
  action time)` (or the mixer's live pose while a crossfade into the loop runs), so a step ends exactly on what the mixer plays next; the hero's
  idle/toprock switch waits for the step to settle (wk < .004). walkStart plays the loop instead of pausing Ready. rewear keeps the clip and its time.
- ONE-SHOT clips: a recording whose last frame is far from its first (seam > 15°: going down, freezes, Swipes, Headspin start/end, Ending, Footwork_To_Freeze)
  plays LoopOnce + clamp — a frame late it used to wrap to its first frame (the cypher dancer jumped up from the floor for one frame, ~1 m, between going
  down and footwork). Almost-loops (seam .3…15°: Indian step 9.5°, Uprock_Var_1, Footwork_3…) are closed at load (`closeLoop`: the difference spread over
  the clip). Measured headless (limbs relative to the person, per frame): standing ≤ 2.5 cm/frame everywhere, no spikes in walk → stop → stand → toprock → walk.
- TEXTURES / LIGHT (checked all 4 districts, 3×3 views + close-ups): Centre tea kiosk — the light sat at the awning's edge and burnt a white blot into the
  stripes → under the awning, power 12, stripes off-white; yard atelier — spot 46 → 20 (table and cloth were white), neon «КАСТОМ» raised (was behind
  the place's name); Промзона — the roof sign stood inside the saw-tooth roof (dark wedge through the letters) → moved in front (z FZ + .45); ground paint
  fonts got `Impact, sans-serif` fallbacks (if Google Fonts fail, canvases fell back to a serif font). Note: headless has no Anton — screenshots show fallbacks.
- OPEN ACCESS: the app's «Город» tab now opens the screen `#cityhub` (index.html): cover `img/city3d.jpg`, «Войти в город» → city3d.html, the alpha card,
  «Пока в городе всё на русском…» for non-ru, «Сообщить об ошибке» (coach chat with a prefill, svc 'city'), «Простой 2D-город» (the old flat city stays
  in `#city`, which city.js owns — never put markup there). `?city=play` and the shop's «get it in the city» go to `#cityhub`. city3d.html: first-visit
  alpha notice (`fedoskin-city3d-alpha`), 9 languages inline (same language rule as the app), HUD tag «α АЛЬФА-ВЕРСИЯ», «←» = history.back() to the app
  when we came from it, else ./?city=play; the no-WebGL message links back. Inside the city texts are still Russian only.

### City 3D — SPEED: shadows were 80% of the work (17.11.2026, owner «Вероятно стоит снизить графику или оптимизировать лучше, но у меня на айфоне 17про раз в 5 секунд притормаживает на 1-2 секунды (снижается фпс)… Займись оптимизацией»)
- MEASURED headless (draw calls per frame, renderer.info): yard 975 (picture ≈ 180, shadows ≈ 780: moon 568 + 3 lamp spots ~70 each),
  centre 693, park 559, prom 595. Game logic on the CPU was light and flat (~0.4 ms/frame in V8, no periodic spikes over 30 s, no runtime
  creation of people/materials/textures), so the stutter is the render load sitting at the edge of the frame budget on Safari (each
  draw call is costly there), not one periodic job. The exact «every 5 s» pattern was NOT reproduced (no real iPhone here) — ask the owner
  to open `city3d.html?fps` (shows fps, the WORST frame of the last 2 s, draw calls, pixel ratio) if it still happens.
- NOW (same spots, same picture — screenshots old vs new identical, mean diff ≈ 0.01/255): yard 963/1047/824/662/983 → 465/534/348/234/459
  (before the per-bone person pieces; after them the yard spawn view is ~300), centre 605…788 → 257…379, park 300…620 → 126…345,
  prom 551…851 → 179…449.
- What changed (new file `city3d-perf.js?v=1`, imported by city3d.js AND city3d-mocap.js with the same `?v` — keep them equal):
  1. SHADOW BATCHING `shadowBatcher(scene)`: after 40 frames of settling, every static caster (plain material, plain geometry, not under a
     person) stops casting; its shadow is drawn by merged depth-only pieces (one per 8×8 m cell × shadow side) on LAYER 1. Shadow cameras get
     layer 1 via `SB.useFor(light)` (three r187 uses the shadow camera's layers if it has any besides 0); the main camera never sees layer 1.
     A watcher (¼ of the items per frame) compares matrixWorld / visibility / geometry: anything that moved, hid, left the scene or changed
     shape casts its own shadow again and its cell is rebuilt (one per frame). NOTHING needs marking by hand; `userData.dyn = true` forces
     an object out of batching. `SB.stats()` in the console via `CITY3D.SB`.
  2. `trimCasters(scene)`: static meshes with radius < 6 cm or flat on the ground (< 6 cm tall, top < 10 cm) cast no shadow.
  3. PEOPLE (city3d-mocap.js): parts with radius < 5 cm (eyes, ears, laces, pins) and CircleGeometry patches cast nothing; the other rigid
     parts on one bone cast through ONE merged piece hung on that bone (`personShadows(root)`, head + hair + cap = 1 draw). The skinned body
     is now frustum-culled with a fixed sphere (centre (0,.8,0), r 1.8 in rest space — enough for any pose: hips x/z are stripped from the
     clips, root motion moves the rig); before, every body was skinned and drawn in every shadow map even far off screen. `root.userData.person = true`.
  4. MOON: the ortho shadow frustum is fitted to what the screen shows (camera frustum ∩ y 0…12 m, in the moon's view, + .8 m), recomputed
     in resize() (`fitShadows`); the map size keeps the old texel density (2048 / 32 m) → ~1536², sharper-or-same, fewer objects inside.
     Moon offset is `MOON` (−9, 22, −6) from the camera's look point. Camera zoom is always ≤ 1, so the fit for zoom 1 covers battles too.
  5. LAMP SPOTS with shadows: `shadow.autoUpdate = false`; the map is redrawn only while the ground the lamp lights (circle of
     height·tan(angle) + 1.2 m) touches the visible area `VIEW` (ground up to 4 m, from fitShadows). Off-screen lamps keep a stale map.
  6. HUD on phones (city3d.html, `@media (pointer: coarse)`): no backdrop-filter blur on .hb and the #g3hud / #g3hud2 chips (Safari re-blurred
     the moving canvas under each panel every frame); background .8 instead.
  7. `?fps` readout: «N fps · худший кадр X мс · N выз. · PR».
- Not changed: lights (15 in the yard, all per pixel), bloom, MSAA, pixel ratio and the quality guard (fps < 40 twice → fewer pixels → no bloom).
  If the phone is still not smooth, next levers: fewer fill PointLights per district, pixel ratio 1.75 on phones, main-pass batching of
  static meshes by material (only ~48 static draws in view vs ~90 person parts — people parts by bone+material would be the bigger win).

### City 3D — the camera keeps the hero after a change of clothes, other people dressed one by one, two-finger zoom (17.11.2026, owner «Улучши визуал других человечков. Исправь баг (мой человечек выбежал за кадр и его не видно). Добавь возможность двумя пальцами зумить экран (карту), чтобы можно было видеть всю область, когда есть такая нужда»)
- THE BUG: the frame loop (city3d.js) took `hp = W.hero.root.position` ONCE at boot. `rewear()` (a gear piece won in a battle → wearGear, or a
  detail bought from the tailor) builds a NEW person and removes the old one — the camera kept following the old, removed position and the
  hero walked out of the picture (owner's screenshots: right after a battle with «Ржавые»). Now the hero is read every frame. `CITY3D.rewear`
  is exposed for tests. (The dark blots in his screenshots are the yard's puddle decals, not a bug.)
- PEOPLE (city3d-game.js `CSTY`, `dress`, `tidy`, exported `crewLook(c, ci, i, D)` — the crews' body + clothes, also used by test pages):
  members used to wear the hero's outfit of their level (the team's black + orange) → crews were clones. Now each member gets his own cut
  (hoodie / tee / teeBig / track / bomber), trousers, a hat or none (afro, mohawk, dreads, top, bun(s), curly, braids, long ⇒ no hat, the hair
  shows), headphones only on every 3rd, a chain only on every 3rd (unless it is the crew's prize), a wristband in the crew colour on half.
  Yard crews have palettes (Ржавые rust/brown workwear + jeans, Кислотные black/violet/acid green, Совы navy/grey hoodies, Золотые зубы white
  and gold); the other districts keep their colours through `c.fix` (applied after `dress`; `tidy` keeps a hoodie one colour). The crew's
  prize item (`c:<gear>` slots from HERO.itemOf) is never touched. hero.js untouched.
- BODIES (city3d-mocap.js `?v=11`): everyone has the hero's mesh detail (NT 24 / NA 14 / NL 16, sneaker rings 16: +560 vertices a person,
  draw calls the same; the hero keeps his slightly bigger hands and shoes). New top `hoodie` (hood, rib hem/cuffs, kangaroo pocket on Spine,
  two drawstrings). CHAIN = a closed tube that lies on the shoulders outside the collar and hangs onto the chest (heavy: longer, thicker, a
  medallion; follows a belly) — it was a flat ring around the neck. BUCKET hat = a lathe crown + band in the 2nd hat colour + brim sloping down
  (was a cylinder = a top hat); custom details on it moved to the new crown. Belly = flatter, taller oval (was a ball). `M2()` = cached
  two-sided materials. Small parts (radius < 4.5 cm, not glowing, not patches) carry `userData.tiny`.
- ZOOM (city3d.js): `W.uZoom` (ZMIN .7 … ZMAX 3, saved in `fedoskin-city3d-zoom`), pinch on the canvas (every finger tracked; a 2nd finger
  cancels the joystick/tap of the 1st, nothing new starts until all are lifted), mouse wheel, Safari gesture events blocked. W.camT (battles,
  actions) still sets its own zoom and gives the player's back afterwards. With the zoom: look point offset ×zoom (hero stays low on the
  screen), fog density / zoom, name tags (sprites with depthTest false) × zoom^.6, the moon's shadow refitted per ¼ step (`zoomBucket`: grows at
  once, shrinks when the camera settles; ground clamped to ±19 m; map ≤ 2048 → softer shadows far out). Far out (zoom > 1.7): tiny parts
  hidden, moon shadow every 2nd frame, lamp shadows take turns (1 in 3). Hint got a 2nd line and moved up to 100 px (the place button covered it).
- MEASURED headless, yard spawn: draw calls 376 → 386 (people), zoom 3: ~680 / ~520 alternating frames (814 without the far-out savings).
  Tested: all 4 districts load clean, battle with Ржавые (skip → win → bandana put on → rewear) + walking 12 m: hero stays at screen centre;
  pinch in/out via CDP touch; line-ups of all 13 crews. NOT on a real iPhone (pinch feel, speed when zoomed out).

### 17.11.2026 — glare on people + footwork variety (City 3D)
Owner (screenshot of a battle with «Ночные совы»): «Снизь отблик от фонарей, посмотри какой сильный пересвет (будто зеркало на кроссовках
отражает полностью). Добавь вариаций футворка во время батлов (слишком однообразно начинают и делают все)».
- GLARE, cause (measured: HDR luminance before tone mapping, read from a float render target in a battle frame): white soles / a white tee
  under a lamp + the crew's fill light reached 1.2–1.6 (lamp strips ≈ 1.4). The bloom threshold is .84 with a hard edge, so anything just over
  it bloomed at full strength ⇒ white sneakers grew a halo like a mirror. The body's rim light (SKIN_MAT) was ×albedo, so it added most on
  WHITE edges (soles seen edge-on from above).
- GLARE, fix (city3d-mocap.js `tameHi` / `tame()`): everything a person wears (SKIN_MAT, `M()`, `M2()`, patches; NOT `glowOf` — custom
  glowing details stay glowing) rolls brightness off softly above .5 and never passes .8 (below the bloom threshold); colours keep their hue.
  The rim fades to 30 % on light colours. Bloom (city3d.js): soft knee `highPassUniforms.smoothWidth = .36` (glow fades in over .84…1.2).
  Lamps / LAMP_K / exposure untouched — the yard is as bright as before. After: max luminance on people .80, no halos on shoes; the yard
  overview, the cypher ring and speaker rings look the same.
- MIRRORED MOVES (city3d-mocap.js `MIRROR`, `mirrorClip`): «<name>_M» copies of the 3 footwork recordings, Footwork_To_Freeze, the drop,
  the 5 toprocks and Crossleg_Freeze — Left/Right tracks swapped, quats (x, −y, −z, w), hips x negated. The rest skeleton is symmetric,
  checked in node (all joints of the copy = reflected original, error 0.0000 m) and by eye (pairs side by side).
- FOOTWORK COMBOS (city3d-game.js `FW`, `makeTurn`): the drop goes left or right at speed .95–1.15 and lands turned 15–65°; then 2–3
  phrases (FW: Footwork_1 0–1.5 / 1.5–3.17, Footwork_2, Footwork_3 0–2.3 / 2.3–4.57, the first 1.25 s of Footwork_To_Freeze), 2.7–3.5 s,
  never the same phrase twice in a row, each at speed ~.9–1.2, the side switches with p .35 (fade .45, else .32), and the dancer keeps turning
  round 11–40° per phrase change (mostly one way). Turns pivot on the HIPS (`turnBy`: root.rotation.y + dx/dz rotated back), applied frame by
  frame by `spinTick` (battles and the cypher/mall shows). All footwork recordings start/end in the same crouch (= the end of the drop) and
  Footwork_1 passes it at 1.5 s — measured mean bone angle to that crouch per frame. Score unchanged: the first phrase is `kind:'foot'`
  (FOOTWORK +1.5), the rest `foot2` (no points, no label). Toprock: either side, 1.9–2.7 s from a random point; freezes either side; the
  next dancer's walk-in toprock either side. Steps carry `sp` (speed) and `fade`. Sets are ~1 s longer.
- Yard cypher (city3d.js `planSet`): each round danced to a random side, a plain footwork = any of the three.
- Versions: city3d-mocap `?v=12`, city3d-game `?v=20`, city3d.js `?v=21`. Tested headless: battles with Совы / Золотые зубы and the cypher
  show (clip trace, no errors), 3 other districts load clean. NOT seen on a real iPhone (swiftshader runs ~1 fps, so the smoothness of the
  combos' joins is checked only frame by frame).
### City 3D — a human head, shoulders without a hinge, a one-time zoom tip, the background music on iPhone (17.11.2026, owner «Продолжи город, сделай форму головы не круглой, сделай похожей всё-таки на человека так или иначе. На плечах постарайся убрать видимую шарнирность. Добавь подсказку о зуме карты небольшую прозрачную 1 раз при входе в город. Пофикси фоновую музыку (сейчас не играет сразу, пришлось выкл и вкл кнопку на экране, чтобы появилась фоновая музыка)»)
- HEAD (city3d-mocap.js `?v=12`): the head was a ball scaled (1, 1.12, 1.05). Now `headGeo(girl)`: 31 horizontal slices × 48 points from the chin
  (y −.045) to the crown (.2405), head-group space. Each slice = front / back reach, half-width, z of the widest point and a front taper (`HEAD_SL`
  below the brow; above y .13 an ellipse that keeps the old ball's height and depth). The face (chin … brow) is flatter (`ef` .78), the forehead
  round again (it must stay under the hair's fringe). `headFeat` pushes a nose (tip y .06, 2.1 cm), brow ridge (y .12), eye sockets (±.04, .103),
  cheekbones, lips (y .029) and a chin; vertex colours darken the lips, the sockets and the underside of the jaw (`MV` = cached vertexColors material).
  Woman variant: narrower jaw, smaller chin, fuller lips, softer brow. BEARD = a shell of the same mesh 7 mm out whose edge sinks under the skin
  (smooth border, lips left open), men only. Built once per variant and shared by everyone. Eyes / brows (hair colour, capsules) / ears placed with
  `headFront(x, y)`. Ground contact = `userData.balls` (4 balls) instead of one big sphere: headspin rests 0.6–1.2 cm off the floor.
  The skull is 10% narrower (half-width .107 vs .12) ⇒ `HX` .9 on hair caps (`cap()` x .93, z 1.085 bare / 1.065 under a hat — the bandana showed hair
  through at 1.085), top / buns / braids / dreads, cap, beanie, bandana, custom band and glow ring; bucket .94; headphones moved onto the ears.
  Hair cap segments 16 → 30 (the 16-sided cap let the forehead show through in stripes). Gotcha found on the way: the slice rings were wound
  inside-out (we saw the inside of the back of the skull) — the index order is (a, c, b, b, c, d).
- SHOULDERS: the torso's top ring sat at the height of the arm joint, so the arm's top and the joint ball (r .058·A) stuck out 3–5 cm above it — a pad
  on a hinge (worst on athl / big with thick arms). Now torso rings around the joint height `js`: widest (jx + .044·ak) at js − .006, a cap
  (jx + .022·ak) at js + .03·ak, the slope to the neck (jx·.8); their outer vertices are re-weighted up to 60% to Left/RightShoulder (`G.rew`) so a
  shrug lifts them. Arm: thinner start inside the torso (s −.06), blend zone at the joint .045 → .058, ball .058 → .05·A. Painted brightness of the
  shoulder rings 1.06–1.08 → 1.02–1.05 (the brighter torso vs the arm drew a line where they meet).
- ZOOM TIP (city3d.html `#ztip`, city3d.js `zoomTip` / `ztipOff`): a small see-through pill with two orange «fingers» sliding apart, top 34%, two lines,
  pointer-events none. Once ever (`fedoskin-city3d-ztip`), on the first entry, after the alpha notice is closed, 1.2 s in, ~5 s; removed at once on a
  pinch / wheel; computer text «Колёсико мыши — …». The 2nd line of the bottom hint is gone (it said the same).
- MUSIC (city3d.js, rhythm.js `?v=21` — index.html bumped too): the page made the sound context 600 ms after load and the first touch only resumed it.
  On iPhone a context resumed by a touch seconds after the page opened can stay silent while reporting `running` (WebKit bug 190410 — the city takes
  several seconds to load), and after the background it can stay silent for good (bug 276016); turning 🎵 off/on built a new loop, so it played. Now:
  phones (`pointer: coarse`) make no sound before the first real touch (touchend / pointerup / click / keydown — pointerdown is not a user gesture on
  iPhone), `audioOn` plays one silent sample inside the touch, `startMusic` restarts the loop once `RB.audioState()` says running (poll 300 ms, not
  while hidden), hidden → loop stopped + `musicStale`, the next touch calls `RB.fresh()` (closes the context, a new one is made inside the touch).
  Computers: start at 600 ms as before. `CITY3D.music()` = {on, live, stale} for tests.
- Tested headless (390×844, touch): all 4 districts + `?cus=3333` load clean; alpha → OK tap → sound running, tip shown after the notice, gone after
  ~5 s, not again after reload; background → back → touch = fresh context running; 🎵 off/on. Heads of all hair styles, hats, beards, headphones,
  custom pieces checked close up; shoulders standing / running / uprock / freeze. NOT on a real iPhone (the music fix above can only be confirmed there).

### City 3D — every crew battles to its own beat (17.11.2026, owner «Добавь разные биты под батлы с разными бандами, сделай по типу как фоновая музыка (мне понравилось)»)
- rhythm.js: `bgm(on, id)` plays one of `LOOPS` (synth loops built like the yard background: drums + bass + keys, scheduled bar by bar 0.6 s ahead).
  `yard` = the 14.11 background, unchanged note for note. New voices (prefixed `v…`, never reuse a helper name): clap, cowbell, metal clank, anvil, 808,
  zap, shaker, bongo, gritty bass, upright pluck, chime, record crackle, swelling pad, 303 acid note, G-funk whining lead, wobble bass, owl hoot.
  Loops: rusty 84 lo-fi + crackle (Em) · acid 100 acid breaks, filter opens over 4 bars (Am) · owls 80 dark, pads, owl hoot (Cm) · gold 94 G-funk, whine
  lead (Gm) · stencil 92 NY boom-bap, horn stab, DJ cuts (Dm) · turn 108 metro: rail hats, turnstile clank, station chime (Em) · chrome 118 electro: 808,
  cowbell, robot bass, orchestra hit (Am) · funk 110 ghost snares, slap bass, brass, guitar scratches (E) · roots 90 jazzy: walking bass, e-piano,
  Dm7–G7–Cmaj7–A7 · wave 122 breakbeat + swelling pad (C#m) · rebar 96 industrial: clanks, steam (E) · volt 126 wobble bass, zaps (Am) · forge 132
  double kicks, anvil, distorted riff, alarm chords, tom fill (Em) · jam 112 bongo b-boy break (Am) · ring 104 dark half-time (F#m). All original notes.
- Switching: a different id while one plays → the old loop drops (.05 s), three scratches, the new one comes in hard .34 s later; same id → nothing.
  city3d.js `setMusic(id)` (passed to initGame as `ctx.music`) keeps `musicId` (used by startMusic, the 🎵 button, coming back from the background)
  and asks RB 40 ms later, so endBattle's «back to yard» + the next jam round's «jam» in one tick = no change. Music off (🎵) → battles silent as before.
- `RB.bgmBeat()` = beats since the loop's first bar as heard; the frame loop uses it for `tb` (speakers pump in each loop's tempo), else 88 BPM as before.
- `vol` per loop: offline render (`RB._bgmRender(id, 4)` → OfflineAudioContext) — RMS after a 150 Hz highpass (≈ a phone speaker) set to ≈ yard +1 dB
  for all crew loops (±0.3 dB). Raw: chrome/forge were +4 dB, rusty −1.8 dB. Peaks ≤ .61.
- Tested headless: all 13 crews (yard, ?d=center, ?d=park, ?d=prom) switch to their loop at battle start and back to yard after «Дальше»; the jam stays on
  `jam` through its 3 rounds (one switch), the ring → `ring`; index.html loads, the flat city's `RB.bgm(true)` = yard. No page errors.
  A listening file of all 16 loops (4 bars each) was sent to the owner. Claude has never heard them — the owner judges by ear.
- Versions: rhythm.js ?v=22 (index.html + city3d.html), city3d.js ?v=23, city3d-game.js ?v=22.


### City 3D — DRAWN POWER MOVE in battles (17.11.2026, evening)
- Owner: «Так же добавь вырисовывание powermove элемента во время батла с бандой (подумал, что авто скучно, но и в бит тапать не надо).
  Интерес будет подогревать возможность идеально сделать какой-то элемент его нарисовав. Продумай механику так, чтобы человек и нарисовал
  и увидел не отвлекаясь на рисовку как он сделает элемент или параллельно.»
- New file `city3d-power.js` (`initPower({ W, camera, sfx })`, own canvas `#g3pm` over the 3D picture, z 6, under the battle panel).
  Only the HERO's power step in battles (crews, jam, ring — everything through `startBattle`); the opponent and the street shows stay automatic.
- The idea («и параллельно, и потом»): (1) PARALLEL — the line is drawn AROUND the dancer and the finger LEADS HIS LEGS: the clip's time is
  driven by how far the finger got (`drive()` sets `J.act.timeScale = Δ/dt`, so root motion still works); finger at the left of the circle =
  legs at the left. Slow finger = slow motion, off the line = the body wobbles (`J.rig.rotation` x/z), no progress .6 s (stop or finger lifted)
  = he loses momentum → fall. (2) AFTER — a replay of the drawn part at the REAL tempo from a lower orbiting camera (`W.camT.off`, cut with
  `W.camSnap`), a light trail from the feet (gold = perfect, blue = clean), the wobble where the finger was sloppy; tap skips; panel hidden (`body.g3rep`).
- The line is MEASURED from the mocap (`table()`: a hidden plain probe body, 120 samples/s): the angle round the hips of a foot / the middle of
  the feet / the hips' turn (`DRAW` per clip: Swipes = hips' yaw, only 1.9–2.8 s is drawn, the wind-up plays by itself; Head_Spinning = right
  foot ×2 loops = 4 turns; Flair = middle of the feet ×3; 1990 = right foot ×4). Back-swings flattened → `timeAt()` maps any point of the line
  to one moment of the clip. On screen: an ellipse (camera tilt) round the hips at the legs' mean height, radius .24–.35 of the short side,
  a slow spiral (.94→1.06) so laps don't overlap; the camera centres it a bit above the middle (`z - .555·h + .25`, zoom .34).
- Flow: the step starts → `PM.arm` (s.pm blocks the old outcome; the battle clock re-synced to the clip) → the clip reaches the drawn part →
  HOLD: time stops, he hangs in the air, a pulsing yellow dot + ring that runs out (2.6 s; first two times 7 s + a hint) → no touch = «САМ
  КРУТИТ», the old random outcome → touch within ~2.6 corridors of the dot = DRAW → end. The battle clock stands during hold/draw/replay
  (`PM.holds()`: `B.t0 += elapsed`). `drawn()` in city3d-game.js picks the set's ending: `makeTurn` now builds BOTH tails on the power step
  (`tails.ok` = post + freeze (+ its own fall), `tails.bad` = fall), re-times the rest, jumps the clock to where the drawn part ended.
- Scoring (`feed()` like the rhythm battle's trajectory: points 6 px apart, window idx−3…idx+6, finger samples every 5 px): within .42 of the
  corridor = 1, within the corridor = .5, off = 0. Done + average ≥ .82 → ИДЕАЛЬНО (move points ×1.5, `BAL.perfMul`), done → ЧИСТО (points),
  timeout / stall with ≥85 % → ЧИСТО, else СРЫВ (+.5, fall). Corridor px (390-wide phone, scaled .9…1.5): Swipes 30, Headspin 26, Flare 24,
  1990 21. Time = real tempo ÷ .5 + .7 s. Easier with: levels from lessons above the move's (+1 px and +.3 s each, max +3 / +1.2), the tailor's
  spin pad, DJ, mat, warm-up (`tolAdd` ≤ 6 px).
- Hooks: first perfect of each move = +5 ★ once (`BAL.perfFirst`, `S.perf[nm]` counts), result lines «✨ Первый идеальный FLARE! +5 ★» /
  «✨ FLARE — идеально (всего N)», daily goal `perf` «Нарисуй пауэрмув в батле идеально», a loss after a fall adds a tip. `S.drawN` = drawn moves.
- Sounds: rhythm.js `sfx('whoosh')` per completed turn, `sfx('perfect')` (chime + crowd). Vibrate 8 ms per turn (Android only).
- Tests: `?pm=FLARE` (SWIPES / HEADSPIN / FLARE / 1990) forces the hero's move; `GAME._pm()` (line, progress), `_pmState()`, `_pmLast()`
  (grade, accuracy), `_b()` (the battle). Headless (in-page PointerEvents along the line): careful finger → perfect (acc 1.0) on swipes, headspin,
  flare; a drifting finger (±.8 corridor) → clean (acc .71); stopping at 40 % → fall, no replay, tip on the result; no touch → auto after the
  wait; «Пропустить» during the hold → results, overlay gone, rig straight; 390×844 and 375×667. NOT checked on a real phone (finger feel,
  how hard ИДЕАЛЬНО is, sounds).
- Pitfalls met: (1) the clock re-sync landed exactly on the step boundary and floating point sent the set back one step — now +2 ms and a
  set never steps back (`si < T.si` guard); (2) a clean freeze's old «zoom pulse» timer fired during the replay and pulled the camera to .4 —
  the replay / hold set their zoom every frame; (3) the headless browser runs ~1 fps, frames skip steps — that's the test, not the game.
- Versions: city3d-power.js ?v=1 (new), city3d-game.js ?v=23, city3d.js ?v=24, rhythm.js ?v=23 (index.html + city3d.html).

### Flat 2D city hidden + faster crew beats (17.11.2026, late evening)
- Owner: «Убери 2д город (скрой и убери его выбор). В 3д городе ускорь биты на батлах и оставь скорость бита на фоновой музыке.»
- 2D city: the «Простой 2D-город» button `#c3Old` on the Город screen stays hidden (`hidden data-later`, the code that showed it and its click
  handler removed). Nothing else opens `#city`. city.js / city-*.js still load and `CITY.init` still runs (it draws nothing until `show()`) —
  only so that gear already won in the flat city stays in the wardrobe (`CITY.owned` → `cityOwned()`). Wardrobe «Только в городе»: gear only
  the flat city gave (src `mc` = Бомбер Сайфера, `dj` = Перчатки диджея, `walls` = Кеды райтера) is listed only for those who own it.
- Beats: every crew loop + jam + ring sped up, order kept: new = round(110 + (old − 80) × .54) → owls 110, rusty 112, roots 115, stencil 116,
  gold 118, rebar 119, acid 121, ring 123, turn 125, funk 126, jam 127, chrome 131, wave 133, volt 135, forge 138 (were 80…132). `yard` (the
  background) stays 88. Faster = more hits per second = louder (+0.4…+1.1 dB), so `vol` was re-levelled the same way as before (8 bars
  offline, 150 Hz highpass RMS) back to yard +1.0 dB (±0.02) for all; peaks ≤ .64. Speakers / dancers follow automatically (`RB.bgmBeat`).
- Tested headless: app ru 390×844 — Город tab = hub, no 2D button, no errors; wardrobe (mocked wallet) 20 street items for a new player,
  21 with djGloves owned in the flat save. city3d.html: RB.LOOPS = new tempos, yard plays before, `GAME._start('rusty')` / `('forge')` switch to
  the crew loop. A listening file (yard + 15 battle loops, ~8 s each) was sent to the owner. Not heard by Claude, not on a real iPhone.
- Versions: rhythm.js ?v=24 (index.html + city3d.html).

### Crew battle beats — more energy, more bass (17.11.2026, ~23:45)
- Owner: «Сделай энергичнее и басовее биты на батлы в бандах».
- rhythm.js: one shared «battle punch» for every loop except `yard` (13 crews, jam, ring), no pattern of a loop changed. `bgm` / `bgmRender` play
  each bar through `loopBar(L, rig, …)`; for battle loops `rig = hotRig(out, L.hb)` and `HOT = rig` only while that bar is scheduled (try/finally),
  so the yard, the flat city and the rhythm battle (kick/bass/v808 with HOT null) are byte-for-byte the old sound.
  - kick / v808 with HOT → `hotKick`: goes to `dry` (= out, not ducked); the old kick + a long sub sine 95→38 + a 200→90 Hz «knock» (what a phone
    speaker can play) + a short click; it ducks `pump` (everything else) to .5 (softer kicks less) and lets it back with τ 70 ms — the pumping.
  - every bass note (bass / vGrit / vPluck via bass, vAcid, vWob) → `hotLow`: a HELD saw (the loops' own bass is plucked — exp decay, gone after
    ~10% of the note) through a tanh shaper and a 140–460 Hz band (2×HP + 2×LP) = the bass you hear on a phone speaker, level `hb` per loop;
    plus a held sine sub (an octave down above 70 Hz); the loop's own bass ×1.2.
  - `hotDrums` per bar: a soft crash on bar 1 of every 4, a pickup kick on step 16 of every second bar, a 4-step snare roll + a noise riser on
    the last half of every 4th bar.
- Levels: first the plain «same loudness» re-level crushed the drums (the bass layer took the whole budget: −4…−6 dB on hats/keys), so
  instead: vol = previous vol −1 dB (drums/keys/melody stay almost where they were) and `hb` per loop chosen so the whole loop lands at
  yard +3.5 dB (was +1). Measured vs the previous version (8 bars offline): 150–400 Hz +2.8…+4.9 dB, below 120 Hz +0.7 (chrome, its 808 was
  already heavy)…+4.6 dB, above 2 kHz −1.5…+1.3 dB, peaks ≤ .83. Measuring pitfall: a single biquad band leaks a lot (the 200 Hz knock showed
  up as «400–2000 Hz +5 dB») — use cascaded filters.
- Tested headless: the yard plays before, battles switch to owls / chrome / roots with sound running, no page errors in city3d (yard, centre,
  park) and in the app (incl. the rhythm-battle trial). A listening file (yard + 15 loops × 4 bars, so the crash and the roll are heard) was
  sent to the owner. Not heard by Claude, not on a real iPhone.
- Versions: rhythm.js ?v=25 (index.html + city3d.html).

## 18.11.2026 — 3D city translated into all 8 languages
- Owner: «Переведи 3д город для все наших клиентов, на все языки, которые мы добавили».
- Before: only the alpha window in city3d.html was translated; everything inside the city was Russian, and the app's Город tab showed
  «Пока в городе всё на русском — переводы появятся позже» (#c3Lang) for non-Russian languages. Now #c3Lang stays hidden, the alpha window's
  line about Russian is gone (A[3] = '').
- How: every visible Russian text in city3d.js / city3d-game.js / city3d-center.js / city3d-park.js / city3d-prom.js / city3d-power.js /
  city3d.html goes through `_t('русский текст', {vars})` (window._t, defined in city3d.html; each module has a fallback copy so a page without
  it still works). Concatenated strings were turned into templates with {n}, {x}… so word order can change per language.
  Data is translated where it is defined (crew names, bosses, ring / jam opponents, ranks, goals, the tailor's details); signs on canvases
  go through each district's `text()` helper (translates, then shrinks the font to the room it has: default = the canvas around px,
  explicit maxW for shop fronts, ad frames, МЕТРО, ШОУ, the mall's name next to its logo, ЦЕХ 5). `label()` in the yard and the power
  overlay's `text()` shrink the same way.
- Dictionary: `tools/i18n_city3d.py` — 338 rows (ru + en, es, pt, fr, de, ja, ko, zh) + 20 gear names reused from the app's i18n.js;
  the script checks placeholders / <b> tags / no Cyrillic left and writes `city3d-i18n.js` (~230 KB, all languages; loaded only by the city).
- Terms: crew = банда (ja クルー, ko 크루, zh 帮派), respect (zh 声望), energy (zh 能量), crash = срыв (es caída, pt queda, fr chute,
  de Sturz, ja ミス, ko 실수, zh 失误); districts The Yard / Downtown / the Park / the Industrial Zone / the Club (same as the flat city);
  nicknames translated by meaning (Хромосома = Chromosome, Коготь = Claw, Маятник = Pendulum…); ranks: Yard Rookie → One of Us →
  Respected → Heavyweight → Yard Boss → Hood Legend → Voice of the Streets → City Icon; ТЦ «КРУГ» = Circle Mall; Ателье «Игла» = Needle.
- Russian fixes on the way: «Вся Промзона в твоих граффити» (was «Весь Промзона»), «Победи их ещё 2 раза» (was «2 раз»).
- Layout: the action button, the toast, the hint and the turn line may wrap now (width max-content, max-width = screen − 24 px) — the
  Russian atelier button already ran 4 px off a 390 px screen; HUD chips use word-break: keep-all so Japanese / Korean don't break mid-word.
- Not translated on purpose: the `?fps` counter (owner's tool), move names (FLARE, HEADSPIN… are international), BREAK BATTLE / FEDOSKIN TEAM.
- Versions: city3d.js ?v=25, city3d-game.js ?v=24, city3d-power.js ?v=2, city3d-center.js ?v=5, city3d-park.js ?v=4, city3d-prom.js ?v=3,
  city3d-i18n.js ?v=1.
- Subtitles 22.11.2026 (owner «субтитры для длинных видео, на которых ещё не делал»): fr-one-hand-freeze, fr-turtle-freeze-variations, fr-airbaby (R2).
  Whisper in the owner's Chrome as before, but the raw words could NOT be committed from the browser (using the admin token from a page was refused),
  so cues were read off the page and the work files written by hand; subs/raw has no file for these three. AIRBABY tail: Whisper lost the timing after
  ~346 s — the last three cues were timed by hand (344–355 s). In AIRBABY he calls the freeze «флажок»; translated as «this freeze».

## 3D city — energy: full every day, lessons above 100 (22.11.2026)
- Owner: «Сделай в городе ежедневное восстановление энергии до полного. Так же сделай, чтобы просмотр уроков и другие вещи добавляли энергии сверх 100».
- city3d-game.js `BAL`: `daily` 40 → 100 (= `enMax`), new `enCap` 300. Every new day: if energy < 100 it becomes 100; a reserve above 100 is kept.
- Lessons (+5 ⚡/min), all goals of the day (+15), tea in the Centre, the OG in the Park, stashes in the industrial zone add up to 300 (were capped at 100).
- `refill()` now adds lesson minutes AFTER the new-day top-up (before, minutes watched yesterday evening were swallowed by the top-up).
- HUD shows «180 / 100», the bar stays full and turns gold (`#g3en.over`). Info sheet texts rewritten, 8 languages (tools/i18n_city3d.py).
- Tested headless 390×844 ru/en/de: 30 yesterday → 100; 180 yesterday → 180; 95 + 20 min → 195; 290 + 20 min → 300; 40 yesterday + 10 min → 150. No errors.

## 3D city — why it stutters + more varied hero sets (22.11.2026, late evening)
- Owner: «проверь почему город притормаживает. Так же добавь разнообразие танцевальных выходов человечку игрока».
- MEASURED (headless Chromium + swiftshader, virtual 60 fps clock, per-frame hooks on WebGL calls, CDP CPU + sampling-heap profiles;
  scripts were in /home/claude/prof, not committed). Standing in the yard: ~7 ms CPU a frame, ~95 % of it three.js submitting draw calls
  (~393 a frame; game logic ~0.5 ms). No periodic CPU spike in 20 s (the 17.11 «every 5 s» pattern still not reproducible without the phone).
  Found:
  1. PROGRAM THRASH in the shadow pass: three draws every caster with ONE shared MeshDepthMaterial; each skinned ↔ rigid switch (a body, then
     its merged head/cap shadow piece, then the next body…) re-ran getProgram (getParameters + a long cache-key join): ~50 times a frame in the
     yard, every frame — ~1 ms CPU and ~150 KB garbage a frame. Fix: all skinned meshes get `customDepthMaterial = DEPTH_SKIN` (city3d-mocap.js).
  2. FIRST-SIGHT HITCHES: textures upload (with mipmaps) and shaders compile only when something first comes on screen. One lap of the yard
     = 25 frames with uploads (12 MB in all, up to ~2 MB each) + a shader compile; on Safari each can hold a frame for tens of ms. Fix: boot
     WARM-UP in city3d.js — `renderer.setRenderTarget(rt); renderer.compile(scene, camera)` (with the composer's buffer set, so the program
     variant really used — no tone mapping, linear — is the one compiled) + `renderer.initTexture()` for every texture found on any material
     (props + ShaderMaterial uniforms). After: 0 compiles, 0 uploads while walking.
  3. PEOPLE = most draw calls: ~14 rigid pieces a person (head, hair, cap, eyes, ears, brows, laces, chain…), each a draw in the picture and
     in the shadow maps; 21 people in the yard ≈ 200 of the 393 draws. Fix: `mergeParts(rig, body)` at the end of mocapPerson —
     (a) pieces in plain clothing materials (tame M / M2 / MV, no map / emissive / transparency) are baked INTO the skinned body: each vertex
     skinned to the bone its piece hung on with weight 1 (moves exactly as before), colour = material colour × vertex colour, roughness /
     metalness per vertex (`rm`), `rim` = 1 for the body's cloth, 0 for the pieces (they never had the rim). SKIN_MAT reads rm / rim
     (onBeforeCompile replaces roughnessmap_ / metalnessmap_fragment; customProgramCacheKey 'skin2'); G.build gives every body rm = (.82, 0),
     rim = 1 — any SkinnedMesh with SKIN_MAT MUST have them. (b) two-sided pieces → one extra SkinnedMesh `parts2` (PARTS[1]); (c) the rest
     (glowing trims, sewn patches) merged PER MATERIAL (same material object, uv kept if it has a map). The originals stay in the tree, hidden
     everywhere by `layers.disableAll()` (not visible=false: children must still render), `castShadow=false`, `userData.merged`, no `tiny` —
     J.tick's ground-contact points still use their matrixWorld. Pitfall met: Box / Cylinder / RoundedBox geometries carry `groups` even with
     ONE material — a `groups.length > 1` filter wrongly skipped them (only matters for material arrays). `opt.noMerge` skips the merge
     (city3d-power.js probe). Hero fully tailored (`?cus=3333`): 28 draws → 5. The bronze statue (Centre) still works (material swap).
  4. The yard's three buildings (BoxGeometry with 6 materials) cast shadows as 6 draws each in every shadow map (48 a frame): city3d-perf.js
     `mergeable` now takes material arrays (all with the same shadow side) → they go into the merged shadow cells.
  5. OutputPass (tone curve + sRGB) and the grade (vignette, cool shadows, grain) were two full-screen passes with a half-float buffer between;
     now ONE pass (`out` — OutputPass with the grade appended to its fragment shader; `fin` kept as an alias for the uniforms).
  6. Shadow batcher: the first build was all ~26 cells in one frame (≈20 ms) — now 4 a frame; items keep casting until their cell exists.
- RESULT (standing at the district's spawn, same frames, old → new): draws yard 393 → 203, centre 256 → 152, park 245 → 137, prom 259 → 135
  (−40…−48 %); CPU per frame (median, headless desktop) yard 6.9 → 4.6 ms, centre 5.4 → 4.4, park 4.7 → 3.5, prom 4.7 → 3.7; the worst 5 %
  of frames yard 11.9 → 8.7 ms; program re-checks 26–50 → 0 a frame; heap growth per frame about halved. Walking a lap of the yard: draws
  323 → 195, 1 compile + 25 uploads → 0. Screenshots old vs new identical (yard, zoomed-out yard, Centre statue, prom, hero close-up incl.
  `?cus=3333`; residual = grain noise once both poses are fully settled). On Safari every draw call costs more than in Chrome, so the
  gain on the iPhone should be at least as large — NOT measured on a real iPhone.
- `?fps` readout now: fps · worst frame · «ЦП X мс» (CPU time of the frame: small ЦП with slow frames = the graphics chip is the limit) ·
  «рывков N» (frames > 50 ms in the last 10 s) · draw calls · pixel ratio, plus a strip of the last 300 frames (white, orange > 25 ms,
  red > 50 ms) — one screenshot shows whether a stutter is periodic.
- HERO SETS (city3d-game.js, `makeTurn` for who 'me'): SHAPES classic / rock (2nd toprock phrase, kind `top2`: name shown, no points) /
  drop (toprock straight down into a held freeze from FDROP: kind 'freeze', fail false, +0.5, yaw only while going down) / powerFirst
  (short scored footwork → power → `foot2` footwork in the power's ok-tail → freeze). Never the same shape twice in a row (`heroShape`).
  Final freeze from HFREEZE (chair, crossleg, 2 × AIR FREEZE from lv 2, 2 × BABY FREEZE), not the same NAME as last time (`heroFz`) nor the
  one he dropped into. New clips = the unused Mixamo «Breakdance_Freeze_Var_1…4» and «Breakdance_Freezes» (also added to MIRROR → `_M`).
  Measured from the capture: Var_1/2/Freezes 3.3–3.9 s = one hand on the floor, upside down, feet 1.5–2 m → AIR FREEZE; Var_3/4 = head +
  both hands on the floor, hips ~.5 m, legs off it → BABY FREEZE (names given by Claude from the poses — the owner may rename); holds
  < 1°/frame; entry after power moves 24–36° mean joint difference (old chair/crossleg entries 34–48°). Opponents unchanged.
  Sets 13–18 s (were ~13–17). Test switch `?set=classic|rock|drop|powerFirst` (W.forceSet), like `?pm=`.
- Tested headless: 60 sets per level (lv 4: all shapes, never repeated, 4 freeze names, all clips exist incl. `_M`; lv 1: no air
  freezes); full battles yard (rock, drop, powerFirst with a finger-DRAWN flare → perfect → footwork → mirrored baby freeze → replay → win),
  Centre 2 rounds vs Chrome, Park jam, prom ring — all to the judges, no errors; cypher show filmed frame by frame (drop, powerFirst);
  rewear (all tailor details) in German; `_t.miss` empty. NOT on a real iPhone (smoothness, the joins of the new freezes at full speed).
- Versions: city3d.js ?v=27 (city3d.html), city3d-mocap.js ?v=14, city3d-perf.js ?v=2, city3d-game.js ?v=26, city3d-power.js ?v=3.

## 24.11.2026 — Battles music mix

- The main «Батлы» DJ preview and rhythm round now use a dedicated music bus in rhythm.js (?v=26): layered kick and snare,
  sustained bass with an octave harmonic, corrective EQ and soft saturation. Count-in and tap cues bypass that bus.
  The beat grid, scoring, shared effects and the City's mixes still use their existing paths.

- Wardrobe slots and red gear: the current look shows actual worn items by slot, with base clothes from HERO.FIT, and the owned list can be filtered by clicking an occupied slot. Existing prices and item IDs stay the same. Inspect each card for rarity, source and effects, with active capped bonuses above the list. A red piece adds 0.5 percentage points for REAL ONE HAND / CORKSCREW / PLANCHE in either mode and a separate 2% for the chosen manual power move to complete without tracing, up to two slots. The Worker draws once per attempt, scores the manual mythic bonus at +600 and awards the existing +10 stars. In City 3D the original mythic rig plays in a cut-in and adds 6 to the power step. Writer's kicks also drop once from Industrial Zone stashes (12% per opened stash). Deploy the updated Worker from the admin for online bonuses.

## 24.11.2026 — City movement and battle sets

- Five standing loops use the existing mocap. Each resident has a repeatable stance and arm swing, with shorter strides for smaller and older people. The hero alternates standing with short toprock phrases and advances the walking animation by actual distance after collisions.
- The battle and street shows share three approaches to the center: straight, left arc, right arc. The hero and each opponent rotate through seven set shapes. The new shapes start on the floor, return to toprock after footwork, or pause in a freeze between floor phrases. Nearby crew members watch from the sides of the ring.
- Cache versions: city3d.js 31, city3d-game.js 29, city3d-mocap.js 16 and city3d-power.js 5. All mocap imports must point to the same version so the game and the power drawing share the loaded clips.

## 25.11.2026 — Competition-style battle breaks

- The DJ preview and rhythm round in «Батлы» use seven original two-bar breaks in `BREAKS` (rhythm.js v28). Drum-only bars,
  syncopated bass, short stabs and percussion fills replace the sustained chord parts. DJ CUTS, TRIPLET FLIP and DOUBLE TIME
  retain their cut, triplet and half-time phrasing. The City jam still uses `STY`. Beat IDs, BPM, tap cues and scoring stay the same.
- Reference tracks: DJ Fleg's New Horns and Lean Rock's Fire in the Hole in the WDSF qualifiers. The app synthesizes its own sounds.
  [WDSF DJ tracks](https://www.breakingforgold.com/djs-and-music)

## 25.11.2026 — City character rig and clothing fit

- Sleeve openings now share a surface with the torso, and the two trouser legs join their seat at the crotch. Hems follow the hips and thighs
  to clear the trousers when running or folding into a freeze. Raised cuffs have closed edges, and high-top shoes blend their collars with the shin.
- Hoodies, coats, pockets and protection sit on the skinned garment. The tailor's chest, sleeve and back patches retain their graphics and follow the fabric.
- Compared posed city meshes in Blender. Checked 56 body and outfit combinations across 8,736 sampled poses and built all 64 inventory items.
  Cache versions are city3d.js 35, city3d-game.js 33, city3d-mocap.js 19 and city3d-power.js 8.

## 25.11.2026 — City heads from above

- `city3d-head.js` builds heads for the hero and residents. The six face meshes have narrower temples, distinct jaws and a longer nape profile.
  Hair follows the scalp shape. Caps, beanies, buckets and bandanas use separate fitted cuts and keep their catalog colours.
- Headspins use contact points sampled from the head and equipped headwear. Compared the heads in Blender at the city camera angle and in profile.
  Cache versions are city3d.js 36, city3d-game.js 34, city3d-mocap.js 20, city3d-power.js 9 and city3d-head.js 1.

## 25.11.2026 — Balance during rhythm freezes

- On the last note, follow the green zone with a small sideways movement while holding the original pointer. The zone moves once and starts after a short pause. Moving back into the zone within 280 ms saves the hold. Harder freezes have a narrower zone, and equipment with the hold bonus widens it.
- A balanced hold through the end earns the grade of the opening hit. A balanced partial hold can earn GOOD. The freeze still sends one grade with the existing RB2 note and score format. Cache versions are rhythm.js 29 and i18n.js 5.

## 25.11.2026 — First-use freeze demo

- The first manual rhythm round shows a gesture demo before the music starts. The balance meter uses the same green zone, dot and completion bar in the demo and on the note track. The pad cues the hold before FRZ arrives and prompts players to recover while there is still time.
- The manual hold lasts four beats. The zone begins drifting after 22% of the hold and reaches its target at 84%. A player who leaves the zone has 500 ms to recover. The existing Worker chart and score payload apply. Cache versions are rhythm.js 30 and i18n.js 6.

## 25.11.2026 — City character and garment details

- `city3d-hood.js` builds the lowered hood as one surface with pleats, binding and a recessed lining. Its base follows Spine2 and uses the equipped top colour.
- `city3d-head.js` sculpts the ear rim, bowl and lobe, and adds detail to the face, braids and headwear. Hands, garment seams, drawstrings, pockets and footwear keep their existing skin weights or follow the same bones as the garment.
- Compared the details in Blender, including a run and a freeze. Cache versions are city3d.js 37, city3d-game.js 35, city3d-mocap.js 21, city3d-power.js 10, city3d-head.js 2 and city3d-hood.js 1.

## 26.11.2026 — City crew battle move choice and freeze balance

- Choose SWIPES, HEADSPIN, FLARE or 1990 before confirming a crew battle. The City and rhythm battles share lesson coverage, views with sound, level gates and existing unlocks through `battle-study.js`. Footwork fills the power slot when every captured power move is locked. The chosen move plays in each player turn. A mythic gear move can accompany it as a bonus.
- A first-battle gesture demo appears next to the move choices. The final freeze holds its mocap pose while the player presses the panel and tracks the green zone for four beats. A successful hold earns the existing freeze points, and a lost hold plays the fall. City cache versions are city3d.js 39, city3d-game.js 37 and city3d-i18n.js 4.

- The underground ring and park jam now use the same chooser and final hold as crew battles. Confirming starts the event and charges its own energy cost. The chosen move carries into later jam rounds. City links from the app open the versioned page, and hold duration uses each event's actual beat.

## 26.11.2026 — Drawn power move exits and round bucket hat

- Release on the guide after the first full turn to land. All four draw-enabled moves cap at ten turns. The city adds 0.3 points for each complete turn beyond the first on a successful exit. Slides outside the 1990 corridor end in a fall, including late in the move. Replays use the completed part of the recording.
- The bucket hat restores the round crown and continuous sloping brim from the earlier profile. The band, stitch and tailor details follow the same shape.

- 26.11.2026 — 3D city move wheel (`city3d-wheel.js`): immediately before each player power step in crew battles, the ring and the jam.
  Four fixed directions per page, tap or drag and release, locked moves explain their requirements. The existing prefix and score are kept
  when the chosen power clip and its endings are appended. Battle confirmation still introduces the freeze on first use.

- 26.11.2026 — Yard power move modes (`city3d-power-modes.js`): the blue mat offers free tracing with unlimited wait before the first touch,
  accuracy/turn feedback and instant retries, or the existing conditioning session. The orange contest floor runs three rounds against Whirlwind.
  Both sides use the same selected move per round. Contest selection uses the shared unlock rules, and a missed or unstarted attempt scores zero.
  Contest best and wins are saved in `S.powerContest`.

## 26.11.2026 — Wardrobe and city equipment

- My Items shows owned gear with fitting previews, individual equipment slots and bonuses. The storefront shows purchasable items and keeps the existing price and online win-day checks. Thirteen city rewards unlock through activities and show their cards when found.
- The illustrated hero has longer legs and knee pads that bend with the knee in rhythm battles. Outward-facing sneakers and the three lace patterns share the same independent footwear and lace slots in the wardrobe and 3D city. The pad for headspins and elbow protection widen the matching manual control zones.
- Admin 57 checks Worker 2. The Worker registers the 13 city items for sharing equipment with online battle opponents and reports catalog 4.

## 26.11.2026 — Wardrobe illustration details

- The wardrobe uses the original character poses with extra fabric and accessory shading. Preview, item cards and level looks share the same details. Battle rigs and small portraits keep their original drawing.

## 26.11.2026 — Asphalt in the Yard and Centre

- Blender bakes tileable asphalt colour and a shared height and roughness map. The Yard uses weathered asphalt on the main ground and a cooler asphalt on the east street. The Centre uses the same material on its east street. The plaza, park paths and industrial concrete retain their own materials.
- Repairs with ragged seams and tar-filled cracks use one instanced decal layer per district, below the scene's markings. The textures load alongside the character animations. A missing map can fall back without preventing the district from opening.

## 26.11.2026 — DJ flight case and Park paths

- The Yard DJ uses a Blender-built flight case with two animated turntables, a mixer, a laptop and a front meter. Separate record, fader and meter parts animate while the rest stays batched by material. The DJ reaches for the controls, scratches, checks a headphone and responds to an order with a short cue. Beat orders keep the existing costs and rewards.
- The Park promenade, perimeter paths and connectors share one triangulated gravel surface. The granite curb follows the resulting footprint, leaving crossings open. The lightweight fallback also uses edge-to-edge surfaces.
- `tools/build_city_dj.py` and `tools/build_park_paths.py` export the editable Blender scenes and game assets. Positions, UVs, indices and normalized color and normal buffers are packed in the exported scene files.

## 26.11.2026 — Sound systems at city battle spots

- Six Blender models cover cassette, portable PA, twin tower, plywood crate, stage stack and industrial enclosures. Crew units carry the crew accent. The cypher, power contest, mall show, Park jam and underground ring have their own sound systems.
- `city3d-sound.js` uses the performance anchors after the district and its crews are assembled. It faces the units toward the floor and checks their footprints against the existing objects and dance space. The cone movement and indicator glow follow the city's beat clock.

## 26.11.2026 — Graffiti lettering and concrete walls

- The 3D city uses `CITY_GFX.graf` with `mural: true`. It measures the whole painted silhouette including extensions and emblems, and wraps around a nearby word boundary when it can use significantly larger lettering. It uses the full profile nickname or saved graffiti word, up to 24 characters.
- The Blender build script exports the bevelled wall and bakes a concrete and paint abrasion atlas with a tile for each district. In the game the generated paint is composited onto the concrete. The 3D camera faces the wall during the spray reveal, with framing based on the current screen aspect.

## 26.11.2026 — Park playground and workout corner

- The southeast pad uses a Blender slide with perforated tower guards, a ladder, stepping pods, pull-up and dip bars, and a low bench. The baked rubber surface follows the rounded perimeter and shows the two entrances and the footwork circle. Equipment has close-fitting colliders and the pad stays flush at each entry.
- The existing Park warm-up uses the centre of the circle. The model and rubber finish load only in the Park. Missing rubber has a solid colour and a missing model falls back to the procedural workout corner.

## 26.11.2026 — Breaking choreography in the 3D city

- `city3d-breaking.js` shares twelve arrangements and six walk-ins between the Yard cypher, crew battles, the Park jam, the ring and solo shows. Four preferences favour standing groove, work on the ground, shape accents and power respectively. Each dancer remembers the last four arrangements plus recent moves and entries. The first phrase can begin on the beat or half beat and the phrase lengths follow the current tempo.
- Eight original clips cover a sweep drop, shoulder roll, floor sweep, flexibility reach, leg thread, kick switch, backspin and shoulder freeze. `tools/mocap/build_city_breaking.mjs` bakes hand-authored poses and two-bone limb solves on the existing rig. The backspin appears in automatic sets from level 3. The existing manual move chooser and freeze balance continue to use their own timing. The authored tracks load as an optional second pack.
- Choreography references include the Red Bull BC One guide to rounds and transitions, the B-Boy Dojo teaching material on footwork and powerflow, and the breaking time-motion analysis that describes floorrock separately within floor-level movement.

## 26.11.2026 — Graffiti words, floorrock, backspin and dancing clothes

- Crew wall lettering can wrap only at spaces. A single tag, including a hyphenated tag, scales to fit on one line with its outline and emblem.
- The two floorrock clips use continuous pelvis and limb paths across the shoulders or along the hip, with planted wrist intervals and a return to the common footwork pose. The backspin holds crossed ankles at staggered heights and completes two revolutions in about one second before the exit. A failed backspin starts its fall after the revolutions.
- The Blender comparison sampled the actual skinned City meshes on identical dance poses. In the game the shirt has a folded open hem, the seat and cuffs use half-angle hip and ankle bones, and sewn overlays sample the garment triangles and their final skin weights.

- 27.11.2026 — The Club (`city3d-club.js`) opens through the eastern arch of the Industrial Zone after defeating Foundry. Walk in to a wood
  dance floor, judges, a breaker queue, a DJ booth with two original loops and a results wall. Seven to Smoke (`city3d-smoke.js`) follows
  the eight-person winner-stays queue described by Red Bull BC One (https://www.redbull.com/int-en/themed-battle-concepts-breaking).
  The app uses four minutes of active duels, with the current duel finishing before the cutoff and tied leaders dancing a tiebreak.
  The tournament is free and saves personal best, finishes and wins in `S.smoke`. The first win of the day gives +30 respect.

- 27.11.2026 — Club material bake. `blender -b -t 3 --factory-startup --python-exit-code 1 --python tools/bake_club_materials.py -- /tmp/club-materials`
  renders oak parquet, painted brick, terrazzo, garnet velour, blackened steel, and pressed vinyl. Copy the resulting WebPs to `img/`.
  Base colors are sRGB, with red height and green roughness in the separate lossless linear surface map. The optional `--maps-only`
  skips the Cycles preview and editable test scene. `city3d-club.js` loads the maps only when entering the Club.

- 27.11.2026 — Club DJ and judges. The Club-specific booth is generated by `tools/build_city_dj.py` with `--club` after the output path.
  It uses the shared reaching animation with local vinyl and fader pivots. `tools/build_club_judges.py` exports one chair and the two side
  tables. The Club places three copies and keeps the judges seated using the real body rig. The 7 to Smoke decision forwards the three
  votes to their cards. Club assets load only in the Club.
