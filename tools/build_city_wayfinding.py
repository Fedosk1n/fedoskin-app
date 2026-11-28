"""Build the fixed sign mounts for the Club and Yard and render an original material board.

blender -b -t 5 --python tools/build_city_wayfinding.py -- --out /tmp/city-wayfinding
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--out', type=Path, default=Path('/tmp/city-wayfinding'))
args = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
args.out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene


def preserve(color):
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)


def mat(name, color, metal=0, rough=.75):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*preserve(color),1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*preserve(color),1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    return m


def pos(pt):
    x,y,z=pt;return (x,-z,y)


def group(name):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);return o


def block(name, at, dims, m, parent=None, radius=.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos(at));obj=bpy.context.object
    obj.name=name;obj.dimensions=pos((dims[0],dims[1],-dims[2]));obj.parent=parent
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if radius:
        bevel=obj.modifiers.new('Rounded wear','BEVEL');bevel.width=radius;bevel.segments=2
        obj.modifiers.new('Weighted corners','WEIGHTED_NORMAL')
    obj.data.materials.append(m)
    return obj


def disk(name, at, r, d, m, parent=None, rotate=True, sides=26):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=d, location=pos(at), rotation=(math.pi/2 if rotate else 0,0,0))
    obj=bpy.context.object;obj.name=name;obj.parent=parent;obj.data.materials.append(m);return obj

steel=mat('Dark oxidized folded steel','#384347',.65,.54)
rim=mat('Rubbed edges','#788981',.58,.45)
bolts=mat('Brass pins and steel fixings','#b6a794',.69,.47)
paper=mat('Paper and paste','#d1b694')
wood=mat('Oiled wood','#665048',0,.69)
black=mat('Textured black linoleum','#202a30')
green=mat('Matt painted exit board','#2e5954',.12)
orange=mat('Dull orange stencil','#c0814e')
cream=mat('Uncoated lettering','#e1cda5')
masonry=mat('Blue-black painted masonry','#29373e')

score=group('club-score-frame')
block('Dark steel backing',(0,0,.039),(5.60,1.17,.135),steel,score,.034)
for x in [-2.75,2.75]:
    block('Wall anchor leg',(x,0,-.062),(.14,.99,.24),rim,score,.023)
    for y in [-.48,.48]:disk('Bolt cap',(x,y,.116),.043,.021,bolts,score,sides=10)
for y in [-.54,.54]:block('Folded metal edge',(0,y,.112),(5.51,.047,.068),rim,score,.013)

archive=group('club-archive')
block('Framed pinboard',(0,0,.034),(2.78,1.45,.118),wood,archive,.04)
block('Recessed cork liner',(0,0,.105),(2.62,1.28,.035),black,archive,.016)
for y in [-.69,.69]:block('Archive wood trim',(0,y,.13),(2.70,.072,.074),rim,archive,.015)
for x in [-1.35,1.35]:block('Archive stile',(x,0,.13),(.075,1.40,.074),rim,archive,.015)
for dx, tilt in [(-.85,-.074),(0,.054),(.85,-.018)]:
    ob=block('Printed match sheet',(dx,-.20,.136),(.63,.60,.019),paper,archive,.015)
    ob.rotation_euler.y=tilt
    disk('Corner pin',(dx+.1,.09,.151),.031,.025,bolts,archive,sides=8)

badge=group('decks-badge')
disk('Flush-mounted vinyl plate',(0,0,.030),.283,.062,black,badge)
disk('Aluminum edge under record',(0,0,.008),.302,.033,rim,badge)
for r in [.223,.247,.269]:
    bpy.ops.mesh.primitive_torus_add(major_segments=26,minor_segments=5,location=pos((0,0,.064)),major_radius=r,minor_radius=.0024,rotation=(math.pi/2,0,0))
    b=bpy.context.object;b.name='Groove';b.parent=badge;b.data.materials.append(rim)
disk('Paper center label',(0,0,.071),.137,.019,orange,badge)
for x in [-.22,.22]:
    disk('Panel fix',(x,-.17,.064),.022,.022,bolts,badge,sides=8)

exit=group('club-exit-frame')
for side in [-1,1]:
    block('Short masonry return', (side*1.98,1.19,.035),(1.58,2.36,.38),masonry,exit,.026)
    for y in [.27,.51,.75,.99,1.23,1.47,1.71,1.95,2.19]:
        block('Recessed mortar line', (side*1.98,y,-.161),(1.54,.011,.009),steel,exit,.002)
for x in [-1.17,1.17]:
    block('Worn welded jamb',(x,1.12,0),(.174,2.20,.29),steel,exit,.027)
    block('Concrete threshold plate',(x,.057,0),(.43,.114,.48),rim,exit,.026)
    block('Light on jamb',(x*.95,1.19,-.159),(.035,1.78,.025),green,exit,.012)
    for y in [.21,2.05]:
        for z in (-.158,.158):disk('Anchor head',(x,y,z),.042,.026,bolts,exit,sides=10)
block('Exit header',(0,2.28,0),(2.60,.36,.32),steel,exit,.032)
for sz in [-1,1]:
    block('Safety enamel face',(0,2.29,sz*.181),(1.78,.245,.058),green,exit,.032)
    for x in [-.79,.79]:disk('Enamel fastener',(x,2.29,sz*.220),.022,.025,bolts,exit,sides=10)
block('Flat threshold',(0,.013,0),(2.17,.026,.43),rim,exit,.015)

atelier=group('yard-sewing-plate')
block('Enamel shop blade',(0,0,.017),(1.67,.345,.069),green,atelier,.030)
for x in [-.74,.74]:
    block('Bracket behind shop plate',(x,0,-.046),(.081,.32,.078),steel,atelier,.017)
    for y in [-.091,.091]:disk('Enamel pin',(x,y,.058),.020,.025,bolts,atelier,sides=8)

# Bind meshes to each role, merging batches per asset for the real scene.
for parent in [score,archive,badge,exit,atelier]:
    children=list(parent.children)
    for obj in children:
        bpy.context.view_layer.objects.active=obj
        for modifier in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in children:obj.select_set(True)
    bpy.context.view_layer.objects.active=children[0]
    bpy.ops.object.join()
    mesh=bpy.context.object;mesh.name=parent.name+' mesh'

bpy.ops.export_scene.gltf(filepath=str(root/'anim/city-wayfinding.glb'),export_texcoords=False,export_yup=True,export_normals=True)

# Presentation model with material, mounts and scale in each sample.
def legend(name,line,at,size,parent=None,face=True,m=cream):
    f=bpy.data.curves.new(name,'FONT');f.body=line;f.size=size;f.align_x='CENTER';f.extrude=.0001;f.materials.append(m)
    o=bpy.data.objects.new(name,f);scene.collection.objects.link(o);o.parent=parent;o.location=pos(at)
    if face:o.rotation_euler.x=math.pi/2
    return o

score.location=pos((-3.00,2.35,-.55));score.scale*=.64
archive.location=pos((-1.66,1.12,-.52));archive.scale*=.80
badge.location=pos((.1,1.24,-.09));badge.scale*=1.37
exit.location=pos((3.13,0,.10));exit.scale*=.88
atelier.location=pos((-.31,2.24,-.15))
block('Scuffed concrete rear display',(0,1.67,-.77),(9,3.4,.35),mat('Dark brick','#33434a'),radius=.02)
block('Rubbed dark DJ cabinet',(.10,.67,-.52),(1.43,1.45,.81),wood)
block('Concrete ground',(0,-.12,.4),(200,.22,200),mat('Painted floor','#3e4b4b'),radius=0)
block('Parquet swatch',(-2.50,.028,1),(4.64,.045,1.82),mat('Warm parquet','#875d42'),radius=.02)
for z in [.3,.6,.9,1.2,1.5,1.8]:block('Parquet seam',(-2.5,.055,z),(4.54,.008,.012),wood,radius=.002)
legend('Club title in paint','7 TO SMOKE',(-2.48,.058,1.16),.38,face=False)
legend('Score reading', '7  TO  SMOKE', (0,-.11,.122),.25,score)
legend('Archive heading','RESULTS',(0,.33,.143),.23,archive)
for i, x in enumerate([-.85,0,.85]):legend('Archive print','0'+str(i+1),(x,-.28,.155),.21,archive,m=black)
legend('Vinyl center','DJ',(0,-.03,.086),.096,badge,m=black)
legend('Exit direction','EXIT',(0,2.22,.238),.17,exit)
legend('Tailor plaque','ATELIER',(0,-.066,.057),.17,atelier)


def area(name,xyz,target,col,w,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=w;d.color=preserve(col);d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos(xyz)
    o.rotation_euler=(Vector(pos(target))-o.location).to_track_quat('-Z','Y').to_euler()


area('Metal edge',(1.9,5.8,4),(0,1,0),'#f7cc99',1360,5)
area('Club light',(-4.4,4.0,-.5),(0,1,0),'#a0c9d3',1780,5)
cdata=bpy.data.cameras.new('Mounted details');camera=bpy.data.objects.new('Mounted details',cdata);scene.collection.objects.link(camera);scene.camera=camera
camera.location=pos((.18,6.02,11.5));camera.rotation_euler=(Vector(pos((.15,1.26,.1)))-camera.location).to_track_quat('-Z','Y').to_euler();cdata.type='ORTHO';cdata.ortho_scale=9.6
scene.world.color=(.13,.13,.13)
scene.render.engine='CYCLES';scene.cycles.samples=22;scene.cycles.use_denoising=False
scene.render.image_settings.file_format='PNG';scene.render.resolution_x=1300;scene.render.resolution_y=740;scene.render.resolution_percentage=100
scene.render.filepath=str(args.out/'mounted-signs.png');bpy.ops.render.render(write_still=True)
