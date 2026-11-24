/**
 * 语言偏好模块
 *
 * 语言内容由静态页面承载（各主题目录下的 index.html / index-en.html / index-fr.html），
 * 切换语言即导航到同主题目录内的对应页面，URL、<html lang>、hreflang 三者始终一致。
 * 本模块只做两件事：
 *   1. 记住当前页面的语言（localStorage）—— 页面本身就是偏好的事实来源，
 *      所以从书签或外链直接打开英文页同样会被记住，无需监听点击
 *   2. 再次打开默认中文页时，按已保存的偏好跳转
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'lang';

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // 隐私模式或 file:// 下 localStorage 可能不可用
      return null;
    }
  }

  function remember(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // 同上，存不了就算了
    }
  }

  // 当前语言取自导航里高亮的那一项（构建期按 page.lang 标记），
  // 不再切割 <html lang> —— 那等于假设 htmlLang 恒为「语言-地区」两段
  var active = document.querySelector('.lang-link.active');
  var pageLang = active ? active.getAttribute('data-lang') : '';
  if (!pageLang) return;

  // 只在默认中文页做跳转判断。判断必须在写入之前：先写就把访客原本的选择覆盖成 zh 了
  if (pageLang === 'zh') {
    var saved = readPreference();
    if (saved && saved !== 'zh') {
      // 不拼属性选择器：localStorage 里的值不受本页控制（file:// 下同源共享，
      // 别的本地页面写什么都有可能）。值里带引号时 querySelector 会抛 SyntaxError，
      // 整个模块就此中断 —— 跳转和 remember() 都不会执行。逐个比对更稳。
      var target = null;
      var links = document.querySelectorAll('.lang-link[data-lang]');
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute('data-lang') === saved) {
          target = links[i];
          break;
        }
      }
      if (target && target.getAttribute('href')) {
        // replace 避免留下一次无意义的回退记录
        window.location.replace(target.getAttribute('href'));
        return;
      }
    }
  }

  remember(pageLang);
})();
