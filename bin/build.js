#!/usr/bin/env node

/**
 * TYBlog 构建脚本
 * 功能：从单一模板和配置生成多主题、多语言 HTML
 * 结构：themes/<skin>/ 下每个主题一套语言页，根目录仅保留入口门面 index.html
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

// ── 主题页：资源链接 ────────────────────────────
// 页面位于 themes/<skin>/，共享资源需 ../../ 回到站点根
function themeCssLinks(config) {
  const lines = config.sharedCss.map(css => `    <link rel="stylesheet" href="../../${css}">`);
  lines.push(`    <link rel="stylesheet" href="style.css">`);
  return lines.join('\n');
}

function themeScriptLinks(config, skin) {
  const files = config.sharedScripts.concat(skin.scripts || []);
  return files
    .filter(file => file !== 'js/entry.js') // 入口跳转仅在门面页加载
    .map(file => `    <script src="../../${file}"></script>`)
    .join('\n');
}

// ── 主题页：语言导航与 hreflang（同主题目录内）──
function langLinks(config, currentLang) {
  return config.pages.map(page => {
    const active = page.lang === currentLang ? ' active' : '';
    return `        <a href="${page.file}" class="lang-link${active}" data-lang="${page.lang}">${LANG_LABELS[page.lang]}</a>`;
  }).join('\n');
}

function hreflangLinks(config) {
  return config.pages.map(page => {
    const hreflang = page.lang === 'zh' ? 'zh-CN' : page.lang;
    return `    <link rel="alternate" hreflang="${hreflang}" href="${page.file}">`;
  }).join('\n');
}

// ── 主题页：主题切换链接（跳到另一主题的同语言页）──
function skinSwitch(config, skin, lang) {
  const target = config.skins.find(s => s.id !== skin.id);
  const currentLabel = skin.label[lang];
  const targetLabel = target.label[lang];
  return {
    href: `../${target.dir.split('/').pop()}/index${lang === 'zh' ? '' : '-' + lang}.html`,
    target: target.id,
    title: `${currentLabel} → ${targetLabel}`,
    aria: `切换到${targetLabel}主题，当前为${currentLabel}`
  };
}

// ── 入口页：主题 × 语言链接组 ──────────────────
function entryGroups(config) {
  return config.skins.map(skin => {
    const links = config.pages.map(page => {
      const label = LANG_LABELS[page.lang];
      return `            <a href="${skin.dir}/${page.file}">${label}</a>`;
    }).join('\n');
    return `        <section class="entry-group">\n            <h2>${skin.label.zh}主题</h2>\n            <div class="entry-langs">\n${links}\n            </div>\n        </section>`;
  }).join('\n');
}

// ── 主函数 ──────────────────────────────────────
function main() {
  console.log('🔨 Starting build...\n');

  const i18n = loadJSON('i18n.json');
  const config = loadJSON('themes.json');
  const pageTemplate = loadTemplate('template.html');
  const entryTemplate = loadTemplate('entry.html');

  // 按主题生成语言页
  config.skins.forEach(skin => {
    const cssLinks = themeCssLinks(config);
    const scriptLinks = themeScriptLinks(config, skin);
    const hreflang = hreflangLinks(config);

    config.pages.forEach(page => {
      const sw = skinSwitch(config, skin, page.lang);
      const html = render(pageTemplate, i18n[page.lang], {
        skinId: skin.id,
        cssLinks,
        scriptLinks,
        hreflangLinks: hreflang,
        langLinks: langLinks(config, page.lang),
        skinHref: sw.href,
        targetSkin: sw.target,
        skinTitle: sw.title,
        skinAria: sw.aria
      });
      const outFile = path.join(ROOT_DIR, skin.dir, page.file);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');
      console.log(`   ✅ ${skin.dir}/${page.file}  [lang=${page.lang}, skin=${skin.id}]`);
    });
  });

  // 生成入口门面页
  const entryHtml = render(entryTemplate, i18n.zh, {
    entryGroups: entryGroups(config)
  });
  fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), entryHtml, 'utf8');
  console.log(`   ✅ index.html  [entry facade]`);

  console.log(`\n✨ Build complete! Generated ${config.skins.length * config.pages.length + 1} files.`);
}

main();
