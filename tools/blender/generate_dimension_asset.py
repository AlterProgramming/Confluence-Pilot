#!/usr/bin/env python3
"""Generate Blender blockouts from Confluence procedural asset descriptors.

Usage from Blender:

    blender --background --python tools/blender/generate_dimension_asset.py -- \
      --asset assets/dimensions/procedural-source/celestial-memory-mechanism.asset.json \
      --output build/assets/celestial-memory-mechanism.blend

The generator intentionally produces deterministic production blockouts rather
than final sculpted models. It preserves the descriptor's scale, hierarchy,
materials, repetition logic, pivots, sockets, and LOD collection structure.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    import bpy
    from mathutils import Vector
except ImportError as error:  # pragma: no cover - executed inside Blender
    raise SystemExit("This script must be executed by Blender's Python runtime.") from error


@dataclass(frozen=True)
class Transform:
    position: tuple[float, float, float]
    rotation: tuple[float, float, float]
    scale: tuple[float, float, float]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--asset", type=Path, help="One .asset.json descriptor")
    source.add_argument("--catalog", type=Path, help="Catalog containing descriptor paths")
    parser.add_argument("--output", type=Path, help="Output .blend file for a single asset")
    parser.add_argument("--output-directory", type=Path, help="Output directory for catalog mode")
    parser.add_argument("--lod", default="LOD0", choices=("LOD0", "LOD1", "LOD2"))
    parser.add_argument("--clean-scene", action="store_true", default=True)
    return parser.parse_args(argv)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def ensure_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent_collection = parent or bpy.context.scene.collection
    if collection.name not in parent_collection.children:
        try:
            parent_collection.children.link(collection)
        except RuntimeError:
            pass
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)


def hex_to_rgba(value: str) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)) + (1.0,)


def create_material(spec: dict[str, Any]) -> bpy.types.Material:
    material = bpy.data.materials.get(spec["id"]) or bpy.data.materials.new(spec["id"])
    material.use_nodes = True
    nodes = material.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = hex_to_rgba(spec["baseColor"])
        principled.inputs["Metallic"].default_value = float(spec["metallic"])
        principled.inputs["Roughness"].default_value = float(spec["roughness"])
        emission = spec.get("emission", {})
        emission_color = hex_to_rgba(emission.get("color", "#000000"))
        if "Emission Color" in principled.inputs:
            principled.inputs["Emission Color"].default_value = emission_color
            principled.inputs["Emission Strength"].default_value = float(emission.get("strength", 0))
        elif "Emission" in principled.inputs:
            principled.inputs["Emission"].default_value = emission_color
            principled.inputs["Emission Strength"].default_value = float(emission.get("strength", 0))
    material["asset_role"] = spec["role"]
    material["surface_description"] = spec["surfaceDescription"]
    return material


def transform_from_spec(spec: dict[str, Any]) -> Transform:
    return Transform(
        tuple(float(value) for value in spec.get("position", (0, 0, 0))),
        tuple(math.radians(float(value)) for value in spec.get("rotation", (0, 0, 0))),
        tuple(float(value) for value in spec.get("scale", (1, 1, 1))),
    )


def apply_transform(obj: bpy.types.Object, transform: Transform) -> None:
    obj.location = transform.position
    obj.rotation_euler = transform.rotation
    obj.scale = transform.scale


def add_primitive(component: dict[str, Any], name: str) -> bpy.types.Object:
    primitive = component["primitive"]
    dimensions = component.get("dimensions", {})

    if primitive == "box":
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.object
        obj.dimensions = (
            float(dimensions.get("width", 1)),
            float(dimensions.get("depth", 1)),
            float(dimensions.get("height", 1)),
        )
    elif primitive == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=int(dimensions.get("segments", 16)),
            radius=float(dimensions.get("radius", 0.5)),
            depth=float(dimensions.get("height", 1)),
        )
        obj = bpy.context.object
    elif primitive == "cone":
        bpy.ops.mesh.primitive_cone_add(
            vertices=int(dimensions.get("segments", 16)),
            radius1=float(dimensions.get("radiusBottom", dimensions.get("radius", 0.5))),
            radius2=float(dimensions.get("radiusTop", 0)),
            depth=float(dimensions.get("height", 1)),
        )
        obj = bpy.context.object
    elif primitive in {"sphere", "icosphere"}:
        radius = float(dimensions.get("radius", 0.5))
        if primitive == "icosphere":
            bpy.ops.mesh.primitive_ico_sphere_add(
                subdivisions=int(dimensions.get("subdivisions", 2)), radius=radius
            )
        else:
            bpy.ops.mesh.primitive_uv_sphere_add(
                segments=int(dimensions.get("segments", 24)),
                ring_count=int(dimensions.get("rings", 12)),
                radius=radius,
            )
        obj = bpy.context.object
    elif primitive == "torus":
        bpy.ops.mesh.primitive_torus_add(
            major_radius=float(dimensions.get("majorRadius", 1)),
            minor_radius=float(dimensions.get("minorRadius", 0.08)),
            major_segments=int(dimensions.get("majorSegments", 48)),
            minor_segments=int(dimensions.get("minorSegments", 10)),
        )
        obj = bpy.context.object
    elif primitive in {"curve-tube", "custom-profile"}:
        obj = add_curve_component(component, name)
    elif primitive == "plane":
        bpy.ops.mesh.primitive_plane_add(size=float(dimensions.get("size", 1)))
        obj = bpy.context.object
    else:
        raise ValueError(f"Unsupported primitive: {primitive}")

    obj.name = name
    return obj


def add_curve_component(component: dict[str, Any], name: str) -> bpy.types.Object:
    dimensions = component.get("dimensions", {})
    points = dimensions.get("points") or [
        [-0.5, 0, 0],
        [-0.15, 0.2, 0.1],
        [0.15, -0.1, 0.2],
        [0.5, 0, 0],
    ]
    curve_data = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = int(dimensions.get("resolution", 12))
    curve_data.bevel_depth = float(dimensions.get("radius", 0.04))
    curve_data.bevel_resolution = int(dimensions.get("bevelResolution", 3))
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def repeat_transforms(component: dict[str, Any], seed: int) -> Iterable[Transform]:
    base = transform_from_spec(component.get("transform", {}))
    repeat = component.get("repeat") or {"mode": "none", "count": 1}
    mode = repeat.get("mode", "none")
    count = int(repeat.get("count", 1))
    randomizer = random.Random(seed)

    if mode == "none":
        yield base
        return

    for index in range(count):
        position = Vector(base.position)
        rotation = Vector(base.rotation)
        scale = Vector(base.scale)

        if mode == "radial":
            angle = math.radians(float(repeat.get("angleOffsetDegrees", 0))) + index / count * math.tau
            radius = float(repeat.get("radius", 1))
            axis = repeat.get("axis", "Y")
            if axis == "Y":
                position.x += math.cos(angle) * radius
                position.z += math.sin(angle) * radius
                rotation.y += angle
            else:
                position.x += math.cos(angle) * radius
                position.y += math.sin(angle) * radius
                rotation.z += angle
        elif mode == "linear":
            step = Vector(repeat.get("step", [1, 0, 0]))
            position += step * index
        elif mode == "grid":
            columns = int(repeat.get("columns", max(1, round(math.sqrt(count)))))
            spacing = Vector(repeat.get("spacing", [1, 1, 1]))
            row, column = divmod(index, columns)
            position += Vector((column * spacing.x, row * spacing.y, (index % 3) * spacing.z))
        elif mode == "arc":
            arc = math.radians(float(repeat.get("arcDegrees", 180)))
            denominator = max(1, count - 1)
            angle = -arc / 2 + index / denominator * arc
            radius = float(repeat.get("radius", 1))
            position.x += math.sin(angle) * radius
            position.y += math.cos(angle) * radius - radius
            rotation.z -= angle
        elif mode == "strand":
            step = float(repeat.get("step", 0.4))
            amplitude = float(repeat.get("amplitude", 0.3))
            phase = float(repeat.get("phase", 0))
            position += Vector((
                math.sin(index * 0.7 + phase) * amplitude,
                -index * step,
                math.cos(index * 0.45 + phase) * amplitude,
            ))
            rotation.y += index * 0.5
        elif mode == "scatter":
            bounds = repeat.get("bounds", [1, 1, 1])
            position += Vector(tuple(randomizer.uniform(-float(bound), float(bound)) for bound in bounds))
            rotation += Vector(tuple(randomizer.uniform(-0.4, 0.4) for _ in range(3)))
            scale *= randomizer.uniform(float(repeat.get("scaleMin", 0.85)), float(repeat.get("scaleMax", 1.15)))

        yield Transform(tuple(position), tuple(rotation), tuple(scale))


def add_metadata(obj: bpy.types.Object, descriptor: dict[str, Any], component: dict[str, Any]) -> None:
    obj["asset_id"] = descriptor["id"]
    obj["asset_revision"] = descriptor["revision"]
    obj["realm"] = descriptor["realm"]
    obj["component_id"] = component["id"]
    obj["component_role"] = component["role"]
    obj["detail_intent"] = component["detail"]


def create_socket(socket: dict[str, Any], collection: bpy.types.Collection) -> None:
    bpy.ops.object.empty_add(type="ARROWS", location=socket["position"])
    obj = bpy.context.object
    obj.name = f"SOCKET_{socket['id']}"
    obj.rotation_euler = tuple(math.radians(value) for value in socket["rotation"])
    obj["socket_purpose"] = socket["purpose"]
    move_to_collection(obj, collection)


def create_asset(descriptor: dict[str, Any], lod_name: str) -> bpy.types.Collection:
    root = ensure_collection(descriptor["id"])
    lod_collection = ensure_collection(lod_name, root)
    socket_collection = ensure_collection("SOCKETS", root)
    materials = {spec["id"]: create_material(spec) for spec in descriptor["materials"]}
    seed = int(descriptor["generation"]["seed"])

    for component_index, component in enumerate(descriptor["components"]):
        transforms = list(repeat_transforms(component, seed + component_index * 997))
        for instance_index, transform in enumerate(transforms):
            name = f"{component['id']}__{instance_index:03d}"
            obj = add_primitive(component, name)
            apply_transform(obj, transform)
            material = materials.get(component["material"])
            if material and hasattr(obj.data, "materials"):
                obj.data.materials.append(material)
            add_metadata(obj, descriptor, component)
            move_to_collection(obj, lod_collection)

            if descriptor["topology"].get("bevel") and obj.type == "MESH":
                modifier = obj.modifiers.new(name="production_bevel", type="BEVEL")
                modifier.width = max(0.002, min(descriptor["scale"]["modularScale"] * 0.012, 0.08))
                modifier.segments = 2 if lod_name == "LOD0" else 1

    for socket in descriptor.get("sockets", []):
        create_socket(socket, socket_collection)

    root["descriptor_schema_version"] = descriptor["schemaVersion"]
    root["asset_title"] = descriptor["title"]
    root["narrative_function"] = descriptor["narrativeFunction"]
    root["recognition_test"] = descriptor["silhouette"]["recognitionTest"]
    return root


def save_blend(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path.resolve()))


def generate_one(descriptor_path: Path, output_path: Path, lod_name: str) -> None:
    clean_scene()
    descriptor = load_json(descriptor_path)
    create_asset(descriptor, lod_name)
    save_blend(output_path)


def main() -> None:
    args = parse_args()
    if args.asset:
        output = args.output or Path("build/assets") / f"{args.asset.stem.removesuffix('.asset')}.blend"
        generate_one(args.asset, output, args.lod)
        return

    catalog = load_json(args.catalog)
    output_directory = args.output_directory or Path("build/assets")
    for entry in catalog["assets"]:
        descriptor_path = args.catalog.parent / entry["path"]
        output = output_directory / f"{entry['id']}.blend"
        generate_one(descriptor_path, output, args.lod)


if __name__ == "__main__":
    main()
