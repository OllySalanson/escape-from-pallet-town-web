// Plays THE PROMENADE DERBY's levels end to end, in order, as a player meets
// them: a save that has been on a raid with racers in the vault walks to the
// DERBY board, sees the courses with only THE FRONT open, races it, and each
// podium opens the next level - THE SANDS, THE BREAKWATER, THE GRAND DERBY -
// which is then raced in its turn. Each race is ridden as a person rides it:
// the quicker line at each fork, a sprint on the straights and into every crate
// and past every wave, eased off into the tight corners. Every step is
// photographed.
//
//   node tools/playtest/derbyLevels.mjs <url> <out dir> [--port=<cdp port>] [--window=1200x768]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures; `tools/playtest/README.md`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
/** Who races each level: a racer the course suits, and so one that can make the podium that opens the next. */
const RACERS = ['doduo', 'dugtrio', 'horsea', 'doduo'];
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`derbyLevels: ${why}`);
};

const port = option('port');
const [width, height] = option('window')?.split('x').map(Number) ?? [PIXEL_WINDOW.width, PIXEL_WINDOW.height];
const window = { width, height };
const browser = port ? attachBrowser(Number(port), { window }) : await launchBrowser({ window });
const report = [];
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
  const base = `${GAME}.scene.getScene('base')`;
  const derby = `${GAME}.scene.getScene('derby')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const first = save.stash.pokemon[0];
    for (const [index, species] of ${JSON.stringify([...new Set(RACERS)])}.entries()) {
      save.stash.pokemon.push({ ...first, id: species + '-' + (index + 7), pokemon: { ...first.pokemon, speciesId: species, level: 32, nickname: null, moves: [], pendingMoves: [] } });
    }
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour, continued');

  // To the DERBY board by the scene's own collision, and face it.
  const walkTo = async (goal) => {
    for (let guard = 0; guard < 400; guard += 1) {
      const move = await page.evaluate(`(() => { const b = ${base}; if (!b.ready || b.leaving || b.isWalking?.()) return { wait: true };
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
      if (move.unreachable) fail('nothing walks to the DERBY board');
      if (move.arrived) return;
      if (move.key) {
        await page.keyDown(move.key);
        await step(4);
        await page.keyUp(move.key);
      }
      await wait(120);
    }
    fail('never reached the DERBY board');
  };
  await walkTo({ x: 62, y: 12 });
  await press('ArrowUp');
  await wait(200);
  await press('Space');
  await until(sceneIs('derby'), 'the derby screen');
  await wait(300);
  await shoot('00-courses-first-visit');

  const save = async () => JSON.parse(await page.evaluate(`localStorage.getItem('${SAVE_KEY}')`));
  for (const [index, racer] of RACERS.entries()) {
    const number = index + 1;
    // The level has to be open, by the podium before it: the screen's own button.
    const open = await page.evaluate(`document.querySelector('[data-course-level="${number}"]')?.getAttribute('aria-disabled') !== 'true'`);
    if (!open) fail(`level ${number} is not open`);
    await page.evaluate(`document.querySelector('[data-course-level="${number}"]').click()`);
    await wait(200);
    await page.evaluate(`document.querySelector('[data-player-pick^="${racer}"]').click()`);
    await wait(200);
    if (number === 2) await shoot('01-choose-level-2');
    const chosen = await page.evaluate(`${derby}.derbyLevel`);
    if (chosen !== number) fail(`chose level ${number}, the screen has ${chosen}`);
    await page.evaluate(`document.querySelector('[data-play]').click()`);
    await until(`${derby}.isPlaying`, `level ${number} under way`);
    let shot = 0;
    let gridShot = false;
    let lastHazard = false;
    const surfShots = new Set();
    for (let frame = 0; frame < 60 * 150; frame += 1) {
      const state = await page.evaluate(`(() => { const s = ${derby}; const r = s.derbyRace; const a = s.derbyAhead; if (!r || !a) return null; const me = r.runners[0];
        return { clock: r.clock, stamina: me.stamina, done: me.finishedMs !== null, corner: a.corner, crate: a.crate, wave: a.wave, surf: a.surf, lines: a.lines, leg: me.leg }; })()`);
      if (!state || state.done) break;
      await page.evaluate(`${derby}.ride({ lines: ${JSON.stringify(state.lines)} })`);
      const hazard = state.crate < 1.2 || state.wave;
      const tap = state.clock > 2400 && (hazard ? state.stamina > 0 : state.stamina > 200 && state.corner > 1.6 && frame % 6 === 0);
      if (tap) {
        await page.keyDown('Space');
        await step(1);
        await page.keyUp('Space');
      }
      // Pictures through the race: at the start, a crate or a wave, and late on.
      const due = (shot === 0 && state.clock > 4000) || (shot === 1 && hazard && !lastHazard && state.clock > 6000) || (shot === 2 && state.leg >= 4);
      lastHazard = hazard;
      // A wave said, and a wave breaking, once each.
      if (state.surf && !surfShots.has(state.surf)) {
        surfShots.add(state.surf);
        await shoot(`level-${number}-wave-${state.surf}`);
      }
      // The field on the grid, before the gun: spread across the lane, the player's racer ringed.
      if (!gridShot && state.clock > 1500) {
        gridShot = true;
        await shoot(`level-${number}-grid`);
      }
      if (due) {
        shot += 1;
        await shoot(`level-${number}-racing-${shot}`);
      }
      await step(1);
    }
    await until(`!${derby}.isPlaying`, `level ${number} over`);
    await wait(300);
    const after = await save();
    const headline = await page.evaluate(`document.querySelector('.confirm-bar strong')?.textContent ?? ''`);
    await shoot(`level-${number}-result`);
    report.push({ level: number, racer, headline, cleared: after.raidProgress.derbyCleared ?? 0, best: after.raidProgress.gameCorner?.day?.best?.[number === 1 ? 'derby' : `derby-${number}`] ?? 0 });
    console.log(`level ${number} (${racer}): ${headline}; cleared ${after.raidProgress.derbyCleared ?? 0}`);
    if ((after.raidProgress.derbyCleared ?? 0) < number) fail(`level ${number} not cleared: ${headline}`);
  }
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
