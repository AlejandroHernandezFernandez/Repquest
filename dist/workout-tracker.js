"use strict";
// Repquest's editable app source; index.html loads timer.js before this file.
// Find a screen by its function name: home, workout, progress, history, settings.
// Flow: user action -> update data -> save() -> render() -> bind() -> syncTimer().
// HTML templates use /* HTML */ so Prettier can indent their markup too.
const $ = (s) => document.querySelector(s),
  KEY = "repquest-v1";

// Appearance is saved separately from workout backups, on this browser/origin.
const THEME_KEY = "repquest-theme";
let theme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
document.documentElement.dataset.theme = theme;
const icons = {
  lift: '<path d="M3 9v6m4-9v12m10-12v12m4-9v6M7 12h10"/>',
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v6m-4 1h8"/>',
  weight: '<path d="M5 7h14l2 14H3ZM9 7V5a3 3 0 0 1 6 0v2"/>',
};
const ic = (n, size = 22) => /* HTML */ `
  <svg
    width="${size}"
    height="${size}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${icons[n] || icons.lift}
  </svg>
`;
// Escape user-entered names before inserting them into HTML or attributes.
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
// Use local calendar dates; UTC conversion can move a workout to another day.
const day = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => day();
const fmt = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const weekStart = (d) => {
  let n = new Date(d + "T12:00:00");
  n.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  return day(n);
};
// Browser state and saved workout data. Keep KEY stable so existing logs load.
let data = {
    version: 1,
    sessions: [],
    weights: [],
    goal: 4,
    unit: "lb",
    draft: null,
  },
  view = "home",
  selected = "",
  loadError = "";
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    validate(parsed);
    data = parsed;
  }
} catch (e) {
  loadError =
    "Your saved data could not be opened. Restore a backup in Settings; existing storage has not been overwritten.";
}
// Check imported or stored data before using it. Optional timing fields support
// backups made before the workout duration feature existed.
function validate(d) {
  validateTiming(d);
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.sessions) ||
    !Array.isArray(d.weights) ||
    !["lb", "kg"].includes(d.unit) ||
    !Number.isInteger(d.goal) ||
    d.goal < 1 ||
    d.goal > 7
  )
    throw Error("Invalid backup");
  const ids = new Set();
  for (const s of d.sessions) {
    if (
      typeof s.id !== "string" ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      s.name.length > 100 ||
      !validDate(s.date) ||
      !Array.isArray(s.exercises) ||
      !s.exercises.length
    )
      throw Error("Invalid workout");
    ids.add(s.id);
    for (const e of s.exercises) {
      if (
        typeof e.name !== "string" ||
        !e.name.trim() ||
        e.name.length > 80 ||
        !Array.isArray(e.sets) ||
        !e.sets.length
      )
        throw Error("Invalid exercise");
      for (const r of e.sets)
        if (
          !Number.isFinite(r.weight) ||
          r.weight < 0 ||
          r.weight > 2000 ||
          !Number.isInteger(r.reps) ||
          r.reps < 1 ||
          r.reps > 500
        )
          throw Error("Invalid set");
    }
  }
  for (const w of d.weights)
    if (!validDate(w.date) || !Number.isFinite(w.value) || w.value <= 0 || w.value > 1500)
      throw Error("Invalid bodyweight");
  if (d.draft) {
    if (
      !Array.isArray(d.draft.exercises) ||
      typeof d.draft.name !== "string" ||
      !validDate(d.draft.date)
    )
      throw Error("Invalid draft");
    for (const e of d.draft.exercises) {
      if (typeof e.name !== "string" || !Array.isArray(e.sets))
        throw Error("Invalid draft exercise");
      for (const s of e.sets)
        if (
          !["string", "number"].includes(typeof s.weight) ||
          !["string", "number"].includes(typeof s.reps) ||
          typeof s.done !== "boolean" ||
          (s.weight !== "" &&
            (!Number.isFinite(Number(s.weight)) ||
              Number(s.weight) < 0 ||
              Number(s.weight) > 2000)) ||
          (s.reps !== "" &&
            (!Number.isInteger(Number(s.reps)) ||
              Number(s.reps) < 1 ||
              Number(s.reps) > 500))
        )
          throw Error("Invalid draft set");
    }
  }
}
// Reject impossible dates and future workouts; comparisons use YYYY-MM-DD.
function validDate(d) {
  return (
    typeof d === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !isNaN(new Date(d + "T12:00:00")) &&
    day(new Date(d + "T12:00:00")) === d &&
    d <= today()
  );
}
// Persist the full state after changes to sessions, body weights, or the draft.
function save() {
  try {
    if (loadError) throw Error();
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    toast("Could not save. Keep this page open and export a backup.");
    return false;
  }
}
// Restart the 4.5-second alert timeout on each message. CSS hides it without .show.
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
const XP_BASE = 150; // XP needed to go from level 1 to level 2
const XP_GROWTH = 1.25; // each level needs 25% more than the last

// XP needed to finish level n. Rounding from the base each time avoids drift.
  const GROWTH_STOPS_AT = 25; // add this under XP_GROWTH
  const xpForLevel = (n) =>
    Math.round(XP_BASE * XP_GROWTH ** (Math.min(n, GROWTH_STOPS_AT) - 1));

// Turn total XP into { level, xp earned inside this level, xp needed for this level }.
function levelInfo(total) {
  let level = 1,
    need = xpForLevel(1),
    left = total;
  while (left >= need) {
    left -= need;
    level++;
    need = xpForLevel(level);
  }
  return { level, xp: left, need };
}

