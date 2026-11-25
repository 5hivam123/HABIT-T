/**
 * HabitFlow Pro - Starter Sample Data
 * Provides 6 realistic starter habits, 30 days of historical completions,
 * sample goals, and reflections for portfolio demonstration.
 * @module sample-data
 */

import { addDays, getTodayDate } from '../js/utils.js';

export function getSampleData() {
  const today = getTodayDate();

  const habits = [
    {
      id: 'h_water',
      name: 'Drink 8 Glasses of Water',
      description: 'Stay hydrated throughout the day to boost focus and energy.',
      category: 'Health',
      emoji: '💧',
      color: '#0284c7',
      type: 'counter',
      targetValue: 8,
      unit: 'glasses',
      frequency: 'daily',
      frequencyData: {},
      timeOfDay: 'anytime',
      reminderTime: '10:00',
      startDate: addDays(today, -35),
      endDate: null,
      priority: 'high',
      archived: false,
      orderIndex: 0,
      createdAt: addDays(today, -35),
      updatedAt: today
    },
    {
      id: 'h_reading',
      name: 'Read Non-Fiction Book',
      description: 'Expand mental models and deepen lifelong learning.',
      category: 'Education',
      emoji: '📚',
      color: '#8b5cf6',
      type: 'timer',
      targetValue: 25,
      unit: 'mins',
      frequency: 'daily',
      frequencyData: {},
      timeOfDay: 'evening',
      reminderTime: '21:30',
      startDate: addDays(today, -30),
      endDate: null,
      priority: 'medium',
      archived: false,
      orderIndex: 1,
      createdAt: addDays(today, -30),
      updatedAt: today
    },
    {
      id: 'h_walk',
      name: 'Morning Power Walk',
      description: 'Get natural sunlight and 5,000 steps within 1 hour of waking up.',
      category: 'Fitness',
      emoji: '👟',
      color: '#10b981',
      type: 'boolean',
      targetValue: 1,
      unit: '',
      frequency: 'daily',
      frequencyData: {},
      timeOfDay: 'morning',
      reminderTime: '07:30',
      startDate: addDays(today, -28),
      endDate: null,
      priority: 'high',
      archived: false,
      orderIndex: 2,
      createdAt: addDays(today, -28),
      updatedAt: today
    },
    {
      id: 'h_meditate',
      name: 'Mindful Meditation',
      description: '10 minutes of calm breathwork and Vipassana body scan.',
      category: 'Mindfulness',
      emoji: '🧘',
      color: '#06b6d4',
      type: 'timer',
      targetValue: 10,
      unit: 'mins',
      frequency: 'weekdays',
      frequencyData: { days: [1, 2, 3, 4, 5] }, // Mon-Fri
      timeOfDay: 'morning',
      reminderTime: '08:15',
      startDate: addDays(today, -25),
      endDate: null,
      priority: 'medium',
      archived: false,
      orderIndex: 3,
      createdAt: addDays(today, -25),
      updatedAt: today
    },
    {
      id: 'h_deepwork',
      name: 'Deep Work Sprint',
      description: 'Zero notification uninterrupted block for top priority goal.',
      category: 'Productivity',
      emoji: '⚡',
      color: '#f97316',
      type: 'timer',
      targetValue: 60,
      unit: 'mins',
      frequency: 'weekdays',
      frequencyData: { days: [1, 2, 3, 4, 5] },
      timeOfDay: 'morning',
      reminderTime: '09:00',
      startDate: addDays(today, -20),
      endDate: null,
      priority: 'high',
      archived: false,
      orderIndex: 4,
      createdAt: addDays(today, -20),
      updatedAt: today
    },
    {
      id: 'h_nosugar',
      name: 'Zero Refined Sugar',
      description: 'Eliminate sodas, candy, and sugary desserts.',
      category: 'Health',
      emoji: '🥗',
      color: '#10b981',
      type: 'boolean',
      targetValue: 1,
      unit: '',
      frequency: 'daily',
      frequencyData: {},
      timeOfDay: 'evening',
      reminderTime: '',
      startDate: addDays(today, -15),
      endDate: null,
      priority: 'low',
      archived: false,
      orderIndex: 5,
      createdAt: addDays(today, -15),
      updatedAt: today
    }
  ];

  // Generate 30 days of realistic history
  const completions = [];
  const notesSample = [
    'Felt remarkably energized afterwards!',
    'Pushed through despite feeling tired.',
    'Listened to an incredible podcast along the way.',
    'Great focus today, zero digital distractions.',
    'Session was effortless today.'
  ];
  const moods = ['great', 'good', 'good', 'neutral', 'great'];

  for (let i = 28; i >= 0; i--) {
    const curDate = addDays(today, -i);
    const dayOfWeek = (new Date(curDate)).getDay();

    habits.forEach((habit, hIdx) => {
      // Simulate realistic completion probability (e.g. 85%)
      const seed = (i * 7 + hIdx * 13) % 100;
      
      // If weekday-only habit and weekend, skip naturally
      if (habit.frequency === 'weekdays' && (dayOfWeek === 0 || dayOfWeek === 6)) {
        return;
      }

      if (seed < 82) {
        // Complete
        const hasNote = seed % 4 === 0;
        completions.push({
          habitId: habit.id,
          date: curDate,
          value: habit.targetValue,
          status: 'done',
          note: hasNote ? notesSample[seed % notesSample.length] : '',
          mood: moods[seed % moods.length],
          completedAt: `${curDate}T${10 + (hIdx % 8)}:30:00.000Z`
        });
      } else if (seed > 93) {
        // Skipped
        completions.push({
          habitId: habit.id,
          date: curDate,
          value: 0,
          status: 'skipped',
          note: 'Scheduled rest day / recovery.',
          mood: 'neutral',
          completedAt: `${curDate}T12:00:00.000Z`
        });
      }
    });
  }

  const goals = [
    {
      id: 'g_reading_streak',
      title: 'Read 30 Days in a Row',
      description: 'Finish Atomic Habits and start Deep Work.',
      habitId: 'h_reading',
      type: 'streak',
      targetValue: 30,
      currentValue: 18,
      deadline: addDays(today, 12),
      status: 'active',
      createdAt: addDays(today, -18)
    },
    {
      id: 'g_walk_100k',
      title: '100 Miles of Morning Walks',
      description: 'Build consistent cardiovascular endurance.',
      habitId: 'h_walk',
      type: 'count',
      targetValue: 30,
      currentValue: 24,
      deadline: addDays(today, 7),
      status: 'active',
      createdAt: addDays(today, -24)
    }
  ];

  const reflections = [
    {
      date: addDays(today, -1),
      mood: 'great',
      text: 'Super productive Monday. Morning walk set the tone for deep work. Drank all water by 6pm.',
      createdAt: addDays(today, -1)
    },
    {
      date: addDays(today, -3),
      mood: 'good',
      text: 'Weekend was peaceful. Reading session was insightful. Feeling ready for the week.',
      createdAt: addDays(today, -3)
    }
  ];

  return {
    habits,
    completions,
    goals,
    reflections,
    profile: {
      name: 'Shivam',
      avatarEmoji: '⚡',
      xp: 1420,
      level: 4,
      streakFreezes: 2
    },
    settings: {
      theme: 'system',
      accent: 'green',
      density: 'comfortable',
      weekStart: 1, // Monday
      timeFormat: '12h',
      dateFormat: 'YYYY-MM-DD',
      gamificationEnabled: true,
      soundEnabled: true,
      remindersEnabled: true,
      dndStart: '22:00',
      dndEnd: '07:00'
    }
  };
}
