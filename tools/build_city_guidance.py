"""Build the City quest landmarks and photographic references with Blender.

blender -b -t 4 --python tools/build_city_guidance.py -- /tmp/city-guide --preview watch
blender -b -t 4 --python tools/build_city_guidance.py -- /tmp/city-guide
"""
from math import cos, pi, sin
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
output = Path(args[0])
output.mkdir(parents=True, exist_ok=True)
only = args[args.index('--preview') + 1] if '--preview' in args else None
random.seed(7115)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgb, rough=.78, metallic=0):
    out = bpy.data.materials.new(name)
    out.diffuse_color = (*rgb, 1)
    out.use_nodes = True
    base = out.node_tree.nodes.get('Principled BSDF')
    base.inputs['Base Color'].default_value = (*rgb, 1)
    base.inputs['Roughness'].default_value = rough
    base.inputs['Metallic'].default_value = metallic
    return out


asphalt = material('Weathered asphalt', (.048,.053,.058))
warm = material('Muted orange enamel', (.74,.26,.074))
cream = material('Uncoated cream paper', (.78,.65,.43))
teal = material('Teal screen print', (.11,.55,.48))
dark = material('Worn graphite', (.029,.038,.043))
metal = material('Powder coated aluminium', (.21,.24,.25), .58, .27)
wood = material('Warm laminated plywood', (.39,.23,.105))
paper = material('Uncoated sheet', (.81,.80,.67))
chalk = material('Dusty ivory paint', (.76,.69,.53))
tape = material('Faded ochre tape', (.41,.33,.19))
older = material('Scuffed amber tape', (.26,.21,.13))
stencil = material('Faded cream tread', (.67,.60,.43))
stamp = material('Old tread edges', (.42,.35,.25))
red = material('Oxide fabric', (.39,.065,.084))
blue = material('Municipal blue', (.06,.20,.37))
leather = material('Vinyl grip', (.08,.11,.135))
cardboard = material('Crushed cardboard', (.49,.31,.15))


def paint(name, outline, mat, height=.018):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x,y,height) for x,y in outline], [], [tuple(range(len(outline)))])
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(mat)
    return ob


def box(name, at, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    ob=bpy.context.object
    ob.name=name
    ob.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        chamfer=ob.modifiers.new('Rounded edges','BEVEL')
        chamfer.width, chamfer.segments = bevel, 2
    ob.data.materials.append(mat)
    return ob


def tube(name, a, b, width, mat):
    start, end = Vector(a), Vector(b)
    delta = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=width, depth=delta.length,location=(start+end)/2)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = delta.to_track_quat('Z','Y').to_euler()
    ob.data.materials.append(mat)
    return ob


def disc(name, at, radius, depth, mat, face=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=at,
                                       rotation=(pi/2 if face else 0,0,0))
    ob=bpy.context.object
    ob.name=name
    ob.data.materials.append(mat)
    return ob


def stroke(name, a, b, width, mat, z=.02):
    dx,dy=b[0]-a[0],b[1]-a[1]
    length=(dx*dx+dy*dy)**.5
    nx,ny=-dy/length*width/2,dx/length*width/2
    return paint(name,[(a[0]+nx,a[1]+ny),(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny)],mat,z)


def arrow(x,y,color,length=.44):
    paint('Arrow stencil',[(x-.04,y-.22),(x+.04,y-.22),(x+.04,y+.01),(x+.12,y+.01),
       (x,y+length-.22),(x-.12,y+.01),(x-.04,y+.01)],color,.025)


