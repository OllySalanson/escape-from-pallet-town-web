// The harbour half of playtest 51's fixes, played as a player meets them and
// photographed (`docs/screens/pt51-fixes/`):
//
// - #12: a new save on THE BEACH, before its first raid: the gold way-mark at
//   the screen's edge stands clear of THE DIG's sign, and (#10) the bottle at
//   the tide line glints over the night's wash when the clock says night.
// - #8: THE PROMENADE DERBY's board answers from under either post, not only
//   from its middle tile.
// - #10: into THE GREAT LIBRARY with THE CHART ROOM open: the end bookcase's
//   caption stays over the room; through the arch, the hint line names the way
//   back out (`[UP] OUT`), and a push up goes back through it.
//
//   node tools/playtest/pt51Checks.mjs <url> <out dir> [--port=<cdp port>] [--window=1200x768]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures; `tools/playtest/README.md`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const failures = [];
const expect = (what, ok) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const port = option('port');
const [width, height] = option('window')?.split('x').map(Number) ?? [PIXEL_WINDOW.width, PIXEL_WINDOW.height];
const window = { width, height };
const browser = port ? attachBrowser(Number(port), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`pt51Checks: never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const shoot = async (name) => {
    await step(2);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready && !${base}.leaving`;
  const hint = () => page.evaluate(`${base}.hintText?.text ?? ''`);

  // A walk over the scene's own collision to a tile, in the yard or a room.
  const walkTo = async (goal, what, done = null) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (done && (await page.evaluate(done))) return;
      const move = await page.evaluate(`(() => { const b = ${base}; if (!b.ready || b.leaving || b.isWalking?.()) return { wait: true };
        if (b.dialogBox?.visible) return { key: 'Space' };
        const s = b.currentTile, g = ${JSON.stringify(goal)};
        if (s.x === g.x && s.y === g.y) return { arrived: true };
        const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || (b.isBlocked({ x: nx, y: ny }) && !(nx === g.x && ny === g.y))) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`);
      if (move.unreachable) {
        await page.screenshot(`${out}/stuck.png`);
        throw new Error(`pt51Checks: nothing walks to ${what} ${JSON.stringify(goal)} from ${await page.evaluate(`JSON.stringify({ at: ${base}.currentTile, room: ${base}.room?.id ?? null })`)}`);
      }
      if (move.arrived) return;
      if (move.key) {
        const from = await page.evaluate(`JSON.stringify(${base}.currentTile)`);
        await press(move.key);
        await wait(120);
        // A tap towards the partner only turns the player: the key held goes on.
        // Only once the step a tap began is over: read mid-step, the tile had not changed yet, and the
        // key then held walked a tile too far and back round the partner for ever (playtest 51, finding 13).
        for (let settle = 0; settle < 30 && (await page.evaluate(`${base}.isWalking?.() || ${base}.targetTile !== null`)); settle += 1) await step(2);
        if (move.key !== 'Space' && (await page.evaluate(`JSON.stringify(${base}.currentTile)`)) === from) {
          // Held until the step into the partner's tile begins, and no longer.
          await page.keyDown(move.key);
          for (let held = 0; held < 30 && !(await page.evaluate(`${base}.targetTile !== null`)); held += 1) await step(1);
          await page.keyUp(move.key);
        }
      }
      await wait(120);
    }
    await page.screenshot(`${out}/stuck.png`);
    throw new Error(`pt51Checks: never reached ${what} (at ${await page.evaluate(`JSON.stringify(${base}.currentTile)`)})`);
  };
  const face = async (key) => {
    await press(key);
    await wait(200);
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // --- #12 and #10: THE BEACH, before a first raid --------------------------------------
  await walkTo({ x: 83, y: 21 }, 'the beach by the bottle');
  await wait(600);
  const chevron = await page.evaluate(`(() => { const b = ${base}; const m = b.yardWayMark; if (!m) return null; const i = m.image; const v = b.cameras.main.worldView;
    return { x: i.x + v.left, y: i.y + v.top, visible: i.visible }; })()`);
  // THE DIG's sign, 2x2 tiles at 66,20.
  const sign = { left: 66 * 16, top: 20 * 16, right: 68 * 16, bottom: 22 * 16 };
  const over = chevron && chevron.x + 11 > sign.left && chevron.x - 11 < sign.right && chevron.y + 11 > sign.top && chevron.y - 11 < sign.bottom;
  expect(`the way-mark is up on THE BEACH (${JSON.stringify(chevron)})`, chevron?.visible === true);
  expect(`and stands clear of THE DIG's sign`, !over);
  await shoot('12-after-chevron-clear-of-dig-sign');

  // --- #8: THE DERBY board, from under its left post -------------------------------------
  await walkTo({ x: 61, y: 12 }, 'under the DERBY board\'s left post');
  await face('ArrowUp');
  await press('Space');
  await wait(400);
  expect('the DERBY board plays from under its left post', await page.evaluate(sceneIs('derby')));
  await shoot('08-after-board-post');
  await press('Escape');
  await until(baseReady, 'the promenade again');
  await walkTo({ x: 63, y: 12 }, 'under the DERBY board\'s right post');
  await face('ArrowUp');
  await press('Space');
  await wait(400);
  expect('and from under its right post', await page.evaluate(sceneIs('derby')));
  await press('Escape');
  await until(baseReady, 'the promenade again');

  // --- #10: THE GREAT LIBRARY and THE CHART ROOM -----------------------------------------
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.treasureHunt = { roomOpen: true, pinned: ['shore'], chestOpened: false };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour, continued');
  // Continued in whichever room the save was made in: out by its mat first.
  for (let guard = 0; guard < 10 && (await page.evaluate(`Boolean(${base}.room)`)); guard += 1) {
    const mat = await page.evaluate(`${base}.room?.mat ?? null`);
    if (mat) await walkTo(mat, 'the mat');
    await press('ArrowDown');
    await wait(900);
  }
  await until(`${baseReady} && !${base}.room`, 'the yard');
  const door = await page.evaluate(`${base}.doors.find((each) => each.id === 'great-library')?.tiles[0] ?? null`);
  if (!door) throw new Error('pt51Checks: no library door');
  await walkTo(door, 'the library door', `${base}.room?.id === 'great-library'`);
  await until(`${baseReady} && ${base}.room?.id === 'great-library'`, 'the library');
  await walkTo({ x: 13, y: 1 }, 'the arch', `${base}.room?.id === 'chart-room'`);
  await until(`${baseReady} && ${base}.room?.id === 'chart-room'`, 'THE CHART ROOM');
  await wait(300);
  const said = await hint();
  expect(`THE CHART ROOM's hint names the way out (${said})`, /\[UP\] OUT/.test(said));
  await shoot('10-after-chart-room-hint');
  await page.keyDown('ArrowUp');
  await step(20);
  await page.keyUp('ArrowUp');
  await until(`${baseReady} && ${base}.room?.id === 'great-library'`, 'back through the arch');
  expect('a push up in the arch goes back to the library', true);
  await wait(600);
  // Stood in the arch, THE END BOOKCASE's caption is up, as playtest 51 saw it, and stays over the room.
  await shoot('10-after-caption-over-the-room');
  const label = await page.evaluate(`(() => { const b = ${base}; const v = b.cameras.main.worldView;
    const shown = b.worldLabels.filter((l) => l.label.visible).map((l) => l.label.x - 3 + l.request().width);
    return { shown: shown.length, right: Math.max(...shown), room: b.place.width * 16, view: Math.round(v.right) }; })()`);
  expect(`a caption is up, and none hangs more than a tile past the library's wall (${JSON.stringify(label)})`, label.shown > 0 && label.right <= label.room + 16 + 1);

} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall well');
