/**
 * HabitFlow Pro - Smart Insights Engine (Local Rule-Based)
 * Analyzes historical patterns, slipping habits, streak milestones,
 * and weekday vs weekend performance.
 * @module insights
 */

import { calculateHabitStreak, isHabitScheduledOnDate } from './streaks.js';
import { getTodayDate, addDays, getDayOfWeek } from './utils.js';

/**
 * Evaluates state data and generates actionable insights.
 * @param {Object} state
 * @returns {Array<Object>}
 */
export function generateSmartInsights(state) {
  if (!state || !state.habits || state.habits.length === 0) {
    return [{
      id: 'ins_welcome',
      type: 'praise',
      title: 'Welcome to Habit Tracker!',
      description: 'Start tracking your habits daily to unlock intelligent behavioural insights.',
      icon: '✨'
    }];
  }

  const insights = [];
  const today = getTodayDate();
  const habits = state.habits.filter((h) => !h.archived);
  const completions = state.completions || [];

  // 1. Approaching Streak Milestones (7, 14, 30, 50, 100 days)
  const milestones = [7, 14, 30, 50, 100];
  habits.forEach((habit) => {
    const streak = calculateHabitStreak(habit, completions, today);
    milestones.forEach((m) => {
      const remaining = m - streak.currentStreak;
      if (remaining === 1 || remaining === 2) {
        insights.push({
          id: `ins_milestone_${habit.id}_${m}`,
          type: 'milestone',
          title: `Milestone Alert: ${habit.name}`,
          description: `You are only ${remaining} day${remaining > 1 ? 's' : ''} away from a massive ${m}-day streak! Keep going!`,
          icon: '🔥'
        });
      }
    });
  });

  // 2. Slipping Habits (missed 3+ times in last 5 scheduled days)
  habits.forEach((habit) => {
    let missedCount = 0;
    let scheduledInWindow = 0;

    for (let i = 1; i <= 5; i++) {
      const d = addDays(today, -i);
      if (isHabitScheduledOnDate(habit, d)) {
        scheduledInWindow++;
        const record = completions.find((c) => c.habitId === habit.id && c.date === d);
        if (!record || record.status !== 'done') {
          missedCount++;
        }
      }
    }

    if (scheduledInWindow >= 3 && missedCount >= 3) {
      insights.push({
        id: `ins_slip_${habit.id}`,
        type: 'warning',
        title: `${habit.name} is slipping`,
        description: `Missed ${missedCount} times in the last 5 days. Consider shrinking the habit to just 2 minutes to reboot momentum.`,
        icon: '⚠️'
      });
    }
  });

  // 3. Weekday vs Weekend Comparison
  let weekdayDone = 0;
  let weekdayScheduled = 0;
  let weekendDone = 0;
  let weekendScheduled = 0;

  // Scan last 28 days
  for (let i = 0; i < 28; i++) {
    const d = addDays(today, -i);
    const dow = getDayOfWeek(d);
    const isWeekend = dow === 0 || dow === 6;

    habits.forEach((h) => {
      if (isHabitScheduledOnDate(h, d)) {
        const isDone = completions.some((c) => c.habitId === h.id && c.date === d && c.status === 'done');
        if (isWeekend) {
          weekendScheduled++;
          if (isDone) weekendDone++;
        } else {
          weekdayScheduled++;
          if (isDone) weekdayDone++;
        }
      }
    });
  }

  const weekdayRate = weekdayScheduled > 0 ? Math.round((weekdayDone / weekdayScheduled) * 100) : 0;
  const weekendRate = weekendScheduled > 0 ? Math.round((weekendDone / weekendScheduled) * 100) : 0;

  if (weekdayRate > 0 && weekendRate > 0 && Math.abs(weekdayRate - weekendRate) >= 15) {
    if (weekdayRate > weekendRate) {
      insights.push({
        id: 'ins_weekday_strong',
        type: 'pattern',
        title: 'Stronger on Weekdays',
        description: `Your consistency is ${weekdayRate}% on weekdays vs ${weekendRate}% on weekends. Set special weekend reminders to bridge the gap.`,
        icon: '📊'
      });
    } else {
      insights.push({
        id: 'ins_weekend_strong',
        type: 'pattern',
        title: 'Weekend Energy',
        description: `You are remarkably consistent on weekends (${weekendRate}% vs ${weekdayRate}% weekdays). Harness this rhythm!`,
        icon: '🌟'
      });
    }
  }

  // 4. Default Praise if on track
  if (insights.length === 0) {
    insights.push({
      id: 'ins_stellar',
      type: 'praise',
      title: 'Remarkable Consistency!',
      description: 'Your habits are in an optimal groove. Consistency beats intensity every single day.',
      icon: '🚀'
    });
  }

  return insights;
}
