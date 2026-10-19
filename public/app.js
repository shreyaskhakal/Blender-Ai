// ==============================================================================
// Blender AI Studio — Frontend v2.0 — Polished Interactive Experience
// ==============================================================================

// ── Three.js State ────────────────────────────────────────────────────────────
let scene, camera, renderer, controls, gridHelper;
let currentModel = null;
let isWireframe = false;
let isGridVisible = true;
let isAutoRotate = false;
let selectedFile = null;
let currentModelUrl = null;
let generationHistory = JSON.parse(localStorage.getItem('bai_history') || '[]');

// ── DOM References ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const dropzone              = $('dropzone');
const fileInput             = $('fileInput');
const browseBtn             = $('browseBtn');
const dropzoneContent       = $('dropzoneContent');
const imagePreviewContainer = $('imagePreviewContainer');
const imagePreview          = $('imagePreview');
const removeImageBtn        = $('removeImageBtn');
const fileNameEl            = $('fileName');
const fileSizeEl            = $('fileSize');
const generateBtn           = $('generateBtn');
const modelSelect           = $('modelSelect');
const textureQuality        = $('textureQuality');
const progressSection       = $('progressSection');
const progressState         = $('progressState');
const progressSpinner       = $('progressSpinner');
const progressBar           = $('progressBar');
const progressMessage       = $('progressMessage');
const emptyState            = $('emptyState');
const modelHud              = $('modelHud');
const hudStatus             = $('hudStatus');
const hudFile               = $('hudFile');
const viewportActions       = $('viewportActions');
const downloadModelBtn      = $('downloadModelBtn');
const quickBlenderBtn       = $('quickBlenderBtn');
const wireframeBtn          = $('wireframeBtn');
const gridBtn               = $('gridBtn');
const resetCamBtn           = $('resetCamBtn');
const autoRotateBtn         = $('autoRotateBtn');
const blenderModal          = $('blenderModal');
const closeModalBtn         = $('closeModalBtn');
const blenderHelpBtn        = $('blenderHelpBtn');
const copyScriptBtn         = $('copyScriptBtn');
const blenderCode           = $('blenderCode');
const statusBadge           = $('statusBadge');
const statusText            = $('statusText');
const historyList           = $('historyList');
const viewportApiChip       = $('viewportApiChip');
const viewportApiMode       = $('viewportApiMode');

// ── Step references
const steps = [$('step1'), $('step2'), $('step3'), $('step4')];

