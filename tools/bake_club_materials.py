"""Bake PBR maps for the 3D Club and render a Blender material preview.

blender -b -t 3 --factory-startup --python-exit-code 1 \
  --python tools/bake_club_materials.py -- /tmp/club-materials
Add --maps-only after the output directory to skip the preview.
Copy the WebP files from the output directory to img/. Surface channels are linear:
red = height, green = roughness. ImageMagick encodes the WebP files.
"""
from math import tau
from pathlib import Path
import shutil
import subprocess
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from city_blender_export import point_at, srgb


def rgba(hex_value):
    return (*srgb(hex_value), 1.0)


class Material:
    def __init__(self, name):
        self.material = bpy.data.materials.new(name)
        self.material.use_nodes = True
        self.tree = self.material.node_tree
        self.tree.nodes.clear()
        self.output = self.tree.nodes.new("ShaderNodeOutputMaterial")
        self.uv = self.tree.nodes.new("ShaderNodeTexCoord").outputs["UV"]
        self.u, self.v, _ = self.node("ShaderNodeSeparateXYZ", self.uv).outputs
        self.angles = [self.math("MULTIPLY", axis, tau) for axis in (self.u, self.v)]
        self._layout = {}
        self.output.location = (880, 150)

    def put(self, socket, value):
        if isinstance(value, bpy.types.NodeSocket):
            self.tree.links.new(value, socket)
        else:
            socket.default_value = value

    def node(self, kind, *values, name=None):
        node = self.tree.nodes.new(kind)
        if name:
            node.label = name
        for socket, value in zip(node.inputs, values):
            self.put(socket, value)
        return node

    def math(self, op, *values):
        node = self.node("ShaderNodeMath", *values)
        node.operation = op
        return node.outputs[0]

    def mix(self, factor, a, b, mode="MIX"):
        node = self.node("ShaderNodeMixRGB", factor, a, b)
        node.blend_type = mode
        return node.outputs[0]

    def ramp(self, value, stops, name=None):
        node = self.node("ShaderNodeValToRGB", value, name=name)
        colors = node.color_ramp.elements
        colors[0].position, colors[1].position = stops[0][0], stops[-1][0]
        colors[0].color, colors[1].color = self.color(stops[0][1]), self.color(stops[-1][1])
        for position, color in stops[1:-1]:
            colors.new(position).color = self.color(color)
        return node.outputs["Color"]

    @staticmethod
    def color(value):
        return rgba(value) if isinstance(value, str) else (value, value, value, 1.0)

    def noise(self, x, y, seed, detail=2, name=None):
        # The 4D torus makes edge-to-edge continuity exact, including directional grain.
        angle_x, angle_y = self.angles
        vector = self.node("ShaderNodeCombineXYZ",
                           self.math("MULTIPLY", self.math("COSINE", angle_x), x / tau),
                           self.math("MULTIPLY", self.math("SINE", angle_x), x / tau),
                           self.math("MULTIPLY", self.math("COSINE", angle_y), y / tau)).outputs[0]
        node = self.node("ShaderNodeTexNoise", name=name)
        node.noise_dimensions = "4D"
        self.put(node.inputs["Vector"], vector)
        self.put(node.inputs["W"], self.math("MULTIPLY_ADD", self.math("SINE", angle_y), y / tau, seed))
        node.inputs["Scale"].default_value = 1
        node.inputs["Detail"].default_value = detail
        node.inputs["Roughness"].default_value = .58
        return node.outputs["Fac"]

    def brick(self, width, height, seam, bevel, colors, name):
        node = self.node("ShaderNodeTexBrick", name=name)
        node.offset = .5
        node.offset_frequency = 2
        self.put(node.inputs["Vector"], self.uv)
        for key, value in (
            ("Scale", 1), ("Brick Width", width), ("Row Height", height),
            ("Mortar Size", seam), ("Mortar Smooth", bevel),
            ("Color1", rgba(colors[0])), ("Color2", rgba(colors[1])), ("Mortar", rgba(colors[2])),
        ):
            node.inputs[key].default_value = value
        return node.outputs["Color"], node.outputs["Fac"]

    def emission(self, channel):
        self.put(self.output.inputs["Surface"], self.node("ShaderNodeEmission", channel, 1.0).outputs[0])

    def finish(self, color, height, roughness, distance, metallic=0):
        node = self.node("ShaderNodeBsdfPrincipled")
        self.put(node.inputs["Base Color"], color)
        self.put(node.inputs["Roughness"], roughness)
        self.put(node.inputs["Metallic"], metallic)
        bump = self.node("ShaderNodeBump", name="Surface relief")
        bump.inputs["Strength"].default_value = .44
        bump.inputs["Distance"].default_value = distance
        self.put(bump.inputs["Height"], height)
        self.put(node.inputs["Normal"], bump.outputs[0])
        self.put(self.output.inputs["Surface"], node.outputs[0])

        # Keep the saved Blender graph readable from inputs to output. Bake-only nodes remain separate.
        def visit(current, column=0):
            if self._layout.get(current, -1) >= column:
                return
            self._layout[current] = column
            for link in (link for socket in current.inputs for link in socket.links):
                visit(link.from_node, column + 1)

        visit(self.output)
        rows = {}
        for current, column in self._layout.items():
            row = rows.get(column, 0)
            current.location = (880 - column * 240, 170 - row * 245)
            rows[column] = row + 1
        for i, current in enumerate(n for n in self.tree.nodes if n not in self._layout):
            current.location = (1040, 170 - i * 160)


