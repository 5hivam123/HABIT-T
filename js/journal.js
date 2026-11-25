/**
 * HabitFlow Pro - Journal & Mood Controller
 * Daily reflection notes, 5-scale mood selector, and notes timeline.
 * @module journal
 */

import { getState, saveReflection } from './state.js';
import { getTodayDate, escapeHTML, getRelativeDateLabel } from './utils.js';
import { showToast } from './ui.js';

export const MOODS = [
  { id: 'great', emoji: '🤩', label: 'Great' },
  { id: 'good', emoji: '😊', label: 'Good' },
  { id: 'neutral', emoji: '😐', label: 'Neutral' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'bad', emoji: '😫', label: 'Tough' }
];

/**
 * Saves or updates today's daily reflection entry.
 * @param {string} text
 * @param {string} mood
 * @param {string} [dateStr=today]
 */
export function recordDailyReflection(text, mood, dateStr = getTodayDate()) {
  if (!text && !mood) return;

  saveReflection({
    date: dateStr,
    text: text.trim(),
    mood: mood || 'good',
    createdAt: new Date().toISOString()
  });

  showToast({ message: 'Reflection recorded in your journal! 📖', type: 'success' });
}

/**
 * Returns all journal entries (daily reflections + habit completion notes) sorted by date descending.
 * @param {Object} state
 * @returns {Array<Object>}
 */
export function getCombinedJournalEntries(state) {
  const entries = [];
  const habitsMap = new Map((state.habits || []).map((h) => [h.id, h]));

  // Add daily reflections
  (state.reflections || []).forEach((r) => {
    entries.push({
      type: 'reflection',
      date: r.date,
      title: 'Daily Reflection',
      text: r.text,
      mood: r.mood,
      emoji: '📝',
      timestamp: r.createdAt || r.date
    });
  });

  // Add habit completion notes
  (state.completions || []).forEach((c) => {
    if (c.note && c.note.trim()) {
      const habit = habitsMap.get(c.habitId);
      entries.push({
        type: 'habit_note',
        date: c.date,
        title: habit ? habit.name : 'Habit Note',
        text: c.note,
        mood: c.mood || 'good',
        emoji: habit ? habit.emoji : '🎯',
        timestamp: c.completedAt || c.date
      });
    }
  });

  // Sort descending by date
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}
