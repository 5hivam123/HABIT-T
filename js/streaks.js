/**
 * HabitFlow Pro - Pure Streak Calculation Engine
 * Operates purely on calendar dates (YYYY-MM-DD), respects custom frequencies,
 * streak freezes, and skip days. Pure, idempotent, and battle-tested.
 * @module streaks
 */

import { addDays, diffInDays, getDayOfWeek, getTodayDate, parseDate } from './utils.js';

/**
 * Checks whether a given habit is scheduled to be performed on a specific calendar date.
 * @param {Object} habit
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {boolean}
 */
export function isHabitScheduledOnDate(habit, dateStr) {
  if (!habit || !dateStr) return false;

  // Check habit start date
  if (habit.startDate && dateStr < habit.startDate) {
    return false;
  }

  // Check habit end date
  if (habit.endDate && dateStr > habit.endDate) {
    return false;
  }

  // Frequency matching
  switch (habit.frequency) {
    case 'daily':
      return true;

    case 'weekdays': {
      const scheduledDays = habit.frequencyData?.days || [1, 2, 3, 4, 5];
      const dow = getDayOfWeek(dateStr);
      return scheduledDays.includes(dow);
    }

    case 'interval': {
      const intervalDays = Math.max(1, habit.frequencyData?.interval || 2);
      const daysSinceStart = Math.abs(diffInDays(habit.startDate || dateStr, dateStr));
      return daysSinceStart % intervalDays === 0;
    }

    case 'x_per_week':
      // For X per week habits, any day can potentially be performed
      return true;

    default:
      return true;
  }
}

/**
 * Calculates streak metrics for a habit across its entire completion history.
 * Pure function: Does NOT modify input arguments.
 *
 * @param {Object} habit
 * @param {Array} completions
 * @param {string} [asOfDate] "YYYY-MM-DD", defaults to today
 * @param {number} [freezesAvailable=0]
 * @returns {{
 *   currentStreak: number,
 *   longestStreak: number,
 *   totalCompletions: number,
 *   consistencyRate: number,
 *   freezesUsed: number
 * }}
 */
export function calculateHabitStreak(habit, completions, asOfDate = getTodayDate(), freezesAvailable = 0) {
  if (!habit) {
    return { currentStreak: 0, longestStreak: 0, totalCompletions: 0, consistencyRate: 0, freezesUsed: 0 };
  }

  // Map completions by date for O(1) lookup
  const recordMap = new Map();
  let totalCompletions = 0;

  (completions || []).forEach((c) => {
    if (c.habitId === habit.id) {
      recordMap.set(c.date, c);
      if (c.status === 'done') {
        totalCompletions++;
      }
    }
  });

  const startDate = habit.startDate || asOfDate;
  if (startDate > asOfDate) {
    return { currentStreak: 0, longestStreak: 0, totalCompletions: 0, consistencyRate: 0, freezesUsed: 0 };
  }

  // Handle X times per week separately
  if (habit.frequency === 'x_per_week') {
    return calculateWeeklyTargetStreak(habit, recordMap, asOfDate);
  }

  // 1. Calculate Current Streak going backwards from asOfDate
  let currentStreak = 0;
  let remainingFreezes = Math.max(0, freezesAvailable);
  let freezesUsed = 0;
  let checkDate = asOfDate;

  // If today is scheduled but not completed yet, start evaluation from yesterday
  const todayRecord = recordMap.get(asOfDate);
  const isTodayDone = todayRecord && todayRecord.status === 'done';
  const isTodaySkipped = todayRecord && todayRecord.status === 'skipped';

  if (!isTodayDone && !isTodaySkipped && isHabitScheduledOnDate(habit, asOfDate)) {
    checkDate = addDays(asOfDate, -1);
  }

  while (checkDate >= startDate) {
    if (isHabitScheduledOnDate(habit, checkDate)) {
      const record = recordMap.get(checkDate);

      if (record && record.status === 'done') {
        currentStreak++;
      } else if (record && record.status === 'skipped') {
        // Skipped day: preserve streak without incrementing
      } else if (remainingFreezes > 0) {
        // Missed day, but freeze is available
        remainingFreezes--;
        freezesUsed++;
      } else {
        // Missed without freeze: streak broken
        break;
      }
    }
    checkDate = addDays(checkDate, -1);
  }

  // 2. Calculate Longest Streak by traversing all days from startDate to asOfDate
  let longestStreak = 0;
  let runningStreak = 0;
  const totalDays = Math.max(1, diffInDays(startDate, asOfDate) + 1);
  let scheduledDaysCount = 0;
  let completedScheduledCount = 0;

  for (let i = 0; i < totalDays; i++) {
    const curDate = addDays(startDate, i);
    if (isHabitScheduledOnDate(habit, curDate)) {
      scheduledDaysCount++;
      const record = recordMap.get(curDate);

      if (record && record.status === 'done') {
        runningStreak++;
        completedScheduledCount++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else if (record && record.status === 'skipped') {
        // Keeps running streak alive
      } else {
        runningStreak = 0;
      }
    }
  }

  // Ensure longest streak is at least current streak
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  // 3. Consistency Rate
  const consistencyRate = scheduledDaysCount > 0
    ? Math.round((completedScheduledCount / scheduledDaysCount) * 100)
    : 0;

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    consistencyRate,
    freezesUsed
  };
}

/**
 * Evaluates streaks for habits with "X times per week" frequency.
 * @param {Object} habit
 * @param {Map} recordMap
 * @param {string} asOfDate
 * @returns {Object}
 */
function calculateWeeklyTargetStreak(habit, recordMap, asOfDate) {
  const targetPerWeek = habit.frequencyData?.targetPerWeek || 3;
  let totalCompletions = 0;
  recordMap.forEach((c) => {
    if (c.status === 'done') totalCompletions++;
  });

  // Calculate current week and historical weeks
  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  // Scan week blocks (Sunday-Saturday)
  const d = parseDate(asOfDate);
  const currentWeekStart = addDays(asOfDate, -d.getDay());
  let weekStart = habit.startDate || asOfDate;
  const wsDate = parseDate(weekStart);
  weekStart = addDays(weekStart, -wsDate.getDay());

  const totalWeeks = Math.max(1, Math.ceil(diffInDays(weekStart, currentWeekStart) / 7) + 1);

  for (let w = 0; w < totalWeeks; w++) {
    const start = addDays(weekStart, w * 7);
    let doneInWeek = 0;
    for (let day = 0; day < 7; day++) {
      const check = addDays(start, day);
      if (check <= asOfDate) {
        const r = recordMap.get(check);
        if (r && r.status === 'done') doneInWeek++;
      }
    }

    if (doneInWeek >= targetPerWeek) {
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else if (start < currentWeekStart) {
      // Prior week missed
      runningStreak = 0;
    }
  }

  currentStreak = runningStreak;

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    consistencyRate: Math.min(100, Math.round((totalCompletions / (totalWeeks * targetPerWeek)) * 100)) || 0,
    freezesUsed: 0
  };
}
