"""Bake the city character anatomy in Blender and export its game data.

blender -b -t 4 --python-exit-code 1 --python tools/build_city_anatomy.py -- /path/to/studio
"""
import ast
import json
import math
from pathlib import Path
import re
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
STUDIO = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else None
FINGER_SIDES = 10
X_STEP, Y_START, Y_STEP = .003, -.045, .0025
COLUMNS, ROWS = 31, 83


def bell(value, width):
    return math.exp(-(value / width) ** 2)


def smooth(lo, hi, value):
    t = min(1, max(0, (value - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


def sculpt(x, y):
    """Relief and pigmentation painted on the front of the head, in metres."""
    side = abs(x)
    bridge = .014 * bell(x, .010) * bell(y - .083, .029)
    tip = .019 * bell(x, .015) * bell(y - .061, .017)
    wing = bell(side - .014, .007) * bell(y - .051, .008)
    nostril = bell(side - .011, .0034) * bell(y - .046, .0028)
    temple = bell(side - .061, .017) * bell(y - .119, .023)
    eye = bell(side - .035, .0195) * bell(y - .102, .0105)
    brow = bell(side - .035, .026) * bell(y - .121, .008)
    cheek = bell(side - .049, .020) * bell(y - .078, .014)
    jaw = bell(side - .046, .025) * bell(y - .019, .022)
    chin = bell(x, .028) * bell(y - .000, .015)
    philtrum = bell(x, .0040) * bell(y - .038, .006)
    lip_width = 1 - smooth(.009, .030, side)
    line_y = .0235 + .0018 * bell(side - .009, .005) - .0012 * (side / .030) ** 2
    upper = lip_width * bell(y - line_y - .0030, .0038)
    lower = lip_width * bell(y - line_y + .0041, .0042)
    seam = lip_width * bell(y - line_y, .0019)
    corners = bell(side - .027, .004) * bell(y - .023, .0035)
    under_lip = bell(x, .021) * bell(y - .011, .004)
    relief = (bridge + tip + .007 * wing - .004 * nostril + .0065 * brow - .0080 * eye
              - .003 * temple + .006 * cheek + .004 * jaw + .007 * chin - .0015 * philtrum
              + .0045 * upper + .006 * lower - .0028 * seam - .002 * under_lip)
    shade = -.28 * nostril - .31 * seam - .19 * corners - .09 * eye - .047 * under_lip
    lip = .57 * upper + .43 * lower
    return relief, shade + .08 * lip, shade - .38 * lip - .036 * cheek, shade - .24 * lip - .02 * cheek


def hand_vertices():
    vertices, triangles, materials, contacts = [], [], [], []

    def add_triangle(a, b, c, slot):
        triangles.append((a, b, c))
        materials.append(slot)

    def digit(points, radii):
        points = list(map(Vector, points))
        start = len(vertices)
        bases = []
        for index, (point, (w, h)) in enumerate(zip(points, radii)):
            along = (points[min(index + 1, len(points)-1)] - points[max(0, index-1)]).normalized()
            across = along.cross(Vector((0, 0, 1))).normalized()
            high = across.cross(along).normalized()
            bases.append((across, high))
            for j in range(FINGER_SIDES):
                angle = math.tau * j / FINGER_SIDES
                vertices.append(point + across * (w * math.cos(angle)) + high * (h * math.sin(angle)))
        for row in range(len(points)-1):
            for j in range(FINGER_SIDES):
                a = start + row * FINGER_SIDES + j
                b = start + row * FINGER_SIDES + (j + 1) % FINGER_SIDES
                slot = 0 if row < 2 else 1
                add_triangle(a, a + FINGER_SIDES, b, slot)
                add_triangle(b, a + FINGER_SIDES, b + FINGER_SIDES, slot)
        for row, reverse in [(0, True), (len(points)-1, False)]:
            center = len(vertices)
            vertices.append(points[row])
            for j in range(FINGER_SIDES):
                a = start + row * FINGER_SIDES + j
                b = start + row * FINGER_SIDES + (j+1) % FINGER_SIDES
                add_triangle(center, a if reverse else b, b if reverse else a, 0 if reverse else 1)

        # Nail patches follow the last phalanx, across the curved dorsal surface.
        nail_start = len(vertices)
        for between in (.03, .42, .87):
            point = points[-3].lerp(points[-2], between)
            across = bases[-3][0].lerp(bases[-2][0], between)
            high = bases[-3][1].lerp(bases[-2][1], between)
            w = (1-between)*radii[-3][0] + between*radii[-2][0]
            h = (1-between)*radii[-3][1] + between*radii[-2][1]
            for x in (-.59, 0, .59):
                vertices.append(point + across * (x*w) + high * (h*(1 - .46*x*x) + .00072))
        for row in (0, 1):
            for col in (0, 1):
                a = nail_start + 3*row + col
                add_triangle(a, a+1, a+3, 2)
                add_triangle(a+1, a+4, a+3, 2)
        contacts.append([*points[-2], radii[-2][0]])
        contacts.append([*points[2], min(radii[2])])

    for x, y, length, spread, curl, w in [
        (-.034, .064, .042, -.010, .023, .0084),
        (-.012, .069, .053, -.004, .027, .0096),
        (.012, .072, .057, .003, .028, .0100),
        (.034, .067, .052, .012, .022, .0097),
    ]:
        steps = [(0, 0, 0, 1), (.22, .25, .03, .99), (.48, .57, .23, .90),
                 (.70, .80, .52, .80), (.91, .97, .85, .69), (1, 1, 1, .23)]
        digit([(x + spread*s, y + length*a, -.003 - curl*b) for a,s,b,_ in steps],
              [(w*r, .84*w*r) for _,_,_,r in steps])
    digit([(.026,.023,-.003), (.047,.037,-.006), (.056,.052,-.012),
           (.064,.066,-.017), (.069,.075,-.021), (.071,.079,-.024)],
          [(.015,.016), (.014,.0125), (.011,.010), (.0095,.008), (.008,.0065), (.003,.003)])
    return vertices, triangles, materials, contacts


def game_packet(hand):
    verts, tris, slots, contacts = hand
    return {
        "hand": {
            "positions": [round(c * 10000) for v in verts for c in v],
            "indices": [i for f in tris for i in f],
            "slots": slots,
            "contacts": [[round(x * 10000) for x in row] for row in contacts],
        },
        "face": {
            "cols": COLUMNS, "rows": ROWS, "xStep": X_STEP, "yStep": Y_STEP, "yStart": Y_START,
            "samples": [round(v * 10000) for j in range(ROWS) for i in range(COLUMNS)
                        for v in sculpt(i * X_STEP, Y_START + j * Y_STEP)],
        },
    }


def mesh(name, verts, faces, palette, slots=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    for material in palette:
        data.materials.append(material)
    for index, p in enumerate(data.polygons):
        p.use_smooth = True
        if slots:
            p.material_index = slots[index]
    return obj


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .66
    return mat


def blender_studio(hand):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    skin = material("Warm skin", (.52, .27, .16))
    nail = material("Nail", (.65, .38, .27))
    glove = material("Fingerless glove", (.065, .083, .094))
    verts, faces, slots, _ = hand

    for index, (title, center, angle) in enumerate([
            ("Back of the hand", (.18, .01, .102), -.29),
            ("Palm and fingerless glove", (.39, .012, .099), .24),
    ]):
        def place(v):
            x, y, z = v
            if index:
                x, z = -x, -z
            return (center[0] + x*math.cos(angle) - y*math.sin(angle), center[1] - z,
                    center[2] + x*math.sin(angle) + y*math.cos(angle))

        mesh(title, [place(v) for v in verts], faces, [glove if index else skin, skin, nail], slots)
        rows = [(-.020,.033,.026),(.018,.037,.024),(.047,.045,.019),(.067,.043,.017),(.081,.032,.013),(.087,.014,.006)]
        palm = [(w*math.cos(i*math.tau/24), y, h*math.sin(i*math.tau/24)-.004)
                for y,w,h in rows for i in range(24)]
        panels = [(a*24+i,(a+1)*24+i,(a+1)*24+(i+1)%24,a*24+(i+1)%24)
                  for a in range(len(rows)-1) for i in range(24)]
        panels.extend([tuple(range(24)), tuple(reversed(range(len(palm)-24,len(palm))))])
        mesh(title + " palm", [place(v) for v in palm], panels, [glove if index else skin])

    # Use the same skull envelope and relief as the game, including under hats.
    source = (ROOT / "city3d-head.js").read_text()
    skull = ast.literal_eval(re.search(r'const SKULL = (\[.*?\]);', source, re.S)[1])
    head_x = -.12
    def face_point(y, a):
        i = next((i for i in range(1,len(skull)) if y <= skull[i][0]), len(skull)-1)
        lo, hi = skull[i-1:i+1]
        previous, following = skull[max(0,i-2)], skull[min(i+1,len(skull)-1)]
        k = max(0, min(1, (y-lo[0])/(hi[0]-lo[0])))
        blend = k*k*(3-2*k)
        span = hi[0]-lo[0]
        envelope = []
        for j in range(1,5):
            entering = (hi[j]-previous[j])/(hi[0]-previous[0])
            leaving = (following[j]-lo[j])/(following[0]-lo[0])
            envelope.append(lo[j]*(1-blend) + hi[j]*blend + span*k*(1-k)*(entering*(1-k)-leaving*k))
        front, back, w, mid = envelope
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c)**.91, c)*w
        z = mid + (front-mid)*s**(.69+.24*smooth(.102,.163,y)) if s >= 0 else mid - (mid-back)*(-s)**.87
        r, *tone = sculpt(x,y)
        return (head_x+x, -z - r*max(0,s)**3, y+.11), tone, max(0,s)

    samples = [face_point(-.048 + .292*j/96, i*math.tau/112) for j in range(97) for i in range(112)]
    faces = [(j*112+i, (j+1)*112+i, (j+1)*112+(i+1)%112, j*112+(i+1)%112)
             for j in range(96) for i in range(112)]
    faces.extend([tuple(range(112)), tuple(reversed(range(len(samples)-112,len(samples))))])
    head = mesh("Sculpted face", [p for p,_,_ in samples], faces, [skin])
    pigmentation = head.data.color_attributes.new(name="Skin pigmentation", type='FLOAT_COLOR', domain='POINT')
    for i, (_, tone, s) in enumerate(samples):
        pigment = [(1 + channel*s**3)*base for channel,base in zip(tone,(.52,.27,.16))]
        pigmentation.data[i].color = (*pigment, 1)
    facial_skin = skin.copy()
    facial_skin.name = "Painted face"
    head.data.materials[0] = facial_skin
    palette = facial_skin.node_tree.nodes.new('ShaderNodeVertexColor')
    palette.layer_name = pigmentation.name
    facial_skin.node_tree.links.new(palette.outputs["Color"], facial_skin.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    sclera = material("Eye white", (.62,.54,.43))
    iris = material("Dark iris", (.11,.055,.03))
    lid = material("Lid and eyebrow", (.15,.062,.037))
    for sign in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16,
            location=(head_x + sign*.082, .037, .186), scale=(.015,.019,.030))
        ear = bpy.context.object
        ear.name = "Outer ear"
        ear.data.materials.append(skin)
        for p in ear.data.polygons:
            p.use_smooth = True

    def surface(x, y):
        lo, hi = 0, math.pi/2
        for _ in range(20):
            angle = (lo+hi)/2
            p, _, _ = face_point(y, angle)
            if p[0]-head_x > abs(x):
                lo = angle
            else:
                hi = angle
        return face_point(y, (lo+hi)/2)[0][1]

    def eye(label, x, y, w, h, raise_by, color):
        verts = [(head_x+x,surface(x,y)-raise_by,y+.11)]
        for i in range(28):
            a = i*math.tau/28
            dx,dy=w*math.cos(a),h*math.sin(a)
            verts.append((head_x+x+dx, surface(x+dx,y+dy)-raise_by, y+dy+.11))
        mesh(label, verts, [(0,i+1,(i+1)%28+1) for i in range(28)], [color])

    for sign in (-1, 1):
        x = sign*.035
        eye("Eyelid",x,.102,.0157,.0069,.0019,lid)
        eye("Sclera",x,.102,.0133,.0050,.0031,sclera)
        eye("Iris",x,.102,.0052,.0048,.0044,iris)
        eye("Pupil",x,.102,.00255,.00315,.0051,lid)
        eye("Catchlight",x-.0016,.1036,.0011,.0011,.0059,sclera)
        eye("Eyebrow",x,.125,.0173,.0025,.0030,lid)

    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Studio haze")
    scene.world.color = (.18,.18,.18)

    def aim(obj, target):
        obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()

    backdrop = material("Charcoal backdrop", (.026,.040,.055))
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,.28,.17), rotation=(math.pi/2,0,0))
    bpy.context.object.name = "Backdrop"
    bpy.context.object.data.materials.append(backdrop)
    for name, position, power, size, tint in [
            ("Key",(-.48,-.63,.65),15,.46,(1,.88,.77)),
            ("Fill",(.56,-.39,.34),9,.50,(.74,.84,1)),
            ("Rim",(.20,.04,.61),12,.35,(1,.93,.82)),
    ]:
        lamp = bpy.data.lights.new(name,'AREA')
        lamp.energy, lamp.size, lamp.color = power,size,tint
        obj = bpy.data.objects.new(name,lamp)
        bpy.context.collection.objects.link(obj)
        obj.location = position
        aim(obj,(.04,0,.18))
    camera = bpy.data.cameras.new("Anatomy studio camera")
    cam = bpy.data.objects.new(camera.name,camera)
    bpy.context.collection.objects.link(cam)
    cam.location = (.30,-1.23,.42)
    camera.type = 'ORTHO'
    camera.ortho_scale = .81
    aim(cam,(.105,0,.185))
    scene.camera = cam
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.taa_render_samples = 24
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1240, 660, 100
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
    STUDIO.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(STUDIO / "city-character-anatomy.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(STUDIO / "city-character-anatomy.blend"))
    bpy.ops.render.render(write_still=True)


hand = hand_vertices()
packet = json.dumps(game_packet(hand), separators=(",", ":"))
(ROOT / "city3d-anatomy.js").write_text("// Generated with Blender by tools/build_city_anatomy.py.\nexport const CITY_ANATOMY = " + packet + ";\n")
if STUDIO:
    blender_studio(hand)
