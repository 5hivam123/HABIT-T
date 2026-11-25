# Habit Tracker Pro • Portfolio-Grade Habit Tracker

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-10b981.svg)](#pwa--offline-support)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-ES6%2B%20Modules-f59e0b.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/CSS3-Custom%20Tokens-3b82f6.svg)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b5cf6.svg)](LICENSE)

**Habit Tracker Pro** is an installable, offline-first personal discipline and habit tracking web application built exclusively with **HTML5**, **CSS3**, and **Vanilla JavaScript (ES6+ modules)**. Designed with SaaS-level polish (blending the aesthetic clarity of *Notion*, the micro-interactions of *Streaks*, and the efficiency of *Linear*).

---

## 1. System Architecture & Data Flow

```text
       ┌────────────────────────────────────────────────────────┐
       │                   Browser LocalStorage                 │
       │         (Schema versioned, validated, auto-repair)     │
       └─────────────────────────▲──────────────────────────────┘
                                 │ Save / Load
       ┌─────────────────────────▼──────────────────────────────┐
       │                   Central State Store                  │
       │                (state.js - Reactive Pub/Sub)           │
       └─────────────────────────▲──────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ Notify Subscribers            │ User Actions
                 ▼                               │
       ┌──────────────────┐            ┌─────────┴──────────────┐
       │   Router (SPA)   │            │   UI Controllers       │
       │  (hash routing)  │            │  (Habits, Streaks,     │
       └─────────┬────────┘            │   Calendar, Insights)  │
                 │                     └────────────────────────┘
                 ▼
       ┌────────────────────────────────────────────────────────┐
       │               Dynamic DOM View Rendering               │
       │          (Accessible, WCAG AA, No Frameworks)          │
       └────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

- **Zero Build Tools / 100% Vanilla:** Runs by opening `index.html` via VS Code Live Server or standard web server.
- **Three Habit Tracking Types:**
  - `Yes/No` (Standard boolean completion)
  - `Counter` (e.g. 8 glasses of water with `+` and `-` controls)
  - `Timer / Duration` (e.g. 25-minute reading or meditation with live running timer)
- **Mathematical Streak Engine:**
  - Evaluated strictly using calendar dates `YYYY-MM-DD` (never click counts or timestamps).
  - Respects frequencies: Daily, Weekdays (Mon-Fri), and Intervals.
  - **Streak Freezes:** Earn 1 freeze per 7-day streak (auto-used on missed days to protect momentum).
  - **Skip Days:** Mark sick or rest days without breaking current streak.
- **Visual Analytics:**
  - **GitHub-Style Contribution Heatmap:** Built with pure CSS Grid and 5 intensity levels.
  - **Interactive Charts:** 7-Day completion bar chart and category distribution doughnut chart powered by Chart.js (adapts automatically to Light/Dark mode).
  - **Text Fallback:** Offline-resilient text statistics if external CDN is blocked.
- **Gamification Engine:**
  - Earn XP scaled by habit priority and streak multipliers.
  - Level progression with animated XP progress bar.
  - **22 Unlockable Badges** with criteria inspection, unlock dates, and progress counters.
- **Smart Insights (Local Rule-Based):**
  - Detects weekday vs. weekend patterns, slipping habits, and approaching milestones without external APIs.
- **Reflection Journal & Mood:**
  - 5-point emoji mood tracking on habit completion.
  - Dedicated daily reflection log and searchable timeline history.
- **Reliable Data Persistence:**
  - Automatic rolling snapshots (3 backups).
  - Schema migration (v1 → v2).
  - Corrupted data repair & duplicate entry prevention.
  - Cross-tab synchronization via `storage` event.
  - Export to JSON / CSV and Merge / Replace JSON import.
- **Power User Shortcuts & Command Palette (`Ctrl + K` / `Cmd + K`):**
  - Search habits, jump across pages (`G D`, `G H`, `G C`, etc.), or trigger actions instantly.

---

## 3. Project Structure

```text
HabitFlowPro/
├── index.html                  # Main application shell & entrypoint
├── manifest.json               # PWA configuration manifest
├── service-worker.js           # Offline caching & service worker
├── README.md                   # System documentation
├── tests.html                  # In-browser unit test runner (25+ tests)
│
├── css/
│   ├── base.css                # Reset, CSS variables, typography tokens
│   ├── themes.css              # Light, Dark, System & 5 accent palettes
│   ├── layout.css              # Shell, desktop sidebar, topbar, mobile nav
│   ├── components.css          # Cards, buttons, modals, toasts, inputs
│   ├── pages.css               # Page-specific views & heatmap styles
│   └── responsive.css          # Breakpoints (320px to 1440px) & safe areas
│
├── js/
│   ├── app.js                  # Application bootstrap & event binding
│   ├── router.js               # Hash-based SPA routing
│   ├── state.js                # Central state & reactive pub/sub store
│   ├── storage.js              # LocalStorage wrapper, schema migrations, export/import
│   ├── habits.js               # Habit CRUD, counter/timer controls, cards
│   ├── streaks.js              # Pure calendar date streak engine
│   ├── gamification.js         # XP formula, level calculation, 22 badges
│   ├── dashboard.js            # Time-aware greeting, stats, time-of-day clusters
│   ├── calendar.js             # Monthly/weekly calendar & backfilling
│   ├── heatmap.js              # Pure CSS-grid yearly contribution matrix
│   ├── statistics.js           # Chart.js analytics & period comparisons
│   ├── insights.js             # Local rule-based behavioral insights
│   ├── journal.js              # Reflection journal & 5-emoji mood scale
│   ├── goals.js                # Milestone goals linked to habits
│   ├── reminders.js            # Notification API & DND checking
│   ├── shortcuts.js            # Keyboard shortcuts & Command Palette (Ctrl+K)
│   ├── confetti.js             # Canvas particle celebration effect
│   ├── ui.js                   # Accessible modals, focus traps, toasts
│   └── utils.js                # Pure date helpers, XSS escaping, debounce
│
├── data/
│   └── sample-data.js          # 6 realistic habits + 30 days of completion history
│
└── assets/
    └── icons/                  # PWA icons (192, 512, SVG favicon)
```

---

## 4. How to Run Locally

### Option A: VS Code Live Server (Recommended)
1. Open Visual Studio Code.
2. Open the folder: `HabitFlowPro/` (or the parent directory `projectc2.O`).
3. Right-click `index.html` and select **"Open with Live Server"**.
4. The application will open at `http://127.0.0.1:5500/index.html`.

### Option B: Built-in Python Server
```bash
cd HabitFlowPro
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in any modern browser.

---

## 5. Keyboard Shortcuts Reference

| Shortcut | Description |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open **Command Palette** |
| `N` | Open **New Habit** modal |
| `/` | Focus search bar |
| `G` then `D` | Navigate to **Dashboard** |
| `G` then `H` | Navigate to **Habits** |
| `G` then `C` | Navigate to **Calendar** |
| `G` then `S` | Navigate to **Analytics / Statistics** |
| `G` then `J` | Navigate to **Journal** |
| `G` then `G` | Navigate to **Goals** |
| `G` then `A` | Navigate to **Badges & Achievements** |
| `?` | Open **Shortcuts Cheatsheet** |
| `Esc` | Dismiss open dialogs / Command Palette |

---

## 6. Testing

Open `tests.html` in your browser to execute the built-in unit test suite:
- Date manipulation & month boundary calculations
- Streak engine (Daily, Weekdays, X per week, Freezes, Skips)
- Completion deduplication & storage repair
- Gamification XP and Level progression formulas
- JSON import schema validation

---

## 7. License
MIT License. Created for portfolio presentation and demonstration.
