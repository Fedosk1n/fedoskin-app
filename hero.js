// The b-boy hero (owner 10.11.2026): our own flat cartoon character drawn as SVG; his outfit gets fresher with every
// level of training minutes. 8 levels, wide gaps. HERO.svg(level, {uid, bust, bg, size}) → SVG text. No brands, no logos.
// v2 (owner 10.11.2026 «детальнее… в мире брейкинга люди очень сильно заморачиваются над шмотками»): sneakers with
// outsole tread, midsole, toe box, overlays, eyelets and laces; caps with panels, eyelets, button, flat brim + sticker;
// beanie with rib cuff; bucket hat with stitch rows; tees with rib collar and folds; track jacket with stand collar,
// zip + pull, yoke, piping, rib cuffs; bomber with striped rib trims, patches and sleeve pocket; jeans with pockets,
// fly and stacked hem; track pants with piping and gathered cuffs; rope chain, wristbands, watch, earring, rings.
(function(){
  'use strict';
  // minutes needed for each level (0, 1 h, 4 h, 10 h, 20 h, 35 h, 60 h, 100 h)
  const LEVELS = [0, 60, 240, 600, 1200, 2100, 3600, 6000];
  // level names are Russian keys for T() in index.html (tools/i18n_src.py)
  const NAMES = ['Новичок', 'С района', 'Свой в кругу', 'Стайлер', 'Баттлер', 'Мастер круга', 'Звезда джема', 'Легенда'];
  // what the next look brings (shown under the progress bar)
  const PERKS = ['', 'кепка и свежие кроссы', 'чёрная футболка и треники', 'олимпийка, шапка и наушники', 'панама, цепь и очки',
    'бомбер и хайтопы', 'золото и бумбокс', 'пояс чемпиона'];
  // background ring colour per level
  const RING = ['#3A3A3F', '#5A4636', '#7A4A26', '#B4541C', '#E2611A', '#E58A2A', '#E7B23C', '#F2CC55'];

  // accessories shop (owner 10.11.2026: points for battle wins and lesson hours, never for money). One item per slot;
  // names are Russian i18n keys. Prices are repeated in server/push-worker.js (SHOP) — keep them equal.
  const SHOP = [
    { id: 'neon', slot: 'laces', price: 80, rar: 0, name: 'Неоновые шнурки', f: { laceStyle: 'cross' }, col: { laces: '#B6FF3B' }, bt: { win: 3 } },
    { id: 'gloves', slot: 'hands', price: 100, rar: 0, name: 'Перчатки без пальцев', bt: { cor: 2 } },
    { id: 'cardboard', slot: 'floor', price: 100, rar: 0, name: 'Картонка для брейка' },
    { id: 'knee', slot: 'knees', price: 120, rar: 1, name: 'Наколенники', bt: { hold: 1 } },
    { id: 'bandana', slot: 'head', price: 150, rar: 1, name: 'Бандана', bt: { cor: 4 } },
    { id: 'wall', slot: 'bg', price: 200, rar: 2, name: 'Фон: граффити-стена' },
    { id: 'city', slot: 'bg', price: 200, rar: 2, name: 'Фон: ночной город' },
    { id: 'red', slot: 'kicks', price: 2400, rar: 4, catalog: 3, winDays: 21, name: 'Красные кроссовки', bt: { win: 20 } },
    { id: 'box', slot: 'item', price: 300, rar: 3, name: 'Бумбокс' },
    { id: 'fire', slot: 'fx', price: 500, rar: 3, name: 'Огненная аура' },
    // owner 11.11.2026: not sold — given for turning on notifications (`sub`: shown as «за подписку», no price)
    { id: 'tee', slot: 'top', price: 0, rar: 0, sub: true, name: 'Футболка Fedoskin team', bt: { win: 3 } },
    { id: 'streetLaces', slot: 'laces', price: 60, rar: 0, catalog: 2, name: 'Шнурки «Песок»', f: { laceStyle: 'bars' }, col: { laces: '#DDB882' }, bt: { win: 2, cor: 1 } },
    { id: 'canvasTeal', slot: 'kicks', price: 100, rar: 0, catalog: 2, name: 'Бирюзовые кеды', f: { shoe: 'canvas' }, col: { shoe: '#218981', shoe2: '#184A4C', sole: '#F4DFB6' }, bt: { win: 6 } },
    { id: 'asphaltPants', slot: 'pants', price: 110, rar: 0, catalog: 2, name: 'Штаны «Асфальт»', f: { pants: 'wind' }, col: { pants: '#43474E', stripe: '#B8BDC4' }, bt: { cor: 2 } },
    { id: 'stripedBeanie', slot: 'head', price: 130, rar: 1, catalog: 2, name: 'Шапка «Полоса»', f: { hat: 'beanie' }, col: { hat: ['#334968', '#F9AF62'] }, bt: { win: 3, cor: 3 } },
    { id: 'amberGloves', slot: 'hands', price: 145, rar: 1, catalog: 2, name: 'Янтарные митенки', f: { gloves: true }, col: { glove: '#895117', gloveTrim: '#FFC45C' }, bt: { cor: 5 } },
    { id: 'sandTee', slot: 'top', price: 145, rar: 1, catalog: 2, name: 'Футболка «Дюна»', f: { top: 'teeBig' }, col: { top: '#D2AE76', trim: '#395750' }, bt: { win: 5 } },
    { id: 'foamKnees', slot: 'knees', price: 165, rar: 1, catalog: 2, name: 'Наколенники «Мягкий ход»', f: { knee: true }, col: { knee: '#769ABB' }, bt: { hold: 1, cor: 2 } },
    { id: 'rallyJacket', slot: 'top', price: 220, rar: 2, catalog: 2, name: 'Олимпийка «Ралли»', f: { top: 'track' }, col: { top: '#9C3246', yoke: '#EEE6C8', sleeve: '#9C3246', cuff: '#313E51', trim: '#EEE6C8' }, bt: { win: 8, cor: 3 } },
    { id: 'pulsePhones', slot: 'ears', price: 235, rar: 2, catalog: 2, name: 'Наушники «Бас»', f: { phones: true }, col: { phones: '#62BC9F' }, bt: { win: 6, cor: 4 } },
    { id: 'silverPendant', slot: 'neck', price: 245, rar: 2, catalog: 2, name: 'Подвеска «Маятник»', f: { chain: 2 }, col: { gold: '#9BBFCC' }, bt: { cor: 5 } },
    { id: 'contrastJoggers', slot: 'pants', price: 265, rar: 2, catalog: 2, name: 'Джоггеры «Контраст»', f: { pants: 'trackp' }, col: { pants: '#282431', stripe: '#DAD9E4' }, bt: { win: 5, hold: 1 } },
    { id: 'nightRunner', slot: 'kicks', price: 325, rar: 2, catalog: 2, name: 'Кроссы «Ночной маршрут»', f: { shoe: 'runner' }, col: { shoe: '#323E73', shoe2: '#AD82DE', sole: '#BCD1E9', lace: '#A5C8FC' }, bt: { win: 12, cor: 5 } },
    { id: 'velvetBomber', slot: 'top', price: 700, rar: 3, catalog: 3, name: 'Бомбер «Бархат»', f: { top: 'bomber' }, col: { top: '#5D2148', sleeve: '#342A51', cuff: '#D7A06A', trim: '#D7A06A' }, bt: { save: 1, cor: 2 } },
    { id: 'electricBucket', slot: 'head', price: 800, rar: 3, catalog: 3, name: 'Панама «Импульс»', f: { hat: 'bucket' }, col: { hat: ['#35418B', '#75F7AC'] }, bt: { win: 8, cor: 7 } },
    { id: 'prismPhones', slot: 'ears', price: 3200, rar: 4, catalog: 3, winDays: 28, name: 'Наушники «Призма»', f: { phones: true }, col: { phones: '#F2B2F4' }, bt: { win: 5, cor: 3 } },
  ];
  // UNIQUE STREET GEAR (owner 14.11.2026 «шмотки города и в инвентаре и на тебе в батле должны быть одни и те же… в городе можно найти
  // уникальные или выиграть, которых нет в магазине»): ONE catalog for the city, the wardrobe, battles and the rating. Worn as the token
  // 'c:<id>' in the same look list as the shop items. Never sold — only won in the city (`src`). slot = the same slots as SHOP (one per slot).
  // f and col override the outfit in topDown and svg. perk is specific to the legacy 2D city.
  // Ids are repeated in server/push-worker.js (CGEAR) — keep them equal.
  const GEAR = {
    rustyBandana: { name: 'Бандана Ржавых', slot: 'head', rar: 0, ico: '🧣', src: 'gang:rusty', f: { hat: 'bandana' }, col: { hat: ['#C8603A', '#F2EFE8'] }, perk: ['time', 5], bt: { win: 6 } },
    rustyTrack: { name: 'Олимпийка Ржавых', slot: 'top', rar: 1, ico: '🧥', src: 'gang:rusty', f: { top: 'track' }, col: { top: '#C8603A', yoke: '#18181B', sleeve: '#C8603A', cuff: '#18181B', trim: '#F2CC55' }, perk: ['rep', 1], bt: { win: 7 } },
    acidKicks: { name: 'Кислотные кроссы', slot: 'kicks', rar: 1, ico: '👟', src: 'gang:acid', f: { shoe: 'runner' }, col: { shoe: '#7CFF4F', shoe2: '#18181B', sole: '#F2EFE8', lace: '#18181B' }, perk: ['en', 1], bt: { win: 9 } },
    acidBucket: { name: 'Кислотная панама', slot: 'head', rar: 1, ico: '🎩', src: 'gang:acid', f: { hat: 'bucket' }, col: { hat: ['#7CFF4F', '#18181B'] }, perk: ['coin', 1], bt: { cor: 3 } },
    owlPhones: { name: 'Наушники Совы', slot: 'ears', rar: 2, ico: '🎧', src: 'gang:owls', f: { phones: true }, perk: ['show', 15], bt: { win: 10 } },
    owlHoodie: { name: 'Худи Ночных сов', slot: 'top', rar: 2, ico: '🦉', src: 'gang:owls', f: { top: 'hoodie' }, col: { top: '#6B4E9A', sleeve: '#6B4E9A', cuff: '#FFD23F', trim: '#FFD23F' }, perk: ['time', 8], bt: { cor: 5 } },
    goldChain: { name: 'Цепь «Золотой зуб»', slot: 'neck', rar: 2, ico: '⛓️', src: 'gang:gold', f: { chain: 2 }, perk: ['cash', 15], bt: { hold: 1 } },
    goldCap: { name: 'Золотая кепка', slot: 'head', rar: 3, ico: '🧢', src: 'gang:gold', reward: [['wins:gold', 5, 'Победы над бандой «{x}»']], f: { hat: 'capGold' }, col: { hat: ['#E7B23C', '#18181B'] }, perk: ['life', 1], bt: { save: 1 } },
    // the Park crews (16.11.2026, 3D city): Фанк-бригада lv 5, Корни lv 6, Волна lv 7 (the district's owners)
    funkTrack: { name: 'Олимпийка «Фанк»', slot: 'top', rar: 3, ico: '🧥', src: 'gang:funk', reward: [['wins:funk', 5, 'Победы над бандой «{x}»']], f: { top: 'track' }, col: { top: '#7A2FB8', yoke: '#FFD23F', sleeve: '#7A2FB8', cuff: '#FFD23F', trim: '#FFD23F' }, perk: ['rep', 2], bt: { cor: 8 } },
    rootsBeanie: { name: 'Шапка «Корни»', slot: 'head', rar: 3, ico: '🧶', src: 'gang:roots', reward: [['wins:roots', 6, 'Победы над бандой «{x}»']], f: { hat: 'beanie' }, col: { hat: ['#2F8F3A', '#FFD23F'] }, perk: ['en', 2], bt: { win: 20 } },
    // the industrial zone's crews (16.11.2026, 3D city): Арматура lv 6, Высоковольтные lv 7, Литейка lv 8 (the district's owners)
    rebarCap: { name: 'Кепка «Арматура»', slot: 'head', rar: 3, ico: '🧢', src: 'gang:rebar', reward: [['wins:rebar', 6, 'Победы над бандой «{x}»']], f: { hat: 'cap' }, col: { hat: ['#18181B', '#FF7A1A'] }, perk: ['time', 8], bt: { win: 12, cor: 4 } },
    voltKicks: { name: 'Кроссы «Высокое напряжение»', slot: 'kicks', rar: 4, ico: '👟', src: 'gang:volt', reward: [['wins:volt', 21, 'Победы над бандой «{x}»'], ['perfect:volt', 6, 'Победы с идеально обведённым пауэрмувом против «{x}»']], f: { shoe: 'high' }, col: { shoe: '#FFE23F', shoe2: '#141518', sole: '#141518', lace: '#141518' }, perk: ['en', 2], bt: { cor: 8 } },
    forgeChain: { name: 'Цепь «Литейка»', slot: 'neck', rar: 4, ico: '⛓️', src: 'gang:forge', reward: [['wins:forge', 21, 'Победы над бандой «{x}»'], ['clean:forge', 8, 'Победы без срывов над бандой «{x}»']], f: { chain: 2 }, col: { gold: '#B9BCC4' }, perk: ['rep', 2], bt: { hold: 1 } },
    waveKicks: { name: 'Кроссы «Волна»', slot: 'kicks', rar: 3, ico: '👟', src: 'gang:wave', reward: [['wins:wave', 7, 'Победы над бандой «{x}»']], f: { shoe: 'runner' }, col: { shoe: '#19B8C4', shoe2: '#F2EFE8', sole: '#F2EFE8', lace: '#FFFFFF' }, perk: ['time', 8], bt: { save: 1 } },
    cypherBomber: { name: 'Бомбер Сайфера', slot: 'top', rar: 3, ico: '🎤', src: 'mc', f: { top: 'bomber' }, col: { top: '#18181B', sleeve: '#E2611A', cuff: '#FFD23F', trim: '#FFD23F' }, perk: ['rep', 2], bt: { win: 20 } },
    djGloves: { name: 'Перчатки диджея', slot: 'hands', rar: 2, ico: '🧤', src: 'dj', f: { gloves: true }, perk: ['time', 6], bt: { cor: 8 } },
    // the Centre crews (16.11.2026, 3D city): Трафареты lv 3, Турникеты lv 4, Хромированные lv 5 (the district's owners)
    stencilBandana: { name: 'Бандана Трафаретов', slot: 'head', rar: 1, ico: '🧣', src: 'gang:stencil', f: { hat: 'bandana' }, col: { hat: ['#F2EFE8', '#C8202A'] }, perk: ['time', 6], bt: { win: 6, cor: 2 } },
    stencilBomber: { name: 'Бомбер Трафаретов', slot: 'top', rar: 2, ico: '🧥', src: 'gang:stencil', f: { top: 'bomber' }, col: { top: '#18181B', sleeve: '#F2EFE8', cuff: '#C8202A', trim: '#C8202A' }, perk: ['rep', 2], bt: { cor: 6 } },
    turnBucket: { name: 'Панама Турникетов', slot: 'head', rar: 2, ico: '🎩', src: 'gang:turn', f: { hat: 'bucket' }, col: { hat: ['#2F7BFF', '#F2EFE8'] }, perk: ['coin', 1], bt: { cor: 6 } },
    turnKicks: { name: 'Кроссы «Час пик»', slot: 'kicks', rar: 2, ico: '👟', src: 'gang:turn', f: { shoe: 'leather' }, col: { shoe: '#2F7BFF', shoe2: '#F2EFE8', sole: '#F2EFE8', lace: '#FFD23F' }, perk: ['en', 2], bt: { win: 8, cor: 4 } },
    chromeKicks: { name: 'Хромовые кроссы', slot: 'kicks', rar: 3, ico: '👟', src: 'gang:chrome', reward: [['wins:chrome', 4, 'Победы над бандой «{x}»']], f: { shoe: 'runner' }, col: { shoe: '#D9DEE6', shoe2: '#3F8FD8', sole: '#18181B', lace: '#FFFFFF' }, perk: ['time', 8], bt: { win: 12, cor: 7 } },
    chromeTrack: { name: 'Олимпийка «Хром»', slot: 'top', rar: 3, ico: '🧥', src: 'gang:chrome', reward: [['wins:chrome', 7, 'Победы над бандой «{x}»']], f: { top: 'track' }, col: { top: '#C9CED6', yoke: '#18181B', sleeve: '#C9CED6', cuff: '#18181B', trim: '#3F8FD8' }, perk: ['life', 1], bt: { save: 1 } },
    writerKicks: { name: 'Кеды райтера', slot: 'kicks', rar: 3, ico: '🎨', src: 'walls', stash: true, reward: [['stash', 18, 'Тайники Промзоны']], f: { shoe: 'canvas' }, col: { shoe: '#F2EFE8', shoe2: '#FF4F9A', sole: '#4FC0FF', lace: '#FFD23F' }, perk: ['can', 1], bt: { win: 15 } },
    // 3D city activity rewards. The wardrobe uses the same threshold for its acquisition hint.
    matPants: { name: 'Штаны «Первый заход»', slot: 'pants', rar: 0, ico: '👖', reward: [['train', 2, 'Во Дворе: проведи {n} тренировки на мате']], f: { pants: 'trackp' }, col: { pants: '#34516A', stripe: '#FF9065' }, bt: { win: 4 } },
    beatGloves: { name: 'Митенки «Первый бит»', slot: 'hands', rar: 0, ico: '🧤', reward: [['dj', 1, 'Закажи бит у диджея во Дворе']], f: { gloves: true }, col: { glove: '#394F73', gloveTrim: '#6CB7FF' }, bt: { win: 3, cor: 1 } },
    cypherCap: { name: 'Кепка «В кругу»', slot: 'head', rar: 0, ico: '🧢', reward: [['show', 1, 'Заверши свой выход в сайфере во Дворе']], f: { hat: 'capBack' }, col: { hat: ['#BA553D', '#EDC598'] }, bt: { win: 5, cor: 1 } },
    cleanLaces: { name: 'Шнурки «Чистый раунд»', slot: 'laces', rar: 1, ico: '👟', reward: [['clean', 3, 'Выиграй {n} батла без срывов в 3D-городе']], f: { laceStyle: 'cross' }, col: { laces: '#A4E9FC' }, bt: { win: 2, cor: 3 } },
    paintHoodie: { name: 'Худи «Свежая краска»', slot: 'top', rar: 2, ico: '🎨', reward: [['paint', 3, 'Закрась {n} разные стены банд в 3D-городе']], f: { top: 'hoodie' }, col: { top: '#276855', sleeve: '#276855', cuff: '#C4EF73', trim: '#F0C759' }, bt: { win: 7, cor: 4 } },
    metroBeanie: { name: 'Шапка «Пересадка»', slot: 'head', rar: 1, ico: '🧶', reward: [['center', 1, 'Впервые доберись до Центра']], f: { hat: 'beanie' }, col: { hat: ['#263C57', '#75D7CD'] }, bt: { win: 4, cor: 4 } },
    mallSneakers: { name: 'Кеды «Витрина»', slot: 'kicks', rar: 2, ico: '👟', reward: [['mallClean', 2, 'Заверши {n} шоу у ТЦ без срывов и без встречи с охраной']], f: { shoe: 'leather' }, col: { shoe: '#E9ABBE', shoe2: '#5E4163', sole: '#EEE9DE', lace: '#F8F1D0' }, bt: { win: 11, cor: 5 } },
    chromePendant: { name: 'Кулон «Отражение»', slot: 'neck', rar: 3, ico: '⛓️', reward: [['wins:chrome', 5, 'Победы над бандой «{x}»']], f: { chain: 2 }, col: { gold: '#DCC7F0' }, bt: { win: 8, cor: 4 } },
    parkVisor: { name: 'Кепка «Турник»', slot: 'head', rar: 1, ico: '🧢', reward: [['warm', 1, 'Заверши разминку на турниках в Парке']], f: { hat: 'cap' }, col: { hat: ['#4B632D', '#D2ED9B'] }, bt: { win: 3, cor: 5 } },
    jamJacket: { name: 'Бомбер «Финал джема»', slot: 'top', rar: 4, ico: '🏆', reward: [['jamWon', 21, 'Победы во всех трёх раундах джема в Парке'], ['jamClean', 7, 'Джемы в Парке с победой во всех раундах без срывов']], f: { top: 'bomber' }, col: { top: '#3E337C', sleeve: '#A44C73', cuff: '#EDC260', trim: '#EDC260' }, bt: { win: 6, save: 1 } },
    pendulumPhones: { name: 'Наушники «Ритм Маятника»', slot: 'ears', rar: 2, ico: '🎧', reward: [['og', 3, 'Получи {n} награды за уроки у Маятника в Парке']], f: { phones: true }, col: { phones: '#F9A365' }, bt: { cor: 7 } },
    foundryGloves: { name: 'Перчатки «Шлак»', slot: 'hands', rar: 2, ico: '🧤', reward: [['stash', 3, 'Открой тайники в Промзоне · {n} шт.']], f: { gloves: true }, col: { glove: '#623439', gloveTrim: '#E38A72' }, bt: { win: 3, cor: 5 } },
    cachePants: { name: 'Штаны «Запасник»', slot: 'pants', rar: 3, ico: '👖', reward: [['stash', 24, 'Тайники Промзоны']], f: { pants: 'wind' }, col: { pants: '#635043', stripe: '#E5CB70' }, bt: { win: 7, cor: 4 } },
    ringKnees: { name: 'Наколенники «Три подряд»', slot: 'knees', rar: 3, ico: '🥇', reward: [['ringBest', 3, 'Победы подряд на подпольном ринге'], ['ringWins', 12, 'Всего побед на подпольном ринге']], f: { knee: true }, col: { knee: '#D58C53' }, bt: { hold: 1, win: 5 } },
    forgeCrown: { name: 'Панама «Последняя плавка»', slot: 'head', rar: 4, ico: '👑', reward: [['wins:forge', 28, 'Победы над бандой «{x}»'], ['perfect:forge', 5, 'Победы с идеально обведённым пауэрмувом против «{x}»'], ['ringBest', 8, 'Победы подряд на подпольном ринге']], f: { hat: 'bucket' }, col: { hat: ['#563B44', '#EC8556'] }, bt: { win: 8, cor: 6 } },
    matWrist: { name: 'Напульсники «Пятый подход»', slot: 'wrists', rar: 1, ico: '💪', reward: [['train', 5, 'Тренировки на мате во Дворе']], col: { wristband: '#B0D878' }, bt: { win: 4, cor: 1 } },
    parkElbows: { name: 'Налокотники «Фанк-щит»', slot: 'elbows', rar: 2, ico: '🛡️', reward: [['clean:funk', 3, 'Победы без срывов над бандой «{x}»']], col: { elbow: '#7A4E9B', elbowTrim: '#E6B66A' }, bt: { cor: 4, elbow: 3 } },
    tileKnees: { name: 'Наколенники «Плитка»', slot: 'knees', rar: 2, ico: '🦵', reward: [['clean:turn', 4, 'Победы без срывов над бандой «{x}»']], f: { knee: true }, col: { knee: '#59A699' }, bt: { hold: 1, cor: 3 } },
    fourWallsChain: { name: 'Цепочка «Пятый тег»', slot: 'neck', rar: 2, ico: '⛓️', reward: [['paint', 5, 'Разные закрашенные стены банд']], f: { chain: 2 }, col: { gold: '#D6916F' }, bt: { win: 6, cor: 3 } },
    poolBucket: { name: 'Панама «Витраж»', slot: 'head', rar: 2, ico: '🎩', reward: [['mallClean', 4, 'Шоу у ТЦ без срывов и охраны']], f: { hat: 'bucket' }, col: { hat: ['#2D6266','#E29F66'] }, bt: { win: 3, cor: 6 } },
    acidRetroBandana: { name: 'Бандана «Кислотный след»', slot: 'head', rar: 1, ico: '🧣', src: 'gang:acid', reward: [['wins:acid', 2, 'Победы над бандой «{x}»']], f: { hat: 'bandana' }, col: { hat: ['#2D5146','#B6E977'] }, bt: { win: 5, cor: 1 } },
    parkSpinCap: { name: 'Хедспинка «Ось»', slot: 'head', rar: 3, ico: '🧢', reward: [['jamClean', 5, 'Джемы в Парке с победой во всех раундах без срывов']], f: { hat: 'beanie' }, col: { hat: ['#663854','#EA915B'], spinPad: '#F2C485' }, bt: { win: 3, spin: 7 } },
    terracottaWrist: { name: 'Напульсники «Терракота»', slot: 'wrists', rar: 0, ico: '💪', reward: [['show', 2, 'Завершённые выходы в сайфере во Дворе']], col: { wristband: '#CE6548' }, bt: { win: 3 } },
    foamElbows: { name: 'Налокотники «Амортизатор»', slot: 'elbows', rar: 1, ico: '🛡️', reward: [['clean', 4, 'Победы без срывов в 3D-городе']], col: { elbow: '#466C8D', elbowTrim: '#95C9D9' }, bt: { cor: 2, elbow: 2 } },
    spinCapSlate: { name: 'Хедспинка «Графит»', slot: 'head', rar: 2, ico: '🧢', reward: [['headspinWin', 4, 'Победы с идеально обведённым хедспином']], f: { hat: 'beanie' }, col: { hat: ['#3B4351','#8295AF'], spinPad: '#9AA9B9' }, bt: { spin: 5 } },
    canvasCap: { name: 'Кепка «Полночь»', slot: 'head', rar: 1, ico: '🧢', reward: [['wins:stencil', 2, 'Победы над бандой «{x}»']], f: { hat: 'cap' }, col: { hat: ['#24242F','#7E6798'] }, bt: { win: 4, cor: 2 } },
    wideLaces: { name: 'Шнурки «Кирпич»', slot: 'laces', rar: 0, ico: '👟', reward: [['dj', 2, 'Заказы бита у диджея во Дворе']], f: { laceStyle: 'zigzag' }, col: { laces: '#ED7155' }, bt: { win: 1, cor: 2 } },
    courtKicks: { name: 'Кроссы «Площадка»', slot: 'kicks', rar: 2, ico: '👟', reward: [['show', 4, 'Завершённые выходы в сайфере во Дворе']], f: { shoe: 'high' }, col: { shoe: '#D9E1CF', shoe2: '#44685E', sole: '#B68F66', lace: '#ECE2CB' }, bt: { win: 9, cor: 3 } },
    prismCypherKicks: { name: 'Кроссовки «Грань круга»', slot: 'kicks', rar: 4, ico: '👟', festival: true, cosmetic: true,
      f: { shoe: 'runner', rgbSole: true }, col: { shoe: '#272D3A', shoe2: '#514F60', sole: '#252831', lace: '#D6D8E4' } },
    prismCypherLaces: { name: 'Шнурки «Световой рисунок»', slot: 'laces', rar: 4, ico: '✧', festival: true, cosmetic: true,
      f: { laceStyle: 'zigzag', rgbLace: true }, col: { laces: '#9DEDD7' } },
  };
  // what worn street gear gives in RHYTHM BATTLES (owner 14.11.2026 «наоборот сделай, чтобы влиял город на батлы — лишний повод зависнуть в
  // городе»): only HELP to hit — the score rules stay the same, so the server's recount still matches. win = wider tap windows (ms, cap 30),
  // cor = wider trajectory corridor (px, cap 12), hold = the freeze is easier to hold, save = one miss of the round is forgiven (becomes GOOD).
  const BOOST_CAP = { win: 30, cor: 12, hold: 1, save: 1, spin: 7, elbow: 3 };
  function gearBoost(arr){
    const b = { win: 0, cor: 0, hold: 0, save: 0, spin: 0, elbow: 0 };
    const worn = wornGear(arr);
    worn.forEach(g => { if (g.bt) for (const x in g.bt) b[x] = (b[x] || 0) + g.bt[x]; });
    for (const x in BOOST_CAP) b[x] = Math.min(BOOST_CAP[x], b[x] || 0);
    b.any = Object.keys(BOOST_CAP).some(key => b[key]);
    return b;
  }
  function gearTraceBonus(boost, headspin) {
    return headspin ? Math.min(16, (boost?.cor || 0) + (boost?.spin || 0)) : boost?.cor || 0;
  }
  // any look token → { slot, name, … } (shop item or street gear); null for 'girl' / 'lv<N>' / unknown
  const itemOf = k => { if (typeof k !== 'string') return null; if (k.slice(0, 2) === 'c:') { const g = GEAR[k.slice(2)]; return g ? Object.assign({ id: k, city: true }, g) : null; } return SHOP.find(x => x.id === k) || null; };
  // Shared by the 3D city's reward checks and the wardrobe's progress labels.
  function cityRewardValue(save, key) {
    const [kind, crew] = key.split(':');
    if (kind === 'wins') return save.wins?.[crew] || 0;
    if (key === 'center') return Number(Boolean(save.seen?.center));
    if (key === 'paint') return save.paintedWalls?.length ?? Object.keys(save.turf || {}).length;
    if (key === 'jamWon') return save.jamWon || 0;
    if (key === 'ringBest') return save.best || 0;
    return save.gearProgress?.[key] ?? ({ dj: Number(Boolean(save.djDay)), og: Number(Boolean(save.ogDay)),
      stash: save.stash?.got?.length || 0, ringWins: save.best || 0 })[key] ?? 0;
  }
  const wornGear = arr => [...new Map((Array.isArray(arr) ? arr : []).map(itemOf).filter(Boolean).map(item => [item.slot, item])).values()];
  // Basis points per dancer's round. The online worker uses the same red slots and probabilities.
  const MYTHIC_MOVES = { rone: 'REAL ONE HAND', rcork: 'CORKSCREW', rplanche: 'PLANCHE' };
  const MYTHIC_SCORE = 600;
  function gearChances(arr) {
    const count = Math.min(2, wornGear(arr).filter(item => item.rar === 4 && !item.cosmetic).length);
    return { myth: count * 200, assist: count * 400 };
  }
  function gearEvent(chances, roll, move) {
    if (roll < chances.myth) return { move: Object.keys(MYTHIC_MOVES)[move % 3] };
    if (roll < chances.myth + chances.assist) return { assist: true };
    return null;
  }
  const SKIN = '#C68A5E', SKIN_D = '#A86F47', SKIN_L = '#D9A27A', HAIR = '#1E1714', INK = '#0E0E10';
  const OR = '#E2611A', OR_D = '#B44812', BLK = '#18181B', BLK2 = '#232328', WH = '#F2EFE8', WH_D = '#D6D1C6';
  // ---- the outfit table: ONE source for the profile drawing (svg) and for the city's top-down sprite (topDown) ----
  const FIT = {
    hat: [null, null, 'cap', 'cap', 'beanie', 'bucket', 'capBack', 'capGold', 'capGold'],
    top: [null, 'tee', 'tee', 'teeBig', 'track', 'track', 'bomber', 'trackGold', 'trackGold'],
    pants: [null, 'jeans', 'jeans', 'trackp', 'trackp', 'trackp', 'wind', 'trackpGold', 'trackpGold'],
    shoe: [null, 'canvas', 'leather', 'leather', 'runner', 'runner', 'high', 'highGold', 'highGold'],
  };
  function baseSlots(level){
    const L = Math.max(1, Math.min(8, level | 0));
    const names = {
      cap: 'Кепка', beanie: 'Шапка', bucket: 'Панама', capBack: 'Кепка', capGold: 'Кепка',
      tee: 'Футболка', teeBig: 'Футболка оверсайз', track: 'Олимпийка', bomber: 'Бомбер', trackGold: 'Олимпийка',
      jeans: 'Джинсы', trackp: 'Спортивные штаны', wind: 'Спортивные штаны', trackpGold: 'Спортивные штаны',
      canvas: 'Кеды', leather: 'Кроссы', runner: 'Кроссы', high: 'Высокие кроссы', highGold: 'Высокие кроссы',
    };
    return { head: names[FIT.hat[L]], top: names[FIT.top[L]], pants: names[FIT.pants[L]], kicks: names[FIT.shoe[L]] };
  }
  function lookOf(level, accArr){
    const arr = Array.isArray(accArr) ? accArr : [], pick = arr.map(k => /^lv([1-8])$/.exec(k)).find(Boolean);
    const L = Math.max(1, Math.min(8, level | 0, pick ? +pick[1] : 8)), acc = new Set(arr), has = k => acc.has(k);
    const fit = { hat: has('bandana') ? 'bandana' : FIT.hat[L], top: has('tee') ? 'teeTeam' : FIT.top[L], pants: FIT.pants[L], shoe: FIT.shoe[L] };
    // Outfit overrides are shared by shop and city items.
    const co = {}, gf = {};
    arr.forEach(k => {
      const g = itemOf(k); if (!g) return;
      const f = g.f || {};
      for (const part of Object.keys(fit)) if (f[part]) fit[part] = f[part];
      for (const flag of ['phones', 'chain', 'gloves', 'knee', 'laceStyle', 'rgbSole', 'rgbLace']) if (f[flag]) gf[flag] = f[flag];
      Object.assign(co, g.col);
    });
    return { L, has, fit, co, gf };
  }
  // Points have a distance down the tongue (0..1) and a side (0 or 1).
  const laceRows = [0, 1 / 3, 2 / 3, 1];
  const laceAnchors = laceRows.flatMap(row => [[row, 0], [row, 1]]);
  const zigzag = Array.from({ length: 7 }, (_, i) => [i / 6, i % 2]);
  const LACE_LAYOUTS = {
    bars: { anchors: laceAnchors, segments: laceRows.map(row => [[row, 0], [row, 1]]) },
    cross: { anchors: laceAnchors, segments: laceRows.slice(1).flatMap((row, i) =>
      [[[laceRows[i], 0], [row, 1]], [[row, 0], [laceRows[i], 1]]]) },
    zigzag: { anchors: zigzag, segments: zigzag.slice(1).map((point, i) => [zigzag[i], point]) },
  };
  const laceLayout = style => LACE_LAYOUTS[style] || LACE_LAYOUTS.bars;
  // The same look as plain data for a view from above (city mini-game, 13.11.2026): types + flat colours, no SVG.
  function topDown(level, accArr){
    const k = lookOf(level, accArr), L = k.L, has = k.has, f = k.fit, G = '#E7B23C', t = f.shoe;
    const long = /track|bomber|hoodie/.test(f.top);
    const out = {
      L, girl: has('girl'), hat: f.hat, top: f.top, pants: f.pants, shoe: f.shoe, laceStyle: k.gf.laceStyle || 'bars',
      phones: L === 4 || L === 5 || !!k.gf.phones, chain: Math.max(L >= 7 ? 2 : L >= 5 ? 1 : 0, k.gf.chain || 0), wrist: k.co.wristband || (L >= 7 ? G : L >= 3 ? OR : null), belt: L >= 8,
      knee: has('knee') || !!k.gf.knee, gloves: has('gloves') || !!k.gf.gloves, box: L >= 7 || has('box'), fire: has('fire'), card: has('cardboard'),
      col: {
        skin: SKIN, hair: HAIR, ink: INK, gold: G,
        top: { tee: '#8E8E95', teeBig: BLK, teeTeam: WH, track: OR, bomber: BLK, trackGold: BLK }[f.top],
        yoke: f.top === 'track' ? BLK : null,
        sleeve: long ? { track: OR, bomber: BLK, trackGold: BLK }[f.top] : null,          // null = short sleeve, bare arm
        cuff: { track: BLK, bomber: OR, trackGold: G }[f.top] || null,
        trim: { track: WH, trackGold: G, bomber: '#9A968E' }[f.top] || null,
        pants: { jeans: '#3E5F8E', trackp: BLK, wind: '#232327', trackpGold: BLK }[f.pants],
        stripe: { trackp: WH, trackpGold: G }[f.pants] || null,
        shoe: has('red') ? '#C8102E' : { canvas: WH, leather: WH, runner: BLK2, high: OR, highGold: BLK }[t],
        shoe2: has('red') ? (t === 'highGold' ? G : BLK) : { canvas: WH_D, leather: OR, runner: OR, high: WH, highGold: G }[t],
        sole: { canvas: '#E9E4D8', leather: WH, runner: WH, high: WH, highGold: G }[t],
        lace: t === 'highGold' ? G : WH,
        hat: { cap: [BLK, L >= 3 ? OR : BLK], capBack: [BLK, OR], capGold: [G, BLK], beanie: ['#2A2A2F', OR], bucket: [BLK, OR], bandana: ['#C8102E', WH] }[f.hat] || null,
      },
    };
    // street gear colours (same names) and the sleeve of a top that became long through gear
    Object.assign(out.col, k.co);
    if (k.co.laces) out.col.lace = k.co.laces;
    if (k.gf.rgbSole) out.rgbSole = true;
    if (k.gf.rgbLace) out.rgbLace = true;
    if (long && !out.col.sleeve) out.col.sleeve = out.col.top;
    return out;
  }
  function levelFor(mins){ let l = 1; for (let i = 0; i < LEVELS.length; i++) if (mins >= LEVELS[i]) l = i + 1; return l; }

  function svg(level, opt){
    opt = opt || {};
    const wardrobe = !!opt.wardrobe && !opt.rig;
    // an older look chosen in the wardrobe (owner 11.11.2026 «инвентарь»): 'lv<N>' in acc draws the outfit of level N (never higher)
    const LK = lookOf(level, opt.acc), L = LK.L;
    const id = 'h' + L + (opt.uid || '');
    const GOLD = 'url(#' + id + 'gold)';
    const o = [];
    const has = LK.has;
    const P = (d, fill, ex) => o.push('<path d="' + d + '" fill="' + (fill || 'none') + '"' + (ex || '') + '/>');
    const S = (w) => ' stroke="' + INK + '" stroke-width="' + (w || 2.2) + '" stroke-linejoin="round" stroke-linecap="round"';
    const LN = (d, col, w, ex) => o.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (ex || '') + '/>');
    const MIR = (fn) => { o.push('<g transform="translate(200 0) scale(-1 1)">'); fn(); o.push('</g>'); };
    // rig mode (battle animation, 10.11.2026): the same drawing, cut into limbs that turn around their joints
    const rig = !!opt.rig, cap = fn => { const n = o.length; fn(); return o.splice(n).join(''); };

    // ---- the outfit of this level ----
    const fit = LK.fit, CO = LK.co || {}, GF = LK.gf || {}, HC = CO.hat || [];   // street gear colours / flags
    const W = 200, H = 254;
    const legY = y => 146 + (y - 146) * 1.19;
    const stretchLeg = fn => { o.push('<g transform="translate(0 146) scale(1 1.19) translate(0 -146)">'); fn(); o.push('</g>'); };
    const showBox = has('box') || (L >= 7 && !opt.equippedPropsOnly);
    const closer = L >= 7 || showBox ? [1, 7, 198, 245] : [19, 7, 162, 245];
    const vb = opt.bust ? [50, 16, 100, 100] : wardrobe && opt.bg === false ? closer : [0, 0, W, H];
    const shade = name => 'url(#' + id + name + ')';
    const cloth = shade(wardrobe ? 'cloth' : 'sh');
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '"' + (opt.size ? ' width="' + opt.size + '" height="' + Math.round(opt.size * vb[3] / vb[2]) + '"' : '') + '>');
    o.push('<defs><radialGradient id="' + id + 'g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="' + RING[L - 1] + '" stop-opacity=".55"/><stop offset="1" stop-color="' + RING[L - 1] + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + 'gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".45" stop-color="#E7B23C"/><stop offset="1" stop-color="#A8741A"/></linearGradient>' +
      '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>' +
      '<radialGradient id="' + id + 'fire" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="#FFE38A"/><stop offset=".45" stop-color="#FF8A1F"/><stop offset="1" stop-color="#E2361A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + 'lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3A44"/><stop offset="1" stop-color="#08080A"/></linearGradient></defs>');
    if (wardrobe) o.push('<defs>' +
      '<linearGradient id="' + id + 'cloth" x1="0%" y1="8%" x2="96%" y2="82%"><stop stop-color="#fff5df" stop-opacity=".18"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#101019" stop-opacity=".28"/></linearGradient>' +
      '<linearGradient id="' + id + 'edge" x1="0%" y1="0%" x2="100%" y2="100%"><stop stop-color="#fff5e1" stop-opacity=".35"/><stop offset=".52" stop-color="#fff5e1" stop-opacity=".06"/><stop offset="1" stop-color="#110e19" stop-opacity=".34"/></linearGradient>' +
      '<linearGradient id="' + id + 'skin" x1="10%" y1="10%" x2="88%" y2="89%"><stop stop-color="' + SKIN_L + '"/><stop offset=".53" stop-color="' + SKIN + '"/><stop offset="1" stop-color="' + SKIN_D + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'floor"><stop stop-color="#09080c" stop-opacity=".7"/><stop offset="1" stop-color="#09080c" stop-opacity="0"/></radialGradient></defs>');

    // ---- background ----
    if (rig) { /* no background, floor or props in the rig */ } else if (opt.bg !== false && has('wall')) {
      o.push('<rect x="4" y="8" width="192" height="226" rx="22" fill="#3A2A24"/>');
      for (let y = 8, r = 0; y < 230; y += 11, r++) { LN('M4 ' + y + ' H196', 'rgba(0,0,0,.35)', 1.4); for (let x = 4 + (r % 2 ? 0 : 12); x < 196; x += 24) LN('M' + x + ' ' + y + ' v11', 'rgba(0,0,0,.3)', 1.2); }
      P('M18 70 Q30 40 52 56 Q60 34 82 48 Q92 30 112 44 Q132 28 150 46 Q174 40 182 66 Q190 92 166 98 Q150 116 128 100 Q104 118 86 100 Q62 114 46 98 Q20 104 18 70 Z', '#3D8BFF', ' opacity=".55" stroke="#0E0E10" stroke-width="3"');
      LN('M34 76 Q48 60 60 78 Q72 96 84 74 M104 70 Q118 56 128 76 Q138 94 152 72', '#F2EFE8', 5, ' opacity=".7"');
      LN('M60 100 v14 M128 100 v18 M152 96 v10', '#3D8BFF', 3, ' opacity=".55"');
      P('M150 20 l4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1Z', '#F2CC55', ' opacity=".7"');
      o.push('<rect x="4" y="8" width="192" height="226" rx="22" fill="url(#' + id + 'g)"/>');
      o.push('<ellipse cx="100" cy="244" rx="62" ry="6.5" fill="#000" opacity=".5"/>');
    } else if (opt.bg !== false && has('city')) {
      o.push('<rect x="4" y="8" width="192" height="226" rx="22" fill="#141A33"/>');
      o.push('<circle cx="150" cy="40" r="14" fill="#F2EFE8" opacity=".9"/><circle cx="155" cy="36" r="12" fill="#141A33"/>');
      [[20, 30], [60, 70], [110, 22], [176, 76], [36, 90]].forEach(p => o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.2" fill="#fff" opacity=".7"/>'));
      const bl = [[4, 120, 26], [30, 96, 22], [52, 132, 18], [70, 84, 24], [94, 110, 20], [114, 74, 26], [140, 104, 22], [162, 90, 34]];
      bl.forEach(b => { o.push('<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (234 - b[1]) + '" fill="#0A0D1C"/>'); for (let y = b[1] + 6; y < 200; y += 10) for (let x = b[0] + 4; x < b[0] + b[2] - 3; x += 7) if ((x * 7 + y * 3) % 5 < 2) o.push('<rect x="' + x + '" y="' + y + '" width="3" height="4" fill="#F2CC55" opacity=".65"/>'); });
      o.push('<rect x="4" y="8" width="192" height="226" rx="22" fill="url(#' + id + 'g)" opacity=".7"/>');
      o.push('<ellipse cx="100" cy="244" rx="62" ry="6.5" fill="#000" opacity=".5"/>');
    } else if (opt.bg !== false) {
      if (L >= 8) {
        let r = '';
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; r += '<path d="M100 118 L' + (100 + 98 * Math.cos(a - .09)).toFixed(1) + ' ' + (118 + 98 * Math.sin(a - .09)).toFixed(1) + ' L' + (100 + 98 * Math.cos(a + .09)).toFixed(1) + ' ' + (118 + 98 * Math.sin(a + .09)).toFixed(1) + 'Z"/>'; }
        o.push('<g fill="#F2CC55" opacity=".16">' + r + '</g>');
      }
      o.push('<circle cx="100" cy="118" r="100" fill="url(#' + id + 'g)"/>');
      o.push('<ellipse cx="100" cy="244" rx="62" ry="6.5" fill="#000" opacity=".5"/>');
    } else if (wardrobe) o.push('<ellipse cx="100" cy="246" rx="62" ry="6" fill="' + shade('floor') + '"/>');

    // ---- fire aura (shop) ----
    if (has('fire') && !rig) {
      stretchLeg(() => {
        P('M40 232 Q34 196 52 176 Q50 196 62 200 Q58 170 80 150 Q78 178 92 184 Q94 160 108 146 Q110 172 122 178 Q128 160 144 156 Q138 182 150 192 Q158 178 164 172 Q170 200 160 232 Z', 'url(#' + id + 'fire)', ' opacity=".9"');
        P('M60 232 Q58 210 70 198 Q72 214 84 216 Q86 196 100 186 Q102 206 114 210 Q120 196 132 194 Q138 214 140 232 Z', '#FFD25A', ' opacity=".55"');
      });
    }
    // ---- cardboard (shop): flattened box under the feet ----
    if (has('cardboard') && !rig) {
      o.push('<g transform="translate(0 12)">');
      P('M30 222 L170 222 L184 236 L16 236 Z', '#B98A4E', S(1.8));
      LN('M58 222 L50 236 M142 222 L150 236', 'rgba(0,0,0,.25)', 1.2);
      P('M92 222 L108 222 L110 236 L90 236 Z', '#D6B98A', ' opacity=".8"');
      LN('M26 229 H40 M160 229 H174', 'rgba(0,0,0,.25)', 1);
      o.push('</g>');
    }
    // ---- boombox (level outfit or equipped prop), behind the right leg ----
    if (showBox && !rig) {
      o.push('<g data-prop="boombox" transform="translate(146 ' + (opt.equippedPropsOnly ? 218 : 205) + ')">');
      P('M6 0 V-7 Q6 -10 9 -10 H39 Q42 -10 42 -7 V0', 'none', ' stroke="' + INK + '" stroke-width="3.2"');
      P('M0 3 Q0 0 3 0 H45 Q48 0 48 3 V30 Q48 33 45 33 H3 Q0 33 0 30 Z', '#2B2B31', S(2));
      P('M0 3 Q0 0 3 0 H45 Q48 0 48 3 V8 H0 Z', '#3A3A42');
      [12, 36].forEach(cx => { o.push('<circle cx="' + cx + '" cy="21" r="9" fill="#111114" stroke="' + GOLD + '" stroke-width="2.6"/><circle cx="' + cx + '" cy="21" r="3.2" fill="#2E2E34"/>'); });
      P('M19 4 H29 V7 H19 Z', OR); o.push('<circle cx="40" cy="4.5" r="1.4" fill="#3BD16F"/><circle cx="6" cy="4.5" r="1.4" fill="' + WH_D + '"/>');
      o.push('</g>');
    }

    if (GF.rgbSole || GF.rgbLace) {
      const names = ['#fd657c', '#64ecd1', '#9ca7ff'];
      const stops = names.map((color, i) => '<stop class="festival-rgb" offset="' + i * 50 +
        '%" stop-color="' + color + '" style="animation-delay:' + (-i * 1.9) + 's"/>').join('');
      o.push('<defs><linearGradient id="' + id + 'rgbSole" gradientUnits="userSpaceOnUse" x1="1" y1="0" x2="51" y2="21">' + stops +
        '</linearGradient><linearGradient id="' + id + 'rgbLace" gradientUnits="userSpaceOnUse" x1="8" y1="-17" x2="39" y2="9">' + stops +
        '</linearGradient></defs><style>.festival-rgb{animation:festivalSpectralStops 5.7s ease-in-out infinite}' +
        '@keyframes festivalSpectralStops{0%,100%{stop-color:#fd657c}33%{stop-color:#64ecd1}66%{stop-color:#9ca7ff}}' +
        '@media(prefers-reduced-motion:reduce){.festival-rgb{animation:none}}</style>');
    }
    // Both feet turn outward. The visible top of the shoe carries the independent laces.
    const shoe = () => {
      const t = fit.shoe, hi = t === 'high' || t === 'highGold';
      const upper = CO.shoe || (has('red') ? '#C8102E' : { canvas: WH, leather: WH, runner: BLK2, high: OR, highGold: BLK }[t]);
      const overlay = CO.shoe2 || (has('red') ? (t === 'highGold' ? GOLD : BLK) : { canvas: WH_D, leather: OR, runner: OR, high: WH, highGold: GOLD }[t]);
      const midsole = CO.sole || { canvas: '#E9E4D8', leather: WH, runner: WH, high: WH, highGold: GOLD }[t];
      const outsole = { canvas: '#CFC8B8', leather: '#B98A4E', runner: BLK, high: '#B98A4E', highGold: BLK }[t];
      const lace = CO.laces || CO.lace || (t === 'highGold' ? '#E7B23C' : WH);
      const style = GF.laceStyle || 'bars', height = hi ? 0 : 5;
      const toe = 'M32 0 Q44 1 49 10 Q51 14 44 17 Q35 19 28 14 Z';
      const body = hi ? 'M1 2 L0 -16 Q1 -25 12 -25 Q22 -25 24 -18 L28 -7 Q43 -3 49 9 Q52 14 43 17 Q33 20 20 12 Z'
        : 'M1 2 L2 -12 Q3 -19 13 -20 Q21 -20 25 -14 L29 -6 Q43 -3 49 9 Q52 14 43 17 Q33 20 20 12 Z';
      const point = ([row, side]) => {
        const x = 9 + row * 14 + side * (11 + row * 5);
        const y = -14 + height + row * (17 - height) - side * (3 + row * 2);
        return [x.toFixed(2), y.toFixed(2)].join(' ');
      };

      o.push('<g transform="translate(105 219)">');
      P('M0 -2 Q3 -6 17 -6 L33 1 Q54 7 51 19 Q49 26 35 27 Q22 24 9 15 Q-2 9 0 -2 Z', outsole, S(2.2));
      P('M0 -2 Q3 -6 17 -6 L33 0 Q52 6 51 15 Q48 21 36 23 Q24 21 10 12 Q1 7 0 -2 Z', midsole, S(2));
      if (GF.rgbSole) LN('M3 5 Q10 12 18 16 M22 18 Q31 23 38 22 M41 22 Q47 21 50 17', 'url(#' + id + 'rgbSole)', 2.1);
      LN('M6 10 L7 14 M12 14 L13 18 M19 18 L20 22 M26 21 L27 25 M34 24 V26 M42 23 V25 M47 21 V23', 'rgba(0,0,0,.32)', 1.1);
      if (wardrobe) LN('M11 13 Q20 21 32 23 Q41 24 47 20', '#fff5e1', 1.1, ' opacity=".36"');
      P(body, upper, S(2));
      if (wardrobe) P(body, cloth);
      P('M0 -8 Q4 -7 11 -2 L23 10 L19 13 Q10 9 1 3 Z', overlay, S(1.55));
      P(toe, overlay, S(1.55));
      if (t === 'canvas') LN('M30 13 Q39 18 46 14', 'rgba(0,0,0,.32)', 1.2);
      else LN('M4 0 Q10 3 18 9 M33 15 Q41 17 47 13', 'rgba(0,0,0,.36)', 1.05, ' stroke-dasharray="1.6 1.4"');
      if (wardrobe) {
        P(toe, shade('edge'));
        LN('M36 5 Q43 6 46 10 M5 -6 Q11 -3 16 2', '#fffaea', 1.1, ' opacity=".36"');
        if (t !== 'canvas') LN('M39 10 h.1 M42 11 h.1 M38 12.5 h.1', '#15131c', 1.3, ' opacity=".46"');
      }
      P(hi ? 'M5 -16 Q4 -25 13 -25 L22 -24 Q25 -22 25 -15 L41 -2 Q36 7 27 8 Z'
        : 'M6 -12 Q5 -19 12 -20 L22 -21 Q25 -19 25 -13 L41 -2 Q36 7 27 8 Z', '#24232A', S(1.6));

      const { anchors, segments } = laceLayout(style);
      for (const a of anchors) {
        const [x, y] = point(a).split(' ');
        o.push('<circle cx="' + x + '" cy="' + y + '" r="' + (style === 'zigzag' ? 2.02 : 1.63) + '" fill="' + (style === 'zigzag' ? '#7085A0' : '#57525B') + '" stroke="' + INK + '" stroke-width=".78"/>');
        if (wardrobe) LN('M' + (Number(x) - .6).toFixed(1) + ' ' + (Number(y) - 1.2).toFixed(1) + ' h.1', '#d8d4d1', .85);
      }
      for (const [from, to] of segments) {
        const stitch = 'M' + point(from) + ' L' + point(to);
        if (wardrobe) LN(stitch, INK, 4);
        LN(stitch, GF.rgbLace ? 'url(#' + id + 'rgbLace)' : lace, style === 'zigzag' ? 2.8 : 2.6);
        if (wardrobe) LN(stitch, '#fff5e4', 1.15, ' opacity=".27" transform="translate(0 -.5)"');
      }
      o.push('</g>');
    };
    const SH_R = cap(shoe), SH_L = cap(() => MIR(shoe));
    if (!rig) o.push(SH_R, SH_L);

    // ---- pants ----
    const pants = () => {
      const t = fit.pants, track = t !== 'jeans', hem = t === 'jeans' ? 198 : t === 'wind' ? 193 : 196;
      const col = CO.pants || { jeans: '#3E5F8E', trackp: BLK, wind: '#232327', trackpGold: BLK }[t];
      // left leg (viewer's left) — the right one is mirrored
      const leg = 'M70 146 L100 146 L100 158 Q100 186 99 ' + hem + ' L73 ' + hem + ' Q67 178 70 146 Z';
      P(leg, col, S()); P(leg, cloth);
      if (wardrobe) P('M98 157 Q94 177 95 ' + (hem - 3) + ' L98 ' + (hem - 1) + ' Z', '#101019', ' opacity=".22"');
      if (t === 'jeans') {
        LN('M73 151 Q81 158 89 150', '#2D4A72', 1.6);                               // front pocket
        LN('M73 153 Q81 160 89 152', '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"');   // pocket stitch
        LN('M79 176 Q85 180 92 176', 'rgba(255,255,255,.22)', 4);                       // knee fade
        LN('M72 ' + (hem - 3) + ' Q85 ' + (hem - 6) + ' 98 ' + (hem - 3) + ' M71 ' + (hem - 8) + ' Q84 ' + (hem - 11) + ' 98 ' + (hem - 8), '#2D4A72', 1.4); // stacked hem
        LN('M74 ' + (hem - 1) + ' H97', '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"');
        LN('M71 148 Q69 180 72 ' + (hem - 2), '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"'); // outseam
      } else {
        const pipe = CO.stripe || (t === 'trackpGold' ? GOLD : OR);
        LN('M71.5 149 Q68.5 178 72 ' + (hem - 9), pipe, 2.6);                            // side piping
        P('M71 ' + (hem - 9) + ' L99 ' + (hem - 9) + ' L99 ' + hem + ' L72 ' + hem + ' Z', t === 'wind' ? '#1A1A1E' : '#121214', S(1.6)); // gathered cuff
        LN('M76 ' + (hem - 8) + ' v7 M81 ' + (hem - 8) + ' v7 M86 ' + (hem - 8) + ' v7 M91 ' + (hem - 8) + ' v7 M96 ' + (hem - 8) + ' v7', 'rgba(255,255,255,.12)', 1);
        LN('M74 ' + (hem - 12) + ' Q80 ' + (hem - 16) + ' 86 ' + (hem - 11) + ' M88 ' + (hem - 13) + ' Q93 ' + (hem - 17) + ' 97 ' + (hem - 12), 'rgba(255,255,255,.13)', 1.4); // bunching folds
        LN('M78 170 Q84 168 92 172', 'rgba(255,255,255,.1)', 1.4);
        if (t === 'wind') { LN('M80 156 Q83 172 81 180', 'rgba(255,255,255,.14)', 2.2); LN('M74 ' + (hem - 9) + ' L74 ' + (hem - 20), '#9A968E', 1.4); }
      }
    };
    const paintPants = () => stretchLeg(pants);
    const PA_L = cap(paintPants), PA_R = cap(() => MIR(paintPants));
    if (!rig) o.push(PA_L, PA_R);
    let KN_L = '', KN_R = '';
    if (has('knee') || GF.knee) {
      const kp = () => stretchLeg(() => {
        P('M71 169 Q85 165 98 168 L98 184 Q85 188 71 184 Z', '#202127', S(1.6));
        if (wardrobe) LN('M72 172 L77 171 M72 181 L77 181 M92 171 L97 171 M92 182 L97 181', '#817681', 1.8);
        P('M75 169 Q85 165 94 170 L94 182 Q85 187 75 182 Z', CO.knee || OR, S(1.4));
        if (wardrobe) {
          P('M76 170 Q85 166 93 171 L93 181 Q85 185 76 181 Z', shade('edge'));
          LN('M76.8 173 V178 M92 176 V180', '#211924', .95, ' opacity=".5"');
        }
        LN('M78 173 Q85 170 92 173 M78 180 Q85 182 92 179', 'rgba(255,255,255,.38)', 1.15);
      });
      KN_L = cap(kp); KN_R = cap(() => MIR(kp));
      if (!rig) o.push(KN_L, KN_R);
    }
    const FLY0 = o.length;
    if (fit.pants === 'jeans') stretchLeg(() => { LN('M100 147 V168 Q101 172 104 170', '#2D4A72', 1.6); LN('M103 147 V166', '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"'); });

    const FLY = rig ? o.splice(FLY0).join('') : '';
    // ---- belt of the champion (8) sits on the waist later ----

    // ---- arms (behind the torso) ----
    const longSleeve = /track|bomber|hoodie/.test(fit.top);
    const sleeveCol = CO.sleeve || CO.top || { tee: '#8E8E95', teeBig: BLK, teeTeam: WH, track: OR, bomber: BLK, trackGold: BLK }[fit.top];
    const cuffCol = CO.cuff || { track: BLK, bomber: OR, trackGold: '#E7B23C' }[fit.top];
    const arm = (side) => {
      // side 0 = viewer's left (drawn), right is mirrored unless raised
      if (longSleeve) {
        P('M71 92 Q58 96 55 118 L52 147 L65 148 L67 121 L73 104 Z', sleeveCol, S());
        P('M71 92 Q58 96 55 118 L52 147 L65 148 L67 121 L73 104 Z', cloth);
        if (fit.top === 'track') { P('M71 92 Q61 95 58 108 L65 110 Q67 100 73 98 Z', CO.yoke || BLK); LN('M57 112 L54 146', CO.trim || WH, 1.6); }
        if (fit.top === 'trackGold') LN('M57 106 L53 146', GOLD, 2.2);
        if (fit.top === 'bomber') { P('M54 122 L64 123 L63 132 L53 131 Z', BLK2, S(1.2)); LN('M55 125 H63', '#9A968E', .9); LN('M60 104 Q63 116 62 126', 'rgba(255,255,255,.1)', 1.4); }
        P('M52 145 L65 146 L65 154 L52 153 Z', cuffCol, S(1.6));
        if (fit.top === 'bomber') LN('M52.5 148.5 L64.5 149.5', BLK, 1.6);
        LN('M55 146.5 v6 M58 146.8 v6 M61 147 v6', 'rgba(0,0,0,.25)', .8);
        if (wardrobe) LN('M61 105 Q57 112 57 121 M55 139 L54.5 144 M53.5 147 L63.5 148', '#fff1e2', 1, ' opacity=".22"');
      } else {
        const big = fit.top === 'teeBig';
        P(big ? 'M68 92 Q56 98 53 124 L68 127 L70 108 Z' : 'M71 92 Q60 96 56 116 L68 120 L71 106 Z', sleeveCol, S());
        LN(big ? 'M54 120 L68 123' : 'M57 112 L68 116', 'rgba(0,0,0,.3)', 1.2);
        P(big ? 'M56 126 L54 148 L64 149 L66 127 Z' : 'M58 119 L54 148 L64 149 L67 121 Z', SKIN, S());
        LN(big ? 'M63 128 L62 146' : 'M64 123 L62 146', SKIN_D, 1.4);
      }
      if (CO.elbow) {
        P('M53 115 Q60 112 68 116 L67 132 Q60 135 53 130 Z', CO.elbow, S(1.5));
        if (wardrobe) {
          P('M54 116 Q60 113 67 117 L66 131 Q60 134 54 130 Z', shade('edge'));
          LN('M54 127 Q60 131 66 128', INK, 1.2, ' opacity=".45"');
        }
        LN('M56 120 Q60 118 65 120 M56 126 H65', CO.elbowTrim, 1.2);
      }
      // The base look has a wristband on one side. An equipped pair takes its place.
      if (CO.wristband || (L >= 3 && !side)) {
        P('M51.5 140 L64.5 141 L64.5 146 L51.5 145 Z', CO.wristband || (L >= 7 ? GOLD : OR), S(1.4));
        LN('M54 140.5 v4.5 M57 140.7 v4.5 M60 140.9 v4.5 M63 141 v4.5', 'rgba(0,0,0,.18)', .7);
        if (wardrobe) LN('M52.5 141.7 L63.6 142.5', '#fff0d4', .9, ' opacity=".42"');
      }
      // hand
      P('M51 151 Q50 160 55 163 Q61 165 65 160 Q67 154 65 150 Z', wardrobe ? shade('skin') : SKIN, S());
      LN('M54 157 Q57 159 61 158', SKIN_D, 1.2);
      if (has('gloves') || GF.gloves) { P('M51 151 Q50 157 52 159 L66 157 Q67 153 65 150 Z', CO.glove || '#141416', S(1.6)); LN('M53 154 H64', CO.gloveTrim || OR, 1.2); }
      if (L >= 7 && !side) o.push('<rect x="55" y="155" width="5" height="3.2" rx="1" fill="' + GOLD + '" stroke="' + INK + '" stroke-width=".9"/>');
    };
    const AR_L = cap(() => arm(0)), AR_R = rig ? cap(() => MIR(() => arm(1))) : '';
    if (!rig) o.push(AR_L);
    if (rig) { /* both arms come from arm() */ } else if (L >= 8) {
      // right arm up — fist in the air (sleeve, cuff, fist); in the team tee: a bare arm with a short sleeve
      if (fit.top === 'teeTeam') {
        P('M129 92 Q143 88 148 72 L151 48 L139 46 L137 70 L127 98 Z', SKIN, S()); LN('M145 72 L148 50', SKIN_D, 1.4);
        P('M129 92 Q140 89 144 80 L133 76 L126 96 Z', WH, S());
      } else {
        P('M129 92 Q143 88 148 72 L151 48 L139 46 L137 70 L127 98 Z', sleeveCol, S());
        LN('M146 72 L149 49', GOLD, 2.2);
        P('M138 44 L152 46 L151 54 L137 52 Z', cuffCol, S(1.6));
      }
      if (CO.elbow) {
        P('M134 71 Q140 69 149 72 L145 83 Q139 86 132 82 Z', CO.elbow, S(1.5));
        LN('M136 77 Q141 75 146 77', CO.elbowTrim, 1.2);
      }
      if (CO.wristband) P('M138 45 L152 46 L151 53 L137 52 Z', CO.wristband, S(1.4));
      P('M137 44 Q135 30 142 27 Q152 25 155 31 Q157 38 152 45 Z', SKIN, S());
      LN('M140 33 Q146 31 152 33 M140 38 Q146 36 152 38', SKIN_D, 1.2);
      if (has('gloves') || GF.gloves) { P('M137 44 Q136 38 138 36 L155 36 Q156 41 152 45 Z', CO.glove || '#141416', S(1.6)); LN('M139 40 H153', CO.gloveTrim || OR, 1.2); }
      o.push('<rect x="139" y="28" width="6" height="3.6" rx="1" fill="' + GOLD + '" stroke="' + INK + '" stroke-width=".9"/>');
    } else MIR(() => arm(1));

    // ---- torso ----
    const TO0 = o.length;
    const top = fit.top;
    if (top === 'teeTeam') { // the team tee (for notifications): white, an orange round print with «FT» + a black band «FEDOSKIN TEAM»
      const body = 'M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L129 150 Q100 153 71 150 Z';
      P(body, WH, S()); P(body, cloth);
      P('M86 86 Q100 97 114 86 L111 85 Q100 93 89 85 Z', WH_D, S(1.4));
      LN('M80 120 Q83 132 80 146 M120 118 Q117 132 120 146', 'rgba(0,0,0,.12)', 1.4);
      LN('M72 146 Q100 149 128 146', 'rgba(0,0,0,.18)', .9, ' stroke-dasharray="1.6 1.6"');
      o.push('<circle cx="100" cy="112" r="14" fill="' + OR + '" stroke="' + INK + '" stroke-width="1.8"/><circle cx="100" cy="112" r="11" fill="none" stroke="' + BLK + '" stroke-width="1" stroke-dasharray="1.4 1.4"/>');
      o.push('<text x="100" y="117.5" text-anchor="middle" font-family="Anton, Impact, Arial Black, sans-serif" font-weight="900" font-size="15" textLength="15" lengthAdjust="spacingAndGlyphs" fill="' + BLK + '">FT</text>');
      P('M80 130 h40 v8 h-40 Z', BLK, S(1));
      o.push('<text x="100" y="136.3" text-anchor="middle" font-family="Anton, Impact, Arial Black, sans-serif" font-weight="900" font-size="5.6" textLength="36" lengthAdjust="spacingAndGlyphs" fill="' + WH + '">FEDOSKIN TEAM</text>');
      LN('M84 139 v4 M100 139 v6 M114 139 v3', OR, 1.8); // little drips
    } else if (top === 'tee' || top === 'teeBig') {
      const big = top === 'teeBig', col = CO.top || (big ? BLK : '#8E8E95'), print = CO.trim || OR;
      const body = big ? 'M66 94 Q70 87 82 85 L118 85 Q130 87 134 94 L133 156 Q100 160 67 156 Z' : 'M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L129 150 Q100 153 71 150 Z';
      P(body, col, S()); P(body, cloth);
      // rib collar
      P('M86 86 Q100 97 114 86 L111 85 Q100 93 89 85 Z', big ? '#2A2A2F' : '#7A7A80', S(1.4));
      // folds
      LN(big ? 'M78 120 Q82 134 79 150 M121 118 Q117 134 121 151 M92 150 Q100 146 108 151' : 'M80 118 Q83 130 80 146 M120 116 Q117 130 120 146', big ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.15)', 1.4);
      // hem stitch
      LN(big ? 'M68 152 Q100 156 132 152' : 'M72 146 Q100 149 128 146', big ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.2)', .9, ' stroke-dasharray="1.6 1.6"');
      if (L === 2) o.push('<rect x="108" y="98" width="9" height="6" rx="1.2" fill="' + OR + '" stroke="' + INK + '" stroke-width="1"/>'); // small chest patch
      if (big) { // spray piece on the chest: outlined orange letters-like shapes + drips + star
        P('M79 112 Q84 104 92 108 Q96 101 104 106 Q110 100 118 105 Q123 110 119 117 Q122 124 113 125 Q104 130 96 125 Q86 129 81 122 Q75 118 79 112 Z', print, S(1.8));
        LN('M86 113 Q89 109 92 114 Q95 119 98 113 M101 112 Q104 108 107 113 Q110 118 113 112', BLK, 2.2);
        LN('M90 126 v7 M104 128 v9 M114 124 v5', print, 2.4); o.push('<circle cx="104" cy="139" r="1.7" fill="' + print + '"/>');
        P('M123 98 l1.6 3.4 3.6 .5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5Z', WH);
      }
    } else if (top === 'track' || top === 'trackGold') {
      const gold = top === 'trackGold', col = CO.top || (gold ? BLK : OR), trim = CO.trim || (gold ? GOLD : WH);
      const body = 'M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L129 148 L71 148 Z';
      P(body, col, S()); P(body, cloth);
      if (!gold) P('M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L130 106 Q100 112 70 106 Z', CO.yoke || BLK); // contrast yoke
      LN('M70 106 Q100 112 130 106', trim, 1.6);
      // stand collar
      P('M85 84 L86 76 Q100 80 114 76 L115 84 Q100 90 85 84 Z', gold ? BLK2 : BLK, S(1.6));
      LN('M86.5 80 Q100 84 113.5 80', trim, 1.2);
      // zip with teeth and pull
      LN('M100 86 V146', '#0A0A0C', 2.6); LN('M100 86 V146', gold ? '#E7B23C' : '#9A968E', 1, ' stroke-dasharray="1 1.2"');
      P('M98 96 h4 v8 q0 2 -2 2 q-2 0 -2 -2 Z', gold ? GOLD : '#C9C5BD', S(1));
      // slash pockets
      LN('M80 128 L86 140 M120 128 L114 140', 'rgba(0,0,0,.45)', 1.6);
      if (wardrobe) LN('M81.7 128.5 L87 138 M118.5 128.5 L113 138 M77 95 Q83 91 89 91', '#fff5e1', 1, ' opacity=".33"');
      // rib hem
      P('M71 141 L129 141 L129 149 Q100 152 71 149 Z', gold ? BLK2 : BLK, S(1.6));
      LN('M76 142 v6 M82 142 v6.5 M88 142 v7 M94 142 v7 M106 142 v7 M112 142 v7 M118 142 v6.5 M124 142 v6', 'rgba(255,255,255,.1)', .8);
      if (gold) { // embroidered laurel badge (no brand)
        o.push('<circle cx="114" cy="100" r="5.5" fill="none" stroke="' + GOLD + '" stroke-width="1.4"/>');
        LN('M110.5 102 Q111 97 114 95.5 M117.5 102 Q117 97 114 95.5', '#E7B23C', 1);
        o.push('<circle cx="114" cy="100.5" r="1.4" fill="#E7B23C"/>');
        LN('M71 112 Q72 130 71 140 M129 112 Q128 130 129 140', GOLD, 1.6);
      }
    } else if (top === 'hoodie') {
      const body = 'M67 94 Q73 87 85 85 Q100 94 115 85 Q127 87 133 94 L131 150 Q100 155 69 150 Z';
      P(body, CO.top, S()); P(body, cloth);
      P('M79 90 Q79 76 90 76 L110 76 Q121 76 121 90 Q100 107 79 90 Z', CO.top, S(1.6));
      LN('M84 87 Q100 100 116 87', 'rgba(0,0,0,.34)', 1.8);
      LN('M94 93 Q95 103 92 111 M106 93 Q105 104 108 114', CO.trim, 1.6);
      P('M86 124 H114 L122 137 Q100 143 78 137 Z', 'rgba(0,0,0,.12)', ' stroke="rgba(0,0,0,.28)" stroke-width="1.3"');
      LN('M71 146 Q100 151 129 146', CO.cuff, 2);
    } else if (top === 'bomber') {
      const body = 'M68 93 Q73 87 84 85 L116 85 Q127 87 132 93 L131 146 Q100 151 69 146 Z';
      P(body, CO.top || BLK, S()); P(body, cloth);
      // satin shine
      LN('M80 98 Q78 118 82 138', 'rgba(255,255,255,.1)', 3); LN('M122 98 Q124 118 120 138', 'rgba(255,255,255,.06)', 3);
      // striped rib collar
      P('M84 85 Q100 98 116 85 L114 82 Q100 92 86 82 Z', BLK2, S(1.6));
      LN('M85 84.2 Q100 95 115 84.2', CO.trim || OR, 1.4);
      // zip + rib hem with stripes
      LN('M100 92 V140', '#0A0A0C', 2.4); LN('M100 92 V140', '#9A968E', .9, ' stroke-dasharray="1 1.2"');
      P('M69 139 L131 139 L131 148 Q100 153 69 148 Z', BLK2, S(1.6));
      LN('M70 142.5 Q100 146.5 130 142.5', CO.cuff || OR, 1.4); LN('M70 145.5 Q100 149.5 130 145.5', WH, 1);
      // patches: round star patch, flag-like patch, name tape
      o.push('<circle cx="86" cy="106" r="7" fill="' + OR + '" stroke="' + INK + '" stroke-width="1.4"/><circle cx="86" cy="106" r="5.4" fill="none" stroke="' + WH + '" stroke-width=".8" stroke-dasharray="1 1"/>');
      P('M86 101.5 l1.3 2.8 3 .4 -2.2 2.1 .5 3 -2.6 -1.4 -2.6 1.4 .5 -3 -2.2 -2.1 3 -.4Z', BLK);
      P('M108 100 h14 v9 h-14 Z', WH, S(1.2)); P('M108 100 h14 v3 h-14 Z', OR); P('M108 106 h14 v3 h-14 Z', BLK);
      P('M105 120 h18 v5 h-18 Z', '#2E2E34', S(1)); LN('M107 122.5 h14', OR, 1.2, ' stroke-dasharray="2 1.2"');
      // slash pockets
      LN('M78 124 L82 136 M122 124 L118 136', 'rgba(255,255,255,.15)', 1.6);
      if (wardrobe) LN('M75 94 Q82 90 89 89 M76 118 Q76 127 78 132 M123 119 L125 126', '#fff4de', 1.2, ' opacity=".18"');
    }

    // ---- champion belt (8) ----
    if (L >= 8) {
      P('M68 140 L132 140 L132 151 L68 151 Z', '#1C1C20', S(1.8));
      LN('M70 142.5 H130 M70 148.5 H130', GOLD, .9, ' stroke-dasharray="1.6 1.4"');
      o.push('<ellipse cx="100" cy="145.5" rx="18" ry="12" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="1.8"/><ellipse cx="100" cy="145.5" rx="13" ry="8" fill="none" stroke="#8A5E12" stroke-width="1"/>');
      P('M100 139 l1.9 4 4.4 .5 -3.2 3 .9 4.3 -4 -2.2 -4 2.2 .9 -4.3 -3.2 -3 4.4 -.5Z', '#8A5E12');
      [[76, 145.5], [124, 145.5]].forEach(p => o.push('<rect x="' + (p[0] - 5) + '" y="' + (p[1] - 4.5) + '" width="10" height="9" rx="2" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="1.2"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.8" fill="#C0392B"/>'));
    }

    // ---- neck ----
    P('M92 72 L108 72 L108 86 Q100 90 92 86 Z', SKIN_D, S(1.6));

    // ---- headphones round the neck (4, 5) ----
    if (L === 4 || L === 5 || GF.phones) {
      LN('M84 90 Q100 106 116 90', '#2A2A2F', 4.5);
      [[78, 84], [114, 84]].forEach(p => { P('M' + p[0] + ' ' + p[1] + ' h8 q3 0 3 3 v10 q0 3 -3 3 h-8 q-3 0 -3 -3 v-10 q0 -3 3 -3 Z', '#26262B', S(1.6)); o.push('<rect x="' + (p[0] + 1.5) + '" y="' + (p[1] + 3) + '" width="5" height="10" rx="2" fill="' + (CO.phones || OR) + '"/>'); });
      LN('M117 100 Q121 116 112 128', '#2A2A2F', 1.4);
    }

    // ---- chain (5+) ----
    if (L >= 5 || GF.chain) {
      const big = L >= 7 || GF.chain >= 2, pts = [];
      const metal = CO.gold || GOLD, edge = CO.gold ? '#555B66' : '#7A5512';
      for (let i = 0; i <= 14; i++) { const t = i / 14, x = 88 + 24 * t, y = 88 + (big ? 30 : 22) * Math.sin(Math.PI * t); pts.push([x, y]); }
      pts.forEach((p, i) => o.push('<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="' + (big ? 2.2 : 1.6) + '" ry="' + (big ? 1.5 : 1.1) + '" transform="rotate(' + (i % 2 ? 40 : -40) + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')" fill="' + metal + '" stroke="' + edge + '" stroke-width=".5"/>'));
      if (big) {
        P('M100 116 L108 124 L100 134 L92 124 Z', metal, S(1.4));
        P('M100 119 L104.5 124 L100 130 L95.5 124 Z', CO.gold ? WH : '#FFF2C4', ' opacity=".55"');
        LN('M92 124 H108 M100 116 V134', CO.gold ? edge : '#8A5E12', .7);
        if (wardrobe) LN('M95 122 L99 118 M101 126 L104 126', '#fff4d3', .9, ' opacity=".72"');
      } else o.push('<circle cx="100" cy="111.5" r="3" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".8"/>');
    }

    const TORSO = rig ? o.splice(TO0).join('') : '';
    // ---- head ----
    const HE0 = o.length;
    // b-girl (owner 11.11.2026 «женский образ… девчата одеваются как парни с небольшими тонкостями»): same clothes; long hair
    // in a ponytail/braids behind, a bun when there's no hat, lashes, hoop earrings, a touch of colour on the lips
    const girl = opt.g === 'f' || has('girl');
    if (girl) {
      // hair behind the head, down to the shoulders, and a thick braid over the right shoulder
      P('M78 44 Q71 66 76 90 Q84 94 91 86 L109 86 Q116 94 124 90 Q129 66 122 44 Z', HAIR, S(1.8));
      P('M118 70 Q127 80 125 96 Q124 108 129 118 L123 121 Q117 108 118 96 Q119 84 113 76 Z', HAIR, S(1.6));
      LN('M119 84 l6 2 M119 92 l6 2 M119 100 l6 2 M121 108 l6 2', '#3A2E28', 1.2);
      o.push('<circle cx="126" cy="119" r="2.6" fill="' + OR + '" stroke="' + INK + '" stroke-width="1"/>'); // hair tie
    }
    o.push('<circle cx="77" cy="56" r="6" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2"/><circle cx="123" cy="56" r="6" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2"/>');
    LN('M76 54 Q78 57 76 59 M124 54 Q122 57 124 59', SKIN_D, 1.2);
    if (girl) { const hc = L >= 5 ? GOLD : '#C9CCD2'; [[76.5, 64], [123.5, 64]].forEach(p => o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.4" fill="none" stroke="' + hc + '" stroke-width="1.5"/>')); } // hoops
    else if (L >= 6) o.push('<circle cx="76" cy="61" r="1.7" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".5"/>'); // stud earring
    P('M100 28 Q123 28 123 54 Q123 80 100 81 Q77 80 77 54 Q77 28 100 28 Z', wardrobe ? shade('skin') : SKIN, S());
    P('M80 64 Q86 78 100 80 Q90 76 84 64 Z', SKIN_D, ' opacity=".35"');
    // hair: short fade, visible under hats as sideburns
    if (!fit.hat && girl) {
      // pulled back with a middle part + a bun on top
      o.push('<circle cx="100" cy="19" r="9.5" fill="' + HAIR + '" stroke="' + INK + '" stroke-width="1.8"/>');
      LN('M93 16 Q100 12 107 16', '#3A2E28', 1.3);
      P('M77 54 Q73 26 100 25 Q127 26 123 54 Q121 40 112 35 Q105 32 100 36 Q95 32 88 35 Q79 40 77 54 Z', HAIR, S(1.8));
      LN('M100 27 V36 M88 31 Q83 36 81 44 M112 31 Q117 36 119 44', '#3A2E28', 1.2);
    } else if (!fit.hat) {
      P('M77 52 Q74 26 100 25 Q127 26 123 52 Q120 41 112 38 Q104 34 96 37 Q86 36 80 44 Z', HAIR, S(1.8));
      LN('M86 33 Q92 30 98 32 M102 31 Q110 30 116 34', '#3A2E28', 1.4);
    } else {
      P('M77.5 50 Q77 58 79 62 L80.5 62 Q80 56 80.5 50 Z M122.5 50 Q123 58 121 62 L119.5 62 Q120 56 119.5 50 Z', HAIR);
    }
    // ---- hats ----
    const hat = fit.hat;
    if (hat === 'bandana') {
      const wrap = 'M76 48 Q74 22 100 21 Q126 22 124 48 Q100 42 76 48 Z';
      P(wrap, HC[0] || '#C8102E', S());
      if (wardrobe) P(wrap, cloth);
      [[86, 30], [100, 26], [114, 30], [92, 40], [108, 40], [80, 40], [120, 40]].forEach(p => P('M' + p[0] + ' ' + p[1] + ' q3 -3 5 0 q-1 4 -5 3 q-2 -1 0 -3Z', HC[1] || WH, ' opacity=".85"'));
      LN('M78 46 Q100 40 122 46', WH, 1.2, ' stroke-dasharray="2 2"');
      P('M122 40 Q132 40 136 46 Q130 46 126 44 Q130 52 128 58 Q122 50 121 44 Z', HC[0] || '#C8102E', S(1.6));
    }
    if (hat === 'cap' || hat === 'capGold' || hat === 'capBack') {
      const crown = hat === 'capGold' ? GOLD : HC[0] || BLK;
      const front = hat === 'capGold' ? GOLD : HC[1] || (hat === 'capBack' || L >= 3 ? OR : BLK);
      // crown (6 panels: front pair + sides)
      P('M75 50 Q74 22 100 21 Q126 22 125 50 Z', crown, S());
      if (hat !== 'capBack') P('M86 49 Q86 26 100 22 Q114 26 114 49 Z', front, S(1.4));
      LN('M100 22 V49', 'rgba(0,0,0,.35)', 1);
      LN('M80 46 Q80 31 88 25 M120 46 Q120 31 112 25', 'rgba(0,0,0,.3)', 1);
      if (wardrobe) LN('M77.7 42 Q80 28 88 25 M102.5 24 Q108 29 110 35', '#fff7e7', 1.2, ' opacity=".24"');
      o.push('<circle cx="100" cy="21.5" r="2.6" fill="' + (hat === 'capGold' ? BLK : OR) + '" stroke="' + INK + '" stroke-width="1.2"/>');
      [[82, 33], [118, 33]].forEach(p => o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1" fill="#0A0A0C"/>'));
      if (hat === 'capBack') {
        // worn backwards: snap strap + opening on the forehead, no brim in front
        P('M90 50 Q90 40 100 39 Q110 40 110 50 Z', SKIN, S(1.4));
        P('M88 44 L112 44 L112 48 L88 48 Z', BLK2, S(1.2));
        [92, 96, 100, 104, 108].forEach(x => o.push('<circle cx="' + x + '" cy="46" r=".9" fill="#9A968E"/>'));
        P('M75 50 Q100 54 125 50 L125 52 Q100 56 75 52 Z', '#0A0A0C');
        // a little hair at the opening
        P('M91 44 Q100 38 109 44 L109 40 Q100 36 91 40 Z', HAIR);
      } else {
        // flat brim seen from the front, under-brim and the gold size sticker
        P('M66 52 Q100 42 134 52 Q138 54 136 57 Q100 49 64 57 Q62 54 66 52 Z', hat === 'capGold' ? BLK : (L >= 3 ? BLK : BLK), S(1.8));
        P('M64 57 Q100 49 136 57 Q100 53 64 57 Z', hat === 'capGold' ? '#3A2A0E' : '#2C3B2E');
        LN('M68 53.6 Q100 45 132 53.6', 'rgba(255,255,255,.18)', .8, ' stroke-dasharray="1.6 1.4"');
        o.push('<ellipse cx="118" cy="51.5" rx="4.2" ry="2.4" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".6" transform="rotate(8 118 51.5)"/>');
        if (hat === 'cap' && L >= 3) LN('M92 34 Q100 30 108 34', BLK, 1.6); // a little front stitch arc
      }
    } else if (hat === 'beanie') {
      P('M76 50 Q74 20 100 19 Q126 20 124 50 Z', HC[0] || '#2A2A2F', S());
      if (wardrobe) LN('M78.8 36 Q84 23 96 22 M81 37 Q85 30 89 28', '#fff4e1', 1, ' opacity=".23"');
      LN('M86 46 Q86 28 94 22 M100 46 V20 M114 46 Q114 28 106 22 M80 46 Q79 32 86 24 M120 46 Q121 32 114 24', 'rgba(255,255,255,.1)', 1.2);
      P('M74 40 Q100 34 126 40 L126 52 Q100 47 74 52 Z', HC[1] || OR, S(1.8));
      for (let x = 78; x <= 122; x += 4) LN('M' + x + ' ' + (41 - Math.abs(100 - x) * -0.05) + ' v9', HC[1] ? 'rgba(0,0,0,.24)' : OR_D, 1.2);
      P('M105 42 h9 v6 h-9 Z', BLK, S(.8)); LN('M107 45 h5', WH, .8);
      if (CO.spinPad) {
        P('M86 23 Q88 16 100 16 Q112 16 114 23 Q100 28 86 23 Z', CO.spinPad, S(1.4));
        LN('M91 22 Q100 19 109 22', WH, .8);
      }
    } else if (hat === 'bucket') {
      P('M80 46 Q79 22 100 21 Q121 22 120 46 Z', HC[0] || BLK, S());
      LN('M80 40 Q100 36 120 40', HC[1] || OR, 1.2, ' stroke-dasharray="1.6 1.4"');
      LN('M100 22 V44', 'rgba(255,255,255,.12)', 1);
      P('M80 45 Q100 41 120 45 L134 58 Q100 50 66 58 Z', HC[0] || BLK, S(1.8));
      if (wardrobe) LN('M83 28 Q99 20 113 27 M79 48 Q100 43 121 48', '#fff1df', 1.15, ' opacity=".22"');
      LN('M74 52 Q100 45 126 52 M70 55.5 Q100 48 130 55.5', HC[1] || OR, 1, ' stroke-dasharray="1.6 1.4"');
      o.push('<circle cx="86" cy="34" r="1" fill="#9A968E"/><circle cx="114" cy="34" r="1" fill="#9A968E"/>');
    }
    // ---- face ----
    const capped = hat === 'cap' || hat === 'capGold' || hat === 'bucket' || hat === 'bandana';
    if (capped) P('M80 57 Q100 51 120 57 Q100 55 80 60 Z', SKIN_D, ' opacity=".45"'); // brim shadow
    if (L >= 5) {
      const gold = L >= 7, fr = gold ? GOLD : '#111114';
      LN('M78 60 L122 60', gold ? '#B9831E' : INK, 2.2);
      [[80, 57], [102, 57]].forEach(p => {
        P('M' + p[0] + ' ' + p[1] + ' h18 q2 0 2 2 v5 q0 5 -6 5 h-8 q-6 0 -6 -6 v-4 q0 -2 2 -2 Z', 'url(#' + id + 'lens)', ' stroke="' + fr + '" stroke-width="2.2"');
        LN('M' + (p[0] + 4) + ' ' + (p[1] + 3) + ' l6 -1', '#fff', 1.6, ' opacity=".5"');
        LN('M' + (p[0] + 12) + ' ' + (p[1] + 7) + ' l3 -1', OR, 1.2, ' opacity=".6"');
      });
    } else {
      const lift = L >= 3 ? -1 : 0;
      LN('M85 ' + (52 + lift) + ' Q90 ' + (49 + lift) + ' 95 ' + (51 + lift) + ' M105 ' + (51 + lift) + ' Q110 ' + (49 + lift * 2) + ' 115 ' + (52 + lift), HAIR, girl ? 1.8 : 2.6);
      [[90, 58], [110, 58]].forEach(p => { o.push('<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="3.6" ry="4" fill="#fff" stroke="' + INK + '" stroke-width="1.2"/><circle cx="' + (p[0] + .6) + '" cy="' + (p[1] + .6) + '" r="2.3" fill="' + INK + '"/><circle cx="' + (p[0] + 1.4) + '" cy="' + (p[1] - .6) + '" r=".8" fill="#fff"/>'); });
      if (girl) LN('M85.6 55.6 l-2.6 -1.6 M86.2 54.4 l-1.8 -2.2 M114.4 55.6 l2.6 -1.6 M113.8 54.4 l1.8 -2.2', INK, 1.1); // lashes
    }
    LN('M100 61 Q97 67 100 69 Q102 69 103 68', SKIN_D, 1.8);
    const LIP = girl ? '#8E3B3B' : INK;
    if (L >= 6) { P('M90 72 Q100 80 111 71 Q101 75 90 72 Z', '#fff', girl ? ' stroke="' + LIP + '" stroke-width="1.8" stroke-linejoin="round"' : S(1.6)); }
    else if (L >= 3) LN('M92 73 Q101 77 110 71', LIP, 2.2);
    else LN('M93 74 Q100 75 107 73', LIP, 2.2);
    if (L >= 4) LN('M88 66 h0 M112 66 h0', SKIN_L, 0); // (cheek highlight placeholder kept tiny)

    if (rig) {
      const HEAD = o.splice(HE0).join('');
      const elY = fit.top === 'teeBig' ? 126 : 120, elX = fit.top === 'teeBig' ? 60 : 61;
      const pCol = { jeans: '#3E5F8E', trackp: BLK, wind: '#232327', trackpGold: BLK }[fit.pants];
      const eCol = longSleeve ? sleeveCol : SKIN;
      const kneeY = Math.round(legY(178));
      o.push('<defs><clipPath id="' + id + 'cT" clipPathUnits="userSpaceOnUse"><rect x="-50" y="-50" width="300" height="' + (kneeY + 51) + '"/></clipPath>' +
        '<clipPath id="' + id + 'cB" clipPathUnits="userSpaceOnUse"><rect x="-50" y="' + (kneeY - 2) + '" width="300" height="120"/></clipPath>' +
        '<clipPath id="' + id + 'aT" clipPathUnits="userSpaceOnUse"><rect x="-50" y="-50" width="300" height="' + (elY + 51) + '"/></clipPath>' +
        '<clipPath id="' + id + 'aB" clipPathUnits="userSpaceOnUse"><rect x="-50" y="' + (elY - 2) + '" width="300" height="200"/></clipPath></defs>');
      const J = (name, px, py, inner) => '<g data-j="' + name + '" data-p="' + px + ' ' + py + '">' + inner + '</g>';
      const leg = (sd, PA, KN, SH, x) => J('hip' + sd, x, 150, '<g clip-path="url(#' + id + 'cT)">' + PA + '</g>' +
        J('knee' + sd, x, kneeY, '<ellipse cx="' + x + '" cy="' + kneeY + '" rx="13" ry="6" fill="' + pCol + '"/><g clip-path="url(#' + id + 'cB)">' + PA + '</g>' + KN + J('ank' + sd, x + (sd === 'L' ? 1 : -1), 224, SH)));
      const armJ = (sd, AR, sx, ex) => J('sh' + sd, sx, 96, '<g clip-path="url(#' + id + 'aT)">' + AR + '</g>' +
        J('el' + sd, ex, elY, '<circle cx="' + ex + '" cy="' + elY + '" r="6.5" fill="' + eCol + '"/><g clip-path="url(#' + id + 'aB)">' + AR + '</g>'));
      o.push('<g data-j="root">' + leg('R', PA_R, KN_R, SH_R, 115) + leg('L', PA_L, KN_L, SH_L, 85) +
        J('torso', 100, 148, FLY + TORSO + J('head', 100, 84, HEAD) + armJ('R', AR_R, 131, 200 - elX) + armJ('L', AR_L, 69, elX)) + '</g>');
      o.push('</svg>');
      return o.join('');
    }
    // ---- sparkles (8) ----
    if (L >= 8) o.push('<g fill="#FFE38A"><path d="M40 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z"/><path d="M170 100 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z"/><path d="M34 120 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2Z"/><path d="M168 30 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6Z"/></g>');
    o.push('</svg>');
    return o.join('');
  }
  // ===== battle animation (10.11.2026, owner: «чтобы конечности отдельно шевелились… мульт на 12 секунд») =====
  // A pose = joint angles in degrees. Limbs use «outward-positive» angles (left: clockwise, right: mirrored), so one
  // number describes both sides. root = {x, y, r, sx, sy, px, py}: move/turn/squash the whole body around (px, py).
  const SIDE = { shL: 1, elL: 1, hipL: 1, kneeL: 1, ankL: 1, shR: -1, elR: -1, hipR: -1, kneeR: -1, ankR: -1, torso: 1, head: 1 };
  function rigJoints(svgEl){
    const j = {};
    svgEl.querySelectorAll('[data-j]').forEach(g => { const p = (g.getAttribute('data-p') || '0 0').split(' ').map(Number); j[g.getAttribute('data-j')] = { g, p }; });
    return j;
  }
  const f2 = n => (Math.round(n * 100) / 100);
  function setPose(j, ps){
    ps = ps || {};
    for (const k in SIDE) { const J = j[k]; if (!J) continue; const a = (ps[k] || 0) * SIDE[k]; J.g.setAttribute('transform', a ? 'rotate(' + f2(a) + ' ' + J.p[0] + ' ' + J.p[1] + ')' : ''); }
    const R = ps.root || {}, J = j.root; if (!J) return;
    const px = R.px == null ? 100 : R.px, py = R.py == null ? 150 : R.py;
    const sx = R.sx == null ? 1 : R.sx, sy = R.sy == null ? 1 : R.sy;
    J.g.setAttribute('transform', 'translate(' + f2(R.x || 0) + ' ' + f2(R.y || 0) + ') rotate(' + f2(R.r || 0) + ' ' + px + ' ' + py + ') translate(' + px + ' ' + py + ') scale(' + f2(Math.abs(sx) < .08 ? (sx < 0 ? -.08 : .08) : sx) + ' ' + f2(sy) + ') translate(' + (-px) + ' ' + (-py) + ')');
  }
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const ss = (a, b, u) => { const t = cl((u - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const env = (u, a, b) => ss(0, a, u) * (1 - ss(b, 1, u)); // in over [0,a], out over [b,1]
  const TAU = Math.PI * 2;
  // every move: duration (s) + pose at u ∈ [0, 1]; each starts and ends standing, so moves chain freely
  const MOVES = {
    idle: { dur: 1.2, f: u => { const s = Math.sin(u * TAU); return { root: { y: 1.5 * s }, shL: -32, elL: -118, shR: -32, elR: -112, head: 3 * Math.sin(u * TAU * 2), torso: -1.5 * s, hipL: 4, hipR: 4 }; } },
    toprock: { dur: 1.0, f: u => {
      const s = Math.sin(u * TAU * 2), a = Math.max(0, s), b = Math.max(0, -s);
      return { root: { y: -6 * Math.abs(s), x: 6 * s }, torso: 7 * s, head: -5 * s,
        hipL: 10 - 30 * a, kneeL: 22 * a, ankL: -8 * a, hipR: 10 - 30 * b, kneeR: 22 * b, ankR: -8 * b,
        shL: 16 + 22 * b, elL: -78 + 30 * b, shR: 16 + 22 * a, elR: -78 + 30 * a };
    } },
    windmill: { dur: 1.7, f: u => {
      const k = env(u, .18, .82), sp = ss(.15, .85, u) * 720, c = Math.cos(sp * Math.PI / 180);
      return { root: { y: 62 * k, r: 90 * k + sp, sy: 1 - .25 * k, px: 100, py: 130 }, torso: 0,
        hipL: 62 * k, hipR: 62 * k, kneeL: -6 * k, kneeR: -6 * k, shL: 95 * k, elL: 10 * k, shR: 95 * k, elR: 10 * k, head: 15 * k * c };
    } },
    headspin: { dur: 1.8, f: u => {
      const k = env(u, .2, .82), th = ss(.2, .82, u) * TAU * 4, c = Math.cos(th);
      return { root: { y: 205 * k, r: 180 * k, sx: (1 - k) + k * c, px: 100, py: 26 },
        hipL: 26 * k, hipR: 26 * k, kneeL: -10 * k, kneeR: -10 * k, ankL: 20 * k, ankR: 20 * k, shL: 55 * k, elL: 70 * k, shR: 55 * k, elR: 70 * k };
    } },
    flare: { dur: 1.7, f: u => {
      const k = env(u, .2, .82), th = ss(.2, .82, u) * TAU * 3, sn = Math.sin(th), c = Math.cos(th);
      return { root: { y: 40 * k - 6 * k * Math.abs(sn), r: 10 * k * sn, sx: (1 - k) + k * c, px: 100, py: 120 },
        hipL: k * (70 + 40 * sn), hipR: k * (70 - 40 * sn), kneeL: -5 * k, kneeR: -5 * k,
        shL: -12 * k, elL: 0, shR: -12 * k, elR: 0, torso: -6 * k * sn };
    } },
    sixstep: { dur: 1.6, f: u => {
      const k = env(u, .15, .85), th = ss(.12, .88, u) * TAU * 2, sn = Math.sin(th), c = Math.cos(th);
      return { root: { y: 44 * k, sx: (1 - k) + k * (c >= 0 ? 1 : -1) * Math.max(.6, Math.abs(c)), px: 100, py: 150 },
        hipL: k * (68 + 20 * sn), kneeL: -k * (120 + 20 * sn), ankL: 40 * k, hipR: k * (68 - 20 * sn), kneeR: -k * (120 - 20 * sn), ankR: 40 * k,
        shL: -10 * k + 30 * k * Math.max(0, sn), elL: 10 * k, shR: -10 * k + 30 * k * Math.max(0, -sn), elR: 10 * k, torso: 8 * k * sn };
    } },
    backspin: { dur: 1.6, f: u => {
      const k = env(u, .2, .82), th = ss(.2, .82, u) * TAU * 3, c = Math.cos(th);
      return { root: { y: 70 * k, r: -90 * k, sx: (1 - k) + k * c, px: 100, py: 140 },
        hipL: -30 * k, kneeL: 100 * k, hipR: -30 * k, kneeR: 100 * k, shL: -40 * k, elL: -100 * k, shR: -40 * k, elR: -100 * k, head: -10 * k };
    } },
    freeze: { dur: 1.4, f: u => {
      const k = ss(0, .22, u) * (1 - ss(.8, 1, u)), sh = u > .22 && u < .3 ? Math.sin(u * 300) * 1.5 : 0;
      return { root: { y: 58 * k, x: 12 * k + sh, r: -104 * k, px: 70, py: 150 },
        shR: 175 * k, elR: 0, shL: 70 * k, elL: 60 * k, hipL: 85 * k, kneeL: -110 * k, ankL: 30 * k, hipR: 25 * k, kneeR: -70 * k, ankR: 20 * k, head: 22 * k };
    } },
    burn: { dur: 1.1, f: u => {
      const k = env(u, .2, .85), s = Math.sin(u * TAU * 3);
      return { root: { y: -3 * k * Math.abs(s) }, shR: 92 * k, elR: 4 * k, shL: -38 * k, elL: -105 * k, head: 10 * k, torso: 5 * k,
        hipL: 6 * k, hipR: 6 * k };
    } },
    win: { dur: .9, f: u => { const s = Math.abs(Math.sin(u * Math.PI)); return { root: { y: -22 * s }, shL: 150, elL: 15, shR: 150, elR: 15, hipL: 8 + 10 * s, hipR: 8 + 10 * s, kneeL: -10 * s, kneeR: -10 * s, head: -6 }; } },
    lose: { dur: 1.6, f: u => ({ root: { y: 3 }, head: 18 + 2 * Math.sin(u * TAU), shL: -6, elL: -10, shR: -6, elR: -10, torso: 3 }) },
  };
  // v3 (owner 10.11.2026 «больше деталей, больше вариаций»): more toprocks, power moves, freezes, taunts, reactions
  const up = x => Math.max(0, x), PI = Math.PI;
  Object.assign(MOVES, {
    walk: { dur: .9, f: u => { const e = ss(0, 1, u), s = Math.sin(u * TAU * 2.5) * (1 - ss(.8, 1, u));
      return { root: { x: -150 * (1 - e), y: -3 * Math.abs(s) }, hipL: 5 + 14 * up(s), hipR: 5 + 14 * up(-s), kneeL: -10 * up(s), kneeR: -10 * up(-s), shL: 10 + 14 * s, shR: 10 - 14 * s, elL: -18, elR: -18, torso: 3 * s, head: -2 * s }; } },
    // ---- toprock variants ----
    kickstep: { dur: 1.0, f: u => { const s = Math.sin(u * TAU * 2), a = up(s), b = up(-s);
      return { root: { y: -7 * Math.abs(s), x: 3 * s }, torso: -7 * s, head: 4 * s, hipL: 6 + 46 * a, kneeL: -6 * a, ankL: -18 * a, hipR: 6 + 46 * b, kneeR: -6 * b, ankR: -18 * b,
        shL: 18 + 62 * b, elL: -50 + 30 * b, shR: 18 + 62 * a, elR: -50 + 30 * a }; } },
    salsa: { dur: 1.0, f: u => { const s = Math.sin(u * TAU * 2), a = up(s), b = up(-s);
      return { root: { x: 15 * s, y: -3 * Math.abs(s) }, torso: 6 * s, head: -5 * s, hipL: 10 + 12 * b, kneeL: -14 * b, hipR: 10 + 12 * a, kneeR: -14 * a,
        shL: 34 + 28 * s, elL: -64, shR: 34 - 28 * s, elR: -64 }; } },
    indian: { dur: 1.0, f: u => { const s = Math.sin(u * TAU * 2), a = up(s), b = up(-s), o = Math.abs(s);
      return { root: { y: -6 * o, x: 5 * s, sx: 1 - .1 * o }, torso: 5 * s, head: -4 * s, hipL: 6 - 20 * a, kneeL: 14 * a, hipR: 6 - 20 * b, kneeR: 14 * b,
        shL: 24 + 58 * o, elL: -34 + 24 * o, shR: 24 + 58 * o, elR: -34 + 24 * o }; } },
    // ---- power / footwork ----
    airflare: { dur: 1.8, f: u => { const k = env(u, .18, .82), th = ss(.18, .82, u) * TAU * 2, sn = Math.sin(th);
      return { root: { y: 26 * k - 24 * k * Math.abs(sn), r: 150 * k + th * 180 / PI, px: 100, py: 120 }, hipL: 52 * k, hipR: 52 * k, kneeL: -6 * k, kneeR: -6 * k,
        shL: 165 * k, elL: 6 * k, shR: 165 * k, elR: 6 * k, head: 12 * k * sn }; } },
    swipe: { dur: 1.5, f: u => { const k = env(u, .2, .8), sp = ss(.2, .8, u) * 360, sn = Math.sin(u * TAU * 1.5);
      return { root: { y: 38 * k, r: sp, px: 100, py: 135 }, torso: 10 * k * sn, hipL: k * (40 + 36 * sn), hipR: k * (40 - 36 * sn), kneeL: -22 * k, kneeR: -22 * k,
        shL: 125 * k, elL: 10 * k, shR: 70 * k, elR: 20 * k, head: 10 * k * sn }; } },
    ninety: { dur: 1.7, f: u => { const k = env(u, .2, .82), th = ss(.2, .82, u) * TAU * 3, c = Math.cos(th);
      return { root: { y: 196 * k, r: 180 * k, sx: (1 - k) + k * c, px: 100, py: 30 }, hipL: 5 * k, hipR: 5 * k, kneeL: -24 * k, kneeR: -8 * k,
        shR: 177 * k, elR: 0, shL: 88 * k, elL: 12 * k, head: 6 * k }; } },
    backflip: { dur: 1.3, f: u => { const h = Math.sin(ss(.12, .9, u) * PI), cr = ss(0, .12, u) * (1 - ss(.12, .22, u)) + ss(.86, .93, u) * (1 - ss(.93, 1, u)),
        t = ss(.28, .45, u) * (1 - ss(.62, .8, u)), arm = ss(.06, .22, u) * (1 - ss(.82, 1, u));
      return { root: { y: -84 * h + 16 * cr, r: -360 * ss(.24, .8, u), px: 100, py: 140, sy: 1 - .1 * cr }, hipL: 40 * t + 8 * cr, hipR: 40 * t + 8 * cr, kneeL: -112 * t - 20 * cr, kneeR: -112 * t - 20 * cr,
        shL: 160 * arm * (1 - t) + 34 * t, elL: 40 * t, shR: 160 * arm * (1 - t) + 34 * t, elR: 40 * t, head: -8 * arm }; } },
    ccs: { dur: 1.6, f: u => { const k = env(u, .15, .85), s = Math.sin(ss(.12, .88, u) * TAU * 3), a = up(s), b = up(-s);
      return { root: { y: 48 * k, x: 7 * k * s }, torso: 13 * k * s, head: -8 * k * s, hipL: k * (55 + 13 * a), kneeL: -125 * k * (1 - a), ankL: 30 * k * (1 - a), hipR: k * (55 + 13 * b), kneeR: -125 * k * (1 - b), ankR: 30 * k * (1 - b),
        shL: k * (-8 + 46 * b), elL: 0, shR: k * (-8 + 46 * a), elR: 0 }; } },
    // ---- rhythm battle v2 (owner 13.11.2026: more footwork, reverse 1990, 2000, one hand freeze, headfreeze nike) ----
    hook: { dur: 1.6, f: u => { const k = env(u, .15, .85), s = Math.sin(ss(.12, .88, u) * TAU * 2), a = up(s), b = up(-s);
      return { root: { y: 46 * k, x: 5 * k * s }, torso: 10 * k * s, head: -6 * k * s, hipL: k * (60 - 24 * a), kneeL: -k * (118 - 40 * a), ankL: 34 * k, hipR: k * (60 + 28 * b), kneeR: -k * (118 + 22 * b), ankR: 34 * k,
        shL: k * (-6 + 36 * b), elL: 8 * k, shR: k * (-6 + 36 * a), elR: 8 * k }; } },
    kickout: { dur: 1.6, f: u => { const k = env(u, .15, .85), s = Math.sin(ss(.12, .88, u) * TAU * 3), a = up(s), b = up(-s);
      return { root: { y: 46 * k - 5 * k * Math.abs(s) }, torso: -8 * k, head: 4 * k, hipL: k * (58 + 30 * a), kneeL: -122 * k * (1 - a), ankL: 30 * k * (1 - a) - 16 * k * a, hipR: k * (58 + 30 * b), kneeR: -122 * k * (1 - b), ankR: 30 * k * (1 - b) - 16 * k * b,
        shL: k * (-14 + 26 * a), elL: -20 * k, shR: k * (-14 + 26 * b), elR: -20 * k }; } },
    babylove: { dur: 1.7, f: u => { const k = env(u, .15, .85), th = ss(.12, .88, u) * TAU * 3, s = Math.sin(th), c = Math.cos(th);
      return { root: { y: 52 * k, x: 12 * k * s, r: 12 * k * s, px: 100, py: 150 }, torso: 14 * k * s, head: -10 * k * s, hipL: k * (64 + 22 * s), kneeL: -k * (104 - 30 * c), ankL: 30 * k, hipR: k * (64 - 22 * s), kneeR: -k * (104 + 30 * c), ankR: 30 * k,
        shL: k * (10 + 34 * up(s)), elL: 6 * k, shR: k * (10 + 34 * up(-s)), elR: 6 * k }; } },
    onestep: { dur: 1.6, f: u => { const k = env(u, .15, .85), th = ss(.12, .88, u) * TAU * 3, sn = Math.sin(th), c = Math.cos(th);
      return { root: { y: 46 * k, sx: (1 - k) + k * (c >= 0 ? 1 : -1) * Math.max(.7, Math.abs(c)), px: 100, py: 150 },
        hipL: k * (72 + 26 * sn), kneeL: -k * (30 + 20 * up(-sn)), ankL: -10 * k, hipR: 66 * k, kneeR: -128 * k, ankR: 40 * k,
        shL: k * (-12 + 30 * up(sn)), elL: 10 * k, shR: k * (-12 + 30 * up(-sn)), elR: 10 * k, torso: 6 * k * sn }; } },
    russian: { dur: 1.6, f: u => { const k = env(u, .15, .85), s = Math.sin(ss(.12, .88, u) * TAU * 3), a = up(s), b = up(-s);
      return { root: { y: 44 * k - 7 * k * Math.abs(s) }, torso: -4 * k, hipL: k * (62 + 30 * a), kneeL: -124 * k * (1 - a), ankL: 34 * k * (1 - a) - 18 * k * a, hipR: k * (62 + 30 * b), kneeR: -124 * k * (1 - b), ankR: 34 * k * (1 - b) - 18 * k * b,
        shL: -32 * k, elL: -118 * k, shR: -32 * k, elR: -112 * k, head: 3 * k * s }; } },
    rninety: { dur: 1.7, f: u => { const k = env(u, .2, .82), th = -ss(.2, .82, u) * TAU * 3, c = Math.cos(th);
      return { root: { y: 196 * k, r: -180 * k, sx: (1 - k) + k * c, px: 100, py: 30 }, hipL: 5 * k, hipR: 5 * k, kneeL: -8 * k, kneeR: -24 * k,
        shL: 177 * k, elL: 0, shR: 88 * k, elR: 12 * k, head: -6 * k }; } },
    twok: { dur: 1.8, f: u => { const k = env(u, .18, .84), th = ss(.18, .84, u) * TAU * 4, c = Math.cos(th);
      return { root: { y: 196 * k, r: 180 * k, sx: (1 - k) + k * c, px: 100, py: 30 }, shL: 176 * k, elL: 0, shR: 176 * k, elR: 0,
        hipL: 14 * k, hipR: 14 * k, kneeL: 0, kneeR: 0, ankL: -10 * k, ankR: -10 * k, head: -6 * k }; } },
    onehand: { dur: 1.4, f: u => { const k = ss(0, .22, u) * (1 - ss(.8, 1, u)), w = u > .22 && u < .34 ? Math.sin(u * 280) * 2 : 0;
      return { root: { y: 196 * k, r: 180 * k + w, px: 100, py: 30 }, torso: -6 * k, shR: 177 * k, elR: 0, shL: 62 * k, elL: 18 * k, hipL: 58 * k, kneeL: -70 * k, hipR: -20 * k, kneeR: 34 * k, head: -6 * k }; } },
    nike: { dur: 1.4, f: u => { const k = ss(0, .22, u) * (1 - ss(.8, 1, u)), w = u > .22 && u < .32 ? Math.sin(u * 280) * 1.5 : 0;
      return { root: { y: 205 * k, r: 180 * k + w, px: 100, py: 26 }, hipL: 74 * k, kneeL: -96 * k, ankL: 20 * k, hipR: -34 * k, kneeR: 92 * k, ankR: -14 * k, shL: 55 * k, elL: 70 * k, shR: 55 * k, elR: 70 * k }; } },
    // ---- freezes ----
    handstand: { dur: 1.4, f: u => { const k = ss(0, .22, u) * (1 - ss(.8, 1, u)), w = u > .22 && u < .32 ? Math.sin(u * 280) * 1.6 : 0;
      return { root: { y: 198 * k, r: 180 * k + w, px: 100, py: 30 }, shL: 176 * k, shR: 176 * k, elL: 0, elR: 0, hipL: 52 * k, kneeL: -78 * k, hipR: 12 * k, kneeR: 0, head: -4 * k }; } },
    hollowback: { dur: 1.5, f: u => { const k = ss(0, .24, u) * (1 - ss(.8, 1, u)), w = u > .24 && u < .34 ? Math.sin(u * 280) * 1.4 : 0;
      return { root: { y: 196 * k, r: 180 * k + w, px: 100, py: 30 }, torso: -24 * k, shL: 170 * k, shR: 170 * k, elL: 8 * k, elR: 8 * k, hipL: 34 * k, kneeL: -50 * k, hipR: -6 * k, kneeR: 28 * k, head: 18 * k }; } },
    headstand: { dur: 1.4, f: u => { const k = ss(0, .22, u) * (1 - ss(.8, 1, u)), w = u > .22 && u < .32 ? Math.sin(u * 280) * 1.5 : 0;
      return { root: { y: 205 * k, r: 180 * k + w, px: 100, py: 26 }, hipL: 58 * k, kneeL: -112 * k, hipR: 58 * k, kneeR: -112 * k, ankL: 20 * k, ankR: 20 * k, shL: 55 * k, elL: 70 * k, shR: 55 * k, elR: 70 * k }; } },
    airchair: { dur: 1.4, f: u => { const k = ss(0, .22, u) * (1 - ss(.8, 1, u)), w = u > .22 && u < .3 ? Math.sin(u * 300) * 1.5 : 0;
      return { root: { y: 44 * k, x: 10 * k + w, r: -72 * k, px: 70, py: 150 }, shR: 172 * k, elR: 0, shL: -22 * k, elL: -104 * k, hipL: 30 * k, kneeL: -18 * k, hipR: 72 * k, kneeR: -96 * k, ankR: 24 * k, head: 26 * k }; } },
    // ---- taunts ----
    brush: { dur: 1.1, f: u => { const k = env(u, .2, .85), f = Math.sin(u * TAU * 4);
      return { root: { y: -2 * k * Math.abs(f) }, shR: 34 * k, elR: k * (142 + 12 * f), shL: -32 * k, elL: -110 * k, head: -9 * k, torso: -4 * k, hipL: 5 * k, hipR: 5 * k }; } },
    comehere: { dur: 1.1, f: u => { const k = env(u, .2, .85), f = Math.sin(u * TAU * 3);
      return { root: { y: -3 * k * Math.abs(f) }, shL: 56 * k, shR: 56 * k, elL: k * (74 + 34 * f), elR: k * (74 + 34 * f), head: 6 * k * f, hipL: 8 * k, hipR: 8 * k }; } },
    // ---- the one who watches ----
    bounce: { dur: .6, f: u => { const b = Math.abs(Math.sin(u * PI));
      return { root: { y: 5 * b }, hipL: 6 + 5 * b, hipR: 6 + 5 * b, kneeL: -10 * b, kneeR: -10 * b, shL: 8, shR: 8, elL: -22 - 12 * b, elR: -22 - 12 * b, head: 4 * b }; } },
    clap: { dur: .5, f: u => { const c = Math.abs(Math.sin(u * PI));
      return { shL: 16, shR: 16, elL: -104 + 22 * c, elR: -104 + 22 * c, head: 3 * c, hipL: 4, hipR: 4 }; } },
    nah: { dur: 1.0, f: u => { const s = Math.sin(u * TAU * 2);
      return { shR: 78, elR: 46 + 30 * s, shL: -32, elL: -116, head: 8 * s, torso: -3, hipL: 5, hipR: 5 }; } },
    shock: { dur: .9, f: u => { const k = env(u, .2, .8);
      return { root: { x: -7 * k, y: -3 * k }, shL: 150 * k, shR: 150 * k, elL: 118 * k, elR: 118 * k, head: -9 * k, torso: -5 * k, hipL: 8 * k, hipR: 8 * k }; } },
    // ---- endings ----
    win2: { dur: .8, f: u => { const s = Math.abs(Math.sin(u * PI));
      return { root: { y: -12 * s }, shR: 162, elR: 92 - 84 * s, shL: -22, elL: -100, head: -5, hipL: 8, hipR: 8 + 14 * s, kneeR: -30 * s }; } },
    win3: { dur: 1.0, f: u => { const p = MOVES.toprock.f(u), s = Math.sin(u * TAU * 2);
      return Object.assign(p, { shL: 150 + 16 * s, elL: 14, shR: 150 - 16 * s, elR: 14 }); } },
    lose2: { dur: 1.6, f: u => ({ root: { y: 3 }, shR: 26, elR: 152, shL: -6, elL: -10, head: 20 + 2 * Math.sin(u * TAU), torso: 4 }) },
    lose3: { dur: .7, f: u => { const c = Math.abs(Math.sin(u * PI)); return { shL: 16, shR: 16, elL: -104 + 22 * c, elR: -104 + 22 * c, head: 8 + 4 * c, hipL: 4, hipR: 4 }; } },
  });
  // ---- rare, battle-deciding moves (owner 11.11.2026: «редкую анимацию… решающей в победе на авто… в 1 % батлов… стойки,
  // вращения или акробатика… 3 разных»). Longer than the usual ones, with a hold the battle plays in slow motion.
  Object.assign(MOVES, {
    // SPIN — «2000»: upside down on both hands stacked, legs in a V, spinning faster and faster, then the legs open into a split
    r2000: { dur: 2.8, f: u => { const k = env(u, .14, .88), sp = ss(.16, .68, u), th = sp * sp * TAU * 6, c = Math.cos(th), o = ss(.68, .76, u) * (1 - ss(.86, .9, u));
      return { root: { y: 196 * k, r: 180 * k, sx: (1 - k) + k * c, px: 100, py: 30 }, shL: 176 * k, elL: 0, shR: 176 * k, elR: 0, torso: 0,
        hipL: k * (14 + 56 * o), hipR: k * (14 + 56 * o), kneeL: 0, kneeR: 0, ankL: -10 * k, ankR: -10 * k, head: -6 * k }; } },
    // ACROBATICS — double backflip: high, two turns tucked, lands low and pops up
    rflip: { dur: 2.0, f: u => { const a = ss(.1, .82, u), h = Math.sin(a * PI), cr = ss(0, .1, u) * (1 - ss(.1, .18, u)) + ss(.8, .87, u) * (1 - ss(.9, 1, u)),
        t = ss(.22, .34, u) * (1 - ss(.66, .76, u)), arm = ss(.04, .16, u) * (1 - ss(.86, 1, u));
      return { root: { y: -150 * h + 22 * cr, r: -720 * ss(.18, .76, u), px: 100, py: 140, sy: 1 - .14 * cr }, hipL: 72 * t + 10 * cr, hipR: 72 * t + 10 * cr,
        kneeL: -140 * t - 26 * cr, kneeR: -140 * t - 26 * cr, shL: 160 * arm * (1 - t) + 40 * t, elL: 60 * t, shR: 160 * arm * (1 - t) + 40 * t, elR: 60 * t, head: -8 * arm + 14 * t }; } },
    // STANCE — one-hand hollowback: on ONE straight arm, back arched, legs folded over the head, the free arm out — held long
    rhollow: { dur: 2.6, f: u => { const k = ss(0, .2, u) * (1 - ss(.86, 1, u)), w = u > .2 && u < .3 ? Math.sin(u * 300) * 1.8 : 0, br = Math.sin(u * TAU * 1.5) * .8 * k;
      return { root: { y: 198 * k, r: 180 * k + 6 * k + w + br, px: 100, py: 30 }, torso: -40 * k, shR: 178 * k, elR: 0, shL: 92 * k, elL: 4 * k,
        hipL: 46 * k, kneeL: -92 * k, ankL: 30 * k, hipR: -12 * k, kneeR: 64 * k, ankR: 20 * k, head: 24 * k }; } },
  });
  // ---- even rarer, «mythic» moves (owner 11.11.2026: «ещё 3 с вероятностью 0,5 %… красный фон и слегка трясущийся экран») ----
  Object.assign(MOVES, {
    // SPIN — «real one hand» (owner 11.11.2026: «airflare через 1 руку… самый мощный элемент powermove»): airflare turns in the air
    // over ONE straight arm, the other arm folded to the chest, legs in a wide V, faster and faster
    rone: { dur: 3.0, f: u => { const k = env(u, .14, .86), sp = ss(.14, .84, u), th = (sp * .6 + sp * sp * .4) * TAU * 4, sn = Math.sin(th);
      return { root: { y: 30 * k - 30 * k * Math.abs(sn), r: 150 * k + th * 180 / PI, px: 100, py: 120 }, hipL: 58 * k, hipR: 58 * k, kneeL: -4 * k, kneeR: -4 * k,
        shR: 168 * k, elR: 2 * k, shL: -20 * k, elL: -120 * k, torso: -6 * k * sn, head: 12 * k * sn }; } },
    // ACROBATICS — corkscrew: a layout flip with a full twist, very high, arms hugged in for the twist
    rcork: { dur: 2.0, f: u => { const a = ss(.1, .84, u), h = Math.sin(a * PI), cr = ss(0, .1, u) * (1 - ss(.1, .18, u)) + ss(.82, .88, u) * (1 - ss(.9, 1, u)),
        tw = ss(.24, .7, u), arm = ss(.04, .16, u) * (1 - ss(.24, .3, u)), hug = ss(.24, .3, u) * (1 - ss(.7, .78, u)), sx = Math.cos(tw * TAU);
      return { root: { y: -170 * h + 22 * cr, r: -360 * ss(.2, .78, u), sx, px: 100, py: 130, sy: 1 - .14 * cr }, hipL: 6 + 10 * cr, hipR: 6 + 10 * cr, kneeL: -26 * cr, kneeR: -26 * cr,
        shL: 160 * arm + 18 * hug + 30 * (1 - arm - hug) * ss(.78, .9, u), elL: -130 * hug, shR: 160 * arm + 18 * hug + 30 * (1 - arm - hug) * ss(.78, .9, u), elR: -130 * hug, head: -6 * arm }; } },
    // STANCE — planche («superman»): the whole body flat in the air, held only by the straight arms, long hold
    rplanche: { dur: 2.7, f: u => { const k = ss(0, .22, u) * (1 - ss(.84, 1, u)), w = u > .22 && u < .32 ? Math.sin(u * 300) * 1.4 : 0, br = Math.sin(u * TAU * 2) * .7 * k;
      return { root: { y: 14 * k, x: 6 * k, r: -86 * k + w + br, px: 100, py: 112 }, torso: 0, shL: 90 * k, elL: 0, shR: -88 * k, elR: 0,
        hipL: 2 * k, hipR: 2 * k, kneeL: 0, kneeR: 0, ankL: -24 * k, ankR: -24 * k, head: -22 * k }; } },
  });
  window.HERO = { LEVELS, NAMES, PERKS, RING, SHOP, GEAR, itemOf, cityRewardValue, baseSlots, gearBoost, gearTraceBonus, gearChances, gearEvent, laceLayout, MYTHIC_MOVES, MYTHIC_SCORE, MOVES, levelFor, svg, rigJoints, setPose, topDown };
})();
