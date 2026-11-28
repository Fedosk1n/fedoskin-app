"""Render the painted festival cast as a gallery of illuminated cards in Blender.

blender -b -t 2 --python tools/render_story_cast_reference.py -- img/story-cast /tmp/cast-gallery.png
Each input is a square PNG or WebP portrait named after its festival cast key.
"""
from pathlib import Path
import sys

import bpy
from mathutils import Vector

SOURCES = (
    (('vint', 'Винт'), ('stencil', 'Трафареты'), ('bolt', 'Шуруп'),
     ('rivet', 'Клёпка'), ('pendulum', 'Маятник')),
    (('wave', 'Волна'), ('chrome', 'Хромированные'), ('forge', 'Литейка'),
     ('stitch', 'Стежок'), ('granite', 'Гранит')),
)


def principled(name, color, roughness):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return material


def emissive(name, color=None, image=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeEmission')
    material.node_tree.links.new(shader.outputs[0], output.inputs['Surface'])
    if image:
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = bpy.data.images.load(str(image), check_existing=True)
        material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Color'])
    else:
        shader.inputs['Color'].default_value = (*color, 1)
    return material


def rectangle(name, x, y, z, width, height, material):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z))
    plane = bpy.context.object
    plane.name = name
    plane.scale = (width, height, 1)
    plane.data.materials.append(material)


def slab(name, x, y, width, height, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, .035))
    card = bpy.context.object
    card.name = name
    card.dimensions = (width, height, .08)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = card.modifiers.new('Soft corners', 'BEVEL')
    bevel.segments = 4
    bevel.width = .016
    card.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    card.data.materials.append(material)


def caption(value, x, y, size, material, font):
    bpy.ops.object.text_add(location=(x, y, .102))
    obj = bpy.context.object
    obj.name = value
    obj.data.body = value
    obj.data.font = font
    obj.data.align_x = 'CENTER'
    obj.data.align_y = 'CENTER'
    obj.data.size = size
    obj.data.materials.append(material)


def light(name, position, target, color, energy, size):
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.name = name
    lamp.rotation_euler = (Vector(target) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    lamp.data.color = color
    lamp.data.energy = energy
    lamp.data.shape = 'DISK'
    lamp.data.size = size


def render(input_dir, output):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bg = principled('Blue slate gallery wall', (.025, .037, .057), .78)
    frame = principled('Brushed indigo card frame', (.067, .087, .125), .5)
    legend = emissive('Warm paper ink', (.87, .78, .65))
    heading = emissive('Parchment title', (.97, .89, .76))
    line = emissive('Quiet amber rule', (.43, .24, .11))
    font = bpy.data.fonts.load('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
    rectangle('Gallery wall', 0, 0, -.1, 8, 5, bg)
    caption('Лица фестиваля', 0, 1.37, .18, heading, font)
    rectangle('Title rule', 0, 1.235, .1, 5.15, .006, line)

    for row, names in enumerate(SOURCES):
        y = .67 - row * 1.255
        for col, (key, title) in enumerate(names):
            x = (col - 2) * 1.078
            source = input_dir / (key + '.png')
            if not source.is_file():
                source = input_dir / (key + '.webp')
            slab(title + ' frame', x, y - .075, .995, 1.12, frame)
            rectangle(title + ' painted portrait', x, y, .083, .942, .942, emissive(key, image=source))
            caption(title, x, y - .525, .085, legend, font)

    light('Warm gallery sidelight', (-2.7, 1.4, 2.5), (-.6, 0, 0), (1, .64, .38), 109, 4.2)
    light('Cool floor spill', (2.4, -1.6, 1.7), (1, -.5, 0), (.32, .53, 1), 85, 3.2)
    bpy.ops.object.camera_add(location=(0, 0, 5), rotation=(0, 0, 0))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 5.72
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 2
    scene.view_settings.view_transform = 'Standard'
    scene.world.color = (.1, .1, .1)
    scene.render.resolution_x = 1880
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    render(Path(args[0]).resolve(), Path(args[1]).resolve())
