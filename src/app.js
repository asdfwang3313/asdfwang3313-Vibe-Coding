// src/app.js — 同频 · Vue 主组件
// 作用：F1 浏览器通知 + F2 手动打卡 + F3 日视图
// 依赖：Vue 3（window.Vue）、TONGPING_COPY、TONGPING_STORE
// 用法：index.html 末尾 <script src="src/app.js"></script>，自动挂载 #app

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
      const todayRecords = ref([]);
      const todayDone = ref(0);
      const modalOpen = ref(false);
      const panelOpen = ref(false);
      const pendingScore = ref(null);
      const pendingNote = ref('');
      const editingId = ref(null);   // D8 #5：null=新建模式；字符串=编辑该 id
      const themeName = ref(Store.getTheme());   // D8 #2：当前主题名
      const themeMenuOpen = ref(false);          // 主题切换菜单是否展开
      const patternName = ref(Store.getPattern()); // D8 #2 扩展：当前背景图案
      const patternMenuOpen = ref(false);        // 图案选择菜单是否展开
      const customBg = ref(Store.getCustomBg()); // D8 #2 扩展-2：用户自定义背景图 data URL
      const notifPermission = ref(
        typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
      );

      let tickTimer = null;
      let nextNotifTimer = null;
      let firstNotifTimer = null;
      let setupCheckTimer = null;   // D8 #3：每分钟检查一次是否到 23:00
      let setupNotifiedDate = '';   // 今天的 23:00 提醒是否已发过（避免反复弹）

      // ----- 计算属性 -----
      const dateText = computed(function () {
        return fmtDate(now.value) + ' · ' + fmtWeekday(now.value);
      });
      const nextReminderMin = computed(function () {
        // 到下一个整点的分钟数（59→1 循环）
        return 60 - now.value.getMinutes();
      });
      const avgScore = computed(function () {
        const arr = todayRecords.value.filter(function (r) {
          return !r.skipped && typeof r.score === 'number';
        });
        if (arr.length === 0) return null;
        const sum = arr.reduce(function (a, r) { return a + r.score; }, 0);
        return sum / arr.length;
      });
      const todaySummary = computed(function () {
        const notes = todayRecords.value
          .filter(function (r) { return !r.skipped && r.note && r.note.trim(); })
          .map(function (r) { return r.note.trim(); });
        if (notes.length === 0) return '今天还没写备注。';
        // 抽最长一句
        return notes.sort(function (a, b) { return b.length - a.length; })[0];
      });
      // 应打次数 = SCHEDULE.endHour - startHour（默认 9→21 = 12 个小时，但 MVP 简化为 8 次）
      const expectedCount = computed(function () {
        return Math.max(1, Copy.SCHEDULE.endHour - Copy.SCHEDULE.startHour);
      });
      const todayProgress = computed(function () {
        return Math.min(1, todayDone.value / expectedCount.value);
      });

      // ----- 数据加载 -----
      function loadToday() {
        todayRecords.value = Store.getTodayRecords().sort(function (a, b) { return a.ts - b.ts; });
        todayDone.value = Store.getTodayDone();
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

      function fireNotification() {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        const body = Copy.pickCopy({ done: todayDone.value, score: Store.getLastScore() });
        try {
          const n = new Notification('同频 · 时间到了', {
            body: body,
            tag: 'tongping-reminder',
          });
          n.onclick = function () {
            // 降级路径 PRD 6.4：点通知直接开弹窗
            window.focus();
            modalOpen.value = true;
          };
          setTimeout(function () { n.close(); }, 15000);
        } catch (e) {
          console.warn('[app] notification failed:', e);
        }
      }

      function scheduleNextReminder() {
        if (nextNotifTimer) clearTimeout(nextNotifTimer);
        const ms = Copy.SCHEDULE.intervalMinutes * 60 * 1000;
        nextNotifTimer = setTimeout(function () {
          fireNotification();
          scheduleNextReminder();
        }, ms);
      }

      // ----- D8 #3：23:00 设任务提醒 -----
      // 设计依据：PRD 增量 §3 + §8.3（多触发场景调度器）
      // 触发条件：now.hour === 23 && now.minute < 30 && 今天没发过
      // 今天没发过：用模块内状态记录（页面刷新后会重发一次，符合"提醒"语义）
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
            // 降级路径：现在没有任务清单 UI（D9 #4 上线），先弹提示占位
            window.focus();
            alert('任务清单编辑 UI 在 D9 上线（完成 #4 后这里会打开真正的清单编辑）。');
          };
          setTimeout(function () { n.close(); }, 15000);
        } catch (e) {
          console.warn('[app] setup notification failed:', e);
        }
      }

      function checkSetupReminder() {
        const d = new Date();
        const todayKey = fmtDate(d);
        // 已发过今天 → 跳过
        if (setupNotifiedDate === todayKey) return;
        // 未到 23 点 → 跳过
        if (d.getHours() < Copy.SETUP_SCHEDULE.triggerHour) return;
        // 超过 23:30 → 跳过（今天的设任务窗口已过）
        if (d.getHours() === Copy.SETUP_SCHEDULE.triggerHour &&
            d.getMinutes() >= Copy.SETUP_SCHEDULE.lastCallMinute) return;
        // 触发
        setupNotifiedDate = todayKey;
        fireSetupReminder();
      }

      function testSetupReminder() {
        // 测试按钮：绕过"今天是否发过"判断，方便随时验证
        setupNotifiedDate = '__test__';
        // 如果用户已经点了"阻止"，直接弹 alert 告诉怎么打开（而不是没反应）
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          alert('通知权限被拒绝了，测试提醒弹不出来。\n\n去浏览器地址栏左边 🔒 图标 → "网站设置" → "通知" → 改成"允许"，再点一次。');
          return;
        }
        fireSetupReminder();
      }

      // ----- 打卡 -----
      function openModal() {
        pendingScore.value = null;
        pendingNote.value = '';
        editingId.value = null;
        modalOpen.value = true;
      }
      function closeModal() {
        modalOpen.value = false;
        editingId.value = null;
      }
      function canSave() { return pendingScore.value !== null; }
      function saveRecord() {
        if (!canSave()) return;
        if (editingId.value) {
          // 编辑模式：按 id 更新
          Store.updateRecord(editingId.value, pendingScore.value, pendingNote.value);
        } else {
          Store.addRecord(pendingScore.value, pendingNote.value, false);
        }
        loadToday();
        closeModal();
        if (!editingId.value) scheduleNextReminder(); // PRD F2：新建后下一提醒重新计时；编辑不重置
      }
      function skipToday() {
        Store.addRecord(null, '', true);
        loadToday();
        closeModal();
        scheduleNextReminder();
      }

      // ----- D8 #5：编辑 / 删除 -----
      function startEdit(record) {
        editingId.value = record.id;
        pendingScore.value = record.skipped ? null : (typeof record.score === 'number' ? record.score : null);
        pendingNote.value = record.note || '';
        modalOpen.value = true;
      }
      function removeRecord(record) {
        if (!confirm('删掉 ' + fmtTime(record.ts) + ' 这条打卡？')) return;
        Store.deleteRecord(record.id);
        loadToday();
      }

      function togglePanel() { panelOpen.value = !panelOpen.value; }

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
        // 2MB 限制（localStorage 5MB 上限，base64 后会涨 33%）
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

      // ----- 生命周期 -----
      onMounted(function () {
        Themes.applyTheme(themeName.value);
        document.body.dataset.pattern = patternName.value;
        if (customBg.value) applyCustomBg(customBg.value);
        loadToday();
        requestNotificationPermission();
        tickTimer = setInterval(function () { now.value = new Date(); }, 30 * 1000);
        firstNotifTimer = setTimeout(function () {
          fireNotification();
          scheduleNextReminder();
        }, Copy.SCHEDULE.firstDelaySeconds * 1000);
        // D8 #3：每分钟检查一次是否到 23:00
        setupCheckTimer = setInterval(checkSetupReminder, 60 * 1000);
        checkSetupReminder();
      });

      onUnmounted(function () {
        if (tickTimer) clearInterval(tickTimer);
        if (nextNotifTimer) clearTimeout(nextNotifTimer);
        if (firstNotifTimer) clearTimeout(firstNotifTimer);
        if (setupCheckTimer) clearInterval(setupCheckTimer);
      });

      return {
        // 状态
        now: now, todayRecords: todayRecords, todayDone: todayDone,
        modalOpen: modalOpen, panelOpen: panelOpen,
        pendingScore: pendingScore, pendingNote: pendingNote,
        notifPermission: notifPermission,
        // 计算
        dateText: dateText, nextReminderMin: nextReminderMin,
        avgScore: avgScore, todaySummary: todaySummary, todayProgress: todayProgress,
        // 方法
        loadToday: loadToday,
        openModal: openModal, closeModal: closeModal, canSave: canSave,
        saveRecord: saveRecord, skipToday: skipToday, togglePanel: togglePanel,
        startEdit: startEdit, removeRecord: removeRecord,
        testSetupReminder: testSetupReminder,
        // D8 #2 主题
        themeName: themeName, themeMenuOpen: themeMenuOpen,
        patternName: patternName, patternMenuOpen: patternMenuOpen,
        patternList: patternList,
        customBg: customBg,
        selectPattern: selectPattern, togglePatternMenu: togglePatternMenu,
        onUploadBg: onUploadBg, clearCustomBg: clearCustomBg,
        themeList: themeList, selectTheme: selectTheme, toggleThemeMenu: toggleThemeMenu,
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
              <template v-if="notifPermission === 'granted'">下一提醒还有 {{ nextReminderMin }} 分钟</template>
              <template v-else-if="notifPermission === 'denied'">通知被拒绝（浏览器设置里改）</template>
              <template v-else-if="notifPermission === 'unsupported'">当前浏览器不支持通知</template>
              <template v-else>等待通知授权…</template>
            </div>
          </div>
          <div class="topbar-right">
            <span class="badge" :class="{ empty: todayDone === 0 }">今日 {{ todayDone }} / 8</span>
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

            <!-- D8 #2 扩展：背景图案按钮 -->
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

        <!-- ===== P1 今日卡片列表 ===== -->
        <div class="records">
          <h2>今日记录</h2>
          <div v-if="todayRecords.length === 0" class="empty-tip">还没开始。点下面的「打卡」记录第一次。</div>
          <div v-for="r in todayRecords" :key="r.id" class="record-card" :class="{ skipped: r.skipped }">
            <span class="time">{{ fmtTime(r.ts) }}</span>
            <span class="score">{{ r.skipped ? '⏭' : r.score }}</span>
            <span class="note">{{ r.note || (r.skipped ? '今天没做' : '（无备注）') }}</span>
            <span class="record-actions">
              <button v-if="!r.skipped" class="icon" @click.stop="startEdit(r)" title="编辑">✏️</button>
              <button class="icon" @click.stop="removeRecord(r)" title="删除">🗑️</button>
            </span>
          </div>
        </div>

        <!-- ===== P1 操作区 ===== -->
        <div class="actions">
          <button class="primary" @click="openModal">打卡</button>
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
            <span class="value">{{ todayDone }} / 8</span>
          </div>
          <div class="progress">
            <div class="fill" :style="{ width: (todayProgress * 100) + '%' }"></div>
          </div>

          <div class="stat-row">
            <span class="label">平均分</span>
            <span class="value">{{ avgScore === null ? '—' : avgScore.toFixed(1) }}</span>
          </div>

          <div class="stat-row">
            <span class="label">今日总结</span>
            <span class="value">{{ todaySummary }}</span>
          </div>

          <h3 style="margin-top:16px;">时间轴</h3>
          <div v-if="todayRecords.length === 0" class="empty-tip">还没打卡。</div>
          <div v-for="r in todayRecords" :key="'tl-' + r.id" class="timeline-item" :class="{ skipped: r.skipped }">
            <span class="t-time">{{ fmtTime(r.ts) }}</span>
            <span class="t-score">{{ r.skipped ? '⏭' : r.score }}</span>
            <span class="t-note">{{ r.note || (r.skipped ? '今天没做' : '（无备注）') }}</span>
          </div>
        </div>

        <!-- 帮助说明 -->
        <div class="help">
          <strong>同频</strong> · 每小时一次轻提醒 + 手动打卡 + 日复盘。
          数据存在本浏览器（清缓存会丢，建议每周截图备份）。
        </div>

        <!-- ===== P2 打卡弹窗 ===== -->
        <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
          <div class="modal">
            <h2>{{ editingId ? '编辑打卡' : '给现在打个分' }}</h2>

            <div class="field">
              <label class="field-label">
                分数 <span class="field-value">{{ pendingScore === null ? '—' : pendingScore }}</span>
              </label>
              <input type="range" min="1" max="5" step="1" v-model.number="pendingScore">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-top:4px;">
                <span>1 最低</span><span>5 最高</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">一句话备注（选填，最多 100 字）</label>
              <textarea v-model="pendingNote" maxlength="100" placeholder="今天的话..."></textarea>
            </div>

            <div class="modal-actions">
              <div class="left">
                <button v-if="!editingId" class="ghost" @click="skipToday">跳过（今天没做）</button>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="secondary" @click="closeModal">取消</button>
                <button class="primary" :disabled="!canSave()" @click="saveRecord">{{ editingId ? '保存修改' : '保存' }}</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    `,
  };

  createApp(App).mount('#app');
})();