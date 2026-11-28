import { CAST, DECISIONS, EPISODES, STORY_TURNS, VENUES, venueFor } from './city3d-campaign-data.js?v=1';
import { loadCampaign, pieceAt, recordDecision } from './city3d-campaign-engine.js?v=1';

export const FESTIVAL_CAST = { ...CAST, stitch: 'Стежок', granite: 'Гранит' };
export const ACT_ENDS = [6, 13, 20, 28, 38, 48, 59, 60];
const previousEnds = [6, 13, 20, 28, 36, 44, 53, 60];

const laterScenes = [
  ['club','forge','Свести последний список отбора'],
  ['decks','vint','Отдать запись без объявления'],
  ['wall','granite','Услышать, почему Гранит снялся'],
  ['tea','stencil','Перепечатать программу у киоска'],
  ['bars','stitch','Проверить сигнал Стежка'],
  ['loading','rivet','Разгрузить второй комплект стоек'],
  ['decks','vint','Свести запись с объявлением'],
  ['club','bolt','Выбрать, где искать резервный вход','access'],
  ['site','stencil','Найти человека с ключом'],
  ['metro','chrome','Передать заход с нужной стороны'],
  ['wall','forge','Проверить новый список у табло'],
  ['site','rivet','Развести две очереди у первой стойки'],
  ['site','vint','Оставить музыке окно перед раундом'],
  ['site','stencil','Открыть городские ворота'],
  ['site','bolt','Решить, как выйти обоим','format'],
  ['site','stitch','Подхватить комбо после паузы'],
  ['site','granite','Ответить на длинную долю Гранита'],
  ['site','vint','Подхватить смену записи'],
  ['site','rivet','Проверить второе объявление'],
  ['site','stitch','Дать тем, кто ждал, записать свой раунд'],
  ['site','chrome','Открыть второй круг'],
  ['site','granite','Ответить без объявления имён'],
  ['site','bolt','Передать площадку обоим составам'],
  ['site','vint','Закрыть фестиваль общим раундом'],
  ['circle','pendulum','Разложить новую афишу спустя годы'],
];

const revised = { 0: ['circle','vint','Последнее время на показе','slot'],
  14: ['chess','granite','Встретиться с обоими у шахматных столов'] };
laterScenes.forEach((row, index) => { revised[index + 35] = row; });

export const FESTIVAL_EPISODES = EPISODES.map((episode, index) => {
  const [venue, speaker, title, decision = episode.decision] = revised[index] ||
    [episode.venue, episode.speaker, episode.title];
  return { ...episode, venue, speaker, title, decision, act: ACT_ENDS.findIndex(end => index < end) };
});

export const STORY_CHOICES = {
  ...DECISIONS,
  slot: {
    question: 'Кому отдать последний показательный раунд?',
    options: [
      { tag: 'stitch', label: 'Стежку · дробный вход', consequence: 'Стежок: «Дай мне один удар до бочки». Гранит: «Я всё равно останусь. Посмотрю, как держишь второй вход».' },
      { tag: 'granite', label: 'Граниту · длинная пауза', consequence: 'Гранит: «Я ждал этой записи весь месяц». Стежок снимает куртку у коврика: «Тогда потренирую там свой второй вход».' },
    ],
  },
  access: {
    question: 'Где собрать запасной вход?',
    options: [
      { tag: 'trace', label: 'Пойти к тому, кто ждал в первый вечер', consequence: 'Клёпка: «Раз он уже держал запасной план, спросим у него. Бери только одну стойку».' },
      { tag: 'metro', label: 'Вернуться к общему входу у метро', consequence: 'Шуруп: «Поставим две очереди у метро. Вторая группа услышит короткий подхват».' },
    ],
  },
  format: {
    question: 'Как объявить последние раунды Стежка и Гранита?',
    options: [
      { tag: 'relay', label: 'Один общий брейк с передачей', consequence: 'Стежок: «Начну с дробления. Гранит, забирай круг, когда я оставлю пустое место».' },
      { tag: 'split', label: 'Два ответа на один и тот же бит', consequence: 'Гранит: «Сыграй ту же пластинку ещё раз. Стежок услышит тот же акцент и ответит по-своему».' },
    ],
  },
};

