/**
 * HabitFlow Pro - Goals Engine
 * Goal tracking linked to habit completions or streak targets,
 * automatic evaluation, and milestone celebrations.
 * @module goals
 */

import { getState, addGoal, updateGoal, deleteGoal } from './state.js';
import { calculateHabitStreak } from './streaks.js';
import { getTodayDate, generateId, escapeHTML, diffInDays } from './utils.js';
import { showToast, showConfirmDialog, openModal, closeModal } from './ui.js';
import { triggerConfetti } from './confetti.js';

/**
 * Re-evaluates all goals progress based on current habit states.
 */
export function evaluateAllGoals() {
  const state = getState();
  const goals = state.goals || [];
  const habits = state.habits || [];
  const completions = state.completions || [];
  const today = getTodayDate();

  let stateChanged = false;

  goals.forEach((goal) => {
    if (goal.status === 'completed') return;

    const habit = habits.find((h) => h.id === goal.habitId);
    let progressVal = 0;

    if (goal.type === 'streak' && habit) {
      const streak = calculateHabitStreak(habit, completions, today);
      progressVal = streak.currentStreak;
    } else if (goal.type === 'count' && habit) {
      progressVal = completions.filter((c) => c.habitId === habit.id && c.status === 'done').length;
    }

    if (progressVal !== goal.currentValue) {
      goal.currentValue = progressVal;
      stateChanged = true;
    }

    // Check if target reached
    if (progressVal >= goal.targetValue && goal.status === 'active') {
      goal.status = 'completed';
      stateChanged = true;
      triggerConfetti(3500);
      showToast({
        message: `🎯 Goal Accomplished: "${goal.title}"! Fantastic work!`,
        type: 'success',
        duration: 6000
      });
    }
  });

  return stateChanged;
}

/**
 * Opens modal dialog to create a new goal.
 */
export function openCreateGoalModal() {
  const modalId = 'hf-goal-form-modal';
  let backdrop = document.getElementById(modalId);
  const state = getState();
  const habits = (state.habits || []).filter((h) => !h.archived);

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">Create New Goal</h3>
        <button type="button" class="btn-icon btn-icon-sm close-modal-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <form id="hf-goal-form" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
        <div class="modal-body">
          <div class="form-group" id="goal-group-title">
            <label class="form-label" for="goal-title-input">Goal Title *</label>
            <input type="text" id="goal-title-input" class="form-input" required placeholder="e.g. Read 30 Days in a Row">
          </div>

          <div class="form-group">
            <label class="form-label">Linked Habit *</label>
            <select id="goal-habit-select" class="form-select" required>
              ${habits.map((h) => `<option value="${h.id}">${h.emoji} ${escapeHTML(h.name)}</option>`).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Goal Target Type</label>
              <select id="goal-type-select" class="form-select">
                <option value="streak">Streak Milestone (Days)</option>
                <option value="count">Total Completions (Count)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Target Number</label>
              <input type="number" id="goal-target-input" class="form-input" min="1" value="30">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="goal-deadline-input">Target Deadline (Optional)</label>
            <input type="date" id="goal-deadline-input" class="form-input">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary cancel-modal-btn">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Goal</button>
        </div>
      </form>
    </div>
  `;

  backdrop.querySelector('#hf-goal-form').onsubmit = (e) => {
    e.preventDefault();
    const title = backdrop.querySelector('#goal-title-input').value.trim();
    if (!title) return;

    const habitId = backdrop.querySelector('#goal-habit-select').value;
    const type = backdrop.querySelector('#goal-type-select').value;
    const targetValue = Math.max(1, Number(backdrop.querySelector('#goal-target-input').value) || 30);
    const deadline = backdrop.querySelector('#goal-deadline-input').value || null;

    addGoal({
      id: generateId('g'),
      title,
      habitId,
      type,
      targetValue,
      currentValue: 0,
      deadline,
      status: 'active',
      createdAt: getTodayDate()
    });

    closeModal(modalId);
    showToast({ message: `Goal "${title}" created! 🎯`, type: 'success' });
  };

  backdrop.querySelector('.close-modal-btn').onclick = () => closeModal(modalId);
  backdrop.querySelector('.cancel-modal-btn').onclick = () => closeModal(modalId);

  openModal(modalId);
}

/**
 * Prompts user to delete a goal.
 * @param {string} goalId
 */
export function promptDeleteGoal(goalId) {
  showConfirmDialog({
    title: 'Delete Goal?',
    message: 'Are you sure you want to delete this goal?',
    confirmText: 'Delete Goal',
    danger: true,
    onConfirm: () => {
      deleteGoal(goalId);
      showToast({ message: 'Goal removed.', type: 'info' });
    }
  });
}
