/**
 * HabitFlow Pro - Interactive Calendar View
 * Monthly and weekly grid, day inspection side panel, and retroactive backfilling.
 * @module calendar
 */

import { getState, setCompletion, removeCompletion } from './state.js';
import { getTodayDate, addDays, parseDate, formatDate, escapeHTML } from './utils.js';
import { isHabitScheduledOnDate } from './streaks.js';
import { showToast } from './ui.js';

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth(); // 0-11
let activeSidePanelDate = null;

/**
 * Renders the calendar page view.
 * @param {Object} state
 * @returns {string} HTML string
 */
export function renderCalendarView(state) {
  const today = getTodayDate();
  const firstDayOfMonth = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const lastDayOfMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthLabel = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  const habits = (state.habits || []).filter((h) => !h.archived);
  const completions = state.completions || [];

  // Generate day cells (including previous month overflow padding)
  let dayCellsHTML = '';

  // Previous month trailing days
  const prevMonthLastDate = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();
  for (let p = startDayOfWeek - 1; p >= 0; p--) {
    const prevDayNum = prevMonthLastDate - p;
    dayCellsHTML += `
      <div class="calendar-day-cell other-month" aria-hidden="true">
        <span class="calendar-day-number">${prevDayNum}</span>
      </div>
    `;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = curDateStr === today;
    const isFuture = curDateStr > today;

    let scheduledHabits = 0;
    let doneHabits = 0;
    let skippedHabits = 0;

    habits.forEach((h) => {
      if (isHabitScheduledOnDate(h, curDateStr)) {
        scheduledHabits++;
        const rec = completions.find((c) => c.habitId === h.id && c.date === curDateStr);
        if (rec) {
          if (rec.status === 'done') doneHabits++;
          if (rec.status === 'skipped') skippedHabits++;
        }
      }
    });

    let dotsHTML = '';
    for (let dot = 0; dot < Math.min(doneHabits, 5); dot++) {
      dotsHTML += '<span class="calendar-day-dot done"></span>';
    }
    for (let dot = 0; dot < Math.min(skippedHabits, 2); dot++) {
      dotsHTML += '<span class="calendar-day-dot skipped"></span>';
    }

    dayCellsHTML += `
      <div class="calendar-day-cell ${isToday ? 'is-today' : ''} ${isFuture ? 'future-day' : ''}" 
        data-date="${curDateStr}"
        onclick="window.openCalendarDayPanel('${curDateStr}')"
        tabindex="0"
        role="button"
        aria-label="${curDateStr}: ${doneHabits} of ${scheduledHabits} completed">
        <span class="calendar-day-number">${d}</span>
        <div class="calendar-day-status-dots">${dotsHTML}</div>
      </div>
    `;
  }

  return `
    <div>
      <div class="calendar-controls">
        <div class="calendar-month-title">
          <span>${monthLabel}</span>
          <div style="display: flex; gap: var(--space-1);">
            <button type="button" class="btn-icon btn-icon-sm" onclick="window.navigateCalendar(-1)" aria-label="Previous month">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button type="button" class="btn-icon btn-icon-sm" onclick="window.navigateCalendar(1)" aria-label="Next month">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-3);">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.resetCalendarToToday()">Today</button>
        </div>
      </div>

      <div class="card p-4">
        <div class="calendar-grid">
          <div class="calendar-weekday-label">Sun</div>
          <div class="calendar-weekday-label">Mon</div>
          <div class="calendar-weekday-label">Tue</div>
          <div class="calendar-weekday-label">Wed</div>
          <div class="calendar-weekday-label">Thu</div>
          <div class="calendar-weekday-label">Fri</div>
          <div class="calendar-weekday-label">Sat</div>
          ${dayCellsHTML}
        </div>
      </div>

      <!-- Slide-in day detail panel -->
      <div id="hf-calendar-day-panel" class="day-details-panel">
        <div class="modal-header">
          <h3 class="modal-title" id="hf-day-panel-title">Habits for Date</h3>
          <button type="button" class="btn-icon btn-icon-sm" onclick="window.closeCalendarDayPanel()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body" id="hf-day-panel-body">
          <!-- Dynamic list of habits for selected date -->
        </div>
      </div>
    </div>
  `;
}

