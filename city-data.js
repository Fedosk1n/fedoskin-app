// «Город»: карта, места, би-бои и расписание — данными. Новый район = новая запись здесь, движок (city.js) не трогаем.
// Тексты — по-русски, переводятся через общий словарь (tools/i18n_src.py). Персонажи выдуманные, брендов нет.
// Клетки карты: F забор · # дом · b соседний дом · D дверь домой · G гаражи · T мусорка · K ларёк · S палатка · X ворота в Центр
// c тайник · t дерево · . асфальт · = тротуар · r дорога · g трава · p песок площадки · * точка для шоу
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
    patchYard: { name: 'Нашивка «Двор»', info: 'Трофей: ты хозяин двора', ico: '🏅', city: true }
  },
  districts: {
    yard: {
      name: 'Двор', start: [6, 6],
      birds: [[13.4, 13.6], [14.1, 13.2], [13.0, 12.9], [24.5, 18.3], [25.2, 18.8], [17.6, 1.5]],   // голуби: улетают, если подойти
      map: [
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        'F..........................c.F',
        'F.#########.....bbbbbbbbbbb..F',
        'F.#########.....bbbbbbbbbbb..F',
        'F.#########.....bbbbbbbbbbb..F',
        'F.####D####.....bbbbbbbbbbb..F',
        'F.==========L...===========..F',
        'F....=.........t.....=...TT..F',
        'F....=..*..gggggggg..=.......F',
        'F....=...L.gtppppggB.=.....L.F',
        'F....=....BggppppggB.========X',
        'F....=.....ggppptgg..=.......F',
        'F....=.....gggggggg..=..KK...F',
        'F....=...............=..KK...F',
        'F....===========SS====.......F',
        'F....=..........SS.....L.....F',
        'F....=...................CC..F',
        'F.GGGGGGGGGGG......t.....t...F',
        'F.GGGGGGGGGGG................F',
        'F.............L.......CC.....F',
        'Fc.................g.g.g.g...F',
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
        { id: 'st1', type: 'stash', at: [1, 20], name: 'Тайник за гаражами', item: 'cassette' },
        { id: 'st2', type: 'stash', at: [27, 1], name: 'Тайник за домом', item: 'chalk' }
      ],
      npcs: [
        { id: 'vitek', name: 'Витёк «Шаг»', lvl: 1, style: 0, at: [9, 7], hours: [7, 17], stake: [10, 20], col: '#4FA3E0',
          look: { base: 2, col: { hat: ['#4FA3E0', '#2B6FA8'], top: '#DADDE3', shoe: '#F2EFE8', shoe2: '#4FA3E0' }, wrist: '#4FA3E0' },
          hi: 'Здорово! Я тут каждый день топрок кручу. Выйдешь?', win: 'Ладно, ноги у тебя есть. Уважаю.', lose: 'Топрок — это база. Иди учи.',
          rumor: { text: 'Слыхал, за гаражами кто-то спрятал старую кассету.', mark: 'st1' } },
        { id: 'lyoha', name: 'Лёха «Шестёрка»', lvl: 2, style: 1, at: [7, 16], hours: [16, 23], stake: [10, 40], col: '#3BD16F',
          look: { base: 4, acc: ['knee', 'gloves'], phones: false, col: { hat: ['#2A2A2F', '#3BD16F'], top: '#1E7A45', yoke: '#18181B', sleeve: '#1E7A45', cuff: '#18181B', trim: '#F2EFE8', stripe: '#3BD16F', shoe: '#F2EFE8', shoe2: '#3BD16F' } },
          hi: 'Шесть шагов видел? Сейчас увидишь двенадцать.', win: 'Чисто по низу прошёл. Красава.', lose: 'Футворк надо чувствовать, а не считать.',
          rumor: { text: 'За соседним домом, в углу, пацаны что-то оставили.', mark: 'st2' } },
        { id: 'garik', name: 'Гарик «Гараж»', lvl: 3, style: 2, at: [10, 16], hours: [18, 3], stake: [30, 60], col: '#E2611A', boss: true, needRep: 25, drop: ['lace', 'patchYard'],
          look: { base: 6, big: 1.14, chain: 2, hat: 'bucket', box: true, col: { hat: ['#18181B', '#E2611A'], shoe: '#E2611A', shoe2: '#F2EFE8' } },
          hi: 'Это мой двор. Хочешь в Центр — сначала пройди меня.', win: 'Двор твой. В Центре скажи, что от Гарика.', lose: 'Рано тебе. Подрасти и приходи.',
          early: 'Я с кем попало не выхожу. Набери респект — тогда поговорим.' }
      ]
    }
  }
};
