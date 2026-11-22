// Run tracking for the AI playtester: one folder per run, one status file the
// dashboard polls, one findings file a report is written from.
//
//   runs/<run-id>/status.json     who, since when, doing what, how far
//   runs/<run-id>/findings.jsonl  bugs, confusing moments, AI-feel lines
//   runs/<run-id>/actions.jsonl   every action and what it changed
//   runs/<run-id>/session.json    the browser tab and server the run plays on
//   runs/<run-id>/shots/          screenshots the findings point at
//
// Pure apart from the file reads and writes, so the stuck rule and the status
// it writes are tested without a browser (`runs.test.mjs`).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PERSONAS = {
  veteran: 'Veteran: knows Pokemon inside out and plays to win',
  newcomer: 'Newcomer: has never played a Pokemon game and knows nothing',
};

export const FINDING_KINDS = ['bug', 'confusing', 'ai-feel'];

/**
 * Where the game may be reloaded from its save to free memory (`act.mjs`):
 * where a reload loses nothing. Not the raid's result screen - what it says is
 * on no other screen, and the overnight playtest of 20 Nov 2026 was reloaded
 * off its first extraction's result before it had read it. The harbour behind
 * it is one CONTINUE away and reloads as well as anywhere.
 */
export const RELOAD_SAFE_SCENES = new Set(['base', 'title', 'hub']);

/** Actions in a row with nothing changing before a run is told it is stuck. */
export const STUCK_AFTER = 8;
/** And after this many more, it is told to give the goal up: STUCK is logged for it. */
export const GIVE_UP_AFTER = 8;

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RUNS_DIR = join(here, 'runs');

export const runsDir = () => resolve(process.env.EPTW_AI_RUNS ?? DEFAULT_RUNS_DIR);
export const runDir = (runId, root = runsDir()) => join(root, runId);

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

/** Written whole and renamed into place, so the dashboard never reads half a file. */
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

export const readLines = (path) => {
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
};

const appendLine = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(value)}\n`);
};

/** A run id that sorts by when it started: `20261120-0130-veteran`. */
export function newRunId(persona, now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${persona}`;
}

export function createRun({ persona, runId = newRunId(persona), root = runsDir(), now = Date.now() }) {
  if (!(persona in PERSONAS)) {
    throw new Error(`persona is one of ${Object.keys(PERSONAS).join(', ')}`);
  }
  const status = {
    runId,
    persona,
    personaLabel: PERSONAS[persona],
    state: 'playing',
    startedAt: now,
    lastActionAt: now,
    lastAction: 'start',
    actions: 0,
    goal: null,
    doing: 'starting the game',
    milestones: [],
    milestonesDone: 0,
    milestonesTotal: 0,
    finished: false,
    raids: 0,
    wipes: 0,
    extractions: 0,
    gameTimeMs: 0,
    stuck: false,
    stuckCount: 0,
    sameFor: 0,
    findings: { bug: 0, confusing: 0, 'ai-feel': 0 },
    lastEvent: 0,
  };
  writeJson(join(runDir(runId, root), 'status.json'), status);
  return status;
}

export const readStatus = (runId, root = runsDir()) => readJson(join(runDir(runId, root), 'status.json'), null);
export const writeStatus = (status, root = runsDir()) => writeJson(join(runDir(status.runId, root), 'status.json'), status);
export const readSession = (runId, root = runsDir()) => readJson(join(runDir(runId, root), 'session.json'), null);
export const writeSession = (runId, session, root = runsDir()) => writeJson(join(runDir(runId, root), 'session.json'), session);

/** The run the last `start` made, so a command need not name it. */
export const currentRunFile = (root = runsDir()) => join(root, 'current');
export function currentRunId(root = runsDir()) {
  try {
    return readFileSync(currentRunFile(root), 'utf8').trim() || null;
  } catch {
    return null;
  }
}
export function setCurrentRun(runId, root = runsDir()) {
  mkdirSync(root, { recursive: true });
  writeFileSync(currentRunFile(root), `${runId}\n`);
}

