"""Build original Festival scene study and modular stage assets with Blender.

blender -b -t 4 --python tools/build_city_festival.py -- /tmp/festival-assets
"""
from pathlib import Path
from math import cos, sin, pi
import random
import sys
import bpy
from mathutils import Vector

OUTPUT = Path(sys.argv[sys.argv.index('--') + 1])
OUTPUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(17025)


def material(name, color, roughness=.7, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


def box(name, at, size, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new('Rolled corners', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        normal = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    ob.data.materials.append(mat)
    return ob


def arc(name, radius, start, end, z, width, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = width
    curve.bevel_resolution = 2
    steps = 35
    line = curve.splines.new('POLY')
    line.points.add(steps - 1)
    for i, p in enumerate(line.points):
        a = start + (end - start) * i / (steps - 1)
        p.co = (radius * cos(a), radius * sin(a), z, 1)
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob



def cylinder(name, at, radius, height, mat, sideways=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=height, location=at,
        rotation=(pi / 2, 0, 0) if sideways else (0, 0, 0))
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def link(name, points, width, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = width
    curve.bevel_resolution = 2
    path = curve.splines.new('POLY')
    path.points.add(len(points) - 1)
    for point, xyz in zip(path.points, points):
        point.co = (*xyz, 1)
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def dancer(ink, skin, shoe):
    # A light-study figure only. The live game uses its skinned motion-capture characters.
    torso = box('Rehearsing dancer · windbreaker', (.10, .09, .82), (.39, .27, .58), ink, .12)
    torso.rotation_euler = (.35, -.41, -.24)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=.135, location=(.28, .20, 1.15))
    bpy.context.object.name = 'Rehearsing dancer · head'
    bpy.context.object.data.materials.append(skin)
    link('Low supporting arm', [(-.04,.12, .91), (-.27, -.12, .68), (-.46,-.38,.19)], .077, ink)
    link('Lifted arm', [(.28,.13,.96), (.51,.39,1.10), (.75,.30,1.24)], .074, ink)
    link('Bent supporting leg', [(.02,.01,.60), (.37,-.40,.43), (.69,-.49,.095)], .11, ink)
    link('Extended leg', [(-.15,.00,.59), (-.47,.55,.32), (-.91,.77,.085)], .10, ink)
    box('Front trainer', (.72, -.54, .09), (.25,.14,.11), shoe)
    box('Back trainer', (-.94,.79,.08), (.27,.14,.10), shoe)

def light(name, position, target, color, power, size):
    obj = bpy.data.lights.new(name, 'AREA')
    obj.color, obj.energy, obj.shape, obj.size = color, power, 'DISK', size
    inst = bpy.data.objects.new(name, obj)
    bpy.context.collection.objects.link(inst)
    inst.location = position
    inst.rotation_euler = (Vector(target) - inst.location).to_track_quat('-Z', 'Y').to_euler()


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = False
    sc.render.resolution_x = 1000
    sc.render.resolution_y = 520
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    sc.world.color = (.12, .12, .12)
    return sc


def camera(sc, position, target):
    bpy.ops.object.camera_add(location=position)
    cam = bpy.context.object
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 13.9
    sc.camera = cam


def slab_material():
    mat = material('Cast concrete', (.13, .14, .17), .93)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 35
    tex.inputs['Detail'].default_value = 4
    shade = nodes.new('ShaderNodeValToRGB')
    shade.color_ramp.elements[0].position = .28
    shade.color_ramp.elements[0].color = (.029, .033, .049, 1)
    shade.color_ramp.elements[1].position = .77
    shade.color_ramp.elements[1].color = (.21, .20, .18, 1)
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .22
    bump.inputs['Distance'].default_value = .06
    links.new(tex.outputs['Fac'], shade.inputs[0])
    links.new(shade.outputs[0], bsdf.inputs['Base Color'])
    links.new(tex.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs[0], bsdf.inputs['Normal'])
    return mat


def set_study(name, theme, shot):
    sc = reset()
    floor = slab_material()
    steel = material('Dark zinc metal', (.045, .052, .066), .39, .72)
    skirting = material('Unpainted metal', (.16, .18, .20), .52, .48)
    wood = material('Dry maple', (.22, .115, .058), .68)
    paint = material('Stencilled limestone', (.71, .56, .41), .88)
    orange = material('Amber circuit', (1, .24, .035), .45, 0, 1.2)
    ice = material('Cool circuit', (.10, .72, .68), .41, 0, .92)
    rubber = material('Acoustic foam', (.014, .021, .028), .98)
    old = set(bpy.context.scene.objects)
    for n in range(4):
        angle = n * pi / 2
        arc('Open floor segment', 3.26, angle + .18, angle + 1.40, .031, .019, orange if n % 2 == 0 else ice)
        arc('White tape marker', 2.89, angle + .20, angle + 1.37, .029, .010, paint)
    for x in (-3.9, 3.9):
        box('Road case base', (x, 2.65, .16), (.86, .83, .27), skirting)
        box('Road case with steel corners', (x, 2.65, .72), (.78, .76, .96), steel)
        box('Open fabric speaker grille', (x, 2.25, .71), (.67, .037, .86), rubber, .02)
        for z, r in ((.56, .22), (.94, .095)):
            cylinder('Driver surround', (x, 2.216, z), r, .058, skirting, True)
            cylinder('Driver cone', (x, 2.180, z), r * .84, .037, rubber, True)
            cylinder('Driver dust cap', (x, 2.153, z), r * .37, .026, steel, True)
        for g in range(10):
            box('Horizontal speaker mesh', (x, 2.119, .35 + .078 * g), (.48,.008,.009), steel, .002)
        for dx in (-.32, .32):
            box('Recessed handle', (x + dx, 2.66, .90), (.022,.27,.09), skirting, .012)
            box('Underside foot', (x + dx, 2.30, .045), (.15,.14,.09), rubber, .028)
        box('Road case status strip', (x, 2.22, .29), (.34, .03, .027), ice if x > 0 else orange, .01)
        box('Low worklight housing', (x, 2.65, 1.29), (.42, .29, .16), steel)
        box('Low worklight diffuser', (x, 2.49, 1.29), (.35, .031, .09), ice if x > 0 else orange, .018)
        link('Power cable lying on the concrete', [(x, 3.02, .08), (x, 3.35, .026), (x*.73, 3.72,.022),
             (x*.39, 3.58,.022), (x*.21,4.13,.022)], .016, rubber)
    if theme == 'show':
        export = OUTPUT / 'festival-stage.glb'
        bpy.ops.object.select_all(action='DESELECT')
        for obj in set(sc.objects) - old:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB', use_selection=True, export_apply=True)
    box('Main room', (0, 0, -.13), (30, 23, .3), floor, .02)
    worn_wood = [material('Scuffed board ' + str(i), (.19 + i * .015, .093 + i*.009, .053 + i*.006), .81) for i in range(5)]
    for ix in range(-4, 5):
        for iy in range(-2, 3):
            offset = .24 if ix % 2 else 0
            board = box('On-site plywood', (ix * .48, iy * .88 + offset, .031), (.473, .871, .026),
                worn_wood[RNG.randrange(len(worn_wood))], .006)
            board.rotation_euler.z = RNG.uniform(-.005, .005)
    for _ in range(28):
        x, y = RNG.uniform(-1.8, 1.8), RNG.uniform(-1.7, 1.7)
        link('Rubber scuff', [(x,y,.048),(x + .09,y + .018,.048),(x + .14,y+.042,.048)], .008, wood)
    for x in (-5, -2.4, 0, 2.4, 5):
        box('Visible wall frame', (x, 5.8, 2.4), (.22, .35, 4.8), skirting)
        box('Wall panel', (x, 6.0, 2.3), (2.28, .31, 4.6), floor)
    for x in (-1.03,1.03):
        for y in (3.85,4.48):
            box('Desk square leg', (x, y, .62), (.12,.12,1.24), steel, .02)
    box('Wood table top', (0, 4.14, 1.27), (2.48, 1.04, .09), wood)
    for x in (-.76,.76):
        box('Direct-drive turntable', (x,4.15,1.37), (.76,.77,.14), skirting)
        cylinder('Machined platter', (x-.035,4.11,1.455), .29,.034, skirting)
        cylinder('Vinyl record', (x-.035,4.11,1.481), .265,.015,rubber)
        cylinder('Center label', (x-.035,4.11,1.491), .076,.009,orange if x < 0 else ice)
        link('Silver S tonearm', [(x+.27,4.4,1.48),(x+.23,4.24,1.53),(x+.066,4.04,1.515)], .016,skirting)
    box('Recessed DJ mixer', (0,4.14,1.38), (.53,.77,.18),steel)
    for i in range(4):
        x = (i - 1.5) * .094
        box('Fader slot', (x,3.94,1.473), (.022,.21,.009),rubber,.007)
        box('Mix fader', (x,3.99-.02*i,1.490), (.057,.061,.025),skirting,.008)
        for y in (4.15,4.23,4.32):
            cylinder('Mixer knobs', (x,y,1.49), .026,.031,skirting)
    alloy = skirting
    for n in range(16):
        angle = 2 * pi * n / 16 + .2
        if abs(angle - 3.7) < .5 or abs(angle - 5.5) < .35:
            continue
        x, y = 4.65 * cos(angle), 4.65 * sin(angle)
        dx, dy = -.39 * sin(angle), .39 * cos(angle)
        a, b = (x-dx,y-dy), (x+dx,y+dy)
        for (px,py) in (a,b):
            cylinder('Audience rail stanchion', (px,py,.5),.026,1.0,skirting)
            cylinder('Weighted rubber foot', (px,py,.077),.13,.15,rubber)
        link('Audience rail crossbar', [(*a,.93),(*b,.93)], .027, skirting)
        link('Audience rail lower bar', [(*a,.47),(*b,.47)], .019, skirting)
    if theme == 'show':
        dancer(steel, paint, ice)
    if theme == 'empty':
        box('Barricade across the opening', (0, -3.25, .57), (3.4, .38, 1.10), steel)
        box('Batten across the barricade', (0, -3.47, .74), (3.45, .14, .20), orange)
    elif theme == 'hands':
        for x in (-1.6, 0, 1.6):
            box('Folded bench', (x, 4.85, .42), (1.0, .27, .16), wood)
    light('Soft amber over the circle', (-3, -2, 7), (0, 0, 0), (1, .56, .31), 1200 if theme == 'show' else 760, 5)
    light('Blue door spill', (5, 2, 4), (-1, -1, 0), (.37, .66, 1), 800 if theme == 'show' else 420, 4)
    light('Desk square', (0, 4.3, 4.8), (0, 4, 1), (.91, .86, .74), 500, 3)
    camera(sc, *shot)
    sc.render.filepath = str(OUTPUT / (name + '.png'))
    bpy.ops.render.render(write_still=True)


set_study('festival-main', 'show', ((7.8, -12.0, 6.2), (0, .35, .68)))
if '--all' in sys.argv:
    set_study('festival-lost', 'empty', ((6.5, -10.6, 6.3), (0, -.2, .52)))
    set_study('festival-rehearsal', 'hands', ((-8, -9.5, 7.0), (0, .4, .6)))
