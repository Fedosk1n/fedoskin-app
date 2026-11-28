"""Exercise the real power-trace module through Chromium touch events.

From the repo root, run `python -m http.server 8844` in one terminal.
In another, run `python tools/test_city_mat.py http://127.0.0.1:8844`.
Install Playwright and its Chromium first, or set CHROMIUM=/usr/bin/chromium.
The harness uses the live Canvas and mocap, without the city's WebGL renderer.
"""

from urllib.request import urlopen
import math
import re
import os
import sys
from playwright.sync_api import sync_playwright
base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8844').rstrip('/')
ids = {
    'SWIPES': 'Breakdance_Swipes',
    'HEADSPIN': 'Head_Spinning',
    'BACKSPIN': 'City_Backspin',
    'FLARE': 'Flair',
    '1990': 'Breakdance_1990',
}
HTML="""<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{background:#45434a}</style>
<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js?v=2","three/addons/":"/vendor/three/addons/"}}</script><script src="/hero.js"></script>
<script type="module">
import * as THREE from 'three';
import {loadMocap,mocapPerson} from '/city3d-mocap.js?v={mocap}';
import {initPower} from '/city3d-power.js?v={power}';
await loadMocap();
const {innerWidth:w,innerHeight:h}=window, cam=new THREE.PerspectiveCamera(46,w/h,.06,120), W={camT:{x:0,z:0,zoom:.34}};
cam.position.set(0, 5.27,2.78);cam.lookAt(0,0,.25);cam.updateMatrixWorld();
const J=mocapPerson(HERO.topDown(1, []));
const PM=initPower({W,camera:cam});
let result, strokes=0, clears=0, tint=0;
const ctx=document.querySelector('#g3pm').getContext('2d');
for(const k of ['stroke','clearRect','createRadialGradient']) {
 const real=ctx[k];
 ctx[k]=function(...p){if(k==='stroke')strokes++;else if(k==='clearRect')clears++;else tint++;return real.apply(this,p);};
}
function step(n=1){for(let i=0;i<n;i++){PM.tick(1/60);J.tick(1/60);PM.post(1/60);}}
window.heat={reset(){PM.cancel();result=null;},step,probe:()=>PM._probe(),result:()=>result,
 can:PM.can,
 start(name,nm,practice,wait=Infinity){
  J.play(name,{fade:0});J.tick(0);
  if(!PM.arm(J,{c:name,nm},{required:practice,practice,wait,onEnd:r=>result=r}))throw Error(name);
  for(let i=0;PM.state()==='arm'&&i<260;i++)step();
  if(PM.state()!=='hold')throw Error('Did not enter hold');
 },
 sample(n){strokes=clears=tint=0;for(let i=0;i<n;i++)PM.post(1/60);return {strokes,clears,tint};}
};
</script>"""
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM'), args=['--no-sandbox'])
    context = browser.new_context(
        viewport={'width':393,'height':697}, device_scale_factor=3, has_touch=True, is_mobile=True,
    )
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    game = urlopen(base + '/city3d-game.js', timeout=15).read().decode()
    power_version = re.search(r'city3d-power\.js\?v=(\d+)', game).group(1)
    mocap_version = re.search(r'city3d-mocap\.js\?v=(\d+)', game).group(1)
    body = HTML.replace('{power}', power_version).replace('{mocap}', mocap_version)
    page.route('**/__training-gesture', lambda route: route.fulfill(content_type='text/html', body=body))
    page.goto(base + '/__training-gesture', wait_until='domcontentloaded')
    page.wait_for_function('!!window.heat')
    touch = context.new_cdp_session(page)

    def dispatch(event, point=None):
        points = [] if point is None else [{'x':point[0], 'y':point[1], 'id':0}]
        touch.send('Input.dispatchTouchEvent', {'type':event, 'touchPoints':points})

    def trace(move, action='exact', practice=True):
        page.evaluate('heat.reset()')
        page.evaluate('([clip,move,practice])=>heat.start(clip,move,practice)', [ids[move], move, practice])
        guide = page.evaluate('heat.probe()')
        assert guide['maxTurns'] == (1 if practice else 10)
        if practice:
            assert not any(page.evaluate('heat.sample(24)').values())
        whole = list(zip(guide['pts'][::2], guide['pts'][1::2]))
        points = whole if practice else whole[:math.floor((len(whole) - 1)/10) + 4]
        first = points[0]

        if action == 'exact':
            samples = points[2::2] + [points[-1]]
        elif action == 'tap':
            samples = []
        elif action == 'cut':
            samples = [points[len(points)//2], points[-1]]
        elif action == 'circle':
            cx, cy = guide['cx'], guide['cy']
            angle = math.atan2(first[1] - cy, first[0] - cx)
            direction = 1 if (math.atan2(points[4][1] - cy, points[4][0] - cx) - angle) % math.tau < math.pi else -1
            radius = math.hypot(first[0] - cx, first[1] - cy)
            angles = [angle + step * math.tau * direction / 50 for step in range(1, 51)]
            samples = [(cx + radius*math.cos(theta), cy + radius*math.sin(theta)) for theta in angles]
        elif action == 'reverse':
            samples = points[:0:-2]
        elif action == 'cancel':
            samples = points[2:12:2]
        else:
            raise ValueError(action)

        dispatch('touchStart', first)
        for point in samples:
            dispatch('touchMove', point)
            page.evaluate('heat.step()')
        dispatch('touchCancel' if action == 'cancel' else 'touchEnd')
        page.evaluate('heat.step(160)')
        result = page.evaluate('heat.result()')
        assert result, (move, action, practice)
        return result

    assert not page.evaluate('heat.can("City_Backspin")')
    assert page.evaluate('heat.can("City_Backspin",true)')
    for move in ids:
        result = trace(move)
        assert result['grade'] == 'perfect' and result['turns'] == 1 and result['cover'] == 1, (move, result)
    for move, action in [
        ('SWIPES', 'tap'), ('SWIPES', 'cut'), ('HEADSPIN', 'reverse'), ('BACKSPIN', 'cancel'),
        ('FLARE', 'circle'), ('1990', 'circle'),
    ]:
        result = trace(move, action)
        assert result['grade'] == 'miss' and result['turns'] == 0, (move, action, result)

    for move in ('SWIPES', 'HEADSPIN', 'FLARE', '1990'):
        result = trace(move, practice=False)
        assert result['grade'] == 'perfect' and result['turns'] == 1, (move, result)

    page.evaluate('heat.reset(); heat.start("Breakdance_Swipes","SWIPES",false,.1); heat.step(10)')
    assert page.evaluate('heat.result().grade') == 'auto'
    assert not errors, errors
    print('Five mat contours, invalid touches, four combat traces, automatic battle fallback and idle Canvas passed')
    browser.close()
