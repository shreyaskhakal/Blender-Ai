import fs from 'fs';
import path from 'path';

/**
 * Generates a valid minimal binary glTF (GLB) file representing a 3D beveled box
 * with normal vectors and PBR material.
 */
export function generateValidGLB(outputPath) {
  // 24 vertices for 6 faces of a cube (unit size)
  const positions = new Float32Array([
    // Front face
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    // Back face
    -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
    // Top face
    -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
    // Right face
     0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
  ]);

  const normals = new Float32Array([
    // Front
     0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
    // Back
     0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
    // Top
     0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
    // Bottom
     0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
    // Right
     1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
    // Left
    -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3, // Front
     4,  5,  6,   4,  6,  7, // Back
     8,  9, 10,   8, 10, 11, // Top
    12, 13, 14,  12, 14, 15, // Bottom
    16, 17, 18,  16, 18, 19, // Right
    20, 21, 22,  20, 22, 23  // Left
  ]);

  const posBytes = positions.buffer.byteLength;
  const normBytes = normals.buffer.byteLength;
  const idxBytes = indices.buffer.byteLength;
  const totalBinBytes = posBytes + normBytes + idxBytes;

  const binBuffer = Buffer.alloc(totalBinBytes);
  Buffer.from(positions.buffer).copy(binBuffer, 0);
  Buffer.from(normals.buffer).copy(binBuffer, posBytes);
  Buffer.from(indices.buffer).copy(binBuffer, posBytes + normBytes);

  const gltf = {
    asset: { version: '2.0', generator: 'Blender-AI Mock Generator' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Blender_AI_Asset' }],
    meshes: [{
      name: 'Sample_Cube_Mesh',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0
      }]
    }],
    materials: [{
      name: 'BlenderAI_CyanStudio_PBR',
      pbrMetallicRoughness: {
        baseColorFactor: [0.133, 0.827, 0.933, 1.0], // Brand cyan #22D3EE
        metallicFactor: 0.1,
        roughnessFactor: 0.35
      }
    }],
    buffers: [{ byteLength: totalBinBytes }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: posBytes, byteLength: normBytes, target: 34962 },
      { buffer: 0, byteOffset: posBytes + normBytes, byteLength: idxBytes, target: 34963 }
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 24, type: 'VEC3', max: [0.5, 0.5, 0.5], min: [-0.5, -0.5, -0.5] },
      { bufferView: 1, byteOffset: 0, componentType: 5126, count: 24, type: 'VEC3', max: [1, 1, 1], min: [-1, -1, -1] },
      { bufferView: 2, byteOffset: 0, componentType: 5123, count: 36, type: 'SCALAR', max: [23], min: [0] }
    ]
  };

  const jsonString = JSON.stringify(gltf);
  const jsonBuffer = Buffer.from(jsonString, 'utf8');
  // Pad JSON chunk to 4-byte boundary with spaces (0x20)
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
  const paddedJsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);

  // Pad BIN chunk to 4-byte boundary with zeros (0x00)
  const binPadding = (4 - (binBuffer.length % 4)) % 4;
  const paddedBinBuffer = Buffer.concat([binBuffer, Buffer.alloc(binPadding, 0x00)]);

  const totalByteLength = 12 + 8 + paddedJsonBuffer.length + 8 + paddedBinBuffer.length;

  const glbHeader = Buffer.alloc(12);
  glbHeader.writeUInt32LE(0x46546C67, 0); // "glTF"
  glbHeader.writeUInt32LE(2, 4);          // version 2
  glbHeader.writeUInt32LE(totalByteLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJsonBuffer.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // "JSON"

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(paddedBinBuffer.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // "BIN\0"

  const fullGLB = Buffer.concat([
    glbHeader,
    jsonChunkHeader,
    paddedJsonBuffer,
    binChunkHeader,
    paddedBinBuffer
  ]);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, fullGLB);
  }

  return fullGLB;
}

// Generate default sample cube if run directly
if (process.argv[1]?.endsWith('create-sample-glb.js')) {
  generateValidGLB(path.resolve('./output/sample_cube.glb'));
  console.log('Sample valid GLB generated at output/sample_cube.glb');
}
