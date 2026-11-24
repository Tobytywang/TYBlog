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
  pageUrl,
  nextSkin,
  hasBackgroundSwitch,
  pageScripts,
  hrefTo,
  validate
} = require('./lib/layout');

// ── 读取模板与片段 ──────────────────────────────
function loadSource(relPath) {
  try {
    return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf8');
  } catch (err) {
    console.error(`Error reading ${relPath}:`, err.message);
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

// i18n 句式填空：{{key}} 是模板占位，{key} 是句子里的槽位，两者互不干扰。
// 语序各语言不同，句子只存在于 i18n.json，代码不拼措辞
function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match);
}

// ── 页面资源链接 ────────────────────────────────
function cssLinks(config, skin, out) {
  const lines = config.sharedCss.map(css =>
    `    <link rel="stylesheet" href="${hrefTo(out, css)}">`);
  lines.push(`    <link rel="stylesheet" href="${hrefTo(out, `${skin.dir}/style.css`)}">`);
  return lines.join('\n');
}

// 脚本清单与执行顺序由 layout.js 的 pageScripts() 决定，这里只负责拼标签
function scriptLinks(config, skin, out) {
  return pageScripts(config, skin)
    .map(file => `    <script src="${hrefTo(out, file)}"></script>`)
    .join('\n');
}

// ── 语言导航与 hreflang（同主题内切语言）─────────
function langLinks(config, skin, currentLang, out) {
  return config.pages.map(page => {
    const active = page.lang === currentLang ? ' active' : '';
    return `        <a href="${pageUrl(out, skin, page)}" class="lang-link${active}" data-lang="${page.lang}">${page.label}</a>`;
  }).join('\n');
}

// hreflang 直接复用 i18n.json 的 htmlLang，与 <html lang> 同源
function hreflangLinks(config, skin, i18n, out) {
  return config.pages.map(page =>
    `    <link rel="alternate" hreflang="${i18n[page.lang].htmlLang}" href="${pageUrl(out, skin, page)}">`
  ).join('\n');
}

// ── 主题切换链接（跳到「下一个」主题的同语言页）──
// 按配置顺序循环，最后一个绕回第一个；主题数量任意
function skinSwitch(config, skin, page, out) {
  const target = nextSkin(config, skin);
  const currentLabel = skin.label[page.lang];
  const targetLabel = target.label[page.lang];
  return {
    href: pageUrl(out, target, page),
    title: `${currentLabel} → ${targetLabel}`,
    // 措辞交给 i18n：语序各语言不同，不在这里拼句子
    vars: { current: currentLabel, target: targetLabel }
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
  const pageTemplate = loadSource('template.html');
  // 片段末尾不留空行，拼进页面时才不会多出空行
  const hintPartial = loadSource('partials/keyboard-hint.html').trimEnd();

  // 先把全部页面渲染完，再统一落盘：
  // 任一页出现未替换的占位符就整体失败，不会留下半套产物
  const rendered = [];

  config.skins.forEach(skin => {
    config.pages.forEach(page => {
      const out = outputPath(skin, page);
      const text = i18n[page.lang];
      const sw = skinSwitch(config, skin, page, out);
      // 只有挂了背景脚本的主题才产出快捷键提示条，其余主题不输出这段 DOM
      const keyboardHint = hasBackgroundSwitch(skin)
        ? '\n' + render(hintPartial, text, {})
        : '';
      const html = render(pageTemplate, text, {
        faviconHref: hrefTo(out, 'favicon.ico'),
        imgBase: hrefTo(out, 'img') + '/',
        cssLinks: cssLinks(config, skin, out),
        scriptLinks: scriptLinks(config, skin, out),
        hreflangLinks: hreflangLinks(config, skin, i18n, out),
        langLinks: langLinks(config, skin, page.lang, out),
        keyboardHint: keyboardHint,
        skinHref: sw.href,
        skinTitle: sw.title,
        skinAria: fill(text.skinSwitchAria, sw.vars)
      });
      // 文案缺键时占位符会原样留在页面里，宁可失败也不产出坏页面
      const missing = html.match(/\{\{\w+\}\}/g);
      if (missing) {
        console.error(`❌ ${out} 存在未替换的占位符：${[...new Set(missing)].join(', ')}`);
        process.exit(1);
      }
      rendered.push({ out, html, lang: page.lang, skinId: skin.id });
    });
  });

  rendered.forEach(({ out, html, lang, skinId }) => {
    const outFile = path.join(ROOT_DIR, out);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf8');
    console.log(`   ✅ ${out}  [lang=${lang}, skin=${skinId}]`);
  });

  console.log(`\n✨ Build complete! Generated ${rendered.length} files.`);
}

main();
