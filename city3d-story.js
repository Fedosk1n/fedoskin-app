import { createStoryPortrait } from './city3d-story-portraits.js?v=1';
import { CAST } from './city3d-campaign-data.js?v=1';
import { CHAPTER_ART, LANDMARKS, landmarkImage } from './city3d-guide-data.js?v=1';

export const WATCH_TIME = 8;

export const CHAPTERS = [
  {
    id: 'cypher', speaker: 'vint', district: 'yard', title: 'Место в кругу', location: 'Двор · круг сайфера',
    line: 'Винт: «Раньше сюда сходились со всего города. Теперь каждый держится своего района. Соберём их снова? Для начала посмотри, как здесь передают круг».',
    task: 'Встань на следы зрителя у картона и смотри круг {n} секунд.',
    imageHint: 'Два следа смотрят носками к картону. Остановись на них и дождись конца отсчёта.',
    near: 'Осталось у круга · {n} с',
    reply: 'Винт: «Видишь, следующий выходит, когда ему освобождают место. Двор в деле. Сходи к ТЦ „Круг“: там танцуют Трафареты».',
    credit: 'Двор · Винт ставит бит и открывает круг', en: 8, rep: 6,
  },
  {
    id: 'mall', speaker: 'stencil', district: 'center', title: 'Площадь под присмотром', location: 'Центр · плитка перед ТЦ «Круг»',
    line: 'Трафареты: «Мы уже рисуем афишу. Покажи, что можешь удержать толпу до конца выхода. Начинай, когда охранник уходит: красный круг выдаёт, где он тебя заметит».',
    task: 'Закончи шоу у ТЦ, пока охранник тебя не заметил.',
    imageHint: 'Встань у бумажной афиши. Начни шоу, когда охранник отойдёт от плитки.',
    near: 'Начни шоу, когда красный круг отдалится',
    reply: 'Трафареты: «Даже у дверей остановились посмотреть. Афиша за нами. У Шурупа на эстраде спроси, выйдет ли Парк».',
    credit: 'Центр · Трафареты печатают афишу', en: 12, rep: 8,
  },
  {
    id: 'jam', speaker: 'bolt', district: 'park', title: 'Выход на эстраду', location: 'Парк · эстрада у набережной',
    line: 'Шуруп: «Трафареты прислали макет. Оставлю там имя Парка, если возьмёшь у меня первый раунд. Остальные два можешь сыграть для себя».',
    task: 'Выиграй хотя бы один раунд джема на эстраде',
    imageHint: 'У мониторов эстрады нажми «Джем на эстраде». Для афиши достаточно выиграть один раунд.',
    near: 'Джем · выиграй первый раунд',
    reply: 'Шуруп: «Раунд твой. Я приду от Парка. На ринге спроси Клёпку: у неё есть колонки, которые слышно на весь двор».',
    credit: 'Парк · Шуруп танцует от эстрады', en: 15, rep: 12,
  },
  {
    id: 'ring', speaker: 'rivet', district: 'prom', title: 'Последнее имя на афише', location: 'Промзона · подпольный ринг',
    line: 'Клёпка: «Колонки есть. Наши с ринга тоже хотят в общий круг. Выиграй батл, и я впишу Промзону».',
    task: 'Победи в батле на подпольном ринге.',
    imageHint: 'Подойди к турнирной сетке с открытой стороны ринга. Выиграй батл.',
    near: 'Подпольный ринг · выиграй батл',
    reply: 'Клёпка: «Есть победа. Грузи колонки. Винт уже ждёт во дворе, а я забираю наших с ринга».',
    credit: 'Промзона · Клёпка привозит колонки', en: 18, rep: 16,
  },
  {
    id: 'finale', speaker: 'vint', district: 'yard', title: 'Общий сайфер', location: 'Двор · круг сайфера',
    line: 'Винт: «Все в сборе. Дам гостям по выходу, а потом передам круг тебе».',
    task: 'Вернись к кругу и нажми «Открыть общий сайфер». Этот выход бесплатный.',
    imageHint: 'У подписанной афиши нажми «Открыть общий сайфер». Твой раунд начнётся после трёх гостей.',
    near: 'Общий сайфер · бесплатный выход',
    reply: 'Винт: «Трафареты, Шуруп, Клёпка, ты. Все успели выйти. Подписываем афишу и вешаем её в журнале. Первый общий круг состоялся».',
    en: 15, rep: 15,
  },
];