// ==============================================================================
// 1. Toast Notification System
// ==============================================================================
function showToast(type, title, message, durationMs = 4500) {
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<div class="toast-body"><div class="toast-title">${title}</div>${message ? `<div class="toast-msg">${message}</div>` : ''}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

// ==============================================================================
// 2. Three.js WebGL Scene Initialization
// ==============================================================================
function initThreeJS() {
  const container = $('canvasContainer');
  const canvas    = $('webglCanvas');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080A12);
  scene.fog = new THREE.FogExp2(0x080A12, 0.04);

  camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 200);
  camera.position.set(2.5, 2, 3.5);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping   = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  // Orbit Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping    = true;
  controls.dampingFactor    = 0.06;
  controls.target.set(0, 0.4, 0);
  controls.maxPolarAngle    = Math.PI / 2 + 0.15;
  controls.minDistance      = 0.5;
  controls.maxDistance      = 30;

  // Lighting Rig
  const ambient = new THREE.AmbientLight(0xC8D4F0, 1.0);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xFFFFFF, 2.2);
  keyLight.position.set(5, 10, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4080FF, 0.6);
  fillLight.position.set(-6, 3, -3);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x22D3EE, 1.2);
  rimLight.position.set(-3, 6, -6);
  scene.add(rimLight);

  // Ground with shadow catcher
  const groundGeo  = new THREE.PlaneGeometry(20, 20);
  const groundMat  = new THREE.ShadowMaterial({ opacity: 0.25 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.001;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Grid
  gridHelper = new THREE.GridHelper(16, 28, 0x1C2133, 0x131823);
  gridHelper.position.y = -0.002;
  scene.add(gridHelper);

  // Environment sphere (subtle)
  const envGeo = new THREE.SphereGeometry(80, 16, 8);
  const envMat = new THREE.MeshBasicMaterial({
    color: 0x0B0E1A,
    side: THREE.BackSide
  });
  scene.add(new THREE.Mesh(envGeo, envMat));

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    if (isAutoRotate && currentModel) {
      currentModel.rotation.y += 0.006;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Responsive resize
  const ro = new ResizeObserver(() => onViewportResize());
  ro.observe(container);
}

function onViewportResize() {
  const container = $('canvasContainer');
  if (!container || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ==============================================================================
// 3. Load & Display GLB Model
// ==============================================================================
function loadGLBModel(url, isMock = false, filename = '') {
  const loader = new THREE.GLTFLoader();

  loader.load(
    url,
    (gltf) => {
      if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
      }

      currentModel = gltf.scene;

      // Enable shadows on all meshes
      currentModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true;
          child.receiveShadow = true;
        }
      });

      // Auto-center & normalize scale
      const box    = new THREE.Box3().setFromObject(currentModel);
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale  = 1.8 / (maxDim || 1);
      currentModel.scale.setScalar(scale);

      box.setFromObject(currentModel);
      box.getCenter(center);
      currentModel.position.x = -center.x;
      currentModel.position.y = -box.min.y;
      currentModel.position.z = -center.z;

      scene.add(currentModel);

      // UI state
      emptyState.classList.add('hidden');
      modelHud.classList.remove('hidden');
      viewportActions.classList.remove('hidden');
      downloadModelBtn.href = url;
      currentModelUrl = window.location.origin + url;

      const displayName = filename || url.split('/').pop();
      hudStatus.textContent = isMock ? 'Mock Fixture' : 'AI Generated ✦ Live';
      hudStatus.style.color = isMock ? 'var(--status-warning)' : 'var(--status-success)';
      hudFile.textContent   = displayName;

      updateBlenderScript(currentModelUrl);
      resetCamera();

      showToast('success', '3D Model Ready', `${displayName} loaded into viewport`);
    },
    undefined,
    (err) => {
      console.error('[Blender AI] GLB load error:', err);
      showToast('error', 'Viewport Error', 'Failed to render the 3D model — check console for details.');
    }
  );
}

// ==============================================================================
// 4. Viewport Toolbar Controls
// ==============================================================================
function resetCamera() {
  camera.position.set(2.5, 2, 3.5);
  controls.target.set(0, 0.4, 0);
  controls.update();
}

resetCamBtn.addEventListener('click', resetCamera);

wireframeBtn.addEventListener('click', () => {
  if (!currentModel) return;
  isWireframe = !isWireframe;
  wireframeBtn.classList.toggle('active', isWireframe);
  currentModel.traverse((child) => {
    if (child.isMesh) child.material.wireframe = isWireframe;
  });
});

gridBtn.addEventListener('click', () => {
  isGridVisible = !isGridVisible;
  gridBtn.classList.toggle('active', isGridVisible);
  gridHelper.visible = isGridVisible;
});

autoRotateBtn.addEventListener('click', () => {
  isAutoRotate = !isAutoRotate;
  autoRotateBtn.classList.toggle('active', isAutoRotate);
});

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  switch (e.code) {
    case 'Space': e.preventDefault(); resetCamera(); break;
    case 'KeyW': wireframeBtn.click(); break;
    case 'KeyG': gridBtn.click(); break;
    case 'KeyR': autoRotateBtn.click(); break;
  }
});

// ==============================================================================
// 5. Drag & Drop / File Handling
// ==============================================================================
browseBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => {
  if (!e.target.closest('#imagePreviewContainer')) fileInput.click();
});
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
);
dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) handleFile(files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showToast('warning', 'Invalid File Type', 'Please use PNG, JPEG, or WebP images.');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('warning', 'File Too Large', 'Image must be under 20 MB.');
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

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

// ==============================================================================
// 6. Progress Step Helpers
// ==============================================================================
function setStep(index, state) { // state: 'active' | 'done' | ''
  steps.forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i < index) s.classList.add('done');
    if (i === index && state === 'active') s.classList.add('active');
    if (i === index && state === 'done') s.classList.add('done');
  });
}

function setProgress(pct, msg, stepIndex = -1, stepState = 'active') {
  progressBar.style.width = `${pct}%`;
  progressMessage.textContent = msg;
  if (stepIndex >= 0) setStep(stepIndex, stepState);
}

