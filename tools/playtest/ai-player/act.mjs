#!/usr/bin/env node
// The AI playtester's one command: a short action on the game, and what the
// screen looks like after it. See PLAYTEST.md beside this for how an AI plays
// with it, and README.md for how a person starts and watches a run.
//
//   node tools/playtest/ai-player/act.mjs start --persona=veteran|newcomer [--resume=<run-id>] [--port=CDP]
//   node tools/playtest/ai-player/act.mjs look [--json]
//   node tools/playtest/ai-player/act.mjs walk <x> <y> | walk <name on screen> | walk way | walk left [tiles]
//   node tools/playtest/ai-player/act.mjs talk [up|down|left|right]
//   node tools/playtest/ai-player/act.mjs next                  read on through what is being said
//   node tools/playtest/ai-player/act.mjs choose <label>         a question's answer, a battle command, a menu button
//   node tools/playtest/ai-player/act.mjs fight [strongest|first|run]
//   node tools/playtest/ai-player/act.mjs press <key> [times]    ArrowUp, Space, Escape, KeyB, Enter...
//   node tools/playtest/ai-player/act.mjs wait [seconds]         game seconds, default 2
//   node tools/playtest/ai-player/act.mjs goal <what you are trying to do>
//   node tools/playtest/ai-player/act.mjs giveup [why]          log STUCK for the goal and drop it
//   node tools/playtest/ai-player/act.mjs note bug|confusing|ai-feel <what> [--no-shot]
//   node tools/playtest/ai-player/act.mjs shot [name]
//   node tools/playtest/ai-player/act.mjs stop [why]
//
// Every command but `start` acts on the current run (`runs/current`), or on
// `--run=<id>`. The game sits paused between commands, so a run costs the
// machine nothing while the AI is thinking.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGIC_WINDOW, reattachPage, sleep, writeScreenshot } from '../browser.mjs';
import { GAME, createHands } from './game.mjs';
import { renderScreen } from './render.mjs';
import {
  createRun,
  currentRunId,
  foldAction,
  progressSignature,
  readSession,
  readStatus,
  recordAction,
  recordFinding,
  runDir,
  runsDir,
  setCurrentRun,
  writeSession,
  writeStatus,
} from './runs.mjs';
import { SAVE_KEY } from '../deploy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const BUILD_ROOT = resolve(process.env.EPTW_AI_BUILD ?? join(here, '.build'));
const BUILD_DIR = join(BUILD_ROOT, 'escape-from-pallet-town-web');
const FM_BROWSER = process.env.EPTW_AI_FM_BROWSER ?? '/home/ollys/firstmate/data/tools/fm-browser.sh';
const BROWSER_NAME = process.env.EPTW_AI_BROWSER_NAME ?? 'eptw-ai-player';
/** The browser helper stops a browser nobody has asked for in 30 minutes; ask well inside that. */
const TOUCH_BROWSER_EVERY_MS = 10 * 60_000;
/**
 * The machine's watchdog stops a browser past about 1.5GB. A fresh tab in a
 * raid on Greystone Vale is about 1.27GB and a long session grows past 1.6GB,
 * so over this the tab is reloaded from its save - only where nothing is lost
 * by it: the harbour, the title, a result screen.
 */
const RELOAD_OVER_MB = Number(process.env.EPTW_AI_RELOAD_MB ?? 1300);
/** Actions between two reloads at least, so a game that is simply that big is not reloaded on every one. */
const RELOAD_EVERY_ACTIONS = 25;
const RELOAD_SAFE_SCENES = new Set(['base', 'title', 'hub', 'extraction']);

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
const words = argv.filter((a) => !a.startsWith('--'));
const command = words.shift();

const fail = (message) => {
  console.log(`ERROR: ${message}`);
  process.exit(1);
};

const browserEnv = () => {
  // The helper puts its records under XDG_RUNTIME_DIR, which is missing on this WSL box.
  const env = { ...process.env };
  delete env.XDG_RUNTIME_DIR;
  return env;
};

/** Starts (or reattaches to) the machine's watched headless browser, and gives its CDP port. */
function startBrowser() {
  if (!existsSync(FM_BROWSER)) {
    fail(`no browser helper at ${FM_BROWSER}: start a headless Chromium yourself and pass --port=<its CDP port>`);
  }
  const out = spawnSync('bash', [FM_BROWSER, 'start', BROWSER_NAME], { encoding: 'utf8', env: browserEnv() });
  const port = /BROWSER_URL=http:\/\/127\.0\.0\.1:(\d+)/.exec(out.stdout ?? '')?.[1];
  if (!port) fail(`the browser helper did not start a browser: ${out.stderr || out.stdout}`);
  return Number(port);
}

const freePort = () =>
  new Promise((done, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });

