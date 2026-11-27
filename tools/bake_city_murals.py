"""Bake the city mural paint in Blender 4.3.

blender -b -t 6 --factory-startup --python-exit-code 1 \
    --python tools/bake_city_murals.py -- SOURCE_DIR OUTPUT_DIR

SOURCE_DIR contains the individually cropped, front-on paint studies as PNGs,
named after the entries below. Convert the render passes to WebP for img/.
The packed Blender project also includes the front-on camera and source art.
"""
from pathlib import Path
import sys

import bpy

src, out = map(Path, sys.argv[sys.argv.index('--') + 1:])
src, out = src.resolve(), out.resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 2
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

bpy.ops.object.camera_add(location=(0, 0, 5))
camera = scene.camera = bpy.context.object
camera.rotation_euler = (0, 0, 0)
camera.data.type = 'ORTHO'
camera.data.passepartout_alpha = 1


def material(name, brick):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    graph = mat.node_tree
    graph.nodes.clear()

    def node(kind, label):
        n = graph.nodes.new('ShaderNode' + kind)
        n.label = label
        return n

    def set_input(sock, value):
        if isinstance(value, bpy.types.NodeSocket):
            graph.links.new(value, sock)
        else:
            sock.default_value = value

    def operator(operation, a, b, label):
        n = node('Math', label)
        n.operation = operation
        set_input(n.inputs[0], a)
        set_input(n.inputs[1], b)
        return n.outputs[0]

    def noise(vector, scale, detail, label):
        n = node('TexNoise', label)
        set_input(n.inputs['Vector'], vector)
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        return n.outputs['Fac']

    def ramp(value, lower, higher, label):
        n = node('ValToRGB', label)
        set_input(n.inputs['Fac'], value)
        for e, (position, gray) in zip(n.color_ramp.elements, (lower, higher)):
            e.position = position
            e.color = (gray, gray, gray, 1)
        return n.outputs['Color']

    def multiply_color(color, value, strength, label):
        n = node('MixRGB', label)
        n.blend_type = 'MULTIPLY'
        set_input(n.inputs[0], strength)
        set_input(n.inputs[1], color)
        set_input(n.inputs[2], value)
        return n.outputs[0]

    uv = node('TexCoord', 'Wall coordinates').outputs['UV']
    image = node('TexImage', 'Original aerosol study')
    image.image = bpy.data.images.load(str(src / f'{name}.png'))
    image.image.pack()
    image.extension = 'EXTEND'
    set_input(image.inputs['Vector'], uv)
    stretch = node('VectorMath', 'Long rain trails')
    stretch.operation = 'MULTIPLY'
    set_input(stretch.inputs[0], uv)
    set_input(stretch.inputs[1], (6.0, .5, 1.0))
    rain = noise(stretch.outputs['Vector'], 17, 2, 'Aged paint film')
    pores = noise(uv, 240, 2, 'Dry overspray and open pores')
    tone = multiply_color(image.outputs['Color'], ramp(rain, (.22, .32), (.67, 1), 'Sparse oxide and wash'), .34, 'Wall-sized weathering')
    tone = multiply_color(tone, ramp(pores, (.28, .18), (.56, 1), 'Pigment in the grain'), .28, 'Porous concrete under spray')
    emission = node('Emission', 'Export base color without lighting')
    set_input(emission.inputs[0], tone)
    surface = emission.outputs[0]
    if brick:
        # Let the actual scene's brickwork show through the pores and soft outer spray.
        axes = node('SeparateXYZ', 'Distance to paint boundary')
        set_input(axes.inputs[0], uv)
        u, v = axes.outputs[:2]
        edge_x = operator('MINIMUM', u, operator('SUBTRACT', 1, u, 'Right edge'), 'Vertical edges')
        edge_y = operator('MINIMUM', v, operator('SUBTRACT', 1, v, 'Top edge'), 'Horizontal edges')
        edge = operator('MINIMUM', edge_x, edge_y, 'Nearest edge')
        opacity = ramp(edge, (0, 0), (.022, .96), 'Soft paint boundary')
        coverage = ramp(pores, (.17, .62), (.40, 1), 'Gaps in the spray')
        opacity = operator('MULTIPLY', opacity, coverage, 'Paint coverage')
        blend = node('MixShader', 'Paint over scene masonry')
        set_input(blend.inputs[0], opacity)
        set_input(blend.inputs[1], node('BsdfTransparent', 'Exposed brick').outputs[0])
        set_input(blend.inputs[2], surface)
        surface = blend.outputs[0]
    set_input(node('OutputMaterial', 'Diffuse paint bake').inputs['Surface'], surface)
    # Keep the editable material network readable in the packed project.
    for i, n in enumerate(graph.nodes):
        n.location = (i % 6 * 220, -(i // 6) * 300)
    return mat


def plate(name, width, height, center, brick=False):
    mesh = bpy.data.meshes.new(name)
    w, h = width / 2, height / 2
    mesh.from_pydata([(-w, -h, 0), (w, -h, 0), (w, h, 0), (-w, h, 0)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new()
    for loop, coord in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = coord
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    ob.location = center
    ob.data.materials.append(material(name, brick))
    return ob


def bake(name, w, h, tiles, brick=False):
    columns = 1 if brick else 2
    height = h / w
    swatches = []
    for i, tile in enumerate(tiles):
        swatches.append(plate(tile, 1, height, (i % columns - (columns - 1) / 2,
                              ((columns - 1) / 2 - i // columns) * height, 0), brick))
    camera.data.ortho_scale = columns
    scene.render.resolution_x = w * columns
    scene.render.resolution_y = h * columns
    scene.render.image_settings.color_mode = 'RGBA' if brick else 'RGB'
    scene.render.filepath = str(out / f'graffiti-{name}.png')
    bpy.ops.render.render(write_still=True)
    for ob in swatches:
        ob.hide_render = True
        ob.location.y -= 2 * len(baked)
    baked.extend(swatches)


baked = []
for district, names in (
    ('yard', ('rusty', 'acid', 'owls', 'gold')),
    ('center', ('stencil', 'turn', 'chrome')),
    ('park', ('funk', 'roots', 'wave')),
    ('prom', ('rebar', 'volt', 'forge')),
):
    bake(district, 1024, 624, names)
bake('fedoskin', 1320, 402, ('fedoskin',), True)
bake('cypher', 864, 372, ('cypher',), True)
for ob in baked:
    ob.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'city-murals.blend'), compress=True)
