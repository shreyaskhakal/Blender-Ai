import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateValidGLB } from './utils/create-sample-glb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local first, then fallback to .env
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

function getApiKey() {
  const key = process.env.TRIPO3D_API_KEY || process.env.TRIPOSR_API_KEY || '';
  return key.trim();
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Ensure directories exist (use /tmp in serverless Vercel environments)
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
const OUTPUT_DIR = process.env.VERCEL ? path.join('/tmp', 'output') : path.join(__dirname, 'output');
const PUBLIC_DIR = path.join(__dirname, 'public');

[UPLOADS_DIR, OUTPUT_DIR, PUBLIC_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Serve frontend and generated assets
app.use(express.static(PUBLIC_DIR));
app.use('/output', express.static(OUTPUT_DIR));

// Configure multer for file uploads (max 20MB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `ref-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, and WebP images are supported.'));
    }
  }
});

/**
 * Health and status check
 */
app.get('/api/status', (req, res) => {
  const apiKey = getApiKey();
  const isKeyConfigured = Boolean(apiKey && apiKey.length > 5 && !apiKey.includes('your_'));
  const useMock = process.env.TRIPO3D_USE_MOCK === 'true' || !isKeyConfigured;

  res.json({
    status: 'healthy',
    mode: useMock ? 'mock' : 'live',
    isKeyConfigured,
    provider: 'tripo3d',
    configSource: fs.existsSync(envLocalPath) ? '.env.local' : '.env',
    nodeVersion: process.version
  });
});

