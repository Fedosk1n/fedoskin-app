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
  "pv": true,
  "vertical": true
 },
 {
  "id": "fw-6step",
  "sec": "Footwork",
  "name": "6-step",
  "dur": 28,
  "ru": "сикс степ шесть шагов",
  "pv": true,
  "ks": "a4e77791-70b3-458b-b62d-fb48d60dbc50",
  "vertical": true
 },
 {
  "id": "fw-3step",
  "sec": "Footwork",
  "name": "3-step",
  "dur": 33,
  "ru": "три степ",
  "pv": true,
  "vertical": true
 },
 {
  "id": "fw-cc",
  "sec": "Footwork",
  "name": "CC",
  "dur": 26,
  "ru": "сиси сс",
  "pv": true,
  "vertical": true
 },
 {
  "id": "fw-zulu",
  "sec": "Footwork",
  "name": "Zulu spin",
  "dur": 23,
  "ru": "зулу спин",
  "pv": true,
  "vertical": true
 },
 {
  "id": "fw-hooks",
  "sec": "Footwork",
  "name": "Hooks",
  "dur": 26,
  "ru": "хуки хук",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true
 },
 {
  "id": "fw-kickout",
  "sec": "Footwork",
  "name": "Kick-out steps",
  "dur": 35,
  "ru": "кик аут",
  "pv": true,
  "vertical": true
 },
 {
  "id": "fw-fishtail",
  "sec": "Footwork",
  "name": "Fishtail flip",
  "dur": 34,
  "ru": "фиштейл флип",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true
 },
 {
  "id": "gd-underknee",
  "sec": "Godowns",
  "name": "Underknee",
  "dur": 13,
  "ru": "андерни под колено",
  "pv": true,
  "vertical": true
 },
 {
  "id": "gd-unknown",
  "sec": "Godowns",
  "name": "[Godown без названия]",
  "dur": 32,
  "ru": "",
  "pv": true,
  "vertical": true
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
  "id": "fr-easychair",
  "sec": "Freezes",
  "name": "Easy chair freeze",
  "dur": 21,
  "ru": "изи чеир стул chair чер",
  "pv": true,
  "ks": "5d85dd25-d0a6-4429-b038-a828c8eb2f07",
  "vertical": true
 },
 {
  "id": "fr-elbow",
  "sec": "Freezes",
  "name": "Elbow freeze",
  "dur": 39,
  "ru": "элбоу локоть",
  "added": "2026-10-26",
  "pv": true,
  "ks": "612865e9-a251-428a-a7b7-221ed67d3f9f",
  "vertical": true
 },
 {
  "id": "tk-monkey",
  "sec": "Tricks",
  "name": "Monkey flip",
  "dur": 34,
  "ru": "манки флип обезьяна",
  "added": "2026-10-26",
  "pv": true,
  "ks": "8eb7c39d-271c-40ac-bcfe-f0558e8e30ad",
  "vertical": true
 },
 {
  "id": "tk-turtlehs",
  "sec": "Tricks",
  "name": "Turtle → handstand freeze",
  "dur": 41,
  "ru": "черепаха стойка на руках хендстенд",
  "pv": true,
  "ks": "5a15190c-6108-414f-bbe0-73987bd64906",
  "vertical": true
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
