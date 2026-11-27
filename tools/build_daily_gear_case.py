"""Daily wardrobe case, original Blender model and frame.

blender -b -t 4 --python tools/build_daily_gear_case.py -- /tmp/daily-gear-case.png
"""
import sys
from math import radians
import bpy
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgb, rough, metallic=0, glow=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1)
    node = m.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Roughness'].default_value = rough
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Emission Color'].default_value = (*rgb, 1)
    node.inputs['Emission Strength'].default_value = glow
    return m


def solid(name, center, dimensions, mat, radius=.041, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        bevel = o.modifiers.new('Pressed radii', 'BEVEL')
        bevel.width = radius
        bevel.segments = 3
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    o.data.materials.append(mat)
    return o


def area(name, position, target, color, watts, radius):
    data = bpy.data.lights.new(name, 'AREA')
    data.shape, data.size, data.color, data.energy = 'DISK', radius, color, watts
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    o.location = position
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


polymer = material('Matte shell', (.068, .084, .103), .58)
black = material('Recessed rubber', (.014, .019, .024), .87)
alloy = material('Satin aluminium', (.37, .43, .48), .4, .65)
orange = material('Small charge indicator', (1, .19, .04), .48, .12, 1.65)
clay = material('Speckled workshop floor', (.112, .104, .102), .82)

solid('Solid workshop floor', (0, 0, -.15), (28, 24, .3), clay, .0)
solid('Flight case bottom', (0, 0, .38), (2.62, 1.65, .66), polymer, .13)
solid('Seal between body and lid', (0, 0, .70), (2.67, 1.70, .09), black, .05)
solid('Raised lid', (0, .02, .91), (2.69, 1.73, .39), polymer, .12)
solid('Stiffened upper panel', (0, .012, 1.09), (2.38, 1.44, .09), black, .048)
for x in (-1.18, 1.18):
    for y in (-.65, .65):
        solid('Stacking foot', (x, y, .07), (.36, .34, .14), black, .055)
        solid('Polymer corner cap', (x, y, .90), (.36, .36, .39), alloy, .077)
    for z in (.17, .60, .93):
        solid('Anodised edge bands', (x, -.832, z), (.28, .08, .092), alloy, .026)
    solid('Hinged recessed latch bowl', (x * .59, -.866, .64), (.41, .061, .37), black, .065)
    solid('Hinged latch', (x * .59, -.903, .65), (.29, .055, .20), alloy, .035)
    solid('Latch groove', (x * .59, -.933, .65), (.19, .014, .038), black, .012)
for x in (-.86, -.58, -.30, 0, .30, .58, .86):
    solid('Lid reinforcing rib', (x, .03, 1.145), (.075, 1.23, .064), polymer, .026)
solid('Worn recessed handle', (0, -.85, .40), (.55, .073, .18), black, .072)
solid('Anodised carry handle', (0, -.90, .37), (.43, .075, .065), alloy, .033)
for x in (-.135, -.045, .045, .135):
    solid('Charge status slits', (x, -.853, .91), (.071, .014, .024), orange, .009)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 48
sc.cycles.use_denoising = False
sc.render.resolution_x = 880
sc.render.resolution_y = 345
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX'
sc.world.color = (.14, .14, .14)
area('Soft key', (1.8, -3.6, 4.6), (0, 0, .25), (1.0, .69, .43), 570, 3.0)
area('Edge light', (-2.0, 2.5, 3.2), (0, 0, .50), (.39, .73, 1), 420, 2.8)
area('Workshop bounce', (4, 1.5, 2.2), (0, 0, .45), (.9, .93, 1), 190, 2.2)
bpy.ops.object.camera_add(location=(4.4, -6.5, 3.1))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .55)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 5.8
sc.camera = camera
sc.render.filepath = sys.argv[sys.argv.index('--') + 1]
bpy.ops.render.render(write_still=True)
