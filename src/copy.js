// src/copy.js — 同频 · 文案库
// 作用：F1 浏览器通知的素材库。
// 设计依据：PRD 6.2（8 条混合调性）+ 5.1（按"完成度 + 上次打分"两个信号触发）。
// 用法：浏览器里 <script src="src/copy.js"></script> 引入，暴露到 window.TONGPING_COPY。

(function () {
  // ===== 提醒频率配置 =====
  // PRD 6.2：hardcode 在 src/copy.js 的 schedule 字段；用户自定义频率留到 Day 8+
  const SCHEDULE = {
    intervalMinutes: 60,    // 每小时一次（整点）
    startHour: 9,           // 9 点开始
    endHour: 21,            // 21 点结束
    firstDelaySeconds: 30,  // 页面打开 30 秒后发第一次（让用户先看一眼界面）
  };

  // ===== 23:00 设任务提醒配置（D8 #3）=====
  // 设计依据：PRD 增量 §3 业务流程 + §8.3 调度器升级
  // 触发条件：每天 23:00 ~ 23:30 之间，页面在前台时检查一次是否到点
  const SETUP_SCHEDULE = {
    triggerHour: 23,         // 23:00 开始提醒
    lastCallMinute: 30,      // 23:30 截止（再不设今晚就过 0 点了）
    oncePerDay: true,        // 每天只发一次（用 localStorage 标记）
  };

  // ===== 设任务文案：2 条（理性 1 + 通用 1）=====
  // 为什么只有 2 条：场景单一（"该设任务了"），文案不必多
  const SETUP_COPY = [
    '23:00 了，明天打算做哪几件事？点我去设。',
    '23:30 之前设完明天的任务清单，从今晚开始规划。',
  ];

  // ===== 拍一条设任务文案 =====
  function pickSetupCopy() {
    return SETUP_COPY[Math.floor(Math.random() * SETUP_COPY.length)];
  }

  // ===== 文案库：8 条，按调性分 4 类 =====
  // 模板里 {n} {m} {s} 会被上下文参数替换
  const COPY_LIBRARY = {
    rational: [
      '已坚持 {n} 天，离一个小习惯还差 {m} 天。',
      '今日已记录 {n} 次，今天的曲线在稳步上行。',
      '本时段平均分 {s}，保持节奏。',
    ],
    warm: [
      '撑过来就好，今天你也很努力了。',
      '我在这里，不打扰你，但需要的话点我一下。',
    ],
    spicy: [
      '刷手机很爽吧，但你今天还没打过卡。',
      '不是说好今天要开干吗？我在等你。',
    ],
    common: [
      '时间到了，给现在打个分吧。',
    ],
  };

  // ===== 拍一条文案 =====
  // ctx: { done: 今日已打卡数, score: 上次打分（1-5，可空） }
  // 策略：done=0 偏毒舌（戳一下）；score<=2 偏暖心（接住情绪）；其余随机偏向理性/通用
  function pickCopy(ctx) {
    ctx = ctx || {};
    const done = (typeof ctx.done === 'number') ? ctx.done : 0;
    const score = (typeof ctx.score === 'number') ? ctx.score : null;

    let bucket;
    if (done === 0) {
      bucket = 'spicy';
    } else if (score !== null && score <= 2) {
      bucket = 'warm';
    } else {
      const pool = ['rational', 'rational', 'rational', 'warm', 'common'];
      bucket = pool[Math.floor(Math.random() * pool.length)];
    }

    const arr = COPY_LIBRARY[bucket];
    const template = arr[Math.floor(Math.random() * arr.length)];

    return template
      .replace('{n}', String(done))
      .replace('{m}', String(Math.max(1, 21 - done)))
      .replace('{s}', score !== null ? score.toFixed(1) : '—');
  }

  // ===== 暴露到 window（不用打包器时的做法） =====
  window.TONGPING_COPY = {
    SCHEDULE: SCHEDULE,
    SETUP_SCHEDULE: SETUP_SCHEDULE,
    SETUP_COPY: SETUP_COPY,
    COPY_LIBRARY: COPY_LIBRARY,
    pickCopy: pickCopy,
    pickSetupCopy: pickSetupCopy,
  };
})();