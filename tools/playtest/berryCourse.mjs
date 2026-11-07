// Plays BERRY PICKING and THE FIELD-MOVE COURSE end to end as a player meets
// them: a save that has been on a raid, with a team in the vault, walks into
// THE GAME CORNER, up to the BERRY PICKING cabinet and plays it - reaching by
// what the screen shows, as a person does - then out onto THE PROMENADE to the
// course gate, talks to its keeper and runs the course on the quickest line
// the team has. Every step is photographed.
//
//   node tools/playtest/berryCourse.mjs <url> <out dir> [--team=suited|unsuited] [--port=<cdp port>]
//
// `suited` brings a Dodrio and a Krabby, the two the games are for;
// `unsuited` a Doduo, a Pikachu and a Pidgeotto, which can play and finish
// but not well. It steps a paused loop, so it wants a test-mode page
// (`?testmode=pixels` for pictures; `tools/playtest/README.md`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const teamKind = option('team') ?? 'suited';
const TEAMS = {
  suited: { vault: ['dodrio', 'krabby'], picker: 'dodrio', runners: ['krabby'] },
  unsuited: { vault: ['doduo', 'pikachu', 'pidgeotto'], picker: 'doduo', runners: ['pikachu', 'pidgeotto'] },
};
const team = TEAMS[teamKind];
if (!team) throw new Error(`berryCourse: no team '${teamKind}'`);
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`berryCourse: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
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
  const baseReady = `${sceneIs('base')} && ${base}.ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const first = save.stash.pokemon[0];
    for (const [index, species] of ${JSON.stringify(team.vault)}.entries()) {
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

  // A walk over the scene's own collision to a tile, in the yard or a room.
  const walkTo = async (goal, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      const move = await page.evaluate(`(() => { const b = ${base}; if (!b.ready || b.leaving || b.isWalking?.()) return { wait: true };
        const s = b.currentTile, g = ${JSON.stringify(goal)};
        if (s.x === g.x && s.y === g.y) return { arrived: true };
        const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || (b.isBlocked({ x: nx, y: ny }) && !(nx === g.x && ny === g.y && !c[ny][nx]))) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`);
      if (move.unreachable) fail(`nothing walks to ${what}`);
      if (move.arrived) return;
      if (move.key) {
        // A tap towards the partner only turns the player, so a tap that did
        // not move them is followed by the key held.
        const from = await page.evaluate(`JSON.stringify(${base}.currentTile)`);
        await press(move.key);
        await wait(120);
        if ((await page.evaluate(`JSON.stringify(${base}.currentTile)`)) === from) {
          await page.keyDown(move.key);
          await step(14);
          await page.keyUp(move.key);
        }
      }
      await wait(120);
    }
    await page.screenshot(`${out}/stuck.png`);
    fail(`never reached ${what} (at ${JSON.stringify(await page.evaluate(`${base}.currentTile`))})`);
  };
  const vault = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);

  // --- BERRY PICKING ---------------------------------------------------------
  // Into THE GAME CORNER (its mat opens POKéMON JUMP), back out of that screen
  // into the arcade, and up to the BERRY PICKING cabinet beside it.
  await walkIntoBase(page, 'game-corner', { press, until, wait, settleMs: 150 });
  await press('Escape');
  await until(baseReady, 'the arcade');
  await wait(300);
  await shoot(`${teamKind}-01-arcade`);
  // The cabinets stand in rows now (THE GAME CORNER comes alive): walk up to
  // the front of the first BERRY PICKING cabinet no regular is standing at.
  const berryFront = await page.evaluate(`(() => { const b = ${base};
    for (const x of [9, 10, 11, 12, 13, 14]) { const t = { x, y: 9 }; if (!b.isBlocked(t)) return t; }
    return null; })()`);
  if (!berryFront) fail('every BERRY PICKING cabinet has somebody at it');
  await walkTo(berryFront, 'the BERRY PICKING cabinet');
  await press('ArrowUp');
  await press('Space');
  await until(sceneIs('berry-picking'), 'the BERRY PICKING screen');
  await wait(300);
  await shoot(`${teamKind}-02-who-picks`);
  await page.evaluate(`document.querySelector('[data-picker^="${team.picker}"]').click()`);
  await wait(200);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('berry-picking').phaseKind === 'playing'`, 'the berries falling');

  // Reach by the screen, as a person does: for the berry lowest in the tree
  // that is low enough to eat (the two drops before the ground), reach over it.
  const KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
  let shotMid = false;
  for (let frame = 0; frame < 60 * 180; frame += 1) {
    const state = await page.evaluate(`(() => { const g = ${GAME}.scene.getScene('berry-picking').picking; if (!g) return null;
      return { over: g.over || g.ending, free: g.beak === 'free' && g.reach === null, side: g.side, heads: g.heads,
        cols: g.columns.map((b) => ({ fall: b.fall, state: b.state })), score: (g.eaten.blue * 10 + g.eaten.green * 30 + g.eaten.gold * 50) }; })()`);
    if (!state || state.over) break;
    if (state.free) {
      const ripe = state.cols
        .map((berry, column) => ({ column, fall: berry.fall, state: berry.state }))
        .filter((berry) => berry.state === 'falling' && berry.fall >= 6)
        .sort((a, b) => b.fall - a.fall)[0];
      if (ripe) {
        await page.keyDown(KEYS[ripe.column]);
        await step(1);
        await page.keyUp(KEYS[ripe.column]);
        continue;
      }
    }
    if (!shotMid && state.score >= 400) {
      shotMid = true;
      await page.screenshot(`${out}/${teamKind}-03-picking.png`);
      console.log(`  ${teamKind}-03-picking.png`);
    }
    await step(1);
  }
  await shoot(`${teamKind}-04-last-berries`);
  await until(`${GAME}.scene.getScene('berry-picking').phaseKind === 'menu'`, 'the result');
  await wait(300);
  await shoot(`${teamKind}-05-berry-result`);
  const afterBerries = (await vault()).raidProgress.gameCorner;
  console.log(`berry picking: best ${afterBerries?.best?.['berry-picking'] ?? 0}, tickets ${afterBerries?.tickets ?? 0}`);
  await press('Escape');
  await until(baseReady, 'the arcade again');
  await wait(300);
  await shoot(`${teamKind}-06-arcade-after`);

  // --- THE FIELD-MOVE COURSE -------------------------------------------------
  // Out of the arcade's door and east along the promenade to the course gate.
  const outside = `${base}.room === null || ${base}.room === undefined`;
  for (let guard = 0; guard < 40 && !(await page.evaluate(outside)); guard += 1) {
    const mat = await page.evaluate(`(() => { const r = ${base}.room; return r?.mat ?? null; })()`);
    if (mat) await walkTo(mat, 'the arcade mat');
    await press('ArrowDown');
    await wait(900);
  }
  await until(`${baseReady} && (${outside})`, 'the promenade');
  await walkTo({ x: 85, y: 10 }, 'the course gate');
  await press('ArrowUp');
  await wait(200);
  await shoot(`${teamKind}-07-course-gate`);
  await press('Space');
  for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('field-course'))); guard += 1) {
    await press('Space');
    await wait(200);
  }
  await until(sceneIs('field-course'), 'the course screen');
  await wait(300);
  await shoot(`${teamKind}-08-who-runs`);
  // The keeper picks a team first (whoever adds the most); set it to this one.
  const course = `${GAME}.scene.getScene('field-course')`;
  for (let guard = 0; guard < 8; guard += 1) {
    const chosen = await page.evaluate(`${course}.chosen.map((id) => id.replace(/-\\d+$/, ''))`);
    const extra = chosen.find((species) => !team.runners.includes(species));
    const missing = team.runners.find((species) => !chosen.includes(species));
    const click = extra ?? missing;
    if (!click) break;
    await page.evaluate(`document.querySelector('[data-runner^="${click}-"]').click()`);
    await wait(150);
  }
  await shoot(`${teamKind}-09-team-chosen`);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('field-course').phaseKind === 'running'`, 'the run');
  await wait(200);
  await shoot(`${teamKind}-10-start`);

  // The quickest line this team has, played a move at a time by the keys.
  const scene = `${GAME}.scene.getScene('field-course')`;
  const line = await page.evaluate(`${scene}.driverLine()`);
  const KEY_OF = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  console.log(`course line: ${line.length} moves, ${line.filter((move) => move.open).length} field moves`);
  let shots = 0;
  for (const [index, move] of line.entries()) {
    const before = await page.evaluate(`(() => { const r = ${scene}.courseRun; return { x: r.at.x, y: r.at.y, opened: r.opened.length }; })()`);
    if (move.open) {
      // Face it (a bump turns the runner), then the interact key.
      await page.keyDown(KEY_OF[move.way]);
      await step(1);
      await page.keyUp(KEY_OF[move.way]);
      await step(1);
      await press('Space');
      await until(`${scene}.courseRun.opened.length > ${before.opened} && ${scene}.courseRun.busyMs === 0`, `field move ${index}`);
      if (shots < 4) {
        shots += 1;
        await shoot(`${teamKind}-11-field-move-${shots}`);
      }
      continue;
    }
    await page.keyDown(KEY_OF[move.way]);
    for (let guard = 0; guard < 60; guard += 1) {
      await step(1);
      const moved = await page.evaluate(`(() => { const r = ${scene}.courseRun; return !r || r.finished || r.at.x !== ${before.x} || r.at.y !== ${before.y}; })()`);
      if (moved) break;
    }
    await page.keyUp(KEY_OF[move.way]);
    for (let guard = 0; guard < 30; guard += 1) {
      const settled = await page.evaluate(`(() => { const r = ${scene}.courseRun; return !r || r.finished || r.step === null; })()`);
      if (settled) break;
      await step(1);
    }
    if (index === Math.floor(line.length / 2)) await shoot(`${teamKind}-12-halfway`);
  }
  await shoot(`${teamKind}-13-finish`);
  await until(`${scene}.phaseKind === 'menu'`, 'the course result');
  await wait(300);
  await shoot(`${teamKind}-14-course-result`);
  const afterCourse = (await vault()).raidProgress.gameCorner;
  console.log(`course: best ${afterCourse?.best?.['field-course'] ?? 0} ms, tickets ${afterCourse?.tickets ?? 0}`);
  if (!afterCourse?.best?.['field-course']) fail('the course wrote no time');
  await press('Escape');
  await until(baseReady, 'the promenade again');
  await walkTo({ x: 83, y: 9 }, 'the time board');
  await press('ArrowUp');
  await press('Space');
  await wait(1500);
  await shoot(`${teamKind}-15-time-board`);
  console.log('ok');
} finally {
  await browser.close();
}
