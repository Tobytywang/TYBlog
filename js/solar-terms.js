/**
 * 24 节气主题色检测系统
 * 基于简化版 NOAA 太阳位置算法，自动计算当前节气并应用对应主题色
 */

(function () {
  'use strict';

  const DEG2RAD = Math.PI / 180;
  const J1970 = 2440588;
  const J2000 = 2451545;

  // 节气按黄经升序排列，保证查找逻辑与数据顺序一致
  const SOLAR_TERMS = [
    { name: 'chunfen',     lng: 0,   cn: '春分' },
    { name: 'qingming',    lng: 15,  cn: '清明' },
    { name: 'guyu',        lng: 30,  cn: '谷雨' },
    { name: 'lixia',       lng: 45,  cn: '立夏' },
    { name: 'xiaoman',     lng: 60,  cn: '小满' },
    { name: 'mangzhong',   lng: 75,  cn: '芒种' },
    { name: 'xiazhi',      lng: 90,  cn: '夏至' },
    { name: 'xiaoshu',     lng: 105, cn: '小暑' },
    { name: 'dashu',       lng: 120, cn: '大暑' },
    { name: 'liqiu',       lng: 135, cn: '立秋' },
    { name: 'chushu',      lng: 150, cn: '处暑' },
    { name: 'bailu',       lng: 165, cn: '白露' },
    { name: 'qiufen',      lng: 180, cn: '秋分' },
    { name: 'hanlu',       lng: 195, cn: '寒露' },
    { name: 'shuangjiang', lng: 210, cn: '霜降' },
    { name: 'lidong',      lng: 225, cn: '立冬' },
    { name: 'xiaoxue',     lng: 240, cn: '小雪' },
    { name: 'daxue',       lng: 255, cn: '大雪' },
    { name: 'dongzhi',     lng: 270, cn: '冬至' },
    { name: 'xiaohan',     lng: 285, cn: '小寒' },
    { name: 'dahan',       lng: 300, cn: '大寒' },
    { name: 'lichun',      lng: 315, cn: '立春' },
    { name: 'yushui',      lng: 330, cn: '雨水' },
    { name: 'jingzhe',     lng: 345, cn: '惊蛰' }
  ];

  // 太阳黄经（0-360°）
  function getSunLongitude(date) {
    const jDate = date.getTime() / 86400000 + 0.5 + J1970;
    const n = jDate - J2000;
    const M = (357.5291 + 0.98560028 * n) * DEG2RAD;
    const C = (
      1.9148 * Math.sin(M) +
      0.0200 * Math.sin(2 * M) +
      0.0003 * Math.sin(3 * M)
    ) * DEG2RAD;
    const lambda = M + C + Math.PI + 102.9372 * DEG2RAD;
    const lng = (lambda / DEG2RAD) % 360;
    return lng < 0 ? lng + 360 : lng;
  }

  // 当前节气：黄经落在 [该节气起点, 下一节气起点) 区间
  function getCurrentSolarTerm(date = new Date()) {
    const sunLng = getSunLongitude(date);
    let current = SOLAR_TERMS[SOLAR_TERMS.length - 1]; // 默认惊蛰段（345°-360°）
    for (const term of SOLAR_TERMS) {
      if (sunLng >= term.lng) {
        current = term;
      } else {
        break;
      }
    }
    return current;
  }

  function applySolarTermTheme() {
    const root = document.documentElement;
    // 首帧不播放颜色过渡：设 data-theme 之前取的是 :root 的默认色，
    // 若让 .lang-link 的 transition 把它动画到节气色，用户每次加载都会看到
    // 一次「默认色 → 节气色」的 200ms 扫描。见 css/frame.css 的 .theme-boot。
    root.classList.add('theme-boot');
    document.body.setAttribute('data-theme', getCurrentSolarTerm().name);

    // 两帧之后恢复过渡：一帧不够，过渡可能在恢复的同一帧里被重新触发
    const unlock = () => root.classList.remove('theme-boot');
    requestAnimationFrame(() => requestAnimationFrame(unlock));
    // 兜底：后台标签页、无渲染环境（打印、预渲染、无头截图）里 rAF 可能一直不触发，
    // 这个类若留着，hover 过渡就永久失效。定时器到点无条件摘掉。
    setTimeout(unlock, 300);
  }

  applySolarTermTheme();
})();
