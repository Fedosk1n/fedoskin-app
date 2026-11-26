"""Bake the city asphalt in Blender 4.3+.

Run: blender -b -t 6 --factory-startup --python tools/bake_asphalt.py -- /tmp/asphalt
The directory receives three PNG maps and a lit material preview. Convert the
game copies with ImageMagick (strip metadata for all three):
  asphalt-color: -quality 86
  asphalt-surface: -filter Box -resize 256x256 -define webp:lossless=true
  asphalt-repair: -quality 84 -define webp:alpha-quality=100
"""
from math import tau
from pathlib import Path
import sys

import bpy

output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)


def rgb(hex_color):
    """Convert sRGB swatches to the shader's linear RGB."""
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels) + (1.,)


class Asphalt:
    def __init__(self):
        self.material = bpy.data.materials.new("Weathered city asphalt")
        self.material.use_nodes = True
        self.graph = self.material.node_tree
        self.graph.nodes.clear()
        self.output = self.graph.nodes.new("ShaderNodeOutputMaterial")
        uv = self.graph.nodes.new("ShaderNodeTexCoord").outputs["UV"]
        split = self.node("ShaderNodeSeparateXYZ", uv, label="Tile UV")
        self.u, self.v = split.outputs["X"], split.outputs["Y"]
        angle_u = self.math("MULTIPLY", self.u, tau)
        angle_v = self.math("MULTIPLY", self.v, tau)
        self.torus = self.node("ShaderNodeCombineXYZ", self.math("COSINE", angle_u),
                               self.math("SINE", angle_u), self.math("COSINE", angle_v)).outputs[0]
        self.ring = self.math("SINE", angle_v)

    def node(self, kind, *values, label=None):
        node = self.graph.nodes.new(kind)
        if label:
            node.label = label
        for index, value in enumerate(values):
            self.put(node.inputs[index], value)
        return node

    def put(self, socket, value):
        if isinstance(value, bpy.types.NodeSocket):
            self.graph.links.new(value, socket)
        else:
            socket.default_value = value

    def math(self, operation, *values):
        node = self.node("ShaderNodeMath", *values)
        node.operation = operation
        return node.outputs[0]

    def ramp(self, source, stops, label=None):
        node = self.node("ShaderNodeValToRGB", source, label=label)
        ramp = node.color_ramp
        ramp.interpolation = "LINEAR"
        for index, (at, color) in enumerate(stops):
            element = ramp.elements[index] if index < 2 else ramp.elements.new(at)
            element.position = at
            element.color = rgb(color) if isinstance(color, str) else (color,) * 3 + (1.,)
        return node.outputs["Color"]

    def noise(self, cycles, detail, label, seed=0):
        node = self.node("ShaderNodeTexNoise", label=label)
        node.noise_dimensions = "4D"
        self.put(node.inputs["Vector"], self.torus)
        self.put(node.inputs["W"], self.math("ADD", self.ring, seed))
        node.inputs["Scale"].default_value = cycles / tau
        node.inputs["Detail"].default_value = detail
        node.inputs["Roughness"].default_value = .62
        return node.outputs["Fac"]

    def blend(self, amount, first, second, mode="MIX"):
        node = self.node("ShaderNodeMixRGB", amount, first, second)
        node.blend_type = mode
        return node.outputs[0]

    def base(self):
        broad = self.noise(4.2, 3, "Aged binder", 5.7)
        aggregate = self.noise(128, 1.2, "Stone chips", -4.1)
        grit = self.noise(302, .8, "Fine grit", 1.3)
        compaction = self.noise(16, 2, "Uneven compaction", 2.5)
        stone = self.ramp(aggregate, [
            (.26, "1d2027"), (.44, "2c2e34"), (.59, "42444a"), (.74, "686964"),
        ], "Bitumen and aggregate")
        aging = self.ramp(broad, [
            (.21, "666978"), (.44, "a8a5a4"), (.70, "e5dbcd"),
        ], "Binder weathering")
        pockets = self.ramp(compaction, [
            (.32, "6f6e73"), (.55, "aeaead"), (.71, "e2d9ca"),
        ], "Compaction mottle")
        color = self.blend(.45, self.blend(.40, stone, aging, "MULTIPLY"), pockets, "MULTIPLY")
        coarse_height = self.ramp(aggregate, [(.25, .20), (.7, .82)], "Exposed chips")
        height = self.blend(.24, coarse_height, grit)
        rough = self.ramp(broad, [(.22, .67), (.49, .83), (.75, .95)], "Dry and polished zones")
        packed = self.node("ShaderNodeCombineColor", height, rough, 0.,
                           label="Red: micro height  |  Green: roughness").outputs[0]
        return color, packed, height, rough

    def repair(self, color):
        # Rounded, skewed repair with a different contour on each side.
        # It is a separate decal so it can appear sparingly, without tiling every few metres.
        fray = self.noise(26, 2.2, "Broken edges", 21)
        shape = self.noise(5, 2, "Uneven cut", 33)
        skew = self.math("MULTIPLY", self.math("SUBTRACT", self.v, .5), .19)
        x = self.math("ABSOLUTE", self.math("ADD", self.math("SUBTRACT", self.u, .51), skew))
        y = self.math("ABSOLUTE", self.math("SUBTRACT", self.v, .51))
        x = self.math("MULTIPLY", x, 2.52)
        y = self.math("MULTIPLY", y, 3.20)
        rounding = self.math("MULTIPLY", self.math("ADD", x, y), .12)
        distance = self.math("ADD", self.math("MAXIMUM", x, y), rounding)
        ragged = self.math("MULTIPLY", self.math("ADD", self.math("SUBTRACT", shape, .48),
                                                self.math("MULTIPLY", self.math("SUBTRACT", fray, .5), .41)), .38)
        edge = self.math("ADD", distance, ragged)
        fill = self.blend(.25, color, rgb("171921"))
        seal = self.ramp(edge, [(.66, 0), (.88, .16), (.96, 1.), (1.03, .9), (1.10, .04)], "Repair seam")
        rim_color = self.ramp(fray, [(.25, "14151c"), (.67, "30313a")], "Tar and drier fragments")
        opacity = self.ramp(edge, [(.60, .74), (.89, .91), (1.01, .94), (1.08, .29), (1.13, 0.)],
                            "Feathered repair")
        # Short tar-filled branches extend past the edge of the repair.
        rough_path = self.math("MULTIPLY", self.math("SUBTRACT", self.noise(8, 2, "Crack profile", 10), .5), .14)

        def crack(start, end, slope, offset):
            center = self.math("ADD", self.math("MULTIPLY", self.u, slope), offset)
            distance = self.math("ABSOLUTE", self.math("SUBTRACT", self.v, self.math("ADD", center, rough_path)))
            cross = self.ramp(distance, [(.001, .96), (.005, .80), (.013, 0.)])
            taper = self.ramp(self.u, [(start, 0.), (start + .065, 1.), (end - .075, 1.), (end, 0.)])
            return self.math("MULTIPLY", taper, cross)

        fissures = self.math("MAXIMUM", crack(.50, .98, .36, .28), crack(.66, .94, -.28, .77))
        patched = self.blend(seal, fill, rim_color)
        return self.blend(fissures, patched, rgb("0c0e14")), self.math("MAXIMUM", opacity, fissures)

    def emission(self, color, alpha=None):
        emitted = self.node("ShaderNodeEmission", color, 1.).outputs[0]
        if alpha is not None:
            empty = self.node("ShaderNodeBsdfTransparent").outputs[0]
            emitted = self.node("ShaderNodeMixShader", alpha, empty, emitted).outputs[0]
        self.put(self.output.inputs["Surface"], emitted)

    def lit(self, color, height, rough):
        surface = self.node("ShaderNodeBsdfPrincipled")
        self.put(surface.inputs["Base Color"], color)
        self.put(surface.inputs["Roughness"], rough)
        bump = self.node("ShaderNodeBump", label="Aggregate relief")
        bump.inputs["Strength"].default_value = .26
        bump.inputs["Distance"].default_value = .018
        self.put(bump.inputs["Height"], height)
        self.put(surface.inputs["Normal"], bump.outputs["Normal"])
        self.put(self.output.inputs["Surface"], surface.outputs[0])
        for node in self.graph.nodes:
            if node.label:
                node.name = node.label
        self.graph.nodes.active = surface


