#!/usr/bin/env node
// AI playtesters, one after another, until a deadline: each session is a
// headless Claude Code session that plays one persona's run through
// `act.mjs` for up to `--session-minutes`, then hands over to the other
// persona. A run is carried on across sessions (its save and its memory.md
// stay in its folder) until it is finished, then a fresh one starts.
//
//   node tools/playtest/ai-player/overnight.mjs [--until=10:00] [--session-minutes=60]
//        [--persona=both|veteran|newcomer] [--model=<id>] [--dry]
//
// One browser at a time, always: sessions never overlap. Before each session
// it waits while the machine is short of memory or busy (`machineReady`), and
// it writes what it is doing to runs/overnight.json for the dashboard. Stop it
// with Ctrl-C or `kill <pid>` (its pid is in runs/overnight.json): the current
// session is stopped and its browser closed.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentRunId, readStatus, runDir, runsDir, writeJson } from './runs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const act = join(here, 'act.mjs');
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));

/** Least memory free, in MB, before a session may start; a browser here takes about 700MB. */
export const MIN_FREE_MB = Number(process.env.EPTW_AI_MIN_FREE_MB ?? 3000);
/** Highest one-minute load per core before a session may start. */
export const MAX_LOAD_PER_CORE = Number(process.env.EPTW_AI_MAX_LOAD ?? 0.75);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function deadlineFrom(until, now = new Date()) {
  const [hours, minutes] = String(until).split(':').map(Number);
  const deadline = new Date(now);
  deadline.setHours(hours, minutes || 0, 0, 0);
  if (deadline <= now) deadline.setDate(deadline.getDate() + 1);
  return deadline;
}

export function memoryFreeMb(meminfo = readFileSync('/proc/meminfo', 'utf8')) {
  const kb = Number(/MemAvailable:\s+(\d+)/.exec(meminfo)?.[1] ?? 0);
  return Math.round(kb / 1024);
}

export function machineReady({ freeMb = memoryFreeMb(), load = loadavg()[0], cores = cpus().length } = {}) {
  if (freeMb < MIN_FREE_MB) return { ready: false, why: `only ${freeMb}MB of memory free (needs ${MIN_FREE_MB})` };
  if (load / cores > MAX_LOAD_PER_CORE) return { ready: false, why: `the machine is busy (load ${load.toFixed(1)} on ${cores} cores)` };
  return { ready: true, why: null };
}

const overnightFile = () => join(runsDir(), 'overnight.json');
const readOvernight = () => {
  try {
    return JSON.parse(readFileSync(overnightFile(), 'utf8'));
  } catch {
    return {};
  }
};
const writeOvernight = (patch) => writeJson(overnightFile(), { ...readOvernight(), ...patch, pid: process.pid, updatedAt: Date.now() });

const runAct = (...args) => spawnSync('node', [act, ...args], { cwd: repo, encoding: 'utf8' });

const prompt = (runId) => `${readFileSync(join(here, 'PLAYTEST.md'), 'utf8')}

---

Your run is ${runId}. It is already started and the game is on screen. Its folder is ${runDir(runId)}.
Read ${join(runDir(runId), 'memory.md')} first if it exists. Then play. You have about ${flags['session-minutes'] ?? 60} minutes in this session; before it runs out, update memory.md.`;

let child = null;
let stopping = false;
const stopEverything = (signal) => {
  stopping = true;
  if (child) child.kill('SIGTERM');
  runAct('stop', 'the overnight runner was stopped');
  writeOvernight({ state: 'stopped', doing: `stopped (${signal})`, sessionRun: null });
  process.exit(0);
};

async function main() {
  const deadline = deadlineFrom(flags.until ?? '10:00');
  const sessionMs = Number(flags['session-minutes'] ?? 60) * 60_000;
  const personas = flags.persona && flags.persona !== 'both' ? [flags.persona] : ['veteran', 'newcomer'];
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => stopEverything(signal));
  writeOvernight({ state: 'running', startedAt: Date.now(), deadline: deadline.getTime(), personas });
  let turn = 0;
  while (!stopping && Date.now() < deadline.getTime()) {
    const machine = machineReady();
    if (!machine.ready) {
      writeOvernight({ state: 'waiting', doing: `waiting: ${machine.why}` });
      await sleep(120_000);
      continue;
    }
    const persona = personas[turn % personas.length];
    turn += 1;
    const runs = readOvernight().runs ?? {};
    const previous = runs[persona] ? readStatus(runs[persona]) : null;
    const resume = previous && !previous.finished ? previous.runId : null;
    const started = runAct('start', ...(resume ? [`--resume=${resume}`] : [`--persona=${persona}`]));
    const runId = currentRunId();
    if (started.status !== 0 || !runId) {
      writeOvernight({ state: 'waiting', doing: `could not start a run: ${(started.stdout + started.stderr).slice(-300)}` });
      await sleep(120_000);
      continue;
    }
    writeOvernight({ state: 'running', doing: `${persona} playing ${runId}`, sessionRun: runId, runs: { ...runs, [persona]: runId } });
    const left = Math.min(sessionMs, deadline.getTime() - Date.now());
    if (flags.dry) {
      console.log(`would play ${runId} for ${Math.round(left / 60000)} minutes`);
      runAct('stop', 'dry run');
      break;
    }
    // The player gets its hands and its notes, and nothing else: no other
    // command, no browser of its own, nothing outside the run's folder to write.
    const args = [
      '-p', prompt(runId),
      '--permission-mode', 'dontAsk',
      '--allowedTools', 'Bash(tools/playtest/ai-player/act:*)', 'Read', `Write(/${runDir(runId)}/**)`, `Edit(/${runDir(runId)}/**)`,
      '--no-session-persistence', '--output-format', 'text',
    ];
    if (flags.model) args.push('--model', flags.model);
    await new Promise((done) => {
      child = spawn('claude', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
      const log = [];
      child.stdout.on('data', (chunk) => log.push(chunk));
      child.stderr.on('data', (chunk) => log.push(chunk));
      const timer = setTimeout(() => child.kill('SIGTERM'), left);
      child.once('exit', () => {
        clearTimeout(timer);
        writeJson(join(runDir(runId), `session-${Date.now()}.json`), { endedAt: Date.now(), output: Buffer.concat(log).toString('utf8').slice(-20_000) });
        child = null;
        done();
      });
    });
    runAct('stop', 'session over');
  }
  writeOvernight({ state: 'done', doing: 'finished for the night', sessionRun: null });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
