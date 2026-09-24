# Repquest

A gamified workout tracker built with HTML, CSS, and JavaScript. Log workouts, track progressive overload and body weight, and earn XP for consistency and progress. Installable as a PWA with local data storage.

## Features

- Workout routines and custom workouts with sets, reps, and weight.
- Saved in-progress workouts and completed workout history.
- Progress comparisons and XP for workout completion and improved performance.
- Bodyweight logging and progress charts.
- Weekly goals and pounds/kilograms settings.
- JSON backup export and restore.
- Web app manifest and service worker for an installable app and cached app shell.

## Run locally

No build step or npm dependencies are required. With Python 3 installed, run from the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Then open http://localhost:8000 in your browser. PWA features require HTTPS or localhost.

## Code layout

- `dist/index.html`: page shell
- `dist/workout-tracker.js`: screens, workout actions, XP, charts, and storage
- `dist/workout-styles.css`: colors, layout, controls, and mobile styling
- `dist/timer.js`: elapsed-time and duration formatting helpers
- `dist/service-worker.js`: offline app shell and cache cleanup
- `dist/manifest.webmanifest`: PWA metadata
- `dist/icon-192.png`, `dist/icon-512.png`: app icons
- `tests/timer.test.cjs`: timer and saved-workout regression checks

The `dist` folder contains the editable application source, not generated build output.

## Where to make a change

| To change | Look for in `dist/workout-tracker.js` |
| --- | --- |
| Saved data and JSON backup checks | `KEY`, `data`, `validate()`, `save()` |
| XP and progressive overload | `rewards()`, `previous()` |
| Home screen and recent activity | `home()`, `recent()` |
| Preset workouts and set editing | `routines`, `start()`, `workout()`, `bind()` |
| Progress charts and body weight | `chart()`, `progress()` |
| Past workouts and preferences | `history()`, `settings()` |
| Complete a workout | `finish()` |
| Page navigation and event handlers | `go()`, `render()`, `bind()` |

Screen functions generate the HTML for each page. `render()` inserts that HTML, then `bind()` reconnects the buttons and inputs on the new screen. Styles for the same UI are in `dist/workout-styles.css`, grouped by section comments.

`data.sessions` contains completed workouts, `data.weights` contains body weight entries, and `data.draft` contains a workout in progress. The `repquest-v1` storage key must stay the same to keep existing browser data. A source update at the same URL keeps that data; a different domain or browser has separate storage. Back up your log with **Settings → Export** before changing devices.

To apply the same formatting to code you edit later, run `npx prettier@3.9.9 --write dist/workout-tracker.js dist/workout-styles.css dist/index.html dist/service-worker.js` from the repository root. This formats source text; it does not publish the website.

## Data and privacy

Workout data stays in the current browser/device's localStorage under `repquest-v1`. There is no account system or cross-device sync. Export a backup before clearing browser data or changing devices. Different origins, browsers, and app contexts may have separate storage.

Only application code is included here, not personal workout logs. The stylesheet loads fonts from Google Fonts.

## Development

This repository starts with the existing AI-assisted prototype. Future feature work will be recorded in separate commits as part of a guided learning workflow.

## v1.01 — Workout duration timer

- Starts automatically when a new workout begins.
- Recalculates elapsed time from a saved timestamp, including time spent on other screens or with the phone locked.
- Saves the final duration in workout history and recent activity.
- Preserves old data; legacy drafts offer an explicit Start timer now option.
- Does not affect XP, sets, weights, or the storage key.

Timer helpers live in `dist/timer.js`. Run the regression checks with Node.js:

```sh
node tests/timer.test.cjs
```

The existing hosted app is deployed separately. Pushing to this GitHub repository does not automatically update that deployment.