def watch():
    paint('Torn worn lane tape, left', [(-.63,-.33),(-.57,-.31),(-.548,-.13),(-.579,-.109),(-.621,-.147)],tape)
    paint('Split tape, outer edge', [(.55,.245),(.60,.228),(.625,.405),(.598,.436),(.566,.392)],older)
    for sign in (-1,1):
        cx=.225*sign
        points=[(-.105,-.30),(-.090,-.35),(.054,-.37),(.091,-.329),(.097,-.252),(.081,-.164),(.087,-.082),
                (.114,-.039),(.137,.077),(.137,.145),(.120,.220),(.087,.273),(.043,.309),(-.005,.322),
                (-.052,.312),(-.097,.289),(-.128,.233),(-.141,.164),(-.137,.091),(-.119,.025),(-.098,-.063)]
        tilt=sign*-.14
        yoff=.037 if sign<0 else -.035
        def turn(px,py):
            return cx+px*cos(tilt)-py*sin(tilt), yoff+py*cos(tilt)+px*sin(tilt)
        paint('Dust outer transfer', [turn(px,py) for px,py in points], stamp,.0204)
        for i,(yy,wide) in enumerate([(-.309,.124),(-.254,.153),(-.191,.133),(-.097,.084),
                                      (-.029,.123),(.035,.180),(.105,.205),(.173,.213),(.237,.176),(.279,.091)]):
            skew=.012 if i%2 else -.016
            for side in (-1,1):
                if (i,side,sign) in {(1,1,1),(5,-1,1),(4,1,-1),(2,-1,-1)}:
                    continue
                colour=chalk if i in (2,6) and side==sign else stencil
                outside=side*wide*(random.uniform(.41,.5))
                paint('Scuffed diagonal shoe tread', [turn(px,py) for px,py in
                    [(side*.015,yy+.013),(outside,yy+.02+skew),
                     (side*wide*.44,yy-.017+skew),(side*.018,yy-.012)]],colour,.0208)
        for i in range(24 if sign>0 else 14):
            yy=random.uniform(-.33,.265)
            px=random.uniform(-.111,.108)
            r=random.uniform(.006,.024)
            paint('Asphalt interruption', [turn(px-r,yy-.006),turn(px+.012,yy-r),
                                    turn(px+r,yy+.009),turn(px-.014,yy+r)],asphalt,.0212)
    for x,y in [(-.51,-.21),(-.56,-.32),(.61,.39),(.55,.23)]:
        stroke('Broken chalk fleck',(x,y),(x+.026,y+.012),.011,stamp,.019)


def flat_sheet(name, x, y, z, w, d, accent):
    box(name,(x,y,z),(w,d,.027),paper,.011)
    box('Ink band',(x,y+d*.32,z+.016),(w*.79,.064,.009),accent,.004)
    for i in range(3):
        box('Hand drawn running order',(x-.035,y+.055-i*.092,z+.016),(w*(.57-i*.061),.015,.006),dark)
    for xoff in (-.26,.26):
        box('Black binder clip',(x+xoff*w,y+d*.47,z+.037),(.083,.054,.038),dark,.005)


def panel_body(name, width=.70, height=.68, h=.67, accent=warm):
    box(name + ' backing',(0,.28,h),(width,.092,height),wood,.018)
    box(name + ' paper',(0,.222,h),(width*.90,.025,height*.88),paper,.012)
    box('Ink band',(0,.201,h+height*.29),(width*.76,.022,.105),accent,.008)
    for side in (-1,1):
        tube('Folded support',(side*width*.38,-.29,.025),(side*width*.38,.28,h+.40*height),.028,metal)
        tube('Rear leg',(side*width*.38,.55,.025),(side*width*.38,.28,h+.40*height),.031,dark)
        box('Rubber foot',(side*width*.38,-.29,.027),(.105,.13,.054),leather,.015)


def text_lines(h, width=.49):
    for i,w in enumerate((1,.80,.89,.65)):
        box('Print line',(-.018,.187,h-i*.075),(width*w,.011,.022 if i==0 else .013),dark,.003)


def circle():
    box('Open organisers flight case', (0,.24,.17),(.88,.66,.34),dark,.039)
    for x in (-.41,.41):
        box('Aluminium opened-case edge',(x,.24,.18),(.045,.65,.34),metal,.012)
    box('Folding case lid',(0,.53,.43),(.84,.10,.55),wood,.025)
    box('Case grip',(0,-.09,.21),(.21,.033,.064),metal,.009)
    flat_sheet('Clamped show running order',-.09,.24,.362,.57,.48,warm)
    pen=box('Grease pencil',(.275,.29,.381),(.035,.28,.039),warm,.005)
    pen.rotation_euler.z=-.37
    box('Clip edge',(0,.529,.37),(.34,.035,.065),leather,.009)


def finale():
    panel_body('Signed line-up', .94,.77,.67,teal)
    for i in range(4):
        x=-.31+i*.203
        disc('Participant stamp',(x,.170,.72),.063,.026,teal if i%2 else warm,True)
        box('Name below stamp',(x,.165,.62),(.116,.016,.02),dark,.002)
    for x,tilt in [(-.18,-.16),(.13,.11)]:
        sign=box('Handwritten underline',(x,.169,.46),(.20,.016,.035),blue,.003)
        sign.rotation_euler.y=tilt
    box('Worn corner tape',(.39,.179,.95),(.083,.021,.073),warm,.005)


