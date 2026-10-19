"""
Blender AI Studio — Native Add-on v0.2.0
=========================================
• N-Panel sidebar with live image-to-3D generation
• Upload a reference image directly from Blender's file browser
• Trigger generation and poll status without leaving Blender
• One-click import of the latest or any named model
• Auto-center & snap-to-ground behaviors (configurable)
"""

bl_info = {
    "name":        "Blender AI Integration",
    "author":      "shreyaskhakal",
    "version":     (0, 2, 0),
    "blender":     (3, 6, 0),
    "location":    "View3D › Sidebar (N) › Blender AI",
    "description": "Generate 3D models from reference images via Blender AI Studio / Tripo3D and import them with one click.",
    "warning":     "",
    "doc_url":     "https://github.com/shreyaskhakal/Blender-Ai",
    "tracker_url": "https://github.com/shreyaskhakal/Blender-Ai/issues",
    "category":    "Import-Export",
}

import bpy
import urllib.request
import urllib.error
import urllib.parse
import tempfile
import os
import json
import threading
import time

# ──────────────────────────────────────────────────────────────────────────────
# Shared state (thread-safe reads via bpy.app.timers)
# ──────────────────────────────────────────────────────────────────────────────
_poll_state = {
    "running":   False,
    "status":    "",      # "idle" | "uploading" | "generating" | "downloading" | "done" | "error"
    "progress":  0,       # 0-100
    "message":   "",
    "model_url": "",
    "error":     "",
}

def _reset_poll():
    _poll_state.update(running=False, status="idle", progress=0,
                       message="", model_url="", error="")


# ──────────────────────────────────────────────────────────────────────────────
# 1. Add-on Preferences
# ──────────────────────────────────────────────────────────────────────────────
class BlenderAIPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    server_url: bpy.props.StringProperty(
        name="Studio Server URL",
        description="URL of the running Blender AI Studio server (npm start / node server.js)",
        default="http://localhost:4000",
    )
    auto_center: bpy.props.BoolProperty(
        name="Auto-Center Origin",
        description="Set geometry origin to bounding-box centre after import",
        default=True,
    )
    snap_to_ground: bpy.props.BoolProperty(
        name="Snap to Ground (Z = 0)",
        description="Translate the imported mesh so its lowest vertex sits at Z = 0",
        default=True,
    )
    ai_model: bpy.props.EnumProperty(
        name="AI Model",
        items=[
            ("v3.1-20260211", "Flagship v3.1 — High Precision",   "Best quality, slower"),
            ("P1-20260311",   "Low-Poly P1 — Clean Topology",     "Faster, fewer polygons"),
        ],
        default="v3.1-20260211",
    )
    texture_quality: bpy.props.EnumProperty(
        name="Texture Quality",
        items=[
            ("standard", "Standard (PBR Maps)", "Balanced quality"),
            ("detailed", "Detailed (High Res)", "Higher resolution textures"),
        ],
        default="standard",
    )

    def draw(self, context):
        layout = self.layout
        box = layout.box()
        box.label(text="Server Configuration", icon='URL')
        box.prop(self, "server_url")
        box.operator("blender_ai.check_connection", text="Test Connection", icon='FILE_REFRESH')

        box2 = layout.box()
        box2.label(text="Generation Defaults", icon='MODIFIER')
        box2.prop(self, "ai_model")
        box2.prop(self, "texture_quality")

        box3 = layout.box()
        box3.label(text="Import Behaviour", icon='IMPORT')
        box3.prop(self, "auto_center")
        box3.prop(self, "snap_to_ground")


# ──────────────────────────────────────────────────────────────────────────────
# 2. Operators
# ──────────────────────────────────────────────────────────────────────────────

# ── 2a. Check Connection ──────────────────────────────────────────────────────
class BLENDERAI_OT_CheckConnection(bpy.types.Operator):
    """Test the connection to the local Blender AI Studio server"""
    bl_idname  = "blender_ai.check_connection"
    bl_label   = "Test Studio Connection"
    bl_options = {'REGISTER'}

    def execute(self, context):
        prefs  = context.preferences.addons[__name__].preferences
        url    = prefs.server_url.rstrip("/") + "/api/status"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Blender-AI-Addon/0.2.0"})
            with urllib.request.urlopen(req, timeout=6) as r:
                data = json.loads(r.read().decode())
            mode = data.get("mode", "unknown").upper()
            key  = "✓" if data.get("isKeyConfigured") else "✗"
            self.report({'INFO'}, f"Connected!  Mode: {mode}  |  API Key: {key}")
        except Exception as exc:
            self.report({'ERROR'}, f"Could not reach {prefs.server_url} — is the server running?  ({exc})")
            return {'CANCELLED'}
        return {'FINISHED'}


