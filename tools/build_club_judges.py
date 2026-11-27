"""Build the Club judging row and a studio reference in Blender 4.3.

blender -b -t 3 --factory-startup --python-exit-code 1 \
  --python tools/build_club_judges.py -- /tmp/club-judges
"""
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import export_scene, paint, studio

out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

seat = paint("Dark wine upholstery", "502932", "club upholstery", .90)
edge = paint("Velour seams", "794651", "club upholstery", .90)
frame = paint("Smoke-black steel", "252e32", "metal", .42, .55)
brass = paint("Copper armrest pins", "8c7054", "metal", .42, .55)
walnut = paint("Smoked walnut", "7f5442", "club walnut", .53)
paper = paint("Voting cards", "dfcdb3", "props", .78)
folder = paint("Petrol score folders", "427168", "props", .78)
objects = []


def block(name, loc, size, material, radius=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name, ob.dimensions = name, size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        bevel = ob.modifiers.new("Softened corners", "BEVEL")
        bevel.width, bevel.segments = radius, 3
    ob.data.materials.append(material)
    objects.append(ob)
    return ob


# +Z is up; seated judges look towards -Y, which becomes +Z in Three.js.
for x in (-1.18, 0, 1.18):
    first = len(objects)
    for dx in (-.37, .37):
        for y in (-.025, .40):
            block("Steel chair leg", (x + dx, y, .128), (.048, .052, .256), frame, .005)
        block("Seat side rail", (x + dx, .183, .23), (.056, .47, .059), frame, .006)
        block("Backrest upright", (x + dx, .40, .41), (.048, .052, .389), frame, .006)
        outer = x + dx * 1.06
        block("Armrest post", (outer, .015, .425), (.045, .044, .402), frame, .006)
        block("Rear armrest post", (outer, .32, .475), (.044, .043, .314), frame, .006)
        block("Walnut armrest", (x + dx * .924, .035, .622), (.17, .67, .081), walnut, .019)
        block("Armrest pin", (x + dx, -.267, .664), (.028, .024, .004), brass, .004)
    block("Padded seat", (x, .15, .283), (.76, .36, .116), seat, .046)
    block("Front welt", (x, -.021, .302), (.674, .02, .016), edge, .008)
    shell = block("Backrest shell", (x, .434, .717), (.86, .116, .66), frame, .041)
    pillow = block("Velour back cushion", (x, .370, .731), (.79, .09, .61), seat, .042)
    shell.rotation_euler.x = -.13
    pillow.rotation_euler.x = -.13
    for d in (-.23, .23):
        stitch = block("Upholstery seam", (x+d, .330, .741), (.009, .011, .475), edge, .005)
        stitch.rotation_euler.x = -.13

    for part in objects[first:]:
        part["part"] = "chair" if x == 0 else "studio only"

# Small side tables leave an unobstructed view of each judge.
for x, yaw in ((-1.91, -.16), (1.91, .22)):
    for dx in (-.15, .15):
        for y in (-.10, .19):
            block("Side table foot", (x+dx, y, .185), (.035, .035, .37), frame, .005)
    block("Walnut side table", (x, .045, .388), (.38, .38, .044), walnut, .021)
    book = block("Score folder", (x, .03, .417), (.185, .142, .014), folder, .007)
    book.rotation_euler.z = yaw
    card = block("Unmarked ballot", (x, -.001, .427), (.142, .094, .007), paper, .004)
    card.rotation_euler.z = yaw + .11

bpy.context.view_layer.update()
export_scene(out / "club-judges.json", "Judges' furniture",
             [obj for obj in objects if obj.get("part") != "studio only"],
             {"chair": (0, 0, 0)}, textured=("club upholstery", "club walnut"))

# Neutral seated figures show the sight lines and spacing in the design reference.
skin = paint("Reference figure", "9ea6a2", "figure", .81)
shirt = paint("Reference jacket", "526366", "figure", .81)
trousers = paint("Reference trousers", "36474c", "figure", .81)


def ellipsoid(name, position, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=position)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.data.materials.append(material)
    for polygon in ob.data.polygons:
        polygon.use_smooth = True
    return ob


def limb(name, a, b, width, material):
    a, b = Vector(a), Vector(b)
    ob = ellipsoid(name, (a+b)/2, (width, width, (b-a).length/2 + width*.63), material)
    ob.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()


for i, x in enumerate((-1.18, 0, 1.18)):
    lean = (.045, .055, .035)[i]
    torso = ellipsoid("Seated torso", (x, .12+lean, .741), (.197, .119, .247), shirt)
    torso.rotation_euler.x = -.21
    ellipsoid("Pelvis", (x, .105, .443), (.174, .125, .099), trousers)
    ellipsoid("Head", (x, .145+lean, 1.062), (.103, .095, .131), skin)
    for j, side in enumerate((-1, 1)):
        depth = ((.42, .35), (.34, .40), (.44, .34))[i][j]
        hip = (x+side*.10, .105, .453)
        knee = (x+side*.306, -.194, .418)
        ankle = (x+side*.37, -depth, .087)
        limb("Thigh", hip, knee, .078, trousers)
        limb("Shin", knee, ankle, .057, trousers)
        shoe = ellipsoid("Shoe", (ankle[0], -depth-.058, .055), (.075, .137, .047), frame)
        shoe.rotation_euler.z = side*.29
        shoulder = (x+side*.14, .145+lean, .894)
        elbow = (x+side*.29, .14, .723)
        wrist = (elbow[0], -.099, .723)
        limb("Upper arm", shoulder, elbow, .057, shirt)
        limb("Forearm", elbow, wrist, .045, shirt)
        ellipsoid("Hand", (wrist[0], wrist[1]-.037, wrist[2]-.007), (.041, .063, .026), skin)

parquet = paint("Tan floor edge", "755138", "sample", .6)
slate = paint("Club floor", "283739", "sample", .81)
block("Reference floor", (0, 0, -.047), (200, 200, .08), slate)
block("Edge of competition floor", (0, -1.77, -.004), (5.7, 2.33, .018), parquet, .007)
for x in (-1.18, 0, 1.18):
    block("Chair position tape", (x, -.584, .005), (.315, .024, .007), brass, .002)

scene = bpy.context.scene
studio(scene, (2.45, -5.8, 3.54), (0, -.36, .52), 5.1, out / "club-judges-reference.png")
scene.render.resolution_x, scene.render.resolution_y = 1080, 720
bpy.ops.wm.save_as_mainfile(filepath=str(out / "club-judges.blend"), compress=True)
bpy.ops.render.render(write_still=True)
