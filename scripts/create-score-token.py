import math
import os

import bpy
from mathutils import Vector


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(ROOT, "assets", "models")
BLEND_PATH = os.path.join(MODEL_DIR, "score_token.blend")
GLB_PATH = os.path.join(MODEL_DIR, "score_token.glb")
PREVIEW_PATH = os.path.join(os.environ.get("TEMP", MODEL_DIR), "score_token_preview.png")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_material(name, base_color, metallic, roughness, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*base_color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if "Emission Color" in shader.inputs:
        shader.inputs["Emission Color"].default_value = (*base_color, 1.0)
    if "Emission Strength" in shader.inputs:
        shader.inputs["Emission Strength"].default_value = emission_strength
    return material


def add_cylinder(name, radius, depth, vertices=128):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    return obj


def apply_boolean(target, cutter, operation="DIFFERENCE"):
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new(name=f"{operation.title()}_{cutter.name}", type="BOOLEAN")
    modifier.operation = operation
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def add_bevel(obj, width, segments=3, material_index=1):
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new(name="Soft arcade bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(20)
    modifier.material = material_index
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False


def add_curve_cutter(name, points, width, depth):
    curve_data = bpy.data.curves.new(name=name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = width * 0.5
    curve_data.bevel_resolution = 3
    curve_data.use_fill_caps = True
    spline = curve_data.splines.new(type="NURBS")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    spline.order_u = min(4, len(points))
    spline.use_endpoint_u = True
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.scale.z = depth / width * 1.5
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def aim_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_token():
    os.makedirs(MODEL_DIR, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    backup_path = f"{BLEND_PATH}1"
    if os.path.exists(backup_path):
        os.remove(backup_path)
    clear_scene()

    gold = make_material("Token Gold", (1.0, 0.54, 0.025), 0.72, 0.2, 0.12)
    edge = make_material("Token Amber Edge", (0.58, 0.12, 0.008), 0.78, 0.24, 0.025)

    rim = add_cylinder("ScoreToken_Rim", radius=0.56, depth=0.18)
    rim.data.materials.append(gold)
    rim.data.materials.append(edge)
    inner_cutter = add_cylinder("Rim opening", radius=0.475, depth=0.28)
    apply_boolean(rim, inner_cutter)
    add_bevel(rim, width=0.018)

    panels = add_cylinder("ScoreToken_BasketballPanels", radius=0.435, depth=0.135)
    panels.data.materials.append(gold)
    panels.data.materials.append(edge)

    horizontal = bpy.data.objects.new("Horizontal seam", None)
    bpy.context.collection.objects.link(horizontal)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    horizontal = bpy.context.object
    horizontal.name = "Horizontal seam"
    horizontal.dimensions = (1.05, 0.056, 0.32)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_boolean(panels, horizontal)

    seam_depth = 0.34
    vertical_points = [
        (-0.08, 0.47, 0),
        (-0.19, 0.31, 0),
        (-0.245, 0.12, 0),
        (-0.23, -0.08, 0),
        (-0.14, -0.29, 0),
        (-0.035, -0.47, 0),
    ]
    upper_arc_points = [
        (-0.47, 0.19, 0),
        (-0.30, 0.08, 0),
        (-0.12, 0.10, 0),
        (0.07, 0.20, 0),
        (0.25, 0.31, 0),
        (0.47, 0.32, 0),
    ]
    lower_arc_points = [
        (-0.47, -0.25, 0),
        (-0.29, -0.16, 0),
        (-0.10, -0.16, 0),
        (0.09, -0.25, 0),
        (0.28, -0.37, 0),
        (0.47, -0.34, 0),
    ]
    for name, points, width in (
        ("Curved vertical seam", vertical_points, 0.062),
        ("Upper ball seam", upper_arc_points, 0.058),
        ("Lower ball seam", lower_arc_points, 0.058),
    ):
        apply_boolean(panels, add_curve_cutter(name, points, width, seam_depth))

    add_bevel(panels, width=0.012)

    for obj in (rim, panels):
        obj.rotation_mode = "XYZ"
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rim
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.object.select_all(action="DESELECT")
    rim.select_set(True)
    panels.select_set(True)
    bpy.context.view_layer.objects.active = rim
    bpy.ops.object.parent_set(type="OBJECT", keep_transform=True)
    panels.parent = None

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    bpy.ops.object.select_all(action="DESELECT")
    rim.select_set(True)
    panels.select_set(True)
    bpy.context.view_layer.objects.active = rim
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )

    token_root = bpy.data.objects.new("PreviewTokenRoot", None)
    bpy.context.collection.objects.link(token_root)
    rim.parent = token_root
    panels.parent = token_root
    token_root.rotation_euler = (math.radians(66), 0, math.radians(-12))

    bpy.ops.object.camera_add(location=(0.0, -2.25, 1.55))
    camera = bpy.context.object
    camera.data.lens = 58
    aim_at(camera, (0, 0, 0))
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-1.3, -1.6, 2.0))
    key = bpy.context.object
    key.data.energy = 850
    key.data.shape = "DISK"
    key.data.size = 2.2
    aim_at(key, (0, 0, 0))

    bpy.ops.object.light_add(type="AREA", location=(1.4, -0.4, 0.8))
    fill = bpy.context.object
    fill.data.energy = 500
    fill.data.color = (0.16, 0.38, 1.0)
    fill.data.size = 1.6
    aim_at(fill, (0, 0, 0))

    bpy.ops.object.light_add(type="AREA", location=(0.0, 1.2, 1.5))
    rim_light = bpy.context.object
    rim_light.data.energy = 700
    rim_light.data.color = (1.0, 0.28, 0.03)
    rim_light.data.size = 1.2
    aim_at(rim_light, (0, 0, 0))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    scene.render.filepath = PREVIEW_PATH
    scene.world.color = (0.008, 0.012, 0.025)
    bpy.ops.render.render(write_still=True)

    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")
    print(
        "VALIDATION="
        f"rim:{tuple(round(value, 4) for value in rim.dimensions)}/"
        f"{len(rim.data.polygons)} polygons;"
        f"panels:{tuple(round(value, 4) for value in panels.dimensions)}/"
        f"{len(panels.data.polygons)} polygons"
    )


if __name__ == "__main__":
    create_token()
