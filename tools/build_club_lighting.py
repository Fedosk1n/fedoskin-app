"""Build Club wall-mounted lights, PA and service equipment, then render two views.

blender -b -t 6 --python tools/build_club_lighting.py -- --out /tmp/club-lighting
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=Path('/tmp/club-lighting'))
parser.add_argument('--skip-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.out.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene


def pos(point):
    x, y, z = point
    return (x, -z, y)


def rgb(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels]


def finish(name, color, metallic=0, roughness=.75, emission=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*rgb(color), 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = material.diffuse_color
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Emission Color'].default_value = material.diffuse_color
    shader.inputs['Emission Strength'].default_value = emission
    return material


def empty(name, at, parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = pos(at)
    return obj


def block(name, at, size, material, parent=None, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = pos(at)
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        rounded = obj.modifiers.new('Rounded edges', 'BEVEL')
        rounded.width = bevel
        rounded.segments = 1
        obj.modifiers.new('Weighted corners', 'WEIGHTED_NORMAL')
    obj.data.materials.append(material)
    return obj


def tube(name, at, r1, r2, depth, material, parent=None, direction=(0, 0, 1), sides=16):
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r1, radius2=r2, depth=depth)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = pos(at)
    obj.rotation_euler = Vector(pos(direction)).to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return obj


def line(name, points, radius, material, parent=None):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 3
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, point in zip(spline.bezier_points, points):
        bp.co = pos(point)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(material)
    return obj


housing = finish('Graphite powder coat', '#25292c', .15)
steel = finish('Brushed brackets and case hardware', '#777a73', .44, .50)
inset = finish('Acoustic cloth, cables and lens recess', '#16191d', 0, .94)
warm = finish('Frosted key LED lens', '#f1d8ad', .05, .40, .76)
aqua = finish('Frosted DJ wash lens', '#80bcb7', .05, .43, .56)
amber = finish('Faded ochre service label', '#967041', .05)

fixtures = {
    'key-west': ((-3.53, 2.56, -8.31), (-.44, .62, -1.40), False),
    'key-east': ((3.53, 2.57, -8.31), (.85, .83, -3.44), False),
    'dj-wash': ((8.73, 2.15, -4.95), (6.15, .68, -5.52), True),
}

rig = empty('Club installed equipment', (0, 0, 0))


def fixture(name, pivot, aim, sidewall):
    mount = empty(name + ' wall mount', pivot, rig)
    if sidewall:
        mount.rotation_euler.z = -math.pi / 2
    block('Masonry backplate', (0, .045, -.338), (.32, .39, .056), steel, mount, .019)
    block('Cantilever arm', (0, .14, -.145), (.12, .105, .39), housing, mount)
    for x in [-.114, .114]:
        for y in [-.083, .173]:
            tube('Anchor bolt', (x, y, -.30), .023, .018, .025, inset, mount, sides=6)
    block('Adjustable yoke crossbar', (0, .161, -.025), (.50, .064, .087), steel, mount)
    for sign in [-1, 1]:
        block('Yoke leg', (sign * .223, .064, -.025), (.048, .217, .088), steel, mount)
        tube('Pivot clamp', (sign * .264, -.016, -.025), .051, .045, .054, housing, mount, (sign, 0, 0), 10)

    head = empty(name + ' adjustable head', pivot, rig)
    normal = Vector(pos(aim)) - Vector(pos(pivot))
    head.rotation_euler = normal.to_track_quat('-Y', 'Z').to_euler()
    glass = aqua if sidewall else warm
    tube('Cast finned LED housing', (0, 0, .015), .155, .212, .29, housing, head, sides=20)
    for z, r in [(-.091, .168), (-.043, .183), (.012, .195)]:
        tube('Cooling fin', (0, 0, z), r, r, .019, housing, head)
    tube('Shallow rim', (0, 0, .169), .215, .218, .074, steel, head, sides=20)
    tube('Black lens gasket', (0, 0, .207), .175, .172, .013, inset, head, sides=20)
    tube('Frosted optical lens', (0, 0, .216), .146, .152, .012, glass, head, sides=20)
    empty(name + '-lens', (0, 0, .227), head)
    empty(name + '-aim', aim, rig)
    line('Power tail with drip loop', [(0, -.10, -.12), (0, -.24, -.19), (0, -.29, -.28),
                                      (0, -.21, -.335), (0, .38, -.337)], .015, inset, mount)


for name, (pivot, aim, is_sidewall) in fixtures.items():
    fixture(name, pivot, aim, is_sidewall)

for sign in [-1, 1]:
    x = sign * 6.02
    mount = empty('PA wall mount', (x, 1.96, -8.35), rig)
    block('PA masonry plate', (0, 0, -.325), (.52, .68, .073), steel, mount)
    for side in [-1, 1]:
        block('Speaker bracket flange', (side * .23, -.47, -.115), (.065, .094, .44), steel, mount)
    box = empty('PA cabinet', (x, 1.94, -8.30), rig)
    box.rotation_euler.z = sign * .24
    block('Moulded sealed PA cabinet', (0, 0, .042), (.71, .91, .40), housing, box, .05)
    block('Felt grille surround', (0, 0, .252), (.62, .80, .042), inset, box, .027)
    for y, r in [(.208, .115), (-.135, .231)]:
        tube('Driver rolled surround', (0, y, .279), r, r, .025, steel, box)
        tube('Recessed black driver', (0, y, .294), r*.93, r*.83, .012, inset, box)
        tube('Dust cap', (0, y, .303), r*.34, r*.25, .014, housing, box)
    for y in [-.359, -.300, -.240, -.180, -.120, -.060, .0, .060, .120, .180, .240, .300, .359]:
        block('Slotted PA grille', (0, y, .320), (.578, .014, .019), housing, box, 0)
    block('PA model tag', (0, -.371, .331), (.10, .026, .010), steel, box, .004)
    line('Secured speaker lead', [(x, 2.36, -8.55), (x, 2.48, -8.60), (x + sign*.09, 2.66, -8.62),
                                (x + sign*.09, 3.36, -8.63)], .018, inset, rig)

line('Back wall cable conduit', [(-6.35, 3.25, -8.607), (0, 3.25, -8.607), (6.35, 3.25, -8.607)], .019, inset, rig)
for x in [-6.0, -4.1, -2.07, 0, 2.07, 4.1, 6.0]:
    block('Cable saddle', (x, 3.25, -8.607), (.040, .083, .045), steel, rig, .006)
for x in [-3.53, 3.53]:
    line('Cable to key', [(x, 2.87, -8.648), (x, 3.16, -8.625), (x + .09, 3.25, -8.606)], .014, inset, rig)
line('Sidewall secured lead', [(9.049, 2.46, -4.95), (9.064, 2.55, -5.23), (9.064, 2.53, -6.53),
                              (9.064, 2.51, -8.28)], .018, inset, rig)
for z in [-5.48, -6.26, -7.10, -8.03]:
    block('Sidewall cable saddle', (9.064, 2.52, z), (.035, .071, .043), steel, rig, .006)

# The case sits behind the booth, where cables are serviced, away from the approach.
case = empty('Service case footprint', (7.52, 0, -6.62), rig)
block('Scuffed plywood flight case', (0, .258, 0), (.80, .449, .49), housing, case, .031)
block('Flight case lid', (0, .491, 0), (.815, .103, .50), housing, case, .023)
for y in [.054, .417, .530]:
    for z in [-.242, .242]:
        block('Extruded lid rail', (0, y, z), (.79, .026, .032), steel, case)
    for x in [-.392, .392]:
        block('Extruded end rail', (x, y, 0), (.028, .029, .49), steel, case)
for x in [-.35, .35]:
    block('Recessed latch plate', (x*.72, .395, .261), (.118, .117, .027), steel, case, .012)
    block('Butterfly grip', (x*.72, .409, .279), (.055, .042, .017), inset, case, .010)
    for z in [-.214, .214]:
        block('Rubber foot', (x, .022, z), (.067, .044, .075), inset, case, .006)
block('Recessed carry handle', (0, .267, .256), (.212, .096, .026), steel, case, .017)
block('Handle well', (0, .265, .274), (.173, .065, .015), inset, case, .010)
block('Carry grip', (0, .266, .282), (.123, .021, .025), steel, case, .009)
block('Faded inventory stripe', (-.122, .145, .257), (.115, .035, .007), amber, case, .003)

# The six shared finishes are six draw primitives for the entire visible installation.
geometry = [obj for obj in rig.children_recursive if obj.type in ('MESH', 'CURVE')]
bpy.ops.object.select_all(action='DESELECT')
for obj in geometry:
    obj.select_set(True)
bpy.context.view_layer.objects.active = geometry[0]
bpy.ops.object.convert(target='MESH')
geo = list(bpy.context.selected_objects)
bpy.ops.object.join()
install = bpy.context.object
install.name = 'Club acoustic and lighting installation'
matrix = install.matrix_world.copy()
install.parent = rig
install.matrix_world = matrix
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'anim/club-lighting.glb'), export_texcoords=False, export_yup=True,
                          export_normals=True, export_extras=True)
if args.skip_render:
    sys.exit(0)

brick = finish('Reference painted blue-black brick', '#374247')
seam = finish('Reference mortar', '#232b31')
concrete = finish('Reference terrazzo', '#33383b')
oak = finish('Reference dance floor oak', '#a46b38', .04, .58)
dust = finish('Reference old floor seams', '#6e482e')
rust = finish('Reference booth timber', '#644635')
paper = finish('Reference stencil', '#dca774')
block('Terrazzo slab', (0, -.115, -.55), (20, .22, 19), concrete)
block('Rear mortar', (0, 1.86, -8.86), (19.2, 3.72, .36), seam)
for row in range(13):
    for k in range(-14, 14):
        block('Exposed dark painted brick', (.68 * (k + (row % 2) * .5), .137 + row*.283, -8.671),
              (.663, .267, .028), brick, bevel=.005)
block('Side masonry', (9.27, 1.3, -.3), (.39, 2.6, 17.1), brick)
tube('Oak dance floor', (0, .008, -2.4), 3.85, 3.85, .023, oak, direction=(0, 1, 0), sides=88)
for i in range(-15, 16):
    z = i * .245
    block('Parquet seam', (0, .022, -2.4 + z), (2 * math.sqrt(3.82 ** 2 - z ** 2), .004, .009), dust, bevel=0)
block('Club score frame', (0, 2.38, -8.55), (5.54, 1.06, .18), steel)
block('Club score screen', (0, 2.38, -8.438), (5.31, .85, .065), inset)
for x in [-1.21, -.81, -.40, 0, .40, .81, 1.21]:
    block('Ready count', (x, 2.25, -8.395), (.29, .139, .013), amber)
block('DJ cabinet', (5.80, .51, -4.68), (2.02, 1.02, .91), rust).rotation_euler.z = -.29
for x, z in [(5.25, -4.51), (6.37, -4.82)]:
    block('DJ deck', (x, 1.055, z), (.64, .072, .61), housing).rotation_euler.z = -.29
    tube('Vinyl record', (x, 1.104, z), .25, .25, .025, inset, direction=(0, 1, 0))
    tube('Record label', (x, 1.118, z), .074, .074, .012, amber, direction=(0, 1, 0))


def light(name, kind, at, look, color, w, shape):
    data = bpy.data.lights.new(name, kind)
    data.color = rgb(color)
    data.energy = w
    if kind == 'SPOT':
        data.spot_size = math.radians(shape)
        data.spot_blend = .48
        data.shadow_soft_size = .12
    else:
        data.size = shape
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = pos(at)
    obj.rotation_euler = (Vector(pos(look)) - obj.location).to_track_quat('-Z', 'Y').to_euler()


bpy.context.view_layer.update()
for name, (_, aim, sidewall) in fixtures.items():
    o = bpy.data.objects[name + '-lens']
    at = o.matrix_world.translation
    light(name, 'SPOT', (at.x, at.z, -at.y), aim, '#75dbcb' if sidewall else '#fff0d4' if name == 'key-west' else '#ffddbc',
          (275 if sidewall else 1240 if name == 'key-west' else 580),
          (78 if sidewall else 73 if name == 'key-west' else 62))
light('Entry bounce', 'AREA', (1.4, 6.2, 2.2), (0, 0, -4), '#b3c4db', 850, 10)
light('Rear practical bounce', 'AREA', (0, 4, -5.1), (0, 1.2, -8.7), '#adbac4', 230, 9)

cam_data = bpy.data.cameras.new('Club reference')
camera = bpy.data.objects.new('Club reference', cam_data)
scene.collection.objects.link(camera)
scene.camera = camera
scene.world.color = (.10, .10, .10)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 36
scene.cycles.use_denoising = False
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_x, scene.render.resolution_y = 1120, 720
scene.render.resolution_percentage = 100
for file, at, look, lens in [
    ('club-reference', (1.22, 5.1, 8.7), (1.80, 1.12, -5.05), 30),
    ('club-hardware', (-.30, 2.4, -3.65), (-4.41, 2.26, -8.45), 46),
]:
    camera.location = pos(at)
    camera.rotation_euler = (Vector(pos(look)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = lens
    scene.render.filepath = str(args.out / (file + '.png'))
    bpy.ops.render.render(write_still=True)