def yard_dj():
    box('DJ flight case',(0,.31,.24),(.84,.50,.48),dark,.055)
    for x in (-.39,.39):
        box('Aluminium edge',(x,.31,.24),(.05,.51,.49),metal,.012)
    disc('Vinyl cue sample',(-.21,.36,.505),.158,.035,leather)
    disc('Vinyl label',(-.21,.36,.526),.052,.009,warm)
    flat_sheet('Beat notes',.21,.36,.51,.34,.36,cream)
    box('Case handle',(0,.05,.25),(.27,.034,.075),metal,.015)


def mat():
    box('Rolled floor mat',(0,.30,.029),(1.08,.88,.048),leather,.043)
    for x in (-.44,.44):
        stroke('Sewn side strip',(x,-.04),(x,.65),.034,teal,.059)
    arrow(0,.26,cream)
    for i in range(3):
        stroke('Practice step',(-.30+i*.30,.02),(-.18+i*.30,.02),.035,cream,.061)
    flat_sheet('Practice steps',.21,.55,.059,.37,.29,warm)


def contest():
    panel_body('Power event score dial',.71,.55,.60,warm)
    for x in (-.18,0,.18):
        disc('Raised score dial',(x,.174,.54),.069,.031,blue,True)
        box('Dial mark',(x,.151,.55),(.031,.012,.056),chalk,.002)
    for x in (-.36,.36):
        stroke('Safety stripe',(x-.11,-.41),(x+.06,-.34),.077,warm)


def mall():
    panel_body('Outdoor poster A-board',.88,.89,.74,warm)
    box('Teal pasted corner',(.15,.193,.72),(.43,.016,.23),teal,.015)
    disc('Show poster graphic',(-.18,.173,.72),.109,.019,dark,True)
    text_lines(.51,.54)
    for x in (-.33,.33):
        box('Tape clip',(x,.178,1.10),(.095,.014,.057),cream,.005)


def tea():
    box('Round steel tray support',(0,.29,.26),(.75,.45,.51),wood,.029)
    disc('Enamel tea tray',(0,.29,.544),.34,.04,teal)
    disc('Paper tea cup',(.15,.32,.633),.081,.15,cream)
    disc('Dark cup rim',(.15,.32,.714),.083,.022,dark)
    box('Chalk menu card',(-.18,.30,.63),(.23,.017,.20),leather,.014)
    for i in range(3):
        box('Chalk price line',(-.18,.29,.68-i*.04),(.15,.01,.012),chalk)


def metro():
    tube('Enamel pole',(0,.3,0),(0,.3,1.19),.05,metal)
    box('Enamel metro plate',(0,.29,.97),(.85,.105,.50),blue,.038)
    p=[(-.22,0),(-.22,.25),(-.02,.09),(.17,.25),(.17,0)]
    for a,b in zip(p,p[1:]):
        tube('Transit M in relief',(a[0],.228,.83+a[1]),(b[0],.228,.83+b[1]),.028,chalk)
    for xs in (-.30,.25):
        stroke('Transfer stripe',(xs,-.38),(xs,.19),.062,blue)


def stage():
    for x in (-.39,.39):
        monitor=box('Wedge stage monitor',(x,.30,.21),(.57,.64,.37),dark,.048)
        monitor.rotation_euler.x=.16
        # The grille is the actual front, slightly outside the tilted cabinet.
        frame=box('Speaker grille frame',(x,-.060,.217),(.49,.043,.28),metal,.024)
        frame.rotation_euler.x=.16
        disc('Recess of speaker driver',(x,-.089,.217),.122,.025,dark,True)
        disc('Speaker cone',(x,-.103,.216),.086,.017,leather,True)
        disc('Central speaker cap',(x,-.115,.215),.04,.014,metal,True)
        for i in range(9):
            z=.108+i*.0255
            bar=box('Horizontal grille mesh',(x,-.134-(z-.20)*.14,z),(.452,.013,.007),metal,.002)
            bar.rotation_euler.x=.16
        box('Gaffer recognition stripe',(x-.15,-.105,.358),(.12,.021,.027),cream,.003)
    for radius in (.113,.081):
        for i in range(14):
            angle=i*pi/7
            tail=(i+1)*pi/7
            tube('Coiled signal cable',(.12+radius*cos(angle),-.18+radius*sin(angle),.033),
                 (.12+radius*cos(tail),-.18+radius*sin(tail),.033),.014,dark)
    paint('Short torn stage tape',[(-.39,-.36),(-.18,-.37),(-.16,-.32),(-.40,-.305)],warm)


