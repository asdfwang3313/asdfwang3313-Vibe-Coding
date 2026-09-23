// src/storage.js — 同频 · 本地存储（F4）
// 作用：所有数据进出 localStorage 都走这一个文件。KEY 用 PRD 约定的 tb_records_v1。
// 容错：localStorage 不可用（隐私模式/禁用）或 JSON 损坏 → 返回空数组，不让页面崩。

(function () {
  const KEY = 'tb_records_v1';
  const THEME_KEY = 'tb_theme_v1';      // D8 #2：用户选择的主题
  const PATTERN_KEY = 'tb_pattern_v1';  // D8 #2 扩展：用户选择的背景图案
  const BG_CUSTOM_KEY = 'tb_bg_custom_v1'; // D8 #2 扩展：用户上传的自定义背景图（data URL）

  // ===== 内部 =====
  function readRaw() {
    try {
      const txt = localStorage.getItem(KEY);
      if (!txt) return [];
      const arr = JSON.parse(txt);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[storage] read failed, fall back to empty:', e);
      return [];
    }
  }

  function writeRaw(records) {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      console.warn('[storage] write failed:', e);
      return false;
    }
  }

  function genId() {
    // 时间戳 + 随机后缀，避免同一毫秒内重复
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // ===== 对外 API =====
  function getAll() {
    return readRaw();
  }

  // score: 1-5 | null（跳过）
  // note: 字符串，可空
  // skipped: 布尔
  function addRecord(score, note, skipped) {
    const rec = {
      id: genId(),
      ts: Date.now(),
      score: typeof score === 'number' ? score : null,
      note: typeof note === 'string' ? note : '',
      skipped: !!skipped,
    };
    const arr = readRaw();
    arr.push(rec);
    writeRaw(arr);
    return rec;
  }

  // D8 #5：按 id 改一条记录（分数 + 备注；skipped 不可改；id/ts 不变）
  // 返回更新后的对象；找不到返回 null
  function updateRecord(id, score, note) {
    const arr = readRaw();
    const idx = arr.findIndex(function (r) { return r && r.id === id; });
    if (idx === -1) return null;
    arr[idx].score = typeof score === 'number' ? score : arr[idx].score;
    arr[idx].note = typeof note === 'string' ? note : arr[idx].note;
    writeRaw(arr);
    return arr[idx];
  }

  // D8 #5：按 id 删一条记录；返回 true/false
  function deleteRecord(id) {
    const arr = readRaw();
    const idx = arr.findIndex(function (r) { return r && r.id === id; });
    if (idx === -1) return false;
    arr.splice(idx, 1);
    writeRaw(arr);
    return true;
  }

  function getTodayRecords() {
    const start = startOfToday();
    return readRaw().filter(function (r) { return r && r.ts >= start; });
  }

  function getTodayDone() {
    // 今日"打了"的数量（不含 skipped）
    return getTodayRecords().filter(function (r) { return !r.skipped; }).length;
  }

  function getLastScore() {
    // 最近一条非 skipped 的分数（null 表示还没有）
    const arr = readRaw().filter(function (r) {
      return !r.skipped && typeof r.score === 'number';
    });
    if (arr.length === 0) return null;
    return arr[arr.length - 1].score;
  }

  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  }

  // ===== D8 #2：主题持久化 =====
  function getTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v || 'default';
    } catch (e) { return 'default'; }
  }
  function setTheme(name) {
    try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* noop */ }
  }

  // ===== D8 #2 扩展：背景图案持久化 =====
  function getPattern() {
    try {
      const v = localStorage.getItem(PATTERN_KEY);
      return v || 'none';
    } catch (e) { return 'none'; }
  }
  function setPattern(id) {
    try { localStorage.setItem(PATTERN_KEY, id); } catch (e) { /* noop */ }
  }

  // ===== D8 #2 扩展：用户自定义背景图（data URL） =====
  function getCustomBg() {
    try {
      return localStorage.getItem(BG_CUSTOM_KEY) || '';
    } catch (e) { return ''; }
  }
  function setCustomBg(dataUrl) {
    try {
      localStorage.setItem(BG_CUSTOM_KEY, dataUrl);
      return true;
    } catch (e) {
      console.warn('[storage] 自定义背景图保存失败（可能 localStorage 满）:', e);
      return false;
    }
  }
  function clearCustomBg() {
    try { localStorage.removeItem(BG_CUSTOM_KEY); } catch (e) { /* noop */ }
  }

  // ===== 暴露 =====
  window.TONGPING_STORE = {
    KEY: KEY,
    THEME_KEY: THEME_KEY,
    PATTERN_KEY: PATTERN_KEY,
    BG_CUSTOM_KEY: BG_CUSTOM_KEY,
    getAll: getAll,
    addRecord: addRecord,
    updateRecord: updateRecord,
    deleteRecord: deleteRecord,
    getTodayRecords: getTodayRecords,
    getTodayDone: getTodayDone,
    getLastScore: getLastScore,
    getTheme: getTheme,
    setTheme: setTheme,
    getPattern: getPattern,
    setPattern: setPattern,
    getCustomBg: getCustomBg,
    setCustomBg: setCustomBg,
    clearCustomBg: clearCustomBg,
    clearAll: clearAll,
  };
})();