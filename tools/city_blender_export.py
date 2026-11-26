"""Export small, vertex-coloured Blender scenes for Three.js ObjectLoader."""

from collections import defaultdict
from base64 import b64encode
import json
from struct import pack
import uuid

import bpy
from mathutils import Vector


def srgb(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)


def paint(name, hex_color, batch="matte", roughness=.8, metalness=0, glow=0):
    mat = bpy.data.materials.new(name)
    color = srgb(hex_color)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metalness
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = glow
    mat["batch"], mat["color_hex"] = batch, int(hex_color, 16)
    mat["roughness"], mat["metalness"], mat["glow"] = roughness, metalness, glow
    return mat


def coords(vec):
    return tuple(round(float(n), 5) for n in (vec.x, vec.z, -vec.y))


def export_scene(output, name, objects, pivots=None, textured=()):
    pivots = pivots or {}
    meshes = defaultdict(list)
    geometries, materials = [], {}
    keyed = lambda key: str(uuid.uuid5(uuid.NAMESPACE_URL, f"fedoskin/{name}/{key}"))
    deps = bpy.context.evaluated_depsgraph_get()
    for ob in objects:
        evaluated = ob.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        matrix = ob.matrix_world
        normal_matrix = matrix.to_3x3().inverted_safe().transposed()
        part = ob.get("part", "static")
        origin = Vector(pivots.get(part, (0, 0, 0)))
        for triangle in mesh.loop_triangles:
            material = mesh.materials[triangle.material_index]
            batch = material["batch"]
            normal = mesh.corner_normals
            uv = mesh.uv_layers.active if batch in textured else None
            for loop_id in triangle.loops:
                loop = mesh.loops[loop_id]
                pos = coords(matrix @ mesh.vertices[loop.vertex_index].co - origin)
                direction = coords((normal_matrix @ normal[loop_id].vector).normalized())
                color = tuple(round(c, 5) for c in material.diffuse_color[:3])
                texel = tuple(round(c, 5) for c in uv.data[loop_id].uv) if uv else ()
                meshes[part, batch].append((pos, direction, color, texel))
            if batch not in materials:
                mat = dict(uuid=keyed("material/" + batch), type="MeshStandardMaterial",
                           name=batch, color=0xFFFFFF, vertexColors=True,
                           roughness=material["roughness"], metalness=material["metalness"])
                if material["glow"]:
                    mat.update(emissive=material["color_hex"], emissiveIntensity=material["glow"])
                materials[batch] = mat
        evaluated.to_mesh_clear()

    def packed(values, code, dtype):
        return dict(type=dtype, bytes=b64encode(pack(f"<{len(values)}{code}", *values)).decode("ascii"))

    def attribute(vectors, code="f", dtype="Float32Array", scale=None):
        values = [round(n * scale) if scale else n for v in vectors for n in v]
        return dict(itemSize=len(vectors[0]), normalized=scale is not None, **packed(values, code, dtype))

    root = dict(uuid=keyed("root"), type="Group", name=name, children=[])
    parents = {"static": root}
    for (part, batch), corners in meshes.items():
        key = part + "/" + batch
        if part not in parents:
            parents[part] = dict(uuid=keyed(part), type="Group", name=part,
                                 position=coords(Vector(pivots[part])), children=[])
            root["children"].append(parents[part])
        vertices = list(dict.fromkeys(corners))
        lookup = {v: i for i, v in enumerate(vertices)}
        positions, normals, colors, uvs = zip(*vertices)
        attrs = dict(position=attribute(positions), normal=attribute(normals, "b", "Int8Array", 127),
                     color=attribute(colors, "H", "Uint16Array", 65535))
        if uvs[0]:
            attrs["uv"] = attribute(uvs)
        index = packed([lookup[v] for v in corners], "H", "Uint16Array") if len(vertices) < 65536 else \
            packed([lookup[v] for v in corners], "I", "Uint32Array")
        geo = dict(uuid=keyed("geometry/" + key), type="BufferGeometry", data=dict(attributes=attrs, index=index))
        geometries.append(geo)
        parents[part]["children"].append(dict(uuid=keyed("mesh/" + key), name=batch,
            type="Mesh", geometry=geo["uuid"], material=materials[batch]["uuid"], receiveShadow=True))
    output.write_text(json.dumps(dict(metadata=dict(version=4.7, type="Object", generator="Blender"),
        object=root, geometries=geometries, materials=list(materials.values())), separators=(",", ":")))


def point_at(obj, at):
    obj.rotation_euler = (Vector(at) - obj.location).to_track_quat("-Z", "Y").to_euler()


def studio(scene, camera_at, target, size, output):
    bpy.ops.object.camera_add(location=camera_at)
    scene.camera = bpy.context.object
    point_at(scene.camera, target)
    scene.camera.data.type = "ORTHO"
    scene.camera.data.ortho_scale = size
    for name, location, power, kelvin, radius in (
        ("Warm key", (-3, -4, 6), 1400, "ffc694", 3.1),
        ("Cool fill", (4, -1, 4), 1050, "91bffa", 4),
        ("Rim", (0, 3, 5), 1300, "bbc8ff", 2.7),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.color, data.energy, data.size = srgb(kelvin), power, radius
        lamp = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(lamp)
        lamp.location = location
        point_at(lamp, target)
    scene.world.use_nodes = True
    backdrop = scene.world.node_tree.nodes["Background"]
    backdrop.inputs["Color"].default_value = (.025, .032, .054, 1)
    backdrop.inputs["Strength"].default_value = .65
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 22
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = 960, 720
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(output)
