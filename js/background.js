(function () {
  'use strict';

  // ── 设备尺寸判断 ──────────────────────────────
  function getSizeTier() {
    const w = window.innerWidth;
    if (w >= 1440) return 'desktop';
    if (w >= 768) return 'tablet';
    return 'mobile';
  }

  // ── WebP 支持检测（一次性） ───────────────────
  let supportsWebP = null;
  function checkWebP(callback) {
    if (supportsWebP !== null) {
      callback(supportsWebP);
      return;
    }
    const img = new Image();
    img.onload = () => {
      supportsWebP = img.width > 0;
      callback(supportsWebP);
    };
    img.onerror = () => {
      supportsWebP = false;
      callback(false);
    };
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
  const IMG_BASE = 'img/';
  const TIERS = ['desktop', 'tablet', 'mobile'];
  const PHOTO_SKIN = 'modern';
  const imageList = [];
  let current = 0;
  let manifestReady = false;

  // 获取当前尺寸下的图片 URL（缺失档位时降级到更小档位）
  function getImageUrl(index) {
    const item = imageList[index];
    if (!item) return null;

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

  // 兜底背景图（file:// 协议下 fetch 失败时使用，由 process_images.py 同步）
  const FALLBACK_IMAGES = [
    { desktop: { jpg: 'desktop/c8257951dc.jpg', webp: 'desktop/c8257951dc.webp' } },
    { desktop: { jpg: 'desktop/53557d0558.jpg', webp: 'desktop/53557d0558.webp' } },
    { desktop: { jpg: 'desktop/648224f07d.jpg', webp: 'desktop/648224f07d.webp' } },
    { desktop: { jpg: 'desktop/2a930d7506.jpg', webp: 'desktop/2a930d7506.webp' } }
  ];

  function loadManifest(onReady) {
    function handleData(data) {
      if (data && data.length) {
        data.forEach((item) => imageList.push(item.sizes));
      }
      if (imageList.length === 0) {
        imageList.push(...FALLBACK_IMAGES);
      }
      onReady();
    }

    if (window.fetch) {
      fetch(IMG_BASE + 'manifest.json')
        .then((r) => r.json())
        .then(handleData)
        .catch(() => handleData(null));
    } else {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', IMG_BASE + 'manifest.json', true);
      xhr.responseType = 'json';
      xhr.onload = () => handleData(xhr.status === 200 ? xhr.response : null);
      xhr.onerror = () => handleData(null);
      xhr.send();
    }
  }

  function activeSkin() {
    return document.documentElement.getAttribute('data-skin') || PHOTO_SKIN;
  }

  // 照片壁纸只属于「现代」皮肤；其它皮肤清除内联背景，让 CSS 纹理生效
  function applyBackground() {
    if (!manifestReady) return;
    if (activeSkin() !== PHOTO_SKIN) {
      setBackground(null);
      return;
    }
    const url = getImageUrl(current);
    if (url) setBackground(url);
  }

  function preloadAdjacent() {
    if (imageList.length <= 1) return;
    const url = getImageUrl((current + 1) % imageList.length);
    if (url) preloadImage(url);
  }

  loadManifest(() => {
    manifestReady = true;
    checkWebP((supported) => {
      supportsWebP = supported;
      current = Math.floor(Math.random() * imageList.length);
      applyBackground();
      preloadAdjacent();
    });
  });

  // 主题切换时联动背景：进入现代皮肤恢复壁纸，离开则清除
  window.addEventListener('skinchange', applyBackground);

  // 窗口尺寸变化时，重新选用当前图片的合适尺寸
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyBackground, 300);
  });
})();
