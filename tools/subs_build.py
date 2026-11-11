# Subtitles for long lessons (owner 03.11.2026).
#
#  1. Speech → Russian words with times: Whisper large-v3-turbo (word timestamps) ran in the owner's Chrome on his GPU
#     (transformers.js, WebGPU) over the Kinescope HLS audio (or the R2 file's audio); the raw words are in subs/raw/<id>.json  [[from, to, word], …]
#  2. python3 tools/subs_build.py cues  → subs/work/<id>.ru.json: words grouped into readable cues [[from, to, text], …]
#     (Claude then proofreads the Russian and writes the 8 translations into subs/work/<id>.tr.json:
#      {"ru": [...], "en": [...], …} — one line per cue, same order)
#  3. python3 tools/subs_build.py build → subs/<id>.json {ks, cues: [[from, to, {ru, en, …}]]} + subs.js (the app's index)
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['ru', 'en', 'es', 'pt', 'fr', 'de', 'ja', 'ko', 'zh']
MAX_CHARS = 74      # ~2 short lines on a phone
MAX_DUR = 6.0       # seconds on screen at most
GAP = 0.7           # a pause this long starts a new cue
HOLD = 0.6          # keep the text a bit after the last word (if the next cue doesn't start earlier)
MIN_DUR = 1.0
# Whisper invents these in silence / music
JUNK = re.compile(r'(субтитр|продолжение следует|редактор субтитров|корректор|подписывайтесь|dimatorzok|спасибо за просмотр)', re.I)


def lessons():
    s = open(os.path.join(ROOT, 'lessons.js'), encoding='utf-8').read()
    s = s[s.index('window.LESSONS_DATA ='):]
    return {l['id']: l for l in json.loads(s[s.index('['):s.rindex(']') + 1])}


def cues_from_words(words):
    words = [w for w in words if w[2].strip()]
    out, cur = [], []

    def flush():
        if not cur:
            return
        text = ''.join(w[2] for w in cur).strip()
        text = re.sub(r'\s+', ' ', text)
        if text and not JUNK.search(text):
            out.append([cur[0][0], cur[-1][1], text])
        cur.clear()

    for w in words:
        if cur:
            text = ''.join(x[2] for x in cur).strip()
            pause = w[0] - cur[-1][1]
            ends = re.search(r'[.?!…]$', text)
            if (pause >= GAP or len(text) + len(w[2]) > MAX_CHARS or w[1] - cur[0][0] > MAX_DUR
                    or (ends and len(text) >= 18)):
                flush()
        cur.append(w)
    flush()
    # timing: a little hold after the last word, never over the next cue, at least MIN_DUR
    for i, c in enumerate(out):
        nxt = out[i + 1][0] if i + 1 < len(out) else c[1] + 5
        c[1] = min(max(c[1] + HOLD, c[0] + MIN_DUR), nxt - 0.05)
        c[0], c[1] = round(c[0], 2), round(max(c[1], c[0] + 0.3), 2)
    return out


def cmd_cues():
    os.makedirs(os.path.join(ROOT, 'subs', 'work'), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(ROOT, 'subs', 'raw', '*.json'))):
        lid = os.path.basename(f)[:-5]
        cues = cues_from_words(json.load(open(f, encoding='utf-8')))
        json.dump(cues, open(os.path.join(ROOT, 'subs', 'work', lid + '.ru.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        print(lid, len(cues), 'cues')


def cmd_build():
    L = lessons()
    index = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'subs', 'work', '*.tr.json'))):
        lid = os.path.basename(f)[:-8]
        times = json.load(open(os.path.join(ROOT, 'subs', 'work', lid + '.ru.json'), encoding='utf-8'))
        tr = json.load(open(f, encoding='utf-8'))
        langs = [l for l in LANGS if l in tr]
        for l in langs:
            assert len(tr[l]) == len(times), (lid, l, len(tr[l]), len(times))
        # an empty Russian line = a dropped cue (a lone «ну», a merge with the next one)
        cues = [[t[0], t[1], {l: tr[l][i] for l in langs}] for i, t in enumerate(times) if tr['ru'][i].strip()]
        # a word stretched over a pause made some cues hang for 10–20 s: show a line about as long as it takes to read
        for c in cues:
            c[1] = round(min(c[1], c[0] + max(1.6, 1.0 + 0.075 * len(c[2]['ru']))), 2)
        ks = (L.get(lid) or {}).get('ks', '')
        r2 = '' if ks else (L.get(lid) or {}).get('r2', '')  # an R2 lesson: tie the subtitles to its file (a new upload = new name)
        head = {'ks': ks, 'r2': r2} if r2 else {'ks': ks}
        json.dump(dict(head, cues=cues), open(os.path.join(ROOT, 'subs', lid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        index[lid] = dict(head, langs=langs, v=1)
        print(lid, len(cues), 'cues', ','.join(langs))
    with open(os.path.join(ROOT, 'subs.js'), 'w', encoding='utf-8') as o:
        o.write('// Субтитры уроков: id урока → {ks: видео в Kinescope, langs: языки, v: версия}. Тексты — subs/<id>.json.\n')
        o.write('// Делаются через Claude (tools/subs_build.py). Если видео урока заменили (другой ks) — субтитры не показываются.\n')
        o.write('window.LESSON_SUBS = ' + json.dumps(index, ensure_ascii=False, indent=1) + ';\n')


if __name__ == '__main__':
    {'cues': cmd_cues, 'build': cmd_build}[sys.argv[1]]()
