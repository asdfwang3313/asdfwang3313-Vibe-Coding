// src/storage.js — 同频 · 本地存储（F4）
// 作用：所有数据进出 localStorage 都走这一个文件。KEY 用 PRD 约定的 tb_records_v1。
// 容错：localStorage 不可用（隐私模式/禁用）或 JSON 损坏 → 返回空数组，不让页面崩。

(function () {
  const KEY = 'tb_records_v1';
  const THEME_KEY = 'tb_theme_v1';      // D8 #2：用户选择的主题
  const PATTERN_KEY = 'tb_pattern_v1';  // D8 #2 扩展：用户选择的背景图案
  const BG_CUSTOM_KEY = 'tb_bg_custom_v1'; // D8 #2 扩展：用户上传的自定义背景图（data URL）
  const TASKS_KEY = 'tb_tasks_v1';        // D9 #4：任务清单（按日期 key 的对象）
  const RECORDS_V2_KEY = 'tb_records_v2'; // D9 #4：V2 打卡（必须挂载 taskId）

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

  // ===== D9 #4：任务清单（按日期分）=====
  // 单日结构：{ items: [{id, name, score, order, createdAt, updatedAt}], totalScore: 100, lockedAt: ts|null }
  // 所有写操作都通过 setTasks 间接校验（sum=100 + lockedAt 锁定），add/update/delete 只额外查 lockedAt

  function todayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function readTasksAll() {
    try {
      const txt = localStorage.getItem(TASKS_KEY);
      if (!txt) return {};
      const obj = JSON.parse(txt);
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) {
      console.warn('[storage] read tasks failed:', e);
      return {};
    }
  }

  function writeTasksAll(obj) {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.warn('[storage] write tasks failed:', e);
      return false;
    }
  }

  // 取某日任务清单；不存在返回空壳
  function getTasks(dateStr) {
    if (!dateStr) throw new Error('getTasks 必须传日期 YYYY-MM-DD');
    const all = readTasksAll();
    return all[dateStr] || { items: [], totalScore: 0, lockedAt: null };
  }

  // 校验 + 写某日任务清单；lockedAt 已设置则拒绝
  function setTasks(dateStr, tasks) {
    if (!dateStr) throw new Error('setTasks 必须传日期');
    if (!tasks || typeof tasks !== 'object') {
      throw new Error('任务清单格式不对（不是对象）');
    }
    if (!Array.isArray(tasks.items)) {
      throw new Error('任务清单 items 必须是数组');
    }
    if (tasks.items.length === 0) {
      throw new Error('任务清单至少要有 1 个任务');
    }
    for (let i = 0; i < tasks.items.length; i++) {
      const t = tasks.items[i];
      if (!t || !t.id || typeof t.name !== 'string' || typeof t.score !== 'number') {
        throw new Error('第 ' + (i + 1) + ' 个任务格式不对（每项需有 id/name/score）');
      }
      if (t.score < 0 || t.score > 100) {
        throw new Error('第 ' + (i + 1) + ' 个任务分值超出 [0, 100]');
      }
    }
    const sum = tasks.items.reduce(function (s, t) { return s + (Number(t.score) || 0); }, 0);
    if (sum !== 100) {
      throw new Error('任务清单总分必须 = 100，当前 = ' + sum);
    }
    const cur = getTasks(dateStr);
    if (cur.lockedAt) {
      throw new Error('任务清单已锁定（>23:30），不能改');
    }
    const all = readTasksAll();
    all[dateStr] = {
      items: tasks.items,
      totalScore: sum,
      lockedAt: cur.lockedAt,
    };
    if (!writeTasksAll(all)) {
      throw new Error('任务清单保存失败（localStorage 不可写）');
    }
    return all[dateStr];
  }

  // 锁定某日任务清单（设置 lockedAt = Date.now()）
  function lockTasks(dateStr) {
    if (!dateStr) throw new Error('lockTasks 必须传日期');
    const all = readTasksAll();
    if (!all[dateStr]) {
      all[dateStr] = { items: [], totalScore: 0, lockedAt: Date.now() };
    } else {
      all[dateStr].lockedAt = Date.now();
    }
    if (!writeTasksAll(all)) {
      throw new Error('锁定任务清单失败');
    }
    return all[dateStr];
  }

  // 追加一个任务；score 缺省 = max(1, 剩余可分配分值)
  function addTask(dateStr, name, score) {
    if (!dateStr) throw new Error('addTask 必须传日期');
    const cur = getTasks(dateStr);
    if (cur.lockedAt) {
      throw new Error('任务清单已锁定（>23:30），不能再加任务');
    }
    const curTotal = cur.items.reduce(function (s, t) { return s + (Number(t.score) || 0); }, 0);
    const defaultScore = Math.max(1, 100 - curTotal);
    const newTask = {
      id: genId(),
      name: typeof name === 'string' && name.trim() ? name.trim() : '新任务',
      score: typeof score === 'number' ? score : defaultScore,
      order: cur.items.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newItems = cur.items.concat([newTask]);
    return setTasks(dateStr, { items: newItems });
  }

  // 改某个任务的 name / score（都不传就只更新 updatedAt）
  function updateTask(dateStr, taskId, name, score) {
    if (!dateStr) throw new Error('updateTask 必须传日期');
    if (!taskId) throw new Error('updateTask 必须传 taskId');
    const cur = getTasks(dateStr);
    if (cur.lockedAt) {
      throw new Error('任务清单已锁定（>23:30），不能再改任务');
    }
    let found = false;
    const newItems = cur.items.map(function (t) {
      if (t.id !== taskId) return t;
      found = true;
      return {
        id: t.id,
        name: typeof name === 'string' ? name : t.name,
        score: typeof score === 'number' ? score : t.score,
        order: t.order,
        createdAt: t.createdAt,
        updatedAt: Date.now(),
      };
    });
    if (!found) throw new Error('任务不存在：' + taskId);
    return setTasks(dateStr, { items: newItems });
  }

  // 删某个任务（至少保留 1 个）
  function deleteTask(dateStr, taskId) {
    if (!dateStr) throw new Error('deleteTask 必须传日期');
    if (!taskId) throw new Error('deleteTask 必须传 taskId');
    const cur = getTasks(dateStr);
    if (cur.lockedAt) {
      throw new Error('任务清单已锁定（>23:30），不能再删任务');
    }
    if (cur.items.length <= 1) {
      throw new Error('至少保留 1 个任务');
    }
    const newItems = cur.items.filter(function (t) { return t.id !== taskId; });
    if (newItems.length === cur.items.length) {
      throw new Error('任务不存在：' + taskId);
    }
    return setTasks(dateStr, { items: newItems });
  }

  // ===== D9 #4：V2 打卡（必须挂载到 taskId）=====
  function readRecordsV2() {
    try {
      const txt = localStorage.getItem(RECORDS_V2_KEY);
      if (!txt) return [];
      const arr = JSON.parse(txt);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[storage] read v2 records failed:', e);
      return [];
    }
  }

  function writeRecordsV2(arr) {
    try {
      localStorage.setItem(RECORDS_V2_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      console.warn('[storage] write v2 records failed:', e);
      return false;
    }
  }

  // 加一条 V2 打卡；taskId 必填且必须存在于今日任务清单
  function addRecordV2(taskId, note) {
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('V2 打卡必须挂载到 taskId');
    }
    const dateStr = todayDateStr();
    const tasks = getTasks(dateStr);
    if (tasks.items.length === 0) {
      throw new Error('今日还没设任务清单，先去 23:00-23:30 设任务');
    }
    const task = tasks.items.find(function (t) { return t.id === taskId; });
    if (!task) {
      throw new Error('任务不存在或不在今日清单里：' + taskId);
    }
    const rec = {
      id: genId(),
      taskId: taskId,
      ts: Date.now(),
      note: typeof note === 'string' ? note : '',
    };
    const arr = readRecordsV2();
    arr.push(rec);
    if (!writeRecordsV2(arr)) {
      throw new Error('V2 打卡保存失败');
    }
    return rec;
  }

  // 删一条 V2 打卡（取消勾选用）；返回是否真的删了
  function deleteRecordV2(id) {
    if (!id) return false;
    const arr = readRecordsV2();
    const idx = arr.findIndex(function (r) { return r && r.id === id; });
    if (idx === -1) return false;
    arr.splice(idx, 1);
    return writeRecordsV2(arr);
  }

  // 取今日 V2 打卡记录
  function getTodayRecordsV2() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime();
    return readRecordsV2().filter(function (r) { return r && r.ts >= start; });
  }

  // 取今日已完成任务的累计 score（按当前任务的 score 计算，所以改分值后累计也跟着改）
  function getTodayCompletedScore() {
    const dateStr = todayDateStr();
    const tasks = getTasks(dateStr);
    if (!tasks.items.length) return 0;
    const recs = getTodayRecordsV2();
    let total = 0;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const t = tasks.items.find(function (x) { return x.id === rec.taskId; });
      if (t) total += (Number(t.score) || 0);
    }
    return total;
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
    TASKS_KEY: TASKS_KEY,
    RECORDS_V2_KEY: RECORDS_V2_KEY,
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
    // D9 #4：任务清单
    todayDateStr: todayDateStr,
    getTasks: getTasks,
    setTasks: setTasks,
    lockTasks: lockTasks,
    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    // D9 #4：V2 打卡
    addRecordV2: addRecordV2,
    deleteRecordV2: deleteRecordV2,
    getTodayRecordsV2: getTodayRecordsV2,
    getTodayCompletedScore: getTodayCompletedScore,
    clearAll: clearAll,
  };
})();