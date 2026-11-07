// Plays the fixes to wave 1's playtest findings as a playtester meets them, on
// a fresh explorer run (`?playtest`), and photographs each:
//
//  - the PLAYTEST BOARD's plate and its PLAY rows, which open BERRY PICKING and
//    THE FIELD-MOVE COURSE as well as POKéMON JUMP (and nothing of the yard is
//    left showing beside a whole screen);
//  - every gym leader waiting on THE RAID ARENA's far floor to spar;
//  - B's storage jumping a pocket at a time on Page Down, and its help bar;
//  - P's list ending inside its window, above the help bar;
//  - the Hauler frame from behind, with the head still a head;
//  - the night by the board.
//
//   node tools/playtest/waveOnePolish.mjs <url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels`).
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
  throw new Error(`waveOnePolish: ${why}`);
};
const withParam = (address, param) => `${address}${address.includes('?') ? '&' : '?'}${param}`;

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.removeItem('${PLAYTEST_SAVE_KEY}')`);
  await page.send('Page.navigate', { url: withParam(url, 'playtest') });
  const BASE = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready && !${BASE}.leaving`;
  await page.waitFor(baseReady, { what: 'the harbour', timeoutMs: 60_000 });
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
  const readBoard = async () => {
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
    await wait(300);
  };
  const backToYard = async () => {
    await page.evaluate(`void ${BASE}.scene.start('base', {})`);
    await until(`${baseReady} && !${BASE}.place.room`, 'the yard');
    // The first key after a restart by hand is lost (AGENTS.md), so spend one that does nothing.
    await press('KeyZ');
  };

  // 1. The board's plate, and its PLAY rows.
  const fresh = await save();
  if ((fresh.raidProgress.gymsMet ?? []).length === 0) fail('the explorer run has met no gym leader');
  console.log(`leaders met: ${fresh.raidProgress.gymsMet.join(', ')}`);
  await walkTo({ x: BOARD.x, y: BOARD.y - 1 }, 'the board');
  await wait(300);
  await shoot('01-board-plate');
  await press('ArrowDown');
  await wait(150);
  await press('Space');
  await until(`!!document.querySelector('.playtest-board [data-board-row]')`, 'the PLAYTEST BOARD');
  await wait(300);
  await shoot('02-board');
  for (const row of ['game-pokemon-jump', 'game-berry-picking', 'game-field-course', 'game-prize-window']) {
    if (!(await page.evaluate(`!!document.querySelector('[data-board-row="${row}"]')`))) fail(`the board has no ${row}`);
  }

  // 2. BERRY PICKING and THE FIELD-MOVE COURSE straight from the board.
  await choose('game-berry-picking');
  await until(sceneIs('berry-picking'), 'BERRY PICKING');
  await wait(600);
  await shoot('03-berry-picking');
  await page.evaluate(`document.querySelector('[data-play]')?.click()`);
  await wait(4500);
  await shoot('03b-berry-picking-playing');
  await press('Escape');
  await wait(300);
  await press('Escape');
  await wait(300);
  await backToYard();
  await readBoard();
  await choose('game-field-course');
  await until(sceneIs('field-course'), 'THE FIELD-MOVE COURSE');
  await wait(600);
  await shoot('04-field-course');
  await page.evaluate(`document.querySelector('[data-play]')?.click()`);
  await wait(1200);
  await shoot('04b-field-course-start');
  await press('Escape');
  await wait(300);
  await press('Escape');
  await wait(300);
  await backToYard();

  // 3. POKéMON JUMP from the yard: no strip of harbour beside the screen.
  await readBoard();
  await choose('game-pokemon-jump');
  await until(`${sceneIs('game-corner')}`, 'POKéMON JUMP');
  await wait(400);
  await shoot('05-jump-from-yard');
  await press('Escape');
  await wait(300);
  await backToYard();

  // 4. B: storage a pocket at a time.
  await press('KeyB');
  await until(`!!document.querySelector('.things-menu [data-thing]')`, 'YOUR THINGS');
  await wait(400);
  await shoot('06-things');
  const pocketOf = () => page.evaluate(`document.activeElement?.dataset?.pocket ?? null`);
  const pockets = [await pocketOf()];
  for (let jump = 0; jump < 12; jump += 1) {
    await press('PageDown');
    await wait(100);
    const now = await pocketOf();
    if (now === pockets.at(-1)) break;
    pockets.push(now);
  }
  console.log(`pockets by Page Down: ${pockets.join(' > ')}`);
  if (pockets.length < 5) fail(`Page Down went through only ${pockets.length} pockets`);
  await shoot('07-things-last-pocket');
  await press('Home');
  await wait(100);
  if ((await pocketOf()) !== pockets[0]) fail('Home did not go back to the first pocket');
  // A disc read at home: the teach screen's cards and its help bar.
  while ((await pocketOf()) !== 'discs') {
    await press('PageDown');
    await wait(100);
  }
  await press('Enter');
  await until(`!!document.querySelector('.things-menu [data-pupil]')`, 'the teach screen');
  await wait(300);
  await press('Enter');
  await wait(300);
  await shoot('07b-teach-at-home');
  const help = await page.evaluate(`(() => { const h = [...document.querySelectorAll('.px-help')].at(-1); return h ? h.scrollHeight - h.clientHeight : null; })()`);
  console.log(`teach help bar overflow: ${help}px`);
  if (help === null || help > 2) fail(`the teach screen's help runs ${help}px past its bar`);
  await press('Escape');
  await wait(200);
  await press('Escape');
  await wait(300);
  await press('KeyB');
  await until(`!document.querySelector('.things-menu')`, 'YOUR THINGS closed');

  // 5. P: the list ends inside its window.
  await press('KeyP');
  await until(`!!document.querySelector('[data-member]')`, 'YOUR TEAM');
  await wait(400);
  await shoot('08-team');
  const overlap = await page.evaluate(`(() => {
    const list = document.querySelector('.team-menu .px-list, [data-member]')?.closest('.px-list');
    const help = [...document.querySelectorAll('.px-help')].at(-1);
    if (!list || !help) return null;
    return list.getBoundingClientRect().bottom - help.getBoundingClientRect().top;
  })()`);
  console.log(`team list bottom vs help bar top: ${overlap}`);
  if (overlap === null || overlap > 1) fail(`YOUR TEAM's list runs ${overlap}px under the help bar`);
  await press('KeyP');
  await wait(300);

  // 6. The Hauler frame from behind, at the Raid Arena's door.
  await choose_room('raid-arena');
  async function choose_room(room) {
    await readBoard();
    await choose(`room-${room}`);
    await until(`${baseReady} && ${BASE}.place.room?.room.id === '${room}'`, room);
    await wait(800);
  }
  await shoot('09-hall-arrive-from-behind');
  const hall = await page.evaluate(
    `(() => { const b = ${BASE}; return { leaders: (b.leadersHere ?? []).map((l) => l.gym.bossId), rival: b.rivalHere?.id ?? null }; })()`,
  );
  console.log(`hall: leaders waiting ${JSON.stringify(hall.leaders)}, rival on the floor ${hall.rival}`);
  if (hall.leaders.length === 0 && !hall.rival) fail('nobody waits on the far floor to spar');
  await backToYard();

  // 7. Night.
  await readBoard();
  await choose('hour-night');
  await until(baseReady, 'the yard at night');
  await wait(800);
  await shoot('10-night');
  console.log('ok');
} finally {
  await browser.close();
}
