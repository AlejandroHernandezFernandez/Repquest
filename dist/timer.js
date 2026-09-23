'use strict';

// The saved timestamp is the source of truth, not the number of interval ticks.
function getElapsedSeconds(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
function getHours(totalSeconds) {
  return Math.floor(totalSeconds / 3600);
}
function getMinutes(totalSeconds) {
  return Math.floor((totalSeconds % 3600) / 60);
}
function getSeconds(totalSeconds) {
  return totalSeconds % 60;
}
function formatDuration(totalSeconds) {
  return `${getHours(totalSeconds)}:${String(getMinutes(totalSeconds)).padStart(2, '0')}:${String(getSeconds(totalSeconds)).padStart(2, '0')}`;
}
function hasStartTime(draft) {
  return Number.isSafeInteger(draft?.startedAt) && draft.startedAt >= 0;
}
function validateTiming(data) {
  if (data.draft?.startedAt !== undefined && !hasStartTime(data.draft)) throw Error('Invalid start time');
  for (const session of data.sessions || []) {
    if (session.durationSeconds !== undefined && (!Number.isSafeInteger(session.durationSeconds) || session.durationSeconds < 0)) throw Error('Invalid duration');
  }
}
