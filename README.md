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
- `dist/app.js`: UI, workout logic, rewards, charts, and persistence
- `dist/style.css`: styling
- `dist/sw.js`: service worker
- `dist/manifest.webmanifest`: PWA metadata
- `dist/icon-192.png`, `dist/icon-512.png`: app icons

The `dist` folder contains the editable application source, not generated build output.

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
