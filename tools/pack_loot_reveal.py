"""Pack Blender's 36 case frames and the original, quiet two-latch sound for the web."""
import argparse
from pathlib import Path
import math
import random
import struct
import wave

from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('frames', type=Path)
parser.add_argument('--stills', type=Path)
args = parser.parse_args()
frames = [Image.open(args.frames / f'case-{i:04}.png').convert('RGB') for i in range(36)]
w, h = frames[0].size
assert all(image.size == (400, 272) for image in frames)
strip = Image.new('RGB', (w * 6, h * 6))
for index, image in enumerate(frames):
    strip.paste(image, ((index % 6) * w, (index // 6) * h))
strip.save(root / 'img/loot-reveal-frames.webp', quality=79, method=6)
for index, name in [(0, 'closed'), (-1, 'open')]:
    image = Image.open(args.stills / f'{name}.png').convert('RGB') if args.stills else frames[index]
    image.thumbnail((680, 462), Image.Resampling.LANCZOS)
    image.save(root / f'img/loot-reveal-{name}.webp', quality=86, method=6)

# Two thumb-lever transients and the muted return of each mechanical spring.
rate = 16000
rng = random.Random(726)
output = []
for i in range(int(rate * .31)):
    t = i / rate
    sample = 0
    for at, pitch, volume in [(.070, .96, .24), (.105, 1.13, .21), (.174, 1.1, .12), (.211, .96, .10)]:
        age = t - at
        if age < 0:
            continue
        attack = min(1, age * 2000)
        noise = rng.uniform(-1,1) * .38 + .48 * math.sin(2*math.pi*1030*pitch*age) + .14 * math.sin(2*math.pi*2570*pitch*age)
        sample += noise * attack * math.exp(-age*146) * volume
    output.append(round(32760 * sample))
(root / 'audio').mkdir(exist_ok=True)
with wave.open(str(root / 'audio/loot-reveal-latch.wav'), 'wb') as audio:
    audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
    audio.writeframes(struct.pack('<'+'h'*len(output), *output))