const portAnswers = async (port) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/escape-from-pallet-town-web/`);
    return response.ok;
  } catch {
    return false;
  }
};

/** The test-mode build, made once and reused: a dev server page passes 1GB, a build sits near 600MB. */
function ensureBuild() {
  if (existsSync(join(BUILD_DIR, 'index.html')) && !flags.rebuild) return;
  console.log('building the game in test mode (once)...');
  const built = spawnSync('npx', ['vite', 'build', '--outDir', BUILD_DIR, '--emptyOutDir'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, VITE_EPTW_TEST_MODE: '1' },
  });
  if (built.status !== 0) fail(`the build failed:\n${built.stdout}\n${built.stderr}`);
}

/** A static server for the build, under the subpath it is built for, detached so it outlives this command. */
async function startServer(port) {
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', BUILD_ROOT], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 50 && !(await portAnswers(port)); i += 1) await sleep(100);
  if (!(await portAnswers(port))) fail('the game server did not start');
  return child.pid;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Opens the game in a new tab of the browser on `cdpPort`, with a save seeded if given, and pauses it. */
async function openGame(cdpPort, url, save) {
  const target = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' })).json();
  const page = await reattachPage(cdpPort, target.id, { window: LOGIC_WINDOW });
  await page.send('Emulation.setDeviceMetricsOverride', { ...LOGIC_WINDOW, deviceScaleFactor: 1, mobile: false });
  await page.send('Network.enable');
  await page.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  if (save) {
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `if (!localStorage.getItem(${JSON.stringify(SAVE_KEY)})) localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(save)});`,
    });
  }
  await page.send('Page.navigate', { url });
  for (let i = 0; i < 200; i += 1) {
    if (await page.evaluate(`typeof ${GAME}?.describe === 'function' && typeof ${GAME}?.stepFrames === 'function'`).catch(() => false)) break;
    await sleep(100);
  }
  await page.evaluate(`${GAME}.pauseLoop()`);
  return { page, targetId: target.id };
}

async function start() {
  const persona = flags.persona;
  const resume = flags.resume;
  const previous = resume ? readStatus(resume) : null;
  if (resume && !previous) fail(`no run ${resume}`);
  ensureBuild();
  // A new tab's event log starts again at 1.
  const status = previous ? { ...previous, state: 'playing', lastEvent: 0, sameFor: 0, stuck: false } : createRun({ persona: persona ?? fail('--persona=veteran or --persona=newcomer') });
  const runId = status.runId;
  const old = readSession(runId);
  const cdpPort = flags.port ? Number(flags.port) : startBrowser();
  // The same server port as before keeps the page's origin, and so its storage.
  const serverPort = old?.serverPort && !(await portAnswers(old.serverPort)) ? old.serverPort : await freePort();
  const serverPid = (await portAnswers(serverPort)) ? old?.serverPid : await startServer(serverPort);
  const url = `http://127.0.0.1:${serverPort}/escape-from-pallet-town-web/?testmode=1`;
  const savePath = join(runDir(runId), 'save.json');
  const save = existsSync(savePath) ? readFileSync(savePath, 'utf8') : null;
  const { page, targetId } = await openGame(cdpPort, url, save);
  writeSession(runId, { cdpPort, targetId, serverPort, serverPid, url, browserName: flags.port ? null : BROWSER_NAME, touchedAt: Date.now() });
  setCurrentRun(runId);
  writeStatus({ ...status, doing: 'at the title screen', lastActionAt: Date.now() });
  const hands = createHands(page);
  const screen = await hands.settle(100);
  console.log(`RUN ${runId} (${status.personaLabel})${save ? ' - resumed from its save' : ''}`);
  console.log(renderScreen(screen));
  await page.close();
}

