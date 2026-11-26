"""Model the connected Park paths and bake their gravel in Blender 4.3.

blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/build_park_paths.py -- /tmp/park-paths
Convert park-gravel.png to WebP with ImageMagick: -strip -quality 86.
"""
from bisect import bisect_right
from collections import Counter
from math import ceil, cos, pi, sin, tau
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector, geometry

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import export_scene, paint, srgb, studio

destination = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def ribbon(points, width):
    v = [Vector(p) for p in points]
    line = []
    for i, (b, c) in enumerate(zip(v, v[1:])):
        a, d = v[max(i-1, 0)], v[min(i+2, len(v)-1)]
        samples = ceil((c-b).length / .72)
        for j in range(samples):
            t = j/samples
            line.append((2*b + (c-a)*t + (2*a-5*b+4*c-d)*t*t + (3*b-a-3*c+d)*t*t*t)*.5)
    line.append(v[-1])
    sides = [[], []]
    for i, p in enumerate(line):
        tangent = (line[min(i+1, len(line)-1)] - line[max(0, i-1)]).normalized()
        normal = Vector((-tangent.y, tangent.x)) * (width * .5)
        sides[0].append(p + normal)
        sides[1].append(p - normal)
    return sides[0] + list(reversed(sides[1]))


# Point order is x, z as in the game. Each spur ends inside its neighbouring path.
# The broad quarter-circles leave an inner radius large enough for the kerbs.
def turn(x, z, start, end, radius=2.60):
    return [(x + radius*cos(start+(end-start)*i/6), z + radius*sin(start+(end-start)*i/6))
            for i in range(7)]


routes = [
    (2.62, [(-15, -10.59), (-10.2, -10.59), (0, -10.66), (10.5, -10.59), (15, -10.59)]),
    (2.76, [(0, -10.67), (.16, -6), (.02, -2.6), (-.17, 1.4), (.05, 6.0), (.12, 10.4), (0, 14.66)]),
    (2.28, [(-11.2, -10.61), (-11.22, -5.7), (-11.12, 1.5), (-11.25, 7.9),
            *turn(-8.65, 9.78, pi, pi/2), (-5, 12.40), (0, 12.30), (5.5, 12.28),
            *turn(9.03, 10.28, pi/2, 0, 2.35), (11.38, 7.8), (11.31, -2.4), (11.2, -7), (11.3, -10.61)]),
    (1.92, [(-13.14, 1.4), (-10.6, 1.4), (-7.4, 1.51), (-3.9, 1.23), (.0, 1.4)]),
    (1.91, [(0, -2.42), (3.1, -2.58), (6.3, -2.26), (9.2, -2.39), (11.35, -2.39)]),
]
footprints = [ribbon(points, w) for w, points in routes]
points, edges = [], []
for outline in footprints:
    start = len(points)
    points.extend(outline)
    edges.extend((start+i, start+(i+1)%len(outline)) for i in range(len(outline)))
verts, _, triangles, *_ = geometry.delaunay_2d_cdt(points, edges, [], 0, .0001, False)


def inside(point, polygon):
    x, z = point
    hit = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a.y > z) != (b.y > z) and x < a.x + (b.x-a.x)*(z-a.y)/(b.y-a.y):
            hit = not hit
    return hit


faces = []
for a, b, c in triangles:
    p, q, r = verts[a], verts[b], verts[c]
    turn = (q-p).cross(r-p)
    if abs(turn) > 1e-8 and any(inside((p+q+r)/3, path) for path in footprints):
        faces.append((a, b, c) if turn > 0 else (a, c, b))

# Extract the true outer edges and the edges of the lawns from the triangulated union.
# Crossings have no edge here, so no curb runs across a path.
directed = Counter((f[i], f[(i+1)%3]) for f in faces for i in range(3))
border = {a: b for a, b in directed if (b, a) not in directed}
assert len(border) == sum((b, a) not in directed for a, b in directed)
loops = []
while border:
    i = start = next(iter(border))
    loop = []
    while True:
        loop.append(verts[i])
        i = border.pop(i)
        if i == start:
            break
    loops.append(loop)


