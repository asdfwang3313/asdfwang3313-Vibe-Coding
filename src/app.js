// src/app.js — 同频 · Vue 主组件
// 作用：D9 #4 任务清单模式（UI 层，假数据演示）+ D8 #2 主题/图案/自定义图 + D8 #3 23:00 设任务提醒
// 依赖：Vue 3（window.Vue）、TONGPING_COPY、TONGPING_STORE、TONGPING_THEMES、TONGPING_PATTERNS
// 用法：index.html 末尾 <script src="src/app.js"></script>，自动挂载 #app
// 注意：Step 2 阶段不接 storage，所有 task/completed 改动只在 Vue reactive state 里，刷新就清空。Step 3 才落 storage。

(function () {
  if (!window.Vue) { console.error('[app] Vue 未加载'); return; }
  if (!window.TONGPING_COPY || !window.TONGPING_STORE || !window.TONGPING_THEMES) {
    console.error('[app] 依赖未就绪'); return;
  }

  const { createApp, ref, computed, onMounted, onUnmounted } = Vue;
  const Copy = window.TONGPING_COPY;
  const Store = window.TONGPING_STORE;
  const Themes = window.TONGPING_THEMES;
  const Patterns = window.TONGPING_PATTERNS;

  // ===== 工具 =====
  const pad2 = function (n) { return String(n).padStart(2, '0'); };
  const fmtTime = function (ts) {
    const d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  const fmtDate = function (d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  };
  const fmtWeekday = function (d) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  };

  // ===== 主组件 =====
  const App = {
    setup: function () {
      // ----- 状态 -----
      const now = ref(new Date());
      const themeName = ref(Store.getTheme());         // D8 #2：当前主题名
      const themeMenuOpen = ref(false);                // 主题切换菜单
      const patternName = ref(Store.getPattern());     // D8 #2 扩展：当前背景图案
      const patternMenuOpen = ref(false);              // 图案选择菜单
      const customBg = ref(Store.getCustomBg());       // D8 #2 扩展-2：用户自定义背景图 data URL
      const notifPermission = ref(
        typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
      );
      const panelOpen = ref(false);                    // 日复盘面板

      // ----- D9 #4：任务清单（Step 2 假数据；Step 3 接 storage）-----
      const tasks = ref([
        { id: 'demo-1', name: '学习 1 小时', score: 60, order: 0, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'demo-2', name: '运动 30 分钟', score: 30, order: 1, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'demo-3', name: '阅读 10 分钟', score: 10, order: 2, createdAt: Date.now(), updatedAt: Date.now() },
      ]);
      const completedIds = ref(new Set());            // 已勾选任务 id 集合
      const locked = ref(false);                       // 演示 23:30 后的只读模式（点「🔒 演示只读」切换）

      let tickTimer = null;
      let setupCheckTimer = null;
      let setupNotifiedDate = '';                      // 今天 23:00 提醒是否已发过

      // ----- 计算属性 -----
      const dateText = computed(function () {
        return fmtDate(now.value) + ' · ' + fmtWeekday(now.value);
      });
      const totalScore = computed(function () {
        return tasks.value.reduce(function (s, t) { return s + (Number(t.score) || 0); }, 0);
      });
      const isValidTotal = computed(function () { return totalScore.value === 100; });
      const totalDelta = computed(function () { return Math.abs(totalScore.value - 100); });
      const completedScore = computed(function () {
        let s = 0;
        for (let i = 0; i < tasks.value.length; i++) {
          const t = tasks.value[i];
          if (completedIds.value.has(t.id)) s += (Number(t.score) || 0);
        }
        return s;
      });
      const completedRatio = computed(function () {
        return Math.min(1, completedScore.value / 100);
      });
      const completedTaskList = computed(function () {
        return tasks.value.filter(function (t) { return completedIds.value.has(t.id); });
      });

      // ----- D9 #4：任务操作（Step 2 假数据；Step 3 改调 Store.addTask 等）-----
      function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      }
      function addTask() {
        if (locked.value) return;
        const defaultScore = Math.max(1, 100 - totalScore.value);
        const newTask = {
          id: genId(),
          name: '新任务',
          score: defaultScore,
          order: tasks.value.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        tasks.value = tasks.value.concat([newTask]);
      }
      function removeTask(id) {
        if (locked.value) return;
        if (tasks.value.length <= 1) {
          alert('至少保留 1 个任务');
          return;
        }
        tasks.value = tasks.value.filter(function (t) { return t.id !== id; });
        const next = new Set(completedIds.value);
        next.delete(id);
        completedIds.value = next;
      }
      function updateTaskName(id, name) {
        if (locked.value) return;
        tasks.value = tasks.value.map(function (t) {
          if (t.id !== id) return t;
          return Object.assign({}, t, { name: name, updatedAt: Date.now() });
        });
      }
      function updateTaskScore(id, score) {
        if (locked.value) return;
        let n = Number(score);
        if (isNaN(n)) n = 0;
        if (n < 0) n = 0;
        if (n > 100) n = 100;
        tasks.value = tasks.value.map(function (t) {
          if (t.id !== id) return t;
          return Object.assign({}, t, { score: n, updatedAt: Date.now() });
        });
      }
      function toggleTask(id) {
        if (locked.value) return;
        const next = new Set(completedIds.value);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        completedIds.value = next;
      }
      function toggleLocked() {
        locked.value = !locked.value;
      }

      // ----- 通知 -----
      function requestNotificationPermission() {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(function (p) {
            notifPermission.value = p;
          });
        }
      }
      function fireSetupReminder() {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        const body = Copy.pickSetupCopy();
        try {
          const n = new Notification('同频 · 该设明天任务了', {
            body: body,
            tag: 'tongping-setup-reminder',
          });
          n.onclick = function () {
            window.focus();
            alert('任务清单编辑 UI 在 D9 上线（Step 3 接 storage 后这里会打开真正的清单编辑）。');
          };
          setTimeout(function () { n.close(); }, 15000);
        } catch (e) {
          console.warn('[app] setup notification failed:', e);
        }
      }
      function checkSetupReminder() {
        const d = new Date();
        const todayKey = fmtDate(d);
        if (setupNotifiedDate === todayKey) return;
        if (d.getHours() < Copy.SETUP_SCHEDULE.triggerHour) return;
        if (d.getHours() === Copy.SETUP_SCHEDULE.triggerHour &&
            d.getMinutes() >= Copy.SETUP_SCHEDULE.lastCallMinute) return;
        setupNotifiedDate = todayKey;
        fireSetupReminder();
      }
      function testSetupReminder() {
        setupNotifiedDate = '__test__';
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          alert('通知权限被拒绝了，测试提醒弹不出来。\n\n去浏览器地址栏左边 🔒 图标 → "网站设置" → "通知" → 改成"允许"，再点一次。');
          return;
        }
        fireSetupReminder();
      }

      // ----- D8 #2：主题切换 -----
      const themeList = Object.keys(Themes.THEMES).map(function (k) {
        return Object.assign({ key: k }, Themes.THEMES[k]);
      });
      function selectTheme(name) {
        themeName.value = name;
        Themes.applyTheme(name);
        Store.setTheme(name);
        themeMenuOpen.value = false;
      }
      function toggleThemeMenu() {
        themeMenuOpen.value = !themeMenuOpen.value;
        if (themeMenuOpen.value) patternMenuOpen.value = false;
      }

      // ----- D8 #2 扩展：背景图案切换 -----
      const patternList = computed(function () {
        return Patterns && Patterns.LIST ? Patterns.LIST : [];
      });
      function selectPattern(id) {
        patternName.value = id;
        Store.setPattern(id);
        patternMenuOpen.value = false;
      }
      function togglePatternMenu() {
        patternMenuOpen.value = !patternMenuOpen.value;
        if (patternMenuOpen.value) themeMenuOpen.value = false;
      }

      // ----- D8 #2 扩展-2：用户上传自定义背景图 -----
      function applyCustomBg(dataUrl) {
        customBg.value = dataUrl || '';
        if (dataUrl) {
          document.body.style.setProperty('--tp-custom-bg', 'url("' + dataUrl + '")');
          document.body.classList.add('has-custom-bg');
        } else {
          document.body.style.removeProperty('--tp-custom-bg');
          document.body.classList.remove('has-custom-bg');
        }
      }
      function onUploadBg(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert('图片太大（' + Math.round(file.size / 1024) + ' KB），请用 2MB 以内的图。');
          event.target.value = '';
          return;
        }
        if (!file.type.startsWith('image/')) {
          alert('请选择图片文件（jpg / png / gif / webp）。');
          event.target.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          const dataUrl = e.target.result;
          const ok = Store.setCustomBg(dataUrl);
          if (!ok) {
            alert('保存失败（localStorage 可能满了）。先清缓存再来。');
            return;
          }
          applyCustomBg(dataUrl);
          patternMenuOpen.value = false;
        };
        reader.onerror = function () {
          alert('读取图片失败，请换一张试试。');
        };
        reader.readAsDataURL(file);
        // 清空 input，允许重复上传同一张图
        event.target.value = '';
      }
      function clearCustomBg() {
        Store.clearCustomBg();
        applyCustomBg('');
        patternMenuOpen.value = false;
      }

      function togglePanel() { panelOpen.value = !panelOpen.value; }

      // ----- 生命周期 -----
      onMounted(function () {
        Themes.applyTheme(themeName.value);
        document.body.dataset.pattern = patternName.value;
        if (customBg.value) applyCustomBg(customBg.value);
        requestNotificationPermission();
        tickTimer = setInterval(function () { now.value = new Date(); }, 30 * 1000);
        // D8 #3：每分钟检查一次是否到 23:00
        setupCheckTimer = setInterval(checkSetupReminder, 60 * 1000);
        checkSetupReminder();
      });

      onUnmounted(function () {
        if (tickTimer) clearInterval(tickTimer);
        if (setupCheckTimer) clearInterval(setupCheckTimer);
      });

      return {
        // 状态
        now: now,
        themeName: themeName, themeMenuOpen: themeMenuOpen,
        patternName: patternName, patternMenuOpen: patternMenuOpen,
        customBg: customBg,
        notifPermission: notifPermission,
        panelOpen: panelOpen,
        // D9 #4：任务清单
        tasks: tasks, completedIds: completedIds, locked: locked,
        // 计算
        dateText: dateText, totalScore: totalScore, isValidTotal: isValidTotal, totalDelta: totalDelta,
        completedScore: completedScore, completedRatio: completedRatio, completedTaskList: completedTaskList,
        // 方法
        addTask: addTask, removeTask: removeTask, updateTaskName: updateTaskName,
        updateTaskScore: updateTaskScore, toggleTask: toggleTask, toggleLocked: toggleLocked,
        togglePanel: togglePanel, testSetupReminder: testSetupReminder,
        // D8 #2 主题
        themeList: themeList, selectTheme: selectTheme, toggleThemeMenu: toggleThemeMenu,
        // D8 #2 扩展
        patternList: patternList, selectPattern: selectPattern, togglePatternMenu: togglePatternMenu,
        onUploadBg: onUploadBg, clearCustomBg: clearCustomBg,
        // 工具
        fmtTime: fmtTime,
      };
    },

    template: `
      <div class="container">

        <!-- ===== P1 顶栏 ===== -->
        <div class="topbar">
          <div>
            <h1>同频</h1>
            <div class="date">{{ dateText }}</div>
            <div class="next-reminder">
              <template v-if="notifPermission === 'granted'">通知已开启 · 23:00 提醒设任务</template>
              <template v-else-if="notifPermission === 'denied'">通知被拒绝（浏览器设置里改）</template>
              <template v-else-if="notifPermission === 'unsupported'">当前浏览器不支持通知</template>
              <template v-else>等待通知授权…</template>
            </div>
          </div>
          <div class="topbar-right">
            <span class="badge" :class="{ empty: completedScore === 0, 'badge-warn': !isValidTotal }">
              今日 {{ completedScore }} / 100
            </span>
            <div class="theme-picker">
              <button class="theme-toggle" @click="toggleThemeMenu" title="切换主题">🎨</button>
              <div v-if="themeMenuOpen" class="theme-menu">
                <button v-for="t in themeList" :key="t.key"
                  class="theme-option" :class="{ active: themeName === t.key }"
                  @click="selectTheme(t.key)">
                  <span class="theme-swatch" :style="{ background: t['--tp-primary'], borderColor: t['--tp-border'] }"></span>
                  {{ t.label }}
                </button>
              </div>
            </div>
            <div class="theme-picker">
              <button class="ghost" @click="togglePatternMenu" title="选择背景图案">🖼️</button>
              <div v-if="patternMenuOpen" class="theme-menu pattern-menu">
                <button v-for="p in patternList" :key="p.id"
                  class="theme-option" :class="{ active: patternName === p.id }"
                  @click="selectPattern(p.id)">
                  <span class="pattern-preview" :class="'preview-' + p.id"></span>
                  {{ p.name }}
                </button>
                <div class="pattern-divider"></div>
                <label class="theme-option upload-option">
                  <span class="upload-icon">📁</span>
                  {{ customBg ? '换一张图' : '上传图片' }}
                  <input type="file" accept="image/*" @change="onUploadBg" hidden>
                </label>
                <button v-if="customBg" class="theme-option clear-option" @click="clearCustomBg">
                  <span class="upload-icon">🔄</span>
                  清除自定义图
                </button>
                <div class="pattern-hint">自定义图会盖住内置图案，限制 2MB</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== P1 今日任务清单 ===== -->
        <div class="tasks">
          <div class="tasks-head">
            <h2>
              今日任务清单
              <span v-if="locked" class="lock-tag">已锁定</span>
            </h2>
            <div class="tasks-total" :class="{ 'tasks-total-warn': !isValidTotal }">
              <span v-if="isValidTotal">总分 {{ totalScore }} / 100 ✓</span>
              <span v-else>总分 {{ totalScore }} / 100（{{ totalScore > 100 ? '超出' : '不足' }} {{ totalDelta }}）</span>
            </div>
          </div>

          <div class="task-list">
            <div v-for="t in tasks" :key="t.id" class="task-row" :class="{ 'task-done': completedIds.has(t.id), 'task-locked': locked }">
              <input type="checkbox" class="task-check"
                :checked="completedIds.has(t.id)"
                :disabled="locked"
                @change="toggleTask(t.id)">
              <input type="text" class="task-name"
                :value="t.name"
                :disabled="locked"
                maxlength="30"
                @input="updateTaskName(t.id, $event.target.value)"
                placeholder="任务名">
              <input type="number" class="task-score"
                :value="t.score"
                :disabled="locked"
                min="0" max="100" step="1"
                @input="updateTaskScore(t.id, $event.target.value)">
              <span class="task-score-unit">分</span>
              <button v-if="!locked" class="icon task-remove" @click.stop="removeTask(t.id)" title="删除任务">×</button>
              <span v-else class="task-remove-placeholder"></span>
            </div>
          </div>

          <div v-if="!locked" class="tasks-actions">
            <button class="secondary" @click="addTask">+ 添加任务</button>
            <button class="ghost" @click="toggleLocked" title="演示：切到 23:30 后的只读模式">🔒 演示只读</button>
          </div>
        </div>

        <!-- ===== P1 操作区 ===== -->
        <div class="actions">
          <button class="secondary" @click="togglePanel">
            {{ panelOpen ? '收起日复盘' : '打开日复盘' }}
          </button>
          <button class="ghost" @click="testSetupReminder">🌙 测试 23:00 提醒</button>
        </div>

        <!-- ===== P3 日复盘面板 ===== -->
        <div v-if="panelOpen" class="panel">
          <h3>日复盘</h3>

          <div class="stat-row">
            <span class="label">完成度</span>
            <span class="value">{{ completedScore }} / 100</span>
          </div>
          <div class="progress">
            <div class="fill" :style="{ width: (completedRatio * 100) + '%' }"></div>
          </div>

          <div class="stat-row">
            <span class="label">今日总结</span>
            <span class="value">
              <template v-if="tasks.length === 0">还没设任务清单。</template>
              <template v-else-if="completedScore >= 100">满分！全部完成。</template>
              <template v-else>还差 {{ 100 - completedScore }} 分</template>
            </span>
          </div>

          <h3 style="margin-top:16px;">已完成任务</h3>
          <div v-if="completedTaskList.length === 0" class="empty-tip">还没勾选任务。</div>
          <div v-for="t in completedTaskList" :key="'done-' + t.id" class="timeline-item">
            <span class="t-score">✓ {{ t.score }}分</span>
            <span class="t-note">{{ t.name }}</span>
          </div>
        </div>

        <!-- 帮助说明 -->
        <div class="help">
          <strong>同频</strong> · 任务清单模式（#4 上线中）：前一晚 23:00-23:30 设明日任务，第二天勾选完成。
          当前为 Step 2 假数据（刷新清空），Step 3 接 storage。
        </div>

      </div>
    `,
  };

  createApp(App).mount('#app');
})();