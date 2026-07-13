(() => {
  'use strict';

  /* ============================================================
     Storage shim — three environments, in priority order:
     1. Native bridge (the floating bubble app's WKWebView) — most
        reliable, writes straight to a JSON file on disk.
     2. chrome.storage.local (the real Chrome extension environment).
     3. localStorage — fallback so the page still works if it's ever
        opened as a plain file.
     ============================================================ */

  const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const hasNativeBridge = typeof window.webkit !== 'undefined'
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers.cumulusNative;

  function storageGet(key) {
    return new Promise((resolve) => {
      if (hasNativeBridge && typeof window.__CUMULUS_NATIVE_SEED__ !== 'undefined') {
        resolve(window.__CUMULUS_NATIVE_SEED__ === null ? undefined : window.__CUMULUS_NATIVE_SEED__);
        return;
      }
      if (hasChromeStorage) {
        chrome.storage.local.get([key], (result) => resolve(result[key]));
      } else {
        try {
          const raw = localStorage.getItem(key);
          resolve(raw ? JSON.parse(raw) : undefined);
        } catch (e) { resolve(undefined); }
      }
    });
  }

  function storageSet(key, value) {
    if (hasNativeBridge) {
      try { window.webkit.messageHandlers.cumulusNative.postMessage(JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
    if (hasChromeStorage) {
      chrome.storage.local.set({ [key]: value });
    } else {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  }

  const STORAGE_KEY = 'cumulusData';

  /* ============================================================
     Config: themes + category color palette
     ============================================================ */

  const THEMES = {
    dusk: {
      name: 'Dusk', unlockLevel: 1,
      bgFrom: '#14132B', bgTo: '#3B2E63', text: '#F4F1FF', textDim: '#C9C3E8',
      gold: '#FFC857', coral: '#FF6B6B', starOpacity: 0.9,
    },
    sunrise: {
      name: 'Sunrise', unlockLevel: 2,
      bgFrom: '#2E1A47', bgTo: '#FF9A76', text: '#FFF6EE', textDim: '#F0D9CE',
      gold: '#FFD166', coral: '#FF6B6B', starOpacity: 0.4,
    },
    ocean: {
      name: 'Ocean', unlockLevel: 4,
      bgFrom: '#031B29', bgTo: '#116A7B', text: '#E6FBFF', textDim: '#AED9E0',
      gold: '#FFD166', coral: '#EF476F', starOpacity: 0.6,
    },
    aurora: {
      name: 'Aurora', unlockLevel: 6,
      bgFrom: '#081C15', bgTo: '#1B4332', text: '#EAFBEA', textDim: '#B7D9C4',
      gold: '#B5E48C', coral: '#F72585', starOpacity: 0.8,
    },
    cottonCandy: {
      name: 'Cotton Candy', unlockLevel: 8,
      bgFrom: '#3A2E5C', bgTo: '#E7B7E0', text: '#FFFFFF', textDim: '#E9DCF5',
      gold: '#FFD166', coral: '#FF6B9D', starOpacity: 0.35,
    },
    galaxy: {
      name: 'Galaxy', unlockLevel: 10,
      bgFrom: '#020111', bgTo: '#150050', text: '#F1E9FF', textDim: '#B9A9E0',
      gold: '#FFD700', coral: '#FF3CAC', starOpacity: 1,
    },
  };

  const CATEGORY_PALETTE = ['#C9B6FF', '#8FD9C4', '#FFD6A5', '#A8DADC', '#FFAFCC', '#B8C0FF', '#95D5B2', '#FFC6A0'];

  const TASK_XP = 20;
  const STREAK_MILESTONE_BONUS = 30; // extra XP every 5-day streak milestone

  // a single continuous bezier path (not overlapping shapes) so every cloud
  // can have one clean outline stroke and a real volumetric gradient fill
  const CLOUD_PATH = 'M 66 208 C 36 208 14 184 14 155 C 14 129 33 107 59 103 C 61 73 87 50 119 50 C 141 50 160 61 171 78 C 179 54 203 36 231 36 C 266 36 296 61 302 96 C 332 99 356 124 356 155 C 356 181 336 203 310 207 C 306 213 298 217 288 217 L 92 217 C 80 217 70 214 66 208 Z';

  // lighten/darken a hex color by a percentage (-1 to 1) for gradient + outline shades
  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + Math.round(255 * percent);
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
    let b = (num & 0x0000ff) + Math.round(255 * percent);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  const CHECK_ICON = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const PLUS_ICON = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  const X_ICON = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const STAR_ICON = '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

  /* ============================================================
     State
     ============================================================ */

  function defaultState() {
    return {
      xp: 0,
      streak: { count: 0, lastActiveDate: null, freezeAvailable: true, freezeUsedNotice: false },
      theme: 'dusk',
      unlockedThemes: ['dusk'],
      calmMode: false,
      inbox: [],
      categories: [
        { id: 'misc', name: 'Miscellaneous', color: CATEGORY_PALETTE[7], tasks: [], isDefault: true },
      ],
      completed: [],
    };
  }

  let state = defaultState();

  const ui = { activeView: 'sky', openId: null }; // openId: 'inbox' | category id

  /* ============================================================
     Helpers
     ============================================================ */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function xpForLevel(level) {
    return 100 + (level - 1) * 50;
  }

  function getLevelInfo(totalXp) {
    let xp = totalXp;
    let level = 1;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
    }
    return { level, xpIntoLevel: xp, xpForNext: xpForLevel(level) };
  }

  function findCategory(id) {
    return state.categories.find((c) => c.id === id);
  }

  /* ============================================================
     Persistence
     ============================================================ */

  function save() {
    storageSet(STORAGE_KEY, state);
  }

  async function load() {
    const saved = await storageGet(STORAGE_KEY);
    if (saved) {
      state = Object.assign(defaultState(), saved);
      // nested objects get fully overwritten by Object.assign, not merged —
      // patch in defaults for any fields older saves won't have.
      state.streak = Object.assign({ count: 0, lastActiveDate: null, freezeAvailable: true, freezeUsedNotice: false }, saved.streak || {});
      // guard against missing misc category on old saves
      if (!findCategory('misc')) {
        state.categories.unshift({ id: 'misc', name: 'Miscellaneous', color: CATEGORY_PALETTE[7], tasks: [], isDefault: true });
      }
    }
    checkStreakBreak();
  }

  function checkStreakBreak() {
    if (!state.streak.lastActiveDate) return;
    const gap = daysBetween(state.streak.lastActiveDate, todayStr());
    if (gap > 1) {
      if (state.streak.freezeAvailable) {
        // one grace day: streak survives, but the freeze is spent
        state.streak.freezeAvailable = false;
        state.streak.freezeUsedNotice = true;
      } else {
        state.streak.count = 0;
      }
    }
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const el = {
    sky: document.getElementById('sky'),
    tabSky: document.getElementById('tabSky'),
    tabDone: document.getElementById('tabDone'),
    viewSky: document.getElementById('viewSky'),
    viewDone: document.getElementById('viewDone'),
    cloudGarden: document.getElementById('cloudGarden'),
    emptyHint: document.getElementById('emptyHint'),
    doneList: document.getElementById('doneList'),
    doneEmptyHint: document.getElementById('doneEmptyHint'),
    streakValue: document.getElementById('streakValue'),
    streakFreeze: document.getElementById('streakFreeze'),
    levelBadge: document.getElementById('levelBadge'),
    xpFill: document.getElementById('xpFill'),
    xpText: document.getElementById('xpText'),
    settingsBtn: document.getElementById('settingsBtn'),
    braindumpForm: document.getElementById('braindumpForm'),
    braindumpInput: document.getElementById('braindumpInput'),

    cloudModalOverlay: document.getElementById('cloudModalOverlay'),
    cloudModalClose: document.getElementById('cloudModalClose'),
    modalColorDot: document.getElementById('modalColorDot'),
    modalTitleInput: document.getElementById('modalTitleInput'),
    modalDeleteCategory: document.getElementById('modalDeleteCategory'),
    modalTaskList: document.getElementById('modalTaskList'),
    taskAddForm: document.getElementById('taskAddForm'),
    taskAddInput: document.getElementById('taskAddInput'),
    taskAddDate: document.getElementById('taskAddDate'),

    newCategoryOverlay: document.getElementById('newCategoryOverlay'),
    newCategoryClose: document.getElementById('newCategoryClose'),
    newCategoryForm: document.getElementById('newCategoryForm'),
    newCategoryName: document.getElementById('newCategoryName'),
    swatchRow: document.getElementById('swatchRow'),

    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsClose: document.getElementById('settingsClose'),
    themeGrid: document.getElementById('themeGrid'),
    calmModeToggle: document.getElementById('calmModeToggle'),
    resetBtn: document.getElementById('resetBtn'),

    toastLayer: document.getElementById('toastLayer'),
  };

  let selectedSwatch = CATEGORY_PALETTE[0];

  /* ============================================================
     Theme application
     ============================================================ */

  function applyTheme(themeId) {
    const t = THEMES[themeId] || THEMES.dusk;
    const root = document.documentElement.style;
    root.setProperty('--bg-from', t.bgFrom);
    root.setProperty('--bg-to', t.bgTo);
    root.setProperty('--text-on-bg', t.text);
    root.setProperty('--text-on-bg-dim', t.textDim);
    root.setProperty('--accent-gold', t.gold);
    root.setProperty('--accent-coral', t.coral);
    root.setProperty('--star-opacity', t.starOpacity);
    document.body.setAttribute('data-theme', themeId);
  }

  function applyCalmMode() {
    document.body.classList.toggle('calm-mode', !!state.calmMode);
  }

  /* ============================================================
     Rendering — HUD
     ============================================================ */

  function renderHud() {
    el.streakValue.textContent = state.streak.count;
    if (el.streakFreeze) el.streakFreeze.style.display = state.streak.freezeAvailable ? 'inline' : 'none';
    const { level, xpIntoLevel, xpForNext } = getLevelInfo(state.xp);
    el.levelBadge.textContent = `Lv ${level}`;
    el.xpFill.style.width = `${Math.min(100, (xpIntoLevel / xpForNext) * 100)}%`;
    el.xpText.textContent = `${xpIntoLevel} / ${xpForNext} XP`;
  }

  /* ============================================================
     Rendering — Sky (cloud garden)
     ============================================================ */

  function cloudSize(count) {
    return Math.min(210, 122 + count * 14);
  }

  function overdueCount(tasks) {
    const today = todayStr();
    return tasks.reduce((n, t) => n + (t.dueDate && t.dueDate < today ? 1 : 0), 0);
  }

  function makeCloudEl({ id, name, count, color, isInbox = false, isNew = false, overdue = 0 }) {
    const btn = document.createElement('button');
    btn.className = 'cloud' + (isInbox ? ' is-inbox' : '') + (isNew ? ' is-new' : '') + (isInbox && count > 0 ? ' has-items' : '');
    btn.dataset.id = id;
    const size = isNew ? 108 : cloudSize(count);
    btn.style.setProperty('--size', `${size}px`);
    btn.style.setProperty('--delay', `${(Math.random() * 3).toFixed(2)}s`);
    btn.style.setProperty('--duration', `${(5 + Math.random() * 3).toFixed(2)}s`);

    if (isNew) {
      btn.innerHTML = `
        <span class="new-cloud-ring" aria-hidden="true">${PLUS_ICON}</span>
        <span class="cloud-label">
          <span class="cloud-name">New cloud</span>
        </span>
      `;
    } else {
      const gradId = `cloudGrad-${id}`;
      const fillTop = shadeColor(color, 0.18);
      const fillBot = shadeColor(color, -0.16);
      const stroke = shadeColor(color, -0.42);
      btn.innerHTML = `
        <svg class="cloud-svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="110" y1="36" x2="250" y2="217">
              <stop offset="0%" stop-color="${fillTop}"/>
              <stop offset="100%" stop-color="${fillBot}"/>
            </linearGradient>
          </defs>
          <g filter="url(#cloudShadow)">
            <path d="${CLOUD_PATH}" fill="url(#${gradId})" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
            <path d="${CLOUD_PATH}" fill="url(#cloudHighlight)"/>
          </g>
        </svg>
        <span class="cloud-label">
          <span class="cloud-name">${escapeHtml(name)}</span>
          <span class="cloud-count">${count} task${count === 1 ? '' : 's'}</span>
        </span>
        ${overdue > 0 ? `<span class="cloud-overdue-badge" title="${overdue} overdue">${overdue}</span>` : ''}
      `;
    }
    return btn;
  }

  function renderSky() {
    el.cloudGarden.innerHTML = '';

    const totalTasks = state.inbox.length + state.categories.reduce((s, c) => s + c.tasks.length, 0);
    el.emptyHint.hidden = totalTasks > 0 || state.categories.length > 1;

    // brain dump cloud, always present
    el.cloudGarden.appendChild(makeCloudEl({
      id: 'inbox', name: 'Brain Dump', count: state.inbox.length, color: '#FFC857', isInbox: true,
      overdue: overdueCount(state.inbox),
    }));

    state.categories.forEach((cat) => {
      el.cloudGarden.appendChild(makeCloudEl({
        id: cat.id, name: cat.name, count: cat.tasks.length, color: cat.color,
        overdue: overdueCount(cat.tasks),
      }));
    });

    // new-category button
    el.cloudGarden.appendChild(makeCloudEl({ id: '__new__', name: '+ New cloud', count: 0, color: 'transparent', isNew: true }));
  }

  /* ============================================================
     Rendering — Done view
     ============================================================ */

  function dayLabel(dateStr) {
    const gap = daysBetween(dateStr, todayStr());
    if (gap === 0) return 'Today';
    if (gap === 1) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderDone() {
    el.doneList.innerHTML = '';
    el.doneEmptyHint.hidden = state.completed.length > 0;

    const groups = {};
    [...state.completed].reverse().forEach((item) => {
      const day = item.completedAt.slice(0, 10);
      (groups[day] = groups[day] || []).push(item);
    });

    Object.keys(groups).sort((a, b) => (a < b ? 1 : -1)).forEach((day) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'done-day-group';
      groupEl.innerHTML = `<div class="done-day-label">${dayLabel(day)}</div>`;
      groups[day].forEach((item) => {
        const row = document.createElement('div');
        row.className = 'done-item';
        row.innerHTML = `
          <span class="done-item-check">${CHECK_ICON}</span>
          <span class="done-item-text">${escapeHtml(item.text)}</span>
          <span class="done-item-tag">${escapeHtml(item.categoryName)}</span>
          <span class="done-item-xp">+${item.xpEarned} XP</span>
        `;
        groupEl.appendChild(row);
      });
      el.doneList.appendChild(groupEl);
    });
  }

  /* ============================================================
     Rendering — cloud detail modal
     ============================================================ */

  function currentTasks() {
    if (ui.openId === 'inbox') return state.inbox;
    const cat = findCategory(ui.openId);
    return cat ? cat.tasks : [];
  }

  function formatDueDate(dateStr) {
    if (dateStr === todayStr()) return 'Today';
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderTaskRow(task) {
    const row = document.createElement('div');
    row.className = 'task-row' + (task.important ? ' is-important' : '');
    row.dataset.id = task.id;

    let moveSelect = '';
    if (ui.openId === 'inbox') {
      const opts = state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      moveSelect = `<select class="task-move" data-action="move" title="Move to category"><option value="">Move to…</option>${opts}</select>`;
    }

    let dueBadge = '';
    if (task.dueDate) {
      const overdue = task.dueDate < todayStr();
      dueBadge = `<span class="task-due${overdue ? ' is-overdue' : ''}">${formatDueDate(task.dueDate)}</span>`;
    }

    row.innerHTML = `
      <button class="task-check" data-action="complete" title="Mark done">${CHECK_ICON}</button>
      <button class="task-star${task.important ? ' is-active' : ''}" data-action="toggle-important" title="${task.important ? 'Unmark important' : 'Mark important'}">${STAR_ICON}</button>
      <span class="task-text" data-action="edit" title="Click to edit">${escapeHtml(task.text)}</span>
      ${dueBadge}
      ${moveSelect}
      <button class="task-delete" data-action="delete" title="Delete task">${X_ICON}</button>
    `;
    return row;
  }

  function startInlineEdit(row, id) {
    const list = ui.openId === 'inbox' ? state.inbox : findCategory(ui.openId).tasks;
    const task = list.find((t) => t.id === id);
    if (!task) return;
    const span = row.querySelector('.task-text');
    if (!span) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-text-edit';
    input.maxLength = 140;
    input.value = task.text;
    span.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const val = input.value.trim();
      if (val) task.text = val;
      save();
      renderCloudModal();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderCloudModal(); }
    });
  }

  function toggleImportant(id) {
    const list = ui.openId === 'inbox' ? state.inbox : findCategory(ui.openId).tasks;
    const task = list.find((t) => t.id === id);
    if (!task) return;
    task.important = !task.important;
    save();
    renderCloudModal();
  }

  function renderCloudModal() {
    const isInbox = ui.openId === 'inbox';
    const cat = isInbox ? null : findCategory(ui.openId);
    if (!isInbox && !cat) return;

    el.modalColorDot.style.setProperty('--dot-color', isInbox ? '#FFC857' : cat.color);
    el.modalTitleInput.value = isInbox ? 'Brain Dump' : cat.name;
    el.modalTitleInput.disabled = isInbox;
    el.modalDeleteCategory.style.display = (isInbox || cat.isDefault) ? 'none' : 'flex';

    el.modalTaskList.innerHTML = '';
    const tasks = currentTasks();
    if (tasks.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:var(--text-on-bg-dim); font-size:13.5px; text-align:center; padding:10px 0;';
      empty.textContent = isInbox ? 'No loose thoughts right now. Nice.' : 'No tasks here yet — add one below.';
      el.modalTaskList.appendChild(empty);
    } else {
      [...tasks]
        .sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0))
        .forEach((t) => el.modalTaskList.appendChild(renderTaskRow(t)));
    }
  }

  function openCloudModal(id) {
    if (id === '__new__') {
      openNewCategoryModal();
      return;
    }
    ui.openId = id;
    renderCloudModal();
    el.cloudModalOverlay.hidden = false;
    el.taskAddInput.value = '';
    if (el.taskAddDate) el.taskAddDate.value = '';
    el.taskAddInput.focus();
  }

  function closeCloudModal() {
    el.cloudModalOverlay.hidden = true;
    ui.openId = null;
    renderSky();
  }

  /* ============================================================
     XP / streak / celebration
     ============================================================ */

  function showToast(message, { levelup = false } = {}) {
    const t = document.createElement('div');
    t.className = 'toast' + (levelup ? ' is-levelup' : '');
    t.textContent = message;
    el.toastLayer.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function burstConfetti() {
    const colors = ['#FFC857', '#FF6B6B', '#8FD9C4', '#C9B6FF', '#A8DADC'];
    const cx = window.innerWidth / 2;
    const cy = 70;
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const size = 5 + Math.random() * 6;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * 0.5}px`;
      piece.style.left = `${cx}px`;
      piece.style.top = `${cy}px`;
      piece.style.background = colors[i % colors.length];
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 160;
      piece.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      piece.style.setProperty('--ty', `${Math.sin(angle) * dist + 60}px`);
      piece.style.setProperty('--rot', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1200);
    }
  }

  function updateStreakOnCompletion() {
    const today = todayStr();
    if (state.streak.lastActiveDate === today) return 0; // already counted today
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (state.streak.lastActiveDate === yesterday) {
      state.streak.count += 1;
    } else {
      state.streak.count = 1;
    }
    state.streak.lastActiveDate = today;

    if (state.streak.count > 0 && state.streak.count % 5 === 0) {
      const freezeRestored = !state.streak.freezeAvailable;
      state.streak.freezeAvailable = true;
      showToast(`🔥 ${state.streak.count}-day streak! +${STREAK_MILESTONE_BONUS} bonus XP${freezeRestored ? ' — streak freeze restored 🧊' : ''}`);
      return STREAK_MILESTONE_BONUS;
    }
    return 0;
  }

  function awardXpAndMaybeLevelUp(amount) {
    const before = getLevelInfo(state.xp).level;
    state.xp += amount;
    const after = getLevelInfo(state.xp).level;
    if (after > before) {
      if (!state.calmMode) burstConfetti();
      const unlocked = Object.entries(THEMES).filter(([, t]) => t.unlockLevel === after);
      unlocked.forEach(([key, t]) => {
        if (!state.unlockedThemes.includes(key)) {
          state.unlockedThemes.push(key);
          showToast(`✨ Level ${after}! New theme unlocked: ${t.name}`, { levelup: true });
        }
      });
      if (unlocked.length === 0) {
        showToast(`✨ Level ${after}!`, { levelup: true });
      }
    }
  }

  function completeTask(id) {
    const isInbox = ui.openId === 'inbox';
    const list = isInbox ? state.inbox : findCategory(ui.openId).tasks;
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [task] = list.splice(idx, 1);

    const categoryName = isInbox ? 'Brain Dump' : findCategory(ui.openId).name;
    state.completed.push({
      id: task.id,
      text: task.text,
      categoryId: isInbox ? null : ui.openId,
      categoryName,
      completedAt: new Date().toISOString(),
      xpEarned: TASK_XP,
    });

    const streakBonus = updateStreakOnCompletion();
    awardXpAndMaybeLevelUp(TASK_XP + streakBonus);

    save();
    renderHud();
    renderCloudModal();
  }

  /* ============================================================
     New category modal
     ============================================================ */

  function buildSwatchRow() {
    el.swatchRow.innerHTML = '';
    selectedSwatch = CATEGORY_PALETTE[0];
    CATEGORY_PALETTE.forEach((color, i) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'swatch' + (i === 0 ? ' is-selected' : '');
      sw.style.background = color;
      sw.dataset.color = color;
      sw.addEventListener('click', () => {
        selectedSwatch = color;
        el.swatchRow.querySelectorAll('.swatch').forEach((s) => s.classList.remove('is-selected'));
        sw.classList.add('is-selected');
      });
      el.swatchRow.appendChild(sw);
    });
  }

  function openNewCategoryModal() {
    buildSwatchRow();
    el.newCategoryName.value = '';
    el.newCategoryOverlay.hidden = false;
    el.newCategoryName.focus();
  }

  function closeNewCategoryModal() {
    el.newCategoryOverlay.hidden = true;
  }

  /* ============================================================
     Settings / themes modal
     ============================================================ */

  function renderThemeGrid() {
    el.themeGrid.innerHTML = '';
    Object.entries(THEMES).forEach(([key, t]) => {
      const unlocked = state.unlockedThemes.includes(key);
      const card = document.createElement('button');
      card.className = 'theme-card' + (state.theme === key ? ' is-active' : '') + (!unlocked ? ' is-locked' : '');
      card.disabled = !unlocked;
      card.innerHTML = `
        <span class="theme-swatch" style="background:linear-gradient(135deg, ${t.bgFrom}, ${t.bgTo})"></span>
        <span class="theme-name">${t.name}</span>
        ${!unlocked ? `<div class="theme-lock">🔒 Lv ${t.unlockLevel}</div>` : ''}
      `;
      if (unlocked) {
        card.addEventListener('click', () => {
          state.theme = key;
          applyTheme(key);
          save();
          renderThemeGrid();
        });
      }
      el.themeGrid.appendChild(card);
    });
  }

  function openSettings() {
    renderThemeGrid();
    if (el.calmModeToggle) el.calmModeToggle.checked = !!state.calmMode;
    el.settingsOverlay.hidden = false;
  }
  function closeSettings() {
    el.settingsOverlay.hidden = true;
  }

  /* ============================================================
     Event wiring
     ============================================================ */

  function switchView(view) {
    ui.activeView = view;
    el.tabSky.classList.toggle('is-active', view === 'sky');
    el.tabDone.classList.toggle('is-active', view === 'done');
    el.tabSky.setAttribute('aria-selected', view === 'sky');
    el.tabDone.setAttribute('aria-selected', view === 'done');
    el.viewSky.classList.toggle('is-active', view === 'sky');
    el.viewDone.classList.toggle('is-active', view === 'done');
    if (view === 'done') renderDone();
  }

  function wireEvents() {
    el.tabSky.addEventListener('click', () => switchView('sky'));
    el.tabDone.addEventListener('click', () => switchView('done'));

    el.cloudGarden.addEventListener('click', (e) => {
      const btn = e.target.closest('.cloud');
      if (btn) openCloudModal(btn.dataset.id);
    });

    el.cloudModalClose.addEventListener('click', closeCloudModal);
    el.cloudModalOverlay.addEventListener('click', (e) => {
      if (e.target === el.cloudModalOverlay) closeCloudModal();
    });

    el.modalTitleInput.addEventListener('change', () => {
      if (ui.openId === 'inbox') return;
      const cat = findCategory(ui.openId);
      if (!cat) return;
      const val = el.modalTitleInput.value.trim();
      if (val) cat.name = val;
      else el.modalTitleInput.value = cat.name;
      save();
    });

    el.modalDeleteCategory.addEventListener('click', () => {
      const cat = findCategory(ui.openId);
      if (!cat) return;
      const ok = confirm(`Delete "${cat.name}"? Its tasks will move to Miscellaneous.`);
      if (!ok) return;
      const misc = findCategory('misc');
      misc.tasks.push(...cat.tasks);
      state.categories = state.categories.filter((c) => c.id !== cat.id);
      save();
      closeCloudModal();
    });

    el.modalTaskList.addEventListener('click', (e) => {
      const row = e.target.closest('.task-row');
      if (!row) return;
      const id = row.dataset.id;
      const actionEl = e.target.closest('[data-action]');
      const action = actionEl ? actionEl.dataset.action : null;

      if (action === 'complete') {
        row.style.transition = 'transform 0.15s, opacity 0.15s';
        row.style.transform = 'scale(0.96)';
        row.style.opacity = '0.4';
        setTimeout(() => completeTask(id), 130);
      } else if (action === 'delete') {
        const list = ui.openId === 'inbox' ? state.inbox : findCategory(ui.openId).tasks;
        const idx = list.findIndex((t) => t.id === id);
        if (idx !== -1) list.splice(idx, 1);
        save();
        renderCloudModal();
      } else if (action === 'edit') {
        startInlineEdit(row, id);
      } else if (action === 'toggle-important') {
        toggleImportant(id);
      }
    });

    el.modalTaskList.addEventListener('change', (e) => {
      if (e.target.dataset.action !== 'move') return;
      const targetId = e.target.value;
      if (!targetId) return;
      const idx = state.inbox.findIndex((t) => t.id === e.target.closest('.task-row').dataset.id);
      if (idx === -1) return;
      const [task] = state.inbox.splice(idx, 1);
      findCategory(targetId).tasks.push(task);
      save();
      renderCloudModal();
      showToast(`Moved to ${findCategory(targetId).name}`);
    });

    el.taskAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el.taskAddInput.value.trim();
      if (!text) return;
      const dueDate = el.taskAddDate && el.taskAddDate.value ? el.taskAddDate.value : null;
      const task = { id: uid(), text, createdAt: new Date().toISOString(), important: false, dueDate };
      if (ui.openId === 'inbox') state.inbox.push(task);
      else findCategory(ui.openId).tasks.push(task);
      el.taskAddInput.value = '';
      if (el.taskAddDate) el.taskAddDate.value = '';
      save();
      renderCloudModal();
    });

    // brain dump dock
    el.braindumpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el.braindumpInput.value.trim();
      if (!text) return;
      state.inbox.push({ id: uid(), text, createdAt: new Date().toISOString() });
      el.braindumpInput.value = '';
      save();
      renderSky();
      showToast('Dumped into your Brain Dump cloud ☁');
    });

    // new category modal
    el.newCategoryClose.addEventListener('click', closeNewCategoryModal);
    el.newCategoryOverlay.addEventListener('click', (e) => {
      if (e.target === el.newCategoryOverlay) closeNewCategoryModal();
    });
    el.newCategoryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = el.newCategoryName.value.trim();
      if (!name) return;
      state.categories.push({ id: uid(), name, color: selectedSwatch, tasks: [], isDefault: false });
      save();
      closeNewCategoryModal();
      renderSky();
    });

    // settings
    el.settingsBtn.addEventListener('click', openSettings);
    el.settingsClose.addEventListener('click', closeSettings);
    el.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === el.settingsOverlay) closeSettings();
    });
    if (el.calmModeToggle) {
      el.calmModeToggle.addEventListener('change', () => {
        state.calmMode = el.calmModeToggle.checked;
        applyCalmMode();
        save();
      });
    }
    el.resetBtn.addEventListener('click', () => {
      const ok = confirm('This clears all tasks, XP, streaks, and themes. This can\'t be undone. Continue?');
      if (!ok) return;
      state = defaultState();
      applyTheme(state.theme);
      applyCalmMode();
      save();
      renderAll();
      closeSettings();
    });

    // escape key closes any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!el.cloudModalOverlay.hidden) closeCloudModal();
      if (!el.newCategoryOverlay.hidden) closeNewCategoryModal();
      if (!el.settingsOverlay.hidden) closeSettings();
    });
  }

  /* ============================================================
     Ambient background blobs
     ============================================================ */

  function renderAmbientBlobs() {
    // moon (fixed, upper-right, gives the sky an actual light source)
    const moon = document.createElement('div');
    moon.className = 'sky-moon';
    el.sky.appendChild(moon);

    // varied-size twinkling stars, scattered irregularly (not a grid)
    const starPositions = [
      [8, 6], [22, 14], [40, 4], [65, 10], [85, 8], [12, 22], [48, 20], [92, 24],
      [6, 38], [30, 42], [58, 36], [78, 44], [95, 40], [15, 55], [40, 60], [70, 58],
      [88, 65], [5, 72], [35, 78], [60, 82], [80, 76], [25, 90], [50, 94], [90, 88],
    ];
    starPositions.forEach(([x, y], i) => {
      const star = document.createElement('div');
      star.className = 'sky-star';
      star.style.left = `${x}%`;
      star.style.top = `${y}%`;
      const size = 1 + Math.random() * 1.8;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.animationDelay = `${(i * 0.37) % 4}s`;
      el.sky.appendChild(star);
    });

    // distant, blurred, low-opacity cloud silhouettes for atmospheric depth
    const distantClouds = [
      { top: '58%', left: '-4%', size: 260, opacity: 0.10, duration: 55 },
      { top: '78%', left: '70%', size: 320, opacity: 0.08, duration: 65 },
      { top: '15%', left: '55%', size: 200, opacity: 0.07, duration: 48 },
    ];
    distantClouds.forEach((p, i) => {
      const cloud = document.createElement('div');
      cloud.className = 'sky-distant-cloud';
      cloud.style.top = p.top;
      cloud.style.left = p.left;
      cloud.style.width = `${p.size}px`;
      cloud.style.height = `${p.size * 0.65}px`;
      cloud.style.opacity = p.opacity;
      cloud.style.animationDuration = `${p.duration}s`;
      cloud.style.animationDelay = `${i * 6}s`;
      cloud.innerHTML = `
        <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet">
          <path d="${CLOUD_PATH}" fill="#FFFFFF"/>
        </svg>
      `;
      el.sky.appendChild(cloud);
    });
  }

  /* ============================================================
     Boot
     ============================================================ */

  function renderAll() {
    renderHud();
    renderSky();
    if (ui.activeView === 'done') renderDone();
  }

  async function init() {
    await load();
    applyTheme(state.theme);
    applyCalmMode();
    renderAmbientBlobs();
    wireEvents();
    renderAll();
    if (state.streak.freezeUsedNotice) {
      showToast('🧊 Streak freeze used — your streak is safe!');
      state.streak.freezeUsedNotice = false;
      save();
    }
  }

  init();
})();
