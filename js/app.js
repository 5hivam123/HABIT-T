/**
 * HabitFlow Pro - Application Bootstrap & Controller
 * Glues state, router, views, global window hooks, and PWA registration.
 * @module app
 */

import { initState, getState, subscribe, updateState, updateSettings, updateProfile, resetAllData, loadStarterSampleData, clearSampleData, importStateData, toggleArchiveHabit } from './state.js';
import { registerRoutes, initRouter, handleRouteChange, getCurrentRoute } from './router.js';
import { renderDashboardView } from './dashboard.js';
import { renderCalendarView, navigateCalendarMonth, resetCalendarToday, openDayPanel, closeDayPanel, backfillHabitAction } from './calendar.js';
import { renderHeatmap } from './heatmap.js';
import { computeAnalyticsMetrics, renderAnalyticsCharts, destroyCharts } from './statistics.js';
import { getCombinedJournalEntries, recordDailyReflection, MOODS } from './journal.js';
import { evaluateAllGoals, openCreateGoalModal, promptDeleteGoal } from './goals.js';
import { evaluateBadges, calculateLevel, getWeeklyChallenge } from './gamification.js';
import { generateSmartInsights } from './insights.js';
import {
  openHabitModal,
  promptDeleteHabit,
  duplicateHabit,
  toggleHabitComplete,
  stepCounterHabit,
  toggleHabitTimer,
  skipHabitForDay,
  renderHabitCard,
  HABIT_TEMPLATES,
  CATEGORIES
} from './habits.js';
import { initKeyboardShortcuts, toggleCommandPalette } from './shortcuts.js';
import { initRemindersTicker, requestNotificationPermission } from './reminders.js';
import { exportDataJSON, exportCompletionsCSV, validateImportJSON, getStorageUsage, restoreBackup, getBackups } from './storage.js';
import { showToast, showConfirmDialog, showTypeToConfirmModal, openModal, closeModal } from './ui.js';
import { escapeHTML, getTodayDate, getRelativeDateLabel } from './utils.js';

// Local view state
let habitCategoryFilter = 'all';
let habitSearchQuery = '';
let habitSortBy = 'custom';
let habitViewMode = localStorage.getItem('hf_view_mode') || 'grid'; // 'grid' | 'list'
let heatmapFilter = 'all';

/**
 * Initializes the entire application.
 */
export function initApp() {
  const state = initState();

  // Apply stored theme and accent colors to document element
  applyThemeAndAccent(state.settings);

  // Initialize keyboard shortcuts & command palette
  initKeyboardShortcuts();

  // Initialize periodic reminders ticker
  initRemindersTicker();

  // Register SPA routes
  registerRoutes({
    dashboard: (s) => renderDashboardView(s),
    habits: (s) => renderHabitsPageView(s),
    calendar: (s) => renderCalendarView(s),
    statistics: (s) => renderStatisticsPageView(s),
    journal: (s) => renderJournalPageView(s),
    goals: (s) => renderGoalsPageView(s),
    achievements: (s) => renderAchievementsPageView(s),
    settings: (s) => renderSettingsPageView(s),
    '404': () => render404PageView()
  });

  // Start router
  initRouter();

  // Subscribe to central state changes: re-render active route & evaluate goals
  subscribe((updatedState, action) => {
    evaluateAllGoals();
    applyThemeAndAccent(updatedState.settings);
    updateTopbarBadges(updatedState);
    handleRouteChange();

    if (getCurrentRoute() === 'statistics') {
      setTimeout(() => renderAnalyticsCharts(updatedState), 50);
    }
  });

  // Update topbar badges on initial boot
  updateTopbarBadges(state);

  // Register PWA Service Worker
  registerPWA();

  // Bind sidebar and topbar elements
  bindGlobalNavControls();

  // If initial route is statistics, render charts
  if (getCurrentRoute() === 'statistics') {
    setTimeout(() => renderAnalyticsCharts(state), 80);
  }
}

