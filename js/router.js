/**
 * HabitFlow Pro - Hash-Based SPA Router
 * Zero page reloads, smooth view transitions, active navigation highlights,
 * and dynamic document title updating.
 * @module router
 */

import { getState } from './state.js';

let routes = {};
let currentRoute = null;

/**
 * Registers application route handlers.
 * @param {Object<string, Function>} routeMap
 */
export function registerRoutes(routeMap) {
  routes = routeMap;
}

/**
 * Returns current route path (e.g. "dashboard" or "habits").
 * @returns {string}
 */
export function getCurrentRoute() {
  return currentRoute;
}

/**
 * Handles route resolution on hashchange or initial load.
 */
export function handleRouteChange() {
  const hash = window.location.hash || '#/dashboard';
  const cleanPath = hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';

  currentRoute = cleanPath;
  const handler = routes[cleanPath] || routes['404'] || routes['dashboard'];

  // Update document title
  const titleMap = {
    dashboard: 'Dashboard',
    habits: 'Habits Tracker',
    calendar: 'Monthly Calendar',
    statistics: 'Analytics & Insights',
    journal: 'Journal & Reflections',
    goals: 'Milestone Goals',
    achievements: 'Badges & Achievements',
    settings: 'Settings'
  };
  const pageTitle = titleMap[cleanPath] || 'Habit Tracker';
  document.title = `${pageTitle} • Habbit Tracker`;

  // Update topbar title
  const topbarTitleEl = document.getElementById('hf-topbar-title');
  if (topbarTitleEl) {
    topbarTitleEl.textContent = pageTitle;
  }

  // Update active links in desktop sidebar and mobile bottom nav
  document.querySelectorAll('.nav-link, .mobile-nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === `"#/${cleanPath}"` || href === `#/${cleanPath}`) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Execute view render handler
  const container = document.getElementById('hf-page-content');
  if (container && typeof handler === 'function') {
    container.innerHTML = handler(getState());
    // Auto-scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

/**
 * Initializes hash routing listener.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  } else {
    handleRouteChange();
  }
}
