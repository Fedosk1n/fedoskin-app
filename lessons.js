// Список уроков. Его меняет админка (admin.html) — вручную можно, но формат должен остаться JSON.
// id — имя файлов в v/: <id>.mp4 (видео), <id>.jpg (обложка), <id>-p3.mp4 (анимация обложки, если pv: true)
// sec — раздел; name — название; dur — длительность, сек; ru — русские слова для поиска;
// added — дата добавления ГГГГ-ММ-ДД (значок NEW); hidden — скрыт из приложения; chapters — главы [{t: сек, title}]
window.LESSONS_DATA = [
 {
  "id": "tr-cross",
  "sec": "Toprock",
  "name": "Cross step",
  "dur": 52,
  "ru": "кросс степ",
  "pv": true
 },
 {
  "id": "fw-6step",
  "sec": "Footwork",
  "name": "6-step",
  "dur": 28,
  "ru": "сикс степ шесть шагов",
  "pv": true
 },
 {
  "id": "fw-3step",
  "sec": "Footwork",
  "name": "3-step",
  "dur": 33,
  "ru": "три степ",
  "pv": true
 },
 {
  "id": "fw-cc",
  "sec": "Footwork",
  "name": "CC",
  "dur": 26,
  "ru": "сиси сс",
  "pv": true
 },
 {
  "id": "fw-zulu",
  "sec": "Footwork",
  "name": "Zulu spin",
  "dur": 23,
  "ru": "зулу спин",
  "pv": true
 },
 {
  "id": "fw-hooks",
  "sec": "Footwork",
  "name": "Hooks",
  "dur": 26,
  "ru": "хуки хук",
  "added": "2026-10-26",
  "pv": true
 },
 {
  "id": "fw-kickout",
  "sec": "Footwork",
  "name": "Kick-out steps",
  "dur": 35,
  "ru": "кик аут",
  "pv": true
 },
 {
  "id": "fw-fishtail",
  "sec": "Footwork",
  "name": "Fishtail flip",
  "dur": 34,
  "ru": "фиштейл флип",
  "added": "2026-10-26",
  "pv": true
 },
 {
  "id": "gd-underknee",
  "sec": "Godowns",
  "name": "Underknee",
  "dur": 13,
  "ru": "андерни под колено",
  "pv": true
 },
 {
  "id": "gd-unknown",
  "sec": "Godowns",
  "name": "[Godown без названия]",
  "dur": 32,
  "ru": "",
  "pv": true
 },
 {
  "id": "fr-easychair",
  "sec": "Freezes",
  "name": "Easy chair freeze",
  "dur": 21,
  "ru": "изи чеир стул",
  "pv": true
 },
 {
  "id": "fr-elbow",
  "sec": "Freezes",
  "name": "Elbow freeze",
  "dur": 39,
  "ru": "элбоу локоть",
  "added": "2026-10-26",
  "pv": true
 },
 {
  "id": "tk-monkey",
  "sec": "Tricks",
  "name": "Monkey flip",
  "dur": 34,
  "ru": "манки флип обезьяна",
  "added": "2026-10-26",
  "pv": true
 },
 {
  "id": "tk-turtlehs",
  "sec": "Tricks",
  "name": "Turtle → handstand freeze",
  "dur": 41,
  "ru": "черепаха стойка на руках хендстенд",
  "pv": true
 },
 {
  "id": "pw-flare-wm",
  "sec": "Powermove",
  "name": "Flare → Windmill → Flare",
  "dur": 535,
  "ru": "флаер флэр виндмил мельница",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-flare-1990",
  "sec": "Powermove",
  "name": "Flare → 1990 → Flare",
  "dur": 421,
  "ru": "флаер флэр 1990 девяностый",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-airflare",
  "sec": "Powermove",
  "name": "Airflare",
  "dur": 454,
  "ru": "эйрфлаер эирфлаер аирфлаер флаер",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-turtle",
  "sec": "Powermove",
  "name": "Turtle",
  "dur": 445,
  "ru": "тертл тартл черепаха",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-windmill",
  "sec": "Powermove",
  "name": "Windmill",
  "dur": 366,
  "ru": "виндмил виндмилл мельница",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-swipes",
  "sec": "Powermove",
  "name": "Swipes",
  "dur": 333,
  "ru": "свайпы свайп свипы",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-headspin",
  "sec": "Powermove",
  "name": "Headspin",
  "dur": 321,
  "ru": "хедспин хэдспин вращение на голове",
  "added": "2026-10-29",
  "pv": true
 },
 {
  "id": "pw-swipes-flare",
  "sec": "Powermove",
  "name": "Swipes → Flare → Swipes",
  "dur": 438,
  "ru": "свайпы свайп флаер флэр",
  "added": "2026-10-29",
  "pv": true
 }
];
