/**
 * HabitFlow Pro - Keyboard Shortcuts & Command Palette
 * Global shortcut listeners, Command Palette dialog (Ctrl/Cmd + K),
 * and page navigation combos.
 * @module shortcuts
 */

import { openHabitModal } from './habits.js';
import { exportDataJSON } from './storage.js';
import { getState, updateSettings } from './state.js';
import { openModal, closeModal, showToast } from './ui.js';

let pendingGKey = false;
let gKeyTimeout = null;

/**
 * Initializes global keyboard shortcut listeners.
 */
export function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
      document.activeElement?.isContentEditable;

    // 1. Command Palette: Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }

    // 2. Escape closes command palette or active modals
    if (e.key === 'Escape') {
      closeCommandPalette();
      return;
    }

    // Do not trigger single-key navigation shortcuts while actively typing in a form
    if (isInputActive) return;

    // 3. 'N': Create new habit
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openHabitModal();
      return;
    }

    // 4. '/': Focus global search
    if (e.key === '/') {
      e.preventDefault();
      const searchInput = document.getElementById('hf-global-search') || document.querySelector('.habits-search-input');
      if (searchInput) searchInput.focus();
      return;
    }

    // 5. '?': Open shortcuts cheatsheet
    if (e.key === '?') {
      e.preventDefault();
      openShortcutsHelpModal();
      return;
    }

    // 6. 'G' then page letter (D = Dashboard, H = Habits, C = Calendar, S = Stats, J = Journal, G = Goals, A = Achievements)
    if (e.key === 'g' || e.key === 'G') {
      pendingGKey = true;
      clearTimeout(gKeyTimeout);
      gKeyTimeout = setTimeout(() => {
        pendingGKey = false;
      }, 1000);
      return;
    }

    if (pendingGKey) {
      pendingGKey = false;
      const k = e.key.toLowerCase();
      const routes = {
        d: '#/dashboard',
        h: '#/habits',
        c: '#/calendar',
        s: '#/statistics',
        j: '#/journal',
        g: '#/goals',
        a: '#/achievements'
      };
      if (routes[k]) {
        e.preventDefault();
        window.location.hash = routes[k];
      }
    }
  });
}

/**
 * Opens or toggles the Command Palette dialog.
 */
export function toggleCommandPalette() {
  const modalId = 'hf-command-palette-modal';
  let backdrop = document.getElementById(modalId);

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="command-palette-dialog">
        <div class="command-palette-input-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="hf-cmd-input" class="command-palette-input" placeholder="Type a command or habit name..." autocomplete="off">
          <span class="kbd-shortcut">ESC</span>
        </div>
        <div class="command-palette-results" id="hf-cmd-results">
          <!-- Dynamic commands and search items -->
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeCommandPalette();
    };

    const input = backdrop.querySelector('#hf-cmd-input');
    input.oninput = () => renderCommandPaletteItems(input.value.trim());
  }

  const input = backdrop.querySelector('#hf-cmd-input');
  input.value = '';
  renderCommandPaletteItems('');

  openModal(modalId);
  setTimeout(() => input.focus(), 60);
}

export function closeCommandPalette() {
  closeModal('hf-command-palette-modal');
}

/**
 * Renders filtered action items inside the Command Palette.
 * @param {string} filterText
 */
