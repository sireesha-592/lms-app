#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  generate-icons.js  –  Creates placeholder app icons for all 3 apps
//
//  Run:  node scripts/generate-icons.js
//  Needs: npm install canvas  (or: npm install -g canvas)
//
//  For PRODUCTION: replace the generated icons with your real PNG/ICO files.
//  Recommended tool (free): https://www.icoconverter.com  or  https://cloudconvert.com
// ─────────────────────────────────────────────────────────────────────────────

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const APPS = [
  { id: 'admin',   label: 'A', color: '#ef4444', dir: 'electron-wrapper/admin/icons'   },
  { id: 'trainer', label: 'T', color: '#8b5cf6', dir: 'electron-wrapper/trainer/icons' },
  { id: 'trainee', label: 'S', color: '#00d4aa', dir: 'electron-wrapper/trainee/icons' },
];

const SIZES = [16, 32, 48, 64, 128, 256, 512];

function makeIcon(label, color, size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  // Background circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Letter
  ctx.fillStyle = '#ffffff';
  ctx.font      = `bold ${Math.floor(size * 0.5)}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

for (const app of APPS) {
  fs.mkdirSync(app.dir, { recursive: true });

  // Generate PNG sizes
  for (const size of SIZES) {
    const buf  = makeIcon(app.label, app.color, size);
    const file = path.join(app.dir, `icon-${size}.png`);
    fs.writeFileSync(file, buf);
    console.log(`Created ${file}`);
  }

  // Main icon.png (256px)
  const mainBuf = makeIcon(app.label, app.color, 256);
  fs.writeFileSync(path.join(app.dir, 'icon.png'), mainBuf);
  fs.writeFileSync(path.join(app.dir, 'tray.png'), makeIcon(app.label, app.color, 32));

  console.log(`✅ Icons generated for ${app.id}`);
  console.log(`   ⚠️  Replace with real icons before distributing!`);
  console.log(`   Convert icon.png → icon.ico at: https://icoconverter.com`);
  console.log(`   Then save as ${app.dir}/icon.ico`);
}

console.log('\nDone! Check electron-wrapper/*/icons/');
