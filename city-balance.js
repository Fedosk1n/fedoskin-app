// «Город»: все цифры игры в одном месте (как таблица множителей в батле — tools/rb2.js).
// Меняешь число здесь — меняется игра. Тексты и карта — в city-data.js, движок — в city.js.
window.CITY_BAL = {
  save: 1,                 // номер версии сохранения (поднимать, когда меняется его устройство)
  dayMin: 24,              // игровые сутки в реальных минутах
  startHour: 7,
  energy: { max: 100, battle: 20, show: 10, lose: 10, stretch: 15 },
  start: { cash: 30, rep: 0 },
  // пол: mult — множитель очков раунда; pen — штраф за пауэрмув от ×1.3 (доля очков); bruise — шанс ушиба; uses — сколько выступлений живёт
  floor: {
    asphalt: { mult: 1, pen: .12, bruise: .25 },
    card: { mult: 1, pen: 0, bruise: 0, uses: 5 },
    lino: { mult: 1, pen: 0, bruise: 0 },
    roll: { mult: 1.03, pen: 0, bruise: 0 },
    tile: { mult: 1.05, pen: 0, bruise: 0 },
    stage: { mult: 1.05, pen: 0, bruise: 0 }
  },
  powerFrom: 1.3,          // с какого множителя пауэрмув считается «жёстким» для асфальта
  padsBruise: .10,         // шанс ушиба в наколенниках
  // батл с би-боем
  npc: { acc0: .42, accLvl: .045, spread: .08, style: .03, judge: .1 },
  rep: { base: 5, perLvl: 5, first: 2 },   // респект за победу = base + perLvl × уровень; первая победа над соперником × first
  read: { per: .05, max: .2 },             // «читают связку»: штраф за каждое повторённое движение
  lace: .02,                               // счастливый шнурок: при разнице меньше 2 % один судья за тебя
  // уличное шоу
  show: { min: 5, span: 35, tired: .75, rest: 6 * 60, cassette: 1.15, cap: 46 },
  // магазин и ларёк
  price: { tea: 8, shawarma: 25, tape: 20, pads: 150, hat: 250, kicks: 300, lino: 400, roll: 1500, metro: 15 },
  food: { tea: 12, shawarma: 40, thermos: 30 },
  item: { kicksMs: 10, hatPx: 6, tapeUses: 3 },
  // шансы находок (только в городе)
  drop: { tapeWin: .15, tapeTrash: .2, tapeHat: .06, thermosNight: .12 },
  // бит от диджея по уровню соперника
  beats: [[2, ['lofi', 'boom']], [4, ['funk', 'raw']], [7, ['raw', 'cut']], [10, ['trip', 'dbl']]],
  showBeats: ['lofi', 'boom', 'funk'],
  district: { center: 50, park: 150, prom: 400, club: 1000 }
};
