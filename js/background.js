(function () {
  'use strict';

  // ── 视口档位 ──────────────────────────────────
  // 断点写在 css/frame.css 的 --tier（唯一事实来源），这里只读取，不重复定义数值
  const TIERS = ['desktop', 'tablet', 'mobile'];
  function getSizeTier() {
    const tier = getComputedStyle(document.documentElement)
      .getPropertyValue('--tier')
      .trim();
    return TIERS.indexOf(tier) === -1 ? 'desktop' : tier;
  }

  // ── WebP 支持检测 ─────────────────────────────
  let supportsWebP = false;
  function checkWebP(callback) {
    const img = new Image();
    img.onload = () => callback(img.width > 0);
    img.onerror = () => callback(false);
    img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  }

  // ── 预加载图片 ────────────────────────────────
  function preloadImage(url) {
    const img = new Image();
    img.src = url;
  }

  // ── 设置/清除背景图 ────────────────────────────
  function setBackground(url) {
    document.body.style.backgroundImage = url ? `url(${url})` : '';
  }

  // ── 主逻辑 ────────────────────────────────────
  // 页面位于 themes/<skin>/ 下，图片在站点根目录
  // 图片根目录由构建脚本按页面层级注入（根入口为 img/，主题页为 ../../img/）。
  // 这里不设硬编码默认值 —— 任何单一前缀都对其余层级的页面是错的。
  const IMG_BASE = document.documentElement.getAttribute('data-img-base');
  const imageList = [];
  let current = 0;
  let manifestReady = false;

  // 获取当前尺寸下的图片 URL（缺失档位时降级到更小档位）
  function getImageUrl(index) {
    const item = imageList[index];
    if (!item || !IMG_BASE) return null;

    const tier = getSizeTier();
    let sizeInfo = item[tier];
    if (!sizeInfo) {
      for (let t = TIERS.indexOf(tier) + 1; t < TIERS.length; t++) {
        if (item[TIERS[t]]) {
          sizeInfo = item[TIERS[t]];
          break;
        }
      }
    }
    if (!sizeInfo) return null;

    return supportsWebP && sizeInfo.webp
      ? IMG_BASE + sizeInfo.webp
      : IMG_BASE + sizeInfo.jpg;
  }

  // 清单来自 img/manifest.js（由 npm run images 生成、构建按主题能力注入）。
  // 不用 fetch：file:// 下会被浏览器拦截，而外链 script 不受此限制。
  function loadManifest() {
    const data = window.__BG_MANIFEST__;
    if (!Array.isArray(data)) return;
    data.forEach((item) => {
      if (item && item.sizes) imageList.push(item.sizes);
    });
  }

  // 本脚本仅由「现代」主题页加载，照片壁纸始终生效
  function applyBackground() {
    if (!manifestReady) return;
    const url = getImageUrl(current);
    if (url) setBackground(url);
  }

  function preloadAdjacent() {
    if (imageList.length <= 1) return;
    const url = getImageUrl((current + 1) % imageList.length);
    if (url) preloadImage(url);
  }

  // ── 键盘切换背景 ──────────────────────────────
  // 统一入口：更新索引 → 应用背景 → 预加载下一张
  function changeBackground(index) {
    current = index;
    applyBackground();
    preloadAdjacent();
  }

  // 相对切换（左右方向键），首尾环绕
  function stepBackground(delta) {
    if (imageList.length <= 1) return;
    changeBackground((current + delta + imageList.length) % imageList.length);
  }

  // 随机切换（R 键），尽量避开当前这张
  function randomBackground() {
    if (imageList.length <= 1) return;
    let next = current;
    while (next === current) {
      next = Math.floor(Math.random() * imageList.length);
    }
    changeBackground(next);
  }

  // 清单是同步就位的，空清单时直接退出，避免用 NaN 当下标去取图
  loadManifest();
  manifestReady = imageList.length > 0;
  if (!manifestReady) return;

  checkWebP((supported) => {
    supportsWebP = supported;
    current = Math.floor(Math.random() * imageList.length);
    applyBackground();
    preloadAdjacent();
  });

  // 窗口尺寸变化时，重新选用当前图片的合适尺寸
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyBackground, 300);
  });

  // ── 键盘快捷键 ────────────────────────────────
  // ← / → 顺序切换背景；R 随机切换
  // 本脚本仅由「现代」主题页加载，复古页不会注入这些监听
  function isEditable(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  window.addEventListener('keydown', (e) => {
    if (!manifestReady) return;
    // 让出浏览器/系统组合键（Ctrl+R 刷新、Alt+← 后退等）
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // 不在可编辑元素中劫持按键
    if (isEditable(e.target)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepBackground(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepBackground(1);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      randomBackground();
    }
  });
})();