function setPillState(label, type = 'running') {
  progressState.textContent = label;
  const colorMap = {
    running: 'rgba(34, 211, 238, 0.12)',
    success: 'rgba(52, 211, 153, 0.15)',
    error:   'rgba(248, 113, 113, 0.15)',
    warning: 'rgba(251, 191, 36, 0.15)',
  };
  const textMap = {
    running: 'var(--accent-cyan)',
    success: 'var(--status-success)',
    error:   'var(--status-error)',
    warning: 'var(--status-warning)',
  };
  progressState.style.background = colorMap[type];
  progressState.style.color = textMap[type];
  progressState.style.borderColor = (textMap[type] || 'var(--accent-cyan)').replace('var(', 'rgba(').replace(')', ', 0.25)');
  if (type !== 'running') {
    progressSpinner.style.display = 'none';
  }
}

// ==============================================================================
// 7. Generate 3D Asset
// ==============================================================================
generateBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Reset progress UI
  generateBtn.disabled = true;
  progressSection.classList.remove('hidden');
  progressSpinner.style.display = '';
  steps.forEach(s => s.classList.remove('active', 'done'));
  progressBar.style.background = 'linear-gradient(90deg, #0EA5C9, #22D3EE, #38BDF8)';
  progressBar.style.backgroundSize = '200% 100%';
  setPillState('Running', 'running');

  setProgress(8, 'Uploading image to server...', 0, 'active');

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('model', modelSelect.value);
  formData.append('texture_quality', textureQuality.value);

  try {
    setProgress(15, 'Submitting task to Tripo3D API...', 1, 'active');

    const response = await fetch('/api/generate', { method: 'POST', body: formData });
    const data = await response.json();

    if (!response.ok || !data.success) {
      // Handle insufficient credits gracefully
      if (data.code === 'INSUFFICIENT_CREDITS') {
        setProgress(100, '', -1);
        progressBar.style.background = 'var(--status-warning)';
        setPillState('No Credits', 'warning');
        progressMessage.innerHTML = `
          <span style="color:var(--status-warning);font-weight:600;">Tripo3D credits exhausted.</span>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
            <a href="https://platform.tripo3d.ai/billing" target="_blank" rel="noopener" class="btn btn-secondary" style="font-size:11px;padding:6px 10px;justify-content:flex-start">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Recharge at platform.tripo3d.ai
            </a>
            <button id="loadFallbackBtn" type="button" class="btn btn-accent" style="font-size:11px;padding:6px 10px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Preview Sample Model
            </button>
          </div>`;
        $('loadFallbackBtn').addEventListener('click', () => {
          loadGLBModel('/output/sample_cube.glb', true, 'sample_cube.glb');
          setPillState('Sample Ready', 'success');
        });
        showToast('warning', 'No Credits', 'Your Tripo3D balance is empty. Recharge or preview the sample model.');
        return;
      }
      throw new Error(data.error || data.details || 'Generation failed');
    }

    // Success
    setProgress(85, 'Downloading GLB from Tripo3D CDN...', 3, 'active');
    await new Promise(r => setTimeout(r, 400)); // brief pause so user sees step
    setProgress(100, data.message || 'Generation complete!', 3, 'done');
    progressBar.style.backgroundSize = '100% 100%';
    setPillState('Complete', 'success');

    loadGLBModel(data.modelUrl, data.isMock, data.filename);
    addToHistory(data, selectedFile);

  } catch (err) {
    console.error('[Blender AI] Generation error:', err);
    setProgress(100, err.message, -1);
    progressBar.style.background = 'var(--status-error)';
    setPillState('Failed', 'error');
    showToast('error', 'Generation Failed', err.message);
  } finally {
    generateBtn.disabled = false;
  }
});

// ==============================================================================
// 8. Generation History
// ==============================================================================
function addToHistory(data, file) {
  const entry = {
    id:        Date.now(),
    filename:  data.filename,
    modelUrl:  data.modelUrl,
    isMock:    data.isMock,
    taskId:    data.taskId || null,
    refImage:  null, // we'll store thumbnail
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // Capture image thumbnail as base64 (small)
  const canvas = document.createElement('canvas');
  canvas.width  = 72;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = imagePreview.src;
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 72, 72);
    entry.refImage = canvas.toDataURL('image/jpeg', 0.7);
    generationHistory.unshift(entry);
    if (generationHistory.length > 12) generationHistory.pop();
    try { localStorage.setItem('bai_history', JSON.stringify(generationHistory)); } catch (e) {}
    renderHistory();
  };
}

