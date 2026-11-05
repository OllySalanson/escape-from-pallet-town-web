// Plays THE PROMENADE and THE GAME CORNER end to end as a player meets them: a
// new game with a few jumpers in the vault walks from the spawn east past THE
// GREEN onto the promenade, into the Game Corner, picks its jumpers at the
// POKéMON JUMP cabinet and plays - jumping by the screen, as a person does,
// on what the game draws - wins tickets, walks out and next door to the PRIZE
// WINDOW and spends them on a berry. Every step is photographed.
//
//   node tools/playtest/gameCorner.mjs <url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures worth judging; `tools/playtest/README.md`, "Memory"). `--port`
// drives a browser that is already running rather than launching one.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`gameCorner: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
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
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // A save that has been on a raid, with three FAST jumpers in the vault beside
  // the partner: the Rattata the vale is full of, a Mankey and a Growlithe.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const first = save.stash.pokemon[0];
    for (const [index, species] of ['rattata', 'mankey', 'growlithe', 'bulbasaur'].entries()) {
      save.stash.pokemon.push({ ...first, id: species + '-' + (index + 7), pokemon: { ...first.pokemon, speciesId: species, nickname: null, moves: [], pendingMoves: [] } });
    }
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour, continued');
  const team = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash.pokemon.map((p) => p.pokemon.speciesId).join(',')`);
  console.log(`team: ${team}`);
  await shoot('01-spawn');

  // East along the yard, past THE GREEN, onto THE PROMENADE.
  const walkTo = async (goal, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      const move = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.ready || b.leaving || b.isWalking?.()) return { wait: true };
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
        return { key, steps: 0 }; })()`);
      if (move.unreachable) fail(`nothing walks to ${what}`);
      if (move.arrived) return;
      if (move.key) await press(move.key);
      await wait(120);
    }
    fail(`never reached ${what}`);
  };
  await walkTo({ x: 62, y: 14 }, 'the promenade');
  await wait(600);
  await shoot('02-promenade-arrives');
  await walkTo({ x: 76, y: 14 }, 'the Game Corner forecourt');
  await wait(400);
  await shoot('03-game-corner-front');
  await walkTo({ x: 80, y: 21 }, 'the pleasure pier');
  await wait(400);
  await shoot('04-beach-and-pier');
  await walkTo({ x: 80, y: 29 }, 'the pier head');
  await wait(400);
  await shoot('05-pier-head');

  // Into THE GAME CORNER, to the cabinet.
  await walkIntoBase(page, 'game-corner', { press, until, wait, settleMs: 150 });
  await until(sceneIs('game-corner'), 'the POKéMON JUMP cabinet');
  await wait(300);
  await shoot('06-who-jumps');
  // The three FAST jumpers are chosen for a first go; play.
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'countdown'`, 'the countdown');
  await wait(400);
  await shoot('07-countdown');
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'playing'`, 'the vine');

  // Play by what is on the screen, as a person does: jump when the vine is
  // coming down on the jumpers, a few frames before it reaches their feet.
  let shotMid = false;
  for (let frame = 0; frame < 60 * 120; frame += 1) {
    const state = await page.evaluate(`(() => { const j = ${GAME}.scene.getScene('game-corner').jumpGame; return j ? { over: j.over, state: j.vineState, timer: j.vineTimer, speed: j.vineSpeed, score: j.score, grounded: j.jumpers.every((p) => p.jumpStart === null) } : null; })()`);
    if (!state || state.over) break;
    // Down-swing nearing the bottom: about eight frames from the hit point.
    const toHit = (0x5ff - state.timer) / Math.max(1, state.speed);
    if (state.grounded && state.state >= 4 && state.state <= 5 && toHit < 9) {
      await page.keyDown('Space');
      await step(1);
      await page.keyUp('Space');
      continue;
    }
    if (!shotMid && state.score >= 1500) {
      shotMid = true;
      await page.screenshot(`${out}/08-jumping.png`);
      console.log('  08-jumping.png');
    }
    if (state.score >= 6600) {
      // Enough for the top tier and a berry: let the vine take them.
      for (let rest = 0; rest < 400; rest += 1) {
        await step(1);
        const over = await page.evaluate(`${GAME}.scene.getScene('game-corner').jumpGame?.over !== false`);
        if (over) break;
      }
      break;
    }
    await step(1);
  }
  await shoot('09-ouch');
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'menu'`, 'the result');
  await wait(300);
  await shoot('10-result');
  const corner = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.gameCorner`);
  console.log(`game corner: ${JSON.stringify(corner)}`);
  if (!corner || corner.tickets <= 0) fail('the game paid no tickets');

  // Out, and next door to the prize window.
  await press('Escape');
  await until(baseReady, 'the arcade again');
  await wait(300);
  await shoot('11-arcade');
  await walkIntoBase(page, 'prize-window', { press, until, wait, settleMs: 150 });
  await until(sceneIs('game-corner'), 'the prize window');
  await wait(400);
  await shoot('12-prize-window');
  const before = corner.tickets;
  await wait(600);
  await page.evaluate(`document.querySelector('[data-prize="sitrus-berry"]').click()`);
  await wait(200);
  await shoot('13-bought');
  const after = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  console.log(`tickets ${before} -> ${after.raidProgress.gameCorner.tickets}; sitrus in vault: ${after.stash.items['sitrus-berry'] ?? 0}`);
  if (after.raidProgress.gameCorner.tickets !== before - 20) fail('the berry did not cost 20 tickets');
  await press('Escape');
  await until(baseReady, 'the prize room');
  await shoot('14-prize-room');
  console.log('ok');
} finally {
  await browser.close();
}