def make_mesh(name, points, faces, materials):
    data = bpy.data.meshes.new(name)
    data.from_pydata(points, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    for material in materials:
        data.materials.append(material)
    return ob


gravel = paint("Gravel for warm streetlights", "ffffff", "park gravel", .94)
surface = make_mesh("Connected park path surface",
    [(v.x, -v.y, .015) for v in verts], [tuple(reversed(face)) for face in faces], [gravel])
uv = surface.data.uv_layers.new()
for loop in surface.data.loops:
    p = surface.data.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = (p.x / 3.2, p.y / 3.2)

# The low granite setts only border the final union. Bevelled profiles keep the edge
# readable without the thick, overlapping boxes that used to cross intersections.
stone = [paint("Granite " + color, color, "park granite", .91) for color in
         ("62616a", "6d6a69", "717071", "605953", "77736e", "4b4747")]
edge_profile = [(0, -.012), (0, .043), (.031, .064), (.126, .064), (.160, .040), (.16, -.01)]
corners, kerb_faces, finishes = [], [], []
rng = random.Random(842)
for edge in loops:
    stations = [0.]
    normals = []
    for i, p in enumerate(edge):
        a, b = edge[i-1], edge[(i+1)%len(edge)]
        incoming, outgoing = (p-a).normalized(), (b-p).normalized()
        left, right = Vector((incoming.y, -incoming.x)), Vector((outgoing.y, -outgoing.x))
        bisector = (left+right).normalized()
        normals.append(bisector / max(.57, bisector.dot(right)))
        stations.append(stations[-1]+(b-p).length)
    length = stations[-1]
    blocks = max(1, round(length / .65))
    span = length/blocks
    colors = [rng.randrange(5) for _ in range(blocks)]
    seam = .013
    knots = sorted(set(stations[:-1] + [span*i for i in range(blocks)] +
                       [span*i - seam for i in range(1, blocks+1)]))
    stations_count, cross = len(knots), len(edge_profile)
    offset = len(corners)
    for s in knots:
        i = bisect_right(stations, s)-1
        j = (i+1)%len(edge)
        t = (s-stations[i])/(stations[i+1]-stations[i])
        p, outward = edge[i].lerp(edge[j], t), normals[i].lerp(normals[j], t)
        corners.extend((p.x + outward.x*ext, -p.y - outward.y*ext, y) for ext, y in edge_profile)
    for i in range(stations_count):
        j = (i+1)%stations_count
        center = (knots[i] + (length if j == 0 else knots[j]))*.5
        block = min(blocks-1, int(center/span))
        color = 5 if center > span*(block+1)-seam else colors[block]
        for k in range(cross-1):
            kerb_faces.append(tuple(offset+m*cross+n for m, n in
                                    ((i,k),(j,k),(j,k+1),(i,k+1))))
            finishes.append(color)
kerb = make_mesh("Bevelled granite border", corners, kerb_faces, stone)
for face, finish in zip(kerb.data.polygons, finishes):
    face.material_index = finish

export_scene(destination / "park-paths.json", "Park path network", [surface, kerb], textured={"park gravel"})

# Bake a seamless sand-and-stone tile, using a periodic 4D noise domain. Two scales
# put both compacted patches and fine chips into the map at the city camera height.
graph = gravel.node_tree
links = graph.links
u = graph.nodes.new("ShaderNodeTexCoord").outputs["UV"]
split = graph.nodes.new("ShaderNodeSeparateXYZ")
links.new(u, split.inputs[0])


def math_node(operation, *args):
    node = graph.nodes.new("ShaderNodeMath")
    node.operation = operation
    for i, value in enumerate(args):
        if isinstance(value, bpy.types.NodeSocket):
            links.new(value, node.inputs[i])
        else:
            node.inputs[i].default_value = value
    return node.outputs[0]


a, b = [math_node("MULTIPLY", split.outputs[i], tau) for i in (0, 1)]
coords = graph.nodes.new("ShaderNodeCombineXYZ")
for i, value in enumerate((math_node("COSINE", a), math_node("SINE", a), math_node("COSINE", b))):
    links.new(value, coords.inputs[i])
w = math_node("SINE", b)


def noise(cycles, detail, seed):
    node = graph.nodes.new("ShaderNodeTexNoise")
    node.noise_dimensions = "4D"
    links.new(coords.outputs[0], node.inputs["Vector"])
    links.new(math_node("ADD", w, seed), node.inputs["W"])
    node.inputs["Scale"].default_value = cycles/tau
    node.inputs["Detail"].default_value = detail
    return node.outputs["Fac"]


source = math_node("ADD", math_node("MULTIPLY", noise(152, 1.35, .94), .72),
                   math_node("MULTIPLY", noise(11, 3, 4.2), .28))
mix = graph.nodes.new("ShaderNodeValToRGB")
links.new(source, mix.inputs[0])
for i, (p, color) in enumerate(((.23, "4a433d"), (.48, "817567"), (.60, "a89b82"), (.76, "c9bca2"))):
    stop = mix.color_ramp.elements[i] if i < 2 else mix.color_ramp.elements.new(p)
    stop.position, stop.color = p, (*srgb(color), 1)
emit = graph.nodes.new("ShaderNodeEmission")
links.new(mix.outputs[0], emit.inputs[0])
links.new(emit.outputs[0], graph.nodes["Material Output"].inputs["Surface"])

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -90, 0))
tile = bpy.context.object
tile.data.materials.append(gravel)
bpy.ops.object.camera_add(location=(0, -90, 2))
cam = bpy.context.object
cam.data.type, cam.data.ortho_scale = "ORTHO", 1
scene = bpy.context.scene
scene.camera = cam
scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.render.filepath = str(destination / "park-gravel.png")
bpy.ops.render.render(write_still=True)
bpy.data.objects.remove(tile, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)

shader = graph.nodes["Principled BSDF"]
links.new(mix.outputs[0], shader.inputs["Base Color"])
links.new(shader.outputs[0], graph.nodes["Material Output"].inputs["Surface"])
grass = paint("Preview lawn", "243b2b")
bpy.ops.mesh.primitive_plane_add(size=34, location=(0, 0, 0))
bpy.context.object.name = "Preview lawn"
bpy.context.object.data.materials.append(grass)
scene.view_settings.view_transform = "AgX"
studio(scene, (5, -9, 13), (0, 2, 0), 10.8, destination / "park-blender.png")
bpy.ops.wm.save_as_mainfile(filepath=str(destination / "park-paths.blend"), compress=True)
bpy.ops.render.render(write_still=True)
