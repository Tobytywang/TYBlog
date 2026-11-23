#!/usr/bin/env node

/**
 * 清理构建产物（跨平台，不依赖 rm）
 * 用法：node bin/clean.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// 当前产物：根目录默认入口 + 各主题目录下的其余语言页
const OUTPUT_FILES = [
  'index.html',
  'themes/modern/index-en.html',
  'themes/modern/index-fr.html',
  'themes/retro/index.html',
  'themes/retro/index-en.html',
  'themes/retro/index-fr.html'
];

// 旧版遗留产物（入口门面 / 平铺结构 / 旧版现代中文页），升级时一并清理
const LEGACY_FILES = [
  'themes/modern/index.html',
  'index-en.html',
  'index-fr.html',
  'index-retro.html',
  'index-retro-en.html',
  'index-retro-fr.html'
];

function remove(relPath) {
  const target = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`  🗑  ${relPath}`);
    return true;
  }
  return false;
}

let removed = 0;
OUTPUT_FILES.concat(LEGACY_FILES).forEach(name => {
  if (remove(name)) removed++;
});

console.log(`\n✨ Clean complete! Removed ${removed} file(s).`);