# ── 2b. Generate from Image ───────────────────────────────────────────────────
class BLENDERAI_OT_GenerateFromImage(bpy.types.Operator):
    """Upload a reference image to Blender AI Studio and trigger 3D generation"""
    bl_idname  = "blender_ai.generate_from_image"
    bl_label   = "Generate from Reference Image"
    bl_options = {'REGISTER'}

    filepath: bpy.props.StringProperty(
        subtype="FILE_PATH",
        name="Reference Image",
        description="Path to the reference image (PNG / JPEG / WebP)",
    )
    filter_glob: bpy.props.StringProperty(
        default="*.png;*.jpg;*.jpeg;*.webp",
        options={'HIDDEN'},
    )

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

    def execute(self, context):
        path = self.filepath
        if not os.path.isfile(path):
            self.report({'ERROR'}, f"File not found: {path}")
            return {'CANCELLED'}

        prefs = context.preferences.addons[__name__].preferences

        if _poll_state["running"]:
            self.report({'WARNING'}, "A generation is already in progress. Wait for it to finish.")
            return {'CANCELLED'}

        _reset_poll()
        _poll_state["running"] = True
        _poll_state["status"]  = "uploading"
        _poll_state["message"] = "Uploading image…"

        # Run in background thread so UI doesn't freeze
        thread = threading.Thread(
            target=_run_generation_thread,
            args=(prefs.server_url, path, prefs.ai_model, prefs.texture_quality),
            daemon=True,
        )
        thread.start()

        # Register a UI-refresh timer (1 Hz)
        if not bpy.app.timers.is_registered(_ui_refresh_timer):
            bpy.app.timers.register(_ui_refresh_timer, first_interval=1.0)

        self.report({'INFO'}, "Generation started — watch the Blender AI panel for progress.")
        return {'FINISHED'}