def bars():
    box('Low sports drill stand',(0,.25,.18),(.73,.43,.33),blue,.025)
    flat_sheet('Grip drills',0,.30,.36,.58,.35,teal)
    for x in (-.28,.28):
        tube('Grip in relief',(x,.31,.386),(x,.31,.635),.033,metal)
    tube('Parallel grip',(-.28,.31,.635),(.28,.31,.635),.035,teal)
    for x in (-.35,.35):
        stroke('Rubber lane strip',(x,-.38),(x,-.02),.074,teal)


def chess():
    box('Low chess scores table',(0,.30,.48),(.77,.63,.09),wood,.038)
    for x in (-.30,.30):
        for y in (.06,.54):
            tube('Folding score table legs',(x,y,.03),(x,y,.47),.029,dark)
    for i in range(4):
        for j in range(4):
            box('Chess square',(-.24+i*.122,.14+j*.103,.535),(.119,.101,.022),paper if (i+j)%2 else dark)
    disc('Black rook',(-.23,.16,.584),.044,.079,dark)
    disc('Light pawn',(.11,.36,.590),.035,.091,cream)
    flat_sheet('Chess score slip',.24,.35,.55,.22,.31,wood)


def ring():
    panel_body('Ring tournament grid',.91,.72,.74,red)
    for y in (-.14,-.014,.12):
        for side in (-1,1):
            box('Bracket pairing',(side*.238,.181,.69+y),(.245,.017,.022),dark)
    for side in (-1,1):
        box('Bracket spine',(side*.117,.18,.693),(.019,.017,.268),red)
    box('Bracket winner cell',(0,.171,.69),(.224,.025,.053),warm,.006)
    for x in (-.43,.43):
        stroke('Ring entrance lip',(x-.07,-.39),(x+.09,-.39),.067,warm)


def loading():
    box('Touring cable trunk',(0,.31,.28),(1.03,.64,.55),dark,.038)
    for x in (-.464,.464):
        for z in (.058,.505):
            for y in (.028,.60):
                box('Protective metal corner',(x,y,z),(.118,.11,.097),metal,.018)
    for z in (.075,.495):
        box('Extruded aluminium edge',(0,-.015,z),(.94,.03,.045),metal,.012)
    for x in (-.36,.36):
        box('Folded spring handle',(x,-.039,.29),(.176,.031,.10),metal,.013)
        box('Open handle grip',(x,-.058,.29),(.112,.018,.048),leather,.009)
    box('Scuffed touring label',(0,-.018,.322),(.31,.017,.166),cream,.009)
    for i in range(3):
        box('Label ink stroke',(-.054+i*.053,-.029,.336),(.012,.010,.081),dark,.002)
    box('Old red tape',(.23,-.021,.116),(.21,.017,.062),red,.006)


def club():
    for x in (-.42,.42):
        disc('Queue barrier foot',(x,.36,.03),.125,.060,dark)
        tube('Black queue barrier',(x,.36,.035),(x,.36,.77),.026,metal)
        disc('Queue knob',(x,.36,.79),.059,.070,metal)
    for a,b in [((-.42,.36,.72),(0,.36,.61)),((0,.36,.61),(.42,.36,.72))]:
        tube('Velvet queue rope',a,b,.035,red)
    arrow(0,-.29,red,.57)
    stroke('Club set line',(-.4,-.44),(.4,-.44),.061,cream)


def decks():
    box('Cue mixer night finish',(0,.28,.28),(1.05,.66,.56),dark,.035)
    for x in (-.31,.30):
        disc('Scratch deck',(x,.33,.58),.181,.042,leather)
        disc('Scratch disc label',(x,.33,.606),.058,.009,teal if x<0 else red)
    for x in (-.064,.035):
        for y in (.21,.30,.40):
            disc('Mixer knob',(x,y,.594),.019,.054,metal)
    flat_sheet('Club cue sheet',0,.045,.589,.34,.18,teal)


def records():
    panel_body('Magnetic result board',.95,.72,.74,teal)
    for i,y in enumerate((.72,.57,.44)):
        for x in (-.217,.216):
            box('Movable score strips',(x,.180,y),(.328,.011,.073),cream if i%2 else wood,.006)
            disc('Board magnet',(x-.11,.166,y),.023,.015,red,True)
    stroke('Front of viewing line',(-.45,-.41),(.45,-.41),.055,teal)


buildings = {
  'watch': watch, 'circle': circle, 'finale': finale, 'dj': yard_dj, 'mat': mat, 'powerContest': contest,
  'mall': mall, 'tea': tea, 'metro': metro, 'jam': stage, 'bars': bars, 'og': chess, 'ring': ring,
  'zpark': loading, 'smoke': club, 'clubDJ': decks, 'clubRecords': records,
}


