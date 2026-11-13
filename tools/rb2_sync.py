# Copies the rules block of the rhythm battle (tools/rb2.js) into rhythm.js and server/push-worker.js, so the phone and the
# server always count a round the same way. Run from the repo root after any change of tools/rb2.js: python3 tools/rb2_sync.py
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'tools' / 'rb2.js').read_text(encoding='utf-8').strip('\n')
assert src.startswith('// <RB2>') and src.endswith('// </RB2>')
rx = re.compile(r'[ \t]*// <RB2>.*?// </RB2>', re.S)
for name, pad in (('rhythm.js', '  '), ('server/push-worker.js', '')):
    p = root / name
    s = p.read_text(encoding='utf-8')
    block = '\n'.join((pad + l) if l else l for l in src.split('\n'))
    assert len(rx.findall(s)) == 1, name + ': the // <RB2> … // </RB2> block must be there exactly once'
    out = rx.sub(lambda m: block, s)
    if out != s:
        p.write_text(out, encoding='utf-8')
        print('updated', name)
    else:
        print('same', name)