def parquet(m):
    plank, joint = m.brick(.25, 1 / 34, .0004, .00035, ("975e39", "784626", "493324"), "Staggered oak boards")
    figure = m.noise(6, 48, 7, 2.3, "Lengthwise figure")
    vessels = m.noise(26, 210, 12, 1, "Fine vessels")
    patina = m.noise(3.5, 5.0, 3, 2, "Uneven varnish and foot traffic")
    streaks = m.ramp(figure, [(.24, "79604e"), (.40, "ac8e77"), (.56, "d9bea1"), (.72, "fff5d8")], "Open grain")
    color = m.mix(.43, plank, streaks, "MULTIPLY")
    color = m.mix(.23, color, m.ramp(patina, [(.25, "938071"), (.68, "f3e0c5")]), "MULTIPLY")
    color = m.mix(.16, color, m.ramp(vessels, [(.24, "665245"), (.49, "d7c7b8"), (.66, "fff5e1")]), "MULTIPLY")
    height = m.mix(joint, m.mix(.19, figure, vessels), (.18, .18, .18, 1))
    roughness = m.ramp(patina, [(.23, .30), (.51, .41), (.72, .57)])
    return color, height, m.mix(joint, roughness, (.72,) * 3 + (1,))


def masonry(m):
    brick, joint = m.brick(.25, .125, .008, .007, ("435352", "314442", "293434"), "Painted brick and recessed mortar")
    wear = m.noise(7, 8, -9, 3, "Paint wear")
    pores = m.noise(134, 116, 6, 2, "Clay pores")
    dust = m.noise(2, 3, 2, 3, "Uneven pigment")
    paint = m.ramp(m.mix(.28, wear, pores), [(.24, "616f68"), (.45, "b5c5b6"), (.72, "ebead8")])
    color = m.mix(.48, brick, paint, "MULTIPLY")
    color = m.mix(.17, color, m.ramp(dust, [(.28, "8e9482"), (.69, "f3ebd6")]), "MULTIPLY")
    height = m.mix(joint, m.mix(.46, wear, pores), (.13,) * 3 + (1,))
    roughness = m.ramp(wear, [(.24, .69), (.69, .91)])
    return color, height, roughness


def terrazzo(m):
    slab, joint = m.brick(1, .5, .0014, .0011, ("393e40", "343b3b", "232c2e"), "Control joints")
    mottle = m.noise(5, 5, 4, 2.7, "Binder and foot traffic")
    grit = m.noise(195, 195, 33, 1.1, "Fine aggregate")
    pits = m.noise(76, 88, 12, 1.6, "Aggregate flecks")
    color = m.mix(.45, slab, m.ramp(mottle, [(.22, "767e81"), (.7, "d2cab9")]), "MULTIPLY")
    chips = m.ramp(pits, [(.60, 0), (.69, .25), (.78, .76)])
    color = m.mix(chips, color, rgba("827d70"))
    height = m.mix(joint, m.mix(.52, pits, grit), (.15,) * 3 + (1,))
    roughness = m.ramp(mottle, [(.24, .50), (.62, .73), (.78, .85)])
    return color, height, roughness