function renderCommandPaletteItems(filterText) {
  const resultsEl = document.getElementById('hf-cmd-results');
  if (!resultsEl) return;

  const state = getState();
  const lower = filterText.toLowerCase();

  const standardActions = [
    { label: 'Create New Habit', shortcut: 'N', action: () => { closeCommandPalette(); openHabitModal(); } },
    { label: 'Go to Dashboard', shortcut: 'G D', action: () => { closeCommandPalette(); window.location.hash = '#/dashboard'; } },
    { label: 'Go to Habits', shortcut: 'G H', action: () => { closeCommandPalette(); window.location.hash = '#/habits'; } },
    { label: 'Go to Calendar', shortcut: 'G C', action: () => { closeCommandPalette(); window.location.hash = '#/calendar'; } },
    { label: 'Go to Statistics', shortcut: 'G S', action: () => { closeCommandPalette(); window.location.hash = '#/statistics'; } },
    { label: 'Go to Journal', shortcut: 'G J', action: () => { closeCommandPalette(); window.location.hash = '#/journal'; } },
    { label: 'Go to Goals', shortcut: 'G G', action: () => { closeCommandPalette(); window.location.hash = '#/goals'; } },
    { label: 'Go to Achievements', shortcut: 'G A', action: () => { closeCommandPalette(); window.location.hash = '#/achievements'; } },
    { label: 'Go to Settings', shortcut: '', action: () => { closeCommandPalette(); window.location.hash = '#/settings'; } },
    { label: 'Toggle Dark/Light Theme', shortcut: '', action: () => {
      closeCommandPalette();
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      updateSettings({ theme: next });
      showToast({ message: `Switched to ${next} theme!`, type: 'info' });
    }},
    { label: 'Export Backup JSON', shortcut: '', action: () => { closeCommandPalette(); exportDataJSON(state); } }
  ];

  const matchedActions = standardActions.filter((a) => a.label.toLowerCase().includes(lower));

  // Habit search matches
  const matchedHabits = (state.habits || [])
    .filter((h) => !h.archived && h.name.toLowerCase().includes(lower))
    .map((h) => ({
      label: `${h.emoji} ${h.name}`,
      shortcut: h.category,
      action: () => {
        closeCommandPalette();
        window.location.hash = '#/habits';
      }
    }));

  let html = '';

  if (matchedActions.length > 0) {
    html += '<div class="command-group-title">Quick Actions</div>';
    matchedActions.forEach((item, idx) => {
      html += `
        <div class="command-item ${idx === 0 ? 'selected' : ''}" data-index="${idx}">
          <div class="command-item-left">
            <span>${item.label}</span>
          </div>
          ${item.shortcut ? `<span class="kbd-shortcut">${item.shortcut}</span>` : ''}
        </div>
      `;
    });
  }

  if (matchedHabits.length > 0) {
    html += '<div class="command-group-title" style="margin-top: var(--space-2);">Habits</div>';
    matchedHabits.forEach((item, idx) => {
      const globalIdx = matchedActions.length + idx;
      html += `
        <div class="command-item" data-index="${globalIdx}">
          <div class="command-item-left">
            <span>${item.label}</span>
          </div>
          <span class="badge badge-neutral">${item.shortcut}</span>
        </div>
      `;
    });
  }

  if (!html) {
    html = '<div style="padding: var(--space-6); text-align: center; color: var(--color-text-muted);">No matching commands or habits found.</div>';
  }

  resultsEl.innerHTML = html;

  // Click handler
  const allItems = [...matchedActions, ...matchedHabits];
  resultsEl.querySelectorAll('.command-item').forEach((itemEl) => {
    itemEl.onclick = () => {
      const idx = Number(itemEl.dataset.index);
      if (allItems[idx]) allItems[idx].action();
    };
  });
}

/**
 * Opens Keyboard Shortcuts reference cheat-sheet modal.
 */
export function openShortcutsHelpModal() {
  const modalId = 'hf-shortcuts-modal';
  let backdrop = document.getElementById(modalId);

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">Keyboard Shortcuts</h3>
        <button type="button" class="btn-icon btn-icon-sm close-modal-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid var(--color-border); padding: 8px 0;">
              <td style="padding: 10px 0; font-weight: 500;">Command Palette</td>
              <td style="text-align: right;"><span class="kbd-shortcut">Ctrl / Cmd + K</span></td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 10px 0; font-weight: 500;">Create New Habit</td>
              <td style="text-align: right;"><span class="kbd-shortcut">N</span></td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 10px 0; font-weight: 500;">Focus Search Bar</td>
              <td style="text-align: right;"><span class="kbd-shortcut">/</span></td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 10px 0; font-weight: 500;">Go to Dashboard / Habits</td>
              <td style="text-align: right;"><span class="kbd-shortcut">G D</span> / <span class="kbd-shortcut">G H</span></td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 10px 0; font-weight: 500;">Go to Calendar / Stats</td>
              <td style="text-align: right;"><span class="kbd-shortcut">G C</span> / <span class="kbd-shortcut">G S</span></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 500;">Close Modal / Dismiss</td>
              <td style="text-align: right;"><span class="kbd-shortcut">ESC</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  backdrop.querySelector('.close-modal-btn').onclick = () => closeModal(modalId);
  openModal(modalId);
}
