// ==============================================================================
// Blender AI Studio — Interactive Frontend & Three.js Viewport
// ==============================================================================

let scene, camera, renderer, controls, gridHelper;
let currentModel = null;
let isWireframe = false;
let isGridVisible = true;
let selectedFile = null;
let currentModelUrl = null;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const dropzoneContent = document.getElementById('dropzoneContent');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');

const generateBtn = document.getElementById('generateBtn');
const modelSelect = document.getElementById('modelSelect');
const textureQuality = document.getElementById('textureQuality');

const progressSection = document.getElementById('progressSection');
const progressState = document.getElementById('progressState');
const progressMessage = document.getElementById('progressMessage');

const emptyState = document.getElementById('emptyState');
const modelHud = document.getElementById('modelHud');
const hudStatus = document.getElementById('hudStatus');
const viewportActions = document.getElementById('viewportActions');
const downloadModelBtn = document.getElementById('downloadModelBtn');
const quickBlenderBtn = document.getElementById('quickBlenderBtn');

const wireframeBtn = document.getElementById('wireframeBtn');
const gridBtn = document.getElementById('gridBtn');
const resetCamBtn = document.getElementById('resetCamBtn');

const blenderModal = document.getElementById('blenderModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const blenderHelpBtn = document.getElementById('blenderHelpBtn');
const copyScriptBtn = document.getElementById('copyScriptBtn');
const blenderCode = document.getElementById('blenderCode');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');

// ------------------------------------------------------------------------------
// 1. Initialize Three.js WebGL Scene
// ------------------------------------------------------------------------------
function initThreeJS() {
  const container = document.getElementById('canvasContainer');
  const canvas = document.getElementById('webglCanvas');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0B0D10);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(2, 1.8, 3);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.1; // Allow viewing slightly from below

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
  mainLight.position.set(5, 10, 7);
  mainLight.castShadow = true;
  scene.add(mainLight);

  const rimLight = new THREE.DirectionalLight(0x22D3EE, 1.5);
  rimLight.position.set(-5, 4, -5);
  scene.add(rimLight);

  // Ground Grid
  gridHelper = new THREE.GridHelper(10, 20, 0x323C4D, 0x1E242E);
  gridHelper.position.y = -0.01;
  scene.add(gridHelper);

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Responsive Resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  const container = document.getElementById('canvasContainer');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ------------------------------------------------------------------------------
// 2. Load and Display GLB 3D Asset
// ------------------------------------------------------------------------------
function loadGLBModel(url, isMock = false) {
  const loader = new THREE.GLTFLoader();

  loader.load(
    url,
    (gltf) => {
      if (currentModel) {
        scene.remove(currentModel);
      }

      currentModel = gltf.scene;

      // Auto-center and normalize scale
      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / (maxDim || 1);
      currentModel.scale.set(scale, scale, scale);

      // Re-center on ground plane (Z=0 in Blender coords, Y=0 in Three.js)
      box.setFromObject(currentModel);
      box.getCenter(center);
      currentModel.position.x = -center.x;
      currentModel.position.y = -box.min.y;
      currentModel.position.z = -center.z;

      scene.add(currentModel);

      // UI state updates
      emptyState.classList.add('hidden');
      modelHud.classList.remove('hidden');
      viewportActions.classList.remove('hidden');
      downloadModelBtn.href = url;
      currentModelUrl = window.location.origin + url;

      hudStatus.textContent = isMock ? 'Mock Fixture' : 'AI Generated (Live)';
      hudStatus.style.color = isMock ? 'var(--status-warning)' : 'var(--status-success)';

      updateBlenderScript(currentModelUrl);
      resetCamera();
    },
    (xhr) => {
      // Progress
    },
    (err) => {
      console.error('Error loading GLB:', err);
      alert('Failed to render 3D model in WebGL viewport.');
    }
  );
}

// ------------------------------------------------------------------------------
// 3. Viewport Toolbar Controls
// ------------------------------------------------------------------------------
function resetCamera() {
  camera.position.set(2, 1.8, 3);
  controls.target.set(0, 0.5, 0);
  controls.update();
}

resetCamBtn.addEventListener('click', resetCamera);

wireframeBtn.addEventListener('click', () => {
  if (!currentModel) return;
  isWireframe = !isWireframe;
  wireframeBtn.classList.toggle('active', isWireframe);

  currentModel.traverse((child) => {
    if (child.isMesh) {
      child.material.wireframe = isWireframe;
    }
  });
});

gridBtn.addEventListener('click', () => {
  isGridVisible = !isGridVisible;
  gridBtn.classList.toggle('active', isGridVisible);
  gridHelper.visible = isGridVisible;
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    resetCamera();
  } else if (e.code === 'KeyW') {
    wireframeBtn.click();
  } else if (e.code === 'KeyG') {
    gridBtn.click();
  }
});

// ------------------------------------------------------------------------------
// 4. Drag & Drop and File Upload Handling
// ------------------------------------------------------------------------------
browseBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => {
  if (e.target === dropzone || e.target.closest('#dropzoneContent')) {
    fileInput.click();
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) handleFile(files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file (PNG, JPEG, or WebP).');
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    alert('File size exceeds the 20MB limit.');
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    dropzoneContent.classList.add('hidden');
    imagePreviewContainer.classList.remove('hidden');
    generateBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

removeImageBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  selectedFile = null;
  fileInput.value = '';
  imagePreview.src = '';
  dropzoneContent.classList.remove('hidden');
  imagePreviewContainer.classList.add('hidden');
  generateBtn.disabled = true;
});