def upholstery(m):
    nap = m.noise(62, 154, 24, 1.3, "Velour pile")
    shading = m.noise(4, 13, 5, 2.4, "Wear along the pile")
    shift = m.math("MULTIPLY", m.math("SINE", m.math("MULTIPLY", m.angles[0], 57)), .20)
    ribs = m.math("SINE", m.math("MULTIPLY_ADD", m.angles[1], 83, shift))
    ribs = m.math("MULTIPLY_ADD", ribs, .5, .5)
    edge = m.math("MINIMUM", m.u, m.math("SUBTRACT", 1, m.u))
    border = m.ramp(edge, [(0, 0), (.028, 0), (.032, .31), (.045, .31), (.049, 0), (1, 0)], "Woven selvedge")
    color = m.ramp(m.mix(.34, shading, nap), [(.22, "401c24"), (.43, "5b2834"), (.61, "713943"), (.74, "8b4b52")])
    color = m.mix(border, color, rgba("b08b63"))
    height = m.mix(.60, nap, ribs)
    roughness = m.ramp(shading, [(.23, .68), (.67, .95)])
    return color, height, roughness


def blackened_steel(m):
    brushing = m.noise(4, 192, -2, 1.3, "Worn brush direction")
    mill = m.noise(13, 30, 3, 3, "Mill scale")
    patina = m.noise(4, 7, -8, 2.8, "Dark patina")
    color = m.ramp(m.mix(.37, mill, brushing), [(.21, "262b2a"), (.42, "414c4a"), (.63, "687372"), (.76, "888b78")])
    color = m.mix(.28, color, m.ramp(patina, [(.21, "827065"), (.67, "e4ded0")]), "MULTIPLY")
    roughness = m.ramp(patina, [(.22, .33), (.75, .56)])
    return color, m.mix(.75, mill, brushing), roughness


def vinyl(m):
    vector = m.node("ShaderNodeVectorMath", m.uv, (.5, .5, 0))
    vector.operation = "DISTANCE"
    radius = vector.outputs["Value"]
    fine = m.math("MULTIPLY_ADD", m.math("SINE", m.math("MULTIPLY", radius, tau * 155)), .5, .5)
    track = m.math("MULTIPLY_ADD", m.math("COSINE", m.math("MULTIPLY", radius, tau * 16)), .5, .5)
    grooves = m.mix(.19, fine, track)
    color = m.ramp(grooves, [(0, "151a1d"), (.53, "252b2d"), (1, "363e40")])
    roughness = m.ramp(grooves, [(0, .29), (1, .44)])
    return color, grooves, roughness


def render(scene, output, name, size, view="Standard", samples=1):
    scene.view_settings.view_transform = view
    scene.view_settings.look = "None"
    scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.filepath = str(output / f"{name}.png")
    bpy.ops.render.render(write_still=True)


def bake(scene, output, tile):
    materials = {}
    specs = [
        ("oak", "01 · Satin oak parquet", parquet, 1024, 512, .025, 0),
        ("brick", "02 · Painted clay brick", masonry, 512, 256, .035, 0),
        ("terrazzo", "03 · Charcoal terrazzo", terrazzo, 512, 256, .018, 0),
        ("velvet", "04 · Garnet velour", upholstery, 512, 256, .009, 0),
        ("steel", "05 · Blackened brushed steel", blackened_steel, 512, 256, .006, .63),
        ("vinyl", "06 · Pressed vinyl", vinyl, 256, 256, .003, .20),
    ]
    convert = shutil.which("magick") or shutil.which("convert")
    for key, name, build, albedo_size, surface_size, distance, metallic in specs:
        mat = Material(name)
        tile.data.materials.clear()
        tile.data.materials.append(mat.material)
        color, height, roughness = build(mat)
        albedo = f"club-{key}-color"
        surface = f"club-{key}-surface"
        mat.emission(color)
        render(scene, output, albedo, (albedo_size, albedo_size))
        packed = mat.node("ShaderNodeCombineColor", height, roughness, 0, name="Red: height · Green: roughness")
        mat.emission(packed.outputs[0])
        render(scene, output, surface, (surface_size, surface_size), "Raw")
        if convert:
            subprocess.run([convert, str(output / f"{albedo}.png"), "-strip", "-quality", "86",
                            str(output / f"{albedo}.webp")], check=True)
            # WebP must be lossless for the linear data channels.
            subprocess.run([convert, str(output / f"{surface}.png"), "-strip", "-define", "webp:lossless=true",
                            "-define", "webp:method=6", str(output / f"{surface}.webp")], check=True)
        mat.finish(color, height, roughness, distance, metallic)
        materials[key] = mat.material
    return materials


