/**
 * HabitFlow Pro - Heatmap Visualization Engine
 * Pure CSS-grid yearly contribution heatmap with 5 intensity levels,
 * habit filtering, and interactive tooltips.
 * @module heatmap
 */

import { addDays, getTodayDate, parseDate, getDayOfWeek } from './utils.js';
import { isHabitScheduledOnDate } from './streaks.js';

/**
 * Builds the yearly heatmap matrix HTML and data.
 * @param {Object} state
 * @param {string} [habitFilter='all']
 * @param {number} [days=364] (52 weeks * 7 days)
 * @returns {string} HTML string
 */
export function renderHeatmap(state, habitFilter = 'all', days = 364) {
  const today = getTodayDate();
  const habits = (state.habits || []).filter((h) => !h.archived);
  const targetHabits = habitFilter === 'all' ? habits : habits.filter((h) => h.id === habitFilter);
  const completions = state.completions || [];

  // Align start date to Sunday so matrix columns represent weeks
  const todayDate = parseDate(today);
  const dayOfWeek = todayDate.getDay(); // 0 is Sunday
  const totalDays = days + dayOfWeek;
  const startDate = addDays(today, -totalDays + 1);

  // Group completions by date for quick lookup
  const dateStatsMap = new Map();

  for (let i = 0; i < totalDays; i++) {
    const curDate = addDays(startDate, i);
    let scheduled = 0;
    let completed = 0;

    targetHabits.forEach((h) => {
      if (isHabitScheduledOnDate(h, curDate)) {
        scheduled++;
        const record = completions.find((c) => c.habitId === h.id && c.date === curDate && c.status === 'done');
        if (record) completed++;
      }
    });

    const pct = scheduled > 0 ? (completed / scheduled) : 0;
    let level = 0;
    if (pct > 0.75) level = 4;
    else if (pct > 0.5) level = 3;
    else if (pct > 0.25) level = 2;
    else if (pct > 0) level = 1;

    dateStatsMap.set(curDate, { scheduled, completed, pct, level });
  }

  // Generate cells HTML
  let cellsHTML = '';
  for (let i = 0; i < totalDays; i++) {
    const curDate = addDays(startDate, i);
    const stats = dateStatsMap.get(curDate) || { scheduled: 0, completed: 0, level: 0 };
    const tooltipText = `${curDate}: ${stats.completed}/${stats.scheduled} habits completed (${Math.round(stats.pct * 100)}%)`;

    cellsHTML += `
      <div class="heatmap-cell level-${stats.level}" 
        data-date="${curDate}"
        data-tooltip="${tooltipText}"
        tabindex="0"
        aria-label="${tooltipText}">
      </div>
    `;
  }

  return `
    <div class="card heatmap-card">
      <div class="card-header">
        <h3 class="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Annual Consistency Matrix
        </h3>
        <div style="display: flex; gap: var(--space-3); align-items: center;">
          <select id="heatmap-habit-filter" class="form-select" style="min-height: 36px; padding: 4px 12px; font-size: var(--font-size-xs);" onchange="window.onHeatmapFilterChange(this.value)">
            <option value="all" ${habitFilter === 'all' ? 'selected' : ''}>All Active Habits</option>
            ${habits.map((h) => `<option value="${h.id}" ${habitFilter === h.id ? 'selected' : ''}>${h.emoji} ${h.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card-body">
        <div class="heatmap-scroll-wrap">
          <div class="heatmap-matrix">
            ${cellsHTML}
          </div>
        </div>
        <div class="heatmap-legend">
          <span>Less</span>
          <div class="heatmap-cell level-0" style="display:inline-block;"></div>
          <div class="heatmap-cell level-1" style="display:inline-block;"></div>
          <div class="heatmap-cell level-2" style="display:inline-block;"></div>
          <div class="heatmap-cell level-3" style="display:inline-block;"></div>
          <div class="heatmap-cell level-4" style="display:inline-block;"></div>
          <span>More</span>
        </div>
      </div>
    </div>
  `;
}
