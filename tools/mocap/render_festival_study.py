"""Render the packed game rig as a two-row contact sheet.

blender -b -t 4 --python tools/mocap/render_festival_study.py -- /tmp/festival-pose-study.png
Append "battle" to render the Club gesture and floor-transfer study.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

root = Path(__file__).resolve().parents[2]
rig = json.loads((root / 'anim/bboy.json').read_text())
clips = rig['clips'] | json.loads((root / 'anim/city-breaking.json').read_text())
args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgb, roughness=.72):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*rgb, 1)
    value.use_nodes = True
    shader = value.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = roughness
    return value


warm = material('Amber performer', (.64, .27, .08))
blue = material('Indigo performer', (.04, .25, .53))
light = material('Wrist and mouth of sole', (.61, .68, .75))
skin = material('Research figure skin', (.46, .28, .20))
dark = material('Graphite floor', (.033, .044, .065))
ring = material('Chalk pad lines', (.24, .29, .36))
world = material('Backdrop', (.015, .022, .036))


def joints(clip, percent):
    track = clips[clip]
    frame = round((track['n'] - 1) * percent)
    pose = {}
    for name, state in rig['rest'].items():
        x, y, z, w = [n / 1000 for n in track['t'][name + '.q'][frame*4:frame*4+4]]
        local = Quaternion((w, x, y, z)).normalized()
        if state['p'] in pose:
            parent, rotation = pose[state['p']]
            pose[name] = (parent + rotation @ Vector(state['pos']), rotation @ local)
        else:
            pose[name] = (Vector([n/100 for n in track['t']['Hips.p'][frame*3:frame*3+3]]), local)
    return {name: Vector((joint.x, -joint.z, joint.y)) for name, (joint, _) in pose.items()}


def sphere(point, size, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=size, location=point)
    model = bpy.context.object
    model.scale = scale
    model.data.materials.append(mat)
    for face in model.data.polygons:
        face.use_smooth = True
    return model


def limb(start, end, radius, mat, width=1):
    delta = end - start
    obj = sphere((start + end)/2, 1, mat, (radius*width, radius, delta.length/2 + radius*.31))
    obj.rotation_euler = delta.to_track_quat('Z','Y').to_euler()


def posed(label, values, floor_x, floor_y, shade):
    low = min(v.z - (.065 if name.endswith(('Foot','Hand')) else .10 if name == 'Head' else .03)
              for name, v in values.items())
    hips = values['Hips']
    shift = Vector((floor_x-hips.x, floor_y-hips.y, -low+.022))
    values = {name: point + shift for name, point in values.items()}
    hips, chest = values['Hips'], values['Spine2']
    limb(hips, chest, .113, shade, 1.37)
    limb(chest, values['Neck'], .124, shade, 1.36)
    sphere(values['Head'] + Vector((.015,0,.069)), .108, skin, (.91,.85,1.12))
    for side in ('Left', 'Right'):
        hand = values[side+'Hand']
        foot = values[side+'Foot']
        limb(values[side+'Arm'], values[side+'ForeArm'], .058, shade)
        limb(values[side+'ForeArm'], hand, .046, shade)
        sphere(hand, .048, skin, (.80,1.10,.68))
        limb(values[side+'UpLeg'], values[side+'Leg'], .077, dark, 1.06)
        limb(values[side+'Leg'], foot, .064, dark, 1.08)
        toe = values.get(side+'ToeBase', foot+Vector((0,.145,0)))
        limb(foot, toe, .065, light)
    bpy.ops.mesh.primitive_circle_add(vertices=52, radius=.75, location=(floor_x,floor_y,-.008), fill_type='NGON')
    bpy.context.object.data.materials.append(dark)
    bpy.ops.mesh.primitive_torus_add(major_segments=44,minor_segments=6,major_radius=.72,minor_radius=.009,location=(floor_x,floor_y,.003))
    bpy.context.object.data.materials.append(ring)
    bpy.ops.object.text_add(location=(floor_x-.62,floor_y-.90,.022))
    text = bpy.context.object.data
    text.body, text.size, text.align_x = label, .134, 'LEFT'
    text.materials.append(light)


festival = [
    [('01  Entry','Festival_StitchSignal',.14), ('02  Cut','Festival_StitchSignal',.54),
     ('03  Hold','City_Shoulder_Hold',.64), ('04  Exit','Festival_StandThrough',.82)],
    [('01  Entry','City_Backspin',.17), ('02  Rotate','City_Backspin',.49),
     ('03  Hold','City_Shoulder_Hold',.76), ('04  Exit','Festival_StandThrough',.98)],
]

battle = [
    [('01  Entry','City_Battle_Compact',.08), ('02  First palm','City_Battle_Support',.18),
     ('03  Change support','City_Battle_Support',.62), ('04  Extend','City_Battle_Support',.79)],
    [('01  Plant','City_Battle_LegArc',.14), ('02  Curl','City_Battle_LegArc',.28),
     ('03  Sweep','City_Battle_LegArc',.54), ('04  Next step','City_Battle_LegArc',.81)],
]
for row, theme in enumerate(battle if args[1:] == ['battle'] else festival):
    for column, (label, clip, time) in enumerate(theme):
        posed(label, joints(clip,time), (column-1.5)*1.87, (0.5-row)*2.04, warm if row==0 else blue)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
bpy.context.object.data.materials.append(world)


def area(position, color, energy):
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.data.color, light.data.energy, light.data.size = color, energy, 7
    light.rotation_euler = (-light.location).to_track_quat('-Z','Y').to_euler()


area((1,-4,8), (1,.79,.57), 1050)
area((-4,2,5), (.59,.76,1), 800)
bpy.ops.object.camera_add(location=(.4,-5.75,9.6))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,-.01,.39))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 7.95
scene = bpy.context.scene
scene.camera = camera
scene.world.color = (.13,.13,.13)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 22
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 1060, 590
scene.render.resolution_percentage = 100
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