/**
 * Changes active calendar month.
 * @param {number} delta -1 or 1
 */
export function navigateCalendarMonth(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear -= 1;
  } else if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear += 1;
  }
}

/**
 * Resets calendar view back to current month and year.
 */
export function resetCalendarToday() {
  const now = new Date();
  currentCalendarYear = now.getFullYear();
  currentCalendarMonth = now.getMonth();
}

/**
 * Opens day details side-panel for backfilling and reflections.
 * @param {string} dateStr
 */
export function openDayPanel(dateStr) {
  activeSidePanelDate = dateStr;
  const panel = document.getElementById('hf-calendar-day-panel');
  if (!panel) return;

  const titleEl = document.getElementById('hf-day-panel-title');
  const bodyEl = document.getElementById('hf-day-panel-body');

  titleEl.textContent = `Schedule: ${dateStr}`;

  const state = getState();
  const habits = (state.habits || []).filter((h) => !h.archived && isHabitScheduledOnDate(h, dateStr));
  const completions = (state.completions || []).filter((c) => c.date === dateStr);
  const completionsMap = new Map(completions.map((c) => [c.habitId, c]));

  if (habits.length === 0) {
    bodyEl.innerHTML = `
      <div class="empty-state" style="padding: var(--space-8) 0;">
        <p class="empty-state-desc">No habits were scheduled for this day.</p>
      </div>
    `;
  } else {
    let itemsHTML = '';
    habits.forEach((h) => {
      const rec = completionsMap.get(h.id);
      const isDone = rec && rec.status === 'done';
      const isSkipped = rec && rec.status === 'skipped';

      itemsHTML += `
        <div class="card p-3 mb-3" style="border: 1px solid var(--color-border);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span>${h.emoji}</span>
              <strong style="color: var(--color-text);">${escapeHTML(h.name)}</strong>
            </div>
            <span class="badge ${isDone ? 'badge-success' : isSkipped ? 'badge-warning' : 'badge-neutral'}">
              ${isDone ? 'Completed' : isSkipped ? 'Skipped' : 'Pending'}
            </span>
          </div>

          <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
            <button type="button" class="btn ${isDone ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="window.backfillHabit('${h.id}', '${dateStr}', '${isDone ? 'uncomplete' : 'done'}')">
              ${isDone ? 'Undo Complete' : 'Mark Done'}
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.backfillHabit('${h.id}', '${dateStr}', '${isSkipped ? 'uncomplete' : 'skip'}')">
              ${isSkipped ? 'Unskip' : 'Skip Day'}
            </button>
          </div>
        </div>
      `;
    });
    bodyEl.innerHTML = itemsHTML;
  }

  panel.classList.add('open');
}

/**
 * Closes the day details side panel.
 */
export function closeDayPanel() {
  const panel = document.getElementById('hf-calendar-day-panel');
  if (panel) panel.classList.remove('open');
}

/**
 * Retroactively updates habit status for a past date.
 * @param {string} habitId
 * @param {string} dateStr
 * @param {'done'|'skip'|'uncomplete'} action
 */
export function backfillHabitAction(habitId, dateStr, action) {
  if (action === 'uncomplete') {
    removeCompletion(habitId, dateStr);
    showToast({ message: 'Removed record for that date.', type: 'info' });
  } else if (action === 'skip') {
    setCompletion(habitId, dateStr, 0, 'skipped');
    showToast({ message: 'Marked date as skipped.', type: 'warning' });
  } else {
    setCompletion(habitId, dateStr, 1, 'done');
    showToast({ message: 'Backfilled completion successfully! ✅', type: 'success' });
  }
  openDayPanel(dateStr);
}
