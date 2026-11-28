export const STORY_PORTRAIT_CSS = `
.story-portrait{display:grid;justify-items:center;align-content:start;gap:6px;text-align:center;min-width:0}
.story-portrait-frame{display:block;width:var(--portrait-size,96px);max-width:100%;aspect-ratio:1;overflow:hidden;
 border:1px solid #b8966f;border-radius:12px;background:radial-gradient(ellipse at 35% 25%,#514451,#232532 72%);box-sizing:border-box}
.story-portrait-frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 36%}
.story-portrait-frame img[hidden]{display:none}
.story-portrait-name{font-weight:800;line-height:1.16;color:#ffdeaa;overflow-wrap:anywhere}
`;

export function createStoryPortrait(id, name, { showName = true } = {}) {
  const portrait = document.createElement('span');
  portrait.className = 'story-portrait';
  if (/^[a-z]+$/.test(id)) {
    const frame = document.createElement('span');
    frame.className = 'story-portrait-frame';
    const image = new Image(96, 96);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.onerror = () => { image.hidden = true; };
    image.src = new URL(`./img/story-cast/${id}.webp`, import.meta.url);
    frame.append(image);
    portrait.append(frame);
  }
  if (showName) {
    const caption = document.createElement('span');
    caption.className = 'story-portrait-name';
    caption.textContent = name;
    portrait.append(caption);
  }
  return portrait;
}
