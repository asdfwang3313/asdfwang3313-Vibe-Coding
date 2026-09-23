/* 同频 · 背景图案（D8 #2 扩展）
 *
 * 4 套内置 SVG 图案：
 *   none  - 无图案
 *   dots  - 点阵
 *   waves - 柔和波浪线
 *   hex   - 六边形蜂窝
 *
 * 实现说明：
 *   启动时自动往 <head> 注入一个 <style> 标签，
 *   生成 [data-pattern="xxx"] 的 CSS 规则，
 *   单一数据源：改图案只改这个文件，不用同步 CSS。
 *
 *   SVG 用 mask 模式渲染：颜色继承 --tp-primary（跟主题主色走）
 */

(function () {
  // 用 16 进制转义 %23 等，避免编码麻烦；这里直接 URL 编码
  function svg(s) {
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(s) + '")';
  }

  const PATTERNS = [
    { id: 'none',  name: '无图案', size: '0 0', svg: 'none' },
    {
      id: 'dots', name: '点阵', size: '40px 40px',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
           '<circle cx="20" cy="20" r="1.5" fill="black"/>' +
           '<circle cx="0"  cy="0"  r="1"   fill="black"/>' +
           '<circle cx="40" cy="0"  r="1"   fill="black"/>' +
           '<circle cx="0"  cy="40" r="1"   fill="black"/>' +
           '<circle cx="40" cy="40" r="1"   fill="black"/>' +
           '</svg>',
    },
    {
      id: 'waves', name: '波浪', size: '120px 40px',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">' +
           '<path d="M0,20 Q30,5 60,20 T120,20" stroke="black" stroke-width="1.2" fill="none"/>' +
           '<path d="M0,30 Q30,15 60,30 T120,30" stroke="black" stroke-width="1.2" fill="none"/>' +
           '</svg>',
    },
    {
      id: 'hex', name: '蜂窝', size: '56px 48px',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="48" viewBox="0 0 56 48">' +
           '<g stroke="black" stroke-width="1" fill="none">' +
           '<polygon points="14,2 26,2 32,12 26,22 14,22 8,12"/>' +
           '<polygon points="42,2 54,2 60,12 54,22 42,22 36,12"/>' +
           '<polygon points="0,26 12,26 18,36 12,46 0,46 -6,36"/>' +
           '<polygon points="28,26 40,26 46,36 40,46 28,46 22,36"/>' +
           '<polygon points="56,26 68,26 74,36 68,46 56,46 50,36"/>' +
           '</g></svg>',
    },
  ];

  // 启动时注入 [data-pattern] 的 CSS 规则
  function injectStyles() {
    let css = '';
    PATTERNS.forEach(function (p) {
      const svgVal = p.svg === 'none' ? 'none' : svg(p.svg);
      css += '[data-pattern="' + p.id + '"]{' +
             '--tp-pattern-svg:' + svgVal + ';' +
             '--tp-pattern-size:' + p.size + ';' +
             '}\n';
    });
    const styleEl = document.createElement('style');
    styleEl.id = 'tonping-pattern-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // 立即执行（IIFE 启动时）
  if (document && document.head) {
    injectStyles();
  } else {
    // 极端情况下 DOM 未就绪，等一下
    document.addEventListener('DOMContentLoaded', injectStyles);
  }

  // 暴露 LIST 给 JS（菜单渲染用）
  window.TONGPING_PATTERNS = {
    LIST: PATTERNS.map(function (p) {
      return { id: p.id, name: p.name }; // 不暴露 svg 字符串，省内存
    }),
  };
})();