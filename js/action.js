(function() {
  // ── 设备尺寸判断 ──────────────────────────────
  function getSizeTier() {
    var w = window.innerWidth;
    if (w >= 1440) return 'desktop';
    if (w >= 768) return 'tablet';
    return 'mobile';
  }

  // ── WebP 支持检测（一次性） ───────────────────
  var supportsWebP = null;
  function checkWebP(callback) {
    if (supportsWebP !== null) { callback(supportsWebP); return; }
    var img = new Image();
    img.onload = function() { supportsWebP = (img.width > 0); callback(supportsWebP); };
    img.onerror = function() { supportsWebP = false; callback(false); };
    img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  }

  // ── 预加载图片 ────────────────────────────────
  function preloadImage(url) {
    var img = new Image();
    img.src = url;
  }

  // ── 设置背景图 ────────────────────────────────
  function setBackground(url) {
    document.body.style.backgroundImage = 'url(' + url + ')';
  }

  // ── 主逻辑 ────────────────────────────────────
  var IMG_BASE = 'img/';  // 图片目录前缀
  var imageList = [];
  var current = -1;
  var refresh = document.querySelector('.refresh');

  // 阻止 mousedown 默认行为，防止快速双击触发文字选中
  refresh.addEventListener('mousedown', function(e) {
    e.preventDefault();
  });

  // 获取当前尺寸下的图片 URL
  function getImageUrl(index) {
    var tier = getSizeTier();
    var item = imageList[index];
    if (!item) return null;
    var sizeInfo = item[tier];
    if (!sizeInfo) {
      // 当前档位无数据，尝试降级到更小档位
      var tiers = ['desktop', 'tablet', 'mobile'];
      for (var t = tiers.indexOf(tier) + 1; t < tiers.length; t++) {
        if (item[tiers[t]]) { sizeInfo = item[tiers[t]]; break; }
      }
    }
    if (!sizeInfo) return null;
    // 优先 WebP，不可用时回退 JPG
        return (supportsWebP && sizeInfo.webp) ? IMG_BASE + sizeInfo.webp : IMG_BASE + sizeInfo.jpg;
  }

  // 切换到下一张
  function switchBackground() {
    if (imageList.length === 0) return;
    current = (current + 1) % imageList.length;
    var url = getImageUrl(current);
    if (url) setBackground(url);
  }

  // 预加载相邻图片
  function preloadAdjacent() {
    if (imageList.length <= 1) return;
    var next = (current + 1) % imageList.length;
    var url = getImageUrl(next);
    if (url) preloadImage(url);
  }

  // 兜底背景图（file:// 协议下 fetch 失败时使用）
      var FALLBACK_IMAGES = [
        { desktop: { jpg: 'desktop/c8257951dc.jpg', webp: 'desktop/c8257951dc.webp' } },
        { desktop: { jpg: 'desktop/53557d0558.jpg', webp: 'desktop/53557d0558.webp' } },
      ];

  // 加载 manifest（兼容 file:// 协议）
  function loadManifest(onReady) {
    function handleData(data) {
      if (data && data.length) {
        for (var i = 0; i < data.length; i++) {
          imageList.push(data[i].sizes);
        }
      }
      // fetch 失败时用兜底列表
      if (imageList.length === 0 && FALLBACK_IMAGES.length > 0) {
        for (var j = 0; j < FALLBACK_IMAGES.length; j++) {
          imageList.push(FALLBACK_IMAGES[j]);
        }
      }
      onReady();
    }

    // 优先用 fetch
    if (window.fetch) {
      fetch(IMG_BASE + 'manifest.json')
        .then(function(r) { return r.json(); })
        .then(handleData)
        .catch(function() { handleData(null); });
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', IMG_BASE + 'manifest.json', true);
      xhr.responseType = 'json';
      xhr.onload = function() {
        handleData(xhr.status === 200 ? xhr.response : null);
      };
      xhr.onerror = function() { handleData(null); };
      xhr.send();
    }
  }

  // 初始化
  loadManifest(function() {
    checkWebP(function() {
      // 首张背景
      if (imageList.length > 0) {
        current = 0;
        var url = getImageUrl(0);
        if (url) setBackground(url);
        preloadAdjacent();
      }

      // 点击切换
      refresh.addEventListener('click', function() {
        switchBackground();
        preloadAdjacent();
      });
    });
  });

  // 窗口尺寸变化时，重新加载当前图片的合适尺寸
  var resizeTimer = null;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (current >= 0) {
        var url = getImageUrl(current);
        if (url) setBackground(url);
      }
    }, 300);
  });
})();
