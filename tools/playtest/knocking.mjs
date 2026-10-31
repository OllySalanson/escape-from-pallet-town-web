// Knocking on somebody's door in the shared harbour, end to end: two tabs of one
// browser, each a player, over the local stand-in (`?harbour=local`,
// `src/game/harbour/houseService.ts`), so not one knock reaches the live project.
//
//   node tools/playtest/knocking.mjs <url> <out dir> [--window=1200x768]
//
// Knocking is THE BOLTHOLE's garden sign: read like any sign, it asks whose
// door in the text box, and the list of players follows once that is read.
// AMY knocks on OLLY's door while he is out in the yard and is told he is not
// home. OLLY goes home; AMY knocks again from the sign; OLLY is asked, with
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
  // Up to the garden sign, facing it, and read it: the ordinary text box asks
  // whose door, and once it is read the list of players comes up.
  const sign = { x: 38, y: 12 };
  const readKnockSign = async (tab, shot) => {
    // The sign stands east of the path up to THE BOLTHOLE's step.
    await walkTo(tab, { x: sign.x - 1, y: sign.y });
    await press(tab, 'ArrowRight');
    await press(tab, 'Space');
    const asked = await until(tab, 'the sign asking whose door', (s) => s.dialog?.includes('Select the player you want to knock on the door of.') ?? false);
    if (asked.knockScreen) throw new Error('the list came up before the sign was read');
    if (shot) await tab.screenshot(shot);
    await press(tab, 'Space');
    await until(tab, 'the list of players', (s) => s.knockScreen);
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
  await olly.waitFor(sceneIs('base'));
  await olly.waitFor(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`,
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
  // K knocks no more: the step names no key for it.
  await walkTo(amy, home.returnTo);
  const onStep = await amy.evaluate(`${BASE}.hintShown`);
  if (onStep.includes('KNOCK')) throw new Error(`AMY's step still says "${onStep}"`);

  // Knocking while OLLY is out: listed as out, and not home.
  await readKnockSign(amy, `${out}/knock-sign.png`);
  const list = await until(amy, "AMY's knock list with OLLY in it", (s) => s.rows.some((row) => row.startsWith('OLLY')));
  if (!list.rows.find((row) => row.startsWith('OLLY'))?.includes('Out')) throw new Error(`the list says ${JSON.stringify(list.rows)}`);
  const back = await amy.evaluate(`document.querySelector('.knock-menu [data-knock-close]')?.textContent ?? ''`);
  if (back.trim().toUpperCase() !== 'YARD') throw new Error(`opened from the sign, the way back says "${back}"`);
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
  // He arrives on the mat, and the mat names the house's own keys he has not
  // used yet beside the way out (playtest 48: it said only [DOWN] OUT).
  const homeHint = await olly.evaluate(`(() => { const b = ${BASE}; return { hint: b.hintShown, learned: b.savedGame.raidProgress.keysLearned ?? [] }; })()`);
  console.log(`on his mat: ${homeHint.hint}`);
  if (!homeHint.learned.includes('decorate') && !homeHint.hint.includes('[H] DECORATE')) throw new Error(`OLLY's mat did not name [H] DECORATE: "${homeHint.hint}"`);
  if (homeHint.hint.includes('KNOCK')) throw new Error(`OLLY's mat still names a knock key: "${homeHint.hint}"`);
  await toFront(olly);
  await olly.screenshot(`${out}/home-mat-hint.png`);

  // AMY knocks and stops before he answers (playtest 48, finding 8): OLLY's
  // question is taken down, rather than left to open the door to nobody.
  await readKnockSign(amy);
  await until(amy, 'OLLY listed at home', (s) => s.rows.some((row) => row.startsWith('OLLY') && row.includes('Home')));
  await press(amy, 'Enter');
  await until(amy, 'knocking', (s) => s.knockScreen && s.status === null);
  await until(olly, 'OLLY asked', (s) => s.asked === 'AMY');
  await press(amy, 'Escape');
  await until(amy, 'AMY stopped knocking', (s) => s.status?.includes('stopped knocking') ?? false);
  const goneFromStep = await until(olly, "OLLY's question taken down", (s) => s.asked === null && (s.dialog?.endsWith('step.') ?? false), 6000);
  if (!goneFromStep.dialog.includes('AMY has gone from the step.')) throw new Error(`OLLY was told ${JSON.stringify(goneFromStep.dialog)}`);
  console.log(`a stopped knock: ${goneFromStep.dialog}`);
  await toFront(olly);
  await olly.screenshot(`${out}/knock-withdrawn.png`);
  await readThrough(olly);
  await press(amy, 'Escape');
  await until(amy, 'the knock screen put away', (s) => !s.knockScreen && s.live);

  // AMY knocks again: OLLY is home now.
  await readKnockSign(amy);
  await until(amy, 'OLLY listed at home', (s) => s.rows.some((row) => row.startsWith('OLLY') && row.includes('Home')));
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
