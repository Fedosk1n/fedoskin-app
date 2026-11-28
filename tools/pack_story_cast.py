"""Package two painted 3x2 portrait atlases and a revised Granite portrait as local WebP."""
from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

SOURCES = (
    (('vint', 'Винт'), ('stencil', 'Трафареты'), ('bolt', 'Шуруп'),
     ('rivet', 'Клёпка'), ('pendulum', 'Маятник')),
    (('wave', 'Волна'), ('chrome', 'Хромированные'), ('forge', 'Литейка'),
     ('stitch', 'Стежок'), ('granite', 'Гранит')),
)
FONT_ROOT = Path('/usr/share/fonts/truetype/dejavu')


def atlas_portraits(path, names):
    with Image.open(path) as atlas:
        width, height = atlas.size
        assert width % 3 == 0 and height % 2 == 0 and width // 3 == height // 2, atlas.size
        cell = width // 3
        return {
            key: atlas.crop((index % 3 * cell + 1, index // 3 * cell + 1,
                             (index % 3 + 1) * cell - 1, (index // 3 + 1) * cell - 1)).convert('RGB')
            for index, (key, _) in enumerate(names)
        }


def reference_sheet(portraits, path, font_root):
    tile, space, margin, caption = 332, 17, 27, 56
    height = (tile + caption) * 2 + space + margin * 2
    width = tile * 5 + space * 4 + margin * 2
    sheet = Image.new('RGB', (width, height), '#131A25')
    draw = ImageDraw.Draw(sheet)
    face = ImageFont.truetype(str(font_root / 'DejaVuSans-Bold.ttf'), 27)
    for row, names in enumerate(SOURCES):
        for col, (key, name) in enumerate(names):
            x = margin + col * (tile + space)
            y = margin + row * (tile + caption + space)
            sheet.paste(ImageOps.fit(portraits[key], (tile, tile), Image.Resampling.LANCZOS), (x, y))
            draw.text((x + tile / 2, y + tile + caption / 2), name, font=face, fill='#F5E7D4', anchor='mm')
    sheet.save(path, format='WEBP', quality=87, method=6)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('yard', type=Path)
    parser.add_argument('districts', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--granite', type=Path)
    parser.add_argument('--fonts', type=Path, default=FONT_ROOT)
    args = parser.parse_args()

    portraits = atlas_portraits(args.yard, SOURCES[0])
    portraits.update(atlas_portraits(args.districts, SOURCES[1]))
    if args.granite:
        with Image.open(args.granite) as image:
            assert image.width == image.height, image.size
            portraits['granite'] = image.convert('RGB')
    args.output.mkdir(parents=True, exist_ok=True)
    for key, original in portraits.items():
        image = ImageOps.fit(original, (320, 320), Image.Resampling.LANCZOS)
        image.save(args.output / (key + '.webp'), format='WEBP', quality=83, method=6)
    reference_sheet(portraits, args.output / 'reference.webp', args.fonts)


if __name__ == '__main__':
    main()
