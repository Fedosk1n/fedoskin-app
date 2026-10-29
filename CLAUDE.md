# Fedoskin team app — notes for Claude

- Owner writes in Russian; answer in Russian, plain language (he is not a developer).
- Static web alpha, no build step: `index.html` (all UI + JS), `lessons.js` (lesson data, strict JSON after `window.LESSONS_DATA =`),
  `config.js` (settings: alpha, banner, Telegram, review prices/hours, newDays, metrikaId,
  subscription prices subRub/subYearRub/subUsd/subYearUsd — ru UI pays in ₽, all other languages in $; `SUB` in index.html), `v/` (videos).
- `admin.html` — owner's admin panel: edits lessons.js/config.js and uploads videos via the GitHub API (fine-grained token in
  the owner's browser). Keep lessons.js/config.js machine-readable JSON so the admin can parse them. Lesson fields:
  id, sec, name, dur, ru, added, pv (false = no -p3 preview), hidden, new (false = no NEW badge).
  `vendor/mediabunny.min.mjs` (MPL-2.0) does in-browser compression.
- Languages: ru (source) + en, es, pt, fr, de, ja, ko, zh. UI texts in index.html stay Russian; `T('русский текст', {vars})`
  translates in JS, `translateDom()` translates fixed HTML text/aria/placeholder by exact match. Dictionary is generated:
  edit `tools/i18n_src.py`, then `python3 tools/i18n_src.py i18n.js`. Every new visible Russian string needs a key there.
  Language is picked from the phone (CIS -> ru, unknown -> en), changed via the RU pill / Профиль → Язык (`fedoskin-lang`).
  Lesson videos are Russian speech; move names are international. Admin stays Russian only.
- Analytics: owner decided NO Yandex Metrika (29.10.2026, legal/consent hassle). `metrikaId` stays empty; the dormant
  code in index.html loads nothing. Admin hides the Metrika field/instructions (`data-later="metrika"`).
- Dark hip-hop design: Anton + Inter, accent #E2611A, NEW badge #3BD16F. Keep the look consistent.
- Alpha mode: `alpha: true` in config.js — all lessons free, "Free" tags hidden; review (Разбор) is paid via Telegram
  link `t.me/Fe_DoSk1n?text=...` (`tg` in config.js).
- Hidden for later (do not delete): courses, articles, promo tab, "my reviews". Elements carry `hidden data-later="..."`
  or are commented out in TABS.
- Adding a lesson: encode to 720p H.264 60fps CRF 26 (`-preset veryfast`), cover jpg 480px wide from 2s,
  preview `<id>-p3.mp4` = first 3s, crop 720:960 → 360x480, 30fps, no audio; add a row to `lessons.js` with `added` date.
- Keep each video file well under 25 MB (GitHub web limit) — current lessons are 1.5–7 MB.
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
