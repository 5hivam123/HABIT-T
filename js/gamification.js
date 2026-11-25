/**
 * HabitFlow Pro - Gamification Engine
 * XP calculations, leveling system, 22 badges with unlock criteria,
 * and weekly challenges.
 * @module gamification
 */

import { calculateHabitStreak } from './streaks.js';
import { getTodayDate } from './utils.js';

/**
 * 22 Unique Badges with metadata and evaluation logic.
 */
export const BADGES_CATALOG = [
  { id: 'first_habit', title: 'First Step', icon: '🌱', description: 'Create your very first habit to track.' },
  { id: 'first_done', title: 'Momentum Starts', icon: '🎯', description: 'Complete your first habit session.' },
  { id: 'streak_3', title: 'Three in a Row', icon: '🔥', description: 'Reach a 3-day streak on any habit.' },
  { id: 'streak_7', title: 'One Week Wonder', icon: '⚡', description: 'Reach a 7-day streak on any habit.' },
  { id: 'streak_14', title: 'Fortnight of Focus', icon: '🛡️', description: 'Maintain a 14-day streak.' },
  { id: 'streak_30', title: 'Habit Master', icon: '👑', description: 'Complete a full 30-day streak.' },
  { id: 'streak_60', title: 'Unstoppable Force', icon: '💎', description: 'Maintain a remarkable 60-day streak.' },
  { id: 'streak_100', title: 'Century Club', icon: '🏆', description: 'Achieve a legendary 100-day streak.' },
  { id: 'completions_10', title: 'Double Digits', icon: '🔟', description: 'Log 10 total habit completions.' },
  { id: 'completions_50', title: 'Halfway to Hundred', icon: '🥉', description: 'Log 50 total habit completions.' },
  { id: 'completions_100', title: 'Centurion', icon: '🥈', description: 'Log 100 total habit completions.' },
  { id: 'completions_250', title: 'Habit Virtuoso', icon: '🥇', description: 'Log 250 total habit completions.' },
  { id: 'early_bird', title: 'Early Bird', icon: '🌅', description: 'Complete any morning habit before 8:00 AM.' },
  { id: 'night_owl', title: 'Night Owl', icon: '🦉', description: 'Complete an evening habit after 9:00 PM.' },
  { id: 'perfect_day', title: 'Flawless Day', icon: '🌟', description: 'Complete 100% of all scheduled habits today.' },
  { id: 'perfect_week', title: 'Perfect Week', icon: '🎖️', description: 'Hit 100% completion 7 days in a row.' },
  { id: 'comeback_kid', title: 'Comeback Kid', icon: '🧗', description: 'Complete a habit after using a freeze or skip.' },
  { id: 'hydrated', title: 'Hydro Homie', icon: '💧', description: 'Log 5 water drinking sessions.' },
  { id: 'bookworm', title: 'Bookworm', icon: '📖', description: 'Complete 10 reading sessions.' },
  { id: 'zen_master', title: 'Zen Master', icon: '🧘', description: 'Log 7 mindfulness or meditation sessions.' },
  { id: 'goal_getter', title: 'Goal Getter', icon: '🚀', description: 'Successfully accomplish a habit goal.' },
  { id: 'category_diversity', title: 'Renaissance Mind', icon: '🎨', description: 'Have active habits across 4+ different categories.' }
];

/**
 * Calculates XP earned for a completion.
 * @param {Object} habit
 * @param {number} currentStreak
 * @returns {number}
 */
export function calculateCompletionXP(habit, currentStreak = 0) {
  const baseXP = habit?.priority === 'high' ? 30 : habit?.priority === 'low' ? 12 : 20;
  // +5% bonus per 5 days of streak, capped at 2.0x (100% bonus)
  const multiplier = Math.min(2.0, 1 + Math.floor(currentStreak / 5) * 0.05);
  return Math.round(baseXP * multiplier);
}

/**
 * Returns user level and progress percentage based on total XP.
 * Formula: Level = Math.floor(Math.sqrt(XP / 80)) + 1
 * @param {number} xp
 * @returns {{ level: number, currentLevelXP: number, nextLevelXP: number, progressPct: number }}
 */
export function calculateLevel(xp = 0) {
  const safeXP = Math.max(0, xp);
  const level = Math.floor(Math.sqrt(safeXP / 80)) + 1;
  const currentLevelBaseXP = Math.pow(level - 1, 2) * 80;
  const nextLevelBaseXP = Math.pow(level, 2) * 80;
  const xpInCurrentLevel = safeXP - currentLevelBaseXP;
  const xpNeeded = nextLevelBaseXP - currentLevelBaseXP;
  const progressPct = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeeded) * 100)));

  return {
    level,
    currentLevelXP: safeXP,
    nextLevelXP: nextLevelBaseXP,
    progressPct
  };
}

/**
 * Evaluates all badges and returns list of unlocked badges with dates,
 * plus locked badges with progress hints.
 *
 * @param {Object} state
 * @returns {Array}
 */
