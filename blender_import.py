# ==============================================================================
# Blender AI — Standalone Model Import Helper for Blender
# ==============================================================================
# Instructions:
# 1. Start the Blender AI web server: `npm start`
# 2. Open Blender.
# 3. Switch to the 'Scripting' tab (top workspace bar).
# 4. Open or paste this file and click 'Run Script' (▶).
# ==============================================================================

import bpy
import urllib.request
import tempfile
import os

# Default local endpoint serving the latest generated model
SERVER_URL = "http://localhost:4000/output/model_latest.glb"
FALLBACK_URL = "http://localhost:4000/output/sample_cube.glb"

def import_latest_model():
    temp_dir = tempfile.gettempdir()
    local_glb_path = os.path.join(temp_dir, "blender_ai_imported_model.glb")
    
    url_to_fetch = SERVER_URL
    print(f"[Blender AI] Attempting to download from {url_to_fetch}...")
    
    try:
        urllib.request.urlretrieve(url_to_fetch, local_glb_path)
    except Exception as e:
        print(f"[Blender AI] Latest model not found ({e}). Fetching sample cube fallback...")
        urllib.request.urlretrieve(FALLBACK_URL, local_glb_path)

    print(f"[Blender AI] Importing GLB model into active scene: {local_glb_path}")
    
    # Deselect all prior objects
    bpy.ops.object.select_all(action='DESELECT')
    
    # Import GLTF / GLB binary
    bpy.ops.import_scene.gltf(filepath=local_glb_path)
    
    imported_objects = bpy.context.selected_objects
    if imported_objects:
        # Center origin to geometry bounds
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        
        # Snap object to ground plane (Z = 0)
        min_z = min([v[2] for obj in imported_objects for v in [obj.matrix_world @ v.co for v in obj.data.vertices]]) if any(obj.type == 'MESH' for obj in imported_objects) else 0
        for obj in imported_objects:
            obj.location.z -= min_z
            
        print(f"[Blender AI] Successfully imported {len(imported_objects)} object(s) onto ground plane (Z=0)!")
    else:
        print("[Blender AI] Warning: No objects selected after GLTF import.")

if __name__ == "__main__":
    import_latest_model()
