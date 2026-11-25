/**
 * HabitFlow Pro - Storage & Persistence Engine
 * Schema versioning, migrations, error handling, cross-tab sync,
 * rolling backups, and import/export utilities.
 * @module storage
 */

import { getSampleData } from '../data/sample-data.js';

export const SCHEMA_VERSION = 2;
const STORAGE_KEY = 'habitflow_pro_state';
const BACKUPS_KEY = 'habitflow_pro_backups';

// In-memory fallback if LocalStorage is blocked (e.g., Safari private window)
let memoryStore = {};
let isMemoryFallback = false;

try {
  const testKey = '__hf_test__';
  localStorage.setItem(testKey, testKey);
  localStorage.removeItem(testKey);
} catch (e) {
  isMemoryFallback = true;
  console.warn('[Storage] LocalStorage unavailable. Using in-memory fallback.', e);
}

/**
 * Reads the raw stored state string.
 * @returns {string|null}
 */
function readRaw(key) {
  if (isMemoryFallback) {
    return memoryStore[key] || null;
  }
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error('[Storage] Error reading localStorage key:', key, err);
    return null;
  }
}

/**
 * Writes data safely to storage.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
function writeRaw(key, value) {
  if (isMemoryFallback) {
    memoryStore[key] = value;
    return true;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error('[Storage] Quota exceeded or error saving to localStorage:', err);
    return false;
  }
}

/**
 * Migrates older schema versions up to current SCHEMA_VERSION.
 * @param {Object} data
 * @returns {Object} Migrated data
 */
export function migrateSchema(data) {
  if (!data) return null;
  let currentVersion = data._version || 1;

  // Migration v1 -> v2: Add streakFreezes, reminderTime, and frequencyData
  if (currentVersion === 1) {
    console.log('[Storage] Migrating schema v1 -> v2...');
    if (data.habits && Array.isArray(data.habits)) {
      data.habits = data.habits.map((h) => ({
        ...h,
        frequencyData: h.frequencyData || {},
        reminderTime: h.reminderTime || '',
        archived: Boolean(h.archived)
      }));
    }
    if (data.profile) {
      data.profile.streakFreezes = data.profile.streakFreezes ?? 2;
    }
    data._version = 2;
  }

  data._version = SCHEMA_VERSION;
  return data;
}

/**
 * Validates and repairs corrupted records or missing fields.
 * Deduplicates completions on habitId + date.
 * @param {Object} state
 * @returns {{ state: Object, wasRepaired: boolean }}
 */
export function validateAndRepair(state) {
  let wasRepaired = false;
  if (!state || typeof state !== 'object') {
    return { state: getSampleData(), wasRepaired: true };
  }

  // Ensure root collections exist
  const requiredKeys = ['habits', 'completions', 'goals', 'reflections', 'profile', 'settings'];
  requiredKeys.forEach((key) => {
    if (!state[key]) {
      state[key] = key === 'profile' || key === 'settings' ? {} : [];
      wasRepaired = true;
    }
  });

  // Repair habits array
  if (!Array.isArray(state.habits)) {
    state.habits = [];
    wasRepaired = true;
  } else {
    state.habits = state.habits.filter((h) => h && typeof h === 'object' && h.id && h.name);
  }

  // Deduplicate completions by habitId + date
  if (!Array.isArray(state.completions)) {
    state.completions = [];
    wasRepaired = true;
  } else {
    const seen = new Set();
    const cleanCompletions = [];
    for (const c of state.completions) {
      if (!c || !c.habitId || !c.date) {
        wasRepaired = true;
        continue;
      }
      const compoundKey = `${c.habitId}_${c.date}`;
      if (!seen.has(compoundKey)) {
        seen.add(compoundKey);
        cleanCompletions.push(c);
      } else {
        wasRepaired = true;
      }
    }
    state.completions = cleanCompletions;
  }

  return { state, wasRepaired };
}

/**
 * Loads the application state from storage, running migrations and repairs.
 * If empty, initializes with sample starter data.
 * @returns {{ state: Object, repaired: boolean, isFirstRun: boolean }}
 */
export function loadState() {
  const raw = readRaw(STORAGE_KEY);
  if (!raw) {
    const starter = getSampleData();
    starter._version = SCHEMA_VERSION;
    saveState(starter);
    return { state: starter, repaired: false, isFirstRun: true };
  }

  try {
    let parsed = JSON.parse(raw);
    parsed = migrateSchema(parsed);
    const { state: repairedState, wasRepaired } = validateAndRepair(parsed);
    if (wasRepaired) {
      saveState(repairedState);
    }
    return { state: repairedState, repaired: wasRepaired, isFirstRun: false };
  } catch (err) {
    console.error('[Storage] JSON parse failed on stored state. Initializing sample data.', err);
    const sample = getSampleData();
    sample._version = SCHEMA_VERSION;
    saveState(sample);
    return { state: sample, repaired: true, isFirstRun: false };
  }
}

