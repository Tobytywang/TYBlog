/**
 * 国际化模块 - 语言检测与切换
 * 支持：中文(zh)、英文(en)、法文(fr)
 */

(function() {
  // ── 语言数据 ──────────────────────────────────
  var I18N = {
    'zh': {
      title: '日常生活记录',
      motto: '读万卷书，行万里路',
      cnblogs: '博客园',
      blog: '博客',
      htmlLang: 'zh-CN'
    },
    'en': {
      title: 'Daily Life Journal',
      motto: 'Read ten thousand books, travel ten thousand miles',
      cnblogs: 'Cnblogs',
      blog: 'Blog',
      htmlLang: 'en'
    },
    'fr': {
      title: 'Journal de Vie Quotidienne',
      motto: 'Lire dix mille livres, parcourir dix mille lieues',
      cnblogs: 'Cnblogs',
      blog: 'Blog',
      htmlLang: 'fr'
    }
  };

  var currentLang = 'zh';

  // ── 语言检测 ──────────────────────────────────
  function detectLanguage() {
    // 1. URL参数优先
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    if (urlLang && I18N[urlLang]) return urlLang;

    // 2. 页面语言属性（尊重静态HTML的语言）
    var htmlLang = document.documentElement.lang;
    if (htmlLang) {
      var pageLang = htmlLang.split('-')[0];
      if (I18N[pageLang]) return pageLang;
    }

    // 3. 浏览器语言
    var browserLang = navigator.language || navigator.languages[0];
    var langCode = browserLang.split('-')[0];
    if (I18N[langCode]) return langCode;

    // 4. 默认中文
    return 'zh';
  }

  // ── 应用语言 ──────────────────────────────────
  function applyLanguage(lang) {
    var data = I18N[lang];
    if (!data) return;

    currentLang = lang;

    // 更新页面元素
    document.documentElement.lang = data.htmlLang;
    document.title = data.title;
    
    var header = document.querySelector('.card .header p');
    if (header) header.textContent = data.title;
    
    var motto = document.querySelector('.card .content p');
    if (motto) motto.textContent = data.motto;

    // 更新链接文案
    var links = document.querySelectorAll('.blog-link');
    if (links[0]) links[0].innerHTML = '<span class="dot">·</span>' + data.cnblogs;
    if (links[1]) links[1].innerHTML = '<span class="dot">·</span>' + data.blog;

    // 更新语言导航高亮
    document.querySelectorAll('.lang-link').forEach(function(link) {
      link.classList.toggle('active', link.getAttribute('data-lang') === lang);
    });

    // 保存选择
    localStorage.setItem('lang', lang);
  }

  // ── 切换语言 ──────────────────────────────────
  function switchLanguage(lang) {
    applyLanguage(lang);
    // 更新URL（不刷新页面）
    var url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.pushState({}, '', url);
  }

  // ── 绑定事件 ──────────────────────────────────
  function bindEvents() {
    document.querySelectorAll('.lang-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var lang = this.getAttribute('data-lang');
        switchLanguage(lang);
      });
    });
  }

  // ── 初始化 ──────────────────────────────────
  function init() {
    var lang = detectLanguage();
    applyLanguage(lang);
    bindEvents();
  }

  // 立即执行（避免闪烁）
  init();

  // 暴露接口
  window.i18n = {
    detect: detectLanguage,
    apply: applyLanguage,
    switch: switchLanguage,
    getCurrent: function() { return currentLang; }
  };
})();