function renderHistory() {
  if (generationHistory.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No generations yet</p>';
    return;
  }
  historyList.innerHTML = generationHistory.map((entry) => `
    <div class="history-item" data-url="${entry.modelUrl}" data-filename="${entry.filename}" data-mock="${entry.isMock}" tabindex="0" role="button" aria-label="Load ${entry.filename}">
      ${entry.refImage
        ? `<img class="history-thumb" src="${entry.refImage}" alt="ref">`
        : `<div class="history-thumb" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-tertiary)">GLB</div>`}
      <div class="history-info">
        <div class="history-name" title="${entry.filename}">${entry.filename}</div>
        <div class="history-meta">${entry.timestamp}${entry.taskId ? ` · ${entry.taskId.slice(0, 8)}…` : ''}</div>
      </div>
      <span class="history-badge ${entry.isMock ? 'mock' : 'live'}">${entry.isMock ? 'Mock' : 'Live'}</span>
    </div>`).join('');

  historyList.querySelectorAll('.history-item').forEach((item) => {
    const activate = () => {
      const url      = item.dataset.url;
      const fname    = item.dataset.filename;
      const isMock   = item.dataset.mock === 'true';
      loadGLBModel(url, isMock, fname);
      showToast('info', 'History Loaded', fname);
    };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

// ==============================================================================
// 9. Blender Import Script
// ==============================================================================
function updateBlenderScript(modelUrl) {
  const ts = new Date().toISOString();
  blenderCode.textContent = `# Blender AI — One-Click Import Script
# Generated: ${ts}
# Run in Blender Scripting workspace (▶)
import bpy, urllib.request, tempfile, os

MODEL_URL = "${modelUrl}"

def import_from_blender_ai(url):
    print(f"[Blender AI] Fetching: {url}")
    tmp = os.path.join(tempfile.gettempdir(), "blender_ai_model.glb")
    urllib.request.urlretrieve(url, tmp)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=tmp)
    imported = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if imported:
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        # Snap to ground
        min_z = min((o.matrix_world @ v.co).z for o in imported for v in o.data.vertices)
        for o in imported: o.location.z -= min_z
        print(f"[Blender AI] Imported {len(imported)} mesh(es) successfully!")
    else:
        print("[Blender AI] Import done (no mesh objects found).")

import_from_blender_ai(MODEL_URL)`;
}

// ── Modal controls ────────────────────────────────────────────────────────────
blenderHelpBtn.addEventListener('click', () => blenderModal.classList.remove('hidden'));
quickBlenderBtn.addEventListener('click', () => blenderModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click',  () => blenderModal.classList.add('hidden'));
blenderModal.addEventListener('click',   (e) => { if (e.target === blenderModal) blenderModal.classList.add('hidden'); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !blenderModal.classList.contains('hidden')) blenderModal.classList.add('hidden');
});

copyScriptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(blenderCode.textContent).then(() => {
    copyScriptBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyScriptBtn.textContent = 'Copy Script'; }, 2000);
  });
});

// ==============================================================================
// 10. Server & API Status
// ==============================================================================
async function checkServerStatus() {
  try {
    const res  = await fetch('/api/status');
    const data = await res.json();

    if (data.isKeyConfigured && data.mode === 'live') {
      statusBadge.className      = 'status-badge live';
      statusText.textContent     = 'Tripo3D Live API';
      viewportApiChip.className  = 'api-mode-chip live';
      viewportApiMode.textContent = 'Live API Active';
    } else {
      statusBadge.className      = 'status-badge mock';
      statusText.textContent     = 'Mock Mode';
      viewportApiChip.className  = 'api-mode-chip mock';
      viewportApiMode.textContent = 'Mock Mode';
    }
  } catch (e) {
    statusBadge.className      = 'status-badge offline';
    statusText.textContent     = 'Server Offline';
    viewportApiChip.className  = 'api-mode-chip';
    viewportApiMode.textContent = 'Offline';
    showToast('error', 'Server Offline', 'Could not reach the Blender AI server.');
  }
}

// ==============================================================================
// 11. Bootstrap
// ==============================================================================
window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  checkServerStatus();
  renderHistory();
  updateBlenderScript(window.location.origin + '/output/model_latest.glb');
});
