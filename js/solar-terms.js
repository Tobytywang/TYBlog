/**
 * 24节气主题色检测系统
 * 基于简化版 NOAA 太阳位置算法
 * 自动计算当前节气并应用对应主题色
 */

(function() {
  // ── 常量定义 ──────────────────────────────────
  var DEG2RAD = Math.PI / 180;
  var J1970 = 2440588;
  var J2000 = 2451545;

  // ── 24节气定义（名称 + 对应黄经角度） ──────────
  var SOLAR_TERMS = [
    { name: 'lichun',      lng: 315, cn: '立春' },
    { name: 'yushui',      lng: 330, cn: '雨水' },
    { name: 'jingzhe',     lng: 345, cn: '惊蛰' },
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
    { name: 'dahan',       lng: 300, cn: '大寒' }
  ];

  // ── 太阳黄经计算 ────────────────────────────────
  function getSunLongitude(date) {
    // 转换为儒略日
    var jDate = date.getTime() / 86400000 + 0.5 + J1970;
    var n = jDate - J2000;
    
    // 太阳平近点角（弧度）
    var M = (357.5291 + 0.98560028 * n) * DEG2RAD;
    
    // 中心方程（弧度）
    var C = (1.9148 * Math.sin(M) + 
             0.0200 * Math.sin(2 * M) + 
             0.0003 * Math.sin(3 * M)) * DEG2RAD;
    
    // 黄经（弧度）
    var lambda = M + C + Math.PI + 102.9372 * DEG2RAD;
    
    // 转换为 0-360°
    var lng = (lambda / DEG2RAD) % 360;
    if (lng < 0) lng += 360;
    
    return lng;
  }

  // ── 获取当前节气 ────────────────────────────────
  function getCurrentSolarTerm() {
    var now = new Date();
    var sunLng = getSunLongitude(now);
    
    // 从后往前查找，找到第一个 <= 当前黄经的节气
    for (var i = SOLAR_TERMS.length - 1; i >= 0; i--) {
      if (sunLng >= SOLAR_TERMS[i].lng) {
        return SOLAR_TERMS[i];
      }
    }
    
    // 如果 < 立春（315°），说明在大寒区间
    return SOLAR_TERMS[SOLAR_TERMS.length - 1];
  }

  // ── 应用节气主题 ────────────────────────────────
  function applySolarTermTheme() {
    var term = getCurrentSolarTerm();
    document.body.setAttribute('data-theme', term.name);
  }

  // ── 初始化 ──────────────────────────────────────
  applySolarTermTheme();

  // 暴露接口（可选）
  window.solarTerms = {
    getCurrent: getCurrentSolarTerm,
    applyTheme: applySolarTermTheme,
    terms: SOLAR_TERMS
  };
})();