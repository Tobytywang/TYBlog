/**
 * 入口页跳转
 *
 * 根目录 index.html 是主题选择门面。有明确主题偏好时直接跳到对应主题页；
 * 首次访问或偏好不可用时保留门面，让用户自行选择主题（无 JS 时链接同样可用）。
 */

(function () {
  'use strict';

  var SKINS = ['modern', 'retro'];
  var LANGS = ['zh', 'en', 'fr'];
  var SUFFIX = { zh: '', en: '-en', fr: '-fr' };

  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  // 语言：显式保存的偏好优先，其次浏览器语言，最后中文
  function pickLang() {
    var saved = read('lang');
    if (LANGS.indexOf(saved) >= 0) return saved;

    var nav = (navigator.language || '').slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) >= 0 ? nav : 'zh';
  }

  var skin = read('skin');
  if (SKINS.indexOf(skin) < 0) return; // 无偏好 → 停留在门面页

  var lang = pickLang();
  var target = 'themes/' + skin + '/index' + SUFFIX[lang] + '.html';
  window.location.replace(target);
})();
