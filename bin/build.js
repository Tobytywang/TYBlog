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
  STATIC_OUTPUTS,
  loadConfig,
  outputPath,
  defaultSkin,
  defaultPage,
  canonicalPath,
  absoluteUrl,
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

// ── i18n 键：脚本直接读取的那部分 ────────────────
// template.html 里的 {{key}} 由 render() 补：缺键时占位符留在页面上，会被
// 后面的「未替换占位符」检查抓住，报错能指出漏了哪个键。但脚本自己读的键
// （如 text.skinSwitchAria）不经过 render()，缺了会在 fill() 里对 undefined
// 调 replace，抛一个看不出根因的 TypeError。这里提前挡一道。
const DIRECT_I18N_KEYS = ['skinSwitchAria'];

function checkDirectI18nKeys(config, i18n) {
  const errors = [];
  config.pages.forEach(page => {
    const text = i18n[page.lang] || {};
    DIRECT_I18N_KEYS.forEach(key => {
      if (!text[key]) {
        errors.push(`语言 ${page.lang} 缺少 i18n 键 ${key}（构建脚本直接读取，缺了会抛 TypeError）`);
      }
    });
  });
  return errors;
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
// aria-current="page" 让读屏器知道当前停在哪种语言上，不靠 .active 的视觉样式传达状态
function langLinks(config, skin, currentLang, out) {
  return config.pages.map(page => {
    const cls = page.lang === currentLang ? 'lang-link active' : 'lang-link';
    const current = page.lang === currentLang ? ' aria-current="page"' : '';
    return `        <a href="${pageUrl(out, skin, page)}" class="${cls}"${current} data-lang="${page.lang}">${page.label}</a>`;
  }).join('\n');
}

// hreflang 直接复用 i18n.json 的 htmlLang，与 <html lang> 同源。
// 地址必须是绝对 URL（相对路径不算合规的 hreflang），域名只从 site.baseUrl 出。
// 目标页取 canonicalPath：非默认主题的页面已被 canonical 归并到默认主题，
// hreflang 若还指向自己那一套，就会与 canonical 互相矛盾。
function hreflangLinks(config, skin, i18n) {
  const fallback = defaultPage(config);
  const lines = config.pages.map(page =>
    `    <link rel="alternate" hreflang="${i18n[page.lang].htmlLang}" href="${absoluteUrl(config, canonicalPath(config, skin, page))}">`
  );
  lines.push(`    <link rel="alternate" hreflang="x-default" href="${absoluteUrl(config, canonicalPath(config, skin, fallback))}">`);
  return lines.join('\n');
}

// ── 站点级文件 ──────────────────────────────────
// 只收录默认主题的页面：非默认主题靠 canonical 归并，重复收录只会分散权重。
// 地址一律走 canonicalPath —— 与 hreflangLinks 同一个函数，不是两份碰巧算出
// 相同结果的表达式。canonical 策略一变，两边必须一起变，否则 sitemap 的 <loc>
// 会与页面自称的 canonical 对不上。
function sitemap(config, i18n) {
  const def = defaultSkin(config);
  const xDefault = absoluteUrl(config, canonicalPath(config, def, defaultPage(config)));

  // 每个 <url> 的 alternate 集合完全相同（与当前 <loc> 无关），循环外算一次
  const alts = config.pages.map(p =>
    `    <xhtml:link rel="alternate" hreflang="${i18n[p.lang].htmlLang}" href="${absoluteUrl(config, canonicalPath(config, def, p))}"/>`
  );
  alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>`);

  const urls = config.pages.map(page => [
    '  <url>',
    `    <loc>${absoluteUrl(config, canonicalPath(config, def, page))}</loc>`,
    ...alts,
    '  </url>'
  ].join('\n'));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls.join('\n') +
    '\n</urlset>\n';
}

function robots(config) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(config, 'sitemap.xml')}\n`;
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

  // 脚本直接读的键缺失时，报错要能指出语言与键名，而不是抛 undefined.replace
  const i18nErrors = checkDirectI18nKeys(config, i18n);
  if (i18nErrors.length) {
    console.error('❌ i18n 校验未通过：');
    i18nErrors.forEach(e => console.error(`   · ${e}`));
    process.exit(1);
  }
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
        // 图标与 favicon 同源处理：都在 img/ 下，路径按页面层级算，模板不手写 ../../
        appleTouchIconHref: hrefTo(out, config.site.appleTouchIcon),
        themeColor: skin.themeColor,
        imgBase: hrefTo(out, 'img') + '/',
        canonicalUrl: absoluteUrl(config, canonicalPath(config, skin, page)),
        ogImageUrl: absoluteUrl(config, config.site.ogImage),
        cssLinks: cssLinks(config, skin, out),
        scriptLinks: scriptLinks(config, skin, out),
        hreflangLinks: hreflangLinks(config, skin, i18n),
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

  // 站点级文件：内容全部由 site.baseUrl 推出，换域名只需改配置再重建
  const statics = {
    'sitemap.xml': sitemap(config, i18n),
    'robots.txt': robots(config)
  };
  STATIC_OUTPUTS.forEach(name => {
    if (typeof statics[name] !== 'string') {
      console.error(`❌ 静态产物 ${name} 没有对应的生成逻辑（见 bin/build.js 的 statics）`);
      process.exit(1);
    }
    fs.writeFileSync(path.join(ROOT_DIR, name), statics[name], 'utf8');
    console.log(`   ✅ ${name}`);
  });

  console.log(`\n✨ Build complete! Generated ${rendered.length + STATIC_OUTPUTS.length} files.`);
}

main();
