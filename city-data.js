// «Город»: карта, места, би-бои и расписание — данными. Новый район = новая запись здесь, движок (city.js) не трогаем.
// Тексты — по-русски, переводятся через общий словарь (tools/i18n_src.py). Персонажи выдуманные, брендов нет.
// Клетки карты: F забор · # дом · b соседний дом · D дверь домой · G гаражи · T мусорка · K ларёк · S палатка · X ворота в Центр
// c тайник · t дерево · . асфальт · = тротуар · r дорога · g трава · p песок площадки · * точка для шоу
// h домик/сарай/магазинчик (вид и высота — сами, по месту) · u куст · f клумба (можно ходить) · a спортплощадка (можно ходить)
// P качели/горка/карусель · k ящики, бочки, покрышки · M рыночный прилавок · C машина · L фонарь · B лавочка
// C машина (две клетки в ряд) · L фонарь (ночью светит) · B лавочка — через них не пройти
// look у би-боя: base = образ уровня из hero.js (HERO.topDown), acc = вещи, col = свои цвета, big = крупнее (хозяин района)
window.CITY_DATA = {
  items: {
    // магазин
    pads: { name: 'Наколенники', info: 'Меньше риск ушиба на асфальте', ico: '🦵' },
    kicks: { name: 'Кроссовки', info: 'Чуть шире окно попадания в футворке', ico: '👟' },
    hat: { name: 'Шапка для хедспина', info: 'Шире коридор траектории хедспина', ico: '🧢' },
    lino: { name: 'Линолеум', info: 'Пол без штрафов, не рвётся', ico: '🟫' },
    // только из города — купить нельзя
    tape: { name: 'Изолента', info: 'Чинит картон: +3 выступления', ico: '🩹', use: true, city: true },
    thermos: { name: 'Термос с чаем', info: '+30 энергии где угодно', ico: '🫖', use: true, city: true },
    chalk: { name: 'Мел би-боя', info: 'Раз в день толпа на шоу не устаёт', ico: '✏️', city: true },
    cassette: { name: 'Кассета «Золотой брейк»', info: 'В шляпу падает на 15 % больше', ico: '📼', city: true },
    lace: { name: 'Счастливый шнурок', info: 'При почти равном счёте один судья за тебя', ico: '🍀', city: true },
    can: { name: 'Баллончик с краской', info: 'Нужен, чтобы нарисовать тег на стене', ico: '🎨', use: true, city: true },
    patchYard: { name: 'Нашивка «Двор»', info: 'Трофей: ты хозяин двора', ico: '🏅', city: true }
  },
  // уникальные шмотки: выпадают только в городе. slot — куда надевается; rar — редкость 0…3; f / col — как выглядит на герое; perk — [вид, число]
  gear: {
    rustyBandana: { name: 'Бандана Ржавых', slot: 'hat', rar: 0, ico: '🧣', f: { hat: 'bandana' }, col: { hat: ['#C8603A', '#F2EFE8'] }, perk: ['time', 5] },
    rustyTrack: { name: 'Олимпийка Ржавых', slot: 'top', rar: 1, ico: '🧥', f: { top: 'track' }, col: { top: '#C8603A', yoke: '#18181B', sleeve: '#C8603A', cuff: '#18181B', trim: '#F2CC55' }, perk: ['rep', 1] },
    acidKicks: { name: 'Кислотные кроссы', slot: 'kicks', rar: 1, ico: '👟', col: { shoe: '#7CFF4F', shoe2: '#18181B', sole: '#F2EFE8', lace: '#18181B' }, perk: ['en', 1] },
    acidBucket: { name: 'Кислотная панама', slot: 'hat', rar: 1, ico: '🎩', f: { hat: 'bucket' }, col: { hat: ['#7CFF4F', '#18181B'] }, perk: ['coin', 1] },
    owlPhones: { name: 'Наушники Совы', slot: 'ears', rar: 2, ico: '🎧', f: { phones: true }, perk: ['show', 15] },
    owlHoodie: { name: 'Худи Ночных сов', slot: 'top', rar: 2, ico: '🦉', f: { top: 'bomber' }, col: { top: '#6B4E9A', sleeve: '#6B4E9A', cuff: '#FFD23F', trim: '#FFD23F' }, perk: ['time', 8] },
    goldChain: { name: 'Цепь «Золотой зуб»', slot: 'neck', rar: 2, ico: '⛓️', f: { chain: 2 }, perk: ['cash', 15] },
    goldCap: { name: 'Золотая кепка', slot: 'hat', rar: 3, ico: '🧢', f: { hat: 'capGold' }, col: { hat: ['#E7B23C', '#18181B'] }, perk: ['life', 1] },
    cypherBomber: { name: 'Бомбер Сайфера', slot: 'top', rar: 3, ico: '🎤', f: { top: 'bomber' }, col: { top: '#18181B', sleeve: '#E2611A', cuff: '#FFD23F', trim: '#FFD23F' }, perk: ['rep', 2] },
    djGloves: { name: 'Перчатки диджея', slot: 'hands', rar: 2, ico: '🧤', f: { gloves: true }, perk: ['time', 6] }
  },
  districts: {
    yard: {
      name: 'Двор', start: [6, 6],
      birds: [[13.4, 13.6], [14.1, 13.2], [13.0, 12.9], [24.5, 18.3], [25.2, 18.8], [17.6, 1.5]],   // голуби: улетают, если подойти
      // банды: танцуют на своих точках, каждый игровой день возвращаются (на одной из spots). Победил в стычке — банда уходит и оставляет добычу.
      // gear — их шмотки (первая победа даёт первую); hours — когда выходят; tut — с неё начинается игра
      gangs: [
        { id: 'rusty', name: 'Ржавые', lvl: 1, col: '#C8603A', tut: true, spots: [[7, 10], [9, 13]], gear: ['rustyBandana', 'rustyTrack'], taunt: 'Это наш подъезд. Танцуй или уходи.' },
        { id: 'acid', name: 'Кислотные', lvl: 2, col: '#7CFF4F', spots: [[17, 16], [15, 17]], gear: ['acidKicks', 'acidBucket'], taunt: 'У нас кислотный стиль. Не обожгись.' },
        { id: 'owls', name: 'Ночные совы', lvl: 3, col: '#9A6FC0', hours: [20, 6], spots: [[6, 20], [15, 2]], gear: ['owlPhones', 'owlHoodie'], taunt: 'Ночью двор наш. Покажи, что не спишь.' },
        { id: 'gold', name: 'Золотые зубы', lvl: 4, col: '#E7B23C', spots: [[25, 11], [25, 19]], gear: ['goldChain', 'goldCap'], taunt: 'Золото берёт тот, кто чище танцует.' }
      ],
      // куда носят заказы из ларька (клетки у дверей)
      drops: [[2, 10], [2, 14], [6, 6], [20, 6], [8, 13], [18, 20], [26, 17], [13, 3], [26, 20], [5, 19]],
      // жители: ходят по тротуарам туда-обратно (только картинка, 7:00–22:00)
      walkers: [
        { path: [[5, 7], [5, 14], [15, 14]], speed: 1.5, look: { base: 1, girl: true, col: { top: '#C96F8B' } } },
        { path: [[2, 6], [11, 6]], speed: 1.1, look: { base: 2, col: { top: '#3F9590', hat: ['#F2EFE8', '#3F9590'] } } },
        { path: [[21, 13], [21, 7], [21, 10], [28, 10]], speed: 1.7, look: { base: 3, col: { top: '#DDA945' } } },
        { path: [[16, 6], [26, 6]], speed: 1.2, look: { base: 1, girl: true, col: { top: '#5E86C9' } } },
        { path: [[1, 19], [13, 19]], speed: 1.4, look: { base: 5, col: { top: '#84A552', hat: ['#C9C2B0', '#84A552'] } } }
      ],
      traffic: { row: 21, period: 23, dur: 7 },   // машина проезжает по дороге раз в period секунд
      map: [
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        'F.........f.hhh............c.F',
        'F.#########.hhh.bbbbbbbbbbb..F',
        'F.#########.....bbbbbbbbbbb.kF',
        'F.#########.fuf.bbbbbbbbbbb..F',
        'F.####D####.....bbbbbbbbbbb..F',
        'F.==========L...===========..F',
        'F.u..=....M..u.t..k..=...TT..F',
        'F.hh.=..*..gggggggg..=.hhh...F',
        'F.hh.=...L.gtPppPggB.=.hhh.L.F',
        'F....=....BgfppppfgB.========X',
        'F.fu.=.hhh.ggPpptgg..=.u...f.F',
        'F.hh.=.hhh.guggggug..=..KK.M.F',
        'F.hh.=.....u.....f.M.=..KK...F',
        'F....===========SS====.k.....F',
        'F.CC.=..aaaaa...SS.....L.hhh.F',
        'F....=..aaaaa.k.....M....hhh.F',
        'F.GGGGGGGGGGG......t.CC..t...F',
        'F.GGGGGGGGGGG..M.hhh.........F',
        'F.............L..hhh..CC...hhF',
        'Fc..k.....f.f......u.f.u.f.hhF',
        'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
        'rrrrCCrrrrrrrrrrrCCrrrrrrrrrrr',
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
      ],
      places: [
        { id: 'home', type: 'home', at: [6, 5], name: 'Дом' },
        { id: 'trash', type: 'trash', at: [25, 7], name: 'Мусорка' },
        { id: 'kiosk', type: 'kiosk', at: [24, 13], name: 'Ларёк «Шаурма»', open: [8, 23] },
        { id: 'tent', type: 'shop', at: [16, 15], name: 'Палатка «Всё для танца»', open: [10, 19], sell: ['pads', 'kicks', 'hat'] },
        { id: 'spot1', type: 'show', at: [8, 8], name: 'Пятачок у подъезда' },
        { id: 'gate', type: 'gate', at: [29, 10], name: 'Дорога в Центр', to: 'center' },
        { id: 'mc', type: 'mc', at: [11, 15], name: 'MC Рупор', gear: ['cypherBomber'], look: { base: 6, col: { top: '#FFD23F', hat: ['#18181B', '#FFD23F'] } } },
        { id: 'dj', type: 'dj', at: [18, 15], name: 'Диджей Винт', gear: ['djGloves'], look: { base: 4, col: { top: '#3F8FD8', sleeve: '#3F8FD8' } } },
        { id: 'gym', type: 'gym', at: [12, 15], name: 'Разминка' },
        { id: 'wall1', type: 'wall', at: [5, 1], name: 'Чистая стена', ty: -27 },       // ty: где на картинке стена относительно клетки (px)
        { id: 'wall2', type: 'wall', at: [20, 1], name: 'Чистая стена', ty: -27 },
        { id: 'wall3', type: 'wall', at: [8, 19], name: 'Чистая стена', ty: -42 },
        { id: 'st1', type: 'stash', at: [1, 20], name: 'Тайник за гаражами', item: 'cassette' },
        { id: 'st2', type: 'stash', at: [27, 1], name: 'Тайник за домом', item: 'chalk' }
      ],
      npcs: [
        { id: 'vitek', name: 'Клик', lvl: 1, style: 0, at: [9, 7], hours: [7, 17], stake: [10, 20], col: '#4FA3E0',
          look: { base: 2, col: { hat: ['#4FA3E0', '#2B6FA8'], top: '#DADDE3', shoe: '#F2EFE8', shoe2: '#4FA3E0' }, wrist: '#4FA3E0' },
          hi: 'Здорово! Я тут каждый день топрок танцую. Выйдешь?', win: 'Ладно, ноги у тебя есть. Уважаю.', lose: 'Топрок — это база. Иди учи.',
          rumor: { text: 'Слыхал, за гаражами кто-то спрятал старую кассету.', mark: 'st1' } },
        { id: 'lyoha', name: 'Амёба', lvl: 2, style: 1, at: [7, 16], hours: [16, 23], stake: [10, 40], col: '#3BD16F',
          look: { base: 4, acc: ['knee', 'gloves'], phones: false, col: { hat: ['#2A2A2F', '#3BD16F'], top: '#1E7A45', yoke: '#18181B', sleeve: '#1E7A45', cuff: '#18181B', trim: '#F2EFE8', stripe: '#3BD16F', shoe: '#F2EFE8', shoe2: '#3BD16F' } },
          hi: 'Шесть шагов видел? Сейчас увидишь двенадцать.', win: 'Чисто по низу прошёл. Красава.', lose: 'Футворк надо чувствовать, а не считать.',
          rumor: { text: 'За соседним домом, в углу, пацаны что-то оставили.', mark: 'st2' } },
        { id: 'garik', name: 'Ураган', lvl: 3, style: 2, at: [10, 16], hours: [18, 3], stake: [30, 60], col: '#E2611A', boss: true, needRep: 25, drop: ['lace', 'patchYard'],
          look: { base: 6, big: 1.14, chain: 2, hat: 'bucket', box: true, col: { hat: ['#18181B', '#E2611A'], shoe: '#E2611A', shoe2: '#F2EFE8' } },
          hi: 'Это мой двор. Хочешь в Центр — сначала пройди меня.', win: 'Двор твой. В Центре скажи, что от Урагана.', lose: 'Рано тебе. Подрасти и приходи.',
          early: 'Я с кем попало не выхожу. Набери респект — тогда поговорим.' }
      ]
    }
  }
};
