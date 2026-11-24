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

// 由构建生成、但不属于「页面」的产物（clean 也要清）
const STATIC_OUTPUTS = ['robots.txt', 'sitemap.xml'];

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

function defaultSkin(config) {
  return config.skins.find(s => s.default === true);
}

// 非默认主题的页面只是同一内容的另一套装扮，canonical 一律指向默认主题的
// 同一语言页 —— 否则 /index.html 与 /themes/retro/index.html 会被当成两份
// 同内容页面各索引一次。默认主题的页面 canonical 指向自己。
function canonicalPath(config, skin, page) {
  const def = defaultSkin(config);
  return outputPath(def && def.id !== skin.id ? def : skin, page);
}

// ── 绝对地址 ────────────────────────────────────
// canonical / hreflang / sitemap / og 都要求绝对 URL，域名只在 site.baseUrl 出现一次
function absoluteUrl(config, relPath) {
  const base = (config.site && config.site.baseUrl ? config.site.baseUrl : '').replace(/\/+$/, '');
  return `${base}/${relPath.replace(/^\/+/, '')}`;
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

// ── 主题能力 ────────────────────────────────────
// 「能不能切背景」由 scripts 里有没有挂背景脚本决定，不另设配置项 ——
// 挂了脚本的主题才输出键盘提示条，避免出现「有 DOM 没功能」的死节点。
const BACKGROUND_SCRIPT = 'js/background.js';

// 背景清单：由 npm run images 生成，页面唯一的图片数据源
// （file:// 下 fetch 会被拦截，外链 script 不受此限制）
const BG_MANIFEST_SCRIPT = 'img/manifest.js';

function hasBackgroundSwitch(skin) {
  return (skin.scripts || []).includes(BACKGROUND_SCRIPT);
}

// ── 页面脚本清单 ────────────────────────────────
// 顺序即执行顺序：清单必须在 background.js 之前就位
function pageScripts(config, skin) {
  const files = (config.sharedScripts || []).slice();
  if (hasBackgroundSwitch(skin)) files.push(BG_MANIFEST_SCRIPT);
  return files.concat(skin.scripts || []);
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

  // 站点配置：域名与分享图缺失会产出坏 canonical / 404 的 og:image，
  // 这两个错在页面上看不出来，只能在这里挡
  const site = config.site || {};
  if (!site.baseUrl) {
    errors.push('缺少 site.baseUrl（canonical / hreflang / sitemap 需要绝对地址）');
  } else if (!/^https?:\/\/[^/]+$/.test(site.baseUrl)) {
    errors.push(`site.baseUrl 只能是 http(s)://主机名，不能带路径或末尾斜杠：${site.baseUrl}`);
  }
  if (!site.ogImage) {
    errors.push('缺少 site.ogImage（分享卡片图的站内相对路径）');
  } else if (!fs.existsSync(path.join(ROOT_DIR, site.ogImage))) {
    errors.push(`site.ogImage 指向的文件不存在：${site.ogImage}`);
  }

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

  // 引用的资源文件必须存在：路径写错只会让页面静默 404，控制台之外看不见
  const refs = new Set([...(config.sharedCss || []), ...(config.sharedScripts || [])]);
  config.skins.forEach(skin => (skin.scripts || []).forEach(s => refs.add(s)));
  refs.forEach(ref => {
    if (!fs.existsSync(path.join(ROOT_DIR, ref))) {
      errors.push(`引用的文件不存在：${ref}`);
    }
  });

  // 背景清单与 manifest.json 必须同步：清单缺项时页面照样能跑，只是少几张图，
  // 不检查就只能靠肉眼看出来
  if (config.skins.some(hasBackgroundSwitch)) {
    const jsPath = path.join(ROOT_DIR, BG_MANIFEST_SCRIPT);
    const jsonPath = path.join(ROOT_DIR, 'img', 'manifest.json');
    if (!fs.existsSync(jsPath)) {
      errors.push(`缺少 ${BG_MANIFEST_SCRIPT}，请先运行 npm run images`);
    } else if (fs.existsSync(jsonPath)) {
      let ids = [];
      try {
        ids = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).map(item => item.id);
      } catch (err) {
        errors.push(`img/manifest.json 无法解析：${err.message}`);
      }
      const js = fs.readFileSync(jsPath, 'utf8');
      const missing = ids.filter(id => !js.includes(`"${id}"`));
      if (missing.length) {
        errors.push(
          `${BG_MANIFEST_SCRIPT} 比 manifest.json 少 ${missing.length} 项` +
          `（${missing.slice(0, 3).join(', ')}），请重跑 npm run images`
        );
      }
    }
  }

  return errors;
}

module.exports = {
  ROOT_DIR,
  SRC_DIR,
  STATIC_OUTPUTS,
  loadConfig,
  outputPath,
  defaultSkin,
  canonicalPath,
  absoluteUrl,
  pageUrl,
  allOutputPaths,
  nextSkin,
  hasBackgroundSwitch,
  pageScripts,
  hrefTo,
  validate
};
