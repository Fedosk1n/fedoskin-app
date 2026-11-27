"""Original shoe shell and RGB material studies.

blender -b -t 4 --python tools/build_festival_prize.py -- /tmp/festival-prize
"""
from pathlib import Path
from colorsys import hsv_to_rgb
from math import cos, sin, pi, radians
import sys
import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index('--') + 1])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.76, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color,1)
    b.inputs['Roughness'].default_value = roughness
    b.inputs['Emission Color'].default_value = (*color,1)
    b.inputs['Emission Strength'].default_value = emission
    return m


def surface(name, rings, material_):
    divisions = 32
    vertices = [(x, width * cos(a * 2*pi/divisions), center + height*sin(a * 2*pi/divisions))
                for x, width, center, height in rings for a in range(divisions)]
    sides = [(r*divisions+a, r*divisions+(a+1)%divisions, (r+1)*divisions+(a+1)%divisions, (r+1)*divisions+a)
             for r in range(len(rings)-1) for a in range(divisions)]
    sides += [tuple(reversed(range(divisions))),tuple((len(rings)-1)*divisions+i for i in range(divisions))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], sides)
    mesh.materials.append(material_)
    for poly in mesh.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    return ob


def cord(name, vertices, radius, m):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth, curve.bevel_resolution = radius, 3
    path = curve.splines.new('POLY')
    path.points.add(len(vertices)-1)
    for p, coords in zip(path.points, vertices):
        p.co = (*coords,1)
    ob = bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(m)
    return ob



def fabric_panel(name, outline, material_):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(outline, [], [tuple(range(len(outline)))])
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material_)
    mod = ob.modifiers.new('Padded thickness','SOLIDIFY')
    mod.thickness = .047
    bevel = ob.modifiers.new('Stitched edge','BEVEL')
    bevel.width,bevel.segments = .016,2
    return ob


def eyelet(x, y, z, material_):
    bpy.ops.mesh.primitive_torus_add(major_segments=16, minor_segments=8, location=(x,y,z),
        major_radius=.046, minor_radius=.012, rotation=(.23 if y>0 else -.23, -.15,0))
    ob=bpy.context.object
    ob.name='Milled eyelet'
    ob.data.materials.append(material_)
    return ob


