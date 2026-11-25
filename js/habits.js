/**
 * HabitFlow Pro - Habits Management Controller
 * CRUD operations, completions, drag-and-drop reorder, templates gallery,
 * and habit item card renderers.
 * @module habits
 */

import {
  getState,
  addHabit,
  updateHabit,
  deleteHabit,
  toggleArchiveHabit,
  reorderHabits,
  setCompletion,
  removeCompletion,
  updateProfile
} from './state.js';
import { calculateHabitStreak, isHabitScheduledOnDate } from './streaks.js';
import { calculateCompletionXP } from './gamification.js';
import { getTodayDate, escapeHTML, generateId } from './utils.js';
import { showToast, showConfirmDialog, openModal, closeModal } from './ui.js';
import { triggerConfetti } from './confetti.js';

export const CATEGORIES = [
  'Health', 'Fitness', 'Education', 'Productivity',
  'Personal Growth', 'Lifestyle', 'Finance', 'Mindfulness', 'Social', 'Other'
];

export const HABIT_TEMPLATES = [
  {
    name: 'Hydrate 2 Liters',
    description: 'Drink 8 glasses of water throughout the day.',
    category: 'Health',
    emoji: '💧',
    color: '#0284c7',
    type: 'counter',
    targetValue: 8,
    unit: 'glasses',
    frequency: 'daily',
    timeOfDay: 'anytime',
    priority: 'high'
  },
  {
    name: 'Read 20 Pages',
    description: 'Read a book to stimulate imagination and focus.',
    category: 'Education',
    emoji: '📖',
    color: '#8b5cf6',
    type: 'timer',
    targetValue: 20,
    unit: 'mins',
    frequency: 'daily',
    timeOfDay: 'evening',
    priority: 'medium'
  },
  {
    name: '10-Minute Meditation',
    description: 'Calm the nervous system and practice mindfulness.',
    category: 'Mindfulness',
    emoji: '🧘',
    color: '#06b6d4',
    type: 'timer',
    targetValue: 10,
    unit: 'mins',
    frequency: 'weekdays',
    frequencyData: { days: [1, 2, 3, 4, 5] },
    timeOfDay: 'morning',
    priority: 'medium'
  },
  {
    name: 'Daily 5k Steps',
    description: 'Outdoor brisk walk to get sunlight and movement.',
    category: 'Fitness',
    emoji: '👟',
    color: '#10b981',
    type: 'boolean',
    targetValue: 1,
    unit: '',
    frequency: 'daily',
    timeOfDay: 'morning',
    priority: 'high'
  },
  {
    name: 'Zero Sugar Day',
    description: 'Avoid all refined sweets, candy, and sugary drinks.',
    category: 'Health',
    emoji: '🥗',
    color: '#10b981',
    type: 'boolean',
    targetValue: 1,
    unit: '',
    frequency: 'daily',
    timeOfDay: 'evening',
    priority: 'low'
  },
  {
    name: 'Deep Work Block',
    description: '45 minutes uninterrupted deep work session.',
    category: 'Productivity',
    emoji: '⚡',
    color: '#f97316',
    type: 'timer',
    targetValue: 45,
    unit: 'mins',
    frequency: 'weekdays',
    frequencyData: { days: [1, 2, 3, 4, 5] },
    timeOfDay: 'morning',
    priority: 'high'
  }
];

// Active live timers map: { habitId: { intervalId, secondsRemaining, targetSeconds } }
const activeTimers = new Map();

/**
 * Toggles or completes a habit for a given date.
 * Handles XP award, streak increment, and celebratory toast with undo.
 *
 * @param {string} habitId
 * @param {string} [dateStr=today]
 * @param {number} [overrideVal]
 */
