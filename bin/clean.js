#!/usr/bin/env node

/**
 * 清理构建产物（跨平台，不依赖 rm）
 * 产物清单由 themes.json 推导，新增主题无需修改本脚本。
 * 用法：node bin/clean.js
 */

const fs = require('fs');
const path = require('path');
const { ROOT_DIR, loadConfig, allOutputPaths } = require('./lib/layout');

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

// 当前布局的产物：由配置推导
const expected = new Set(allOutputPaths(loadConfig()));
expected.forEach(name => {
  if (remove(name)) removed++;
});

// 清理主题目录下的陈旧页面（如旧布局遗留的文件）
const themesDir = path.join(ROOT_DIR, 'themes');
if (fs.existsSync(themesDir)) {
  fs.readdirSync(themesDir).forEach(skinDir => {
    const dir = path.join(themesDir, skinDir);
    if (!fs.statSync(dir).isDirectory()) return;
    fs.readdirSync(dir).forEach(name => {
      if (!name.endsWith('.html')) return;
      const rel = `themes/${skinDir}/${name}`;
      if (expected.has(rel)) return;
      if (remove(rel)) removed++;
    });
  });
}

console.log(`\n✨ Clean complete! Removed ${removed} file(s).`);
