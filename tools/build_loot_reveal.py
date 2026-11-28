"""Road case for the daily wardrobe drop, authored and staged in Blender.

blender -b -t 6 --python tools/build_loot_reveal.py -- --out /tmp/loot-reveal
Use --board for five stills or omit it for the timed 36-frame sequence.
"""
import argparse
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=Path('/tmp/loot-reveal'))
parser.add_argument('--board', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.out.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
rng = random.Random(725)


def tint(value):
    rgb = [int(value[i:i+2], 16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)


def surface(name, color, metallic=0, rough=.7, grain=0, light=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    graph = mat.node_tree
    shader = graph.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*tint(color),1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = rough
    if light:
        shader.inputs['Emission Color'].default_value = (*tint(color),1)
        shader.inputs['Emission Strength'].default_value = light
    if grain:
        texture = graph.nodes.new('ShaderNodeTexNoise')
        texture.inputs['Scale'].default_value = 120
        texture.inputs['Detail'].default_value = 2
        bump = graph.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .35
        bump.inputs['Distance'].default_value = grain
        graph.links.new(texture.outputs['Fac'], bump.inputs['Height'])
        graph.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return mat


shell = surface('Dented dyed phenolic plywood', '#2b3433', rough=.63, grain=.025)
metal = surface('Bead blasted aluminum edge trims', '#9eada5', .68, .34, .006)
latched = surface('Worn latch and strike plates', '#bbc0aa', .67, .32, .007)
metal_dark = surface('Black oxidized steel corner', '#39434a', .63, .50)
rubber = surface('Rubber feet and carrying grip', '#222325', rough=.81, grain=.026)
foam = surface('Cut charcoal foam', '#514944', rough=.93, grain=.045)
recess = surface('Recess in routed foam', '#33312f', rough=.93, grain=.047)
cloth = surface('Linen cable strap', '#a07951', rough=.79, grain=.04)
paper = surface('Beaten loading labels', '#d7bea1', rough=.89, grain=.014)
orange = surface('Torn rust-orange gaffer', '#dc6937', rough=.84, grain=.02)
ink = surface('Stencil ink', '#242220', rough=.89)
mark = surface('Warm stencil ink', '#efd5a0', rough=.78)
backdrop = surface('Loading bench', '#212c31', rough=.86, grain=.013)
scrape = [surface('Edge scuff', '#596664', .12, .6), surface('Exposed phenolic', '#716654', .05, .76),
          surface('Rail nick', '#bec7b5', .77, .49)]
neutral = surface('Soft inside strip', '#f0aa71', .23, .43, light=1.1)


def child(obj, parent):
    if parent:
        obj.parent = parent
    return obj


def box(name, pos, dim, mat, bevel=.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name, obj.dimensions = name, dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        edge = obj.modifiers.new('Rounded edge', 'BEVEL')
        edge.width, edge.segments = bevel, 3
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return child(obj,parent)


def cylinder(name, pos, radius, length, mat, rot=(0,0,0), parent=None, count=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=count, radius=radius, depth=length, location=pos, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return child(obj,parent)


def poly(name, points, mat, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], [tuple(range(len(points)))])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return child(obj,parent)


def text(name, label, position, size, mat, rotation=(0,0,0), parent=None):
    font = bpy.data.curves.new(name, 'FONT')
    font.body, font.size, font.extrude = label,size,.0006
    font.materials.append(mat)
    obj = bpy.data.objects.new(name,font)
    scene.collection.objects.link(obj)
    obj.location, obj.rotation_euler = position, rotation
    return child(obj,parent)


def pivot(name, at):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = at
    return obj


# Shell is open up to the rim so the viewer can see the thickness of the hinge and insert.
w,d,h = 3.22,1.78,.64
rail = .084
box('Bench', (0,0,-.136), (200,200,.245), backdrop, 0)
box('Case bottom', (0,0,.139), (w,d,.22), shell)
for sign in (-1,1):
    box('Long wall', (0,sign*(d/2-.046),.375), (w-.10,.093,.51), shell)
    box('Short wall', (sign*(w/2-.046),0,.375), (.093,d,.51), shell)
    for z in (.135,.607):
        box('Long aluminum angle', (0,sign*d/2,z), (w,.068,rail), metal, .019)
        box('Short aluminum angle', (sign*w/2,0,z), (.068,d,rail), metal, .019)
    for side in (-1,1):
        x,y = sign*(w/2-.057), side*(d/2-.058)
        box('Steel corner cap', (x,y,.162), (.246,.248,.203), metal_dark,.076)
        box('Steel upper corner cap', (x,y,.598), (.225,.225,.148), metal_dark,.055)
        box('Rubber foot', (x*.91,y*.89,.053), (.32,.27,.122), rubber,.048)
        for dz in (.026,.11):
            cylinder('Corner rivet', (x,side*(d/2+.064),.133+dz), .020,.016,latched,(math.pi/2,0,0),count=12)
for x in (-1.44,-.56,.55,1.45):
    cylinder('Shell rivet', (x,-d/2-.013,.574), .016,.016,latched,(math.pi/2,0,0),count=12)

box('Foam bed', (0,0,.336), (w-.21,d-.20,.18), foam,.047)
for x,y,dx,dy in [(0,-.63,2.64,.33),(0,.63,2.64,.31),(-1.415,0,.20,1.42),(1.415,0,.20,1.42)]:
    box('Lipped foam surround', (x,y,.454), (dx,dy,.185), foam,.041)
box('Recessed foam pocket', (0,0,.42), (2.60,.91,.046), recess,.067)
for j in range(8):
    box('Tool recess', (1.17,j*.086-.3,.46), (.06,.048,.026), rubber,.013)
for x in (-.91,.92):
    strap=box('Flat webbing in tray', (x,0,.459), (.166,1.07,.026), cloth,.008)
    strap.rotation_euler.z = math.radians(5 if x<0 else -5)
    box('Brushed strap buckle', (x,.26,.477), (.252,.153,.036), metal_dark,.014)
box('Warm interior lamp', (.23,.725,.542), (1.05,.023,.036), neutral,.012)

# A physical handle, two riveted spring clasps, four rolled hinge barrels.
box('Handle mounting plate', (0,-d/2-.033,.328), (.83,.084,.237), metal_dark,.044)
for side in (-1,1):
    box('Handle anchor', (side*.29,-d/2-.091,.34), (.115,.129,.139), latched,.025)
    box('Handle arm', (side*.21,-d/2-.127,.276), (.074,.132,.175), rubber,.021)
box('Carrying grip', (0,-d/2-.183,.211), (.467,.125,.113), rubber,.040)
for x in (-.14,-.07,0,.07,.14):
    box('Grip rib', (x,-d/2-.239,.211), (.018,.020,.071), metal_dark,.006)

lid = pivot('Lid axis on rear pin', (0,d/2,.674))
box('Lid top', (0,-d/2,.195), (w,d,.111), shell,.035,lid)
for sign in (-1,1):
    pos_y = -d/2+sign*(d/2-.038)
    box('Lid short lip', (sign*(w/2-.04),-d/2,.089), (.087,d,.16), shell,.029,lid)
    box('Lid long lip', (0,pos_y,.084), (w,.087,.164), shell,.024,lid)
    for z in (.028,.217):
        box('Lid side rails', (sign*w/2,-d/2,z), (.069,d,.072), metal,.018,lid)
        box('Lid end rails', (0,pos_y+sign*.041,z), (w,.069,.072), metal,.018,lid)
    for direction in (-1,1):
        box('Lid corner', (sign*(w/2-.048),-d/2+direction*(d/2-.043),.201), (.249,.236,.165), metal_dark,.055,lid)
box('Foam lid backing', (0,-d/2,.112), (w-.235,d-.21,.092), foam,.046,lid)
for j in range(7):
    for i in range(11):
        x = (i-5)*.239 + (j%2)*.10
        y = (j-3)*.206 - d/2
        bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.152,radius2=.055,depth=.113,location=(x,y,.028))
        obj = bpy.context.object
        obj.name = 'Acoustic foam ridge'
        obj.rotation_euler.x = math.pi
        obj.data.materials.append(foam)
        child(obj,lid)
for x in (-1.03,1.03):
    box('Upper hinge leaf', (x,.052,.131), (.39,.086,.207), metal_dark,.021,lid)
    box('Fixed hinge leaf', (x,d/2+.038,.575), (.38,.081,.265), metal_dark,.018)
    for i in range(5):
        cylinder('Rolled hinge knuckle', (x+(i-2)*.075,d/2+.043,.674), .053,.070,latched,(0,math.pi/2,0))

latches = []
for x in (-.97,.97):
    box('Inset latch pan', (x,-d/2-.044,.48), (.40,.088,.31), metal_dark,.048)
    box('Fixed latch plate', (x,-d/2-.093,.512), (.264,.065,.252), latched,.036)
    for side in (-1,1):
        cylinder('Latch mounting screw', (x+side*.153,-d/2-.103,.48), .020,.012,latched,(math.pi/2,0,0),count=12)
    box('Strike plate on lid', (x,-d-.042,.068), (.236,.070,.126), metal_dark,.024,lid)
    box('Nickel keeper on lid', (x,-d-.091,.047), (.213,.068,.055), latched,.011,lid)
    catch = pivot('Pivot of flip latch', (x,-d/2-.139,.45))
    box('Spring lever', (0,-.044,.088), (.179,.064,.212), latched,.021,catch)
    box('Hook travel', (0,-.034,.207), (.117,.052,.1), metal_dark,.011,catch)
    box('Latch grip cut', (0,-.077,.041), (.103,.015,.042), metal_dark,.008,catch)
    latches.append(catch)

# Signs and scratches are geometry so the same wear follows every keyframe.
for i in range(18):
    x = rng.uniform(-1.44,1.43)
    y = rng.uniform(-1.69,-.06)
    length = rng.uniform(.02,.21)
    poly('Fine scratch along top sheet', [(x,y,.254),(x+length,y+.006,.254),(x+length*.67,y+.014,.254),(x+.013,y+.009,.254)],rng.choice(scrape),lid)
for i in range(24):
    x,z = rng.uniform(-1.54,1.54),rng.uniform(.207,.554)
    length = rng.uniform(.014,.15)
    poly('Wear under flight stickers', [(x,-.900,z),(x+length,-.900,z+.004),(x+length*.4,-.900,z+.010),(x+.004,-.900,z+.006)],rng.choice(scrape))
poly('Torn shipping slip', [(-.99,-1.31,.256),(-.37,-1.36,.256),(-.36,-1.22,.256),(-.39,-1.16,.256),(-1.01,-1.13,.256)],paper,lid)
text('Shipping code','F07 / CREW',(-.964,-1.269,.261),.080,ink,parent=lid)
poly('Frayed orange gaffer', [(1.10,-1.71,.257),(1.37,-1.73,.257),(1.36,-.49,.257),(1.31,-.51,.257),(1.23,-.47,.257),(1.12,-.52,.257)],orange,lid)
poly('Tape over front bevel', [(1.10,-d-.082,.218),(1.37,-d-.082,.219),(1.37,-d-.082,.083),(1.29,-d-.082,.102),(1.22,-d-.082,.077),(1.11,-d-.082,.09)],orange,lid)
poly('Paper venue sticker', [(-1.44,-.901,.22),(-1.23,-.901,.24),(-1.22,-.901,.338),(-1.38,-.901,.36),(-1.45,-.901,.325)],paper)
text('Front stencilled inventory','07',(.49,-.904,.29),.147,mark,(math.pi/2,0,0))
text('Backliner lettering','FLOOR KIT',(-.12,-1.06,.262),.153,mark,parent=lid)


def light(name, position, target, power, color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy,data.color,data.size=power,tint(color),size
    obj = bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


light('Amber light from stage door', (-3.5,-3.6,5), (.0,0,.4), 730, '#ffc388', 4.4)
light('Cool edge from curtained booth', (3.2,2.2,4.2),(0,0,.4), 940,'#addfff',3.4)
light('Weak bounce across clasps', (-.8,-5.2,1.9),(0,0,.45), 107,'#e8ded5',2.6)
fill = light('Neutral light in insert', (0,.32,2.54), (0,0,.3), 14, '#fff0d3', 1.5)
scene.world.color = (.12,.12,.12)
cam_data=bpy.data.cameras.new('Three quarter reveal'); cam=bpy.data.objects.new('Three quarter reveal',cam_data)
scene.collection.objects.link(cam); scene.camera=cam
cam.location=(3.55,-6.54,4.15)
cam.rotation_euler=(Vector((0,0,1.19))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=5.84
scene.render.engine='CYCLES'
scene.cycles.samples=58 if args.board else 26
scene.cycles.use_denoising=False
scene.cycles.seed = 49
scene.cycles.use_animated_seed = False
scene.render.image_settings.file_format='PNG'
scene.render.resolution_x,scene.render.resolution_y=(740,503) if args.board else (400,272)
scene.render.resolution_percentage=100
scene.render.fps=30


def key(obj,at,position):
    obj.rotation_euler.x=math.radians(position)
    obj.keyframe_insert(data_path='rotation_euler',index=0,frame=at)


for frame, angle in [(0,0),(1,0),(8,0),(11,0),(15,-9),(22,-60),(28,-105),(32,-109),(35,-107)]:
    key(lid,frame,angle)
for i, catch in enumerate(latches):
    for frame, angle in [(0,0),(1+i,0),(5+i,37),(8+i,78),(13,96),(17,103),(35,103)]:
        key(catch,frame,angle)
for frame,power in [(0,0),(9,0),(18,10),(29,23),(35,23)]:
    fill.data.energy=power
    fill.data.keyframe_insert(data_path='energy',frame=frame)
if args.board:
    for name, at in [('closed',0),('unlatched',8),('hinge',19),('open',35)]:
        scene.frame_set(at)
        scene.render.filepath=str(args.out / f'{name}.png')
        bpy.ops.render.render(write_still=True)
else:
    scene.frame_start,scene.frame_end=0,35
    scene.render.filepath=str(args.out / 'case-')
    bpy.ops.render.render(animation=True)