/**
 * Applies theme (light, dark, system) and accent palette (green, purple, etc.).
 * @param {Object} settings
 */
function applyThemeAndAccent(settings = {}) {
  const root = document.documentElement;
  const theme = settings.theme || 'system';
  const accent = settings.accent || 'green';

  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }

  root.setAttribute('data-accent', accent);
}

/**
 * Updates streak flame and XP chip in topbar and sidebar.
 * @param {Object} state
 */
function updateTopbarBadges(state) {
  const today = getTodayDate();
  const habits = (state.habits || []).filter((h) => !h.archived);
  const completions = state.completions || [];

  // Streak badge
  let maxCurrentStreak = 0;
  habits.forEach((h) => {
    const s = (state.completions || []).filter((c) => c.habitId === h.id);
    const count = s.filter((c) => c.status === 'done').length;
    if (count > maxCurrentStreak) maxCurrentStreak = count;
  });

  const streakEl = document.getElementById('hf-topbar-streak');
  if (streakEl) {
    streakEl.textContent = `🔥 ${maxCurrentStreak}`;
    streakEl.title = `Best active streak: ${maxCurrentStreak} days`;
  }

  // Level & XP chip
  const { level, currentLevelXP, nextLevelXP, progressPct } = calculateLevel(state.profile?.xp || 0);

  const levelTextEl = document.getElementById('hf-sidebar-level-text');
  if (levelTextEl) levelTextEl.textContent = `Level ${level}`;

  const xpTextEl = document.getElementById('hf-sidebar-xp-text');
  if (xpTextEl) xpTextEl.textContent = `${currentLevelXP} XP`;

  const xpFillEl = document.getElementById('hf-sidebar-xp-fill');
  if (xpFillEl) xpFillEl.style.width = `${progressPct}%`;
}

/**
 * Registers PWA service worker and handles install button.
 */
function registerPWA() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').then((reg) => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast({
                message: 'A new version of Habit Tracker is available!',
                type: 'info',
                actionLabel: 'Update',
                onAction: () => {
                  reg.waiting?.postMessage({ action: 'skipWaiting' });
                  window.location.reload();
                }
              });
            }
          };
        };
      }).catch((err) => {
        console.warn('[PWA] Service worker registration note:', err);
      });
    });
  }

  // Listen for beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    const installBtn = document.getElementById('hf-install-app-btn');
    if (installBtn) installBtn.style.display = 'inline-flex';
  });
}

/**
 * Binds UI navigation buttons.
 */
function bindGlobalNavControls() {
  // Mobile hamburger toggle
  const mobileMenuBtn = document.getElementById('hf-mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.onclick = () => {
      sidebar.classList.toggle('mobile-open');
    };
  }

  // Sidebar collapse toggle (desktop)
  const sidebarToggleBtn = document.getElementById('hf-sidebar-toggle-btn');
  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.onclick = () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('hf_sidebar_collapsed', sidebar.classList.contains('collapsed'));
    };

    if (localStorage.getItem('hf_sidebar_collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }
  }

  // Global Theme toggle in topbar
  const themeToggleBtn = document.getElementById('hf-theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.onclick = () => {
      const state = getState();
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      updateSettings({ theme: next });
      showToast({ message: `Theme switched to ${next}.`, type: 'info' });
    };
  }

  // Close mobile sidebar when clicking a nav link
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (sidebar) sidebar.classList.remove('mobile-open');
    });
  });
}

/* ==========================================================================
   Page Renderers: Habits Page
   ========================================================================== */

