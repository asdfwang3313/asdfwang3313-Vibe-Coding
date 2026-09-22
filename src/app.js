// src/app.js — 同频 · Vue 主组件
// 作用：F1 浏览器通知 + F2 手动打卡 + F3 日视图
// 依赖：Vue 3（window.Vue）、TONGPING_COPY、TONGPING_STORE
// 用法：index.html 末尾 <script src="src/app.js"></script>，自动挂载 #app

(function () {
  if (!window.Vue) { console.error('[app] Vue 未加载'); return; }
  if (!window.TONGPING_COPY || !window.TONGPING_STORE) { console.error('[app] 依赖未就绪'); return; }

  const { createApp, ref, computed, onMounted, onUnmounted } = Vue;
  const Copy = window.TONGPING_COPY;
  const Store = window.TONGPING_STORE;

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
      const notifPermission = ref(
        typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
      );

      let tickTimer = null;
      let nextNotifTimer = null;
      let firstNotifTimer = null;

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

      // ----- 打卡 -----
      function openModal() {
        pendingScore.value = null;
        pendingNote.value = '';
        modalOpen.value = true;
      }
      function closeModal() { modalOpen.value = false; }
      function canSave() { return pendingScore.value !== null; }
      function saveRecord() {
        if (!canSave()) return;
        Store.addRecord(pendingScore.value, pendingNote.value, false);
        loadToday();
        modalOpen.value = false;
        scheduleNextReminder(); // PRD F2：保存后下一提醒重新计时
      }
      function skipToday() {
        Store.addRecord(null, '', true);
        loadToday();
        modalOpen.value = false;
        scheduleNextReminder();
      }

      function togglePanel() { panelOpen.value = !panelOpen.value; }

      // ----- 生命周期 -----
      onMounted(function () {
        loadToday();
        requestNotificationPermission();
        tickTimer = setInterval(function () { now.value = new Date(); }, 30 * 1000);
        firstNotifTimer = setTimeout(function () {
          fireNotification();
          scheduleNextReminder();
        }, Copy.SCHEDULE.firstDelaySeconds * 1000);
      });

      onUnmounted(function () {
        if (tickTimer) clearInterval(tickTimer);
        if (nextNotifTimer) clearTimeout(nextNotifTimer);
        if (firstNotifTimer) clearTimeout(firstNotifTimer);
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
          <span class="badge" :class="{ empty: todayDone === 0 }">今日 {{ todayDone }} / 8</span>
        </div>

        <!-- ===== P1 今日卡片列表 ===== -->
        <div class="records">
          <h2>今日记录</h2>
          <div v-if="todayRecords.length === 0" class="empty-tip">还没开始。点下面的「打卡」记录第一次。</div>
          <div v-for="r in todayRecords" :key="r.id" class="record-card" :class="{ skipped: r.skipped }">
            <span class="time">{{ fmtTime(r.ts) }}</span>
            <span class="score">{{ r.skipped ? '⏭' : r.score }}</span>
            <span class="note">{{ r.note || (r.skipped ? '今天没做' : '（无备注）') }}</span>
          </div>
        </div>

        <!-- ===== P1 操作区 ===== -->
        <div class="actions">
          <button class="primary" @click="openModal">打卡</button>
          <button class="secondary" @click="togglePanel">
            {{ panelOpen ? '收起日复盘' : '打开日复盘' }}
          </button>
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
            <h2>给现在打个分</h2>

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
                <button class="ghost" @click="skipToday">跳过（今天没做）</button>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="secondary" @click="closeModal">取消</button>
                <button class="primary" :disabled="!canSave()" @click="saveRecord">保存</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    `,
  };

  createApp(App).mount('#app');
})();