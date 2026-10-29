# Fedoskin team app — notes for Claude

- Owner writes in Russian; answer in Russian, plain language (he is not a developer).
- Static web alpha, no build step: `index.html` (all UI + JS), `lessons.js` (lesson data), `v/` (videos).
- Dark hip-hop design: Anton + Inter, accent #E2611A, NEW badge #3BD16F. Keep the look consistent.
- Alpha mode: `ALPHA = true` in index.html — all lessons free, "Free" tags hidden; review (Разбор) is paid via Telegram
  link `t.me/Fe_DoSk1n?text=...` (TG_USERNAME constant).
- Hidden for later (do not delete): courses, articles, promo tab, "my reviews". Elements carry `hidden data-later="..."`
  or are commented out in TABS.
- Adding a lesson: encode to 720p H.264 60fps CRF 26 (`-preset veryfast`), cover jpg 480px wide from 2s,
  preview `<id>-p3.mp4` = first 3s, crop 720:960 → 360x480, 30fps, no audio; add a row to `lessons.js` with `added` date.
- Keep each video file well under 25 MB (GitHub web limit) — current lessons are 1.5–7 MB.
- Full product plan and decisions live in the claude.ai Project doc `claude/fedoskin-app-plan.md`.
