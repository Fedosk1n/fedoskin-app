"""Build the Park's play and workout corner in Blender 4.3.

blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/build_park_playground.py -- /tmp/playground
Copy park-playground.json to anim/ and convert playground-rubber.png to
img/playground-rubber.webp with ImageMagick (-strip -quality 86).
"""
from math import cos, pi, sin
from pathlib import Path
from random import Random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import export_scene, paint, point_at, srgb, studio

destination = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
objects = []

# Work in game metres with north at negative z. Export converts back to this system.
def xyz(x, y, z):
    return x, -z, y


def finish(ob, name, mat, bevel=0):
    ob.name = name
    ob.data.materials.append(mat)
    objects.append(ob)
    if bevel:
        mod = ob.modifiers.new("Rounded edges", "BEVEL")
        mod.width, mod.segments = bevel, 2
        mod = ob.modifiers.new("Weight face normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
    return ob


def box(name, loc, dimensions, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(*loc))
    ob = bpy.context.object
    ob.dimensions = xyz(dimensions[0], dimensions[1], -dimensions[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, name, mat, bevel)


def solid(name, points, faces, mat, bevel=0):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([xyz(*p) for p in points], [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    return finish(ob, name, mat, bevel)


def rod(name, a, b, radius, mat, sides=12, radius_top=None):
    start, end = Vector(xyz(*a)), Vector(xyz(*b))
    direction = end - start
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=radius_top or radius,
                                  depth=direction.length, location=(start + end) / 2)
    ob = bpy.context.object
    ob.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    for face in ob.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return finish(ob, name, mat)


def vertical(name, x, z, bottom, top, r, mat, sides=12, top_radius=None):
    return rod(name, (x, bottom, z), (x, top, z), r, mat, sides, top_radius)


def tube(name, route, radius, mat, sides=10):
    # The guard cap and play rails have a continuous smooth cross-section at each bend.
    pts = [Vector(xyz(*p)) for p in route]
    positions, faces = [], []
    up = Vector((0, 0, 1))
    for i, p in enumerate(pts):
        t = (pts[min(i+1, len(pts)-1)] - pts[max(0, i-1)]).normalized()
        ref = up if abs(t.dot(up)) < .94 else Vector((0, 1, 0))
        u = t.cross(ref).normalized()
        if i and u.dot(last) < 0:
            u.negate()
        v = t.cross(u).normalized()
        last = u
        for k in range(sides):
            a = k * 2*pi / sides
            q = p + radius * (u * cos(a) + v * sin(a))
            positions.append((q.x, q.z, -q.y))
    for i in range(len(pts)-1):
        for k in range(sides):
            j = (k+1) % sides
            faces.append((i*sides+k, i*sides+j, (i+1)*sides+j, (i+1)*sides+k))
    faces += [tuple(reversed(range(sides))), tuple((len(pts)-1)*sides+k for k in range(sides))]
    ob = solid(name, positions, faces, mat)
    for face in ob.data.polygons[:-2]:
        face.use_smooth = True
    return ob


rubber = paint("Poured rubber aggregate", "ffffff", "playground rubber", .95)
edge = paint("Charcoal cast border", "575957")
frame = paint("Deep teal powder coat", "1d4a46", roughness=.65)
frame_highlight = paint("Rounded teal panel", "28746f", roughness=.65)
bronze = paint("Weathered bronze posts", "786257", roughness=.65)
steel = paint("Brushed steel rails", "a2b2b1", "brushed steel", .32, .52)
fastener = paint("Dark galvanised steel", "414d53", "brushed steel", .32, .52)
orange = paint("Burnt orange enamel", "ca6230", "enamel", .48, .15)
copper = paint("Warm enamel highlights", "e39048", "enamel", .48, .15)
amber = paint("Amber rubber and collars", "d5a23b", "enamel", .48, .15)
sand = paint("Dune rubber", "dbb985", roughness=.82)
plank = [paint("Sealed timber " + color, color) for color in ("936944", "a47750", "795638")]
line = paint("Warm white rubber inlay", "bdb397", roughness=.91)
fine_line = paint("Muted ochre inlay", "ba935d", roughness=.91)

# The same outline is used for the top, cast edge and smooth entry at ground level.
width, depth = 5.22, 5.16
def rounded(w, d, r):
    points = []
    for sx, sz, start in ((1, 1, 0), (-1, 1, pi/2), (-1, -1, pi), (1, -1, 1.5*pi)):
        for i in range(7):
            a = start + i * pi/12
            points.append((sx * (w/2-r) + r*cos(a), sz * (d/2-r) + r*sin(a)))
    return points


outline = rounded(width-.13, depth-.13, .49)
top = solid("Poured rubber top", [(x, .027, z) for x, z in outline], [tuple(reversed(range(len(outline))))], rubber)
uv = top.data.uv_layers.new()
for loop in top.data.loops:
    x, y, _ = top.data.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = (x/width+.5, y/depth+.5)

rings = []
for inset, y in ((0, -.009), (0, .024), (.055, .034), (.074, .020)):
    rings.extend((x, y, z) for x, z in rounded(width-inset*2, depth-inset*2, .56-inset))
N = len(outline)
solid("Rubber pad perimeter", rings, [((i+1)*N+k, (i+1)*N+(k+1)%N, i*N+(k+1)%N, i*N+k)
    for i in range(3) for k in range(N)], edge)


def arc(name, x, z, r, thickness, start, end, mat):
    angles = [start+(end-start)*i/24 for i in range(25)]
    pts = [(x + cos(a)*rr, .029, z + sin(a)*rr) for rr in (r, r+thickness) for a in angles]
    solid(name, pts, [(i, i+1, i+26, i+25) for i in range(24)], mat)


# Mark the free footwork spot and the two entries without putting text in the paving.
for a, b in ((.12, .97), (1.22, 2.86), (3.43, 4.11), (4.42, 6.06)):
    arc("Footwork circle", .12, .70, .76, .039, a, b, line)
arc("Inner counterstep", .12, .70, .54, .026, -2.7, -.3, fine_line)
for x, z in ((.12, 1.64), (.12, 1.95), (.12, 2.26)):
    for side in (-1, 1):
        m = box("Entry chevron", (x+.09*side, .029, z), (.19, .005, .038), line)
        m.rotation_euler.z = .42 * side
for z in (1.58, 1.82, 2.06):
    box("East entry dashes", (2.36, .029, z), (.15, .005, .035), line)
for x in (-.25, .30):
    box("Low stone apron to the promenade", (x, .006, 2.77), (.51, .025, .28), edge, .012)
# Short landing marks in front of the slide mouth.
for i in range(3):
    box("Slide landing ticks", (-1.76 + i*.21, .029, .97), (.12, .005, .037), fine_line)


def post(x, z, top, collar, radius=.057, coat=frame):
    vertical("Ground socket", x, z, .026, .095, radius*1.46, fastener)
    vertical("Steel upright", x, z, .09, top, radius, coat, 12)
    vertical("Contrast collar", x, z, top-.18, top-.115, radius*1.11, collar)
    vertical("Rounded post plug", x, z, top-.018, top+.018, radius*1.02, fastener, 12, radius*.86)


# West play tower. Its deck is low enough to read underneath the Park camera.
for x in (-1.91, -.80):
    for z in (-2.18, -1.25):
        post(x, z, 1.91, amber, .072, bronze if (x > -1.4) == (z > -1.5) else frame)
for i in range(6):
    box("Deck board", (-1.355, 1.22, -2.12+i*.163), (1.23, .075, .151), plank[i%3], .014)
box("Deck subframe", (-1.355, 1.146, -1.70), (1.18, .10, .94), fastener, .024)
for x in (-1.91, -.80):
    rod("Tower diagonal brace", (x, .70, -1.33), (x, 1.13, -2.10), .025, fastener)
    rod("Tower diagonal brace", (x, .70, -2.10), (x, 1.13, -1.33), .025, fastener)


def guard(name, center, size, axis):
    # Perforations are geometry so the opposite side remains visible.
    height, length = size
    dims = (length, height, .058) if axis == "x" else (.058, height, length)
    ob = box(name, center, dims, frame_highlight)
    for i in range(3):
        c = list(center)
        c[0 if axis == "x" else 2] += (i-1)*.23
        c[1] += .027 if i == 1 else -.028
        off = [0, 0, 0]
        off[2 if axis == "x" else 0] = .09
        tool = rod("Punch template", tuple(v-d for v, d in zip(c, off)), tuple(v+d for v, d in zip(c, off)), .067, frame, 14)
        mod = ob.modifiers.new("Circular cutout", "BOOLEAN")
        mod.operation, mod.object = "DIFFERENCE", tool
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        objects.remove(tool)
        bpy.data.objects.remove(tool, do_unlink=True)
    mod = ob.modifiers.new("Safe guard bevel", "BEVEL")
    mod.width, mod.segments = .014, 2
    return ob


guard("Perforated back guard", (-1.355, 1.59, -2.19), (.48, 1.00), "x")
guard("Perforated outer side", (-1.91, 1.59, -1.72), (.48, .83), "z")
rod("Guard cap", (-1.91, 1.88, -2.18), (-.80, 1.88, -2.18), .033, sand)
rod("Side guard cap", (-1.91, 1.88, -2.18), (-1.91, 1.88, -1.25), .033, sand)

# Small side ladder: rails and treads are separate editable Blender objects.
for z in (-2.12, -1.68):
    rod("Inclined access ladder rail", (-.19, .03, z), (-.80, 1.49, z), .035, frame_highlight)
    tube("Curved ladder handrail", [(-.16,.62,z),(-.20,.79,z),(-.31,1.04,z),(-.66,1.63,z),(-.74,1.70,z),(-.84,1.71,z)], .025, bronze)
    rod("Handrail stanchion", (-.22, .14, z), (-.22, .80, z), .023, bronze)
for j in range(5):
    y = .23 + j*.215
    x = -.19 - (y-.03)/1.46*.61
    box("Ladder timber tread", (x, y, -1.90), (.19, .043, .48), plank[j%3], .018)
    rod("Non-slip ladder leading edge", (x+.095, y+.014, -2.12), (x+.095, y+.014, -1.68), .013, fastener)

# Smooth slide profile with raised cheeks and rounded outer edge tubes.
profile = [(-1.28, 1.235), (-1.09, 1.22), (-.91, 1.155), (-.71, 1.03),
           (-.47, .86), (-.20, .641), (.08, .426), (.34, .270), (.57, .198), (.77, .184)]
sections = [(-.371, .104), (-.345, .036), (-.30, 0), (0, -.019), (.30, 0), (.345, .036), (.371, .104)]
slide = solid("Curved powder-coated chute", [(-1.36 + dx, y+h, z) for z, y in profile for dx, h in sections],
    [(i*7+k, (i+1)*7+k, (i+1)*7+k+1, i*7+k+1) for i in range(len(profile)-1) for k in range(6)], orange)
for face in slide.data.polygons:
    face.use_smooth = True
mod = slide.modifiers.new("Rolled metal thickness", "SOLIDIFY")
mod.thickness = .026
for side in (-1, 1):
    tube("Rounded chute rim", [(-1.36+side*.371, y+.105, z) for z, y in profile], .026, copper)
    rod("Chute entry rail", (-1.36+side*.4, 1.50, -1.37), (-1.36+side*.37, 1.36, -.93), .032, copper)
    vertical("Chute footing", -1.36+side*.25, .43, .03, .23, .05, fastener)
box("Slide end cap", (-1.36, .158, .77), (.635, .063, .051), copper, .027)

# The workout frame stays to the east and north sides of the rubber pad.
for x, z, h in ((.40, -1.38, 2.20), (1.41, -1.38, 2.20), (2.16, -1.38, 1.67)):
    post(x, z, h, amber, .067)
    y = min(h-.33, 1.18)
    rod("Side grip", (x, y, z), (x, y, z+.20), .027, steel)
    rod("Side grip end stop", (x, y, z+.17), (x, y, z+.21), .037, fastener)
for left, right, y in ((.40, 1.41, 2.07), (1.41, 2.16, 1.54)):
    rod("Brushed-steel pull-up bar", (left, y, -1.38), (right, y, -1.38), .028, steel)
    for x in (left+.22, right-.22):
        rod("Textured pull-up grip", (x-.07, y, -1.38), (x+.07, y, -1.38), .035, fastener)
for x in (1.52, 2.06):
    for z in (-.56, .86):
        post(x, z, .92, amber, .040)
    tube("Parallel dip rail", [(x, y, z) for z, y in ((-.73,.87),(-.67,.92),(-.53,.94),(.83,.94),(.97,.92),(1.02,.87))], .035, steel)
    for z in (-.22, .22):
        rod("Dip grip sleeve", (x, .94, z-.097), (x, .94, z+.097), .040, frame_highlight)
# Low seat set along the rear edge, behind the equipment.
for x in (.67, 2.14):
    for z in (-2.39, -2.09):
        vertical("Bench mounting foot", x, z, .029, .36, .033, fastener, 8)
for i in range(3):
    box("Bench slat", (1.40, .38, -2.40+i*.151), (1.75, .069, .132), plank[i], .022)

# Three low stepping pods catch the glow by the entrance.
for x, z, h, col in ((-2.01, 1.44, .16, amber), (-1.55, 1.85, .26, sand), (-1.10, 2.11, .19, frame_highlight)):
    vertical("Balance pod base", x, z, .028, h-.015, .207, frame, 16, .178)
    vertical("Balance pod bumper", x, z, h-.033, h, .197, fastener, 16, .207)
    vertical("Colour-coded textured step", x, z, h-.004, h+.031, .207, col, 16, .182)
    for k in range(7):
        a = k * 2*pi/7
        vertical("Step grip nub", x + cos(a)*.103, z + sin(a)*.103, h+.028, h+.036, .012, edge, 6)

export_scene(destination / "park-playground.json", "Park playground", objects, textured={"playground rubber"})

# Blender node graph used for the rubber preview and the color bake.
graph = rubber.node_tree
def connect(value, socket):
    if isinstance(value, bpy.types.NodeSocket):
        graph.links.new(value, socket)
    else:
        socket.default_value = value


def math(op, *values):
    n = graph.nodes.new("ShaderNodeMath")
    n.operation = op
    for socket, value in zip(n.inputs, values):
        connect(value, socket)
    return n.outputs[0]


def noise(vec, scale, detail, label):
    n = graph.nodes.new("ShaderNodeTexNoise")
    n.label = label
    connect(vec, n.inputs["Vector"])
    n.inputs["Scale"].default_value, n.inputs["Detail"].default_value = scale, detail
    return n.outputs["Fac"]


def ramp(value, stops, label):
    n = graph.nodes.new("ShaderNodeValToRGB")
    n.label = label
    connect(value, n.inputs[0])
    for i, (at, col) in enumerate(stops):
        elm = n.color_ramp.elements[i] if i < 2 else n.color_ramp.elements.new(at)
        elm.position = at
        elm.color = (*srgb(col), 1) if isinstance(col, str) else (col, col, col, 1)
    return n.outputs[0]


def mix(a, b, fac, mode="MIX"):
    n = graph.nodes.new("ShaderNodeMixRGB")
    n.blend_type = mode
    for socket, value in zip(n.inputs, (fac, a, b)):
        connect(value, socket)
    return n.outputs[0]


uv = graph.nodes.new("ShaderNodeTexCoord").outputs["UV"]
split = graph.nodes.new("ShaderNodeSeparateXYZ")
connect(uv, split.inputs[0])
u, v = split.outputs[:2]
wave = math("MULTIPLY", math("COSINE", math("MULTIPLY", math("SUBTRACT", v, .28), 4.4)), .115)
boundary = math("SUBTRACT", u, math("ADD", .274, wave))
west_edge = ramp(boundary, [(.0, 0.), (.003, 1.)], "West curved inlay")
rust = (*srgb("87472e"), 1)
green = (*srgb("245452"), 1)
base = mix(rust, green, west_edge)
pinstripe = ramp(math("ABSOLUTE", math("SUBTRACT", boundary, .022)), [(.006, .72), (.01, 0.)], "Seal around the inlay")
base = mix(base, (*srgb("c58658"), 1), pinstripe)
right_band = ramp(math("SUBTRACT", u, math("MULTIPLY", v, .16)), [(.65, 0.), (.654, 1.)], "Tonal workout strip")
base = mix(base, (*srgb("1d403a"), 1), right_band)
grain = noise(uv, 263, 1.5, "Coarse EPDM crumb")
grit = ramp(grain, [(.22, "343439"), (.50, "b1a397"), (.74, "e6d7be")], "Visible stone and rubber granules")
base = mix(base, grit, .41, "MULTIPLY")
weather = ramp(noise(uv, 12.2, 2, "Scuffed sports surface"), [(.22, .72), (.74, 1.)], "Patches of shoe abrasion")
base = mix(base, weather, .45, "MULTIPLY")
seam = math("ABSOLUTE", math("SUBTRACT", v, math("ADD", .718, math("MULTIPLY", u, .022))))
base = mix(base, (*srgb("161e20"), 1), ramp(seam, [(.0007, .36), (.0026, 0.)], "Expansion joint"))
pbr = graph.nodes.get("Principled BSDF")
connect(base, pbr.inputs["Base Color"])
bump = graph.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value, bump.inputs["Distance"].default_value = .34, .014
connect(grain, bump.inputs["Height"])
connect(bump.outputs["Normal"], pbr.inputs["Normal"])

world_meshes = list(objects)
for ob in world_meshes:
    ob.hide_render = True
quad = solid("Rubber bake target", [(-1, -4, -1), (-1, -4, 1), (1, -4, 1), (1, -4, -1)], [(0, 1, 2, 3)], rubber)
uv = quad.data.uv_layers.new()
for loop, coords in zip(uv.data, [(0, 1), (0, 0), (1, 0), (1, 1)]):
    loop.uv = coords
emit = graph.nodes.new("ShaderNodeEmission")
connect(base, emit.inputs[0])
output = graph.nodes.get("Material Output")
connect(emit.outputs[0], output.inputs["Surface"])
bpy.ops.object.camera_add(location=(0, 0, 3))
bake_camera = scene.camera = bpy.context.object
point_at(bake_camera, (0, 0, 0))
bake_camera.data.type = "ORTHO"
bake_camera.data.ortho_scale = 2
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(destination / "playground-rubber.png")
bpy.ops.render.render(write_still=True)
bpy.data.objects.remove(quad, do_unlink=True)
bpy.data.objects.remove(bake_camera, do_unlink=True)
graph.nodes.remove(emit)
connect(pbr.outputs[0], output.inputs["Surface"])
for ob in world_meshes:
    ob.hide_render = False

# A little park context is for the studio render only. Game alleys and lamps exist already.
terrain = paint("Dark park turf", "29382d")
gravel = paint("Fine gravel of park alleys", "71675b")
box("Grass under the playground", (0, -.08, 0), (27, .15, 27), terrain)
box("Gravel promenade at the entrance", (.6, -.007, 3.6), (14, .026, 1.55), gravel, .012)
box("Eastern gravel path", (3.65, -.008, -.15), (1.53, .025, 6.1), gravel, .011)
rng = Random(52)
canopies = [paint("Park foliage " + rgb, rgb) for rgb in ("263b2c", "344733", "4d5635")]
for x, z, h in ((-3.45, -3.66, 3.9), (3.52, -3.6, 4.35), (-5.0, -.25, 3.2)):
    vertical("Park tree trunk", x, z, -.04, h*.78, .14, plank[2], 10, .052)
    for _ in range(6):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rng.uniform(.78, 1.13),
            location=xyz(x+rng.uniform(-.85,.85), h+rng.uniform(-.50,.44), z+rng.uniform(-.52,.52)))
        finish(bpy.context.object, "Park tree crown", rng.choice(canopies))
for _ in range(18):
    x, z = rng.uniform(-4.2, 3.5), rng.uniform(-4.4, -2.9)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(.18,.54), location=xyz(x,.11,z))
    finish(bpy.context.object, "Grass verge planting", rng.choice(canopies))
vertical("Park lamp post", 3.45, -1.82, 0, 2.82, .055, fastener, 12, .03)
vertical("Park lamp crown", 3.45, -1.82, 2.81, 2.95, .16, frame, 12, .038)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=.119, location=xyz(3.45, 2.77, -1.82))
finish(bpy.context.object, "Warm park globe", paint("Lamp porcelain", "ffdbab", glow=3.2))
studio(scene, (5.45, -8.6, 7.9), (0, -.02, .45), 8.6, destination / "park-playground-blender.png")
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .3
bpy.data.lights["Warm key"].energy = 940
bpy.data.lights["Warm key"].color = srgb("ffc18a")
bpy.data.lights["Cool fill"].energy = 390
bpy.data.lights["Rim"].energy = 330
lamp = bpy.data.lights.new("Warm pool on the pad", "POINT")
lamp.color, lamp.energy, lamp.shadow_soft_size = srgb("ffc183"), 155, .38
lamp_obj = bpy.data.objects.new(lamp.name, lamp)
scene.collection.objects.link(lamp_obj)
lamp_obj.location = xyz(3.30, 2.65, -1.73)
scene.cycles.samples = 28
scene.cycles.use_denoising = False
scene.view_settings.view_transform = "AgX"
scene.render.resolution_x, scene.render.resolution_y = 1430, 1070
bpy.ops.wm.save_as_mainfile(filepath=str(destination / "park-playground.blend"))
bpy.ops.render.render(write_still=True)