const DISTRICTS = CHAPTERS.filter(chapter => chapter.credit);
export const INVITATION_COUNT = DISTRICTS.length;

export function loadStory(earned) {
  const receipts = [];
  if (!Array.isArray(earned)) return receipts;
  for (const receipt of earned.slice(0, CHAPTERS.length)) {
    if (!Number.isFinite(receipt?.en) || receipt.en < 0 || !Number.isFinite(receipt.rep) || receipt.rep < 0) break;
    receipts.push({ en: receipt.en, rep: receipt.rep });
  }
  return receipts;
}

export function advanceStory(state, id, energyCap) {
  const chapter = CHAPTERS[state.story.length];
  if (chapter?.id !== id) return null;
  const receipt = { en: Math.max(0, Math.min(chapter.en, energyCap - state.en)), rep: chapter.rep };
  state.en += receipt.en;
  state.rep += receipt.rep;
  state.story.push(receipt);
  return receipt;
}

export function mountStoryPortraits(journal, t) {
  for (const line of journal.querySelectorAll('[data-story-speaker]')) {
    const speaker = line.dataset.storySpeaker;
    const mount = () => {
      if (line.querySelector('.story-portrait')) return;
      // The localized dialogue already gives the name in text.
      line.prepend(createStoryPortrait(speaker, t(CAST[speaker]), { showName: false }));
    };
    const details = line.closest('details');
    if (!details || details.open) mount();
    else details.addEventListener('toggle', () => { if (details.open) mount(); });
  }
}

export function storyJournal(t, earned, hint, cap) {
  const current = CHAPTERS[earned.length];
  const finale = CHAPTERS.at(-1);
  const task = chapter => t(chapter.task, { n: WATCH_TIME });
  const line = (chapter, wording) => `<p class="story-dialogue" data-story-speaker="${chapter.speaker}"><span>${t(wording)}</span></p>`;
  const figure = (chapter, lazy = true) => {
    const art = CHAPTER_ART[chapter.id];
    return `<figure class="story-reference">
      <img src="${landmarkImage(art)}" width="560" height="318" alt="${t(LANDMARKS[art][1])}" ${lazy ? 'loading="lazy"' : ''} decoding="async">
      <figcaption>${t(chapter.imageHint)}</figcaption></figure>`;
  };
  const poster = `<section class="story-poster${current ? '' : ' signed'}">
    <h5>${t(current ? 'Состав сайфера' : 'Афиша общего сайфера')}</h5>
    ${current ? '' : `<figure class="story-reference"><img src="img/story-finale.webp?v=1" width="840" height="400" decoding="async" alt="${t('Гости из Центра, Парка и Промзоны собрались у дворового круга.')}"></figure>`}
    <ul>${DISTRICTS.map((chapter, index) => `<li class="${index < earned.length ? 'pledged' : ''}">
      <span aria-hidden="true">${index < earned.length ? '✓' : '○'}</span>${t(chapter.credit)}</li>`).join('')}</ul>
    ${current ? '' : `<p class="story-signature">${t('Подписали Винт, Трафареты, Шуруп, Клёпка и ты')}</p>`}
    </section>`;
  const history = earned.map((receipt, index) => {
    const chapter = CHAPTERS[index];
    return `<details class="story-history"><summary>${t(chapter.title)} <span>+${receipt.rep} ★ · +${receipt.en} ⚡</span></summary>
      <p><b>${t(chapter.location)}</b> · ${task(chapter)}</p>${figure(chapter)}${line(chapter, chapter.reply)}</details>`;
  });
  return `<div class="story-journal"><div class="story-header"><h4 id="g3storyTitle" tabindex="-1">${t('Собрать общий сайфер')}</h4>
    <button id="g3choiceBack" class="sec" type="button" aria-label="${t('Закрыть журнал')}">×</button></div>
    ${current ? `<section class="story-current">
      <h5>${t(current.title)}</h5><div class="story-location">${t(current.location)}</div>
      ${line(current,current.line)}<p><b>${task(current)}</b></p>
      ${hint ? `<p class="story-route">${hint}</p>` : ''}
      ${figure(current, false)}
      <p class="story-reward">${t('Награда · +{r} ★ и до +{e} ⚡', { r: current.rep, e: current.en })}<small>${t('Энергия копится до {n} ⚡.', { n: cap })}</small></p>
      </section>` : `<p class="story-done">✓ ${t('Общий сайфер состоялся')}</p>${line(finale,finale.reply)}`}
    ${poster}${history.slice().reverse().join('')}</div>`;
}

