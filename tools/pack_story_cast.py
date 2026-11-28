"""Package two painted 3x2 portrait atlases and a revised Granite portrait as local WebP."""
from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageOps

SOURCES = (
    (('vint', 'Винт'), ('stencil', 'Трафареты'), ('bolt', 'Шуруп'),
     ('rivet', 'Клёпка'), ('pendulum', 'Маятник')),
    (('wave', 'Волна'), ('chrome', 'Хромированные'), ('forge', 'Литейка'),
     ('stitch', 'Стежок'), ('granite', 'Гранит')),
)


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


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('yard', type=Path)
    parser.add_argument('districts', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--granite', type=Path)
    parser.add_argument('--full-size', type=Path, help='Write square PNG source tiles for the Blender gallery')
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
    if args.full_size:
        args.full_size.mkdir(parents=True, exist_ok=True)
        for key, original in portraits.items():
            original.save(args.full_size / (key + '.png'))


if __name__ == '__main__':
    main()
