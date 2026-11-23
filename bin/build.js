#!/usr/bin/env node

/**
 * TYBlog 构建脚本
 * 功能：从单一模板和配置生成多主题、多语言 HTML
 * 结构：根目录 index.html 即「现代主题·中文」默认入口，其余页面在 themes/<skin>/ 下
 * 用法：node bin/build.js
 */

const fs = require('fs');
const path = require('path');

// ── 配置路径 ──────────────────────────────────
const SRC_DIR = path.join(__dirname, '..', 'src');
const ROOT_DIR = path.join(__dirname, '..');

// 语言按钮文案（仅用于导航显示）
const LANG_LABELS = { zh: '中文', en: 'EN', fr: 'FR' };

// ── 读取 JSON / 模板 ────────────────────────────
function loadJSON(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC_DIR, filename), 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    process.exit(1);
  }
}

function loadTemplate(filename) {
  try {
    return fs.readFileSync(path.join(SRC_DIR, filename), 'utf8');
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    process.exit(1);
  }
}

// ── 字符串替换 ──────────────────────────────────
function render(template, data, replacements) {
  let result = template;
  Object.keys(replacements).forEach(key => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacements[key]);
  });
  Object.keys(data).forEach(key => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), data[key]);
  });
  return result;
}

// ── 页面输出位置 ────────────────────────────────
// 现代主题中文页落在根目录，作为默认入口；其余在 themes/<skin>/ 下
function outputPath(skin, lang) {
  if (skin.id === 'modern' && lang === 'zh') return 'index.html';
  const file = lang === 'zh' ? 'index.html' : `index-${lang}.html`;
  return `themes/${skin.id}/${file}`;
}

// 从当前页面目录到目标文件的相对链接（统一处理所有 href/src）
function hrefTo(fromOutput, toOutput) {
  return path.posix.relative(path.posix.dirname(fromOutput), toOutput);
}

// ── 页面资源链接 ────────────────────────────────
function cssLinks(config, skin, out) {
  const lines = config.sharedCss.map(css =>
    `    <link rel="stylesheet" href="${hrefTo(out, css)}">`);
  lines.push(`    <link rel="stylesheet" href="${hrefTo(out, `themes/${skin.id}/style.css`)}">`);
  return lines.join('\n');
}

function scriptLinks(config, skin, out) {
  return config.sharedScripts.concat(skin.scripts || [])
    .map(file => `    <script src="${hrefTo(out, file)}"></script>`)
    .join('\n');
}

// ── 语言导航与 hreflang（同主题内切语言）─────────
function langLinks(config, skin, currentLang, out) {
  return config.pages.map(page => {
    const active = page.lang === currentLang ? ' active' : '';
    const href = hrefTo(out, outputPath(skin, page.lang));
    return `        <a href="${href}" class="lang-link${active}" data-lang="${page.lang}">${LANG_LABELS[page.lang]}</a>`;
  }).join('\n');
}

function hreflangLinks(config, skin, out) {
  return config.pages.map(page => {
    const hreflang = page.lang === 'zh' ? 'zh-CN' : page.lang;
    const href = hrefTo(out, outputPath(skin, page.lang));
    return `    <link rel="alternate" hreflang="${hreflang}" href="${href}">`;
  }).join('\n');
}

// ── 主题切换链接（跳到另一主题的同语言页）────────
function skinSwitch(config, skin, lang, out) {
  const target = config.skins.find(s => s.id !== skin.id);
  const currentLabel = skin.label[lang];
  const targetLabel = target.label[lang];
  return {
    href: hrefTo(out, outputPath(target, lang)),
    target: target.id,
    title: `${currentLabel} → ${targetLabel}`,
    aria: `切换到${targetLabel}主题，当前为${currentLabel}`
  };
}

// ── 主函数 ──────────────────────────────────────
function main() {
  console.log('🔨 Starting build...\n');

  const i18n = loadJSON('i18n.json');
  const config = loadJSON('themes.json');
  const pageTemplate = loadTemplate('template.html');

  config.skins.forEach(skin => {
    config.pages.forEach(page => {
      const out = outputPath(skin, page.lang);
      const sw = skinSwitch(config, skin, page.lang, out);
      const html = render(pageTemplate, i18n[page.lang], {
        skinId: skin.id,
        faviconHref: hrefTo(out, 'favicon.ico'),
        imgBase: hrefTo(out, 'img') + '/',
        cssLinks: cssLinks(config, skin, out),
        scriptLinks: scriptLinks(config, skin, out),
        hreflangLinks: hreflangLinks(config, skin, out),
        langLinks: langLinks(config, skin, page.lang, out),
        skinHref: sw.href,
        targetSkin: sw.target,
        skinTitle: sw.title,
        skinAria: sw.aria
      });
      const outFile = path.join(ROOT_DIR, out);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');
      console.log(`   ✅ ${out}  [lang=${page.lang}, skin=${skin.id}]`);
    });
  });

  const count = config.skins.length * config.pages.length;
  console.log(`\n✨ Build complete! Generated ${count} files.`);
}

main();