function renderHabitsPageView(state) {
  const habits = state.habits || [];
  const completions = state.completions || [];
  const today = getTodayDate();

  // Filter habits
  let filtered = habits.filter((h) => {
    if (habitCategoryFilter === 'archived') return h.archived;
    if (h.archived) return false;
    if (habitCategoryFilter !== 'all' && h.category !== habitCategoryFilter) return false;
    if (habitSearchQuery) {
      const q = habitSearchQuery.toLowerCase();
      return h.name.toLowerCase().includes(q) || (h.description && h.description.toLowerCase().includes(q));
    }
    return true;
  });

  // Sort habits
  if (habitSortBy === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (habitSortBy === 'priority') {
    const pOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1));
  } else {
    // Custom manual order
    filtered.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3);">
        <div>
          <h1 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold);">My Habits</h1>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Organize, customize, and build your daily rituals.</p>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.toggleHabitsViewMode()">
            ${habitViewMode === 'grid' ? '📋 List View' : '🔲 Grid View'}
          </button>
          <button type="button" class="btn btn-primary" onclick="window.openNewHabitModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Habit
          </button>
        </div>
      </div>

      <!-- Quick Template Starters -->
      <div style="margin-bottom: var(--space-4);">
        <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-text-muted); text-transform: uppercase;">1-Click Starters:</span>
        <div class="templates-carousel" style="margin-top: var(--space-2);">
          ${HABIT_TEMPLATES.map((tmpl) => `
            <div class="template-card" onclick="window.addFromTemplate('${escapeHTML(tmpl.name)}')">
              <span>${tmpl.emoji}</span>
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);">${escapeHTML(tmpl.name)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="habits-toolbar">
        <div class="habits-search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="form-input habits-search-input" placeholder="Search habits..." value="${escapeHTML(habitSearchQuery)}" oninput="window.onHabitSearchInput(this.value)">
        </div>

        <div style="display: flex; gap: var(--space-2);">
          <select class="form-select" style="min-width: 140px;" onchange="window.onHabitSortChange(this.value)">
            <option value="custom" ${habitSortBy === 'custom' ? 'selected' : ''}>Custom Order</option>
            <option value="name" ${habitSortBy === 'name' ? 'selected' : ''}>Sort by Name</option>
            <option value="priority" ${habitSortBy === 'priority' ? 'selected' : ''}>Sort by Priority</option>
          </select>
        </div>
      </div>

      <!-- Category Filter Pills -->
      <div class="habits-filters-row">
        <button type="button" class="filter-pill ${habitCategoryFilter === 'all' ? 'active' : ''}" onclick="window.onHabitCategoryFilter('all')">All</button>
        ${CATEGORIES.map((cat) => `
          <button type="button" class="filter-pill ${habitCategoryFilter === cat ? 'active' : ''}" onclick="window.onHabitCategoryFilter('${cat}')">${cat}</button>
        `).join('')}
        <button type="button" class="filter-pill ${habitCategoryFilter === 'archived' ? 'active' : ''}" onclick="window.onHabitCategoryFilter('archived')">Archived</button>
      </div>

      <!-- Habits Container (Grid vs List) -->
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <h4 class="empty-state-title">No Habits Found</h4>
          <p class="empty-state-desc">Try clearing your search query or create a new habit.</p>
        </div>
      ` : `
        <div class="${habitViewMode === 'grid' ? 'habits-grid-view' : 'habits-list-view'}" id="hf-habits-container">
          ${filtered.map((h) => renderHabitCard(h, completions, today)).join('')}
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   Page Renderers: Statistics Page
   ========================================================================== */

function renderStatisticsPageView(state) {
  const metrics = computeAnalyticsMetrics(state);
  const insights = generateSmartInsights(state);

  return `
    <div>
      <div style="margin-bottom: var(--space-6);">
        <h1 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold);">Analytics & Insights</h1>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Deep performance metrics, trend curves, and behavioral intelligence.</p>
      </div>

      <!-- Performance Summary Cards -->
      <div class="stat-cards-grid">
        <div class="stat-card">
          <div class="stat-card-icon success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${metrics.rate7d}%</div>
            <div class="stat-card-label">7-Day Consistency (${metrics.rateDelta7d >= 0 ? `+${metrics.rateDelta7d}%` : `${metrics.rateDelta7d}%`} vs prev)</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon accent">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${metrics.rate30d}%</div>
            <div class="stat-card-label">30-Day Completion Rate</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon info">
            <span style="font-size: 1.5rem;">🌟</span>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${metrics.bestDay ? metrics.bestDay.name : 'N/A'}</div>
            <div class="stat-card-label">Best Day of Week (${metrics.bestDay?.rate || 0}%)</div>
          </div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <div class="chart-card">
          <h3 class="card-title" style="margin-bottom: var(--space-4);">Weekly Consistency (Last 7 Days)</h3>
          <div class="chart-container-wrap">
            <canvas id="chart-weekly-bar"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3 class="card-title" style="margin-bottom: var(--space-4);">Habit Category Distribution</h3>
          <div class="chart-container-wrap">
            <canvas id="chart-category-doughnut"></canvas>
          </div>
        </div>
      </div>

      <!-- Yearly Heatmap -->
      ${renderHeatmap(state, heatmapFilter)}

      <!-- Full Behavioral Insights List -->
      <div class="card p-5 mt-6" style="margin-top: var(--space-6);">
        <h3 class="card-title" style="margin-bottom: var(--space-4);">Smart Behavioral Insights</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          ${insights.map((ins) => `
            <div style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); background: var(--color-surface-alt); border-radius: var(--radius-md);">
              <span style="font-size: 1.5rem;">${ins.icon}</span>
              <div>
                <strong style="color: var(--color-text);">${escapeHTML(ins.title)}</strong>
                <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-text-muted);">${escapeHTML(ins.description)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Page Renderers: Journal Page
   ========================================================================== */

function renderJournalPageView(state) {
  const entries = getCombinedJournalEntries(state);

  return `
    <div>
      <div style="margin-bottom: var(--space-6);">
        <h1 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold);">Daily Journal & Reflections</h1>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Capture your mental clarity, wins, and reflections alongside habit tracking.</p>
      </div>

      <!-- New Reflection Box -->
      <div class="card p-5 mb-6" style="margin-bottom: var(--space-6);">
        <h3 class="card-title" style="margin-bottom: var(--space-3);">Today's Reflection</h3>
        <div class="form-group">
          <label class="form-label">How do you feel today?</label>
          <div class="mood-selector" id="hf-mood-selector">
            ${MOODS.map((m, idx) => `
              <button type="button" class="mood-emoji-btn ${idx === 1 ? 'selected' : ''}" data-mood="${m.id}" title="${m.label}">${m.emoji}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="reflection-text">Reflection Note</label>
          <textarea id="reflection-text" class="form-textarea" placeholder="What went well today? What did you learn?"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-primary btn-sm" onclick="window.submitReflection()">Save Entry</button>
        </div>
      </div>

      <!-- Journal Timeline -->
      <div class="journal-timeline">
        <h3 class="card-title" style="margin-bottom: var(--space-3);">Timeline History</h3>
        ${entries.length === 0 ? `
          <div class="empty-state">
            <p class="empty-state-desc">No reflections or habit notes logged yet.</p>
          </div>
        ` : entries.map((entry) => `
          <div class="journal-entry-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span style="font-size: 1.25rem;">${entry.emoji}</span>
                <strong style="color: var(--color-text);">${escapeHTML(entry.title)}</strong>
              </div>
              <span class="badge badge-neutral">${getRelativeDateLabel(entry.date)}</span>
            </div>
            <p style="color: var(--color-text); font-size: var(--font-size-sm); line-height: 1.5; margin: 0;">${escapeHTML(entry.text)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Page Renderers: Goals Page
   ========================================================================== */

function renderGoalsPageView(state) {
  const goals = state.goals || [];
  const habitsMap = new Map((state.habits || []).map((h) => [h.id, h]));

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-3);">
        <div>
          <h1 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold);">Milestone Goals</h1>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Turn daily consistency into grand personal milestones.</p>
        </div>
        <button type="button" class="btn btn-primary" onclick="window.openNewGoalModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Goal
        </button>
      </div>

      <div class="goals-grid">
        ${goals.length === 0 ? `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <p class="empty-state-desc">No active goals yet. Create one above to set high-impact milestones!</p>
          </div>
        ` : goals.map((goal) => {
          const habit = habitsMap.get(goal.habitId);
          const pct = Math.min(100, Math.round(((goal.currentValue || 0) / (goal.targetValue || 1)) * 100));
          const isCompleted = goal.status === 'completed';

          return `
            <div class="goal-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h4 style="font-size: var(--font-size-md); font-weight: var(--font-weight-bold); margin-bottom: 2px;">${escapeHTML(goal.title)}</h4>
                  <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
                    Linked to ${habit ? habit.emoji + ' ' + escapeHTML(habit.name) : 'Habit'}
                  </span>
                </div>
                <span class="badge ${isCompleted ? 'badge-success' : 'badge-accent'}">
                  ${isCompleted ? 'Completed 🏆' : `${pct}%`}
                </span>
              </div>

              <div class="goal-progress-bar">
                <div class="goal-progress-fill" style="width: ${pct}%;"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-xs); color: var(--color-text-muted);">
                <span>Progress: ${goal.currentValue || 0} / ${goal.targetValue}</span>
                <button type="button" class="btn-ghost btn-sm" onclick="window.deleteGoal('${goal.id}')">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Page Renderers: Achievements & Badges Page
   ========================================================================== */

function renderAchievementsPageView(state) {
  const badges = evaluateBadges(state);
  const { level, currentLevelXP, nextLevelXP, progressPct } = calculateLevel(state.profile?.xp || 0);
  const challenge = getWeeklyChallenge(state);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return `
    <div>
      <div style="margin-bottom: var(--space-6);">
        <h1 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold);">Badges & Achievements</h1>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Track levels, XP, and unlock 22 discipline trophies.</p>
      </div>

      <!-- Level & Weekly Challenge Banner -->
      <div class="card p-5 mb-6" style="margin-bottom: var(--space-6); background: var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
          <div>
            <span class="badge badge-accent" style="margin-bottom: var(--space-2);">Level Progression</span>
            <h2 style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-extrabold); margin: 0;">Level ${level} Master</h2>
            <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: 2px;">
              ${currentLevelXP} XP Total &bull; ${nextLevelXP - currentLevelXP} XP to Level ${level + 1}
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold); color: var(--color-accent);">${unlockedCount} / ${badges.length}</div>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Badges Unlocked</span>
          </div>
        </div>

        <div class="user-xp-bar" style="height: 10px; margin-top: var(--space-4);">
          <div class="user-xp-fill" style="width: ${progressPct}%;"></div>
        </div>
      </div>

      <!-- Badges Grid (22 Badges) -->
      <div class="badges-grid">
        ${badges.map((b) => `
          <div class="badge-card ${b.unlocked ? '' : 'locked'}">
            <div class="badge-icon-wrap">${b.icon}</div>
            <div class="badge-title">${escapeHTML(b.title)}</div>
            <div class="badge-desc">${escapeHTML(b.description)}</div>
            <span class="badge ${b.unlocked ? 'badge-success' : 'badge-neutral'}" style="margin-top: var(--space-2);">
              ${b.unlocked ? 'Unlocked 🌟' : b.progress}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Page Renderers: Settings Page
   ========================================================================== */

function renderSettingsPageView(state) {
  const settings = state.settings || {};
  const profile = state.profile || {};
  const { usedKB } = getStorageUsage();

  return `
    <div>
      <div style="margin-bottom: var(--space-6);">
        <h1 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold);">Settings</h1>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Customize preferences, appearance, backups, and data management.</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: var(--space-6); max-width: 720px;">
        <!-- Profile Settings -->
        <div class="card p-5">
          <h3 class="card-title" style="margin-bottom: var(--space-4);">Profile</h3>
          <div class="form-group">
            <label class="form-label" for="setting-name">Display Name</label>
            <input type="text" id="setting-name" class="form-input" value="${escapeHTML(profile.name || '')}" onchange="window.onProfileNameChange(this.value)">
          </div>
        </div>

        <!-- Appearance Settings -->
        <div class="card p-5">
          <h3 class="card-title" style="margin-bottom: var(--space-4);">Appearance</h3>
          <div class="form-group">
            <label class="form-label">Theme Mode</label>
            <select class="form-select" onchange="window.onThemeSettingChange(this.value)">
              <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System Default</option>
              <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Theme</option>
              <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
            </select>
          </div>

          <div class="form-group" style="margin-top: var(--space-4);">
            <label class="form-label">Accent Color</label>
            <div class="color-palette-grid">
              ${['green', 'purple', 'blue', 'orange', 'rose'].map((acc) => `
                <button type="button" class="btn ${settings.accent === acc ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="window.onAccentSettingChange('${acc}')">
                  ${acc.toUpperCase()}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="card p-5">
          <h3 class="card-title" style="margin-bottom: var(--space-4);">Notifications</h3>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
            <div>
              <strong>Desktop Notifications</strong>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-text-muted);">Receive timely alerts when habits are scheduled.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.requestNotification()">Enable Alerts</button>
          </div>
        </div>

        <!-- Data Management -->
        <div class="card p-5">
          <h3 class="card-title" style="margin-bottom: var(--space-4);">Data & Storage</h3>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-4);">
            Storage quota: ~${usedKB} KB used. All data is saved strictly inside your local browser.
          </p>

          <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-4);">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.exportBackupJSON()">
              📥 Export JSON Backup
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.exportHistoryCSV()">
              📊 Export CSV History
            </button>
            <label class="btn btn-secondary btn-sm" style="margin: 0; cursor: pointer;">
              📤 Import JSON
              <input type="file" id="hf-import-file" accept=".json" style="display: none;" onchange="window.handleFileImport(this)">
            </label>
          </div>

          <hr style="border: none; border-top: 1px solid var(--color-border); margin: var(--space-4) 0;">

          <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.loadStarterData()">
              Load Starter Sample Data
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.clearStarterData()">
              Clear Habits Data
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="window.promptWipeData()">
              Reset Everything
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function render404PageView() {
  return `
    <div class="empty-state" style="padding: var(--space-16) 0;">
      <h2 style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-extrabold);">404</h2>
      <p class="empty-state-desc">The page you were looking for does not exist.</p>
      <a href="#/dashboard" class="btn btn-primary">Return to Dashboard</a>
    </div>
  `;
}

/* ==========================================================================
   Global Window Hooks for HTML Event Handlers
   ========================================================================== */

window.toggleHabit = (id, date) => toggleHabitComplete(id, date);
window.toggleCommandPalette = () => toggleCommandPalette();
window.stepCounter = (id, delta, date) => stepCounterHabit(id, delta, date);
window.toggleTimer = (id, btn) => toggleHabitTimer(id, btn);
window.openNewHabitModal = () => openHabitModal();
window.promptEditUserName = () => {
  const current = getState().profile?.name || '';
  const newName = prompt('Enter your name:', current);
  if (newName !== null && newName.trim()) {
    updateProfile({ name: newName.trim() });
  }
};

window.onHabitCategoryFilter = (cat) => {
  habitCategoryFilter = cat;
  handleRouteChange();
};

window.onHabitSearchInput = (query) => {
  habitSearchQuery = query;
  handleRouteChange();
};

window.onHabitSortChange = (sortBy) => {
  habitSortBy = sortBy;
  handleRouteChange();
};

window.toggleHabitsViewMode = () => {
  habitViewMode = habitViewMode === 'grid' ? 'list' : 'grid';
  localStorage.setItem('hf_view_mode', habitViewMode);
  handleRouteChange();
};

window.addFromTemplate = (templateName) => {
  const tmpl = HABIT_TEMPLATES.find((t) => t.name === templateName);
  if (tmpl) openHabitModal(tmpl);
};

window.openHabitMenu = (habitId, triggerEl) => {
  const action = prompt('Select Action:\n1: Edit\n2: Duplicate\n3: Skip for Today\n4: Archive/Restore\n5: Delete');
  if (action === '1') {
    const habit = getState().habits.find((h) => h.id === habitId);
    if (habit) openHabitModal(habit);
  } else if (action === '2') {
    duplicateHabit(habitId);
  } else if (action === '3') {
    skipHabitForDay(habitId);
  } else if (action === '4') {
    toggleArchiveHabit(habitId);
    showToast({ message: 'Toggled habit archive status.', type: 'info' });
  } else if (action === '5') {
    promptDeleteHabit(habitId);
  }
};

window.navigateCalendar = (delta) => {
  navigateCalendarMonth(delta);
  handleRouteChange();
};

window.resetCalendarToToday = () => {
  resetCalendarToday();
  handleRouteChange();
};

window.openCalendarDayPanel = (date) => openDayPanel(date);
window.closeCalendarDayPanel = () => closeDayPanel();
window.backfillHabit = (id, date, action) => backfillHabitAction(id, date, action);

window.onHeatmapFilterChange = (val) => {
  heatmapFilter = val;
  handleRouteChange();
};

window.submitReflection = () => {
  const textEl = document.getElementById('reflection-text');
  const selectedMoodBtn = document.querySelector('.mood-emoji-btn.selected');
  const mood = selectedMoodBtn?.dataset.mood || 'good';
  if (textEl && textEl.value.trim()) {
    recordDailyReflection(textEl.value, mood);
    textEl.value = '';
    handleRouteChange();
  }
};

window.openNewGoalModal = () => openCreateGoalModal();
window.deleteGoal = (id) => promptDeleteGoal(id);

window.onProfileNameChange = (val) => {
  if (val.trim()) updateProfile({ name: val.trim() });
};

window.onThemeSettingChange = (theme) => {
  updateSettings({ theme });
};

window.onAccentSettingChange = (accent) => {
  updateSettings({ accent });
};

window.requestNotification = () => requestNotificationPermission();

window.exportBackupJSON = () => exportDataJSON(getState());
window.exportHistoryCSV = () => exportCompletionsCSV(getState().habits, getState().completions);

window.handleFileImport = (inputEl) => {
  const file = inputEl.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result;
    const { valid, error, parsedState, preview } = validateImportJSON(content);

    if (!valid) {
      showToast({ message: `Import Failed: ${error}`, type: 'error' });
      return;
    }

    showConfirmDialog({
      title: 'Import Data',
      message: `File contains ${preview.habitsCount} habits and ${preview.completionsCount} completions. Do you want to merge this with your current data?`,
      confirmText: 'Merge Data',
      onConfirm: () => {
        importStateData(parsedState, 'merge');
        showToast({ message: 'Data imported and merged successfully! 🎉', type: 'success' });
      }
    });
  };
  reader.readAsText(file);
};

window.loadStarterData = () => {
  loadStarterSampleData();
  showToast({ message: 'Loaded 30 days of realistic sample habits! 🚀', type: 'success' });
};

window.clearStarterData = () => {
  clearSampleData();
  showToast({ message: 'Habits and completions cleared.', type: 'info' });
};

window.promptWipeData = () => {
  showTypeToConfirmModal({
    phrase: 'RESET',
    title: 'Reset All Data',
    message: 'This will irreversibly delete all habits, completions, goals, reflections, and settings. Are you completely sure?',
    onConfirm: () => {
      resetAllData();
      showToast({ message: 'All data was wiped.', type: 'warning' });
    }
  });
};

// Start when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
