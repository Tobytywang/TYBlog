#!/usr/bin/env node

/**
 * TYBlog 构建脚本
 * 功能：从单一模板和配置数据生成多主题、多语言的 HTML 文件
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
// 每行自带 4 空格缩进；模板中的占位符顶格，避免叠加成 8 空格
function generateCSSLinks(cssFiles) {
  return cssFiles
    .map(css => `    <link rel="stylesheet" href="css/${css}">`)
    .join('\n');
}

// ── 生成 Script 链接 ──────────────────────────────
function generateScriptLinks(scriptFiles) {
  return scriptFiles
    .map(script => `    <script src="js/${script}"></script>`)
    .join('\n');
}

// ── 生成 hreflang 标签 ──────────────────────────────
function generateHreflang(themeConfig) {
  const lines = [];
  const output = themeConfig.output;

  Object.keys(output).forEach(lang => {
    const filename = output[lang];
    const hreflang = lang === 'zh' ? 'zh-CN' : lang;
    lines.push(`    <link rel="alternate" hreflang="${hreflang}" href="${filename}">`);
  });

  return lines.join('\n');
}

// ── 生成语言导航 ─────────────────────────────────
// 真实链接，指向与 hreflang 相同的文件，保证 URL、页面语言、声明三者一致
function generateLangLinks(themeConfig, currentLang) {
  return Object.keys(themeConfig.output).map(lang => {
    const active = lang === currentLang ? ' active' : '';
    return `        <a href="${themeConfig.output[lang]}" class="lang-link${active}" data-lang="${lang}">${LANG_LABELS[lang]}</a>`;
  }).join('\n');
}

// ── 字符串替换 ──────────────────────────────────
function render(template, data, cssLinks, hreflangLinks, scriptLinks, langLinks) {
  let result = template;

  result = result.replace(/\{\{cssLinks\}\}/g, cssLinks);
  result = result.replace(/\{\{hreflangLinks\}\}/g, hreflangLinks);
  result = result.replace(/\{\{scriptLinks\}\}/g, scriptLinks);
  result = result.replace(/\{\{langLinks\}\}/g, langLinks);

  // 替换 i18n 文案占位符
  Object.keys(data).forEach(key => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, data[key]);
  });

  return result;
}

// ── 主函数 ──────────────────────────────────
function main() {
  console.log('🔨 Starting build...\n');

  const i18n = loadJSON('i18n.json');
  const themes = loadJSON('themes.json');
  const template = loadTemplate();

  let totalFiles = 0;

  Object.keys(themes).forEach(themeKey => {
    const themeConfig = themes[themeKey];

    console.log(`📁 Theme: ${themeConfig.name} (${themeKey})`);

    const cssLinks = generateCSSLinks(themeConfig.css);
    const scriptLinks = generateScriptLinks(themeConfig.scripts);
    const hreflangLinks = generateHreflang(themeConfig);

    Object.keys(i18n).forEach(lang => {
      const filename = themeConfig.output[lang];
      const langLinks = generateLangLinks(themeConfig, lang);
      const html = render(template, i18n[lang], cssLinks, hreflangLinks, scriptLinks, langLinks);

      fs.writeFileSync(path.join(ROOT_DIR, filename), html, 'utf8');

      console.log(`   ✅ ${filename}`);
      totalFiles++;
    });

    console.log('');
  });

  console.log(`\n✨ Build complete! Generated ${totalFiles} files.`);
}

// ── 执行 ──────────────────────────────────
main();
