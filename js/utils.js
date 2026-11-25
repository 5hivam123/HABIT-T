/**
 * HabitFlow Pro - Utility & Helper Functions
 * Pure date calculations, HTML escaping, ID generation, and debounce.
 * @module utils
 */

/**
 * Returns today's calendar date as a "YYYY-MM-DD" string in local time.
 * @returns {string} e.g. "2026-11-25"
 */
export function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Formats a Date object or timestamp into "YYYY-MM-DD" local calendar format.
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a "YYYY-MM-DD" string into a Date object at local midnight without UTC drift.
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Adds or subtracts N days from a "YYYY-MM-DD" string and returns a new "YYYY-MM-DD" string.
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
export function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Computes exact calendar day difference between two "YYYY-MM-DD" strings (date2 - date1).
 * @param {string} dateStr1
 * @param {string} dateStr2
 * @returns {number}
 */
export function diffInDays(dateStr1, dateStr2) {
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Returns weekday index: 0 for Sunday through 6 for Saturday.
 * @param {string} dateStr
 * @returns {number}
 */
export function getDayOfWeek(dateStr) {
  return parseDate(dateStr).getDay();
}

/**
 * Checks if a "YYYY-MM-DD" date string is in the future.
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isFutureDate(dateStr) {
  return dateStr > getTodayDate();
}

/**
 * Returns human-friendly relative label ("Today", "Yesterday", "Mon, Nov 25").
 * @param {string} dateStr
 * @returns {string}
 */
export function getRelativeDateLabel(dateStr) {
  const today = getTodayDate();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  const d = parseDate(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Escapes unsafe characters from user strings to prevent XSS injection.
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates an accessible, collision-resistant unique ID.
 * @param {string} [prefix='hf']
 * @returns {string}
 */
export function generateId(prefix = 'hf') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a debounced function that delays invoking func until wait ms have elapsed.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 250) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Clamps a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Formats minutes into human-readable duration (e.g. 45m or 1h 15m).
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}
