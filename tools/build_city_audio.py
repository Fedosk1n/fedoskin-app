"""Build the six city sound systems and the editable Blender presentation.

blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/build_city_audio.py -- /tmp/city-audio
"""
from math import cos, pi, sin, tau
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import export_scene, paint, srgb, studio

destination = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

shell = paint("Charcoal enclosure", "30343b", roughness=.74, metalness=.04)
panel = paint("Graphite baffle", "20232b", roughness=.74, metalness=.04)
fabric = paint("Black textured grille", "343740", roughness=.74, metalness=.04)
rubber = paint("Rubber suspension and corner guards", "171922", roughness=.74, metalness=.04)
screen = paint("Low-gloss smoke glass", "293a40", roughness=.74, metalness=.04)
plywood = paint("Honey birch plywood", "a56e42", roughness=.74, metalness=.04)
wood_edge = paint("Darker laminated edge", "79543c", roughness=.74, metalness=.04)
steel = paint("Brushed aluminum", "84939e", "metal", .36, .59)
iron = paint("Blackened steel", "414953", "metal", .36, .59)
driver = paint("Paper driver", "2b2e36", "bass", .74, .04)
rib = paint("Paper cone ribs", "40434a", "bass", .74, .04)
dust = paint("Driver dust cap", "282d37", "bass", .74, .04)
themes = {
    "tape": "ec9f43", "street": "b3dd56", "chrome": "70a4d9",
    "crate": "a9ad5b", "stage": "b98ce8", "foundry": "e6af34",
}
pieces = []
accent = indicator = None
part = ""


def tagged(obj, name, material):
    obj.name = name
    obj["part"] = part
    obj.data.materials.append(material)
    pieces.append(obj)
    return obj


