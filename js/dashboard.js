/**
 * HabitFlow Pro - Dashboard Page View Controller
 * Time-aware greetings, animated progress ring, habit time-of-day clusters,
 * weekly strip, recent activity feed, and insight callouts.
 * @module dashboard
 */

import { getState, updateProfile } from './state.js';
import { getTodayDate, addDays, getRelativeDateLabel, escapeHTML } from './utils.js';
import { calculateHabitStreak, isHabitScheduledOnDate } from './streaks.js';
import { renderHabitCard } from './habits.js';
import { generateSmartInsights } from './insights.js';

const MOTIVATIONAL_QUOTES = [
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.', author: 'John C. Maxwell' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'The secret of your future is hidden in your daily routine.', author: 'Mike Murdock' }
];

/**
 * Returns time-appropriate greeting and icon.
 * @returns {{ text: string, icon: string }}
 */
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: '☀️' };
  if (hour < 18) return { text: 'Good afternoon', icon: '🌤️' };
  return { text: 'Good evening', icon: '🌙' };
}

/**
 * Renders the complete Dashboard view HTML.
 * @param {Object} state
 * @returns {string} HTML string
 */
export function renderDashboardView(state) {
  const today = getTodayDate();
  const greeting = getTimeGreeting();
  const userName = state.profile?.name || 'Explorer';

  // Rotating quote based on current date hash
  const quoteIdx = Math.abs(today.split('-').reduce((acc, part) => acc + Number(part), 0)) % MOTIVATIONAL_QUOTES.length;
  const quote = MOTIVATIONAL_QUOTES[quoteIdx];

  const habits = (state.habits || []).filter((h) => !h.archived);
  const scheduledToday = habits.filter((h) => isHabitScheduledOnDate(h, today));
  const completions = state.completions || [];
  const completionsTodayMap = new Map(completions.filter((c) => c.date === today).map((c) => [c.habitId, c]));

  let doneTodayCount = 0;
  let skippedTodayCount = 0;

  scheduledToday.forEach((h) => {
    const c = completionsTodayMap.get(h.id);
    if (c) {
      if (c.status === 'done') doneTodayCount++;
      if (c.status === 'skipped') skippedTodayCount++;
    }
  });

  const totalScheduled = scheduledToday.length;
  const pendingCount = Math.max(0, totalScheduled - doneTodayCount - skippedTodayCount);
  const completionRate = totalScheduled > 0 ? Math.round((doneTodayCount / totalScheduled) * 100) : 0;

  // Best streak
  let bestStreak = 0;
  habits.forEach((h) => {
    const s = calculateHabitStreak(h, completions, today);
    if (s.currentStreak > bestStreak) bestStreak = s.currentStreak;
  });

  // Circular progress ring calculation (circumference for r=22 is ~138.2)
  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (completionRate / 100) * ringCircumference;

  // 1. Weekly 7-Day Strip
  let weekStripHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const dObj = new Date(d);
    const isDayToday = d === today;
    const dayName = dObj.toLocaleDateString(undefined, { weekday: 'short' });
    const dayNum = dObj.getDate();

    let dayScheduled = 0;
    let dayDone = 0;

    habits.forEach((h) => {
      if (isHabitScheduledOnDate(h, d)) {
        dayScheduled++;
        if (completions.some((c) => c.habitId === h.id && c.date === d && c.status === 'done')) {
          dayDone++;
        }
      }
    });

    const isFull = dayScheduled > 0 && dayDone >= dayScheduled;
    const isPartial = dayDone > 0 && dayDone < dayScheduled;

    weekStripHTML += `
      <div class="week-day-cell ${isDayToday ? 'is-today' : ''}" onclick="window.location.hash='#/calendar'">
        <span class="week-day-name">${dayName}</span>
        <span class="week-day-number">${dayNum}</span>
        <div class="week-day-indicator ${isFull ? 'full' : isPartial ? 'partial' : ''}"></div>
      </div>
    `;
  }

  // 2. High-priority Smart Insight
  const insights = generateSmartInsights(state);
  const topInsight = insights[0] || null;

  // 3. Group scheduled habits by Time of Day
  const timeGroups = [
    { id: 'morning', label: 'Morning Rituals', icon: '☀️' },
    { id: 'afternoon', label: 'Afternoon Flow', icon: '🌤️' },
    { id: 'evening', label: 'Evening Routine', icon: '🌙' },
    { id: 'anytime', label: 'Anytime Today', icon: '⚡' }
  ];

  let habitsSectionsHTML = '';

  if (scheduledToday.length === 0) {
    habitsSectionsHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        <h4 class="empty-state-title">No Habits Scheduled Today</h4>
        <p class="empty-state-desc">You are completely free, or you can add new habits to begin tracking your progress.</p>
        <button type="button" class="btn btn-primary" onclick="window.openNewHabitModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create First Habit
        </button>
      </div>
    `;
  } else {
    timeGroups.forEach((group) => {
      const groupHabits = scheduledToday.filter((h) => (h.timeOfDay || 'anytime') === group.id);
      if (groupHabits.length > 0) {
        habitsSectionsHTML += `
          <div class="time-group-section">
            <div class="time-group-header">
              <span>${group.icon}</span>
              <span>${group.label}</span>
              <span class="badge badge-neutral" style="font-size: 0.7rem;">${groupHabits.length}</span>
            </div>
            <div class="habits-stack">
              ${groupHabits.map((h) => renderHabitCard(h, completions, today)).join('')}
            </div>
          </div>
        `;
      }
    });
  }

  // 4. Recent Activity Feed
  const recentCompletions = [...completions]
    .filter((c) => c.status === 'done' || c.status === 'skipped')
    .sort((a, b) => (b.completedAt || b.date).localeCompare(a.completedAt || a.date))
    .slice(0, 5);

  const habitMap = new Map(habits.map((h) => [h.id, h]));

  let activityHTML = '';
  if (recentCompletions.length === 0) {
    activityHTML = '<p style="font-size: var(--font-size-xs); color: var(--color-text-muted);">No activity logged yet. Check off a habit above!</p>';
  } else {
    activityHTML = recentCompletions.map((c) => {
      const h = habitMap.get(c.habitId);
      const isDone = c.status === 'done';
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle); font-size: var(--font-size-xs);">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span>${h ? h.emoji : '🎯'}</span>
            <strong style="color: var(--color-text);">${h ? escapeHTML(h.name) : 'Habit'}</strong>
          </div>
          <span style="color: var(--color-text-muted);">${getRelativeDateLabel(c.date)} &bull; ${isDone ? 'Done' : 'Skipped'}</span>
        </div>
      `;
    }).join('');
  }

  return `
    <div>
      <!-- Hero Greeting -->
      <div class="dashboard-hero">
        <div>
          <h1 class="greeting-title">
            ${greeting.icon} ${greeting.text}, 
            <span class="greeting-editable-name" onclick="window.promptEditUserName()" title="Click to edit name">
              ${escapeHTML(userName)}
            </span>
          </h1>
          <div class="dashboard-date">
            ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <!-- Rotating Motivational Quote -->
        <div class="quote-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>
          <div>"${escapeHTML(quote.text)}" — <em>${escapeHTML(quote.author)}</em></div>
        </div>
      </div>

      <!-- Stat Cards Grid -->
      <div class="stat-cards-grid">
        <div class="stat-card">
          <div class="stat-card-icon success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${doneTodayCount} / ${totalScheduled}</div>
            <div class="stat-card-label">Completed Today</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon accent">
            <div class="progress-ring-container">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle class="progress-ring-circle-bg" stroke-width="4" fill="transparent" r="${ringRadius}" cx="26" cy="26" />
                <circle class="progress-ring-circle-val" stroke-width="4" fill="transparent" r="${ringRadius}" cx="26" cy="26"
                  stroke-dasharray="${ringCircumference}"
                  stroke-dashoffset="${ringOffset}" />
              </svg>
              <div class="progress-ring-text">${completionRate}%</div>
            </div>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${completionRate}%</div>
            <div class="stat-card-label">Daily Progress</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon warning">
            <span style="font-size: 1.5rem;">🔥</span>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${bestStreak} Days</div>
            <div class="stat-card-label">Best Active Streak</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div class="stat-card-data">
            <div class="stat-card-value">${pendingCount}</div>
            <div class="stat-card-label">Pending Today</div>
          </div>
        </div>
      </div>

      <!-- Weekly Consistency Strip -->
      <div class="week-strip">
        ${weekStripHTML}
      </div>

      <!-- Smart Insight Banner (if present) -->
      ${topInsight ? `
        <div class="insight-card-banner">
          <div class="insight-card-content">
            <span class="insight-card-icon">${topInsight.icon}</span>
            <div>
              <div class="insight-card-title">${escapeHTML(topInsight.title)}</div>
              <div class="insight-card-desc">${escapeHTML(topInsight.description)}</div>
            </div>
          </div>
          <a href="#/statistics" class="btn btn-secondary btn-sm" style="flex-shrink: 0;">View Analytics &rarr;</a>
        </div>
      ` : ''}

      <!-- Main Columns: Today's Habits (Left) and Activity & Widgets (Right) -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-6);" class="dashboard-columns">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <h3 style="font-size: var(--font-size-md); font-weight: var(--font-weight-bold);">Today's Focus</h3>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.openNewHabitModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Habit
            </button>
          </div>
          ${habitsSectionsHTML}
        </div>

        <div>
          <!-- Recent Activity Card -->
          <div class="card p-4 mb-4">
            <h4 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); margin-bottom: var(--space-3);">Recent Activity</h4>
            ${activityHTML}
          </div>

          <!-- Quick Navigation Card -->
          <div class="card p-4">
            <h4 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); margin-bottom: var(--space-3);">Quick Tools</h4>
            <div style="display: flex; flex-direction: column; gap: var(--space-2);">
              <a href="#/calendar" class="btn btn-secondary btn-sm" style="justify-content: flex-start;">
                📅 Full Monthly Calendar
              </a>
              <a href="#/journal" class="btn btn-secondary btn-sm" style="justify-content: flex-start;">
                📝 Daily Reflection Journal
              </a>
              <a href="#/statistics" class="btn btn-secondary btn-sm" style="justify-content: flex-start;">
                📊 Detailed Charts & Stats
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