export const STORY_CSS = `
#g3hud2 #g3story{min-height:37px;color:#FFE09B;border-color:#b58a49;font:inherit;white-space:nowrap}
#g3story b{margin-inline-start:3px;font-variant-numeric:tabular-nums}
#g3hud2 #g3story.done{color:#9FE7B6;border-color:#529366}
body.g3fight #g3story{visibility:hidden}
#g3storyNear{position:fixed;z-index:5;left:50%;bottom:calc(155px + env(safe-area-inset-bottom));transform:translateX(-50%);width:max-content;max-width:calc(100vw - 38px);box-sizing:border-box;pointer-events:none;padding:6px 12px;border:1px solid #b58a49;border-radius:12px;background:#0b0d12de;color:#ffe09b;font:750 12px/1.3 Inter,sans-serif;text-align:center;font-variant-numeric:tabular-nums}
#g3info .story-journal{color:#F2EFE8}
#g3info .story-journal p{margin:7px 0}
.story-dialogue{display:flex;align-items:flex-start;gap:9px}
.story-dialogue>span:last-child{min-width:0;overflow-wrap:anywhere}
.story-dialogue .story-portrait{--portrait-size:44px;flex:0 0 44px}
.story-header{position:sticky;top:-18px;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#14161b;padding:6px 0 10px}
#g3info .story-header h4{margin:0;line-height:1.2}
#g3info .story-header button{flex:none;width:44px;height:44px;margin:0;padding:0;font-size:22px;line-height:1}
.story-current{padding:13px 14px;border-inline-start:3px solid #ec9857;background:#1d2027;border-radius:9px;}
.story-current h5,.story-poster h5{margin:3px 0 7px;font-size:17px;line-height:1.25}
.story-location,.story-reward,.story-route{color:#FFE09B}
.story-location,.story-reward,.story-route,.story-history summary{font-weight:700}
.story-reward small{display:block;color:#c7c3b9;font-size:12px;font-weight:500}
.story-reference{margin:9px 0;border:1px solid #514339;border-radius:9px;overflow:hidden;background:#100f11}
.story-reference img{display:block;width:100%;height:auto;aspect-ratio:21/10;object-fit:cover;color:#c7c3b9;font-size:12px}
.story-reference figcaption{padding:7px 9px;font-size:12px;line-height:1.4;color:#f3ddc2}
.story-poster{margin:12px 0;padding:10px 14px;border:1px dashed #736453;border-radius:9px;background:#201e1d}
.story-poster.signed{border:2px solid #c99561;background:linear-gradient(152deg,#573827,#251e20 52%);padding:15px}
.story-poster.signed h5{color:#FFE09B;font-size:22px}
.story-poster ul{list-style:none;padding:0;margin:6px 0}
.story-poster li{display:flex;gap:8px;color:#beb7ab;padding:3px 0}
.story-poster .pledged{color:#F2EFE8}
.story-poster .pledged span,.story-done{color:#9FE7B6}
.story-signature{font-style:italic;border-top:1px solid #856850;padding-top:7px;color:#FFE09B}
.story-history{padding:7px 0;border-bottom:1px solid #333742}
.story-history summary{cursor:pointer}
.story-history summary span{margin-inline-start:5px;color:#FFE09B;font-size:12px;white-space:nowrap}
.story-done{font-weight:800}
`;
