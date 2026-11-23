#!/usr/bin/env node

/**
 * TYBlog 布局规则（build.js 与 clean.js 共用）
 *
 * 单一事实来源：主题的输出路径、主题间的循环关系、构建期校验规则
 * 全部集中在此，build 与 clean 引用同一套逻辑，避免两端口径不一致。
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// ── 配置读取 ────────────────────────────────────
function loadConfig() {
  const file = path.join(SRC_DIR, 'themes.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Error reading themes.json: ${err.message}`);
    process.exit(1);
  }
}

// ── 页面输出路径 ────────────────────────────────
// 默认主题的中文页落在根目录作为入口，其余页面在各自主题目录下
function outputPath(skin, page) {
  const file = page.file;
  if (skin.default === true && page.lang === 'zh') return file;
  return `${skin.dir}/${file}`;
}

// 页面地址：输出路径 + 相对链接。
// 构建期所有 href 都从这里出，页面内不再各自拼一遍
function pageUrl(fromOutput, skin, page) {
  return hrefTo(fromOutput, outputPath(skin, page));
}

// 当前布局下所有页面的输出路径
function allOutputPaths(config) {
  return config.skins.flatMap(skin =>
    config.pages.map(page => outputPath(skin, page)));
}

// ── 主题循环 ────────────────────────────────────
// 取「下一个主题」，最后一个绕回第一个。
// 语义在 2 / 3 / N 个主题下保持一致：任意主题都能到达任意其他主题。
function nextSkin(config, skin) {
  const idx = config.skins.findIndex(s => s.id === skin.id);
  return config.skins[(idx + 1) % config.skins.length];
}

// ── 相对链接 ────────────────────────────────────
// 从当前页面目录到目标文件的相对路径，统一处理所有 href/src
function hrefTo(fromOutput, toOutput) {
  return path.posix.relative(path.posix.dirname(fromOutput), toOutput);
}

// ── 构建期校验 ──────────────────────────────────
// 配置或资源有误时立即报错退出，避免产出静默 404 的页面
function validate(config) {
  const errors = [];

  if (!Array.isArray(config.skins) || config.skins.length === 0) {
    errors.push('skins 为空，至少需要配置一个主题');
    return errors;
  }

  // 主题 id 唯一
  const ids = config.skins.map(s => s.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) {
    errors.push(`主题 id 重复：${[...new Set(dupIds)].join(', ')}`);
  }

  // 默认主题恰好一个
  const defaults = config.skins.filter(s => s.default === true);
  if (defaults.length === 0) {
    errors.push('未指定默认主题，请在某个主题上设置 "default": true');
  } else if (defaults.length > 1) {
    errors.push(`默认主题有 ${defaults.length} 个（${defaults.map(s => s.id).join(', ')}），只能有一个`);
  }

  config.skins.forEach(skin => {
    // 主题目录与样式表
    if (!skin.dir) {
      errors.push(`主题 ${skin.id} 缺少 dir 配置`);
    } else if (!fs.existsSync(path.join(ROOT_DIR, skin.dir))) {
      errors.push(`主题 ${skin.id} 的目录不存在：${skin.dir}`);
    } else if (!fs.existsSync(path.join(ROOT_DIR, skin.dir, 'style.css'))) {
      errors.push(`主题 ${skin.id} 缺少样式表：${skin.dir}/style.css`);
    }

    // 每种语言都要有显示名
    config.pages.forEach(page => {
      if (!skin.label || !skin.label[page.lang]) {
        errors.push(`主题 ${skin.id} 缺少 ${page.lang} 的显示名（label.${page.lang}）`);
      }
    });
  });

  // 语言页文件名唯一
  const files = config.pages.map(p => p.file);
  const dupFiles = files.filter((f, i) => files.indexOf(f) !== i);
  if (dupFiles.length) {
    errors.push(`语言页文件名重复：${[...new Set(dupFiles)].join(', ')}`);
  }

  // 每种语言都要有按钮文案（显示名写在配置里，构建脚本不硬编码）
  config.pages.forEach(page => {
    if (!page.label) {
      errors.push(`语言 ${page.lang} 缺少按钮文案（label）`);
    }
  });

  return errors;
}

module.exports = {
  ROOT_DIR,
  SRC_DIR,
  loadConfig,
  outputPath,
  pageUrl,
  allOutputPaths,
  nextSkin,
  hrefTo,
  validate
};