export function toggleHabitComplete(habitId, dateStr = getTodayDate(), overrideVal = null) {
  const state = getState();
  const habit = (state.habits || []).find((h) => h.id === habitId);
  if (!habit) return;

  const existing = (state.completions || []).find((c) => c.habitId === habitId && c.date === dateStr);

  // If already done, toggle off (Undo)
  if (existing && existing.status === 'done') {
    const previous = removeCompletion(habitId, dateStr);
    showToast({
      message: `Unmarked "${habit.name}".`,
      type: 'info',
      duration: 5000,
      actionLabel: 'Undo',
      onAction: () => {
        setCompletion(habitId, dateStr, previous.value, 'done', previous.note, previous.mood);
      }
    });
    return;
  }

  // Otherwise, complete it
  const targetVal = overrideVal !== null ? overrideVal : habit.targetValue || 1;
  const record = setCompletion(habitId, dateStr, targetVal, 'done');

  // Award XP
  if (state.settings?.gamificationEnabled !== false) {
    const streakInfo = calculateHabitStreak(habit, state.completions, dateStr);
    const xpEarned = calculateCompletionXP(habit, streakInfo.currentStreak);
    const newXP = (state.profile?.xp || 0) + xpEarned;
    updateProfile({ xp: newXP });
  }

  // Check if all today's scheduled habits are done
  checkAllTodayDoneCelebration();

  showToast({
    message: `Completed "${habit.name}"! +XP earned.`,
    type: 'success',
    duration: 5000,
    actionLabel: 'Undo',
    onAction: () => {
      removeCompletion(habitId, dateStr);
    }
  });
}

/**
 * Updates a counter habit by delta (+1 or -1).
 * @param {string} habitId
 * @param {number} delta
 * @param {string} [dateStr=today]
 */
export function stepCounterHabit(habitId, delta, dateStr = getTodayDate()) {
  const state = getState();
  const habit = (state.habits || []).find((h) => h.id === habitId);
  if (!habit) return;

  const existing = (state.completions || []).find((c) => c.habitId === habitId && c.date === dateStr);
  const currentVal = existing ? existing.value || 0 : 0;
  const target = habit.targetValue || 1;
  const nextVal = Math.max(0, currentVal + delta);

  if (nextVal === 0 && existing) {
    removeCompletion(habitId, dateStr);
    return;
  }

  const isComplete = nextVal >= target;
  setCompletion(habitId, dateStr, nextVal, isComplete ? 'done' : 'partial');

  if (isComplete && (!existing || existing.status !== 'done')) {
    checkAllTodayDoneCelebration();
    showToast({ message: `Target hit for "${habit.name}"! 🎉`, type: 'success' });
  }
}

/**
 * Toggles a live timer for a habit.
 * @param {string} habitId
 * @param {HTMLElement} btnEl
 */
export function toggleHabitTimer(habitId, btnEl) {
  const state = getState();
  const habit = (state.habits || []).find((h) => h.id === habitId);
  if (!habit) return;

  if (activeTimers.has(habitId)) {
    // Pause / Stop
    const timer = activeTimers.get(habitId);
    clearInterval(timer.intervalId);
    activeTimers.delete(habitId);
    if (btnEl) btnEl.classList.remove('running');
    showToast({ message: `Paused timer for "${habit.name}".`, type: 'info' });
    return;
  }

  // Start timer
  const targetMinutes = habit.targetValue || 15;
  const targetSeconds = targetMinutes * 60;
  let elapsed = 0;

  if (btnEl) btnEl.classList.add('running');
  showToast({ message: `Timer started for "${habit.name}" (${targetMinutes} mins).`, type: 'info' });

  const intervalId = setInterval(() => {
    elapsed += 1;
    const remaining = Math.max(0, targetSeconds - elapsed);
    const minsLeft = Math.floor(remaining / 60);
    const secsLeft = remaining % 60;

    if (btnEl) {
      btnEl.querySelector('.timer-display').textContent = `${minsLeft}:${String(secsLeft).padStart(2, '0')}`;
    }

    if (remaining <= 0) {
      clearInterval(intervalId);
      activeTimers.delete(habitId);
      if (btnEl) btnEl.classList.remove('running');
      toggleHabitComplete(habitId, getTodayDate(), habit.targetValue);
      triggerConfetti(3000);
      showToast({ message: `Timer finished! "${habit.name}" completed! ⏱️`, type: 'success' });
    }
  }, 1000);

  activeTimers.set(habitId, { intervalId, targetSeconds });
}

/**
 * Marks a habit as skipped for today (rest / vacation / sick day).
 * @param {string} habitId
 * @param {string} [dateStr=today]
 */
export function skipHabitForDay(habitId, dateStr = getTodayDate()) {
  const state = getState();
  const habit = (state.habits || []).find((h) => h.id === habitId);
  if (!habit) return;

  setCompletion(habitId, dateStr, 0, 'skipped', 'Marked as rest / skip day.');
  showToast({
    message: `Marked "${habit.name}" as skipped (streak protected).`,
    type: 'warning',
    duration: 5000,
    actionLabel: 'Undo',
    onAction: () => removeCompletion(habitId, dateStr)
  });
}