def preview(scene, output, camera, tile, materials):
    bpy.data.objects.remove(tile, do_unlink=True)

    def plane(name, size, position, material, repeat=(1, 1), rotation=(0, 0, 0)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=position, rotation=rotation)
        obj = bpy.context.object
        obj.name, obj.scale = name, (*size, 1)
        obj.data.materials.append(material)
        for uv in obj.data.uv_layers.active.data:
            uv.uv.x *= repeat[0]
            uv.uv.y *= repeat[1]
        return obj

    def box(name, dimensions, position, material, bevel=.03):
        bpy.ops.mesh.primitive_cube_add(size=1, location=position)
        obj = bpy.context.object
        obj.name, obj.dimensions = name, dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            edge = obj.modifiers.new("Small machined bevels", "BEVEL")
            edge.width, edge.segments = bevel, 3
        obj.data.materials.append(material)
        return obj

    brass = bpy.data.materials.new("Warm brass")
    brass.use_nodes = True
    shader = brass.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba("c59c61")
    shader.inputs["Roughness"].default_value = .43
    shader.inputs["Metallic"].default_value = .63

    plane("Club floor", (13, 13), (0, 0, 0), materials["terrazzo"], (3, 3))
    plane("Parquet", (7.3, 7.3), (0, 0, .025), materials["oak"])
    plane("Back wall", (13, 3.2), (0, 4, 1.6), materials["brick"], (3, 2), (tau / 4, 0, 0))
    plane("Runner", (2.1, 3.0), (-2.46, -4.5, .016), materials["velvet"], (1, 2))
    for y in (-3.43, 3.43):
        box("Brass edge", (6.88, .024, .01), (0, y, .031), brass, .001)
    for x in (-3.43, 3.43):
        box("Brass edge", (.024, 6.88, .01), (x, 0, .031), brass, .001)

    bpy.ops.mesh.primitive_torus_add(major_segments=96, minor_segments=6, location=(0, 0, .022),
                                     major_radius=2.4, minor_radius=.014)
    bpy.context.object.name = "Battle circle inlay"
    bpy.context.object.data.materials.append(brass)

    box("Listening booth", (2.5, .75, .85), (-2.45, 3.04, .43), materials["steel"])
    box("Booth oak counter", (2.57, .86, .10), (-2.45, 3.04, .91), materials["oak"])
    for x in (-3.05, -1.84):
        box("Turntable", (.82, .67, .085), (x, 3.03, .998), materials["steel"])
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.286, depth=.023, location=(x, 3.03, 1.06))
        record = bpy.context.object
        record.name = "Pressed vinyl record"
        record.data.materials.append(materials["vinyl"])
        for face in record.data.polygons:
            if face.normal.z > .5:
                for i in face.loop_indices:
                    vertex = record.data.vertices[record.data.loops[i].vertex_index]
                    record.data.uv_layers.active.data[i].uv = (vertex.co.x / .572 + .5, vertex.co.y / .572 + .5)

    box("Bench base", (2.75, .73, .37), (2.38, 3.04, .21), materials["steel"])
    box("Velour bench", (2.76, .76, .19), (2.38, 3.04, .48), materials["velvet"], .085)
    box("Velour back", (2.75, .16, .51), (2.38, 3.35, .77), materials["velvet"], .07)
    camera.location = (6.3, -8.1, 7.5)
    camera.data.ortho_scale = 12.2
    point_at(camera, (0, .14, .14))
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.055, .073, .101, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .52
    for name, color, watts, position, target, size in (
        ("Amber over the floor", "ffca91", 1650, (-2.3, -.8, 5.3), (0, 0, 0), 3.4),
        ("Cyan by the back wall", "83d9e3", 950, (-3.5, 2.8, 3.0), (0, 3.75, 1), 2.8),
        ("Warm bench light", "e4a07f", 760, (4, 1.3, 3.6), (1.4, 2, 0), 2.8),
        ("Soft front fill", "bacbe8", 620, (1.3, -5, 3.2), (0, 0, 0), 4.5),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.color, data.energy, data.size = srgb(color), watts, size
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = position
        point_at(light, target)
    scene.cycles.sample_clamp_indirect = 3
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .036
    render(scene, output, "club-materials-preview", (1200, 900), "AgX", 96)
    scene.render.filepath = "//club-materials-preview.png"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "club-materials.blend"), compress=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    output = Path(args[0]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.use_denoising = False
    scene.render.image_settings.color_mode = "RGB"
    bpy.ops.mesh.primitive_plane_add(size=1)
    tile = bpy.context.object
    bpy.ops.object.camera_add(location=(0, 0, 2))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1
    scene.camera = camera
    materials = bake(scene, output, tile)
    if "--maps-only" not in args:
        preview(scene, output, camera, tile, materials)


if __name__ == "__main__":
    main()
