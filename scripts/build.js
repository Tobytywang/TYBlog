#!/usr/bin/env node

/**
 * TYBlog 构建脚本
 * 功能：从单一模板和配置数据生成多主题、多语言的 HTML 文件
 * 用法：node scripts/build.js
 */

const fs = require('fs');
const path = require('path');

// ── 配置路径 ──────────────────────────────────
const SRC_DIR = path.join(__dirname, '..', 'src');
const ROOT_DIR = path.join(__dirname, '..');

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

// ── 简单字符串替换 ──────────────────────────────
function render(template, data, cssLinks, hreflangLinks, scriptLinks) {
  let result = template;
  
  // 替换动态生成的内容
  result = result.replace(/\{\{cssLinks\}\}/g, cssLinks);
  result = result.replace(/\{\{hreflangLinks\}\}/g, hreflangLinks);
  result = result.replace(/\{\{scriptLinks\}\}/g, scriptLinks);
  
  // 替换 i18n 数据占位符
  Object.keys(data).forEach(key => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, data[key]);
  });
  
  return result;
}

// ── 主函数 ──────────────────────────────────
function main() {
  console.log('🔨 Starting build...\n');
  
  // 加载配置
  const i18n = loadJSON('i18n.json');
  const themes = loadJSON('themes.json');
  const template = loadTemplate();
  
  let totalFiles = 0;
  
  // 遍历每个主题
  Object.keys(themes).forEach(themeKey => {
    const themeConfig = themes[themeKey];
    
    console.log(`📁 Theme: ${themeConfig.name} (${themeKey})`);
    
    // 生成 CSS 链接
    const cssLinks = generateCSSLinks(themeConfig.css);
    
    // 生成 Script 链接
    const scriptLinks = generateScriptLinks(themeConfig.scripts);
    
    // 生成 hreflang 标签
    const hreflangLinks = generateHreflang(themeConfig);
    
    // 遍历每种语言
    Object.keys(i18n).forEach(lang => {
      const langData = i18n[lang];
      const filename = themeConfig.output[lang];
      
      // 渲染模板
      const html = render(template, langData, cssLinks, hreflangLinks, scriptLinks);
      
      // 写入文件
      const outputPath = path.join(ROOT_DIR, filename);
      fs.writeFileSync(outputPath, html, 'utf8');
      
      console.log(`   ✅ ${filename}`);
      totalFiles++;
    });
    
    console.log('');
  });
  
  console.log(`\n✨ Build complete! Generated ${totalFiles} files.`);
}

// ── 执行 ──────────────────────────────────
main();