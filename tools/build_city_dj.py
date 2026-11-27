"""Build the DJ booth asset, editable scene and preview in Blender 4.3.

blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/build_city_dj.py -- /tmp/city-dj
Add --club after the output directory for the Club booth.
"""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import export_scene, paint, studio

args = sys.argv[sys.argv.index("--") + 1:]
destination = Path(args[0]).resolve()
club = "--club" in args
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

matte = lambda name, color: paint(name, color, "matte", .68, .04)
metal = lambda name, color: paint(name, color, "brushed metal", .36, .58)
rubber = lambda name, color: paint(name, color, "vinyl and rubber", .47, .03)
case = matte("Charcoal road-case plywood", "282932")
dark = matte("Dark graphite panels", "171922")
panel = matte("Perforated guard", "393c46")
side = matte("Vented side skirt", "202833")
silver = metal("Anodized silver", "737d8b")
trim = metal("Satin gunmetal", "414c50" if club else "38404d")
rub = rubber("Rubber corners and feet", "111319")
vinyl = paint("Vinyl", "252b2d", "club vinyl", .44, .15) if club else rubber("Vinyl", "10131c")
groove = rubber("Vinyl grooves", "293642")
amber = matte("Copper inner label", "d79451" if club else "d86739")
mint = matte("Teal inner sleeve", "65aba9")
white = matte("Printed scale and index stripe", "b7bfc0")
screen = matte("Muted screen", "183142")
yellow = paint("Amber power LEDs", "ff9b52", "amber LEDs", .52, 0, .56)
green = paint("Green-cyan level LEDs", "79d1b9", "teal LEDs", .52, 0, .41)
signal = paint("Front meter light", "edb56f" if club else "e96629", "front meter", .52, 0, .7)
objects, pivots = [], {}


def piece(ob, name, material, part):
    ob.name = name
    ob.data.materials.append(material)
    ob["part"] = part
    objects.append(ob)
    return ob


