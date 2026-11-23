#!/usr/bin/env node

/**
 * TYBlog 构建脚本
 * 功能：从单一模板和配置生成多主题、多语言 HTML
 * 结构：默认主题的中文页位于根目录（默认入口），其余页面在 themes/<skin>/ 下
 * 用法：node bin/build.js
 */

const fs = require('fs');
const path = require('path');
const {
  ROOT_DIR,
  SRC_DIR,
  loadConfig,
  outputPath,
  nextSkin,
  hrefTo,
  validate
} = require('./lib/layout');

// ── 读取模板 ────────────────────────────────────
function loadTemplate(filename) {
  try {
    return fs.readFileSync(path.join(SRC_DIR, filename), 'utf8');
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    process.exit(1);
  }
}

// ── 字符串替换 ──────────────────────────────────
// replacements 覆盖 data 的同名键，避免两轮遍历做同一件事
function render(template, data, replacements) {
  const values = Object.assign({}, data, replacements);
  return Object.keys(values).reduce(
    (result, key) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), values[key]),
    template
  );
}

// ── 页面资源链接 ────────────────────────────────
function cssLinks(config, skin, out) {
  const lines = config.sharedCss.map(css =>
    `    <link rel="stylesheet" href="${hrefTo(out, css)}">`);
  lines.push(`    <link rel="stylesheet" href="${hrefTo(out, `${skin.dir}/style.css`)}">`);
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
    const href = hrefTo(out, outputPath(config, skin, page));
    return `        <a href="${href}" class="lang-link${active}" data-lang="${page.lang}">${page.label}</a>`;
  }).join('\n');
}

// hreflang 直接复用 i18n.json 的 htmlLang，与 <html lang> 同源
function hreflangLinks(config, skin, i18n, out) {
  return config.pages.map(page => {
    const href = hrefTo(out, outputPath(config, skin, page));
    return `    <link rel="alternate" hreflang="${i18n[page.lang].htmlLang}" href="${href}">`;
  }).join('\n');
}

// ── 主题切换链接（跳到「下一个」主题的同语言页）──
// 按配置顺序循环，最后一个绕回第一个；主题数量任意
function skinSwitch(config, skin, lang, out) {
  const target = nextSkin(config, skin);
  const currentLabel = skin.label[lang];
  const targetLabel = target.label[lang];
  return {
    href: hrefTo(out, outputPath(config, target, config.pages.find(p => p.lang === lang))),
    target: target.id,
    title: `${currentLabel} → ${targetLabel}`,
    aria: `切换到${targetLabel}主题，当前为${currentLabel}`
  };
}

// ── 主函数 ──────────────────────────────────────
function main() {
  console.log('🔨 Starting build...\n');

  const config = loadConfig();

  // 校验配置与资源，避免产出静默 404 的页面
  const errors = validate(config);
  if (errors.length) {
    console.error('❌ 配置校验未通过：');
    errors.forEach(e => console.error(`   · ${e}`));
    process.exit(1);
  }

  const i18n = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'i18n.json'), 'utf8'));
  const pageTemplate = loadTemplate('template.html');

  config.skins.forEach(skin => {
    config.pages.forEach(page => {
      const out = outputPath(config, skin, page);
      const sw = skinSwitch(config, skin, page.lang, out);
      const html = render(pageTemplate, i18n[page.lang], {
        faviconHref: hrefTo(out, 'favicon.ico'),
        imgBase: hrefTo(out, 'img') + '/',
        cssLinks: cssLinks(config, skin, out),
        scriptLinks: scriptLinks(config, skin, out),
        hreflangLinks: hreflangLinks(config, skin, i18n, out),
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
