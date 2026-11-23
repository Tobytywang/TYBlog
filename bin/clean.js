#!/usr/bin/env node

/**
 * 清理构建产物（跨平台，不依赖 rm）
 * 用法：node bin/clean.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const OUTPUT_FILES = [
  'index.html',
  'index-en.html',
  'index-fr.html',
  'index-retro.html',
  'index-retro-en.html',
  'index-retro-fr.html'
];

OUTPUT_FILES.forEach(name => {
  const target = path.join(ROOT_DIR, name);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`  🗑  ${name}`);
  }
});

console.log(`\n✨ Clean complete! Removed ${OUTPUT_FILES.length} possible outputs.`);