def block(name, loc, dims, mat, bevel=0, part="static"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new("Radiused edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    return piece(ob, name, mat, part)


def cylinder(name, loc, radius, depth, mat, sides=16, part="static"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth, location=loc)
    ob = bpy.context.object
    for polygon in ob.data.polygons:
        if len(polygon.vertices) == 4:
            polygon.use_smooth = True
    return piece(ob, name, mat, part)


def rod(name, a, b, radius, mat, sides=8, part="static"):
    a, b = Vector(a), Vector(b)
    ob = cylinder(name, (a + b) / 2, radius, (b - a).length, mat, sides, part)
    ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return ob


def annulus(name, x, y, z, radius, width, mat, part, count=32):
    vertices = [(x + r * cos(2*pi*i/count), y + r * sin(2*pi*i/count), z)
                for r in (radius, radius - width) for i in range(count)]
    polygons = [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], polygons)
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    return piece(ob, name, mat, part)


# A low, touring flight case on folding steel legs, front towards Blender -Y.
block("Case body", (0, 0, .865), (2.18, .88, .225), case, .035)
block("Recessed equipment tray", (0, 0, .975), (2.12, .83, .067), dark, .018)
for x in (-1.055, 1.055):
    for y in (-.415, .415):
        block("Protective rubber corner", (x, y, .875), (.15, .14, .214), rub, .038)
        block("Folding steel leg", (x * .88, y * .76, .37), (.066, .066, .73), trim, .012)
        block("Rubber floor pad", (x * .88, y * .76, .024), (.115, .115, .045), rub, .014)
    block("End rail", (x, 0, .956), (.045, .77, .035), silver, .009)
    block("Recessed carry handle", (x * 1.034, 0, .854), (.024, .22, .084), rub, .012)
    rod("Carry handle bar", (x * 1.052, -.085, .86), (x * 1.052, .085, .86), .016, silver)
for y in (-.439, .439):
    for z in (.783, .946):
        block("Aluminum edge extrusion", (0, y, z), (2.0, .026, .035), silver, .008)
block("Front grille frame", (0, -.448, .864), (1.68, .031, .134), trim, .014)
block("Black grille face", (0, -.468, .864), (1.59, .012, .096), panel, .008)


def grille_marks(name, plane, marks, material, part="static"):
    points, faces = [], []
    for x, z, w, h in marks:
        at = len(points)
        points.extend((x + w*dx, plane, z + h*dz) for dx, dz in ((-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)))
        faces.append(tuple(range(at, at+4)))
    data = bpy.data.meshes.new(name)
    data.from_pydata(points, [], faces)
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    piece(ob, name, material, part)


grille_marks("Perforated grille detail", -.475,
             ((-.752+i*.044, z, .023, .008) for i in range(34) for z in (.835, .855, .875, .895)), rub)
meters = []
for i in range(23):
    x = -.54 + i * .049
    peak = (.45 + .55 * sin((i + .4) * .68) ** 2) * (1 - .45 * abs(x) / .54)
    meters.append((x, .867, .014, .064 * peak))
grille_marks("Orange waveform on grille", -.477, meters, signal, "meter")
pivots["meter"] = (0, 0, 0)
for x in (-.93, .93):
    for y in (-.32, .32):
        rod("Leg brace", (x, y, .23), (x * .74, y * .77, .749), .018, trim)
block("Rear transverse crossbar", (0, .315, .33), (1.88, .048, .043), trim, .008)

for x, label, key in ((-.66, amber, "record-left"), (.66, mint, "record-right")):
    block("Turntable chassis", (x, -.019, 1.017), (.69, .72, .074), dark, .025)
    block("Brushed deck plate", (x, -.021, 1.057), (.648, .67, .03), trim, .017)
    deck_x, deck_y = x - .045, -.055
    cylinder("Bearing and milled platter rim", (deck_x, deck_y, 1.098), .275, .041, silver, 40)
    cylinder("Rubber slip mat", (deck_x, deck_y, 1.121), .260, .018, rub, 40)
    pivots[key] = (deck_x, deck_y, 1.135)
    disc = cylinder("Spinning vinyl", (deck_x, deck_y, 1.135), .25, .017, vinyl, 40, key)
    if club:
        for loop in disc.data.loops:
            point = disc.data.vertices[loop.vertex_index].co
            disc.data.uv_layers.active.data[loop.index].uv = (point.x / .5 + .5, point.y / .5 + .5)
    for radius in (.241, .225, .209, .191, .177, .155, .135):
        annulus("Pressed groove", deck_x, deck_y, 1.144, radius, .004, groove, key)
    cylinder("Printed label", (deck_x, deck_y, 1.1445), .088, .004, label, 28, key)
    annulus("Paper label rule", deck_x, deck_y, 1.147, .071, .004, white, key, 24)
    block("Scratch cue marker", (deck_x + .102, deck_y - .012, 1.147), (.031, .014, .004), white, .003, key)
    cylinder("Deck spindle", (deck_x, deck_y, 1.157), .009, .027, silver)
    arm_x = x + .262
    cylinder("Tonearm mount", (arm_x, .216, 1.128), .047, .105, trim)
    cylinder("Tonearm pivot cap", (arm_x, .216, 1.188), .035, .027, silver)
    rod("S-shaped tonearm first segment", (arm_x, .204, 1.19), (arm_x - .035, -.050, 1.179), .011, silver)
    rod("S-shaped tonearm second segment", (arm_x - .035, -.050, 1.179), (arm_x - .115, -.159, 1.161), .011, silver)
    cartridge = block("Stylus cartridge", (arm_x - .126, -.171, 1.158), (.063, .036, .025), dark, .005)
    cartridge.rotation_euler.z = -.55
    block("Start and stop", (x - .257, -.296, 1.087), (.09, .056, .019), rub, .008)
    block("Deck cue lamp", (x - .258, -.306, 1.100), (.031, .01, .006), yellow, .002)
    block("Pitch slider track", (x + .267, -.185, 1.083), (.024, .197, .009), rub, .003)
    block("Pitch slider control", (x + .267, -.169, 1.095), (.053, .034, .028), silver, .005)
    for i in range(4):
        block("Pitch calibration mark", (x + .222, -.251 + i * .051, 1.074), (.026, .006, .003), white)

block("Mixer shell", (0, -.026, 1.043), (.504, .724, .127), case, .024)
block("Mixer faceplate", (0, -.034, 1.112), (.472, .689, .026), panel, .012)
for side_x in (-.146, .146):
    for i in range(4):
        y = .213 - i * .077
        cylinder("Rotary EQ", (side_x, y, 1.149), .028, .057, rub, 12)
        block("EQ index", (side_x, y - .007, 1.178), (.008, .033, .006), white, .002)
    block("Channel fader slot", (side_x, -.193, 1.128), (.029, .192, .009), rub, .004)
    part = "fader-left" if side_x < 0 else "fader-right"
    cap = (side_x, -.204 if side_x < 0 else -.143, 1.145)
    pivots[part] = cap
    block("Channel fader cap", cap, (.074, .035, .030), silver, .006, part)
    block("Mix cue button", (side_x * .68, -.067, 1.135), (.046, .034, .021), yellow, .005)
for i in range(7):
    for x in (-.026, .026):
        block("VU meter", (x, .185 - i * .030, 1.13), (.018, .016, .009), yellow if i < 2 else green, .002)
block("Crossfader slot", (0, -.322, 1.129), (.303, .031, .009), rub, .004)
block("Crossfader cap", (.033, -.322, 1.145), (.049, .051, .029), silver, .007)

# Laptop on a compact rear shelf.
block("Laptop shelf", (-.72, .343, 1.143), (.51, .295, .033), trim, .009)
laptop_start = len(objects)
block("Laptop chassis", (-.72, .331, 1.179), (.437, .248, .024), silver, .008)
block("Keyboard inset", (-.72, .336, 1.193), (.374, .133, .006), dark, .006)
for i in range(3):
    for j in range(12):
        block("Keyboard key", (-.888 + j*.03, .296 + i*.042, 1.199), (.022, .025, .006), trim)
display = block("Angled laptop lid", (-.72, .475, 1.305), (.437, .028, .259), trim, .008)
display.rotation_euler.x = -.27
screen_at = (-.72, .457, 1.31)
glass = block("Recessed display glass", screen_at, (.394, .009, .213), screen, .006)
glass.rotation_euler.x = -.27
for i in range(21):
    height = .011 + .082 * (sin(i*.73 + .5)**2) * (1 - .025*i)
    block("Waveform on screen", (-.893 + i*.017, .447, 1.306), (.008, .008, height), green)
if club:
    # The display faces the operator while the operator faces the dance floor.
    pivot = Vector((-.72, .331, 1.179))
    turn = Matrix.Translation(pivot) @ Matrix.Rotation(pi, 4, 'Z') @ Matrix.Translation(-pivot)
    bpy.context.view_layer.update()
    for part in objects[laptop_start:]:
        part.matrix_world = turn @ part.matrix_world

for x, offset in ((-.32, 0), (.61, .044)):
    points = [(x, .253, 1.113), (x, .434, 1.071), (x + .1, .5, .953),
              (x + .17, .436, .842), (x + .133, .41, .706 + offset)]
    for a, b in zip(points, points[1:]):
        rod("Angled audio cable", a, b, .012, rub)

if club:
    walnut = paint("Dark walnut panels", "9f7862", "club walnut", .54, 0)
    bronze = metal("Copper anodized trim", "c18f5d")
    for x in (-.918, .918):
        block("Cabinet end in walnut", (x, -.03, .422), (.12, .71, .76), walnut, .025)
        block("Steel cabinet toe", (x, -.03, .050), (.16, .75, .074), trim, .012)
    block("Recessed behind the front slats", (0, -.348, .422), (1.75, .06, .738), dark, .009)
    for i in range(23):
        x = (i - 11) * .077
        block("Grooved walnut front", (x, -.402, .423), (.047, .055, .695), walnut, .008)
    for z in (.12, .74):
        block("Brass kick rail", (0, -.433, z), (1.79, .028, .022), bronze, .004)
    block("Low cable channel", (0, .30, .205), (1.6, .044, .053), dark, .009)
    for side in (-1, 1):
        x = side * 1.25
        block("Monitor bracket", (x, .183, .968), (.31, .33, .043), trim, .009)
        block("Nearfield cabinet", (x, .206, 1.176), (.28, .265, .391), case, .021)
        block("Monitor acoustic baffle", (x, .066, 1.182), (.242, .026, .34), dark, .011)
        for z, radius in ((1.109, .086), (1.286, .039)):
            rod("Monitor surround", (x, .055, z), (x, .043, z), radius, rub, 24)
            rod("Recessed driver", (x, .043, z), (x, .038, z), radius*.72, trim, 24)
        block("Nearfield power light", (x + .083, .045, 1.031), (.022, .009, .010), green, .002)

bpy.context.view_layer.update()
asset_name = "club-dj" if club else "yard-dj"
export_scene(destination / (asset_name + ".json"), "Club DJ booth" if club else "DJ flight case",
             objects, pivots, textured=("club walnut", "club vinyl") if club else ())
floor = matte("Studio slate", "1b2535")
block("Preview floor", (0, 0, -.045), (200, 200, .08), floor)
scene = bpy.context.scene
camera = (3.25, -4.45, 4.45) if club else (3.3, -4.35, 5.05)
studio(scene, camera, (0, 0, .73), 3.55 if club else 3.40,
       destination / ("club-dj-reference.png" if club else "dj-blender.png"))
bpy.ops.wm.save_as_mainfile(filepath=str(destination / ("club-dj.blend" if club else "dj-booth.blend")), compress=True)
bpy.ops.render.render(write_still=True)
