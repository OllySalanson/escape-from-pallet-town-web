// Two players in one HARBOUR: two tabs of one browser, each a player, walking
// the shared harbour over the local stand-in (`?harbour=local`,
// `src/game/harbour/harbourWire.ts`), so not one message reaches the live
// project - a driven page cannot reach it anyway (`browser.mjs`).
//
//   node tools/playtest/sharedHarbour.mjs <url> <out dir> [--window=1200x768] [--port=N]
//
// `--port=` drives a browser already running on that CDP port (one the
// machine's memory watchdog can see) instead of launching its own.
//
// OLLY starts a game and is named; AMY is the second tab, named by the test.
// Each must see the other standing in the yard with their name over them, OLLY
// walks three tiles and AMY must see him arrive where he stopped, OLLY walks
// into Oak's Lab and AMY must stop seeing him, and AMY follows him in and sees
// him there. It fails loudly - a thrown error - when any of that does not
// happen, and photographs both screens on the way.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

const page = (base) => `${base}${base.includes('?') ? '&' : '?'}testmode=pixels&harbour=local`;
const BASE = `${GAME}.scene.getScene('base')`;
const state = `(() => { const b = ${BASE}; const live = b && b.sys.isActive() && b.ready && !b.leaving;
  return { live: !!live, room: live && b.room ? b.room.id : null, tile: live ? b.currentTile : null,
    seen: live ? b.harbourFiguresShown : [] }; })()`;