export const REVISED_TURNS = {
  ...STORY_TURNS,
  0: { preparatory: 'mat',
    before: 'Винт придерживает створку: «Завтра двор закрыт. Сегодня один показательный отрезок, потом освобождаем пол». Шуруп видел, как Стежок неделю добивал вход у коврика. Клёпка обещала Граниту время на комбо, которое он привёз из района.',
    after: 'Винт убрал табличку с показом. Открытая тренировка ещё идёт, и у коврика уже слышен другой рисунок.' },
  14: { preparatory: null,
    before: 'Стежок и Гранит ставят разные пластинки от одного брейка. Выслушай обоих и ответь на рисунок того, чей раунд тогда остался за кадром.',
    after: 'Они записали оба раунда и каждый подписал свой. Винт берёт обе записи на следующую встречу.' },
  34: { preparatory: 'wall',
    before: 'Гранит зачеркнул своё имя. Клёпка поставила его во второй раунд, а звукооператор убрал окно, когда влезла реклама. Гранит: «Мою паузу под объявление не отдавайте. Вторую стойку заберу к боковой арке».',
    after: 'Гранит ушёл со стойкой. Его запись осталась у Винта, но теперь перед фестивалем нужно решить, где держать запасной вход.' },
  37: { preparatory: null,
    before: 'Гранит вернулся за записью. У боковой арки он уже поставил стойку и оставил место вдоль стены. «Это для тех, кто опоздал к списку. Если понадобится, ключ у меня».',
    after: 'Клёпка отметила запасной проход карандашом. На афише его пока нет.' },
  42: { preparatory: 'wall',
    before: 'Винт наложил голос на брейк: первое объявление заглохло ударом. Найди метку у табло, потом сыграй переход после пустой доли.',
    after: 'Трафареты услышали обе очереди в записи. На плёнке теперь два коротких объявления.' },
  43: { preparatory: null,
    before: 'Боковая створка на выбранной площадке не закрывается до конца. Шуруп ждёт распоряжения, куда вести второй ряд, пока у входа протягивают кабель.',
    after: 'Винт унёс выбранную схему к пульту. Следующая встреча начнётся по новому адресу.' },
  44: { preparatory: null,
    before: 'Пока кабель ждёт, отметь порядок входов на плане. Затем проверь его в музыке.',
    after: 'Дежурные приклеили бумажные стрелки. Обе очереди смогут услышать друг друга.' },
  46: { before: 'Литейка держит табло открытым: одно имя затёрло другое. Сверь запись, прежде чем начнётся первая очередь.',
    after: 'На карточках оба имени и разный порядок входов. Литейка несёт запись к площадке.' },
  48: { preparatory: null,
    before: 'Две двери открылись. Винт просит сыграть вход для тех, кто стоит у второго ряда и ещё не видит круг.',
    after: 'Дальний ряд услышал сигнал. Впервые люди вошли с обеих сторон одновременно.' },
  49: { before: 'Гранит нашёл Стежка за стойкой. Оба готовы выступить: у Стежка резкий вход, у Гранита длинная доля. Винт оставил одну пластинку и время на два ответа или общую передачу.',
    after: 'Винт показал две руки над пультом. Состав услышал, когда у каждого появится место.' },
  51: { before: 'Гранит даёт длинную долю и ждёт, как ты её прочитаешь. Он заметит смену направления и выдержанный фриз.',
    after: 'Гранит оставил эту дорожку в коробке с записями. «На второй удар ты не пошёл за мной».' },
  52: { before: 'Винт поднимает иглу: у запасного пульта крутится другая запись. Найди её подхват, прежде чем объявят следующий раунд.',
    after: 'Брейки состыковались. Винт оставил пустой такт между объявлениями.' },
  53: { before: 'У второго микрофона очередь ещё не двинулась. Винт: «Дай сначала услышать пустую долю, я вставлю слова только после неё».',
    after: 'Слова прозвучали в оставленном месте. Клёпка перевернула карточку входа лицом к дальнему ряду.' },
  54: { before: 'Стежок просит проверить запасной сигнал для тех, кто стоял во второй очереди. «Если они не слышат первый удар, дай им маленький».' ,
    after: 'Вторая очередь вошла по дробному сигналу. Несколько человек из первой остались посмотреть.' },
  55: { before: 'Клёпка подтягивает стойку к краю. Проводи раунды в выбранном порядке, пока люди из первой очереди пропускают вторую.',
    after: 'Первый танцор отступил к стойке. Новые участники взяли середину по его сигналу.' },
  56: { before: 'Гранит отходит от микрофона: «Ещё раз тот же акцент, без имён. Посмотрим, кто услышит место для своего движения».',
    after: 'Трафареты пометили на записи два разных ответа. Объявление уже не понадобилось.' },
  57: { before: 'Две команды стоят у разных углов. Шуруп просит показать каждой свой знак до начала последнего раунда.',
    after: 'Стежок и Гранит ответили каждый на свой знак. Команды оставили середину свободной для последнего круга.' },
  58: { before: 'Шуруп убрал временную ленту с прохода, Клёпка встала у пульта. Последний раунд: сыграй объявленный порядок и оставь на нужном ударе место следующему.',
    after: 'Когда пластинка остановилась, Стежок и Гранит вместе сняли стойку с прохода. На афише остались обе записи.' },
  59: { before: 'Спустя несколько лет у коврика вешают новую афишу. Маятник держит старую запись. «У них свой состав. Давай сыграем один вход и выйдем до объявления».',
    after: 'Новые танцоры заняли середину. У края круга Стежок поправил стрелку, а Гранит убрал стойку, которую всё ещё узнавал по царапине.' },
};

