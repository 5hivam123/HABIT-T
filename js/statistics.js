/**
 * HabitFlow Pro - Statistics & Analytics Engine
 * Chart.js rendering, theme adaptation, period comparisons,
 * and text-based offline fallbacks.
 * @module statistics
 */

import { addDays, getTodayDate, getDayOfWeek } from './utils.js';
import { isHabitScheduledOnDate, calculateHabitStreak } from './streaks.js';
import { generateSmartInsights } from './insights.js';

// Holds active Chart.js instances for cleanup & re-render
let chartInstances = {};

/**
 * Destroys existing Chart.js instances before re-creating.
 */
export function destroyCharts() {
  Object.values(chartInstances).forEach((chart) => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  chartInstances = {};
}

/**
 * Computes analytics overview metrics.
 * @param {Object} state
 * @returns {Object}
 */
export function computeAnalyticsMetrics(state) {
  const habits = (state.habits || []).filter((h) => !h.archived);
  const completions = state.completions || [];
  const today = getTodayDate();

  // 1. All-time, 30-day, and 7-day completion rates
  const getRateForRange = (days) => {
    let scheduled = 0;
    let completed = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(today, -i);
      habits.forEach((h) => {
        if (isHabitScheduledOnDate(h, d)) {
          scheduled++;
          if (completions.some((c) => c.habitId === h.id && c.date === d && c.status === 'done')) {
            completed++;
          }
        }
      });
    }
    return scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
  };

  const rate7d = getRateForRange(7);
  const ratePrev7d = (() => {
    let scheduled = 0;
    let completed = 0;
    for (let i = 7; i < 14; i++) {
      const d = addDays(today, -i);
      habits.forEach((h) => {
        if (isHabitScheduledOnDate(h, d)) {
          scheduled++;
          if (completions.some((c) => c.habitId === h.id && c.date === d && c.status === 'done')) {
            completed++;
          }
        }
      });
    }
    return scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
  })();

  const rate30d = getRateForRange(30);

  // 2. Day-of-week performance (0 = Sun, 6 = Sat)
  const dayOfWeekStats = [
    { name: 'Sun', scheduled: 0, done: 0 },
    { name: 'Mon', scheduled: 0, done: 0 },
    { name: 'Tue', scheduled: 0, done: 0 },
    { name: 'Wed', scheduled: 0, done: 0 },
    { name: 'Thu', scheduled: 0, done: 0 },
    { name: 'Fri', scheduled: 0, done: 0 },
    { name: 'Sat', scheduled: 0, done: 0 }
  ];

  for (let i = 0; i < 60; i++) {
    const d = addDays(today, -i);
    const dow = getDayOfWeek(d);
    habits.forEach((h) => {
      if (isHabitScheduledOnDate(h, d)) {
        dayOfWeekStats[dow].scheduled++;
        if (completions.some((c) => c.habitId === h.id && c.date === d && c.status === 'done')) {
          dayOfWeekStats[dow].done++;
        }
      }
    });
  }

  dayOfWeekStats.forEach((d) => {
    d.rate = d.scheduled > 0 ? Math.round((d.done / d.scheduled) * 100) : 0;
  });

  const sortedDays = [...dayOfWeekStats].sort((a, b) => b.rate - a.rate);
  const bestDay = sortedDays[0];
  const worstDay = sortedDays[sortedDays.length - 1];

  // 3. Most and least consistent habits
  const habitConsistency = habits.map((h) => {
    const s = calculateHabitStreak(h, completions, today);
    return { habit: h, rate: s.consistencyRate, currentStreak: s.currentStreak };
  }).sort((a, b) => b.rate - a.rate);

  return {
    rate7d,
    ratePrev7d,
    rateDelta7d: rate7d - ratePrev7d,
    rate30d,
    bestDay,
    worstDay,
    mostConsistent: habitConsistency[0] || null,
    leastConsistent: habitConsistency[habitConsistency.length - 1] || null,
    habitConsistency
  };
}

/**
 * Initializes and draws Chart.js visualizations.
 * Gracefully falls back to text if Chart.js is not loaded (offline mode).
 * @param {Object} state
 */
export function renderAnalyticsCharts(state) {
  destroyCharts();

  if (typeof Chart === 'undefined') {
    console.warn('[Statistics] Chart.js not available. Showing text fallback.');
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches && !document.documentElement.getAttribute('data-theme'));

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#10b981';

  const today = getTodayDate();
  const habits = (state.habits || []).filter((h) => !h.archived);
  const completions = state.completions || [];

  // Chart 1: 7-Day Completion Bar Chart
  const weeklyCanvas = document.getElementById('chart-weekly-bar');
  if (weeklyCanvas) {
    const daysLabels = [];
    const daysData = [];

    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const dObj = new Date(d);
      daysLabels.push(dObj.toLocaleDateString(undefined, { weekday: 'short' }));

      let scheduled = 0;
      let done = 0;
      habits.forEach((h) => {
        if (isHabitScheduledOnDate(h, d)) {
          scheduled++;
          if (completions.some((c) => c.habitId === h.id && c.date === d && c.status === 'done')) {
            done++;
          }
        }
      });
      daysData.push(scheduled > 0 ? Math.round((done / scheduled) * 100) : 0);
    }

    chartInstances.weekly = new Chart(weeklyCanvas, {
      type: 'bar',
      data: {
        labels: daysLabels,
        datasets: [{
          label: 'Completion %',
          data: daysData,
          backgroundColor: accentColor,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => v + '%' } }
        }
      }
    });
  }

  // Chart 2: Category Distribution Doughnut
  const categoryCanvas = document.getElementById('chart-category-doughnut');
  if (categoryCanvas) {
    const catCounts = {};
    habits.forEach((h) => {
      catCounts[h.category] = (catCounts[h.category] || 0) + 1;
    });

    const catLabels = Object.keys(catCounts);
    const catData = Object.values(catCounts);
    const catColors = ['#10b981', '#8b5cf6', '#2563eb', '#f97316', '#f43f5e', '#06b6d4', '#eab308', '#64748b'];

    chartInstances.category = new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: catColors.slice(0, catLabels.length),
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12 } }
        }
      }
    });
  }
}
