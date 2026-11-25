/**
 * HabitFlow Pro - UI Manager
 * Accessible Modals, Focus Traps, Toast Notifications, and Confirm Dialogs.
 * @module ui
 */

import { escapeHTML } from './utils.js';

let lastFocusedElement = null;

/**
 * Traps focus inside a modal container for accessibility (WCAG AA).
 * @param {HTMLElement} element
 * @returns {Function} cleanup function
 */
export function trapFocus(element) {
  const focusableSelectors = [
    'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', 'button:not([disabled])', 'iframe', 'object',
    'embed', '[contenteditable]', '[tabindex]:not([tabindex="-1"])'
  ];

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    const focusable = element.querySelectorAll(focusableSelectors.join(', '));
    if (focusable.length === 0) return;
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }

  element.addEventListener('keydown', handleKeyDown);
  return () => element.removeEventListener('keydown', handleKeyDown);
}

/**
 * Opens a modal dialog by its ID.
 * @param {string} modalId
 * @param {Object} [options]
 */
export function openModal(modalId, options = {}) {
  const backdrop = document.getElementById(modalId);
  if (!backdrop) return;

  lastFocusedElement = document.activeElement;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');

  const dialog = backdrop.querySelector('.modal-dialog');
  if (dialog) {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog._cleanupFocusTrap = trapFocus(dialog);

    // Auto-focus first input or close button
    const firstInput = dialog.querySelector('input:not([type="hidden"]), select, textarea, button.btn-primary');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 80);
    }
  }

  // Handle escape key
  function handleEsc(e) {
    if (e.key === 'Escape') {
      closeModal(modalId);
      window.removeEventListener('keydown', handleEsc);
    }
  }
  window.addEventListener('keydown', handleEsc);
  backdrop._escHandler = handleEsc;

  // Handle clicking on backdrop outside modal dialog
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      closeModal(modalId);
    }
  };
}

/**
 * Closes an active modal dialog.
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const backdrop = document.getElementById(modalId);
  if (!backdrop) return;

  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');

  const dialog = backdrop.querySelector('.modal-dialog');
  if (dialog && dialog._cleanupFocusTrap) {
    dialog._cleanupFocusTrap();
  }

  if (backdrop._escHandler) {
    window.removeEventListener('keydown', backdrop._escHandler);
  }

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

/**
 * Displays a non-blocking toast notification.
 * @param {Object} options
 * @param {string} options.message
 * @param {'success'|'error'|'warning'|'info'} [options.type='info']
 * @param {number} [options.duration=4000]
 * @param {string} [options.actionLabel]
 * @param {Function} [options.onAction]
 */
export function showToast({ message, type = 'info', duration = 4500, actionLabel, onAction }) {
  let container = document.getElementById('hf-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hf-toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');

  let actionBtnHTML = '';
  if (actionLabel && onAction) {
    actionBtnHTML = `<button type="button" class="toast-action">${escapeHTML(actionLabel)}</button>`;
  }

  toast.innerHTML = `
    <div class="toast-icon ${type}">${icons[type] || icons.info}</div>
    <div class="toast-message">${escapeHTML(message)}</div>
    ${actionBtnHTML}
    <button type="button" class="toast-close" aria-label="Close notification">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Action callback
  if (actionLabel && onAction) {
    const actionBtn = toast.querySelector('.toast-action');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        onAction();
        removeToast(toast);
      });
    }
  }

  // Close button
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => removeToast(toast));
  }

  // Auto dismiss
  const timer = setTimeout(() => {
    removeToast(toast);
  }, duration);

  function removeToast(el) {
    clearTimeout(timer);
    el.classList.remove('show');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 250);
  }
}

/**
 * Accessible Confirmation Modal.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.cancelText='Cancel']
 * @param {boolean} [options.danger=false]
 * @param {Function} options.onConfirm
 */
export function showConfirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm }) {
  const modalId = 'hf-confirm-modal';
  let backdrop = document.getElementById(modalId);

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" id="hf-confirm-title"></h3>
          <button type="button" class="btn-icon btn-icon-sm close-modal-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <p id="hf-confirm-desc" style="color: var(--color-text-muted); line-height: 1.5;"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary cancel-btn"></button>
          <button type="button" class="btn confirm-btn"></button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
  }

  const titleEl = backdrop.querySelector('#hf-confirm-title');
  const descEl = backdrop.querySelector('#hf-confirm-desc');
  const confirmBtn = backdrop.querySelector('.confirm-btn');
  const cancelBtn = backdrop.querySelector('.cancel-btn');
  const closeBtn = backdrop.querySelector('.close-modal-btn');

  titleEl.textContent = title;
  descEl.textContent = message;
  confirmBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;

  confirmBtn.className = danger ? 'btn btn-danger confirm-btn' : 'btn btn-primary confirm-btn';

  const cleanup = () => {
    closeModal(modalId);
  };

  confirmBtn.onclick = () => {
    cleanup();
    if (onConfirm) onConfirm();
  };

  cancelBtn.onclick = cleanup;
  closeBtn.onclick = cleanup;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) cleanup();
  };

  openModal(modalId);
}

/**
 * Type-to-confirm modal for destructive operations (e.g., typing 'RESET').
 * @param {Object} options
 * @param {string} options.phrase
 * @param {string} options.title
 * @param {string} options.message
 * @param {Function} options.onConfirm
 */
export function showTypeToConfirmModal({ phrase = 'RESET', title, message, onConfirm }) {
  const modalId = 'hf-type-confirm-modal';
  let backdrop = document.getElementById(modalId);

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" id="hf-type-title"></h3>
          <button type="button" class="btn-icon btn-icon-sm close-modal-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <p id="hf-type-desc" style="color: var(--color-text-muted); margin-bottom: var(--space-4);"></p>
          <div class="form-group">
            <label class="form-label">Type <strong id="hf-phrase-target" style="color: var(--color-danger);"></strong> to confirm:</label>
            <input type="text" id="hf-type-input" class="form-input" autocomplete="off" spellcheck="false" placeholder="">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
          <button type="button" class="btn btn-danger confirm-btn" disabled>Wipe Data</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
  }

  const titleEl = backdrop.querySelector('#hf-type-title');
  const descEl = backdrop.querySelector('#hf-type-desc');
  const phraseEl = backdrop.querySelector('#hf-phrase-target');
  const inputEl = backdrop.querySelector('#hf-type-input');
  const confirmBtn = backdrop.querySelector('.confirm-btn');
  const cancelBtn = backdrop.querySelector('.cancel-btn');
  const closeBtn = backdrop.querySelector('.close-modal-btn');

  titleEl.textContent = title;
  descEl.textContent = message;
  phraseEl.textContent = phrase;
  inputEl.value = '';
  confirmBtn.disabled = true;

  inputEl.oninput = () => {
    confirmBtn.disabled = inputEl.value.trim() !== phrase;
  };

  const cleanup = () => {
    closeModal(modalId);
    inputEl.value = '';
  };

  confirmBtn.onclick = () => {
    if (inputEl.value.trim() === phrase) {
      cleanup();
      if (onConfirm) onConfirm();
    }
  };

  cancelBtn.onclick = cleanup;
  closeBtn.onclick = cleanup;

  openModal(modalId);
}
