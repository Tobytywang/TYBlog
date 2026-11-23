#!/usr/bin/env node

/**
 * TYBlog 构建脚本
 * 功能：从单一模板和配置生成多语言 HTML
 * 每个页面携带全部皮肤样式表，默认激活其一，运行时可切换（CSS Zen Garden 模式）
 * 用法：node bin/build.js
 */

const fs = require('fs');
const path = require('path');

// ── 配置路径 ──────────────────────────────────
const SRC_DIR = path.join(__dirname, '..', 'src');
const ROOT_DIR = path.join(__dirname, '..');

// 语言按钮文案（仅用于导航显示）
const LANG_LABELS = { zh: '中文', en: 'EN', fr: 'FR' };

// ── 读取 JSON 文件 ──────────────────────────────
function loadJSON(filename) {
  const filePath = path.join(SRC_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    process.exit(1);
  }
}

// ── 读取模板文件 ──────────────────────────────
function loadTemplate() {
  const filePath = path.join(SRC_DIR, 'template.html');
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('Error reading template.html:', err.message);
    process.exit(1);
  }
}

// ── 生成 CSS 链接 ──────────────────────────────
// 共享样式 + 全部皮肤样式；data-skin 供 theme-switcher 识别，非默认皮肤 disabled
// 每行自带 4 空格缩进；模板中占位符顶格
function generateCSSLinks(config, entrySkin) {
  const lines = config.sharedCss.map(
    css => `    <link rel="stylesheet" href="css/${css}">`
  );

  config.skins.forEach(skin => {
    const disabled = skin.id === entrySkin ? '' : ' disabled';
    const labels = Object.keys(skin.label)
      .map(lang => ` data-skin-label-${lang}="${skin.label[lang]}"`)
      .join('');
    lines.push(
      `    <link rel="stylesheet" href="css/${skin.css}" data-skin="${skin.id}"${labels}${disabled}>`
    );
  });

  return lines.join('\n');
}

// ── 生成 Script 链接 ──────────────────────────────
function generateScriptLinks(scriptFiles) {
  return scriptFiles
    .map(script => `    <script src="js/${script}"></script>`)
    .join('\n');
}

// ── 主页面集合（hreflang 与语言导航只指向 primary 页面）──
function primaryPages(config) {
  return config.pages.filter(page => page.primary);
}

// ── 生成 hreflang 标签 ──────────────────────────────
function generateHreflang(config) {
  return primaryPages(config).map(page => {
    const hreflang = page.lang === 'zh' ? 'zh-CN' : page.lang;
    return `    <link rel="alternate" hreflang="${hreflang}" href="${page.file}">`;
  }).join('\n');
}

// ── 生成语言导航 ─────────────────────────────────
function generateLangLinks(config, currentLang) {
  return primaryPages(config).map(page => {
    const active = page.lang === currentLang ? ' active' : '';
    return `        <a href="${page.file}" class="lang-link${active}" data-lang="${page.lang}">${LANG_LABELS[page.lang]}</a>`;
  }).join('\n');
}

// ── 字符串替换 ──────────────────────────────────
function render(template, data, replacements) {
  let result = template;

  Object.keys(replacements).forEach(key => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacements[key]);
  });

  // 替换 i18n 文案占位符
  Object.keys(data).forEach(key => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), data[key]);
  });

  return result;
}

// ── 主函数 ──────────────────────────────────
function main() {
  console.log('🔨 Starting build...\n');

  const i18n = loadJSON('i18n.json');
  const config = loadJSON('themes.json');
  const template = loadTemplate();

  const cssBySkin = {};
  config.pages.forEach(page => {
    cssBySkin[page.entrySkin] = generateCSSLinks(config, page.entrySkin);
  });
  const scriptLinks = generateScriptLinks(config.scripts);
  const hreflangLinks = generateHreflang(config);

  config.pages.forEach(page => {
    const langLinks = generateLangLinks(config, page.lang);
    const html = render(template, i18n[page.lang], {
      cssLinks: cssBySkin[page.entrySkin],
      hreflangLinks,
      scriptLinks,
      langLinks,
      entrySkin: page.entrySkin,
      isPrimary: String(page.primary)
    });

    fs.writeFileSync(path.join(ROOT_DIR, page.file), html, 'utf8');
    console.log(`   ✅ ${page.file}  [lang=${page.lang}, skin=${page.entrySkin}, primary=${page.primary}]`);
  });

  console.log(`\n✨ Build complete! Generated ${config.pages.length} files.`);
}

// ── 执行 ──────────────────────────────────
main();
