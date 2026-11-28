"""Build Club audience GLB and its Blender reference views. Run with Blender 4.3+.

blender -b -t 6 --python tools/build_club_audience.py -- --out /tmp/club-audience
Add --no-render to rebuild only the game asset. Coordinates follow the live Club.
"""
import argparse
import math
import json
import struct
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector


BASE = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=Path('/tmp/club-audience'))
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.out.mkdir(parents=True, exist_ok=True)
rng = random.Random(485)

# Angles are measured from the south entrance; north is behind the judges.
# The west sector is reserved for the seven entrants, the east sector for the DJ.
CLUSTERS = [
    ((-38, -30, -22, -15), (-42, -34, -26, -18, -11)),
    ((19, 27, 36, 50, 58, 68), (17, 25, 33, 49, 57, 67)),
    ((124, 138, 148), (127, 135, 143, 151)),
]
FLOOR_Z = -2.4
FABRICS = [('#b16d48', '#273d50', '#d3976b'), ('#63768d', '#32272c', '#e0ca9f'),
           ('#28555b', '#9e855c', '#65b4a9'), ('#7c4e58', '#343343', '#c997ac'),
           ('#a8987c', '#3a474f', '#eacda3'), ('#485e57', '#333444', '#acb494'),
           ('#374150', '#647077', '#85a8b1'), ('#665243', '#424654', '#dfa51f'),
           ('#837a92', '#42402e', '#c1b3cf'), ('#9b5245', '#2e4143', '#e8cfba')]
COMPLEXIONS = ['#b88061', '#6e483d', '#8a5843', '#deab87', '#b58266', '#e9bc99', '#774c41', '#ad7952']


def srgb(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels) + (1,)