export function evaluateBadges(state) {
  if (!state) return [];
  const habits = state.habits || [];
  const completions = state.completions || [];
  const goals = state.goals || [];
  const today = getTodayDate();

  const totalCompletions = completions.filter((c) => c.status === 'done').length;

  // Find max streak across active habits
  let maxStreak = 0;
  habits.forEach((h) => {
    const s = calculateHabitStreak(h, completions, today);
    if (s.longestStreak > maxStreak) maxStreak = s.longestStreak;
    if (s.currentStreak > maxStreak) maxStreak = s.currentStreak;
  });

  const categoriesSet = new Set(habits.filter((h) => !h.archived).map((h) => h.category));

  return BADGES_CATALOG.map((b) => {
    let unlocked = false;
    let progress = '';

    switch (b.id) {
      case 'first_habit':
        unlocked = habits.length >= 1;
        progress = `${Math.min(habits.length, 1)} / 1`;
        break;
      case 'first_done':
        unlocked = totalCompletions >= 1;
        progress = `${Math.min(totalCompletions, 1)} / 1`;
        break;
      case 'streak_3':
        unlocked = maxStreak >= 3;
        progress = `${Math.min(maxStreak, 3)} / 3 days`;
        break;
      case 'streak_7':
        unlocked = maxStreak >= 7;
        progress = `${Math.min(maxStreak, 7)} / 7 days`;
        break;
      case 'streak_14':
        unlocked = maxStreak >= 14;
        progress = `${Math.min(maxStreak, 14)} / 14 days`;
        break;
      case 'streak_30':
        unlocked = maxStreak >= 30;
        progress = `${Math.min(maxStreak, 30)} / 30 days`;
        break;
      case 'streak_60':
        unlocked = maxStreak >= 60;
        progress = `${Math.min(maxStreak, 60)} / 60 days`;
        break;
      case 'streak_100':
        unlocked = maxStreak >= 100;
        progress = `${Math.min(maxStreak, 100)} / 100 days`;
        break;
      case 'completions_10':
        unlocked = totalCompletions >= 10;
        progress = `${Math.min(totalCompletions, 10)} / 10`;
        break;
      case 'completions_50':
        unlocked = totalCompletions >= 50;
        progress = `${Math.min(totalCompletions, 50)} / 50`;
        break;
      case 'completions_100':
        unlocked = totalCompletions >= 100;
        progress = `${Math.min(totalCompletions, 100)} / 100`;
        break;
      case 'completions_250':
        unlocked = totalCompletions >= 250;
        progress = `${Math.min(totalCompletions, 250)} / 250`;
        break;
      case 'early_bird': {
        const count = completions.filter((c) => {
          if (!c.completedAt) return false;
          const hr = new Date(c.completedAt).getHours();
          return hr < 8;
        }).length;
        unlocked = count >= 1;
        progress = unlocked ? 'Unlocked' : 'Log before 8 AM';
        break;
      }
      case 'night_owl': {
        const count = completions.filter((c) => {
          if (!c.completedAt) return false;
          const hr = new Date(c.completedAt).getHours();
          return hr >= 21;
        }).length;
        unlocked = count >= 1;
        progress = unlocked ? 'Unlocked' : 'Log after 9 PM';
        break;
      }
      case 'perfect_day':
        unlocked = totalCompletions >= 5;
        progress = unlocked ? 'Unlocked' : 'Complete 100% of today’s habits';
        break;
      case 'perfect_week':
        unlocked = maxStreak >= 7;
        progress = `${Math.min(maxStreak, 7)} / 7 days`;
        break;
      case 'comeback_kid':
        unlocked = completions.some((c) => c.status === 'skipped');
        progress = unlocked ? 'Unlocked' : 'Resume habit after rest';
        break;
      case 'hydrated': {
        const waterHits = completions.filter((c) => c.habitId === 'h_water' && c.status === 'done').length;
        unlocked = waterHits >= 5;
        progress = `${Math.min(waterHits, 5)} / 5`;
        break;
      }
      case 'bookworm': {
        const readHits = completions.filter((c) => c.habitId === 'h_reading' && c.status === 'done').length;
        unlocked = readHits >= 10;
        progress = `${Math.min(readHits, 10)} / 10`;
        break;
      }
      case 'zen_master': {
        const zenHits = completions.filter((c) => c.habitId === 'h_meditate' && c.status === 'done').length;
        unlocked = zenHits >= 7;
        progress = `${Math.min(zenHits, 7)} / 7`;
        break;
      }
      case 'goal_getter': {
        const completedGoals = goals.filter((g) => g.status === 'completed').length;
        unlocked = completedGoals >= 1;
        progress = `${Math.min(completedGoals, 1)} / 1`;
        break;
      }
      case 'category_diversity':
        unlocked = categoriesSet.size >= 4;
        progress = `${Math.min(categoriesSet.size, 4)} / 4 categories`;
        break;
    }

    return {
      ...b,
      unlocked,
      progress
    };
  });
}

/**
 * Returns current weekly challenge.
 * @param {Object} state
 * @returns {Object}
 */
export function getWeeklyChallenge(state) {
  return {
    id: 'wc_consistency',
    title: 'Consistency Sprint',
    description: 'Complete at least 85% of your scheduled habits this week.',
    targetPct: 85,
    rewardXP: 150,
    daysRemaining: 4
  };
}
