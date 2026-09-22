// src/storage.js — 同频 · 本地存储（F4）
// 作用：所有数据进出 localStorage 都走这一个文件。KEY 用 PRD 约定的 tb_records_v1。
// 容错：localStorage 不可用（隐私模式/禁用）或 JSON 损坏 → 返回空数组，不让页面崩。

(function () {
  const KEY = 'tb_records_v1';

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

  // ===== 暴露 =====
  window.TONGPING_STORE = {
    KEY: KEY,
    getAll: getAll,
    addRecord: addRecord,
    getTodayRecords: getTodayRecords,
    getTodayDone: getTodayDone,
    getLastScore: getLastScore,
    clearAll: clearAll,
  };
})();