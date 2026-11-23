/**
 * 语言偏好模块
 *
 * 语言内容由静态页面承载（各主题目录下的 index.html / index-en.html / index-fr.html），
 * 切换语言即导航到同主题目录内的对应页面，URL、<html lang>、hreflang 三者始终一致。
 * 本模块只做两件事：
 *   1. 记录用户显式选择的语言（localStorage）
 *   2. 再次打开默认中文页时，按已保存的偏好跳转（真正的持久化）
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'lang';

  // 点击语言链接时保存选择；href 为真实地址，无需 preventDefault
  document.querySelectorAll('.lang-link').forEach(function (link) {
    link.addEventListener('click', function () {
      try {
        localStorage.setItem(STORAGE_KEY, link.getAttribute('data-lang'));
      } catch (e) {
        // 隐私模式或 file:// 下 localStorage 可能不可用，忽略即可
      }
    });
  });

  // 仅在默认中文页生效；带 ?lang= 参数时视为显式指定，直接尊重
  var pageLang = (document.documentElement.lang || '').split('-')[0];
  var params = new URLSearchParams(window.location.search);
  if (pageLang !== 'zh' || params.has('lang')) {
    return;
  }

  var saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return;
  }
  if (!saved || saved === 'zh') {
    return;
  }

  var target = document.querySelector('.lang-link[data-lang="' + saved + '"]');
  if (!target || !target.getAttribute('href')) {
    return;
  }

  // replace 避免留下一次无意义的回退记录
  window.location.replace(target.getAttribute('href'));
})();
