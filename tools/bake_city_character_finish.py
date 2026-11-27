"""Bake periodic cloth, skin and hair relief channels with Blender's noise.

blender -b --factory-startup --python-exit-code 1 --python tools/bake_city_character_finish.py
The RGB channels are linear, with 128 as the neutral value.
"""
from math import cos, sin, tau
from pathlib import Path
import struct
import zlib

from mathutils import Vector, noise

SIZE = 256
OUTPUT = Path(__file__).resolve().parents[1] / 'img' / 'city-character-finish.png'


def torus(u, v, scale, seed=0):
    radius = 1.65 + .64 * cos(v*tau)
    point = Vector((radius*cos(u*tau), radius*sin(u*tau), .64*sin(v*tau)))
    return noise.noise_vector(point*(scale/tau) + Vector((seed, 3.7, 1.5)))[0]


def encode(value):
    return round(255*min(1, max(0, .5+value)))


def pixel(u, v):
    broad = torus(u,v,6.0,1.2)
    fuzz = torus(u,v,83.0,7.7)
    warp = cos(tau*(33*u + .35*sin(tau*37*v)))
    weft = cos(tau*(37*v + .35*sin(tau*33*u)))
    cloth = .105*warp + .092*weft + .068*warp*weft + .12*broad + .13*fuzz
    pores = torus(u,v,112.0,13.5)
    skin = .23*pores + .11*torus(u,v,30.0,8.1) + .15*broad
    strands = cos(tau*(39*u + .85*sin(tau*(2*v+u)) + .31*sin(tau*4*v)))
    hair = .15*strands + .12*fuzz + .23*torus(u,v,12.0,3.1)
    return encode(cloth), encode(skin), encode(hair)


def chunk(name, payload):
    return struct.pack('!I',len(payload)) + name + payload + struct.pack('!I',zlib.crc32(name+payload))


raw = bytearray()
for y in range(SIZE):
    raw.append(0)
    for x in range(SIZE):
        raw.extend(pixel((x+.5)/SIZE,(y+.5)/SIZE))
header = struct.pack('!2I5B', SIZE, SIZE, 8, 2, 0, 0, 0)
OUTPUT.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR',header) + chunk(b'IDAT',zlib.compress(raw,9)) + chunk(b'IEND',b''))
print(f'Wrote {OUTPUT.name} ({OUTPUT.stat().st_size} bytes)')
