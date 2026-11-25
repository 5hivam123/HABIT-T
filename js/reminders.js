/**
 * HabitFlow Pro - Reminders & Notification Service
 * Native Web Notification API, DND checking, and in-app reminder alerts.
 * @module reminders
 */

import { getState } from './state.js';
import { getTodayDate } from './utils.js';
import { showToast } from './ui.js';

let notificationTimer = null;

/**
 * Checks whether current local time falls within user's Do-Not-Disturb window.
 * @param {string} dndStart "HH:MM" e.g. "22:00"
 * @param {string} dndEnd "HH:MM" e.g. "07:00"
 * @returns {boolean}
 */
export function isCurrentlyDND(dndStart = '22:00', dndEnd = '07:00') {
  if (!dndStart || !dndEnd) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sH, sM] = dndStart.split(':').map(Number);
  const [eH, eM] = dndEnd.split(':').map(Number);
  const startMinutes = sH * 60 + (sM || 0);
  const endMinutes = eH * 60 + (eM || 0);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  // Overnight DND (e.g., 22:00 to 07:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

/**
 * Requests native browser notification permission.
 * @returns {Promise<boolean>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast({ message: 'Desktop notifications are not supported in your browser.', type: 'warning' });
    return false;
  }

  if (Notification.permission === 'granted') {
    showToast({ message: 'Notifications are already enabled!', type: 'success' });
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showToast({ message: 'Notifications enabled successfully! 🎉', type: 'success' });
      return true;
    }
  }

  showToast({ message: 'Notification permission was denied in your browser settings.', type: 'info' });
  return false;
}

/**
 * Dispatches a native browser notification if allowed and not in DND.
 * @param {string} title
 * @param {string} body
 */
export function sendBrowserNotification(title, body) {
  const state = getState();
  const settings = state.settings || {};

  if (!settings.remindersEnabled) return;
  if (isCurrentlyDND(settings.dndStart, settings.dndEnd)) return;

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: './assets/icons/icon-192.svg',
        badge: './assets/icons/favicon.svg'
      });
    } catch (e) {
      console.warn('[Reminders] Could not send notification:', e);
    }
  }
}

/**
 * Checks for any habits scheduled today that have an exact reminderTime matching current time.
 */
export function checkScheduledReminders() {
  const state = getState();
  const today = getTodayDate();
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const completionsMap = new Map((state.completions || []).filter((c) => c.date === today).map((c) => [c.habitId, c]));

  (state.habits || []).forEach((habit) => {
    if (!habit.archived && habit.reminderTime === currentHHMM) {
      const record = completionsMap.get(habit.id);
      if (!record || record.status !== 'done') {
        sendBrowserNotification(
          `Time for ${habit.emoji || '🎯'} ${habit.name}!`,
          habit.description || 'Take a quick moment to complete your habit today.'
        );
      }
    }
  });
}

/**
 * Starts the periodic reminder check ticker (every 60 seconds).
 */
export function initRemindersTicker() {
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = setInterval(checkScheduledReminders, 60000);
}
