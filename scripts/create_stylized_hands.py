import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "assets" / "models"
PREVIEW_DIR = ROOT / ".hand-previews"


def clear_scene():
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def material(name, color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return mat


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def add_ellipsoid(name, location, scale, mat, rotation=(0.0, 0.0, 0.0), segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    obj.data.materials.append(mat)
    return obj


def add_rounded_box(name, location, scale, mat, bevel=0.12, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft Edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    smooth(obj)
    obj.data.materials.append(mat)
    return obj


def add_cylinder(name, location, radius, depth, mat, rotation=(0.0, 0.0, 0.0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("Rounded Rims", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    smooth(obj)
    obj.data.materials.append(mat)
    return obj


def add_emblem(sign, cuff_x, white_mat):
    objects = []
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.082,
        minor_radius=0.012,
        major_segments=24,
        minor_segments=8,
        location=(cuff_x, -0.02, 0.305),
    )
    ring = bpy.context.object
    ring.name = "Cuff Emblem Ring"
    ring.scale.x = 0.8
    ring.data.materials.append(white_mat)
    objects.append(ring)
    objects.append(add_rounded_box(
        "Cuff Emblem Mark",
        (cuff_x, -0.02, 0.32),
        (0.018, 0.105, 0.012),
        white_mat,
        bevel=0.01,
        rotation=(0.0, 0.0, sign * -0.18),
    ))
    return objects


def parent_to_bone(objects, armature, bone_name):
    for obj in objects:
        matrix_world = obj.matrix_world.copy()
        obj.parent = armature
        obj.parent_type = "BONE"
        obj.parent_bone = bone_name
        obj.matrix_world = matrix_world


def create_armature(sign):
    armature_data = bpy.data.armatures.new("Hand Rig")
    armature = bpy.data.objects.new("Hand Rig", armature_data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    forearm = armature_data.edit_bones.new("forearm")
    forearm.head = (0.0, 0.0, 0.0)
    forearm.tail = (sign * 1.38, 0.0, 0.0)

    wrist = armature_data.edit_bones.new("wrist")
    wrist.head = forearm.tail
    wrist.tail = (sign * 2.3, 0.0, 0.0)
    wrist.parent = forearm
    wrist.use_connect = False

    bpy.ops.object.mode_set(mode="POSE")
    wrist_pose = armature.pose.bones["wrist"]
    wrist_pose.rotation_mode = "XYZ"

    action = bpy.data.actions.new("Bounce")
    armature.animation_data_create()
    armature.animation_data.action = action
    keyframes = (
        (1, 0.00, 0.00),
        (6, -0.12, sign * 0.16),
        (12, 0.10, sign * -0.08),
        (18, -0.04, sign * 0.06),
        (25, 0.00, 0.00),
    )
    for frame, height, flex in keyframes:
        wrist_pose.location = (0.0, 0.0, height)
        wrist_pose.rotation_euler = (0.0, flex, 0.0)
        wrist_pose.keyframe_insert(data_path="location", frame=frame, group="wrist")
        wrist_pose.keyframe_insert(data_path="rotation_euler", frame=frame, group="wrist")

    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(label, sign, model_objects):
    world = bpy.context.scene.world or bpy.data.worlds.new("Preview World")
    bpy.context.scene.world = world
    world.color = (0.035, 0.04, 0.05)

    bpy.ops.object.light_add(type="AREA", location=(sign * 1.2, -2.5, 4.0))
    key = bpy.context.object
    key.name = "Preview Key"
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 4.0
    look_at(key, (sign * 1.45, 0.0, 0.0))

    bpy.ops.object.light_add(type="AREA", location=(sign * 1.8, 3.0, 2.2))
    fill = bpy.context.object
    fill.name = "Preview Fill"
    fill.data.energy = 650
    fill.data.color = (0.4, 0.58, 1.0) if sign < 0 else (1.0, 0.42, 0.18)
    fill.data.size = 3.0
    look_at(fill, (sign * 1.7, 0.0, 0.0))

    bpy.ops.object.camera_add(location=(sign * 1.45, -4.8, 4.9))
    camera = bpy.context.object
    camera.name = "Preview Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.8
    look_at(camera, (sign * 1.5, 0.0, 0.0))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 760
    scene.render.resolution_y = 440
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(PREVIEW_DIR / f"{label}.png")
    scene.render.image_settings.color_mode = "RGBA"
    scene.frame_set(1)
    bpy.ops.render.render(write_still=True)

    for obj in model_objects:
        obj.hide_render = False


def build_hand(label, sign, cuff_color):
    clear_scene()
    skin = material("Warm Stylized Skin", (0.76, 0.39, 0.22), roughness=0.52)
    cuff = material(f"{label.title()} Cuff", cuff_color, roughness=0.34)
    nail = material("Soft Nails", (0.96, 0.67, 0.54), roughness=0.42)
    white = material("Cuff Emblem", (0.95, 0.97, 1.0), roughness=0.3)

    forearm_objects = [
        add_ellipsoid("Forearm", (sign * 0.76, 0.0, 0.0), (0.86, 0.29, 0.255), skin),
    ]
    wrist_objects = []
    wrist_objects.append(add_rounded_box(
        "Palm",
        (sign * 1.88, 0.0, 0.0),
        (0.45, 0.48, 0.17),
        skin,
        bevel=0.19,
    ))

    cuff_x = sign * 1.39
    wrist_objects.append(add_cylinder(
        "Wristband",
        (cuff_x, 0.0, 0.0),
        0.315,
        0.32,
        cuff,
        rotation=(0.0, math.pi / 2, 0.0),
    ))
    wrist_objects.extend(add_emblem(sign, cuff_x, white))

    finger_specs = (
        (-0.33, 0.62, -0.09),
        (-0.11, 0.76, -0.03),
        (0.12, 0.71, 0.025),
        (0.34, 0.57, 0.085),
    )
    for index, (y, length, fan) in enumerate(finger_specs, start=1):
        base_x = sign * (2.17 + length * 0.44)
        finger = add_ellipsoid(
            f"Finger {index}",
            (base_x, y, 0.01),
            (length * 0.56, 0.105, 0.095),
            skin,
            rotation=(0.0, 0.0, sign * fan),
            segments=28,
            rings=16,
        )
        wrist_objects.append(finger)
        tip_x = sign * (2.17 + length * 0.92)
        nail_obj = add_ellipsoid(
            f"Nail {index}",
            (tip_x, y + math.sin(sign * fan) * length * 0.2, 0.092),
            (0.105, 0.07, 0.018),
            nail,
            rotation=(0.0, 0.0, sign * fan),
            segments=20,
            rings=12,
        )
        wrist_objects.append(nail_obj)

    thumb_angle = math.atan2(-0.46, sign * 0.62)
    thumb = add_ellipsoid(
        "Thumb",
        (sign * 2.05, -0.48, -0.015),
        (0.43, 0.135, 0.12),
        skin,
        rotation=(0.0, 0.0, thumb_angle),
        segments=28,
        rings=16,
    )
    wrist_objects.append(thumb)
    wrist_objects.append(add_ellipsoid(
        "Thumb Nail",
        (sign * 2.30, -0.66, 0.085),
        (0.105, 0.078, 0.02),
        nail,
        rotation=(0.0, 0.0, thumb_angle),
        segments=20,
        rings=12,
    ))

    armature = create_armature(sign)
    parent_to_bone(forearm_objects, armature, "forearm")
    parent_to_bone(wrist_objects, armature, "wrist")
    model_objects = [armature, *forearm_objects, *wrist_objects]

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 25
    scene.render.fps = 24
    scene.frame_set(1)

    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in model_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature

    blend_path = MODEL_DIR / f"{label}.blend"
    glb_path = MODEL_DIR / f"{label}.glb"
    for stale_path in (blend_path, blend_path.with_suffix(".blend1")):
        if stale_path.exists():
            stale_path.unlink()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_reset_pose_bones=True,
    )
    render_preview(label, sign, model_objects)


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    build_hand("left_hand", -1, (0.025, 0.22, 0.62))
    build_hand("right_hand", 1, (0.92, 0.12, 0.035))
    print("Created animated left and right hand assets.")


if __name__ == "__main__":
    main()