def save_render(scene, name, size, space="Standard", alpha=False):
    scene.view_settings.view_transform = space
    scene.view_settings.look = "None"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if alpha else "RGB"
    scene.render.film_transparent = alpha
    scene.render.filepath = str(output / (name + ".png"))
    bpy.ops.render.render(write_still=True)


def point_at(obj, point):
    from mathutils import Vector
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def light(name, color, watts, position, size):
    data = bpy.data.lights.new(name, "AREA")
    data.color, data.energy, data.size = rgb(color)[:3], watts, size
    lamp = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(lamp)
    lamp.location = position
    point_at(lamp, (0, 0, 0))


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.use_denoising = False
bpy.ops.mesh.primitive_plane_add(size=1)
plane = bpy.context.object
plane.name = "Asphalt swatch"
asphalt = Asphalt()
plane.data.materials.append(asphalt.material)
bpy.ops.object.camera_add(location=(0, 0, 2))
camera = bpy.context.object
camera.rotation_euler = (0, 0, 0)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 1
scene.camera = camera

color, packed, height, rough = asphalt.base()
asphalt.emission(color)
save_render(scene, "asphalt-color", (1024, 1024))
asphalt.emission(packed)
save_render(scene, "asphalt-surface", (512, 512), "Raw")
repair, alpha = asphalt.repair(color)
asphalt.emission(repair, alpha)
save_render(scene, "asphalt-repair", (512, 512), alpha=True)

# Preview the baked style at street-lamp height with a grazing amber key and cool fill.
asphalt.lit(color, height, rough)
plane.scale = (5.6, 5.6, 1)
camera.data.type = "PERSP"
camera.data.lens = 42
camera.location = (1.65, -3.40, 3.70)
point_at(camera, (0, .16, 0))
scene.world.color = (.04, .04, .04)
light("Amber street lamp", "ffd09b", 1450, (-2.6, 1.1, 2.6), .75)
light("Cool sky fill", "b9d5ff", 720, (1.3, -1.4, 4.2), 4.8)
scene.cycles.samples = 32
save_render(scene, "asphalt-preview", (780, 580), "AgX")
bpy.ops.wm.save_as_mainfile(filepath=str(output / "asphalt-material.blend"), compress=True)