def heel_opening(upper, material_):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=1,depth=1.12,location=(-.87,0,1.18))
    hole=bpy.context.object
    hole.scale=(.37,.255,1.0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.context.view_layer.objects.active=upper
    mod=upper.modifiers.new('Open ankle collar','BOOLEAN')
    mod.operation='DIFFERENCE'
    mod.object=hole
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(hole,do_unlink=True)
    lip=[(-.87+.37*cos(i*2*pi/36), .252*sin(i*2*pi/36), .936-.044*cos(i*2*pi/36)) for i in range(37)]
    return cord('Padded open collar',lip,.036,material_)

def area(name, pos, target, shade, power, radius):
    data = bpy.data.lights.new(name,'AREA')
    data.shape,data.size,data.energy,data.color = 'DISK',radius,power,shade
    ob = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location = pos
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()


knit = material('Graphite knit',(.049,.061,.084),.92)
rubber = material('Carbon rubber',(.024,.026,.031),.87)
trim = material('Swept heel overlays',(.099,.118,.154),.64)
channels = material('Recess around the RGB channels',(.013,.016,.025),.49)
eyelet_mat = material('Eyelet metal',(.19,.23,.29),.48)
tongue_mat = material('Woven tongue',(.088,.092,.116),.91)
toe_mat = material('Contrasting toe overlay',(.123,.141,.174),.68)
tread = material('Moulded rubber detail',(.065,.060,.081),.78)
stage = material('Charcoal studio drop',(.056,.060,.074),.88)
sources = [material('Prism emitter ' + str(i),hsv_to_rgb(i / 16,.68,1),.46,2.5) for i in range(16)]
b = knit.node_tree.nodes.get('Principled BSDF')
noise = knit.node_tree.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 155
noise.inputs['Roughness'].default_value = .72
bump = knit.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = .31
bump.inputs['Distance'].default_value = .025
knit.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
knit.node_tree.links.new(bump.outputs['Normal'],b.inputs['Normal'])

out = [(-1.27,.15,.21,.11),(-1.10,.40,.195,.135),(-.55,.43,.195,.126),(.2,.51,.18,.12),(.82,.51,.18,.13),(1.21,.31,.19,.135),(1.36,.04,.21,.097)]
upper = [(-1.21,.16,.49,.23),(-1.03,.34,.61,.38),(-.73,.40,.62,.383),(-.34,.42,.51,.31),(.15,.46,.45,.245),(.57,.48,.37,.185),(1.05,.38,.31,.126),(1.28,.18,.29,.09),(1.36,.02,.265,.05)]
lamp_curves = []
for pair in range(2):
    shoe = bpy.data.objects.new('Left trainer' if pair == 0 else 'Right trainer',None)
    bpy.context.collection.objects.link(shoe)
    shoe.location = (.12 if pair else -.14, -.60 if pair else .40, .0)
    shoe.rotation_euler.z = radians(-8 if pair else 11)
    knit_upper=surface('Knit trainer upper',upper,knit)
    objects = [surface('Rounded carbon cupsole',out,rubber),knit_upper,heel_opening(knit_upper,tongue_mat)]
    objects.append(fabric_panel('Visible padded tongue', [(-.68,-.178,.970),(-.70,-.128,1.021),(-.70,.128,1.021),(-.68,.178,.970),
         (-.28,.17,.819),(.31,.138,.637),(.35,0,.616),(.31,-.138,.637),(-.28,-.17,.819)],tongue_mat))
    objects.append(surface('Visible toe bumper',[(.63,.46,.337,.138),(1.03,.393,.314,.139),(1.24,.221,.298,.099),(1.36,.025,.270,.053)],toe_mat))
    for sign in (1,-1):
        objects.append(cord('Side counter stitch',[(-1.11,.34*sign,.46),(-.85,.389*sign,.57),(-.53,.42*sign,.53),(-.24,.449*sign,.43)],.023,trim))
        strip = [(-1.16,.366,.24),(-.99,.405,.245),(-.8,.432,.25),(-.58,.444,.25),(-.30,.48,.24),(-.05,.508,.24),(.2,.526,.225),
                 (.43,.529,.229),(.65,.526,.235),(.87,.51,.242),(1.05,.427,.24),(1.16,.333,.24)]
        for index in range(len(strip)-1):
            a,b = strip[index:index+2]
            pts = [(x,y*sign,z) for x,y,z in (a,b)]
            objects.append(cord('Inset channel',pts,.031,channels))
            ribbon = cord('Segment of sole light pipe',[(x,(y+.036)*sign,z+.012) for x,y,z in (a,b)],.021,sources[index])
            objects.append(ribbon)
            lamp_curves.append((ribbon,index+pair*2))
        for x in (-.9,-.5,0,.4,.82):
            objects.append(cord('Tread recess',[(x,sign*.31,.13),(x+.12,sign*.39,.14)],.017,tread))
    lace_rows = [(-.57,.215,.926),(-.36,.225,.867),(-.14,.228,.811),(.06,.230,.752),(.24,.228,.704)]
    for x,r,z in lace_rows:
        for sign in (-1,1):
            objects.append(eyelet(x,sign*r,z-.025,eyelet_mat))
    for index,(row_a,row_b) in enumerate(zip(lace_rows,lace_rows[1:])):
        x,width,z=row_a
        next_x,next_width,next_z=row_b
        for sign in (-1,1):
            path=[(x,sign*width,z),((x+next_x)/2,0,(z+next_z)/2+.025),(next_x,-sign*next_width,next_z)]
            objects.append(cord('Lace dark sleeve',path,.028,channels))
            c = cord('RGB woven lace',[(xx,yy,zz+.014) for xx,yy,zz in path],.019,sources[index*3])
            objects.append(c)
            lamp_curves.append((c,index*3+pair*3+sign))
    for o in objects:
        o.parent = shoe
bpy.ops.mesh.primitive_plane_add(size=200)
bpy.context.object.data.materials.append(stage)
area('Soft product key',(1.2,1.8,4.5),(0,0,0),(1,.77,.56),430,4.5)
area('Blue rim from floor lights',(-2.4,-2.8,2.6),(0,0,.4),(.50,.69,1),380,3.0)
area('Neutral fill',(3.2,-.30,2.9),(0,0,.4),(.93,.96,1),230,3.5)
bpy.ops.object.camera_add(location=(4.6,-6.6,4.1))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.52))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type, camera.data.ortho_scale='ORTHO',4.5
scene=bpy.context.scene
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=28
scene.cycles.use_denoising=False
scene.render.resolution_x=900
scene.render.resolution_y=490
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.world.color=(.13,.13,.13)
scene.use_nodes=True
nodes=scene.node_tree.nodes
glare=nodes.new('CompositorNodeGlare')
glare.glare_type='FOG_GLOW'
glare.quality='HIGH'
if hasattr(glare,'threshold'): glare.threshold=1.7
scene.node_tree.links.new(nodes.get('Render Layers').outputs['Image'],glare.inputs['Image'])
scene.node_tree.links.new(glare.outputs['Image'],nodes.get('Composite').inputs['Image'])
for phase in (0,5,10):
    for obj,i in lamp_curves:
        obj.data.materials[0]=sources[(i+phase)%len(sources)]
    scene.render.filepath=str(output/f'prism-{phase}.png')
    bpy.ops.render.render(write_still=True)