async function stopRun(runId, why) {
  const session = readSession(runId);
  const status = readStatus(runId);
  if (session) {
    try {
      const page = await reattachPage(session.cdpPort, session.targetId);
      const save = await page.evaluate(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
      if (save) writeFileSync(join(runDir(runId), 'save.json'), save);
      await page.close();
      await fetch(`http://127.0.0.1:${session.cdpPort}/json/close/${session.targetId}`).catch(() => undefined);
    } catch {
      // The tab is already gone: its save is whatever was last copied out.
    }
    if (session.serverPid && alive(session.serverPid)) process.kill(session.serverPid, 'SIGTERM');
    if (session.browserName) spawnSync('bash', [FM_BROWSER, 'stop', session.browserName], { env: browserEnv() });
  }
  if (status) {
    writeStatus({ ...status, state: status.finished ? 'finished' : 'stopped', doing: why ? `stopped: ${why}` : 'stopped', stoppedAt: Date.now() });
  }
  console.log(`stopped ${runId}${why ? `: ${why}` : ''}`);
}

async function act(runId) {
  const session = readSession(runId);
  let status = readStatus(runId);
  if (!session || !status) fail(`run ${runId} has no session: start it first`);
  if (session.browserName && Date.now() - (session.touchedAt ?? 0) > TOUCH_BROWSER_EVERY_MS) {
    spawnSync('bash', [FM_BROWSER, 'start', session.browserName], { env: browserEnv() });
    writeSession(runId, { ...session, touchedAt: Date.now() });
  }
  let page;
  try {
    page = await reattachPage(session.cdpPort, session.targetId);
  } catch (error) {
    fail(`the game tab is gone (${error.message}). Start the run again with: act.mjs start --resume=${runId}`);
  }
  const hands = createHands(page);
  // Every action begins after the player's own beat of thinking (`HUMAN_BEAT_FRAMES`).
  await hands.beat();
  const since = status.lastEvent ?? 0;
  const startedAt = Date.now();
  let result = { ok: true, note: null };
  const text = words.join(' ');
  switch (command) {
    case 'look':
      result = { ok: true, note: null, screen: await hands.settle(30) };
      break;
    case 'walk': {
      const [a, b] = words;
      if (!a) fail('walk <x> <y>, walk <name of something on screen>, walk way, or walk up|down|left|right [tiles]');
      if (['up', 'down', 'left', 'right', 'north', 'south', 'east', 'west'].includes(a)) {
        result = await hands.stroll(a, Number(b ?? 5) || 5);
      } else {
        const target = /^\d+$/.test(a) && /^\d+$/.test(b ?? '') ? { tile: { x: Number(a), y: Number(b) } } : { label: text };
        result = await hands.walkTo(target);
      }
      status = { ...status, doing: `walking to ${text}` };
      break;
    }
    case 'talk':
      result = await hands.talk(words[0]);
      status = { ...status, doing: 'talking' };
      break;
    case 'next':
      result = { ok: true, note: null, screen: await hands.readThrough() };
      break;
    case 'choose':
      if (!text) fail('choose <label>');
      result = await hands.choose(text);
      status = { ...status, doing: `choosing ${text}` };
      break;
    case 'fight':
      result = await hands.fight(words[0] ?? 'strongest');
      status = { ...status, doing: 'fighting' };
      break;
    case 'press': {
      const times = Math.min(20, Number(words[1] ?? 1) || 1);
      for (let i = 0; i < times; i += 1) await hands.press(words[0] ?? fail('press <key> [times]'), 3);
      result = { ok: true, note: `pressed ${words[0]} x${times}`, screen: await hands.settle(60) };
      break;
    }
    case 'wait': {
      const seconds = Math.min(120, Number(words[0] ?? 2) || 2);
      await hands.step(Math.round(seconds * 10));
      result = { ok: true, note: `waited ${seconds}s of game time`, screen: await hands.settle(30) };
      break;
    }
    case 'goal':
      if (!text) fail('goal <what you are trying to do>');
      status = { ...status, goal: text, doing: text, sameFor: 0, stuck: false };
      result = { ok: true, note: `goal: ${text}`, screen: await hands.look() };
      break;
    case 'giveup': {
      const shot = await screenshot(page, runId, 'stuck');
      ({ status } = recordFinding(status, { kind: 'confusing', text: `STUCK: gave up on "${status.goal ?? 'no goal'}"${text ? ` - ${text}` : ''}`, shot }));
      status = { ...status, goal: null, doing: 'choosing a new goal', sameFor: 0, stuck: false };
      result = { ok: true, note: 'gave the goal up; STUCK logged', screen: await hands.look() };
      break;
    }
    case 'note': {
      const [kind, ...rest] = words;
      if (!rest.length) fail('note bug|confusing|ai-feel <what happened>');
      const screenNow = await hands.look();
      const shot = flags['no-shot'] ? null : await screenshot(page, runId, kind);
      const where = summaryOf(screenNow);
      ({ status } = recordFinding(status, { kind, text: rest.join(' '), shot, where }));
      result = { ok: true, note: `noted (${kind})${shot ? ` with ${shot}` : ''}`, screen: screenNow };
      break;
    }
    case 'shot': {
      const shot = await screenshot(page, runId, words[0] ?? 'shot');
      result = { ok: true, note: `saved ${shot}`, screen: await hands.look() };
      break;
    }
    case 'events': {
      const events = await hands.eventsSince(Number(words[0] ?? 0));
      console.log(JSON.stringify(events, null, 1));
      await page.close();
      return;
    }
    default:
      await page.close();
      fail(`unknown command ${command}`);
  }
  const screen = result.screen ?? (await hands.look());
  const events = await hands.eventsSince(since);
  const folded = foldAction(status, { action: command, screen, events, signature: progressSignature(screen) });
  status = { ...folded.status, gameTimeMs: (status.gameTimeMs ?? 0) };
  if (typeof screen.scene.world?.raid?.elapsedMs === 'number') status.raidClockMs = screen.scene.world.raid.elapsedMs;
  // The save, copied out after every action, so a run can be picked up again in a new browser.
  const save = await page.evaluate(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
  if (save) writeFileSync(join(runDir(runId), 'save.json'), save);
  // Memory, and a reload from the save when it has grown past what the watchdog allows.
  const memory = session.browserName ? browserMb(session.browserName) : null;
  let reloaded = false;
  if (memory !== null) {
    status.browserMb = memory;
    const top = screen.scenes[screen.scenes.length - 1];
    const sinceReload = status.actions - (status.reloadedAtAction ?? -Infinity);
    if (memory > RELOAD_OVER_MB && sinceReload >= RELOAD_EVERY_ACTIONS && RELOAD_SAFE_SCENES.has(top) && !screen.scenes.includes('world')) {
      // A new tab, not a reload in place: a reload keeps the same renderer
      // process, and its memory was measured not to come back (1.65GB before,
      // 1.67-1.70GB after, three times running). A new tab is a new process.
      await page.close();
      await fetch(`http://127.0.0.1:${session.cdpPort}/json/close/${session.targetId}`).catch(() => undefined);
      const fresh = await openGame(session.cdpPort, session.url, null);
      page = fresh.page;
      writeSession(runId, { ...readSession(runId), targetId: fresh.targetId });
      await createHands(page).settle(100);
      reloaded = true;
      status.reloads = (status.reloads ?? 0) + 1;
      status.reloadedAtAction = status.actions;
      // A new tab's event log starts again at 1.
      status.lastEvent = 0;
      status.browserMb = browserMb(session.browserName) ?? memory;
    }
  }
  writeStatus(status);
  recordAction(runId, { at: Date.now(), ms: Date.now() - startedAt, action: command, args: words, ok: result.ok, note: result.note, events: events.length, where: summaryOf(screen) });
  await page.close();
  if (flags.json) {
    console.log(JSON.stringify({ result: { ok: result.ok, note: result.note }, screen, events, advice: folded.advice }, null, 1));
  } else {
    console.log(renderScreen(screen, { events, advice: folded.advice, note: result.note }));
  }
  // The session's clock, when the overnight runner set one, so the player keeps
  // playing to the end of it rather than stopping early to sum up.
  const endsAt = Number(process.env.EPTW_AI_SESSION_ENDS ?? 0);
  if (endsAt > 0) {
    const left = Math.round((endsAt - Date.now()) / 60_000);
    console.log(left <= 3 ? `\nTIME IS UP: update memory.md now; this session ends in ${Math.max(0, left)} min.` : `\nSESSION: ${left} min left. Keep playing.`);
  }
  if (reloaded) {
    console.log(`\nTHE GAME WAS RELOADED to free memory (the browser was at ${memory}MB). It is on its title screen: choose CONTINUE.`);
  }
}

/** A browser's memory as the kernel shares it out (PSS), summed over its process group, in MB. */
export function browserMb(name = BROWSER_NAME) {
  try {
    const leader = Number(readFileSync(`/tmp/fm-browser/${name}/pid`, 'utf8').trim());
    const listed = spawnSync('ps', ['-o', 'pid=', '-g', String(leader)], { encoding: 'utf8' }).stdout.split('\n').map(Number).filter(Boolean);
    let kb = 0;
    for (const pid of listed) {
      try {
        kb += Number(/^Pss:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'))?.[1] ?? 0);
      } catch {
        // Gone between the listing and the read.
      }
    }
    return Math.round(kb / 1024);
  } catch {
    return null;
  }
}

function summaryOf(screen) {
  const field = screen.scene.world ?? screen.scene.base;
  const top = screen.scenes[screen.scenes.length - 1];
  return [top, field?.mapName ?? null, field?.place ?? null, field?.tile ? `${field.tile.x},${field.tile.y}` : null]
    .filter(Boolean)
    .join(' / ');
}

async function screenshot(page, runId, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = `${Date.now()}-${String(name).replace(/[^a-z0-9-]+/gi, '-')}.png`;
  const path = join(runDir(runId), 'shots', file);
  writeScreenshot(path, data);
  return `shots/${file}`;
}

mkdirSync(runsDir(), { recursive: true });
if (command === 'start') {
  await start();
} else if (command === 'stop') {
  const runId = flags.run ?? currentRunId();
  if (!runId) fail('no current run');
  await stopRun(runId, words.join(' '));
} else if (command) {
  const runId = flags.run ?? currentRunId();
  if (!runId) fail('no current run: act.mjs start --persona=veteran|newcomer');
  await act(runId);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
process.exit(0);