const norm = (s) => s.trim().toLowerCase();
const sorted = () =>
  [...data.sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
// XP and progress: calculate earned rewards from completed workouts and sets.
function rewards() {
  const prev = new Map(),
    dates = new Set(),
    bonuses = new Set(),
    result = { total: 0, prs: 0, byId: {} };
  // Replay sessions chronologically so edits/deletions recalculate all rewards.
  for (const s of sorted()) {
    let xp = dates.has(s.date) ? 0 : 25;
    dates.add(s.date);
    const reasons = xp ? ["Workout completed +25"] : [];
    let daily = 0;
    for (const e of s.exercises) {
      const key = norm(e.name),
        p = prev.get(key),
        awardKey = s.date + key;
      let bonus = 0,
        reason = "";
      // One progress bonus per exercise/day; priority is weight, reps, then sets.
      if (p && !bonuses.has(awardKey)) {
        const heavier = e.sets.some(
          (r) =>
            r.weight > Math.max(...p.sets.map((x) => x.weight)) &&
            r.reps >=
              Math.max(
                ...p.sets
                  .filter((x) => x.weight === Math.max(...p.sets.map((x) => x.weight)))
                  .map((x) => x.reps),
              ),
        );
        const moreReps = e.sets.some(
          (r) =>
            p.sets.some((x) => x.weight === r.weight) &&
            r.reps >
              Math.max(...p.sets.filter((x) => x.weight === r.weight).map((x) => x.reps)),
        );
        const repVolume = [...new Set(e.sets.map((x) => x.weight))].some((w) => {
          const a = e.sets.filter((x) => x.weight === w),
            b = p.sets.filter((x) => x.weight === w);
          return (
            a.length === b.length &&
            b.length > 0 &&
            a.reduce((n, x) => n + x.reps, 0) > b.reduce((n, x) => n + x.reps, 0)
          );
        });
        if (heavier) {
          bonus = 15;
          reason = "Heavier lift";
          result.prs++;
        } else if (moreReps || repVolume) {
          bonus = 10;
          reason = "Rep best";
          result.prs++;
        } else if (
          e.sets.length > p.sets.length &&
          p.sets.every((x, i) => e.sets[i].weight >= x.weight && e.sets[i].reps >= x.reps)
        ) {
          bonus = 5;
          reason = "Extra working set";
        }
        if (bonus) {
          bonuses.add(awardKey);
          // Completion XP is separate from the 60-point daily progress cap.
          const used = result.byId["_daily" + s.date] || 0;
          bonus = Math.min(bonus, Math.max(0, 60 - used));
          result.byId["_daily" + s.date] = used + bonus;
          xp += bonus;
          if (bonus) reasons.push(`${e.name}: ${reason} +${bonus}`);
        }
      }
      prev.set(key, e);
    }
    result.total += xp;
    result.byId[s.id] = { xp, reasons };
  }
  return result;
}
// Find the latest earlier result for this exercise when comparing performance.
function previous(name, date = today()) {
  return sorted()
    .filter((s) => s.date <= date)
    .flatMap((s) => s.exercises.filter((e) => norm(e.name) === norm(name)))
    .at(-1);
}

let timerId = null;

// Old sessions have no duration; omit the label instead of inventing a time.
function durationLabel(session) {
  return Number.isSafeInteger(session.durationSeconds)
    ? /* HTML */ `
        <span class="duration-label">
          Duration · ${formatDuration(session.durationSeconds)}
        </span>
      `
    : "";
}
// Build the timer card. Legacy drafts offer an explicit start-time button.
function workoutClock(draft) {
  if (!hasStartTime(draft))
    return /* HTML */ `
      <section class="card workout-clock">
        <div>
          <strong>Duration wasn't tracked for this workout.</strong>
          <p class="small muted">
            This draft predates the timer. Your sets are safe; you can start timing from
            now.
          </p>
        </div>
        <button class="secondary" id="start-timer">Start timer now</button>
      </section>
    `;
  return /* HTML */ `
    <section class="card workout-clock">
      <div>
        <div class="eyebrow">WORKOUT DURATION</div>
        <span
          id="workout-timer"
          role="timer"
          aria-label="Elapsed workout time"
          aria-live="off"
        >
          ${formatDuration(getElapsedSeconds(draft.startedAt))}
        </span>
      </div>
    </section>
  `;
}
// Refresh only the timer text, keeping focused workout inputs intact.
function updateTimer() {
  const timer = document.getElementById("workout-timer");
  if (!timer || !hasStartTime(data.draft)) return;
  timer.textContent = formatDuration(getElapsedSeconds(data.draft.startedAt));
}
// Clear the old interval after each render so only one visible timer can run.
function syncTimer() {
  clearInterval(timerId);
  timerId = null;
  updateTimer();
  if (document.getElementById("workout-timer") && hasStartTime(data.draft)) {
    timerId = setInterval(updateTimer, 1000);
  }
  const startTimer = document.getElementById("start-timer");
  if (startTimer)
    startTimer.onclick = () => {
      if (!data.draft || hasStartTime(data.draft)) return;
      data.draft.startedAt = Date.now();
      if (!save()) {
        delete data.draft.startedAt;
        return;
      }
      render();
    };
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateTimer();
});
window.addEventListener("pageshow", updateTimer);

