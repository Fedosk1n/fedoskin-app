// Список уроков. Чтобы добавить урок: положите файлы в папку v/ и добавьте строку ниже.
// id    — имя файлов: v/<id>.mp4 (видео), v/<id>.jpg (обложка), v/<id>-p3.mp4 (анимация обложки, первые 3 сек)
// sec   — раздел: Toprock, Footwork, Godowns, Powermove, Freezes, Flowrock, Transitions, Tricks
// name  — название элемента; dur — длительность в секундах; ru — русские слова для поиска
// added — дата добавления (ГГГГ-ММ-ДД): 14 дней урок показывается со значком NEW
window.LESSONS_DATA = [
    { id:'tr-cross',     sec:'Toprock',  name:'Cross step',            dur:52, ru:'кросс степ' },
    { id:'fw-6step',     sec:'Footwork', name:'6-step',                dur:28, ru:'сикс степ шесть шагов' },
    { id:'fw-3step',     sec:'Footwork', name:'3-step',                dur:33, ru:'три степ' },
    { id:'fw-cc',        sec:'Footwork', name:'CC',                    dur:26, ru:'сиси сс' },
    { id:'fw-zulu',      sec:'Footwork', name:'Zulu spin',             dur:23, ru:'зулу спин' },
    { id:'fw-hooks',     sec:'Footwork', name:'Hooks',                 dur:26, ru:'хуки хук' , added:'2026-10-26' },
    { id:'fw-kickout',   sec:'Footwork', name:'Kick-out steps',        dur:35, ru:'кик аут' },
    { id:'fw-fishtail',  sec:'Footwork', name:'Fishtail flip',         dur:34, ru:'фиштейл флип' , added:'2026-10-26' },
    { id:'gd-underknee', sec:'Godowns',  name:'Underknee',             dur:13, ru:'андерни под колено' },
    { id:'gd-unknown',   sec:'Godowns',  name:'[Godown без названия]', dur:32, ru:'' },
    { id:'fr-easychair', sec:'Freezes',  name:'Easy chair freeze',     dur:21, ru:'изи чеир стул' },
    { id:'fr-elbow',     sec:'Freezes',  name:'Elbow freeze',          dur:39, ru:'элбоу локоть' , added:'2026-10-26' },
    { id:'tk-monkey',    sec:'Tricks',   name:'Monkey flip',           dur:34, ru:'манки флип обезьяна' , added:'2026-10-26' },
    { id:'tk-turtlehs',  sec:'Tricks',   name:'Turtle → handstand freeze', dur:41, ru:'черепаха стойка на руках хендстенд' }
];