/** Every run, newest first. */
export function listRuns(root = runsDir()) {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readStatus(entry.name, root))
    .filter(Boolean)
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * What counts as the game having moved, for the stuck rule: where the player
 * is, what the screen says, what is on the menu, how far the save has got. A
 * clock ticking is not progress, and nor is a cursor moving.
 */
export function progressSignature(screen) {
  if (!screen) {
    return 'no screen';
  }
  const world = screen.scene?.world;
  const base = screen.scene?.base;
  const battle = screen.scene?.battle;
  const top = screen.scenes?.[screen.scenes.length - 1] ?? '';
  return JSON.stringify([
    top,
    world?.map ?? null,
    world?.tile ?? null,
    world?.dialogue?.text ?? null,
    base?.room ?? null,
    base?.tile ?? null,
    base?.dialogue?.text ?? null,
    battle ? [battle.mode, battle.message?.text ?? null, battle.foe?.hp ?? null, battle.yours?.hp ?? null] : null,
    screen.menu ? [screen.menu.heading, screen.menu.text.slice(0, 200)] : null,
    screen.progress?.done ?? 0,
  ]);
}

/**
 * Folds one action into the status: the counters the event log moved, the
 * finish line from the save, and the stuck rule. Returns the new status and
 * the advice to hand the player with the action's result.
 */
export function foldAction(status, { action, screen, events = [], signature, now = Date.now() }) {
  const next = { ...status, actions: status.actions + 1, lastAction: action, lastActionAt: now };
  for (const event of events) {
    if (event.kind === 'extracted') {
      next.extractions += 1;
      next.raids += 1;
    }
    if (event.kind === 'wiped') {
      next.wipes += 1;
      next.raids += 1;
    }
  }
  if (events.length > 0) {
    next.lastEvent = events[events.length - 1].n;
  }
  const progress = screen?.progress;
  if (progress) {
    next.milestones = progress.milestones.map(({ id, label, done, finish, count }) => ({ id, label, done, finish, ...(count ? { count } : {}) }));
    next.milestonesDone = progress.done;
    next.milestonesTotal = progress.total;
    next.finished = progress.finished;
  }
  const raidClock = screen?.scene?.world?.raid?.elapsedMs;
  if (typeof raidClock === 'number') {
    next.raidClockMs = raidClock;
  }
  let advice = null;
  if (signature !== undefined && signature === status.signature) {
    next.sameFor = status.sameFor + 1;
  } else {
    next.sameFor = 0;
    next.stuck = false;
  }
  next.signature = signature;
  if (next.sameFor === STUCK_AFTER) {
    next.stuck = true;
    next.stuckCount = status.stuckCount + 1;
    advice = `STUCK: nothing has changed for ${STUCK_AFTER} actions. Try a different goal or a different way.`;
  } else if (next.sameFor === STUCK_AFTER + GIVE_UP_AFTER) {
    advice = `STUCK for ${STUCK_AFTER + GIVE_UP_AFTER} actions: give this goal up (act.mjs giveup) and pick another.`;
  } else if (next.stuck) {
    advice = `still stuck (${next.sameFor} actions with nothing changing)`;
  }
  if (next.finished && status.state === 'playing') {
    next.state = 'finished';
    advice = 'FINISHED: every finish-line milestone is done. Write your report and stop the run.';
  }
  return { status: next, advice };
}

export function recordAction(runId, entry, root = runsDir()) {
  appendLine(join(runDir(runId, root), 'actions.jsonl'), entry);
}

/** A finding, with the screenshot it points at. */
export function recordFinding(status, { kind, text, shot = null, where = null, now = Date.now() }, root = runsDir()) {
  if (!FINDING_KINDS.includes(kind)) {
    throw new Error(`a finding is one of ${FINDING_KINDS.join(', ')}`);
  }
  const finding = { at: now, runId: status.runId, persona: status.persona, kind, text, shot, where, goal: status.goal };
  appendLine(join(runDir(status.runId, root), 'findings.jsonl'), finding);
  return {
    finding,
    status: { ...status, findings: { ...status.findings, [kind]: (status.findings[kind] ?? 0) + 1 } },
  };
}

export const readFindings = (runId, root = runsDir()) => readLines(join(runDir(runId, root), 'findings.jsonl'));
