/**
 * HabitFlow Pro - Central State & Reactive Pub/Sub Store
 * Single source of truth. Dispatches notifications on state mutations
 * and synchronizes across browser tabs via storage events.
 * @module state
 */

import { loadState, saveState, resetAllStorage } from './storage.js';
import { getSampleData } from '../data/sample-data.js';

let currentState = null;
const listeners = new Set();
let isInitialized = false;

/**
 * Initializes the central store from storage.
 * @returns {Object}
 */
export function initState() {
  if (isInitialized && currentState) return currentState;
  const { state } = loadState();
  currentState = state;
  isInitialized = true;

  // Listen for storage changes from other tabs
  window.addEventListener('storage', (event) => {
    if (event.key === 'habitflow_pro_state' && event.newValue) {
      try {
        const remoteState = JSON.parse(event.newValue);
        if (remoteState && remoteState.habits) {
          currentState = remoteState;
          notifyListeners('cross-tab-sync');
        }
      } catch (err) {
        console.warn('[State] Failed to sync remote storage change:', err);
      }
    }
  });

  return currentState;
}

/**
 * Returns current read-only state snapshot.
 * @returns {Object}
 */
export function getState() {
  if (!currentState) initState();
  return currentState;
}

/**
 * Subscribes a callback to state changes.
 * @param {Function} listener
 * @returns {Function} unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Dispatches notification to all registered listeners.
 * @param {string} [action]
 * @param {Object} [payload]
 */
function notifyListeners(action, payload) {
  listeners.forEach((listener) => {
    try {
      listener(currentState, action, payload);
    } catch (err) {
      console.error('[State] Error in subscriber listener:', err);
    }
  });
}

/**
 * Updates state and automatically persists to LocalStorage.
 * @param {Object} patch
 * @param {string} [action='update']
 * @param {boolean} [persist=true]
 */
export function updateState(patch, action = 'update', persist = true) {
  if (!currentState) initState();
  currentState = {
    ...currentState,
    ...patch
  };
  if (persist) {
    saveState(currentState);
  }
  notifyListeners(action, patch);
}

/* ==========================================================================
   Habit Mutations
   ========================================================================== */

export function addHabit(habit) {
  const habits = [...(currentState.habits || [])];
  habit.orderIndex = habits.length;
  habits.push(habit);
  updateState({ habits }, 'habit-add');
  return habit;
}

export function updateHabit(id, patch) {
  const habits = (currentState.habits || []).map((h) => {
    if (h.id === id) {
      return { ...h, ...patch, updatedAt: new Date().toISOString() };
    }
    return h;
  });
  updateState({ habits }, 'habit-update');
}

export function deleteHabit(id) {
  const deletedHabit = currentState.habits.find((h) => h.id === id);
  const habits = (currentState.habits || []).filter((h) => h.id !== id);
  // Also clean completions
  const completions = (currentState.completions || []).filter((c) => c.habitId !== id);
  updateState({ habits, completions }, 'habit-delete');
  return deletedHabit;
}

export function toggleArchiveHabit(id) {
  const habits = (currentState.habits || []).map((h) => {
    if (h.id === id) {
      return { ...h, archived: !h.archived, updatedAt: new Date().toISOString() };
    }
    return h;
  });
  updateState({ habits }, 'habit-archive');
}

export function reorderHabits(orderedIds) {
  const habitMap = new Map((currentState.habits || []).map((h) => [h.id, h]));
  const habits = orderedIds.map((id, index) => {
    const habit = habitMap.get(id);
    return { ...habit, orderIndex: index };
  });
  updateState({ habits }, 'habit-reorder');
}

/* ==========================================================================
   Completions Mutations (One record per habit per date)
   ========================================================================== */

export function setCompletion(habitId, date, value, status = 'done', note = '', mood = '') {
  let completions = [...(currentState.completions || [])];
  const existingIdx = completions.findIndex((c) => c.habitId === habitId && c.date === date);

  const record = {
    habitId,
    date,
    value: Number(value) || 0,
    status, // 'done' | 'skipped' | 'missed'
    note: note || '',
    mood: mood || '',
    completedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    completions[existingIdx] = record;
  } else {
    completions.push(record);
  }

  updateState({ completions }, 'completion-set');
  return record;
}

