"""Build the city graffiti wall, four concrete finishes and a shared paint-wear mask.

blender -b -t 6 --factory-startup --python tools/build_city_graffiti.py -- /tmp/graffiti
The output can contain sample-bubble.png, sample-chrome.png and sample-stencil.png
before running Blender. The preview scene packs any available lettering samples.
Convert concrete.png with ImageMagick (-strip -quality 86) and wear.png with
(-strip -depth 5 -define webp:lossless=true) to img/graffiti-{concrete,wear}.webp.
Copy the wall JSON to anim/.
"""
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import export_scene, paint, point_at, srgb, studio

out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.use_denoising = False

finishes = [
    ("Yard · board-formed slab", "444248", "96928a", "705142"),
    ("Downtown · cast concrete", "424850", "a39f92", "58657c"),
    ("Park · weathered retaining wall", "424c42", "949687", "556443"),
    ("Industrial · soot and mill dust", "393a3d", "817771", "6d4938"),
]


def concrete(name, shadow, light, stain, variant):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    graph = mat.node_tree

    def bind(socket, value):
        if isinstance(value, bpy.types.NodeSocket):
            graph.links.new(value, socket)
        else:
            socket.default_value = value

    def math(op, *values):
        n = graph.nodes.new("ShaderNodeMath")
        n.operation = op
        for socket, value in zip(n.inputs, values):
            bind(socket, value)
        return n.outputs[0]

    def ramp(value, stops, label):
        n = graph.nodes.new("ShaderNodeValToRGB")
        n.label = label
        bind(n.inputs[0], value)
        for i, (pos, color) in enumerate(stops):
            elem = n.color_ramp.elements[i] if i < 2 else n.color_ramp.elements.new(pos)
            elem.position = pos
            elem.color = (*srgb(color), 1) if isinstance(color, str) else (color,) * 3 + (1,)
        return n.outputs["Color"]

    def noise(vector, scale, detail, label):
        n = graph.nodes.new("ShaderNodeTexNoise")
        n.label = label
        bind(n.inputs["Vector"], vector)
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        return n.outputs["Fac"]

    def vec(*channels):
        n = graph.nodes.new("ShaderNodeCombineXYZ")
        for socket, value in zip(n.inputs, channels):
            bind(socket, value)
        return n.outputs[0]

    def mix(fac, a, b, mode="MIX"):
        n = graph.nodes.new("ShaderNodeMixRGB")
        n.blend_type = mode
        for socket, value in zip(n.inputs, (fac, a, b)):
            bind(socket, value)
        return n.outputs[0]

    uv = graph.nodes.new("ShaderNodeTexCoord").outputs["UV"]
    split = graph.nodes.new("ShaderNodeSeparateXYZ")
    bind(split.inputs[0], uv)
    u, v = split.outputs[:2]
    face = vec(math("MULTIPLY", u, 1.64), v, variant * 2.4)
    mottles = noise(face, 5.8, 3, "Trowel marks and weather")
    grit = noise(face, 150, 2, "Fine aggregate")
    pores = noise(face, 260, 1, "Cast pinholes")
    washed = noise(vec(math("MULTIPLY", u, 2.6), math("MULTIPLY", v, .56), variant + .8), 7, 2, "Rain streaks")
    base = ramp(mottles, [(.21, shadow), (.77, light)], "Concrete colour")
    base = mix(.42, base, ramp(grit, [(.25, .25), (.70, .92)], "Aggregate shadows"), "MULTIPLY")
    wet = ramp(washed, [(.33, .56), (.54, .13), (.67, .0)], "Water and rust traces")
    base = mix(wet, base, (*srgb(stain), 1))
    footing = ramp(v, [(.00, .62), (.16, .22), (.29, .0)], "Damp at the ground")
    base = mix(footing, base, (*srgb(shadow), 1))

    # A short irregular hairline crack. Its path is broken up by the casting grain.
    center = math("ADD", .46, math("ADD", math("MULTIPLY", math("SUBTRACT", v, .54), .185),
                                    math("MULTIPLY", math("SUBTRACT", noise(face, 20, 2, "Crack edge"), .5), .032)))
    cross = math("ABSOLUTE", math("SUBTRACT", u, center))
    length = ramp(v, [(.45, 0.), (.52, .62), (.84, .53), (.98, 0.)], "Crack length")
    crack = math("MULTIPLY", ramp(cross, [(.0006, 1.), (.0024, 0.)], "Fine crack"), length)
    cavity = ramp(pores, [(.27, .79), (.42, .0)], "Open pores")
    flake = ramp(math("MULTIPLY", washed, mottles), [(.35, .0), (.45, .23), (.57, .46)], "Patchy abrasion")
    wear = math("MAXIMUM", crack, math("MAXIMUM", cavity, flake))
    base = mix(math("MAXIMUM", crack, math("MULTIPLY", cavity, .65)), base, (*srgb(shadow), 1))
    height = math("SUBTRACT", grit, wear)

    surface = graph.nodes.get("Principled BSDF")
    bind(surface.inputs["Base Color"], base)
    surface.inputs["Roughness"].default_value = .89
    bump = graph.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .32
    bump.inputs["Distance"].default_value = .019
    bind(bump.inputs["Height"], height)
    bind(surface.inputs["Normal"], bump.outputs[0])
    return mat, base, wear, surface


