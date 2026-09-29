"use strict";

// The saved timestamp is the source of truth, not the number of interval ticks.
function getElapsedSeconds(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
function getHours(totalSeconds) {
  return Math.floor(totalSeconds / 3600);
}
// Modulo removes complete hours before calculating the remaining minutes.
function getMinutes(totalSeconds) {
  return Math.floor((totalSeconds % 3600) / 60);
}
function getSeconds(totalSeconds) {
  return totalSeconds % 60;
}
// Hours may exceed 24; minutes and seconds always use two digits.
function formatDuration(totalSeconds) {
  return `${getHours(totalSeconds)}:${String(getMinutes(totalSeconds)).padStart(2, "0")}:${String(getSeconds(totalSeconds)).padStart(2, "0")}`;
}
function hasStartTime(draft) {
  return Number.isSafeInteger(draft?.startedAt) && draft.startedAt >= 0;
}
// Missing timing fields are valid for backups created before the timer feature.
function validateTiming(data) {
  if (data.draft?.startedAt !== undefined && !hasStartTime(data.draft))
    throw Error("Invalid start time");
  for (const session of data.sessions || []) {
    if (
      session.durationSeconds !== undefined &&
      (!Number.isSafeInteger(session.durationSeconds) || session.durationSeconds < 0)
    )
      throw Error("Invalid duration");
  }
}