def _run_generation_thread(server_url, image_path, ai_model, texture_quality):
    """Background thread: uploads image and calls /api/generate, polling progress."""
    base = server_url.rstrip("/")
    try:
        # ── Upload & generate (single blocking HTTP call — server side polls Tripo) ──
        _poll_state["status"]   = "generating"
        _poll_state["progress"] = 10
        _poll_state["message"]  = "Sending to Tripo3D API…"

        boundary = "BlenderAIBoundary"
        with open(image_path, "rb") as fh:
            file_data = fh.read()

        filename  = os.path.basename(image_path)
        mime_map  = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                     ".png": "image/png", ".webp": "image/webp"}
        ext       = os.path.splitext(filename)[1].lower()
        mime_type = mime_map.get(ext, "image/png")

        body_parts = []
        body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{filename}"\r\nContent-Type: {mime_type}\r\n\r\n'.encode())
        body_parts.append(file_data)
        body_parts.append(f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n{ai_model}'.encode())
        body_parts.append(f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="texture_quality"\r\n\r\n{texture_quality}'.encode())
        body_parts.append(f'\r\n--{boundary}--\r\n'.encode())
        body = b"".join(body_parts)

        req = urllib.request.Request(
            f"{base}/api/generate",
            data=body,
            headers={
                "Content-Type":   f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(body)),
                "User-Agent":     "Blender-AI-Addon/0.2.0",
            },
            method="POST",
        )

        # Fake intermediate progress ticks while waiting for the long-running call
        tick_thread = threading.Thread(target=_tick_progress, daemon=True)
        tick_thread.start()

        with urllib.request.urlopen(req, timeout=240) as resp:
            raw      = resp.read().decode("utf-8")
            response = json.loads(raw)

        _poll_state["progress"] = 90
        _poll_state["message"]  = "Downloading model…"

        if not response.get("success"):
            code = response.get("code", "")
            if code == "INSUFFICIENT_CREDITS":
                raise RuntimeError("Tripo3D credits exhausted. Recharge at platform.tripo3d.ai")
            raise RuntimeError(response.get("error", "Server returned an error"))

        _poll_state["status"]    = "done"
        _poll_state["progress"]  = 100
        _poll_state["message"]   = "Done!"
        _poll_state["model_url"] = f"{base}{response['modelUrl']}"
        _poll_state["running"]   = False

    except Exception as exc:
        _poll_state["status"]  = "error"
        _poll_state["error"]   = str(exc)
        _poll_state["message"] = f"Error: {exc}"
        _poll_state["running"] = False


def _tick_progress():
    """Slowly advance progress bar from 10→85 during long server call."""
    while _poll_state["status"] == "generating" and _poll_state["running"]:
        time.sleep(3)
        cur = _poll_state["progress"]
        if cur < 85:
            _poll_state["progress"] = min(85, cur + 3)


def _ui_refresh_timer():
    """Called on the main thread by bpy.app.timers to repaint UI."""
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.tag_redraw()
    # Unregister when generation finishes
    if not _poll_state["running"]:
        return None  # return None cancels the timer
    return 1.0  # call again after 1 second


# ── 2c. Import Latest Model ───────────────────────────────────────────────────
class BLENDERAI_OT_ImportLatest(bpy.types.Operator):
    """Download and import the latest generated 3D asset from Blender AI Studio"""
    bl_idname  = "blender_ai.import_latest"
    bl_label   = "Import Latest 3D Asset"
    bl_options = {'REGISTER', 'UNDO'}

    model_url: bpy.props.StringProperty(
        name="Model URL",
        default="",
        description="Override URL (leave blank to use server's latest model)",
    )

    def execute(self, context):
        prefs    = context.preferences.addons[__name__].preferences
        base_url = prefs.server_url.rstrip("/")

        # Priority: explicit URL > pending generation result > /output/model_latest.glb
        if self.model_url:
            target_url = self.model_url
        elif _poll_state["status"] == "done" and _poll_state["model_url"]:
            target_url = _poll_state["model_url"]
        else:
            target_url = f"{base_url}/output/model_latest.glb"

        fallback_url = f"{base_url}/output/sample_cube.glb"
        tmp_path     = os.path.join(tempfile.gettempdir(), "blender_ai_imported_model.glb")

        self.report({'INFO'}, f"Fetching {target_url}")

        # ── Download ──────────────────────────────────────────────────────────
        def _download(url):
            req = urllib.request.Request(url, headers={"User-Agent": "Blender-AI-Addon/0.2.0"})
            with urllib.request.urlopen(req, timeout=15) as r, open(tmp_path, "wb") as f:
                f.write(r.read())

        try:
            _download(target_url)
        except Exception as exc:
            self.report({'WARNING'}, f"Could not fetch latest model ({exc}); trying sample…")
            try:
                _download(fallback_url)
            except Exception as exc2:
                self.report({'ERROR'}, f"All downloads failed: {exc2}")
                return {'CANCELLED'}

        # ── Import GLTF/GLB ───────────────────────────────────────────────────
        bpy.ops.object.select_all(action='DESELECT')
        try:
            bpy.ops.import_scene.gltf(filepath=tmp_path)
        except Exception as exc:
            self.report({'ERROR'}, f"GLTF importer failed: {exc}")
            return {'CANCELLED'}

        imported = [obj for obj in context.selected_objects if obj.type == 'MESH']
        if not imported:
            self.report({'WARNING'}, "Imported file contained no mesh objects.")
            return {'FINISHED'}

        # ── Post-import adjustments ───────────────────────────────────────────
        if prefs.auto_center:
            bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

        if prefs.snap_to_ground:
            min_z = min(
                (obj.matrix_world @ v.co).z
                for obj in imported for v in obj.data.vertices
            )
            if min_z != float('inf'):
                for obj in imported:
                    obj.location.z -= min_z

        self.report({'INFO'}, f"Imported {len(imported)} mesh object(s) from {os.path.basename(tmp_path)}")
        return {'FINISHED'}


# ── 2d. Import Latest After Generation ───────────────────────────────────────
class BLENDERAI_OT_ImportGenerated(bpy.types.Operator):
    """Import the model that was just generated in this session"""
    bl_idname  = "blender_ai.import_generated"
    bl_label   = "Import Generated Model"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        if _poll_state["status"] != "done" or not _poll_state["model_url"]:
            self.report({'WARNING'}, "No completed generation found. Run 'Generate from Image' first.")
            return {'CANCELLED'}
        bpy.ops.blender_ai.import_latest(model_url=_poll_state["model_url"])
        _reset_poll()
        return {'FINISHED'}


# ── 2e. Cancel / Reset Generation ────────────────────────────────────────────
class BLENDERAI_OT_ResetGeneration(bpy.types.Operator):
    """Reset the generation state panel"""
    bl_idname  = "blender_ai.reset_generation"
    bl_label   = "Clear Status"
    bl_options = {'REGISTER'}

    def execute(self, context):
        _reset_poll()
        return {'FINISHED'}


# ──────────────────────────────────────────────────────────────────────────────
# 3. N-Panel (Sidebar)
# ──────────────────────────────────────────────────────────────────────────────
class BLENDERAI_PT_MainPanel(bpy.types.Panel):
    bl_label      = "Blender AI Studio"
    bl_idname     = "BLENDERAI_PT_main_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category   = 'Blender AI'

    def draw(self, context):
        layout = self.layout
        prefs  = context.preferences.addons[__name__].preferences

        # ── Server Status ──────────────────────────────────────────────────
        box = layout.box()
        row = box.row(align=True)
        row.label(text="Studio Server", icon='URL')
        box.label(text=prefs.server_url, icon='CONSOLE')
        box.operator("blender_ai.check_connection", text="Test Connection", icon='FILE_REFRESH')

        layout.separator(factor=0.5)

        # ── Generate from Image ────────────────────────────────────────────
        gen_box = layout.box()
        gen_box.label(text="Image to 3D Generation", icon='IMAGE_DATA')
        gen_box.prop(prefs, "ai_model",        text="Model")
        gen_box.prop(prefs, "texture_quality", text="Texture")

        row_gen = gen_box.row(align=True)
        row_gen.scale_y = 1.5
        if _poll_state["running"]:
            row_gen.enabled = False
            row_gen.operator("blender_ai.generate_from_image", text="Generating…", icon='SORTTIME')
        else:
            row_gen.operator("blender_ai.generate_from_image", text="Generate from Image…", icon='RENDER_STILL')

        # ── Progress readout ───────────────────────────────────────────────
        status = _poll_state["status"]
        if status not in ("", "idle"):
            prog_box = layout.box()
            pct      = _poll_state["progress"]
            msg      = _poll_state["message"] or status.capitalize()

            # Progress bar via split
            prog_box.label(text=f"Progress: {pct}%", icon='SORTTIME' if _poll_state["running"] else 'CHECKMARK')
            bar_row = prog_box.row(align=True)
            filled  = max(1, int(pct / 10))
            bar_row.label(text="█" * filled + "░" * (10 - filled))
            prog_box.label(text=msg[:72])  # truncate long messages

            if status == "done":
                done_row = prog_box.row(align=True)
                done_row.scale_y = 1.3
                done_row.operator("blender_ai.import_generated", text="Import into Scene", icon='IMPORT')
                prog_box.operator("blender_ai.reset_generation", text="Clear", icon='X')

            elif status == "error":
                prog_box.label(text=_poll_state["error"][:80], icon='ERROR')
                prog_box.operator("blender_ai.reset_generation", text="Dismiss", icon='X')

        layout.separator(factor=0.5)

        # ── Import Latest ──────────────────────────────────────────────────
        imp_box = layout.box()
        imp_box.label(text="Import Model", icon='IMPORT')
        col = imp_box.column(align=True)
        col.scale_y = 1.3
        col.operator("blender_ai.import_latest", text="Import Latest from Server", icon='IMPORT').model_url = ""

        layout.separator(factor=0.5)

        # ── Import Options ─────────────────────────────────────────────────
        opts_box = layout.box()
        opts_box.label(text="Import Options", icon='PREFERENCES')
        opts_box.prop(prefs, "auto_center")
        opts_box.prop(prefs, "snap_to_ground")


# ──────────────────────────────────────────────────────────────────────────────
# 4. Registration
# ──────────────────────────────────────────────────────────────────────────────
classes = (
    BlenderAIPreferences,
    BLENDERAI_OT_CheckConnection,
    BLENDERAI_OT_GenerateFromImage,
    BLENDERAI_OT_ImportLatest,
    BLENDERAI_OT_ImportGenerated,
    BLENDERAI_OT_ResetGeneration,
    BLENDERAI_PT_MainPanel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)


def unregister():
    if bpy.app.timers.is_registered(_ui_refresh_timer):
        bpy.app.timers.unregister(_ui_refresh_timer)
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
