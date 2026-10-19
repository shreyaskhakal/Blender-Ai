import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateValidGLB } from '../utils/create-sample-glb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${testName}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('       Blender AI — Offline Test Runner Suite        ');
console.log('======================================================\n');

// ------------------------------------------------------------------------------
// Test Suite 1: GLB Binary Format Verification
// ------------------------------------------------------------------------------
console.log('[Suite 1: 3D Asset Binary Header Verification]');
try {
  const glbBuffer = generateValidGLB();
  assert(glbBuffer instanceof Buffer, 'GLB generator returns binary Buffer');
  
  const magic = glbBuffer.readUInt32LE(0);
  assert(magic === 0x46546C67, 'Magic bytes match glTF binary header (0x46546C67 / "glTF")');
  
  const version = glbBuffer.readUInt32LE(4);
  assert(version === 2, 'glTF binary declares version 2.0');
  
  const length = glbBuffer.readUInt32LE(8);
  assert(length === glbBuffer.length, 'Header length field matches buffer byte length exactly');
} catch (e) {
  assert(false, `GLB generation threw exception: ${e.message}`);
}

// ------------------------------------------------------------------------------
// Test Suite 2: Blender Add-on Package & Structure
// ------------------------------------------------------------------------------
console.log('\n[Suite 2: Blender Add-on Structure & Metadata]');
const addonPath = path.join(ROOT_DIR, 'blender_addon', 'blender_ai', '__init__.py');
assert(fs.existsSync(addonPath), 'blender_addon/blender_ai/__init__.py exists');

if (fs.existsSync(addonPath)) {
  const content = fs.readFileSync(addonPath, 'utf8');
  assert(content.includes('bl_info = {'), 'Contains bl_info dictionary');
  assert(content.includes('"name": "Blender AI Integration"'), 'Contains add-on title');
  assert(content.includes('bpy.types.AddonPreferences'), 'Contains AddonPreferences implementation');
  assert(content.includes('bpy.ops.import_scene.gltf'), 'Contains glTF scene import operator');
}

const addonZipPath = path.join(ROOT_DIR, 'public', 'downloads', 'blender_ai_addon.zip');
assert(fs.existsSync(addonZipPath), 'Downloadable blender_ai_addon.zip exists in public/downloads');

if (fs.existsSync(addonZipPath)) {
  const zipBuffer = fs.readFileSync(addonZipPath);
  assert(zipBuffer.length > 500, `Add-on zip size is valid (${zipBuffer.length} bytes)`);
  const zipMagic = zipBuffer.toString('hex', 0, 4);
  assert(zipMagic === '504b0304', 'Zip header matches standard PK\\x03\\x04 zip signature');
}

// ------------------------------------------------------------------------------
// Test Suite 3: Secret Protection & Git Ignore Verification
// ------------------------------------------------------------------------------
console.log('\n[Suite 3: Secret Protection & Security Verification]');
const gitignorePath = path.join(ROOT_DIR, '.gitignore');
assert(fs.existsSync(gitignorePath), '.gitignore exists');

if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  assert(gitignore.includes('.env.local'), '.gitignore strictly excludes .env.local');
  assert(gitignore.includes('.env'), '.gitignore strictly excludes .env');
  assert(gitignore.includes('uploads/*'), '.gitignore excludes dynamic user uploads');
  assert(gitignore.includes('output/*'), '.gitignore excludes dynamic generated outputs');
}

// ------------------------------------------------------------------------------
// Test Suite 4: Server Endpoints & Liveness Check (if server is active)
// ------------------------------------------------------------------------------
console.log('\n[Suite 4: Server Endpoint Smoke Tests]');
async function testServer() {
  try {
    const res = await fetch('http://localhost:4000/api/status');
    const data = await res.json();
    assert(res.status === 200, 'GET /api/status returns HTTP 200 OK');
    assert(data.status === 'healthy', 'Server reports status: "healthy"');
    assert(data.provider === 'tripo3d', 'Server declares provider: "tripo3d"');
  } catch (e) {
    console.log(`  \x1b[33m⚠ SKIP:\x1b[0m Server not running on :4000 (${e.message})`);
  }

  // Summary
  console.log('\n======================================================');
  console.log(`  Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testServer();
