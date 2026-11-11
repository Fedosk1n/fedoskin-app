// Список уроков. Его меняет админка (admin.html) — вручную можно, но формат должен остаться JSON.
// id — имя файлов в v/: <id>.mp4 (видео), <id>.jpg (обложка), <id>-p3.mp4 (анимация обложки, если pv: true)
// sec — раздел; name — название; dur — длительность, сек; ru — русские слова для поиска;
// added — дата добавления ГГГГ-ММ-ДД (значок NEW); hidden — скрыт из приложения; chapters — главы [{t: сек, title}]
window.LESSONS_DATA = [
 {
  "id": "tr-indian-step",
  "sec": "Toprock",
  "name": "Indian step",
  "dur": 40,
  "ru": "Indian step Индиан степ",
  "added": "2026-11-04",
  "pv": true,
  "vertical": true,
  "r2": "tr-indian-step-5i96sa6m.mp4"
 },
 {
  "id": "tr-cross",
  "sec": "Toprock",
  "name": "Cross step",
  "dur": 52,
  "ru": "кросс степ",
  "pv": true,
  "vertical": true,
  "r2": "tr-cross-5if3qtlc.mp4"
 },
 {
  "id": "tr-kick-step",
  "sec": "Toprock",
  "name": "Kick step",
  "dur": 70,
  "ru": "кикстеп kick step",
  "added": "2026-11-02",
  "pv": true,
  "vertical": true,
  "r2": "tr-kick-step-5iix8jqf.mp4"
 },
 {
  "id": "fw-6step",
  "sec": "Footwork",
  "name": "6-step",
  "dur": 28,
  "ru": "сикс степ шесть шагов",
  "pv": true,
  "vertical": true,
  "r2": "fw-6step-5iu2h0ii.mp4"
 },
 {
  "id": "fw-3step",
  "sec": "Footwork",
  "name": "3-step",
  "dur": 33,
  "ru": "три степ",
  "pv": true,
  "vertical": true,
  "r2": "fw-3step-5j8vxy9g.mp4"
 },
 {
  "id": "fw-baby-love",
  "sec": "Footwork",
  "name": "Baby love",
  "dur": 46,
  "ru": "Baby love",
  "added": "2026-11-07",
  "pv": true,
  "vertical": true,
  "ks": "9365fefb-f0d4-49a7-8a55-34dd56a9a68e"
 },
 {
  "id": "fw-cc",
  "sec": "Footwork",
  "name": "CC",
  "dur": 26,
  "ru": "сиси сс",
  "pv": true,
  "vertical": true,
  "r2": "fw-cc-5jcxjs45.mp4"
 },
 {
  "id": "fw-zulu",
  "sec": "Footwork",
  "name": "Zulu spin",
  "dur": 23,
  "ru": "зулу спин",
  "pv": true,
  "vertical": true,
  "r2": "fw-zulu-5jgingql.mp4"
 },
 {
  "id": "fw-hooks",
  "sec": "Footwork",
  "name": "Hooks",
  "dur": 26,
  "ru": "хуки хук",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "fw-hooks-5jjfvtog.mp4"
 },
 {
  "id": "fw-kickout",
  "sec": "Footwork",
  "name": "Kick-out steps",
  "dur": 35,
  "ru": "кик аут",
  "pv": true,
  "vertical": true,
  "r2": "fw-kickout-5jn0e4er.mp4"
 },
 {
  "id": "fw-fishtail",
  "sec": "Footwork",
  "name": "Fishtail flip",
  "dur": 34,
  "ru": "фиштейл флип",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "fw-fishtail-5jt17l7a.mp4"
 },
 {
  "id": "gd-underknee",
  "sec": "Godowns",
  "name": "Underknee",
  "dur": 13,
  "ru": "андерни под колено",
  "pv": true,
  "vertical": true,
  "r2": "gd-underknee-5jwzo0bt.mp4"
 },
 {
  "id": "gd-unknown",
  "sec": "Godowns",
  "name": "[Godown без названия]",
  "dur": 32,
  "ru": "",
  "pv": true,
  "vertical": true,
  "r2": "gd-unknown-5jzr6kuk.mp4"
 },
 {
  "id": "gd-windmill-entry",
  "sec": "Godowns",
  "name": "windmill entry",
  "dur": 488,
  "ru": "заход в гелик windmill entry",
  "added": "2026-10-30",
  "pv": true,
  "ks": "23993e1d-9e0f-4e07-9ac9-de62a0cfabad"
 },
 {
  "id": "gd-knee-down-spin",
  "sec": "Godowns",
  "name": "Knee down spin",
  "dur": 29,
  "ru": "",
  "added": "2026-11-08",
  "pv": true,
  "vertical": true,
  "ks": "32636f48-5008-4c13-8c63-cc76fc4a5376"
 },
 {
  "id": "fr-easychair",
  "sec": "Freezes",
  "name": "Easy chair freeze",
  "dur": 21,
  "ru": "изи чеир стул chair чер",
  "pv": true,
  "vertical": true,
  "r2": "fr-easychair-5k378e3e.mp4"
 },
 {
  "id": "fr-elbow",
  "sec": "Freezes",
  "name": "Elbow freeze",
  "dur": 39,
  "ru": "элбоу локоть",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "fr-elbow-5kd77lsq.mp4"
 },
 {
  "id": "fr-shoulder-freeze",
  "sec": "Freezes",
  "name": "shoulder freeze",
  "dur": 59,
  "ru": "shoulder на плече",
  "added": "2026-10-31",
  "pv": true,
  "vertical": true,
  "r2": "fr-shoulder-freeze-5kuht6i2.mp4"
 },
 {
  "id": "tk-monkey",
  "sec": "Tricks",
  "name": "Monkey flip",
  "dur": 34,
  "ru": "манки флип обезьяна",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "tk-monkey-5l5vx1ua.mp4"
 },
 {
  "id": "tk-turtlehs",
  "sec": "Tricks",
  "name": "Turtle → handstand freeze",
  "dur": 41,
  "ru": "черепаха стойка на руках хендстенд",
  "pv": true,
  "vertical": true,
  "r2": "tk-turtlehs-5lh3mwr0.mp4"
 },
 {
  "id": "pw-airflare",
  "sec": "Powermove",
  "name": "Airflare(airtwist)",
  "dur": 450,
  "ru": "эйрфлаер эирфлаер аирфлаер флаер твист",
  "added": "2026-10-29",
  "pv": true,
  "ks": "de8dad97-f470-4552-93c4-45575e6d3f29"
 },
 {
  "id": "pw-turtle",
  "sec": "Powermove",
  "name": "Turtle",
  "dur": 443,
  "ru": "тертл тартл черепаха",
  "added": "2026-10-29",
  "pv": true,
  "ks": "634db7c3-35bc-4a80-b160-c44a09cdbab8"
 },
 {
  "id": "pw-windmill",
  "sec": "Powermove",
  "name": "Windmill",
  "dur": 365,
  "ru": "виндмил виндмилл мельница",
  "added": "2026-10-29",
  "pv": true,
  "ks": "8b3ef664-01b9-42db-a1e1-b88ad726c46c"
 },
 {
  "id": "pw-swipes",
  "sec": "Powermove",
  "name": "Swipes",
  "dur": 333,
  "ru": "свайпы свайп свипы",
  "added": "2026-10-29",
  "pv": true,
  "ks": "6ee9d371-0eb2-4221-8f98-35a9c985c3ba"
 },
 {
  "id": "pw-headspin",
  "sec": "Powermove",
  "name": "Headspin",
  "dur": 318,
  "ru": "хедспин хэдспин вращение на голове",
  "added": "2026-10-29",
  "pv": true,
  "ks": "8a2e472e-d16f-4c45-9032-b4781ba7d840"
 },
 {
  "id": "pw-munchmill",
  "sec": "Powermove",
  "name": "munchmill",
  "dur": 780,
  "ru": "munchmill nuchmill мачмил бочка барел",
  "added": "2026-10-30",
  "pv": true,
  "ks": "dfb81103-2a48-4752-938a-b851625ae79f"
 },
 {
  "id": "tr-windmill-head",
  "sec": "Powermove",
  "name": "Windmill(head)",
  "dur": 570,
  "ru": "гелик windmill гелик через голову гелик с головой",
  "added": "2026-10-30",
  "pv": true,
  "ks": "8da3c6ff-6f53-41ab-9f02-755358e3e5df"
 },
 {
  "id": "pw-reverse-1990",
  "sec": "Powermove",
  "name": "Reverse 1990",
  "dur": 1020,
  "ru": "reverse 1990 реверс",
  "added": "2026-11-11",
  "pv": true,
  "r2": "pw-reverse-1990-jun24gi0.mp4"
 },
 {
  "id": "tn-flare-to-airflare-to-flare",
  "sec": "Transitions",
  "name": "Flare to airflare to flare",
  "dur": 539,
  "ru": "flare to airflare флай в твист",
  "added": "2026-10-30",
  "pv": true,
  "ks": "262fa2a3-9675-40ac-8b20-5092475a3192"
 },
 {
  "id": "pw-flare-wm",
  "sec": "Transitions",
  "name": "Flare → Windmill → Flare",
  "dur": 533,
  "ru": "флаер флэр виндмил мельница",
  "added": "2026-10-29",
  "pv": true,
  "ks": "fcbcbb79-43ca-482d-b0f2-01472155230a"
 },
 {
  "id": "pw-flare-1990",
  "sec": "Transitions",
  "name": "Flare → 1990 → Flare",
  "dur": 419,
  "ru": "флаер флэр 1990 девяностый",
  "added": "2026-10-29",
  "pv": true,
  "ks": "9646f680-1ae0-4b57-99f3-d1b8ea41cb7f"
 },
 {
  "id": "pw-swipes-flare",
  "sec": "Transitions",
  "name": "Swipes → Flare → Swipes",
  "dur": 436,
  "ru": "свайпы свайп флаер флэр",
  "added": "2026-10-29",
  "pv": true,
  "ks": "6faac4e1-de8a-4952-8d09-6134e13ee34a"
 }
];