def material(color):
    mat = bpy.data.materials.get(color)
    if mat:
        return mat
    mat = bpy.data.materials.new(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = srgb(color)
    bsdf.inputs['Roughness'].default_value = .84
    mat.diffuse_color = srgb(color)
    return mat


def assign(obj, color):
    obj.data.materials.append(material(color))
    return obj


def xyz(p):
    return Vector((p[0], -p[2], p[1]))


def posed(point, x=0, z=0, angle=0):
    a, b, c = point
    return (x + a * math.cos(angle) + c * math.sin(angle), b,
            z + c * math.cos(angle) - a * math.sin(angle))


def ellipsoid(point, radii, color, segments=12, rings=8, yaw=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=xyz(point))
    obj = bpy.context.object
    obj.scale = (radii[0], radii[2], radii[1])
    obj.rotation_euler.z = yaw
    for face in obj.data.polygons:
        face.use_smooth = True
    return assign(obj, color)


def block(point, dims, color, yaw=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(point))
    obj = bpy.context.object
    obj.scale = (dims[0], dims[2], dims[1])
    obj.rotation_euler.z = yaw
    return assign(obj, color)


def loft(name, start, end, profiles, color, sides=10, yaw=0):
    """Concentric elliptical rings between two joints, with beveled ends."""
    origin, vec = xyz(start), xyz(end) - xyz(start)
    q = Vector((0, 0, 1)).rotation_difference(vec.normalized())
    verts = []
    for along, wide, depth in profiles:
        for i in range(sides):
            a = math.tau * i / sides + yaw
            verts.append(origin + vec * along + q @ Vector((wide * math.cos(a), depth * math.sin(a), 0)))
    last = sides * (len(profiles) - 1)
    faces = [tuple(reversed(range(sides)))]
    for ring in range(len(profiles) - 1):
        for i in range(sides):
            a, b = i + ring * sides, (i + 1) % sides + ring * sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range(last, last + sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for face in mesh.polygons[1:-1]:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return assign(obj, color)


def limb(start, end, top, tip, color):
    return loft('Limb', start, end, [(0, top * .83, top * .86), (.19, top, top),
        (.68, tip * 1.05, tip * 1.07), (1, tip, tip)], color, 7)


def join_parts(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = parts[0]
    for obj in parts:
        obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = name
    return body


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
bodies, markers, poses = [], [], []

for group_no, (front, back) in enumerate(CLUSTERS):
    for row, angles in enumerate((front, back)):
        for i, bearing in enumerate(angles):
            number = len(poses)
            size = rng.uniform(.87, 1.10)
            width = rng.uniform(.85, 1.13)
            radius = (4.53 if row == 0 else 5.38) + rng.uniform(-.08, .10)
            bearing = math.radians(bearing)
            x, z = math.sin(bearing) * radius, FLOOR_Z + math.cos(bearing) * radius
            yaw = math.atan2(-x, FLOOR_Z - z) + rng.uniform(-.10, .10)
            floor_pose = i % 3
            jacket = (number * 7 + group_no) % 4
            top, pants, accent = FABRICS[(number * 7 + group_no * 3) % len(FABRICS)]
            skin = COMPLEXIONS[(number * 5 + i) % len(COMPLEXIONS)]
            hair = ['#292022', '#36282a', '#252227', '#70503b'][number % 4]
            shoe = ['#d1cebc', '#9b9a93', '#231f26', '#ba9273'][number % 4]
            hips = 0.97 if row else .26 if floor_pose == 2 else .14
            leaning = .04 if row else .14 if floor_pose == 0 else .10
            shoulders = hips + (.42 if jacket == 1 else .40)
            neck_y = shoulders + .072
            head_y = neck_y + .132

            def place(p):
                return posed((p[0] * size, p[1] * size, p[2] * size), x, z, yaw)

            def blob(p, radii, color, segments=8, rings=6):
                bodies.append(ellipsoid(place(p), tuple(s * size for s in radii), color, segments, rings, yaw))

            tw = (.197 if jacket in (0, 2) else .168) * width
            bodies.append(loft('Garment', place((0, hips - .055, -.027)), place((-.01, neck_y - .012, leaning)),
                [(0, tw * size * .76, .102 * size), (.10, tw * size * .91, .123 * size),
                 (.43, tw * size, .128 * size), (.78, tw * size * 1.03, .12 * size),
                 (.91, tw * size * .9, .114 * size), (1, .079 * size, .065 * size)], top, 10, yaw))
            if jacket == 0:  # roomy hoodie with neck roll and front pouch
                blob((0, shoulders + .016, leaning - .096), (.136, .140, .089), top)
                blob((0, hips + .146, .122), (.132, .068, .043), top)
                for side in [-1, 1]:
                    bodies.append(limb(place((side * .039, neck_y - .025, leaning + .057)),
                                       place((side * .052, shoulders - .19, leaning + .068)), .008 * size, .006 * size, accent))
            elif jacket == 1:  # slim zipped track top with a ribbed collar
                blob((0, neck_y - .01, leaning), (.087, .045, .072), accent)
                bodies.append(limb(place((0, hips + .02, .123)), place((-.007, shoulders + .03, leaning + .102)),
                                   .008 * size, .007 * size, accent))
            elif jacket == 2:  # workwear with two front patch pockets
                for side in [-1, 1]:
                    blob((side * .105, hips + .25, leaning * .63 + .111), (.056, .048, .022), accent)
            else:  # loose jersey with a stitched chest panel
                blob((-.045, shoulders - .092, leaning + .112), (.065, .025, .020), accent)
            blob((-.01, neck_y + .022, leaning), (.068, .072, .066), skin)
            blob((-.006, head_y, leaning + .028), (.122, .146, .112), skin, 10, 7)
            blob((-.008, head_y - .016, leaning + .133), (.027, .033, .024), skin, 6, 4)
            for side in [-1, 1]:
                blob((side * .119, head_y - .014, leaning + .018), (.025, .033, .022), skin, 6, 4)
                blob((side * .045, head_y + .014, leaning + .128), (.016, .009, .007), hair, 6, 4)
            headwear = ([2, 4, 3, 1, 0, 2] if row else [1, 3, 0, 2, 4, 3])[i] if group_no == 1 else (number + i // 2) % 5
            if headwear == 0:
                blob((-.008, head_y + .088, leaning + .018), (.132, .103, .116), accent)
                blob((-.002, head_y + .09, leaning + .128), (.143, .023, .116), accent)
            elif headwear == 1:
                blob((-.008, head_y + .109, leaning + .020), (.129, .099, .116), hair)
                blob((-.010, head_y + .063, leaning + .022), (.133, .028, .12), accent)
            elif headwear == 2:
                blob((-.008, head_y + .092, leaning + .012), (.125, .093, .117), hair)
                for side in [-1, 1]:
                    blob((side * .09, head_y - .058, leaning - .019), (.044, .106, .051), hair)
                # Coiled hair gathered at the nape, with an uneven row of curls up top.
                blob((-.051, head_y + .096, leaning - .102), (.079, .077, .070), hair)
                for dx, dy, dz in [(-.079,.149,.034),(.066,.156,.043),(-.016,.183,.031),(.026,.169,-.038)]:
                    blob((dx, head_y+dy, leaning+dz), (.051, .048, .053), hair, 7, 5)
            elif headwear == 3:
                blob((-.008, head_y + .092, leaning - .013), (.133, .127, .119), top)
                blob((-.010, head_y + .025, leaning + .010), (.145, .030, .137), top)
            else:
                blob((-.018, head_y + .101, leaning + .018), (.128, .075, .113), hair)
                blob((-.089, head_y + .071, leaning + .067), (.037, .062, .051), hair)

            arm_bones = []
            for side in [-1, 1]:
                hip = (side * .107 * width, hips, -.033)
                if row:
                    knee = (side * (.117 + .025 * (i % 2)), .52, .065 + side * .025)
                    ankle = (side * (.153 + .019 * (i % 2)), .093, side * .055)
                elif floor_pose == 0:  # knees drawn up, elbows resting on them
                    knee = (side * .174, .32 if side == 1 else .37, .297)
                    ankle = (side * .191, .082, .445 if side == 1 else .402)
                elif floor_pose == 1:  # cross-legged, the ankles stop short of the floor line
                    knee = (side * .309, .16, .220)
                    ankle = (-side * .068, .084, .31 - side * .075)
                else:  # low squat, one knee higher than the other
                    knee = (side * .239, .265 + side * .065, .251)
                    ankle = (side * .262, .084, .295 - side * .035)
                sw = (.095 if jacket in (0, 2) else .086) * width * size
                bodies.append(limb(place(hip), place(knee), sw * 1.26, sw, pants))
                bodies.append(limb(place(knee), place(ankle), sw, sw * .74, pants))
                blob((ankle[0], .043, ankle[2] + .042), (.085, .043, .141), '#453e3d')
                blob((ankle[0], .073, ankle[2] + .049), (.086, .055, .138), shoe)
                blob((ankle[0], .106, ankle[2] + .055), (.063, .010, .043), '#ddd1bb', 6, 4)
                shoulder = (side * tw * .93, shoulders - .031, leaning - .034)
                if row and (i + group_no) % 3 == 1:  # folded arms are a deliberate resting pose
                    elbow = (side * (tw + .077), shoulders - .249 - side * .037, leaning + .047)
                    wrist = (-side * .066, shoulders - .168 - side * .057, leaning + .142)
                elif row and (i + group_no) % 3 == 2:  # relaxed hands together, below the waist
                    elbow = (side * (tw + .041), shoulders - .285, .026)
                    wrist = (side * .062, hips - .102 - side * .052, .187)
                elif row:
                    elbow = (side * (tw + .051), shoulders - .281, .006)
                    wrist = (side * (tw + .025), hips - .199 + side * .021, .052)
                else:
                    elbow = (side * (tw + .055), max(.155, knee[1] + .057), leaning + .046)
                    wrist = (knee[0] * .83, knee[1] + .058, knee[2] + .04)
                # Coordinates are local to the spectator marker, in Three.js (Y-up) order.
                arm_bones.extend(round(v * size, 4) for point in (shoulder, elbow, wrist) for v in point)
            marker = bpy.data.objects.new(f'spectator-{number:02}', None)
            bpy.context.collection.objects.link(marker)
            marker.location = xyz((x, 0, z))
            marker.rotation_euler.z = yaw
            marker['arms'] = arm_bones
            marker['top'] = top
            marker['skin'] = skin
            marker['cut'] = jacket
            marker['side'] = number % 2
            marker['seated'] = row == 0
            marker['size'] = size
            markers.append(marker)
            poses.append((marker, x, z, yaw, arm_bones, top, skin, jacket))

# Bake the entire static audience into one vertex-colored mesh. Three instanced
# batches render the articulated cloth and hands, using the same points as the study.
for piece in bodies:
    colors = piece.data.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
    color = piece.data.materials[0].diffuse_color
    for vertex in colors.data:
        vertex.color = color
body = join_parts(bodies, 'crowd-body')
body.data.materials.clear()
body.data.materials.append(material('#ffffff'))
body.data.color_attributes.active_color = body.data.color_attributes['Col']


def arm_template(name, profiles):
    return loft(name, (0, 0, 0), (0, 1, 0), profiles, '#ffffff', 8)


sleeve = arm_template('crowd-sleeve', [(0,.80,.86),(.19,1,1),(.75,.86,.87),(1,.72,.76)])
forearm = arm_template('crowd-forearm', [(0,.91,.95),(.16,.96,1),(.74,.72,.79),(1,.65,.72)])
hand = arm_template('crowd-hand', [(0,.54,.62),(.34,.86,.75),(.70,.79,.69),(.94,.53,.48),(1,.21,.28)])
for obj in [sleeve, forearm, hand, *markers]:
    obj.select_set(True)
asset = BASE / 'anim/club-audience.glb'
bpy.ops.export_scene.gltf(filepath=str(asset), use_selection=True,
                         export_extras=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                         export_texcoords=False, export_normals=True, export_yup=True)


# Float attributes from Blender cost more than the entire reusable arm geometry.
# Keep a standard glTF file and quantize the static crowd to roughly 0.25 mm.
raw = asset.read_bytes()
json_width = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20 + json_width])
source = raw[28 + json_width:]
body_node = next(node for node in gltf['nodes'] if node.get('name') == 'crowd-body')
attributes = gltf['meshes'][body_node['mesh']]['primitives'][0]['attributes']
quantized = {}
for tag, (storage, component, limit, meters) in {'POSITION': ('h', 5122, 32767, 8), 'NORMAL': ('b', 5120, 127, 1)}.items():
    accessor = gltf['accessors'][attributes[tag]]
    view = gltf['bufferViews'][accessor['bufferView']]
    vectors = struct.iter_unpack('<fff', source[view.get('byteOffset', 0):][:view['byteLength']])
    values = [round(value * limit / meters) for vector in vectors for value in vector]
    assert all(-limit <= value <= limit for value in values)
    stride = struct.Struct('<3' + storage + ('xx' if storage == 'h' else 'x'))
    quantized[accessor['bufferView']] = b''.join(stride.pack(*values[i:i + 3]) for i in range(0, len(values), 3))
    view['byteStride'] = stride.size
    accessor.update(componentType=component, normalized=True)
    for bound in ['min', 'max']:
        if bound in accessor:
            accessor[bound] = [round(value * limit / meters) for value in accessor[bound]]
body_node['scale'] = [8, 8, 8]
gltf['extensionsUsed'] = ['KHR_mesh_quantization']
gltf['extensionsRequired'] = ['KHR_mesh_quantization']
bin_data = bytearray()
for index, view in enumerate(gltf['bufferViews']):
    at = view.get('byteOffset', 0)
    block_data = quantized.get(index, source[at:at + view['byteLength']])
    view.update(byteOffset=len(bin_data), byteLength=len(block_data))
    bin_data += block_data
    bin_data += bytes(-len(bin_data) % 4)
gltf['buffers'][0]['byteLength'] = len(bin_data)
json_data = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
json_data += b' ' * (-len(json_data) % 4)
asset.write_bytes(struct.pack('<4sIIII', b'glTF', 2, 28 + len(json_data) + len(bin_data), len(json_data), 0x4e4f534a)
                  + json_data + struct.pack('<II', len(bin_data), 0x004e4942) + bin_data)

if args.no_render:
    sys.exit(0)

body_shader = body.data.materials[0].node_tree
vertex = body_shader.nodes.new('ShaderNodeVertexColor')
vertex.layer_name = 'Col'
body_shader.links.new(vertex.outputs['Color'], body_shader.nodes.get('Principled BSDF').inputs['Base Color'])
for template in (sleeve, forearm, hand):
    template.hide_render = True


def display_arms(x, z, yaw, bones, top, skin, cut, size):
    for i in (0, 9):
        shoulder = posed(bones[i:i + 3], x, z, yaw)
        elbow = posed(bones[i + 3:i + 6], x, z, yaw)
        wrist = posed(bones[i + 6:i + 9], x, z, yaw)
        hand = Vector(wrist) + (Vector(wrist) - Vector(elbow)).normalized() * (.077 * size)
        limb(shoulder, elbow, .081 * size, .061 * size, top)
        limb(elbow, wrist, .060 * size, .047 * size, skin if cut == 3 else top)
        limb(wrist, hand, .045 * size, .036 * size, skin)


for marker, x, z, yaw, bones, top, skin, cut in poses:
    display_arms(x, z, yaw, bones, top, skin, cut, marker['size'])

# Block in the genuine club footprint and existing roles for the two reference views.
block((0, -.105, -.8), (19, .20, 17.4), '#303d43')
block((0, 1.8, -8.9), (19, 3.6, .38), '#354047')
for x in [-9.3, 9.3]:
    block((x, 1.4, -.5), (.34, 2.8, 17.8), '#354047')
block((0, .006, 5.67), (2.5, .012, 5.4), '#654046')
disk = loft('Parquet', (0,.003,FLOOR_Z),(0,.027,FLOOR_Z), [(0,3.85,3.85),(1,3.85,3.85)], '#93633e', 84)
for i in range(-11, 12):
    x = i * .323
    z_half = math.sqrt(3.84 ** 2 - x ** 2)
    block((x, .0278, FLOOR_Z), (.012, .006, z_half * 2), '#6d4a35')
for i in range(84):
    angle = math.tau * (i + .5) / 84
    block((3.78 * math.sin(angle), .031, FLOOR_Z + 3.78 * math.cos(angle)), (.294, .008, .042), '#b69160', angle)
block((5.75,.53,-4.62), (2.2,1.06,.86), '#644c3e', -1.2)
for x, z in [(5.92,-4.17),(5.55,-5.04)]:
    loft('Deck', (x,1.07,z),(x,1.115,z), [(0,.235,.235),(1,.235,.235)], '#1b272e', 24)
for i in range(7):
    a = (i - 3) * .26
    x, z = -4.72 * math.cos(a), FLOOR_Z + 4.72 * math.sin(a)
    # Existing competitors are drawn in light tracksuits in the study.
    ellipsoid((x, 1.13, z), (.20,.45,.19), ['#b99255','#9c9091','#728d99'][i%3])
    ellipsoid((x, 1.67, z), (.127,.142,.118), '#b78168')
    for s in [-1, 1]:
        limb((x+s*.105,.77,z),(x+s*.113,.08,z+.01), .109,.076,'#52636c')
        limb((x+s*.175,1.35,z),(x+s*.225,.85,z), .071,.056,'#9c9091')
for x in [-1.18, 0, 1.18]:
    block((x,.37,-7.36), (.79,.70,.69), '#683b45')
    block((x,.81,-7.64), (.81,.82,.12), '#683b45')
    ellipsoid((x,.80,-7.30), (.193,.31,.18), '#4a6471')
    ellipsoid((x,1.17,-7.26), (.118,.14,.116), '#b78168')
    for sign in [-1, 1]:
        limb((x+sign*.13,.63,-7.2),(x+sign*.15,.51,-6.96), .105,.090,'#30343a')
        limb((x+sign*.15,.51,-6.96),(x+sign*.15,.068,-6.91), .080,.063,'#30343a')


def area(name, position, target, color, power, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = power, srgb(color)[:3], 'DISK', size
    lamp = bpy.data.objects.new(name, data)
    scene.collection.objects.link(lamp)
    lamp.location = xyz(position)
    lamp.rotation_euler = (xyz(target) - lamp.location).to_track_quat('-Z','Y').to_euler()


area('Warm floor key', (-1.8,6.0,1.0), (0,0,FLOOR_Z), '#ffddae', 2500, 5.0)
area('Cyan side pools', (6.8,3.7,-5.0), (2,0,-3.0), '#9acfe5', 2400, 5.7)
area('Back bar', (-5.5,4.1,-7.7), (-3,0,-3.6), '#92c6d3', 1800, 4.2)
scene.world.color = (.15,.15,.15)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = False
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_x, scene.render.resolution_y = 1250, 850
scene.render.resolution_percentage = 100


def shot(name, position, target, lens, scale=None):
    data = bpy.data.cameras.new(name)
    camera = bpy.data.objects.new(name, data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.location = xyz(position)
    camera.rotation_euler = (xyz(target) - camera.location).to_track_quat('-Z','Y').to_euler()
    data.lens = lens
    if scale:
        data.type, data.ortho_scale = 'ORTHO', scale
    scene.render.filepath = str(args.out / f'{name}.png')
    bpy.ops.render.render(write_still=True)


scene.render.resolution_y = 1040
shot('club-audience-plan', (0,17,-.62),(0,0,-.65),46,19.3)
scene.render.resolution_y = 850
shot('club-audience-viewer', (-.6,3.15,6.0),(.35,.28,-2.6),32)
