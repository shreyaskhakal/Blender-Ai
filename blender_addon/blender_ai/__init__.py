bl_info = {
    "name": "Blender AI Integration",
    "author": "shreyaskhakal",
    "version": (0, 1, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar (N) > Blender AI",
    "description": "Seamlessly connect to Blender AI Studio and import generative 3D models with one click.",
    "warning": "",
    "doc_url": "https://github.com/shreyaskhakal/Blender-Ai",
    "category": "Import-Export",
}

import bpy
import urllib.request
import urllib.error
import tempfile
import os
import json

# ------------------------------------------------------------------------------
# 1. Add-on Preferences (Stored in Blender user profile)
# ------------------------------------------------------------------------------
class BlenderAIPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    server_url: bpy.props.StringProperty(
        name="Studio Server URL",
        description="Local or remote URL of the Blender AI Studio server",
        default="http://localhost:4000",
    )

    auto_center: bpy.props.BoolProperty(
        name="Auto-Center Origin",
        description="Set object origin to geometry bounds upon import",
        default=True,
    )

    snap_to_ground: bpy.props.BoolProperty(
        name="Snap to Ground Plane (Z=0)",
        description="Align the bottom of the imported mesh to Z=0",
        default=True,
    )

    def draw(self, context):
        layout = self.layout
        layout.label(text="Blender AI Studio Configuration:")
        layout.prop(self, "server_url")
        layout.separator()
        layout.label(text="Import Behaviors:")
        layout.prop(self, "auto_center")
        layout.prop(self, "snap_to_ground")


# ------------------------------------------------------------------------------
# 2. Operators
# ------------------------------------------------------------------------------
class BLENDERAI_OT_ImportLatest(bpy.types.Operator):
    """Download and import the latest generated 3D asset from Blender AI Studio"""
    bl_idname = "blender_ai.import_latest"
    bl_label = "Import Latest 3D Asset"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        prefs = context.preferences.addons[__name__].preferences
        base_url = prefs.server_url.rstrip("/")
        model_url = f"{base_url}/output/model_latest.glb"
        fallback_url = f"{base_url}/output/sample_cube.glb"

        temp_dir = tempfile.gettempdir()
        local_path = os.path.join(temp_dir, "blender_ai_imported_model.glb")

        self.report({'INFO'}, f"Connecting to {base_url}...")

        # Step 1: Download GLB
        try:
            req = urllib.request.Request(
                model_url, 
                headers={'User-Agent': 'Blender-AI-Addon/0.1.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as response, open(local_path, 'wb') as out_file:
                out_file.write(response.read())
        except Exception as e:
            # Fallback to sample model if latest is not ready
            try:
                req = urllib.request.Request(fallback_url, headers={'User-Agent': 'Blender-AI-Addon/0.1.0'})
                with urllib.request.urlopen(req, timeout=10) as response, open(local_path, 'wb') as out_file:
                    out_file.write(response.read())
                self.report({'WARNING'}, "Latest model not ready; imported sample model instead.")
            except Exception as fallback_err:
                self.report({'ERROR'}, f"Failed to download asset: {e}")
                return {'CANCELLED'}

        # Step 2: Deselect prior objects
        bpy.ops.object.select_all(action='DESELECT')

        # Step 3: Import GLTF/GLB binary
        try:
            bpy.ops.import_scene.gltf(filepath=local_path)
        except Exception as import_err:
            self.report({'ERROR'}, f"GLTF importer failed: {import_err}")
            return {'CANCELLED'}

        imported_objects = [obj for obj in context.selected_objects if obj.type == 'MESH']
        if not imported_objects:
            self.report({'WARNING'}, "Model imported, but no mesh objects found.")
            return {'FINISHED'}

        # Step 4: Apply origin centering
        if prefs.auto_center:
            bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

        # Step 5: Snap to Ground (Z=0)
        if prefs.snap_to_ground:
            min_z = float('inf')
            for obj in imported_objects:
                for v in obj.data.vertices:
                    world_v = obj.matrix_world @ v.co
                    if world_v.z < min_z:
                        min_z = world_v.z
            
            if min_z != float('inf'):
                for obj in imported_objects:
                    obj.location.z -= min_z

        self.report({'INFO'}, f"Successfully imported {len(imported_objects)} mesh object(s)!")
        return {'FINISHED'}


class BLENDERAI_OT_CheckConnection(bpy.types.Operator):
    """Test connection to the local Blender AI Studio server"""
    bl_idname = "blender_ai.check_connection"
    bl_label = "Test Studio Connection"

    def execute(self, context):
        prefs = context.preferences.addons[__name__].preferences
        base_url = prefs.server_url.rstrip("/")
        status_url = f"{base_url}/api/status"

        try:
            req = urllib.request.Request(status_url, headers={'User-Agent': 'Blender-AI-Addon/0.1.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                mode = data.get("mode", "unknown")
                self.report({'INFO'}, f"Connected to Studio! Mode: {mode.upper()}")
        except Exception as e:
            self.report({'ERROR'}, f"Could not reach Studio at {base_url}. Ensure 'npm start' is running.")
            return {'CANCELLED'}

        return {'FINISHED'}


# ------------------------------------------------------------------------------
# 3. Viewport Sidebar Panel (N-Panel)
# ------------------------------------------------------------------------------
class BLENDERAI_PT_MainPanel(bpy.types.Panel):
    bl_label = "Blender AI Studio"
    bl_idname = "BLENDERAI_PT_main_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Blender AI'

    def draw(self, context):
        layout = self.layout
        prefs = context.preferences.addons[__name__].preferences

        # Connection status block
        box = layout.box()
        box.label(text="Studio Server:", icon='URL')
        box.label(text=prefs.server_url, icon='CONSOLE')
        box.operator("blender_ai.check_connection", text="Test Connection", icon='FILE_REFRESH')

        layout.separator()

        # Primary import action
        col = layout.column(align=True)
        col.scale_y = 1.4
        col.operator("blender_ai.import_latest", text="Import Latest 3D Asset", icon='IMPORT')

        layout.separator()

        # Quick options
        col_opts = layout.column()
        col_opts.label(text="Options:")
        col_opts.prop(prefs, "auto_center")
        col_opts.prop(prefs, "snap_to_ground")


# ------------------------------------------------------------------------------
# 4. Registration
# ------------------------------------------------------------------------------
classes = (
    BlenderAIPreferences,
    BLENDERAI_OT_ImportLatest,
    BLENDERAI_OT_CheckConnection,
    BLENDERAI_PT_MainPanel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()
