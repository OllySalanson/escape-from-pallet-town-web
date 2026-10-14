// Knocking on somebody's door in the shared harbour, end to end: two tabs of one
// browser, each a player, over the local stand-in (`?harbour=local`,
// `src/game/harbour/houseService.ts`), so not one knock reaches the live project.
//
//   node tools/playtest/knocking.mjs <url> <out dir> [--window=1200x768]
//
// AMY knocks on OLLY's door while he is out in the yard and is told he is not
// home. OLLY goes home; AMY knocks again from her own step; OLLY is asked, with
// the cursor on NOT NOW, and lets her in. AMY is shown OLLY's house - his name
// on his things, and him standing in it - and he sees her there. She cannot
// pick his furniture up (H says why), and down off the mat takes her home to her own step.
// It fails loudly - a thrown error - when any of that does not happen, and
// photographs both screens on the way.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
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
    seen: live ? b.harbourFiguresShown : [], visit: live && b.visit ? b.visit.ownerName : null,
    asked: live && b.knockPrompt ? b.knockPrompt.knock.knockerName : null, decorating: live ? !!b.decor : false,
    knockScreen: !!document.querySelector('.knock-menu'),
    status: document.querySelector('.knock-menu .px-status-line')?.textContent ?? null,
    rows: [...document.querySelectorAll('.knock-menu [data-knock]')].map((row) => row.textContent.trim()),
    dialog: live && b.dialogBox.visible ? b.dialogBox.textObject.text : null,
    things: live && b.place.room ? b.place.room.things.map((t) => t.name) : [] }; })()`;

/** The first step of the shortest walk to a goal, round doorways and the partner. */
const firstStep = (goal) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const g = ${JSON.stringify(goal)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  if (s.x === g.x && s.y === g.y) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      const here = { x: nx, y: ny }; const isGoal = nx === g.x && ny === g.y;
      const inTheWay = !isGoal && ((!b.room && b.doors.some((d) => d.tiles.some((t) => t.x === nx && t.y === ny))) || (b.partner && b.partner.standsOn(here)));
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || inTheWay || (!isGoal && b.isBlocked(here))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  // A tab behind another is slowed to a frame a second, so the one being
  // played is brought to the front first.
  let front = null;
  const toFront = async (tab) => {
    if (front !== tab) {
      await tab.send('Page.bringToFront');
      front = tab;
      await sleep(300);
    }
  };
  const press = async (tab, code) => {
    await toFront(tab);
    await tab.tap(code);
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
    throw new Error(`gave up walking to ${JSON.stringify(goal)}`);
  };
  const until = async (tab, what, test, timeoutMs = 15000) => {
    const started = Date.now();
    for (;;) {
      const now = await tab.evaluate(state);
      if (test(now)) return now;
      if (Date.now() - started > timeoutMs) throw new Error(`${what}: ${JSON.stringify(now)}`);
      await sleep(250);
    }
  };
  const readThrough = async (tab) => {
    for (let guard = 0; guard < 30; guard += 1) {
      const now = await tab.evaluate(state);
      if (now.dialog === null) return;
      await press(tab, 'Space');
    }
  };

  // OLLY: a new game, named, standing in the yard.
  const olly = await browser.openPage(page(url));
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
  await until(olly, 'OLLY in the yard', (s) => s.live && s.room === null);

  // AMY: the second tab, walks to her own front step.
  const amy = await browser.openPage(page(url), { init: `sessionStorage.setItem('eptw-harbour-local-name', 'AMY');` });
  await amy.waitFor(sceneIs('title'));
  await press(amy, 'Space');
  await amy.waitFor(sceneIs('base'));
  await until(amy, 'AMY in the yard', (s) => s.live && s.room === null);
  const home = await amy.evaluate(`${BASE}.doors.find((d) => d.id === 'bolthole')`);
  await walkTo(amy, home.returnTo);
  const onStep = await amy.evaluate(`${BASE}.hintShown`);
  if (!onStep.includes('[K] KNOCK ON A DOOR')) throw new Error(`AMY's step says "${onStep}"`);

  // Knocking while OLLY is out: listed as out, and not home.
  await press(amy, 'KeyK');
  const list = await until(amy, "AMY's knock list with OLLY in it", (s) => s.rows.some((row) => row.includes("OLLY's house")));
  if (!list.rows.find((row) => row.includes("OLLY's house"))?.includes('Out')) throw new Error(`the list says ${JSON.stringify(list.rows)}`);
  const back = await amy.evaluate(`document.querySelector('.knock-menu [data-knock-close]')?.textContent ?? ''`);
  if (back.trim().toUpperCase() !== 'YARD') throw new Error(`opened on the step, the way back says "${back}"`);
  await amy.screenshot(`${out}/knock-list.png`);
  await press(amy, 'Enter');
  const notHome = await until(amy, 'told OLLY is not home', (s) => s.status !== null);
  if (!notHome.status.includes("OLLY isn't home")) throw new Error(`AMY was told "${notHome.status}"`);
  console.log(`while out: ${notHome.status}`);
  await press(amy, 'Escape');
  await until(amy, 'the knock screen put away', (s) => !s.knockScreen && s.live);

  // OLLY goes home.
  const ollyDoor = await olly.evaluate(`${BASE}.doors.find((d) => d.id === 'bolthole')`);
  await walkTo(olly, ollyDoor.tiles[0], async () => (await olly.evaluate(state)).room === 'bolthole');
  await until(olly, 'OLLY home', (s) => s.live && s.room === 'bolthole');
  await sleep(2500);
  const told = await olly.evaluate(`${BASE}.doorTold`);
  if (!told) throw new Error(`OLLY's door never said he was home: ${JSON.stringify(await olly.evaluate(state))}`);

  // AMY knocks again: OLLY is home now.
  await press(amy, 'KeyK');
  await until(amy, 'OLLY listed at home', (s) => s.rows.some((row) => row.includes("OLLY's house") && row.includes('Home')));
  await press(amy, 'Enter');
  await until(amy, 'knocking', (s) => s.knockScreen && s.status === null);
  const asked = await until(olly, 'OLLY asked', (s) => s.asked === 'AMY');
  console.log(`OLLY was asked about ${asked.asked}`);
  await toFront(olly);
  await olly.screenshot(`${out}/somebody-knocking.png`);
  // The cursor starts on NOT NOW: left to LET THEM IN, then yes.
  await press(olly, 'ArrowLeft');
  await press(olly, 'Space');
  await readThrough(olly);

  // AMY is let in.
  const inside = await until(amy, 'AMY inside OLLY\'s house', (s) => s.live && s.visit === 'OLLY' && s.room === 'bolthole', 20000);
  if (inside.things.some((name) => name.startsWith('YOUR '))) throw new Error(`a visitor reads ${JSON.stringify(inside.things)}`);
  await readThrough(amy);
  const amySees = await until(amy, 'AMY seeing OLLY at home', (s) => s.seen.some((f) => f.name === 'OLLY'));
  const ollySees = await until(olly, 'OLLY seeing AMY in his house', (s) => s.seen.some((f) => f.name === 'AMY'));
  console.log(`inside: AMY sees ${JSON.stringify(amySees.seen)}; OLLY sees ${JSON.stringify(ollySees.seen)}`);
  await toFront(amy);
  await amy.screenshot(`${out}/visiting.png`);
  // Nobody moves the host's furniture.
  await press(amy, 'KeyH');
  const refused = await until(amy, 'AMY told the furniture is not hers', (s) => s.dialog?.endsWith('move.') ?? false);
  if (refused.decorating) throw new Error('a visitor picked the house up');
  if (!refused.dialog.includes("OLLY's house")) throw new Error(`H in a visit said ${JSON.stringify(refused.dialog)}`);
  console.log(`H in a visit: ${refused.dialog}`);
  await amy.screenshot(`${out}/visitor-presses-h.png`);
  await readThrough(amy);

  // Down off the mat: home, on her own step.
  const mat = await amy.evaluate(`${BASE}.room.mat`);
  await walkTo(amy, mat);
  await press(amy, 'ArrowDown');
  const outside = await until(amy, 'AMY back on her own step', (s) => s.live && s.room === null && s.visit === null);
  if (outside.tile.x !== home.returnTo.x || outside.tile.y !== home.returnTo.y) {
    throw new Error(`leaving put AMY on ${JSON.stringify(outside.tile)}, not her step`);
  }
  console.log(`AMY went home to ${outside.tile.x},${outside.tile.y}`);
} finally {
  await browser.close();
}
