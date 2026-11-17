# Mixamo binary FBX -> packed clip like anim/bboy.json (22 bones, 30 fps, quats x1000, hips cm with xz minus frame 0).
# Same maths as three.js FBXLoader (euler order 0 -> 'ZYX', pre-rotation premultiplied) — checked against tools/mocap/drop.html.
import struct, zlib, sys, json, math
def parse(path):
    b = open(path, 'rb').read(); ver = struct.unpack_from('<I', b, 23)[0]; big = ver >= 7500
    def prop(o):
        t = chr(b[o]); o += 1
        if t in 'YCIFDL':
            f = {'Y': '<h', 'C': '<?', 'I': '<i', 'F': '<f', 'D': '<d', 'L': '<q'}[t]; return struct.unpack_from(f, b, o)[0], o + struct.calcsize(f)
        if t in 'fdlib':
            n, enc, cl = struct.unpack_from('<III', b, o); o += 12; raw = b[o:o + cl]; o += cl
            if enc: raw = zlib.decompress(raw)
            f = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': '?'}[t]; return list(struct.unpack('<%d%s' % (n, f), raw)), o
        if t in 'SR':
            n = struct.unpack_from('<I', b, o)[0]; o += 4; v = b[o:o + n]; return (v.decode('utf-8', 'replace') if t == 'S' else v), o + n
        raise ValueError(t)
    def node(o):
        if big: end, np_, pl = struct.unpack_from('<QQQ', b, o); o += 24
        else: end, np_, pl = struct.unpack_from('<III', b, o); o += 12
        if end == 0: return None, o
        nl = b[o]; o += 1; name = b[o:o + nl].decode(); o += nl; props = []
        for _ in range(np_): v, o = prop(o); props.append(v)
        kids = []
        while o < end:
            k, o2 = node(o)
            if k is None: o = o2; break
            kids.append(k); o = o2
        return {'n': name, 'p': props, 'c': kids}, end
    o = 27; top = []
    while o < len(b) - 13:
        k, o = node(o)
        if k is None: break
        top.append(k)
    return top
def P70(nd):
    out = {}
    for c in nd['c']:
        if c['n'] == 'Properties70':
            for p in c['c']: out[p['p'][0]] = p['p'][4:]
    return out
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)
def eulerZYX(x, y, z):  # three.js Euler(x, y, z, 'ZYX') -> quaternion
    x, y, z = map(math.radians, (x, y, z)); c1, c2, c3 = math.cos(x / 2), math.cos(y / 2), math.cos(z / 2); s1, s2, s3 = math.sin(x / 2), math.sin(y / 2), math.sin(z / 2)
    return (s1 * c2 * c3 - c1 * s2 * s3, c1 * s2 * c3 + s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3)
KEEP = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
ORDER = ['Hips.p', 'Hips.q', 'Spine.q', 'Spine1.q', 'Spine2.q', 'Neck.q', 'Head.q', 'RightShoulder.q', 'RightArm.q', 'RightForeArm.q', 'RightHand.q', 'LeftShoulder.q', 'LeftArm.q', 'LeftForeArm.q', 'LeftHand.q', 'RightUpLeg.q', 'RightLeg.q', 'RightFoot.q', 'RightToeBase.q', 'LeftUpLeg.q', 'LeftLeg.q', 'LeftFoot.q', 'LeftToeBase.q']
TS = 46186158000
def convert(path, fps=30):
    top = parse(path); objs = next(n for n in top if n['n'] == 'Objects'); conns = next(n for n in top if n['n'] == 'Connections')
    models, cnodes, curves = {}, {}, {}
    for c in objs['c']:
        if c['n'] == 'Model' and c['p'][2] == 'LimbNode': models[c['p'][0]] = (c['p'][1].split('\x00')[0].replace('mixamorig:', ''), P70(c))
        elif c['n'] == 'AnimationCurveNode': cnodes[c['p'][0]] = {'attr': c['p'][1].split('\x00')[0], 'curves': {}, 'model': None, 'prop': None, 'def': P70(c)}
        elif c['n'] == 'AnimationCurve':
            d = {k['n']: k['p'][0] for k in c['c']}; curves[c['p'][0]] = (d['KeyTime'], d['KeyValueFloat'])
    for c in conns['c']:
        if c['p'][0] != 'OP': continue
        src, dst, pr = c['p'][1], c['p'][2], c['p'][3]
        if src in curves and dst in cnodes: cnodes[dst]['curves'][pr.replace('d|', '')] = curves[src]
        elif src in cnodes and dst in models: cnodes[src]['model'] = dst; cnodes[src]['prop'] = pr
    dur = max(max(t) for t, _ in curves.values()) / TS; n = max(2, round(dur * fps) + 1)
    def sample(cv, t):  # linear between keys
        ts, vs = cv; tt = t * TS
        if tt <= ts[0]: return vs[0]
        for i in range(1, len(ts)):
            if tt <= ts[i]: k = (tt - ts[i - 1]) / (ts[i] - ts[i - 1]); return vs[i - 1] + (vs[i] - vs[i - 1]) * k
        return vs[-1]
    rest, t = {}, {}
    for mid, (name, pp) in models.items():
        if name not in KEEP: continue
        pre = eulerZYX(*pp['PreRotation'][:3]) if 'PreRotation' in pp else None
        lt = pp.get('Lcl Translation', [0, 0, 0]); lr = pp.get('Lcl Rotation', [0, 0, 0]); q = eulerZYX(*lr[:3]); q = qmul(pre, q) if pre else q
        rest[name] = {'pos': [round(v / 100, 4) for v in lt[:3]], 'q': [round(v, 4) for v in q]}
        for cn in cnodes.values():
            if cn['model'] != mid: continue
            ax = [cn['curves'].get(a) for a in 'XYZ']; dv = cn['def']; d0 = [dv.get('d|' + a, [0])[0] for a in 'XYZ']
            val = lambda i, tm: sample(ax[i], tm) if ax[i] else d0[i]
            if cn['prop'] == 'Lcl Rotation':
                out = []
                for f in range(n):
                    tm = min(dur, f / fps); qq = eulerZYX(val(0, tm), val(1, tm), val(2, tm)); qq = qmul(pre, qq) if pre else qq
                    if out and sum(a * b for a, b in zip(qq, out[-1])) < 0: qq = tuple(-v for v in qq)   # keep quaternions on one side (no flips)
                    out.append(qq)
                t[name + '.q'] = [round(v * 1000) for qq in out for v in qq]
            elif cn['prop'] == 'Lcl Translation' and name == 'Hips':
                t['Hips.p'] = [round(val(i, min(dur, f / fps))) for f in range(n) for i in range(3)]
    p = t['Hips.p']; x0, z0 = p[0], p[2]
    for i in range(n): p[i * 3] -= x0; p[i * 3 + 2] -= z0
    return {'n': n, 'fps': fps, 't': {k: t[k] for k in ORDER if k in t}}, rest
if __name__ == '__main__':
    for f in sys.argv[1:]:
        c, r = convert(f); print(f, c['n'], len(c['t']), c['t']['Hips.p'][:6], c['t']['Hips.p'][-3:], r['Hips'], r['LeftUpLeg'], r['LeftFoot'])