const continuity = {
  0: {
    stitch: 'На показ идёт Стежок. Гранит остаётся у края и слушает. Твой первый рисунок начинается с дробного входа.',
    granite: 'На показ идёт Гранит. Стежок ждёт у коврика. Твой первый рисунок оставляет место долгой паузе.',
  },
  14: {
    stitch: 'Гранит: «В тот вечер я услышал Стежка. Теперь поставь мою длинную долю». Стежок: «Я сберёг обе записи».',
    granite: 'Стежок: «Пока вы играли, я оставил вход на слабой доле. Дай ему место». Гранит: «С прошлого раза я принёс тихую сторону».',
  },
  44: {
    trace: 'Тот, кто ждал в первый вечер, уже ставит свою стойку у запасного подхода. Сыграй его сигнал до основного входа.',
    metro: 'У метро хромированные мелом развели два потока. Проверь дробный сигнал на коротком переходе.',
  },
  50: {
    relay: 'Стежок входит первым, Гранит забирает круг в паузе. Подай передачу прямо в музыку.',
    split: 'Гранит играет первым. Винт повторяет тот же брейк, Стежок отвечает другим рисунком.',
  },
};

export function storyLine(episode, choices) {
  const key = episode < 15 ? choices.slot : episode === 44 ? choices.access : choices.format;
  return continuity[episode]?.[key] || '';
}

export function waitingDancer(choices) {
  return choices.slot === 'granite' ? 'stitch' : 'granite';
}

export function storyVenue(episode, choices, legacy = false) {
  if (legacy) return venueFor(EPISODES[episode], choices);
  if (episode === 44 && choices.access) {
    if (choices.access === 'metro') return VENUES.metro;
    return choices.slot === 'granite' ? VENUES.bars : VENUES.loading;
  }
  return venueFor(FESTIVAL_EPISODES[episode], choices);
}

