/**
 * 主题切换模块（CSS Zen Garden 模式）
 *
 * 同一份 HTML 携带多套视觉样式表，本模块只做三件事：
 *   1. 按 localStorage 中的偏好激活对应样式表（link.disabled 开关）
 *   2. 点击按钮循环切换到下一个主题，并保存选择
 *   3. 派发 skinchange 事件，让背景等逻辑随主题联动
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'skin';
  var links = Array.prototype.slice.call(document.querySelectorAll('link[data-skin]'));
  var button = document.querySelector('.skin-switcher');

  if (links.length === 0) return;

  // 按页面语言取本地化标签（<html lang="zh-CN"> → data-skin-label-zh）
  var rawLang = document.documentElement.getAttribute('lang') || 'zh';
  var langKey = rawLang.split('-')[0];
  if (['zh', 'en', 'fr'].indexOf(langKey) < 0) langKey = 'zh';

  // 主题元数据从 <link> 的 data-* 读取，避免与构建配置重复
  function skinOf(link) {
    return {
      id: link.getAttribute('data-skin'),
      label: link.getAttribute('data-skin-label-' + langKey) || link.getAttribute('data-skin'),
      link: link
    };
  }
  var skins = links.map(skinOf);

  function getActiveIndex() {
    for (var i = 0; i < skins.length; i++) {
      if (!skins[i].link.disabled) return i;
    }
    return -1;
  }

  function readSaved() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function save(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      // 隐私模式或 file:// 下不可用时忽略
    }
  }

  function updateButton() {
    if (!button) return;
    var idx = getActiveIndex();
    if (idx < 0) return;
    var current = skins[idx];
    var next = skins[(idx + 1) % skins.length];
    button.setAttribute('title', '当前：' + current.label + ' · 点击切换到「' + next.label + '」');
    button.setAttribute('aria-label', '切换主题，当前为' + current.label + '，点击切换到' + next.label);
  }

  function apply(id, persist) {
    var target = -1;
    for (var i = 0; i < skins.length; i++) {
      if (skins[i].id === id) { target = i; break; }
    }
    if (target < 0) return;

    skins.forEach(function (skin) {
      skin.link.disabled = skin.id !== id;
    });
    document.documentElement.setAttribute('data-skin', id);

    if (persist) save(id);
    updateButton();

    window.dispatchEvent(new CustomEvent('skinchange', { detail: { skin: id, label: skins[target].label } }));
  }

  function switchNext() {
    var next = (getActiveIndex() + 1) % skins.length;
    apply(skins[next].id, true);
  }

  // 初始化：
  // - 主页面（data-primary=true）尊重 localStorage 偏好，实现主题跨语言记忆
  // - 复古直达页（index-retro*.html）强制使用其入口皮肤，保持旧链接语义
  var isPrimary = document.body.getAttribute('data-primary') === 'true';
  var entrySkin = document.body.getAttribute('data-entry-skin');
  var saved = readSaved();
  var hasSaved = skins.some(function (skin) { return skin.id === saved; });

  if (isPrimary && hasSaved) {
    apply(saved, false);
  } else {
    // HTML 中默认激活的皮肤即为入口皮肤
    var current = skins[getActiveIndex()] || skins[0];
    document.documentElement.setAttribute('data-skin', current.id);
    updateButton();
  }

  if (button) {
    button.addEventListener('mousedown', function (e) { e.preventDefault(); });
    button.addEventListener('click', switchNext);
    button.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchNext();
      }
    });
  }
})();