/**
 * Saves current application state to storage.
 * Automatically maintains rolling backups (max 3 snapshots).
 * @param {Object} state
 * @returns {boolean}
 */
export function saveState(state) {
  if (!state) return false;
  state._version = SCHEMA_VERSION;
  state._lastSaved = new Date().toISOString();
  const serialized = JSON.stringify(state);
  const success = writeRaw(STORAGE_KEY, serialized);

  // Trigger rolling backup asynchronously
  if (success && Math.random() < 0.25) {
    createRollingBackup(state);
  }
  return success;
}

/**
 * Saves a snapshot into the rolling backups list.
 * @param {Object} state
 */
export function createRollingBackup(state) {
  try {
    const backupsRaw = readRaw(BACKUPS_KEY);
    let backups = backupsRaw ? JSON.parse(backupsRaw) : [];
    backups.unshift({
      timestamp: new Date().toISOString(),
      habitsCount: state.habits?.length || 0,
      completionsCount: state.completions?.length || 0,
      data: state
    });
    // Keep max 3 rolling backups
    backups = backups.slice(0, 3);
    writeRaw(BACKUPS_KEY, JSON.stringify(backups));
  } catch (err) {
    console.warn('[Storage] Failed to create rolling backup:', err);
  }
}

/**
 * Retrieves the rolling backups list.
 * @returns {Array}
 */
export function getBackups() {
  try {
    const raw = readRaw(BACKUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Restores state from a specific backup index.
 * @param {number} backupIndex
 * @returns {Object|null}
 */
export function restoreBackup(backupIndex) {
  const backups = getBackups();
  if (backups[backupIndex] && backups[backupIndex].data) {
    const target = backups[backupIndex].data;
    saveState(target);
    return target;
  }
  return null;
}

/**
 * Exports complete application state as a JSON file download.
 * @param {Object} state
 */
export function exportDataJSON(state) {
  const payload = {
    appName: 'HabitFlowPro',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habitflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports completion history records as a downloadable CSV.
 * @param {Array} habits
 * @param {Array} completions
 */
export function exportCompletionsCSV(habits, completions) {
  const habitMap = new Map((habits || []).map((h) => [h.id, h.name]));
  const headers = ['Date', 'Habit ID', 'Habit Name', 'Status', 'Value', 'Mood', 'Note', 'Completed At'];
  const rows = (completions || []).map((c) => [
    `"${c.date}"`,
    `"${c.habitId}"`,
    `"${(habitMap.get(c.habitId) || '').replace(/"/g, '""')}"`,
    `"${c.status || 'done'}"`,
    c.value || 0,
    `"${c.mood || ''}"`,
    `"${(c.note || '').replace(/"/g, '""')}"`,
    `"${c.completedAt || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habitflow-completions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Validates imported JSON file content.
 * @param {string} jsonString
 * @returns {{ valid: boolean, error?: string, parsedState?: Object, preview?: Object }}
 */
export function validateImportJSON(jsonString) {
  try {
    const raw = JSON.parse(jsonString);
    const data = raw.data || raw; // Supports both HabitFlow wrapper and raw state
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'File does not contain a valid JSON object.' };
    }
    if (!Array.isArray(data.habits)) {
      return { valid: false, error: 'Missing habits collection.' };
    }
    const preview = {
      habitsCount: data.habits.length,
      completionsCount: Array.isArray(data.completions) ? data.completions.length : 0,
      goalsCount: Array.isArray(data.goals) ? data.goals.length : 0,
      exportedAt: raw.exportedAt || 'Unknown'
    };
    return { valid: true, parsedState: data, preview };
  } catch (err) {
    return { valid: false, error: 'Invalid JSON format: ' + err.message };
  }
}

/**
 * Calculates current LocalStorage usage in Kilobytes.
 * @returns {{ usedKB: number, percentage: number }}
 */
export function getStorageUsage() {
  let totalBytes = 0;
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += (localStorage[key].length + key.length) * 2; // UTF-16 = 2 bytes per char
      }
    }
  } catch (e) {
    totalBytes = 0;
  }
  const usedKB = Math.round(totalBytes / 1024);
  // Assume ~5MB standard browser quota
  const percentage = Math.min(100, Math.round((totalBytes / (5 * 1024 * 1024)) * 100));
  return { usedKB, percentage };
}

/**
 * Wipes all HabitFlow Pro data from storage and resets to initial clean state.
 */
export function resetAllStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUPS_KEY);
  } catch (e) {}
  memoryStore = {};
}