/** The first step of the shortest walk to a goal tile over the scene's own collision. */
const firstStep = (goal) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const g = ${JSON.stringify(goal)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  if (s.x === g.x && s.y === g.y) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      const here = { x: nx, y: ny }; const isGoal = nx === g.x && ny === g.y;
      // Round doorways (a doorway takes whoever steps on it) and round the partner (a tap towards it only turns).
      const inTheWay = !isGoal && (b.doors.some((d) => d.tiles.some((t) => t.x === nx && t.y === ny)) || (b.partner && b.partner.standsOn(here)));
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || inTheWay || (!isGoal && b.isBlocked(here))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

const browser = option('port')
  ? attachBrowser(Number(option('port')), { window: { width, height } })
  : await launchBrowser({ window: { width, height } });
try {
  const olly = await browser.openPage(page(url));
  // A tab behind another is slowed to a frame a second, so the one being
  // played is brought to the front first; the other, behind it, still hears.
  let front = null;
  const press = async (tab, code, holdMs = 0) => {
    if (front !== tab) {
      await tab.send('Page.bringToFront');
      front = tab;
    }
    await tab.tap(code, holdMs);
    await sleep(220);
  };
  const walkTo = async (tab, goal, done = async () => false) => {
    for (let guard = 0; guard < 80; guard += 1) {
      if (await done()) return;
      const key = await tab.evaluate(firstStep(goal));
      if (key === 'here') return;
      if (key === 'unreachable') throw new Error(`nothing reaches ${JSON.stringify(goal)} from ${JSON.stringify(await tab.evaluate(state))}`);
      if (key) await press(tab, key);
      else await sleep(120);
    }
    const why = await tab.evaluate(`(() => { const b = ${BASE}; return { tile: b.currentTile, target: b.targetTile, dialog: b.dialogBox.visible ? b.dialogBox.textObject.text : null, naming: !!b.namePrompt, decor: !!b.decor, leaving: b.leaving, resting: b.resting, step: ${firstStep(goal)} }; })()`);
    throw new Error(`gave up walking to ${JSON.stringify(goal)}: ${JSON.stringify(why)}`);
  };
  const until = async (tab, what, test, timeoutMs = 8000) => {
    const started = Date.now();
    for (;;) {
      const now = await tab.evaluate(state);
      if (now.live && test(now)) return now;
      if (Date.now() - started > timeoutMs) throw new Error(`${what}: ${JSON.stringify(now)}`);
      await sleep(200);
    }
  };

  // OLLY: a new game, with a name already given, so he is seen.
  await olly.waitFor(sceneIs('title'));
  await olly.evaluate(`localStorage.setItem('escape-from-pallet-town.player.name', 'OLLY')`);
  await press(olly, 'Space');
  // NEW GAME asks the name first (`src/game/names/`): OLLY is free.
  await olly.waitFor(`!!document.querySelector('[data-name-field]')`, { what: 'YOUR NAME? at NEW GAME' });
  await sleep(450);
  await olly.evaluate(`document.querySelector('[data-name-field]').focus()`);
  for (const character of 'OLLY') {
    const description = { code: `Key${character}`, key: character, text: character, windowsVirtualKeyCode: character.charCodeAt(0) };
    await olly.send('Input.dispatchKeyEvent', { type: 'keyDown', ...description });
    await olly.send('Input.dispatchKeyEvent', { type: 'keyUp', ...description });
    await sleep(40);
  }
  await press(olly, 'Enter');
  await olly.waitFor(sceneIs('starter'));
  await olly.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await olly.waitFor(sceneIs('base'));
  await olly.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await until(olly, 'OLLY in the yard', (s) => s.room === null);

  // AMY: the second tab, on the same save, under the name the test gives her.
  const amy = await browser.openPage(page(url), { init: `sessionStorage.setItem('eptw-harbour-local-name', 'AMY');` });
  await amy.waitFor(sceneIs('title'));
  await press(amy, 'Space');
  await amy.waitFor(sceneIs('base'));
  const amyStart = await until(amy, 'AMY in the yard', (s) => s.room === null);

  // Each sees the other, by name.
  const ollySees = await until(olly, 'OLLY seeing AMY', (s) => s.seen.some((f) => f.name === 'AMY'));
  const amySees = await until(amy, 'AMY seeing OLLY', (s) => s.seen.some((f) => f.name === 'OLLY'));
  console.log(`OLLY sees ${JSON.stringify(ollySees.seen)}; AMY sees ${JSON.stringify(amySees.seen)}`);

  // OLLY walks east along the top of the yard, under the doors, and AMY sees him get there.
  const goal = { x: amyStart.tile.x + 4, y: amyStart.tile.y - 1 };
  await walkTo(olly, goal);
  const arrived = await until(amy, 'AMY seeing OLLY arrive', (s) =>
    s.seen.some((f) => f.name === 'OLLY' && f.tile.x === goal.x && f.tile.y === goal.y),
  );
  console.log(`AMY saw OLLY walk to ${goal.x},${goal.y}`);
  await amy.screenshot(`${out}/amy-sees-olly.png`);
  await olly.screenshot(`${out}/olly-sees-amy.png`);

  // Into Oak's Lab: gone from the yard for AMY, and there when she follows.
  const lab = await olly.evaluate(`${BASE}.doors.find((d) => d.id === 'oaks-lab')`);
  await walkTo(olly, lab.tiles[0], async () => (await olly.evaluate(state)).room === 'oaks-lab');
  await until(olly, 'OLLY in the lab', (s) => s.room === 'oaks-lab');
  await until(amy, 'AMY no longer seeing OLLY in the yard', (s) => !s.seen.some((f) => f.name === 'OLLY'));
  console.log('OLLY went into the lab and left the yard');
  await walkTo(amy, lab.tiles[0], async () => (await amy.evaluate(state)).room === 'oaks-lab');
  const inLab = await until(amy, 'AMY seeing OLLY in the lab', (s) => s.room === 'oaks-lab' && s.seen.some((f) => f.name === 'OLLY'));
  console.log(`in the lab, AMY sees ${JSON.stringify(inLab.seen)}`);
  await sleep(400);
  await amy.screenshot(`${out}/amy-in-the-lab.png`);
  void arrived;
} finally {
  await browser.close();
}
