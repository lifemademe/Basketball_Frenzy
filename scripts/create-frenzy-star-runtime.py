from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_ROOT / "assets" / "models"
SOURCE_GLB = MODEL_DIR / "Star.glb"
OUTPUT_GLB = MODEL_DIR / "Star_runtime.glb"
TARGET_POLYGONS = 14000
TARGET_TEXTURE_SIZE = 1024


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    visible_meshes = [obj for obj in meshes if len(obj.data.polygons) > 100]
    visible_points = [
        obj.matrix_world @ Vector(corner)
        for obj in visible_meshes
        for corner in obj.bound_box
    ]
    visible_center = Vector((
        (min(point.x for point in visible_points) + max(point.x for point in visible_points)) * 0.5,
        (min(point.y for point in visible_points) + max(point.y for point in visible_points)) * 0.5,
        (min(point.z for point in visible_points) + max(point.z for point in visible_points)) * 0.5,
    ))
    for mesh in visible_meshes:
        mesh.location -= visible_center

    for image in bpy.data.images:
        if image.size[0] > TARGET_TEXTURE_SIZE or image.size[1] > TARGET_TEXTURE_SIZE:
            image.scale(TARGET_TEXTURE_SIZE, TARGET_TEXTURE_SIZE)
            image.pack()

    polygon_count = sum(len(obj.data.polygons) for obj in visible_meshes)
    ratio = min(1.0, TARGET_POLYGONS / max(1, polygon_count))
    for mesh in visible_meshes:
        if ratio < 1.0 and len(mesh.data.polygons) > 200:
            modifier = mesh.modifiers.new("Gameplay LOD", "DECIMATE")
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = mesh
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        for polygon in mesh.data.polygons:
            polygon.use_smooth = True

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    optimized_count = sum(len(obj.data.polygons) for obj in visible_meshes)
    print(f"Optimized Frenzy star: {polygon_count} -> {optimized_count} polygons")
    print(f"Exported {OUTPUT_GLB}")


if __name__ == "__main__":
    main()