export function loadFestivalState(value) {
  const state = loadCampaign(value?.v === 2 ? { ...value, v: 1 } : value);
  state.v = 2;
  if (!value || state.episode !== value.episode || ![1, 2].includes(value.v)) return state;
  if (value.v === 1) {
    state.legacyActs = previousEnds.filter(end => state.episode >= end).length;
    if (state.piece || state.beat) state.legacyEpisode = state.episode;
  } else {
    state.legacyActs = Number.isInteger(value.legacyActs) ? Math.min(8, Math.max(0, value.legacyActs)) : 0;
    if (value.legacyEpisode === state.episode) state.legacyEpisode = value.legacyEpisode;
  }
  for (const [name, decision] of Object.entries(STORY_CHOICES)) {
    if (decision.options.some(option => option.tag === value.choices?.[name])) state.choices[name] = value.choices[name];
  }
  state.cueSheet = state.episode === 44 && ['lead', 'answer'].includes(value.cueSheet) ? value.cueSheet : undefined;
  const retry = value.rematch;
  if ([0, 1].includes(retry?.style) && retry.key === [state.episode,state.piece,state.beat].join(':')) {
    state.rematch = { key: retry.key, style: retry.style };
  }
  return state;
}

export const legacyMeeting = (state, episode = state.episode) => state.legacyEpisode === episode && state.episode === episode;
export const actAvailable = (state, act) => (state.legacyActs || 0) > act || state.episode >= ACT_ENDS[act];

export function storyDecision(state) {
  const old = EPISODES[state.episode]?.decision;
  const current = FESTIVAL_EPISODES[state.episode]?.decision;
  if (current === old) return old;
  if (legacyMeeting(state) && (state.episode !== 0 || state.piece || state.beat)) return old;
  return current;
}

export function recordStoryDecision(state, tag) {
  const id = storyDecision(state);
  if (!id || state.choices[id] || !STORY_CHOICES[id].options.some(option => option.tag === tag)) return false;
  if (Object.hasOwn(DECISIONS, id)) return recordDecision(state, tag);
  state.choices[id] = tag;
  return true;
}

// Preserve the exact published tempo/length at every old checkpoint. The reshuffled acts
// may raise the local threshold, but never make the existing musical requirements easier.
export function storyCourse(episode, piece, state) {
  const base = pieceAt(episode, piece, state.choices);
  if (!base || legacyMeeting(state, episode)) return base;
  const scene = FESTIVAL_EPISODES[episode];
  let seed = base.seed, flavor = base.flavor, combo;
  if (episode === 0 && state.choices.slot) {
    if (piece === 0) {
      const stitch = state.choices.slot === 'stitch';
      seed += stitch ? 3 : 7;
      flavor = stitch ? 1 : 2;
      combo = stitch ? 'openingStitch' : 'openingGranite';
    }
    if (piece === 2) combo = state.choices.slot === 'stitch' ? 'switch' : 'afterbreak';
  }
  if (episode === 14 && piece === 0) combo = state.choices.slot ? waitingDancer(state.choices) : 'granite';
  if (episode === 44 && piece === 0) combo = state.cueSheet === 'lead' ? 'switch' : 'afterbreak';
  if (episode === 50 && piece === 0) combo = state.choices.format === 'relay' ? 'handoff' : 'rematch';
  if (episode === 55 && piece === 0) combo = state.choices.format === 'split' ? 'rematch' : 'handoff';
  combo ||= {
    '1:0':'drop','4:1':'afterbreak','8:2':'switch','11:1':'thread','17:0':'rematch',
    '19:1':'thread','22:2':'afterbreak','24:1':'switch','28:0':'anchor','29:1':'coil',
    '31:0':'stitch','33:1':'granite','34:2':'thread','36:1':'drop','39:0':'handoff',
    '42:3':'afterbreak','46:1':'rematch','48:3':'handoff','51:0':'granite','52:2':'coil',
    '53:0':'afterbreak','54:0':'stitch','56:0':'rematch','57:0':'handoff','58:3':'handoff','59:1':'drop',
  }[episode + ':' + piece];
  return { ...base, act: Math.max(base.act, scene.act), seed, flavor, combo, episode, piece };
}

export function finalOrder(choices) {
  const first = choices.format === 'relay' ? 'stitch' : choices.format === 'split' ? 'granite' : choices.slot || 'stitch';
  return [first, first === 'stitch' ? 'granite' : 'stitch'];
}