def assemble(id, builder):
    before=set(bpy.data.objects)
    builder()
    parts=list(sorted(set(bpy.data.objects)-before,key=lambda ob:ob.name))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
        bpy.context.view_layer.objects.active=ob
    bpy.ops.object.convert(target='MESH')
    by_material={}
    for ob in parts:
        by_material.setdefault(ob.data.materials[0].name,[]).append(ob)
    group=bpy.data.objects.new(id,None)
    bpy.context.collection.objects.link(group)
    for items in by_material.values():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in items:
            ob.select_set(True)
        active=items[0]
        bpy.context.view_layer.objects.active=active
        if len(items)>1:
            bpy.ops.object.join()
        active.parent=group
    return group


groups={id:assemble(id,builder) for id,builder in buildings.items() if not only or id==only}
if not only:
    areas = {
        'yard': ('watch','circle','finale','dj','mat','powerContest'),
        'center': ('mall','tea','metro'),
        'park': ('jam','bars','og'),
        'prom': ('ring','zpark'),
        'club': ('smoke','clubDJ','clubRecords'),
    }
    for district, ids in areas.items():
        bpy.ops.object.select_all(action='DESELECT')
        for id in ids:
            group=groups[id]
            group.select_set(True)
            for ob in group.children:
                ob.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(output/f'city-guide-{district}.glb'),export_format='GLB',
                                  use_selection=True,export_texcoords=False,export_materials='EXPORT',
                                  export_apply=True,export_yup=True)
if '--assets-only' in args:
    raise SystemExit(0)

floor=box('Reference ground',(0,0,-.046),(200,200,.09),asphalt)
noise=asphalt.node_tree.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value=155
bump=asphalt.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value=.39
bump.inputs['Distance'].default_value=.055
asphalt.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
asphalt.node_tree.links.new(bump.outputs['Normal'],asphalt.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
def lamp(name, at, colour, energy, area):
    data=bpy.data.lights.new(name,'AREA')
    data.color,data.energy,data.shape,data.size=colour,energy,'DISK',area
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=at
    ob.rotation_euler=(-ob.location).to_track_quat('-Z','Y').to_euler()
lamp('Warm light from the dance floor',(-1.4,-2.0,4.3),(1,.76,.51),460,3.5)
lamp('Cool fill',(2.6,2.3,3.5),(.62,.76,1),420,4)
camd=bpy.data.cameras.new('Reference view')
camera=bpy.data.objects.new('Reference view',camd)
bpy.context.collection.objects.link(camera)
camd.type='ORTHO'
stage=bpy.context.scene
stage.camera=camera
stage.world.color=(.18,.18,.18)
stage.render.engine='CYCLES'
stage.cycles.use_denoising=False
stage.cycles.samples=18 if only else 12
stage.render.resolution_x=860 if only else 560
stage.render.resolution_y=480 if only else 318
stage.render.resolution_percentage=100

def visible(group, show):
    for ob in group.children:
        ob.hide_render=not show

for obj in groups.values():
    visible(obj,False)
for id,group in groups.items():
    visible(group,True)
    dressing=[]
    if id=='watch':
        camera.location=(.88,-2.64,3.68)
        focus=Vector((.02,.13,.008))
        camd.ortho_scale=2.28
        # Existing faded ring border appears in the reference only.
        front=[(x,.636+.157*(1-(x/.84)**2)) for x in (-.84,-.72,-.60,-.48,-.36,-.24,-.12,0,.12,.24,.36,.48,.60,.72,.84)]
        dressing.append(paint('Existing faded circle arc',front+[(x,y+.047) for x,y in reversed(front)],warm,.019))
        for x,y,rot in [(-.39,.97,.17),(.36,1.15,-.22)]:
            o=box('Carton edge from the cypher',(x,y,.012),(.83,.52,.022),cardboard,.006)
            o.rotation_euler.z=rot
            dressing.append(o)
    else:
        camera.location=(1.26,-2.86,2.87)
        focus=Vector((0,.16,.42 if id in ('mall','metro','ring','finale','clubRecords') else .23))
        camd.ortho_scale=2.15 if id in ('mall','metro','ring','finale','clubRecords') else 1.94
    camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler()
    stage.render.filepath=str(output/f'{id}.png')
    bpy.ops.render.render(write_still=True)
    visible(group,False)
    for ob in dressing:
        bpy.data.objects.remove(ob,do_unlink=True)