export function removeCompletion(habitId, date) {
  const previous = (currentState.completions || []).find(
    (c) => c.habitId === habitId && c.date === date
  );
  const completions = (currentState.completions || []).filter(
    (c) => !(c.habitId === habitId && c.date === date)
  );
  updateState({ completions }, 'completion-remove');
  return previous;
}

/* ==========================================================================
   Journal & Reflection Mutations
   ========================================================================== */

export function saveReflection(entry) {
  let reflections = [...(currentState.reflections || [])];
  const idx = reflections.findIndex((r) => r.date === entry.date);
  if (idx >= 0) {
    reflections[idx] = { ...reflections[idx], ...entry };
  } else {
    reflections.unshift(entry);
  }
  updateState({ reflections }, 'reflection-save');
}

/* ==========================================================================
   Goals Mutations
   ========================================================================== */

export function addGoal(goal) {
  const goals = [...(currentState.goals || []), goal];
  updateState({ goals }, 'goal-add');
  return goal;
}

export function updateGoal(id, patch) {
  const goals = (currentState.goals || []).map((g) => (g.id === id ? { ...g, ...patch } : g));
  updateState({ goals }, 'goal-update');
}

export function deleteGoal(id) {
  const goals = (currentState.goals || []).filter((g) => g.id !== id);
  updateState({ goals }, 'goal-delete');
}

/* ==========================================================================
   Profile & Settings Mutations
   ========================================================================== */

export function updateProfile(patch) {
  const profile = { ...(currentState.profile || {}), ...patch };
  updateState({ profile }, 'profile-update');
}

export function updateSettings(patch) {
  const settings = { ...(currentState.settings || {}), ...patch };
  updateState({ settings }, 'settings-update');
}

/* ==========================================================================
   Import / Reset / Sample Data Actions
   ========================================================================== */

export function importStateData(importedState, mode = 'merge') {
  if (mode === 'replace') {
    currentState = importedState;
    saveState(currentState);
    notifyListeners('state-replace');
    return;
  }

  // Merge mode
  const existingHabitIds = new Set(currentState.habits.map((h) => h.id));
  const newHabits = [...currentState.habits];
  (importedState.habits || []).forEach((h) => {
    if (!existingHabitIds.has(h.id)) {
      newHabits.push(h);
    }
  });

  const completionKeys = new Set(currentState.completions.map((c) => `${c.habitId}_${c.date}`));
  const newCompletions = [...currentState.completions];
  (importedState.completions || []).forEach((c) => {
    const key = `${c.habitId}_${c.date}`;
    if (!completionKeys.has(key)) {
      newCompletions.push(c);
    }
  });

  currentState = {
    ...currentState,
    habits: newHabits,
    completions: newCompletions,
    goals: [...(currentState.goals || []), ...(importedState.goals || [])]
  };
  saveState(currentState);
  notifyListeners('state-merge');
}

export function loadStarterSampleData() {
  const sample = getSampleData();
  currentState = sample;
  saveState(currentState);
  notifyListeners('sample-data-loaded');
}

export function clearSampleData() {
  currentState = {
    habits: [],
    completions: [],
    goals: [],
    reflections: [],
    profile: {
      name: 'Shivam',
      avatarEmoji: '⚡',
      xp: 0,
      level: 1,
      streakFreezes: 1
    },
    settings: {
      theme: 'system',
      accent: 'green',
      density: 'comfortable',
      weekStart: 1,
      timeFormat: '12h',
      dateFormat: 'YYYY-MM-DD',
      gamificationEnabled: true,
      soundEnabled: true,
      remindersEnabled: true,
      dndStart: '22:00',
      dndEnd: '07:00'
    }
  };
  saveState(currentState);
  notifyListeners('data-cleared');
}

export function resetAllData() {
  resetAllStorage();
  clearSampleData();
}
