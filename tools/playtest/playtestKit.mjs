// Plays the explorer run's playtest kit as a playtester meets it: `?playtest`
// on the address goes straight into a fresh explorer run, the PLAYTEST BOARD
// stands on the lawn by the landing, and from it the driver jumps to THE GAME
// CORNER, opens POKéMON JUMP straight away and plays it with the kit's
// Rattatas, sets the night, starts a NEW DAY and plays again to see the
// cabinet pay a second time, and goes to a part of the harbour.
// (`src/game/dev/playtestKit.ts`, `playtestBoard.ts`.) Every step is
// photographed, and a broken promise fails loudly.
//
//   node tools/playtest/playtestKit.mjs <url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures worth judging; `tools/playtest/README.md`, "Memory"). `--port`
// drives a browser that is already running rather than launching one.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';
const BOARD = { x: 18, y: 14 };

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`playtestKit: ${why}`);
};
const withParam = (address, param) => `${address}${address.includes('?') ? '&' : '?'}${param}`;

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  // A fresh explorer run, whatever a browser driven before left in it.
  await page.evaluate(`localStorage.removeItem('${PLAYTEST_SAVE_KEY}')`);
  await page.send('Page.navigate', { url: withParam(url, 'playtest') });
  const BASE = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready && !${BASE}.leaving`;
  await page.waitFor(baseReady, { what: 'the harbour, straight from the address' });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
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
  const save = () => page.evaluate(`JSON.parse(localStorage.getItem('${PLAYTEST_SAVE_KEY}'))`);
  const where = () =>
    page.evaluate(`(() => { const b = ${BASE}; return { room: b.place.room ? b.place.room.room.id : null, tile: b.currentTile }; })()`);

  if (await page.evaluate(`location.search.includes('playtest')`)) fail('the address kept ?playtest');
  const fresh = await save();
  if (!fresh) fail('no explorer run was written');
  const kinds = fresh.stash.pokemon.map((stored) => stored.pokemon.speciesId);
  const boxes = (fresh.stash.boxes ?? []).map((box) => `${box.name} (${box.pokemonIds.length})`);
  console.log(`vault: ${kinds.length} Pokémon; boxes: ${boxes.join(', ')}; tickets: ${fresh.raidProgress.gameCorner?.tickets}`);
  for (const kind of ['rattata', 'mankey', 'krabby', 'doduo', 'diglett', 'lapras']) {
    if (!kinds.includes(kind)) fail(`the kit has no ${kind}`);
  }
  await wait(600);
  await shoot('01-landing-and-board');

  const walkTo = async (goal, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      const move = await page.evaluate(`(() => { const b = ${BASE}; if (!b.ready || b.leaving || b.targetTile) return { wait: true };
        const s = b.currentTile, g = ${JSON.stringify(goal)};
        if (s.x === g.x && s.y === g.y) return { arrived: true };
        const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`);
      if (move.unreachable) fail(`nothing walks to ${what}`);
      if (move.arrived) return;
      if (move.key) await press(move.key);
      await wait(120);
    }
    fail(`never reached ${what}`);
  };
  /** Up to the board from the path, facing it, and the interact key. */
  const readBoard = async () => {
    if ((await where()).room !== null) fail('the board was looked for inside a room');
    if (!(await page.evaluate(`${BASE}.isBlocked(${JSON.stringify(BOARD)})`))) fail('the board does not stand on its tile');
    await walkTo({ x: BOARD.x, y: BOARD.y - 1 }, 'the board');
    await press('ArrowDown');
    await wait(150);
    await press('Space');
    await until(`!!document.querySelector('.playtest-board [data-board-row]')`, 'the PLAYTEST BOARD');
    await wait(300);
  };
  const choose = async (row) => {
    const pressed = await page.evaluate(
      `(() => { const b = document.querySelector('[data-board-row="${row}"]'); if (!b) return false; b.click(); return true; })()`,
    );
    if (!pressed) fail(`the board has no row ${row}`);
    await wait(200);
  };
  /** POKéMON JUMP played by the screen, as a person does, until the score passes `target`. */
  const playJump = async (target) => {
    await until(`${GAME}.scene.getScene('game-corner')?.phaseKind === 'menu'`, 'the cabinet');
    await page.evaluate(`document.querySelector('[data-play]').click()`);
    await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'playing'`, 'the vine');
    for (let frame = 0; frame < 60 * 120; frame += 1) {
      const state = await page.evaluate(`(() => { const j = ${GAME}.scene.getScene('game-corner').jumpGame; return j ? { over: j.over, state: j.vineState, timer: j.vineTimer, speed: j.vineSpeed, score: j.score, grounded: j.jumpers.every((p) => p.jumpStart === null) } : null; })()`);
      if (!state || state.over) break;
      if (state.score >= target) {
        for (let rest = 0; rest < 600; rest += 1) {
          await step(1);
          if (await page.evaluate(`${GAME}.scene.getScene('game-corner').jumpGame?.over !== false`)) break;
        }
        break;
      }
      const toHit = (0x5ff - state.timer) / Math.max(1, state.speed);
      if (state.grounded && state.state >= 4 && state.state <= 5 && toHit < 9) {
        await page.keyDown('Space');
        await step(1);
        await page.keyUp('Space');
        continue;
      }
      await step(1);
    }
    await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'menu'`, 'the result');
    await wait(300);
  };

  // 1. The board, by the landing.
  await readBoard();
  await shoot('02-board');
  const rows = await page.evaluate(`[...document.querySelectorAll('[data-board-row]')].map((b) => b.dataset.boardRow)`);
  console.log(`board: ${rows.length} rows`);

  // 2. Straight into THE GAME CORNER.
  await choose('room-game-corner');
  await until(`${baseReady} && ${BASE}.place.room?.room.id === 'game-corner'`, 'the Game Corner');
  await wait(400);
  await shoot('03-game-corner');

  // 3. Back out, and POKéMON JUMP straight from the board.
  await page.evaluate(`void ${BASE}.scene.start('base', { from: 'game-corner' })`);
  await until(`${baseReady} && !${BASE}.place.room`, 'the yard again');
  await readBoard();
  await choose('game-pokemon-jump');
  await until(`${sceneIs('game-corner')} && ${GAME}.scene.getScene('game-corner').phaseKind === 'menu'`, 'POKéMON JUMP');
  await wait(400);
  await shoot('04-who-jumps');
  const picked = await page.evaluate(`document.querySelector('.game-corner-screen')?.textContent ?? ''`);
  if (/Nobody here can jump/i.test(picked)) fail('the cabinet says nobody can jump');
  const before = (await save()).raidProgress.gameCorner.tickets;
  await playJump(300);
  await shoot('05-first-go');
  const afterFirst = (await save()).raidProgress.gameCorner.tickets;
  console.log(`tickets ${before} -> ${afterFirst}`);
  if (afterFirst <= before) fail('the first go paid nothing');

  // 4. The same score again the same day pays nothing.
  await playJump(300);
  const afterSecond = (await save()).raidProgress.gameCorner.tickets;
  if (afterSecond !== afterFirst) fail(`a second go the same day paid ${afterSecond - afterFirst}`);
  await press('Escape');
  await until(`${baseReady} && !${BASE}.place.room`, 'the yard after the cabinet');

  // 5. Day, then night, by hand, whatever the clock says.
  await readBoard();
  await choose('hour-day');
  await until(baseReady, 'the yard by day');
  await wait(800);
  await shoot('06-day');
  await readBoard();
  await choose('hour-night');
  await until(baseReady, 'the yard at night');
  await wait(800);
  await shoot('06-night');

  // 6. A new day: the cabinet pays again.
  await readBoard();
  await shoot('07-board-at-night');
  await choose('new-day');
  await until(baseReady, 'the yard on a new day');
  if ((await save()).raidProgress.gameCorner.day !== null) fail('NEW DAY kept the day');
  await readBoard();
  await choose('game-pokemon-jump');
  await playJump(300);
  const afterNewDay = (await save()).raidProgress.gameCorner.tickets;
  console.log(`new day: ${afterSecond} -> ${afterNewDay}`);
  if (afterNewDay <= afterSecond) fail('the cabinet did not pay again on a new day');
  await shoot('08-paid-again');
  await press('Escape');
  await until(`${baseReady} && !${BASE}.place.room`, 'the yard');

  // 7. Back to the player's clock, and off to a part of the harbour.
  await readBoard();
  await choose('hour-clock');
  await until(baseReady, 'the yard on the player\'s clock');
  await readBoard();
  await choose('place-cove');
  await until(baseReady, 'THE COVE');
  await wait(1200);
  const cove = await where();
  console.log(`cove: ${JSON.stringify(cove)}`);
  await shoot('09-the-cove');
  console.log('ok');
} finally {
  await browser.close();
}