/**
 * Image-to-3D Generation Endpoint
 */
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No reference image file provided.' });
    }

    const imagePath = req.file.path;
    const apiKey = getApiKey();
    const isKeyConfigured = Boolean(apiKey && apiKey.length > 5 && !apiKey.includes('your_'));
    const useMock = process.env.TRIPO3D_USE_MOCK === 'true' || !isKeyConfigured;

    const timestamp = Date.now();
    const outputFilename = `model_${timestamp}.glb`;
    const finalOutputPath = path.join(OUTPUT_DIR, outputFilename);

    if (useMock) {
      console.log(`[Blender AI] Generating 3D asset using mock fixture (Key configured: ${isKeyConfigured})...`);
      
      // Simulate realistic generation delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      generateValidGLB(finalOutputPath);
      fs.copyFileSync(finalOutputPath, path.join(OUTPUT_DIR, 'model_latest.glb'));

      return res.json({
        success: true,
        isMock: true,
        filename: outputFilename,
        modelUrl: `/output/${outputFilename}`,
        downloadUrl: `/api/download/${outputFilename}`,
        message: isKeyConfigured 
          ? 'Generated using Mock Fixture (TRIPO3D_USE_MOCK=true).' 
          : 'Generated using Mock Fixture. Enter TRIPO3D_API_KEY in .env.local for live Tripo3D AI generation.'
      });
    }

    // Live Tripo3D Hosted API Generation Flow
    console.log('[Blender AI] Starting live Tripo3D generation workflow...');
    
    // Step 1: Upload Image to Tripo3D
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype });
    const formData = new FormData();
    formData.append('file', blob, req.file.originalname);

    console.log('[Blender AI] Step 1/3: Uploading reference image to Tripo3D API...');
    let uploadRes;
    try {
      uploadRes = await fetch('https://openapi.tripo3d.ai/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      });
    } catch (netErr) {
      return res.status(503).json({
        error: 'Network error connecting to Tripo3D API.',
        details: netErr.message
      });
    }

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || uploadData.code !== 0) {
      console.error('[Blender AI] Tripo3D file upload failed:', uploadData);

      if (uploadRes.status === 401 || uploadData.code === 1000 || uploadData.code === 1002) {
        return res.status(401).json({
          error: 'Authentication failed. Please check that TRIPO3D_API_KEY in .env.local is valid.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (uploadRes.status === 402 || uploadData.code === 2010) {
        return res.status(402).json({
          error: 'Insufficient Tripo3D credits. Please check your credit balance at https://platform.tripo3d.ai',
          code: 'INSUFFICIENT_CREDITS'
        });
      }

      return res.status(502).json({
        error: 'Failed to upload image to Tripo3D.',
        details: uploadData.message || uploadData
      });
    }

    const fileToken = uploadData.data?.file_token;
    console.log(`[Blender AI] File uploaded successfully. Token: ${fileToken}`);

    // Step 2: Submit Image-to-Model Task
    console.log('[Blender AI] Step 2/3: Submitting 3D reconstruction task...');
    const rawExt = path.extname(req.file.originalname).replace('.', '').toLowerCase() || 'jpg';
    const fileFormat = (rawExt === 'jpeg' || rawExt === 'jpg') ? 'jpg' : (rawExt === 'png' ? 'png' : 'webp');

    const taskPayload = {
      model: req.body.model || 'v3.1-20260211',
      file: {
        type: fileFormat,
        file_token: fileToken
      },
      texture: true,
      pbr: true,
      texture_quality: req.body.texture_quality || 'standard'
    };

    let taskRes;
    try {
      taskRes = await fetch('https://openapi.tripo3d.ai/v3/generation/image-to-model', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskPayload)
      });
    } catch (netErr) {
      return res.status(503).json({
        error: 'Network error submitting generation task to Tripo3D.',
        details: netErr.message
      });
    }

    const taskData = await taskRes.json();
    if (!taskRes.ok || taskData.code !== 0) {
      console.error('[Blender AI] Tripo3D task creation failed:', taskData);

      if (taskRes.status === 401 || taskData.code === 1000 || taskData.code === 1002) {
        return res.status(401).json({
          error: 'Authentication failed on task submission. Check your TRIPO3D_API_KEY.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (taskRes.status === 402 || taskData.code === 2010) {
        return res.status(402).json({
          error: 'Insufficient Tripo3D credits to generate 3D model.',
          code: 'INSUFFICIENT_CREDITS'
        });
      }

      if (taskRes.status === 429 || taskData.code === 2009) {
        return res.status(429).json({
          error: 'Tripo3D task rate limit or concurrency limit reached. Please wait a moment and try again.',
          code: 'RATE_LIMIT'
        });
      }

      return res.status(502).json({
        error: 'Failed to create 3D generation task.',
        details: taskData.message || taskData
      });
    }

    const taskId = taskData.data?.task_id;
    console.log(`[Blender AI] Task enqueued. Task ID: ${taskId}. Polling for progress...`);

    // Step 3: Poll Task Status until Success or Timeout (max 180s)
    let attempts = 0;
    const maxAttempts = 90; // 90 * 2s = 180s
    let taskResult = null;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const pollRes = await fetch(`https://openapi.tripo3d.ai/v3/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      const pollData = await pollRes.json();
      if (!pollRes.ok || pollData.code !== 0) {
        console.warn(`[Blender AI] Polling warning on attempt ${attempts}:`, pollData.message);
        continue;
      }

      const status = pollData.data?.status;
      const progress = pollData.data?.progress || 0;
      console.log(`[Blender AI] Task ${taskId} status: ${status} (${progress}%)`);

      if (status === 'success') {
        taskResult = pollData.data;
        break;
      } else if (status === 'failed' || status === 'cancelled') {
        return res.status(502).json({
          error: `3D Generation ${status} on provider.`,
          details: pollData.message || 'Mesh generation failed.'
        });
      }
    }

    if (!taskResult || !taskResult.output?.model_url) {
      return res.status(504).json({ error: '3D Generation timed out after 180 seconds.' });
    }

    // Step 4: Stream and Persist GLB from Tripo CDN before 5-minute expiration
    console.log('[Blender AI] Step 3/3: Streaming GLB binary into local durable storage...');
    const modelUrl = taskResult.output.model_url;
    const modelStreamRes = await fetch(modelUrl);
    
    if (!modelStreamRes.ok) {
      return res.status(502).json({ error: 'Failed to download GLB model from Tripo3D CDN.' });
    }

    const arrayBuffer = await modelStreamRes.arrayBuffer();
    const modelBuffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(finalOutputPath, modelBuffer);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'model_latest.glb'), modelBuffer);
    console.log(`[Blender AI] Model saved successfully to ${finalOutputPath} and model_latest.glb`);

    return res.json({
      success: true,
      isMock: false,
      taskId,
      filename: outputFilename,
      modelUrl: `/output/${outputFilename}`,
      downloadUrl: `/api/download/${outputFilename}`
    });

  } catch (err) {
    console.error('[Blender AI] Generation exception:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

/**
 * Task Status Polling Endpoint (for async workflow and serverless support)
 */
app.get('/api/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(401).json({ error: 'API key not configured' });
  }

  try {
    const pollRes = await fetch(`https://openapi.tripo3d.ai/v3/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    const pollData = await pollRes.json();
    if (!pollRes.ok || pollData.code !== 0) {
      return res.status(pollRes.status || 500).json({
        error: pollData.message || 'Failed to poll task status',
        code: pollData.code
      });
    }

    res.json(pollData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to poll task', details: err.message });
  }
});

/**
 * File Download Endpoint with Attachment Header
 */
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Model file not found.' });
  }

  res.download(filePath, filename);
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`   Blender AI Studio running at http://localhost:${PORT}   `);
    console.log(`=======================================================`);
  });
}

export default app;
