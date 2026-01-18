import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const sizes = [16, 48, 128];
const bgColor = '#3B82F6'; // Blue-500
const textColor = '#FFFFFF';

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw rounded rectangle background
  const radius = size * 0.2;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.fill();

  // Draw "RQ" text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${size * 0.45}px Arial`;
  ctx.fillText('RQ', size / 2, size / 2);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  writeFileSync(join(publicDir, `icon${size}.png`), buffer);
  console.log(`Created icon${size}.png`);
}

console.log('Icons generated successfully!');