/**
 * Checks if 100% of today's scheduled habits are done; if so, triggers confetti!
 */
export function checkAllTodayDoneCelebration() {
  const state = getState();
  const today = getTodayDate();
  const activeHabits = (state.habits || []).filter((h) => !h.archived && isHabitScheduledOnDate(h, today));
  if (activeHabits.length === 0) return;

  const completionsMap = new Map((state.completions || []).filter((c) => c.date === today).map((c) => [c.habitId, c]));
  const allDone = activeHabits.every((h) => {
    const c = completionsMap.get(h.id);
    return c && (c.status === 'done' || c.status === 'skipped');
  });

  if (allDone) {
    setTimeout(() => {
      triggerConfetti(3500);
      showToast({
        message: '🏆 Outstanding! You completed all scheduled habits for today!',
        type: 'success',
        duration: 6000
      });
    }, 200);
  }
}

/**
 * Opens modal for adding or editing a habit.
 * @param {Object} [habitToEdit=null]
 */
export function openHabitModal(habitToEdit = null) {
  const isEdit = Boolean(habitToEdit && habitToEdit.id);
  const modalId = 'hf-habit-form-modal';
  let backdrop = document.getElementById(modalId);

  const habit = habitToEdit || {
    name: '',
    description: '',
    category: 'Productivity',
    emoji: '🎯',
    color: '#10b981',
    type: 'boolean',
    targetValue: 1,
    unit: '',
    frequency: 'daily',
    frequencyData: { days: [1, 2, 3, 4, 5] },
    timeOfDay: 'anytime',
    reminderTime: '',
    priority: 'medium'
  };

  const emojiList = ['🎯', '💧', '👟', '📖', '🧘', '⚡', '🥗', '🏋️', '🚴', '💻', '🎨', '✍️', '🌱', '☀️', '🌙', '🧠'];
  const colorList = ['#10b981', '#8b5cf6', '#2563eb', '#f97316', '#f43f5e', '#06b6d4', '#eab308'];

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit Habit' : 'Create New Habit'}</h3>
        <button type="button" class="btn-icon btn-icon-sm close-modal-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <form id="hf-habit-form" novalidate style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
        <div class="modal-body">
          <div class="form-group" id="group-name">
            <label class="form-label" for="habit-name-input">Habit Name *</label>
            <input type="text" id="habit-name-input" class="form-input" required placeholder="e.g. Drink 2L Water" value="${escapeHTML(habit.name)}">
            <div class="form-error">Please provide a habit name.</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="habit-desc-input">Description (Optional)</label>
            <textarea id="habit-desc-input" class="form-textarea" placeholder="Why is this habit important to you?">${escapeHTML(habit.description || '')}</textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="habit-category-select" class="form-select">
                ${CATEGORIES.map((c) => `<option value="${c}" ${c === habit.category ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select id="habit-priority-select" class="form-select">
                <option value="low" ${habit.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${habit.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${habit.priority === 'high' ? 'selected' : ''}>High</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Emoji Icon</label>
            <div class="emoji-grid" id="habit-emoji-picker">
              ${emojiList.map((e) => `<button type="button" class="emoji-btn ${e === habit.emoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>`).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Accent Color</label>
            <div class="color-palette-grid" id="habit-color-picker">
              ${colorList.map((col) => `<div class="color-swatch ${col === habit.color ? 'selected' : ''}" data-color="${col}" style="background-color: ${col};"></div>`).join('')}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Tracking Type</label>
              <select id="habit-type-select" class="form-select">
                <option value="boolean" ${habit.type === 'boolean' ? 'selected' : ''}>Yes/No (Checkmark)</option>
                <option value="counter" ${habit.type === 'counter' ? 'selected' : ''}>Counter (e.g. 8 Glasses)</option>
                <option value="timer" ${habit.type === 'timer' ? 'selected' : ''}>Timer (e.g. 30 Mins)</option>
              </select>
            </div>
            <div class="form-group" id="habit-target-group" style="${habit.type === 'boolean' ? 'display: none;' : ''}">
              <label class="form-label">Daily Target & Unit</label>
              <div style="display: flex; gap: var(--space-2);">
                <input type="number" id="habit-target-val" class="form-input" style="width: 80px;" min="1" value="${habit.targetValue || 1}">
                <input type="text" id="habit-target-unit" class="form-input" placeholder="unit (e.g. glasses, mins)" value="${escapeHTML(habit.unit || '')}">
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Frequency</label>
              <select id="habit-frequency-select" class="form-select">
                <option value="daily" ${habit.frequency === 'daily' ? 'selected' : ''}>Every Day</option>
                <option value="weekdays" ${habit.frequency === 'weekdays' ? 'selected' : ''}>Weekdays (Mon-Fri)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Time of Day</label>
              <select id="habit-time-select" class="form-select">
                <option value="anytime" ${habit.timeOfDay === 'anytime' ? 'selected' : ''}>Anytime</option>
                <option value="morning" ${habit.timeOfDay === 'morning' ? 'selected' : ''}>Morning</option>
                <option value="afternoon" ${habit.timeOfDay === 'afternoon' ? 'selected' : ''}>Afternoon</option>
                <option value="evening" ${habit.timeOfDay === 'evening' ? 'selected' : ''}>Evening</option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary cancel-modal-btn">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Habit'}</button>
        </div>
      </form>
    </div>
  `;

  let selectedEmoji = habit.emoji || '🎯';
  let selectedColor = habit.color || '#10b981';

  // Emoji picker listener
  backdrop.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.onclick = () => {
      backdrop.querySelectorAll('.emoji-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmoji = btn.dataset.emoji;
    };
  });

  // Color picker listener
  backdrop.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.onclick = () => {
      backdrop.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = swatch.dataset.color;
    };
  });

  // Type change show/hide target input
  const typeSelect = backdrop.querySelector('#habit-type-select');
  const targetGroup = backdrop.querySelector('#habit-target-group');
  typeSelect.onchange = () => {
    targetGroup.style.display = typeSelect.value === 'boolean' ? 'none' : 'block';
  };

  // Form submission with validation
  const form = backdrop.querySelector('#hf-habit-form');
  const nameInput = backdrop.querySelector('#habit-name-input');
  const descInput = backdrop.querySelector('#habit-desc-input');

  if (nameInput) {
    nameInput.oninput = () => {
      backdrop.querySelector('#group-name')?.classList.remove('has-error');
    };
  }

  if (descInput) {
    descInput.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        form.requestSubmit();
      }
    };
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const nameVal = nameInput ? nameInput.value.trim() : '';

    if (!nameVal) {
      backdrop.querySelector('#group-name')?.classList.add('has-error');
      nameInput?.focus();
      return;
    }

    const category = backdrop.querySelector('#habit-category-select').value;
    const priority = backdrop.querySelector('#habit-priority-select').value;
    const type = typeSelect.value;
    const targetValue = Math.max(1, Number(backdrop.querySelector('#habit-target-val').value) || 1);
    const unit = backdrop.querySelector('#habit-target-unit').value.trim();
    const frequency = backdrop.querySelector('#habit-frequency-select').value;
    const timeOfDay = backdrop.querySelector('#habit-time-select').value;
    const description = backdrop.querySelector('#habit-desc-input').value.trim();

    const payload = {
      name: nameVal,
      description,
      category,
      priority,
      emoji: selectedEmoji,
      color: selectedColor,
      type,
      targetValue: type === 'boolean' ? 1 : targetValue,
      unit: type === 'boolean' ? '' : unit,
      frequency,
      frequencyData: frequency === 'weekdays' ? { days: [1, 2, 3, 4, 5] } : {},
      timeOfDay,
      startDate: habit.startDate || getTodayDate()
    };

    if (isEdit) {
      updateHabit(habit.id, payload);
      showToast({ message: `Updated "${nameVal}".`, type: 'success' });
    } else {
      payload.id = generateId('h');
      payload.archived = false;
      payload.createdAt = getTodayDate();
      addHabit(payload);
      showToast({ message: `Habit "${nameVal}" created!`, type: 'success' });
    }

    closeModal(modalId);
  };

  backdrop.querySelector('.close-modal-btn').onclick = () => closeModal(modalId);
  backdrop.querySelector('.cancel-modal-btn').onclick = () => closeModal(modalId);

  openModal(modalId);
}

/**
 * Prompts user to delete a habit with confirmation and 5-second undo toast.
 * @param {string} habitId
 */
export function promptDeleteHabit(habitId) {
  const state = getState();
  const habit = (state.habits || []).find((h) => h.id === habitId);
  if (!habit) return;

  showConfirmDialog({
    title: 'Delete Habit?',
    message: `Are you sure you want to delete "${habit.name}"? This removes all completion history.`,
    confirmText: 'Delete Habit',
    danger: true,
    onConfirm: () => {
      const deleted = deleteHabit(habitId);
      showToast({
        message: `Deleted "${habit.name}".`,
        type: 'warning',
        duration: 5000,
        actionLabel: 'Undo',
        onAction: () => {
          if (deleted) addHabit(deleted);
        }
      });
    }
  });
}

/**
 * Creates a duplicate of an existing habit.
 * @param {string} habitId
 */
export function duplicateHabit(habitId) {
  const state = getState();
  const habit = (state.habits || []).find((h) => h.id === habitId);
  if (!habit) return;

  const clone = {
    ...habit,
    id: generateId('h'),
    name: `${habit.name} (Copy)`,
    createdAt: getTodayDate(),
    startDate: getTodayDate(),
    orderIndex: (state.habits || []).length
  };

  addHabit(clone);
  showToast({ message: `Duplicated "${habit.name}".`, type: 'success' });
}

/**
 * Renders an accessible habit item card HTML.
 * @param {Object} habit
 * @param {Array} completions
 * @param {string} [dateStr=today]
 * @returns {string} HTML string
 */
export function renderHabitCard(habit, completions, dateStr = getTodayDate()) {
  const record = (completions || []).find((c) => c.habitId === habit.id && c.date === dateStr);
  const isDone = record && record.status === 'done';
  const isSkipped = record && record.status === 'skipped';
  const streak = calculateHabitStreak(habit, completions, dateStr);

  let interactiveControlHTML = '';

  if (habit.type === 'counter') {
    const currentVal = record ? record.value || 0 : 0;
    const target = habit.targetValue || 1;
    interactiveControlHTML = `
      <div class="habit-counter-widget" onclick="event.stopPropagation();">
        <button type="button" class="habit-counter-btn" onclick="window.stepCounter('${habit.id}', -1, '${dateStr}')" aria-label="Decrease counter">-</button>
        <span class="habit-counter-text">${currentVal} / ${target} ${escapeHTML(habit.unit || '')}</span>
        <button type="button" class="habit-counter-btn" onclick="window.stepCounter('${habit.id}', 1, '${dateStr}')" aria-label="Increase counter">+</button>
      </div>
    `;
  } else if (habit.type === 'timer') {
    const isRunning = activeTimers.has(habit.id);
    interactiveControlHTML = `
      <button type="button" class="habit-timer-btn ${isRunning ? 'running' : ''}" onclick="event.stopPropagation(); window.toggleTimer('${habit.id}', this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span class="timer-display">${habit.targetValue}m</span>
      </button>
    `;
  }

  return `
    <div class="habit-card ${isDone ? 'is-completed' : ''}" data-id="${habit.id}">
      <button type="button" class="btn-habit-check ${isDone ? 'done' : isSkipped ? 'skipped' : ''}" 
        onclick="window.toggleHabit('${habit.id}', '${dateStr}')" 
        aria-label="${isDone ? 'Unmark habit' : 'Complete habit'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>

      <div class="habit-details">
        <div class="habit-header-row">
          <span class="habit-emoji">${habit.emoji || '🎯'}</span>
          <span class="habit-name">${escapeHTML(habit.name)}</span>
        </div>
        <div class="habit-meta-row">
          <span class="badge badge-neutral" style="border-left: 3px solid ${habit.color || 'var(--color-accent)'};">${escapeHTML(habit.category)}</span>
          <span class="streak-indicator">
            🔥 ${streak.currentStreak}d
          </span>
          ${habit.priority === 'high' ? '<span class="badge badge-danger">High</span>' : ''}
          ${isSkipped ? '<span class="badge badge-warning">Skipped</span>' : ''}
        </div>
      </div>

      ${interactiveControlHTML}

      <div class="habit-actions-dropdown" onclick="event.stopPropagation();">
        <button type="button" class="btn-icon btn-icon-sm" onclick="window.openHabitMenu('${habit.id}', this)" aria-label="Habit options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
        </button>
      </div>
    </div>
  `;
}