// ------------------------------------------------------------------------------
// 5. Submit 3D Generation
// ------------------------------------------------------------------------------
generateBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  generateBtn.disabled = true;
  progressSection.classList.remove('hidden');
  progressState.textContent = 'Uploading';
  progressMessage.textContent = 'Uploading reference image to server...';

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('model', modelSelect.value);
  formData.append('texture_quality', textureQuality.value);

  try {
    progressState.textContent = 'Processing';
    progressMessage.textContent = 'Submitting task to Tripo3D API and inferring 3D mesh...';

    const response = await fetch('/api/generate', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (data.code === 'INSUFFICIENT_CREDITS') {
        progressState.textContent = 'Quota Reached';
        progressState.style.backgroundColor = 'rgba(251, 191, 36, 0.2)';
        progressState.style.color = 'var(--status-warning)';
        progressMessage.innerHTML = `
          <span>Tripo3D account credit balance is 0.</span>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
            <a href="https://platform.tripo3d.ai/billing" target="_blank" class="btn btn-secondary" style="font-size: 12px; padding: 6px 10px;">
              Recharge at Tripo3D
            </a>
            <button id="loadFallbackBtn" type="button" class="btn btn-primary" style="font-size: 12px; padding: 6px 10px;">
              Preview Sample 3D Model
            </button>
          </div>
        `;

        document.getElementById('loadFallbackBtn').addEventListener('click', () => {
          loadGLBModel('/output/sample_cube.glb', true);
          progressState.textContent = 'Sample Ready';
          progressState.style.backgroundColor = 'rgba(52, 211, 153, 0.2)';
          progressState.style.color = 'var(--status-success)';
        });
        return;
      }
      throw new Error(data.error || data.details || 'Failed to generate 3D model');
    }

    progressState.textContent = 'Completed';
    progressState.style.backgroundColor = 'rgba(52, 211, 153, 0.2)';
    progressState.style.color = 'var(--status-success)';
    progressMessage.textContent = data.message || '3D Model generation successful!';
    
    // Load into Three.js
    loadGLBModel(data.modelUrl, data.isMock);

  } catch (err) {
    console.error('Generation error:', err);
    progressState.textContent = 'Error';
    progressState.style.backgroundColor = 'rgba(248, 113, 113, 0.2)';
    progressState.style.color = 'var(--status-error)';
    progressMessage.textContent = err.message;
  } finally {
    generateBtn.disabled = false;
  }
});

// ------------------------------------------------------------------------------
// 6. Blender Import Script Generation & Modal
// ------------------------------------------------------------------------------
function updateBlenderScript(modelUrl) {
  const code = `# ==============================================================================
# Blender AI — One-Click Model Import Script
# Run this inside Blender's 'Scripting' workspace to import the generated asset.
# ==============================================================================
import bpy
import urllib.request
import tempfile
import os

MODEL_URL = "${modelUrl}"

def import_blender_ai_model(url):
    print(f"[Blender AI] Downloading 3D asset from: {url}")
    temp_dir = tempfile.gettempdir()
    local_path = os.path.join(temp_dir, "blender_ai_model.glb")
    
    urllib.request.urlretrieve(url, local_path)
    print(f"[Blender AI] Saved temporary file: {local_path}")
    
    # Import GLTF/GLB
    bpy.ops.import_scene.gltf(filepath=local_path)
    
    # Select imported object and center to ground
    imported = bpy.context.selected_objects
    if imported:
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        print(f"[Blender AI] Successfully imported {len(imported)} objects into active scene!")

import_blender_ai_model(MODEL_URL)
`;
  blenderCode.textContent = code;
}

blenderHelpBtn.addEventListener('click', () => blenderModal.classList.remove('hidden'));
quickBlenderBtn.addEventListener('click', () => blenderModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => blenderModal.classList.add('hidden'));

blenderModal.addEventListener('click', (e) => {
  if (e.target === blenderModal) blenderModal.classList.add('hidden');
});

copyScriptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(blenderCode.textContent).then(() => {
    copyScriptBtn.textContent = 'Copied!';
    setTimeout(() => { copyScriptBtn.textContent = 'Copy Script'; }, 2000);
  });
});

// ------------------------------------------------------------------------------
// 7. Check Server & Tripo3D API Status on Load
// ------------------------------------------------------------------------------
async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.isKeyConfigured && data.mode === 'live') {
      statusBadge.className = 'status-badge live';
      statusText.textContent = 'Live Tripo3D API Active';
    } else {
      statusBadge.className = 'status-badge mock';
      statusText.textContent = 'Mock Mode (Set TRIPO3D_API_KEY in .env.local)';
    }
  } catch (e) {
    statusBadge.className = 'status-badge';
    statusText.textContent = 'Server Offline';
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  checkServerStatus();
  updateBlenderScript(window.location.origin + '/output/sample_cube.glb');
});