// Navigation and screen rendering. Each screen returns its HTML; bind() attaches
// controls again after the screen changes.
function go(v) {
  view = v;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
// Replace the screen markup, then reconnect handlers to the newly created elements.
function render() {
  const r = rewards(),
  { level, xp: levelXp, need } = levelInfo(r.total);
  $("#app").innerHTML = /* HTML */ `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">${ic("lift", 32)}repquest</div>
        <nav class="nav" aria-label="Main navigation">
          ${[
            ["home", "Overview", "home"],
            ["workout", "Workout", "lift"],
            ["progress", "Progress", "chart"],
            ["history", "History", "history"],
            ["settings", "Settings", "settings"],
          ]
            .map(
              ([v, n, i]) => /* HTML */ `
                <button
                  data-view="${v}"
                  class="${view === v ? "active" : ""}"
                  ${view === v ? 'aria-current="page"' : ""}
                >
                  ${ic(i)}${n}
                </button>
              `,
            )
            .join("")}
        </nav>
        <div class="sidefoot">
          <span class="avatar">A</span>
          <strong>Your training space</strong>
          <p>Small wins. Stronger you.</p>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <span class="eyebrow">YOUR PERSONAL TRAINING LOG</span>
          <div class="brand mobilebrand">${ic("lift")}repquest</div>
          <div class="topstats">
          <span class="gold xptext">${ic("bolt")} ${r.total} XP</span>
            <div
              class="xpmeter gold"
              role="progressbar"
              aria-label="Progress to level ${level + 1}"
              aria-valuemin="0"
              aria-valuemax="${need}"
              aria-valuenow="${levelXp}"
            >
              ${ic("bolt")}
              <div class="xptrack">
                <div class="xpfill" style="width: ${(levelXp / need) * 100}%"></div>
              </div>
            </div>
            <span class="green">${ic("trophy")} Level ${level}</span>
            <span class="muted">${ic("target")} ${data.sessions.length} workouts</span>
          </div>
        </header>
        ${
          loadError
            ? /* HTML */ `
                <p class="notice error">${esc(loadError)}</p>
              `
            : ""
        }${
          view === "home"
            ? home(r)
            : view === "workout"
              ? workout()
              : view === "progress"
                ? progress()
                : view === "history"
                  ? history(r)
                  : settings()
        }
      </main>
    </div>
  `;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => (b.onclick = () => go(b.dataset.view)));
  bind();
  syncTimer();
}
// Dashboard and recent workouts.
function home(r) {
  const lv = levelInfo(r.total);
  const start = weekStart(today()),
  days = [...Array(7).keys()].map((i) => {
      const d = new Date(start + "T12:00:00");
      d.setDate(d.getDate() + i);
      return day(d);
    }),
    done = new Set(data.sessions.map((s) => s.date)),
    count = days.filter((d) => done.has(d)).length;
  return /* HTML */ `
    <div class="heading">
      <div>
        <div class="eyebrow">LET'S BUILD SOME MOMENTUM</div>
        <h1>Every rep counts.</h1>
        <p class="sub">Show up. Get stronger. Earn your next level.</p>
      </div>
      <span class="pill">
        ${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </span>
    </div>
    <div class="layout">
      <div class="stack">
        <section class="card">
          <div class="row">
            <h2>This week's quest</h2>
            <span class="xpchip">${count} / ${data.goal} workouts</span>
          </div>
          <div class="week">
            ${days
              .map(
                (d, i) => /* HTML */ `
                  <div
                    class="day ${d === today() ? "today" : ""} ${done.has(d) ? "done" : ""}"
                  >
                    <span>${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}</span>
                    <div class="daycircle">
                      ${done.has(d) ? ic("check", 20) : new Date(d + "T12:00:00").getDate()}
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="row small">
            <span class="muted">
              ${
                count >= data.goal
                  ? "Weekly goal complete. You earned that rest."
                  : `${data.goal - count} more workout${data.goal - count === 1 ? "" : "s"} to reach your goal`
              }
            </span>
            <span class="green">
              ${Math.min(100, Math.round((count / data.goal) * 100))}%
            </span>
          </div>
          <div class="progressbar">
            <span style="width: ${Math.min(100, (count / data.goal) * 100)}%"></span>
          </div>
        </section>
        <section class="card startcard">
          <span class="eyebrow" style="color: #75a447">YOUR NEXT WIN STARTS HERE</span>
          <h2>
            ${data.draft ? "Your workout is waiting." : "Ready for a little stronger?"}
          </h2>
          <p>
            ${
              data.draft
                ? "Pick up where you left off. Your sets are saved as you go."
                : "A good session starts with showing up. Take the first set from here."
            }
          </p>
          <button class="primary" id="start">
            ${ic("plus", 20)} ${data.draft ? "Continue workout" : "Start a workout"}
          </button>
        </section>
        <div class="statgrid">
          ${[
            ["lift", data.sessions.length, "Workouts logged"],
            ["trophy", r.prs, "Progress wins"],
            [
              "weight",
              data.weights.length ? data.weights.at(-1).value + " " + data.unit : "—",
              "Latest bodyweight",
            ],
          ]
            .map(
              ([i, n, l]) => /* HTML */ `
                <div class="card stat">
                  <div class="iconbox">${ic(i)}</div>
                  <div class="number">${n}</div>
                  <p>${l}</p>
                </div>
              `,
            )
            .join("")}
        </div>
        <section class="card">
          <div class="sectionlabel">
            <h2>Recent activity</h2>
            <button class="textbtn" data-view="history">View all</button>
          </div>
          ${
            data.sessions.length
              ? recent(r, 3)
              : /* HTML */ `
                  <div class="empty">
                    <div class="iconbox">${ic("history")}</div>
                    <strong>A fresh start looks good on you.</strong>
                    Your completed workouts will live here.
                  </div>
                `
          }
        </section>
      </div>
      <aside class="stack aside">
        <section class="card level">
          <div class="eyebrow">YOUR STRENGTH JOURNEY</div>
          <div class="levelbadge">
            <span>${lv.level}</span>
          </div>
          <h3>
            ${["Getting started", "Building momentum", "Finding your rhythm", "Stronger every week"][Math.min(3, Math.floor(r.total / 450))]}
          </h3>
          <p class="muted small">
            Level ${lv.level} · ${r.total} total XP
          </p>
          <div class="progressbar">
            <span style="width: ${(lv.xp / lv.need) * 100}%"></span>
          </div>
          <div class="row small muted">
            <span>${lv.xp} / ${lv.need} XP </span>
            <span>Level ${lv.level + 1}</span>
          </div>
        </section>
        <section class="card">
          <h3>Good effort. Real rewards.</h3>
          <div class="rule">
            ${ic("check")} Show up & finish
            <strong>+25 XP</strong>
          </div>
          <div class="rule">
            ${ic("chart")} More reps, same weight
            <strong>+10 XP</strong>
          </div>
          <div class="rule">
            ${ic("lift")} More weight, same reps
            <strong>+15 XP</strong>
          </div>
          <div class="rule">
            ${ic("plus")} Extra working set
            <strong>+5 XP</strong>
          </div>
          <p class="small muted" style="margin-bottom: 0">
            Consistency counts. Rest days don't take away your XP.
          </p>
        </section>
        <div class="notice tip">
          Your first session sets the baseline. Come back to see exactly how you've
          improved.
        </div>
      </aside>
    </div>
  `;
}
// Show the newest completed workouts; XP comes from the current reward calculation.
function recent(r, limit) {
  return [...sorted()]
    .reverse()
    .slice(0, limit)
    .map(
      (s) => /* HTML */ `
        <div class="historyrow">
          <div>
            <strong>${esc(s.name)}</strong>
            <p class="small muted">
              ${fmt(s.date)} · ${s.exercises.length} exercises ·
              ${s.exercises.reduce((n, e) => n + e.sets.length, 0)}
              sets${Number.isSafeInteger(s.durationSeconds) ? " · " + formatDuration(s.durationSeconds) : ""}
            </p>
          </div>
          <span class="xpchip">+${r.byId[s.id].xp} XP</span>
        </div>
      `,
    )
    .join("");
}
// Preset workout templates and the workout editor.
const routines = {
  Push: ["Bench press", "Incline dumbbell press", "Shoulder press", "Triceps pushdown"],
  Pull: ["Lat pulldown", "Seated cable row", "Dumbbell curl"],
  Legs: ["Squat", "Romanian deadlift", "Leg curl", "Calf raise"],
  "Full body": ["Squat", "Bench press", "Seated cable row"],
};
// Build the routine picker and connect its buttons while the dialog exists.
function startModal() {
  show(/* HTML */ `
    <h2>What's the plan?</h2>
    <p>Choose a starting point. You can add or remove any exercise.</p>
    <div class="choices">
      ${Object.entries(routines)
        .map(
          ([n, ex]) => /* HTML */ `
            <button class="secondary" data-routine="${n}">
              ${n}
              <small>${ex.join(" · ")}</small>
            </button>
          `,
        )
        .join("")}
      <button class="secondary" data-routine="Custom">
        Empty workout
        <small>Build your own session</small>
      </button>
    </div>
  `);
  document
    .querySelectorAll("[data-routine]")
    .forEach((b) => (b.onclick = () => start(b.dataset.routine)));
}
// Create a draft and record its start timestamp once, then open the editor.
function start(name) {
  data.draft = {
    name: name === "Custom" ? "My workout" : name + " day",
    date: today(),
    startedAt: Date.now(),
    exercises: (routines[name] || []).map((n) => newExercise(n)),
  };
  save();
  close();
  go("workout");
}
// Prefill from the previous workout but leave every new set unchecked.
function newExercise(name) {
  const p = previous(name);
  return {
    name,
    sets: (p
      ? p.sets
      : [
          { weight: "", reps: "" },
          { weight: "", reps: "" },
          { weight: "", reps: "" },
        ]
    ).map((s) => ({ weight: s.weight, reps: s.reps, done: false })),
  };
}
// Render the empty state or the current draft. data-* attributes identify set inputs.
function workout() {
  if (!data.draft)
    return /* HTML */ `
      <div class="heading">
        <div>
          <div class="eyebrow">ONE SET AT A TIME</div>
          <h1>Your workout</h1>
          <p class="sub">Your last numbers, right beside your next ones.</p>
        </div>
      </div>
      <section class="card startcard">
        <h2>Let's get to work.</h2>
        <p>Choose a session, log your sets, and build on your last workout.</p>
        <button class="primary" id="start">${ic("plus")} Start a workout</button>
      </section>
    `;
  const d = data.draft;
  return /* HTML */ `
    <div class="heading">
      <div>
        <div class="eyebrow">WORKOUT IN PROGRESS</div>
        <h1>${esc(d.name)}</h1>
        <p class="sub">Check off each working set when you're done.</p>
      </div>
      <input
        class="datecontrol"
        aria-label="Workout date"
        type="date"
        id="sessiondate"
        value="${d.date}"
        max="${today()}"
      />
    </div>
    ${workoutClock(d)}
    <div class="layout">
      <div>
        <div class="field">
          <label for="workname">Workout name</label>
          <input id="workname" maxlength="100" value="${esc(d.name)}" />
        </div>
        ${d.exercises
          .map((e, i) => {
            const p = previous(e.name, d.date);
            return /* HTML */ `
              <section class="card exercise">
                <div class="row exercisehead">
                  <div>
                    <h3>${esc(e.name)}</h3>
                    <div class="previous">
                      ${p ? "Last: " + p.sets.map((s) => `${s.weight} ${data.unit} × ${s.reps}`).join(" · ") : "First session · set your baseline"}
                    </div>
                  </div>
                  <button
                    class="remove"
                    data-remove="${i}"
                    aria-label="Remove ${esc(e.name)}"
                  >
                    ×
                  </button>
                </div>
                <div class="setgrid">
                  <span class="label">SET</span>
                  <span class="label">${data.unit.toUpperCase()}</span>
                  <span class="label">REPS</span>
                  <span class="label">DONE</span>
                </div>
                ${e.sets
                  .map(
                    (s, j) => /* HTML */ `
                      <div class="setgrid">
                        <span class="setnum">${j + 1}</span>
                        <input
                          type="number"
                          inputmode="decimal"
                          min="0"
                          max="2000"
                          step="0.5"
                          placeholder="0"
                          aria-label="${esc(e.name)} set ${j + 1} weight"
                          data-ex="${i}"
                          data-set="${j}"
                          data-field="weight"
                          value="${s.weight}"
                        />
                        <input
                          type="number"
                          inputmode="numeric"
                          min="1"
                          max="500"
                          step="1"
                          placeholder="0"
                          aria-label="${esc(e.name)} set ${j + 1} reps"
                          data-ex="${i}"
                          data-set="${j}"
                          data-field="reps"
                          value="${s.reps}"
                        />
                        <input
                          type="checkbox"
                          aria-label="Complete ${esc(e.name)} set ${j + 1}"
                          data-ex="${i}"
                          data-set="${j}"
                          data-field="done"
                          ${s.done ? "checked" : ""}
                        />
                      </div>
                    `,
                  )
                  .join("")}
                <div class="row">
                  <button class="textbtn" data-addset="${i}">+ Add set</button>
                  ${
                    e.sets.length > 1
                      ? /* HTML */ `
                          <button class="textbtn muted" data-removeset="${i}">
                            Remove last set
                          </button>
                        `
                      : ""
                  }
                </div>
              </section>
            `;
          })
          .join("")}
        <div class="workactions">
          <button class="secondary" id="addexercise">+ Add exercise</button>
          <button class="primary" id="finish">${ic("check")} Finish workout</button>
        </div>
        <button class="textbtn muted" id="discard">Discard workout</button>
      </div>
    </div>
  `;
}
// Progress charts, workout history, and settings screens.
// Scale date/value points into an SVG; fewer than two points show a placeholder.
function chart(points, unit) {
  if (points.length < 2)
    return /* HTML */ `
      <div class="empty">
        ${points.length ? "One point on the board. Log another day to see your trend." : "Your progress chart starts with your first entry."}
      </div>
    `;
  const vals = points.map((x) => x.v),
    min = Math.min(...vals),
    max = Math.max(...vals),
    range = max - min || 1,
    W = 580,
    H = 175;
  const coords = points.map((p, i) => [
    52 + (i / (points.length - 1)) * 510,
    125 - ((p.v - min) / range) * 95,
  ]);
  return /* HTML */ `
    <svg
      class="chart"
      viewBox="0 0 ${W} ${H}"
      role="img"
      aria-label="${esc(unit)} trend from ${vals[0]} to ${vals.at(-1)}"
    >
      <line x1="52" y1="30" x2="562" y2="30" stroke="#e9eee4" stroke-dasharray="4 4" />
      <line x1="52" y1="125" x2="562" y2="125" stroke="#e9eee4" />
      <text x="0" y="35">${max.toFixed(1)}</text>
      <text x="0" y="130">${min.toFixed(1)}</text>
      <polyline
        points="${coords.map((p) => p.join(",")).join(" ")}"
        fill="none"
        stroke="#58bf13"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      ${coords
        .map(
          (p, i) => /* HTML */ `
            <circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#58bf13">
              <title>${points[i].date}: ${points[i].v} ${unit}</title>
            </circle>
          `,
        )
        .join("")}
      <text x="52" y="161">${fmt(points[0].date)}</text>
      <text x="562" y="161" text-anchor="end">${fmt(points.at(-1).date)}</text>
    </svg>
  `;
}
// Build lift and bodyweight charts from saved entries; selected tracks the chosen lift.
function progress() {
  const names = [
    ...new Set(data.sessions.flatMap((s) => s.exercises.map((e) => e.name))),
  ];
  if (!names.includes(selected)) selected = names[0] || "";
  const pts = sorted().flatMap((s) =>
    s.exercises
      .filter((e) => norm(e.name) === norm(selected))
      .map((e) => ({
        date: s.date,
        v: Math.max(...e.sets.map((r) => r.weight)),
      })),
  );
  return /* HTML */ `
    <div class="heading">
      <div>
        <div class="eyebrow">THE BIGGER PICTURE</div>
        <h1>Stronger over time.</h1>
        <p class="sub">Small changes add up. Here's your proof.</p>
      </div>
    </div>
    <div class="stack">
      <section class="card">
        <div class="row">
          <h2>Lift progress</h2>
          ${
            names.length
              ? /* HTML */ `
                  <select id="exercisechart" aria-label="Choose exercise">
                    ${names
                      .map(
                        (n) => /* HTML */ `
                          <option ${selected === n ? "selected" : ""}>${esc(n)}</option>
                        `,
                      )
                      .join("")}
                  </select>
                `
              : ""
          }
        </div>
        <p class="small muted">
          Heaviest working set per session · ${data.unit}. Check your reps in History for
          the full picture.
        </p>
        ${chart(pts, data.unit)}
      </section>
      <section class="card">
        <div class="row">
          <h2>Bodyweight</h2>
          <span class="weightnumber">
            ${data.weights.length ? data.weights.at(-1).value + ' <span class="small muted">' + data.unit + "</span>" : "—"}
          </span>
        </div>
        ${chart(
          data.weights.map((w) => ({ date: w.date, v: w.value })),
          data.unit,
        )}
        <form id="weightform" class="inlineform">
          <div class="field">
            <label for="weightdate">Date</label>
            <input
              type="date"
              id="weightdate"
              max="${today()}"
              value="${today()}"
              required
            />
          </div>
          <div class="field">
            <label for="bodyweight">Weight (${data.unit})</label>
            <input
              type="number"
              inputmode="decimal"
              id="bodyweight"
              min="1"
              max="1500"
              step="0.1"
              placeholder="e.g. ${data.unit === "lb" ? "170" : "77"}"
              required
            />
          </div>
          <button class="primary">Log weight</button>
        </form>
        <p class="small muted">
          One entry per day; logging again updates it. Bodyweight changes don't award XP.
        </p>
        ${
          data.weights.length
            ? /* HTML */ `
                <details>
                  <summary class="small muted">
                    View ${data.weights.length} entries
                  </summary>
                  ${[...data.weights]
                    .reverse()
                    .map(
                      (w) => /* HTML */ `
                        <div class="historyrow">
                          <span>${fmt(w.date)} · ${w.value} ${data.unit}</span>
                          <button class="textbtn" data-delweight="${w.date}">
                            Delete
                          </button>
                        </div>
                      `,
                    )
                    .join("")}
                </details>
              `
            : ""
        }
      </section>
    </div>
  `;
}
// Build expandable session details with XP reasons and a delete action.
function history(r) {
  return /* HTML */ `
    <div class="heading">
      <div>
        <div class="eyebrow">THE WORK YOU PUT IN</div>
        <h1>Workout history</h1>
        <p class="sub">${data.sessions.length} sessions. Every one a step forward.</p>
      </div>
      <button class="secondary" id="start">+ Workout</button>
    </div>
    <section class="card">
      ${
        data.sessions.length
          ? [...sorted()]
              .reverse()
              .map(
                (s) => /* HTML */ `
                  <details class="historydetail">
                    <summary>
                      <strong>${esc(s.name)}</strong>
                      <span class="small muted">· ${fmt(s.date)}</span>
                      ${durationLabel(s)}
                      <span class="xpchip">+${r.byId[s.id].xp} XP</span>
                    </summary>
                    <ul>
                      ${s.exercises
                        .map(
                          (e) => /* HTML */ `
                            <li>
                              <strong>${esc(e.name)}</strong>
                              <br />
                              ${e.sets.map((x) => `${x.weight} ${data.unit} × ${x.reps}`).join(" · ")}
                            </li>
                          `,
                        )
                        .join("")}
                    </ul>
                    <div class="notice">
                      ${r.byId[s.id].reasons.map(esc).join("<br>") || "Already earned today’s completion XP. Your work is still logged."}
                    </div>
                    <button class="textbtn error" data-delete="${s.id}">
                      Delete workout
                    </button>
                  </details>
                `,
              )
              .join("")
          : '<div class="empty"><div class="iconbox">' +
            ic("lift") +
            "</div><strong>Your story starts with one session.</strong>Finish a workout to save your first entry.</div>"
      }
    </section>
  `;
}

// Render preferences and backup controls; their event handlers live in bind().
function settings() {
  return /* HTML */ `
    <div class="heading">
      <div>
        <div class="eyebrow">MAKE IT YOURS</div>
        <h1>Your training space</h1>
        <p class="sub">A little setup for the way you train. · v1.01</p>
      </div>
    </div>

    <div class="layout">
      <div class="stack">
        <section class="card">
          <h2>Training preferences</h2>

          <div class="field">
            <label for="goal">Weekly workout goal</label>
            <select id="goal">
              ${[1, 2, 3, 4, 5, 6, 7]
                .map(
                  (n) => /* HTML */ `
                    <option value="${n}" ${data.goal === n ? "selected" : ""}>
                      ${n} days a week
                    </option>
                  `,
                )
                .join("")}
            </select>
          </div>

          <div class="field">
            <label for="units">Weight unit</label>
            <select id="units">
              <option value="lb" ${data.unit === "lb" ? "selected" : ""}>
                Pounds (lb)
              </option>
              <option value="kg" ${data.unit === "kg" ? "selected" : ""}>
                Kilograms (kg)
              </option>
            </select>
          </div>

          <div class="field">
            <label for="theme">Appearance</label>
            <select id="theme">
              <option value="light" ${theme === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${theme === "dark" ? "selected" : ""}>Dark</option>
            </select>
          </div>

          <p class="small muted">
            Switching units converts all saved weights and your current draft.
          </p>
        </section>

        <section class="card">
          <h2>Your data, backed up</h2>
          <p class="muted">
            Workouts and bodyweight are saved on this device. Export a backup before
            changing phones or clearing browser data.
          </p>
          <div class="backup">
            <button id="export" class="secondary">Export backup</button>
            <button id="import" class="secondary">Restore backup</button>
            <input id="importfile" type="file" accept="application/json,.json" hidden />
          </div>
          <p class="small muted">
            Backups include your history, settings, and current workout. There is no
            cross-device sync.
          </p>
        </section>

        <section class="card">
          <h2>Add to your iPhone</h2>
          <p class="muted">
            Open this app in Safari, tap Share, then Add to Home Screen. Open it from the
            new icon and start logging there.
          </p>
          <div class="notice">
            Keep a backup handy: Safari and your Home Screen app may have separate
            storage. You can restore your export in either one.
          </div>
        </section>
      </div>

      <aside class="card" style="align-self: start">
        <h3>How XP works</h3>
        <p class="small muted">
          25 XP for your first completed workout each day. Each exercise can earn one
          progress bonus per day: 15 for a heavier top set with at least the same reps, 10
          for a rep best at the same weight, or 5 for another working set while
          maintaining earlier sets.
        </p>
        <p class="small muted">
          Bonuses compare with the previous logged session, prioritize weight over reps
          over sets. Your first session establishes a baseline.
          Level 1 takes 150 XP, and each level needs 25% more than the one before until level 25.
          After that, every level costs the same.
        </p>
        <p class="small muted">
          Deleting a workout recalculates XP and comparisons. Rest days never subtract XP.
        </p>
      </aside>
    </div>
  `;
}
// Reuse the native dialog for routine selection, confirmations, and completion.
function show(html) {
  $("#modal").innerHTML =
    '<button class="close" aria-label="Close dialog">×</button>' + html;
  $("#modal .close").onclick = close;
  $("#modal").showModal();
}
// Close the shared dialog without changing workout state.
function close() {
  $("#modal").close();
}
// Run the supplied callback only after the user confirms the dialog.
function confirmAction(title, description, fn) {
  show(/* HTML */ `
    <h2>${title}</h2>
    <p>${description}</p>
    <div class="workactions">
      <button class="secondary" id="cancel">Cancel</button>
      <button class="primary" id="confirm">Confirm</button>
    </div>
  `);
  $("#cancel").onclick = close;
  $("#confirm").onclick = () => {
    fn();
    close();
  };
}
// Complete a draft workout, calculate its result, and save it to history.
function finish() {
  const d = data.draft;
  if (!validDate(d.date) || !d.name.trim())
    return toast("Add a workout name and a valid date.");
  const exercises = d.exercises
    .map((e) => ({
      name: e.name,
      sets: e.sets
        .filter((s) => s.done)
        .map((s) => ({
          weight: s.weight === "" ? NaN : Number(s.weight),
          reps: Number(s.reps),
        })),
    }))
    .filter((e) => e.sets.length);
  if (!exercises.length) return toast("Check off at least one completed set first.");
  if (
    exercises.some((e) =>
      e.sets.some(
        (s) =>
          !Number.isFinite(s.weight) ||
          s.weight < 0 ||
          s.weight > 2000 ||
          !Number.isInteger(s.reps) ||
          s.reps < 1 ||
          s.reps > 500,
      ),
    )
  )
    return toast("Completed sets need a weight of 0–2000 and 1–500 whole reps.");
  const s = {
    id: Date.now() + "-" + crypto.randomUUID(),
    date: d.date,
    name: d.name.trim(),
    exercises,
    ...(hasStartTime(d) ? { durationSeconds: getElapsedSeconds(d.startedAt) } : {}),
  };
  // Keep the draft available if storage fails while completing the workout.
  const prior = data.draft;
  data.sessions.push(s);
  data.draft = null;
  if (!save()) {
    data.sessions.pop();
    data.draft = prior;
    return;
  }
  navigator.storage?.persist?.().catch(() => {});
  const r = rewards().byId[s.id];
  go("home");
  show(/* HTML */ `
    <div class="iconbox" style="margin-bottom: 20px">${ic("trophy")}</div>
    <h2>That's another win.</h2>
    <p>You showed up and put in the work.</p>
    ${durationLabel(s)}
    <div class="levelbadge" style="font-size: 1.7rem">+${r.xp}</div>
    <p style="text-align: center">XP earned</p>
    <div class="notice">
      ${r.reasons.map(esc).join("<br>") || "Another session logged. Today’s completion XP was already earned."}
    </div>
    <button class="primary full" style="margin-top: 20px" id="celebrate">
      Keep the momentum
    </button>
  `);
  $("#celebrate").onclick = close;
}
// Wire up buttons and inputs for the currently rendered screen.
function bind() {
  // WORKOUT: start/resume, exercise selection, draft fields, and set controls.
  if ($("#start"))
    $("#start").onclick = () => (data.draft ? go("workout") : startModal());
  if ($("#addexercise"))
    $("#addexercise").onclick = () => {
      const names = [
        ...new Set([
          ...Object.values(routines).flat(),
          ...data.sessions.flatMap((s) => s.exercises.map((e) => e.name)),
        ]),
      ];
      show(/* HTML */ `
        <h2>Add an exercise</h2>
        <form id="exerciseform">
          <div class="field">
            <label for="exname">Exercise name</label>
            <input
              id="exname"
              list="exnames"
              maxlength="80"
              placeholder="e.g. Bench press"
              required
              autocomplete="off"
            />
            <datalist id="exnames">
              ${names
                .map(
                  (n) => /* HTML */ `
                    <option value="${esc(n)}"></option>
                  `,
                )
                .join("")}
            </datalist>
          </div>
          <button class="primary full">Add exercise</button>
        </form>
      `);
      $("#exerciseform").onsubmit = (e) => {
        e.preventDefault();
        let n = $("#exname").value.trim();
        if (!n) return;
        if (data.draft.exercises.some((x) => norm(x.name) === norm(n)))
          return toast("That exercise is already in your workout.");
        n = names.find((x) => norm(x) === norm(n)) || n;
        data.draft.exercises.push(newExercise(n));
        save();
        close();
        render();
      };
    };
  if ($("#workname"))
    $("#workname").onchange = (e) => {
      data.draft.name = e.target.value;
      save();
    };
  if ($("#sessiondate"))
    $("#sessiondate").onchange = (e) => {
      if (validDate(e.target.value)) {
        data.draft.date = e.target.value;
        save();
        render();
      } else toast("Choose today or an earlier date.");
    };
  // data-ex / data-set locate the draft set; data-field selects weight, reps, or done.
  document.querySelectorAll("[data-field]").forEach(
    (el) =>
      (el.onchange = () => {
        data.draft.exercises[el.dataset.ex].sets[el.dataset.set][el.dataset.field] =
          el.dataset.field === "done" ? el.checked : el.value;
        save();
      }),
  );
  document.querySelectorAll("[data-addset]").forEach(
    (el) =>
      (el.onclick = () => {
        const sets = data.draft.exercises[el.dataset.addset].sets;
        sets.push({
          weight: sets.at(-1)?.weight ?? "",
          reps: sets.at(-1)?.reps ?? "",
          done: false,
        });
        save();
        render();
      }),
  );
  document.querySelectorAll("[data-removeset]").forEach(
    (el) =>
      (el.onclick = () => {
        data.draft.exercises[el.dataset.removeset].sets.pop();
        save();
        render();
      }),
  );
  document.querySelectorAll("[data-remove]").forEach(
    (el) =>
      (el.onclick = () =>
        confirmAction(
          "Remove exercise?",
          "This removes its sets from your current workout.",
          () => {
            data.draft.exercises.splice(el.dataset.remove, 1);
            save();
            render();
          },
        )),
  );
  if ($("#finish")) $("#finish").onclick = finish;
  if ($("#discard"))
    $("#discard").onclick = () =>
      confirmAction(
        "Discard this workout?",
        "Your current draft will be removed. Completed workouts stay saved.",
        () => {
          data.draft = null;
          save();
          render();
        },
      );
  // PROGRESS: selected lift and dated bodyweight entries.
  if ($("#exercisechart"))
    $("#exercisechart").onchange = (e) => {
      selected = e.target.value;
      render();
    };
  if ($("#weightform"))
    $("#weightform").onsubmit = (e) => {
      e.preventDefault();
      const date = $("#weightdate").value,
        value = Number($("#bodyweight").value);
      if (!validDate(date) || !Number.isFinite(value) || value <= 0 || value > 1500)
        return toast("Enter a valid weight and date.");
      const before = [...data.weights];
      data.weights = data.weights.filter((w) => w.date !== date);
      data.weights.push({ date, value });
      data.weights.sort((a, b) => a.date.localeCompare(b.date));
      if (!save()) {
        data.weights = before;
        return;
      }
      render();
      toast("Bodyweight saved. Another data point on your journey.");
    };
  document.querySelectorAll("[data-delweight]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Delete weight entry?",
          "This removes the entry from your chart.",
          () => {
            data.weights = data.weights.filter((w) => w.date !== b.dataset.delweight);
            save();
            render();
          },
        )),
  );
  // HISTORY: deleting a session also changes future XP comparisons on render.
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Delete this workout?",
          "Its sets will be removed and your XP will be recalculated.",
          () => {
            data.sessions = data.sessions.filter((s) => s.id !== b.dataset.delete);
            save();
            render();
          },
        )),
  );
  // SETTINGS: apply theme immediately and store the preference for the next visit.
  if ($("#theme"))
    $("#theme").onchange = (e) => {
      theme = e.target.value;
      document.documentElement.dataset.theme = theme;
      localStorage.setItem(THEME_KEY, theme);
    };
  if ($("#goal"))
    $("#goal").onchange = (e) => {
      data.goal = Number(e.target.value);
      save();
      toast("Weekly goal updated.");
    };
  // Convert actual stored values, including the active draft, when units change.
  if ($("#units"))
    $("#units").onchange = (e) => {
      const next = e.target.value;
      if (next === data.unit) return;
      const factor = next === "kg" ? 1 / 2.2046226218 : 2.2046226218,
        convert = (n) => Math.round(Number(n) * factor * 100) / 100;
      for (const s of data.sessions)
        for (const ex of s.exercises)
          for (const set of ex.sets) set.weight = convert(set.weight);
      for (const w of data.weights) w.value = convert(w.value);
      if (data.draft)
        for (const ex of data.draft.exercises)
          for (const set of ex.sets)
            if (set.weight !== "") set.weight = convert(set.weight);
      data.unit = next;
      save();
      render();
      toast("All weights converted to " + next + ".");
    };
  // BACKUPS: export workout state. Theme uses a separate key and is not included.
  if ($("#export"))
    $("#export").onclick = () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "repquest-backup-" + today() + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
  if ($("#import")) $("#import").onclick = () => $("#importfile").click();
  // Validate imported JSON before confirmation; restore the old state if saving fails.
  if ($("#importfile"))
    $("#importfile").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        if (f.size > 5000000) throw Error();
        const parsed = JSON.parse(await f.text());
        validate(parsed);
        confirmAction(
          "Restore this backup?",
          `Replace current data with ${parsed.sessions.length} workouts and ${parsed.weights.length} weight entries? Export your current data first if you want to keep it.`,
          () => {
            const old = data,
              oldError = loadError;
            data = parsed;
            loadError = "";
            if (!save()) {
              data = old;
              loadError = oldError;
              return;
            }
            render();
            toast("Backup restored.");
          },
        );
      } catch {
        toast("That file is not a valid Repquest backup.");
      }
    };
}
// Start the UI and register the offline app shell.
render();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
if (document.modelContext?.registerTool) {
  try {
    document.modelContext.registerTool({
      name: "read_training_progress",
      description:
        "Read completed workouts, bodyweight entries, and earned XP from this device. Does not change data.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        if (!input || typeof input !== "object" || Object.keys(input).length)
          throw Error("Expected an empty object");
        return {
          sessions: data.sessions,
          weights: data.weights,
          unit: data.unit,
          xp: rewards().total,
        };
      },
    });
  } catch {}
}