def rectangle(name, width, height, location):
    w, h = width / 2, height / 2
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-w, 0, -h), (w, 0, -h), (w, 0, h), (-w, 0, h)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new()
    for loop, value in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = value
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    ob.location = location
    return ob


def render(name, size, linear=False):
    scene.view_settings.view_transform = 'Raw' if linear else 'Standard'
    scene.view_settings.look = 'None'
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(out / (name + ".png"))
    bpy.ops.render.render(write_still=True)


materials = [concrete(*finish, i) for i, finish in enumerate(finishes)]
swatches = []
for i, (mat, *_rest) in enumerate(materials):
    swatch = rectangle(mat.name, 1.64, 1., ((i % 2 - .5) * 1.64, 0, .5 - i // 2))
    swatch.data.materials.append(mat)
    swatches.append(swatch)

bpy.ops.object.camera_add(location=(0, -4, 0))
bake_camera = scene.camera = bpy.context.object
point_at(scene.camera, (0, 0, 0))
scene.camera.data.type = "ORTHO"
scene.camera.data.ortho_scale = 3.28
scene.camera.data.lens = 50

# Sample colours and weathering directly from shader nodes without baking in lights.
for pass_name, socket, size, linear in (
    ("concrete", 1, (1536, 936), False),
    ("wear", 2, (768, 468), True),
):
    temporary = []
    for item in materials:
        mat, graph = item[0], item[0].node_tree
        emit = graph.nodes.new("ShaderNodeEmission")
        graph.links.new(item[socket], emit.inputs[0])
        graph.links.new(emit.outputs[0], graph.nodes.get("Material Output").inputs["Surface"])
        temporary.append((graph, emit, item[3]))
    render(pass_name, size, linear)
    for graph, emit, surface in temporary:
        graph.nodes.remove(emit)
        graph.links.new(surface.outputs[0], graph.nodes.get("Material Output").inputs["Surface"])
for ob in [*swatches, bake_camera]:
    bpy.data.objects.remove(ob, do_unlink=True)

body = paint("Raw concrete edges", "676462")
cap = paint("Weathered capstone", "626267")
foot = paint("Darkened concrete plinth", "4e4b46")
detail = paint("Embedded ferrous steel", "4c4a49", "steel", .68, .35)


def box(name, location, dimensions, material, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name, ob.dimensions = name, dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(material)
    mod = ob.modifiers.new("Cast edge bevels", "BEVEL")
    mod.width, mod.segments = bevel, 2
    mod = ob.modifiers.new("Flat concrete faces", "WEIGHTED_NORMAL")
    mod.keep_sharp = True
    return ob


shell = [
    box("Cast wall", (0, .01, 1.1), (3.60, .28, 2.2), body, .045),
    box("Beveled capstone", (0, 0, 2.22), (3.67, .35, .13), cap, .036),
    box("Damp plinth", (0, .002, .105), (3.58, .32, .20), foot, .031),
]
for x in [-1.62, 1.62]:
    shell.append(box("Cap reinforcing plate", (x, -.002, 2.284), (.058, .26, .018), detail, .007))
export_scene(out / "graffiti-wall.json", "Graffiti wall", shell)

for i, name in enumerate(("bubble", "chrome", "stencil")):
    center = (i - 1) * 4.08
    for part in shell:
        copy = part.copy()
        copy.location.x += center
        scene.collection.objects.link(copy)
    ob = rectangle(finishes[i][0] + " · mural", 3.52, 2.13, (center, -.134, 1.10))
    mat, _, wear, surface = materials[i if i < 2 else 3]
    ob.data.materials.append(mat)
    sample = out / ("sample-" + name + ".png")
    if sample.exists():
        graph = mat.node_tree
        image = graph.nodes.new("ShaderNodeTexImage")
        image.image = bpy.data.images.load(str(sample))
        image.image.pack()
        image.label = "Editable lettering sample"
        abrasion = graph.nodes.new("ShaderNodeMath")
        abrasion.operation = "SUBTRACT"
        abrasion.inputs[0].default_value = 1.
        graph.links.new(wear, abrasion.inputs[1])
        amount = graph.nodes.new("ShaderNodeMath")
        amount.operation = "MULTIPLY"
        graph.links.new(abrasion.outputs[0], amount.inputs[0])
        graph.links.new(image.outputs["Alpha"], amount.inputs[1])
        mix = graph.nodes.new("ShaderNodeMixRGB")
        graph.links.new(amount.outputs[0], mix.inputs[0])
        graph.links.new(materials[i if i < 2 else 3][1], mix.inputs[1])
        graph.links.new(image.outputs["Color"], mix.inputs[2])
        graph.links.new(mix.outputs[0], surface.inputs["Base Color"])
for part in shell:
    bpy.data.objects.remove(part, do_unlink=True)

box("Studio paving", (0, 0, -.11), (40, 24, .20), paint("Paving", "292d35"), .035)
studio(scene, (2.7, -12, 5.0), (0, 0, 1.06), 13.15, out / "graffiti-blender.png")
scene.cycles.samples = 44
scene.cycles.use_denoising = False
scene.view_settings.view_transform = "AgX"
scene.render.resolution_x, scene.render.resolution_y = 1620, 620
bpy.ops.wm.save_as_mainfile(filepath=str(out / "graffiti-walls.blend"))
bpy.ops.render.render(write_still=True)
