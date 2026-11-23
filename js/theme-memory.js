/**
 * 主题记忆模块
 *
 * 主题现在是独立页面（themes/<skin>/），切换由 <a class="skin-switcher"> 跳转完成。
 * 本模块只做两件事：
 *   1. 页面加载时把当前主题写入 localStorage，供入口页自动跳转使用
 *   2. 点击主题切换链接时写入目标主题，让跳转后的页面立即成为新偏好
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'skin';
  var currentSkin = document.documentElement.getAttribute('data-skin');
  var switcher = document.querySelector('.skin-switcher');

  function save(skin) {
    if (!skin) return;
    try {
      localStorage.setItem(STORAGE_KEY, skin);
    } catch (e) {
      // 隐私模式或 file:// 下 localStorage 可能不可用，忽略即可
    }
  }

  // 记录当前主题：直接进入任一主题页也应成为偏好
  save(currentSkin);

  // 点击切换链接时预写目标主题（href 为真实地址，无需 preventDefault）
  if (switcher) {
    switcher.addEventListener('click', function () {
      save(switcher.getAttribute('data-skin-target'));
    });
  }
})();
