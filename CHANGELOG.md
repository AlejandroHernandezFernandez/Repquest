# Changelog

## Source readability cleanup

- Format application JavaScript, styles, HTML, service worker, and timer test.
- Rename application, stylesheet, and service worker files to describe their roles.
- Add a code map and comments for storage, rewards, screens, and workout actions.
- Refresh the offline cache for the renamed files without changing the saved data key.

## v1.01

- Add a persistent workout-duration timer with hours, minutes, and seconds.
- Save completed durations in workout history and show them in recent activity.
- Keep legacy workouts unchanged; older drafts can start timing explicitly.
- Update the offline app-shell cache and add timer regression checks.