def mesh(name, coords, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(coords, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    return tagged(ob, name, material)


def box(name, at, size, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    ob = bpy.context.object
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new("Edge bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    return tagged(ob, name, material)


def bar(name, a, b, thickness, material):
    a, b = Vector(a), Vector(b)
    ob = box(name, (a+b)*.5, (*thickness, (a-b).length), material, min(thickness)*.16)
    ob.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    return ob


def cylinder(name, at, radius, length, material, front=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=length, location=at)
    ob = bpy.context.object
    if front:
        ob.rotation_euler.x = pi/2
    for p in ob.data.polygons:
        if len(p.vertices) == 4:
            p.use_smooth = True
    return tagged(ob, name, material)


def lathe(name, x, y, z, profile, material, n=28):
    points = [(x+r*cos(tau*i/n), y-d, z+r*sin(tau*i/n)) for r, d in profile for i in range(n)]
    faces = [(k*n+i, k*n+(i+1)%n, (k+1)*n+(i+1)%n, (k+1)*n+i)
             for k in range(len(profile)-1) for i in range(n)]
    ob = mesh(name, points, faces, material)
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob


def woofer(x, front, z, r, color=steel):
    lathe("Mounted driver rim", x, front, z, [(r,.003), (r*.96,.022), (r*.82,.027)], color)
    lathe("Rubber surround", x, front, z, [(r*.84,.022), (r*.76,.029), (r*.678,.015)], rubber)
    lathe("Recessed paper cone", x, front, z, [(r*.68,.016), (r*.51,.010), (r*.24,.008)], driver)
    for f in (.52, .60, .66):
        lathe("Concentric cone rib", x, front, z, [(r*f,.017), (r*(f-.013),.017)], rib)
    lathe("Centre dome", x, front, z, [(r*.26,.011), (r*.2,.023), (r*.07,.033)], dust, 22)
    cylinder("Dust cap centre", (x, front-.021, z), r*.08, .023, dust, True)


def horn(x, front, z, width, height):
    frame = [(x+dx*w, front-depth, z+dz*h) for w,h,depth in
             ((width*.5,height*.5,.033),(width*.40,height*.38,.030),(width*.10,height*.10,.009))
             for dx,dz in ((-1,-1),(1,-1),(1,1),(-1,1))]
    faces = [(4*k+i, 4*k+(i+1)%4, 4*(k+1)+(i+1)%4, 4*(k+1)+i)
             for k in (0,1) for i in range(4)]
    ob = mesh("Flared high-frequency horn", frame, faces + [(8,9,10,11)], iron)
    ob.data.materials.append(rubber)
    ob.data.polygons[-1].material_index = 1


def port(x, front, z, w, h):
    box("Recessed bass port lip", (x, front-.005, z), (w, .019, h), iron, .008)
    box("Black port", (x, front-.016, z), (w*.82, .008, h*.73), rubber, .005)


def trim_frame(w, front, lo, hi, mat, thickness=.026):
    for x in (-w/2, w/2):
        box("Vertical face rail", (x, front, (lo+hi)/2), (thickness,.026,hi-lo), mat, .005)
    for z in (lo, hi):
        box("Horizontal face rail", (0,front,z), (w,.026,thickness), mat, .005)


def foot_pads(w,d):
    for x in (-w*.37,w*.37):
        for y in (-d*.35,d*.35):
            box("Soft foot", (x,y,.022), (.086,.082,.043), rubber, .01)


def inset_handle(x, height, size=.20):
    box("Inset hand grip", (x, .025, height), (.019, size,.10), iron, .009)
    box("Handle recess", (x*1.022, .024, height), (.010, size*.74,.065), rubber, .008)


def top_controls(z, x=0, span=.25):
    box("Recessed top control plate", (x,-.008,z), (span,.138,.015), panel, .01)
    cylinder("Volume knob", (x-span*.30,.008,z+.021), .026,.025, steel)
    for i in range(4):
        box("Raised playback key", (x + (i-1)*span*.135,-.015,z+.010), (.019,.032,.016), fabric, .004)
    box("Power lamp", (x+span*.34,.032,z+.012), (.035,.012,.009), indicator, .003)


def tape():
    box("Cassette body", (0,0,.244), (.98,.33,.414), shell, .031)
    box("Full-width recessed face", (0,-.165,.244), (.915,.027,.344), panel, .023)
    for x in (-.389,.389):
        box("Retro painted upper insert", (x,-.181,.365), (.141,.015,.069), accent, .006)
        for z in (.351,.365,.379):
            box("Slotted treble grille", (x,-.190,z), (.102,.008,.005), rubber)
    for x in (-.324,.324):
        box("Painted lower bumper", (x,-.181,.074), (.276,.026,.040), accent, .008)
    for x in (-.286,.286):
        woofer(x,-.188,.206,.135)
    box("Cassette transport", (0,-.187,.211), (.235,.018,.136), steel, .008)
    box("Smoked cassette window", (0,-.198,.211), (.169,.010,.075), screen, .004)
    for x in (-.049,.049):
        cylinder("Cassette reel", (x,-.205,.212), .017,.006, rib, True)
    box("LED equalizer inset", (0,-.187,.337), (.224,.014,.071), rubber, .006)
    for i in range(7):
        h=.013+.036*sin(i*.85+1)**2
        box("Graphic equalizer bar", (-.086+i*.028,-.198,.318+h/2), (.010,.008,h), indicator)
    for x in (-.383,.383):
        box("Handle anchor", (x,.039,.455), (.083,.081,.026), iron, .008)
        bar("Carry-handle post", (x,.039,.46), (x*.9,.044,.567), (.037,.04), steel)
    bar("Brushed carry grip", (-.345,.044,.569), (.345,.044,.569), (.041,.05), steel)
    top_controls(.452, .07, .34)
    foot_pads(.98,.33)


def street():
    box("Portable PA shell", (0,0,.453), (.601,.41,.826), shell, .065)
    box("Recessed two-way baffle", (0,-.206,.453), (.512,.027,.711), panel, .029)
    trim_frame(.462,-.223,.113,.787,accent,.019)
    woofer(0,-.228,.322,.213,iron)
    horn(0,-.228,.667,.315,.185)
    for x in (-.339,.339):
        for z in (.338,.574):
            box("Side handle bridge", (x,.013,z), (.12,.074,.052), rubber, .012)
        bar("Side carry grip", (x*1.15,.014,.345),(x*1.15,.014,.56),(.043,.056), iron)
    for x in (-.247,.247):
        box("Shock-resistant corner", (x,-.15,.084), (.112,.136,.116), rubber, .024)
    top_controls(.867)
    foot_pads(.60,.42)


def chrome():
    box("Slim twin woofer cabinet", (0,0,.551), (.49,.355,1.026), shell, .049)
    box("Blue side panels", (0,.012,.55), (.498,.243,.822), accent, .026)
    box("Tall grille plate", (0,-.181,.554), (.417,.023,.898), fabric, .021)
    trim_frame(.418,-.202,.075,1.018,steel,.033)
    for z in (.305,.742):
        woofer(0,-.204,z,.174,iron)
    for x in (-1,1):
        for i in range(9):
            box("Perforated grille margin", (x*.183,-.207,.151+i*.095),(.006,.006,.038),rubber)
    cylinder("Small centre tweeter", (0,-.211,.523), .025,.015, accent, True)
    top_controls(1.072, 0, .282)
    foot_pads(.49,.35)


def crate():
    box("Plywood crate base", (0,0,.104), (.748,.477,.173), wood_edge, .018)
    box("Plywood speaker cabinet", (0,0,.455), (.710,.424,.624), plywood, .025)
    box("Olive inset baffle", (0,-.215,.449), (.645,.029,.559), accent, .015)
    box("Floating black driver panel", (0,-.228,.448), (.614,.013,.526), panel, .013)
    woofer(-.138,-.240,.44,.161)
    horn(.153,-.242,.603,.214,.173)
    for x in (.079,.216):
        port(x,-.242,.26,.092,.076)
    for x in (-.315,.315):
        for y in (-.19,.19):
            for z in (.185,.733):
                box("Wrapped crate corner guard", (x,y,z), (.097,.094,.081), rubber, .019)
        inset_handle(x*1.14,.476)
    for x in (-.267,.267):
        box("Front latch plate", (x,-.243,.147), (.088,.021,.082), iron, .007)
        box("Latch lever", (x,-.259,.142), (.041,.016,.052), steel, .006)
    for i in range(4):
        box("Plywood grain in top veneer", (-.058+(i%2)*.10,.13-i*.068,.769), (.50,.009,.004), wood_edge)
    box("Top inset carry grip", (0,.022,.769), (.206,.12,.012), iron, .011)
    box("Top handle recess", (0,.022,.780), (.158,.074,.010), rubber, .008)
    box("Power pin", (.243,-.244,.68), (.058,.009,.016), indicator, .002)


def stage():
    box("Stage subwoofer housing", (0,0,.275), (.82,.555,.472), shell, .037)
    box("Inset subwoofer baffle", (0,-.28,.276), (.744,.025,.385), panel, .016)
    trim_frame(.723,-.299,.091,.457,accent,.022)
    woofer(0,-.303,.289,.157,iron)
    for x in (-.265,.265):
        port(x,-.303,.153,.102,.081)
    cylinder("Tubular speaker stand", (0,.037,.775), .038,.597, steel)
    for x in (-.223,.223):
        bar("Stand brace", (x,.072,.508),(0,.041,.693),(.039,.039),iron)
    box("Stand mounting plate", (0,.033,.518), (.255,.205,.027), iron, .01)
    # Tapered top box on the mount, wider at the speaker face.
    coords = [(x*w, y, z) for y,w,low,high in ((-.159,.27,1.005,1.435),(.19,.212,1.048,1.39))
              for x,z in ((-1,low),(1,low),(1,high),(-1,high))]
    mesh("Trapezoid top cabinet", coords, [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)], shell)
    trim_frame(.465,-.167,1.039,1.408,accent,.023)
    horn(0,-.177,1.237,.435,.315)
    box("Stage status LED", (.169,-.184,1.069), (.059,.012,.018), indicator, .003)
    foot_pads(.82,.555)


def foundry():
    box("Reinforced industrial enclosure", (0,0,.487), (.741,.514,.865), shell, .045)
    box("Countersunk steel driver baffle", (0,-.261,.482), (.638,.026,.718), panel, .034)
    woofer(0,-.286,.486,.276,iron)
    for x in (-.351,.351):
        box("Heavy chassis rail", (x,-.301,.47), (.082,.09,.653), steel, .012)
        for end in (-1,1):
            bar("Angled guard corner", (x,-.304,.47+end*.324),(x*.75,-.307,.47+end*.401),(.084,.075),steel)
        inset_handle(x*1.08,.56)
    for z in (.080,.865):
        box("Transverse frame cap", (0,-.301,z), (.548,.087,.064), iron, .011)
    for z in (.296,.606):
        box("Steel driver cage bar", (0,-.329,z), (.618,.035,.035), iron, .006)
    for x in (-.257,.257):
        for y in (-.133,.164):
            box("Grab-handle post", (x,y,.948), (.041,.041,.084), steel, .006)
        bar("Grab bar", (x,-.133,.991),(x,.164,.991),(.042,.043),steel)
    for side in (-1,1):
        for i in range(3):
            stripe = box("Diagonal warning paint", (side*.373, -.114+i*.118, .498), (.012,.049,.253), accent)
            stripe.rotation_euler.x = -.49
    for i in range(3):
        stripe = box("Top warning stripe", (-.068+i*.071,-.045,.921), (.033,.172,.007), accent)
        stripe.rotation_euler.z = -.47
    box("Amber instrument", (0,-.29,.825), (.14,.018,.019), indicator)
    foot_pads(.741,.514)


builders = (tape, street, chrome, crate, stage, foundry)
for build in builders:
    part = build.__name__
    theme = themes[part]
    accent = paint(part+" trim", "ffffff", "accent", .74, .04)
    indicator = paint(part+" light", "ffffff", "signal", .65, .0, .45)
    for mat in (accent, indicator):
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*srgb(theme),1)
        bsdf.inputs["Emission Color"].default_value = (*srgb(theme),1)
    build()

bpy.context.view_layer.update()
export_scene(destination / "sound-systems.json", "City sound systems", pieces,
             {kind:(0,0,0) for kind in themes})

# Arrange the Blender source as a small, lit product lineup.
for i, kind in enumerate(themes):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0,0,0))
    root = bpy.context.object
    root.name = kind.title()
    for ob in pieces:
        if ob["part"] == kind:
            ob.parent = root
    root.location = ((i%3-1)*1.96, (.5-i//3)*2.18, 0)
part = "set"
box("Slate studio floor", (0,0,-.06), (30,30,.09), paint("Slate studio floor", "252c39"))
scene = bpy.context.scene
studio(scene, (1.7,-7.7,8.8), (0,0,.47), 6.18, destination / "sound-systems-blender.png")
scene.render.resolution_x, scene.render.resolution_y = 1200, 920
bpy.data.lights["Warm key"].energy = 1780
bpy.data.lights["Cool fill"].energy = 685
scene.cycles.samples = 25
bpy.ops.wm.save_as_mainfile(filepath=str(destination / "sound-systems.blend"), compress=True)
bpy.ops.render.render(write_still=True)
