// src/themes.js — 同频 · 4 套主题配色
// 作用：D8 #2 背景装饰 + 用户自选。4 套 CSS 变量集，零图片依赖。
// 设计依据：PRD 增量 §6「明确不做」第 8 条（不做换肤系统）—— 本节只做 4 套预设切换，不做上传图片/自选字体。
// 用法：浏览器里 <script src="src/themes.js"></script> 引入，暴露到 window.TONGPING_THEMES。

(function () {
  // ===== 4 套主题（CSS 变量名 → 值）=====
  // 变量含义：
  //   --tp-bg         整页背景
  //   --tp-card       卡片背景
  //   --tp-text       主文字色
  //   --tp-text-soft  次要文字色（角标/日期/分割线）
  //   --tp-primary    主色（按钮/分数/角标）
  //   --tp-primary-soft  主色淡化背景（hover/二级）
  //   --tp-border     卡片边框
  //   --tp-accent     顶部装饰条颜色
  const THEMES = {
    // a. 同频蓝紫（默认）：温和、聚焦
    'default': {
      label: '默认 CN',
      '--tp-bg': '#f5f6fa',
      '--tp-card': '#ffffff',
      '--tp-text': '#2c3e50',
      '--tp-text-soft': '#888',
      '--tp-primary': '#5b6cdb',
      '--tp-primary-soft': '#f0f2fa',
      '--tp-border': '#e8eaf2',
      '--tp-accent': '#5b6cdb',
    },
    // b. 暖橙晨光：温暖、有活力
    'warm': {
      label: '暖橙',
      '--tp-bg': '#faf6f0',
      '--tp-card': '#fffaf3',
      '--tp-text': '#3d2e1f',
      '--tp-text-soft': '#a08868',
      '--tp-primary': '#e8865e',
      '--tp-primary-soft': '#fbece0',
      '--tp-border': '#f0e2cf',
      '--tp-accent': '#e8865e',
    },
    // c. 极简白：干净、克制
    'minimal': {
      label: '极简',
      '--tp-bg': '#ffffff',
      '--tp-card': '#ffffff',
      '--tp-text': '#222222',
      '--tp-text-soft': '#999999',
      '--tp-primary': '#222222',
      '--tp-primary-soft': '#f5f5f5',
      '--tp-border': '#e5e5e5',
      '--tp-accent': '#222222',
    },
    // d. 星空深：沉浸、专注
    'dark': {
      label: '星空',
      '--tp-bg': '#1a1b2e',
      '--tp-card': '#252640',
      '--tp-text': '#e8e8f0',
      '--tp-text-soft': '#8888aa',
      '--tp-primary': '#7c6fe6',
      '--tp-primary-soft': '#2d2f4d',
      '--tp-border': '#363859',
      '--tp-accent': '#7c6fe6',
    },
  };

  // ===== 应用主题到 <html> 元素的 data-theme 属性 =====
  // CSS 里 [data-theme="dark"] { --tp-bg: #1a1b2e; ... } 形式覆盖
  function applyTheme(name) {
    if (!THEMES[name]) name = 'default';
    document.documentElement.setAttribute('data-theme', name);
  }

  // ===== 暴露 =====
  window.TONGPING_THEMES = {
    THEMES: THEMES,
    applyTheme: applyTheme,
  };
})();