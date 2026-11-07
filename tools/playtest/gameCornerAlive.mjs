// Plays THE GAME CORNER as an arcade (`src/game/minigames/arcade.ts`): a save
// that has been on a raid, with three FAST jumpers beside the partner, walks
// in through the door and looks - two rows of cabinets, the lamps on each dark,
// the HIGH SCORES board with only the regulars on it, whoever is playing -
// reads the board, speaks to a regular, plays POKéMON JUMP at a free cabinet
// to the top tier, and comes back out into the arcade to see the score it just
// made on the board in gold and the three lamps lit on every JUMP cabinet.
//
//   node tools/playtest/gameCornerAlive.mjs <url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures worth judging, on a build: `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`gameCornerAlive: ${why}`);
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
  const base = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;
  const saying = `Boolean(${base}.dialogBox?.visible)`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // A save that has been on a raid, with three FAST jumpers in the vault.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const first = save.stash.pokemon[0];
    for (const [index, species] of ['rattata', 'mankey', 'krabby'].entries()) {
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

  /** Walk over the scene's own collision to a goal tile (or onto a door). */
  const walkTo = async (goal, what) => {
    for (let guard = 0; guard < 500; guard += 1) {
      const move = await page.evaluate(`(() => { const b = ${base}; if (!b.ready || b.leaving || b.isWalking?.()) return { wait: true };
        const s = b.currentTile, g = ${JSON.stringify(goal)};
        if (s.x === g.x && s.y === g.y) return { arrived: true };
        const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
            if (!(nx === g.x && ny === g.y) && b.isBlocked({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`);
      if (move.unreachable) fail(`nothing walks to ${what}`);
      if (move.arrived) return;
      if (move.key) await press(move.key);
      await wait(120);
      if (await page.evaluate(`${base}.room?.id === 'game-corner' && ${JSON.stringify(what)} === 'the Game Corner door'`)) return;
    }
    fail(`never reached ${what}`);
  };
  const readThrough = async () => {
    for (let guard = 0; guard < 30 && (await page.evaluate(saying)); guard += 1) {
      await press('Space');
      await wait(250);
    }
  };

  // In through the door.
  const door = await page.evaluate(`${base}.doors.find((each) => each.id === 'game-corner').tiles[0]`);
  await walkTo(door, 'the Game Corner door');
  await until(`${baseReady} && ${base}.room?.id === 'game-corner'`, 'the arcade');
  await wait(600);
  const crowd = await page.evaluate(`${base}.place.room.people?.map((p) => p.id + '@' + p.tile.x + ',' + p.tile.y).join(' ') ?? ''`);
  console.log(`at the cabinets: ${crowd || 'nobody'}`);
  await shoot('01-arcade');

  // The HIGH SCORES board, read from the floor in front of it.
  await walkTo({ x: 12, y: 3 }, 'the board');
  await press('ArrowUp');
  await press('Space');
  await wait(1500);
  await shoot('02-board-read');
  const boardLines = await page.evaluate(`${base}.place.room.things.find((t) => t.name === 'HIGH SCORES').lines.join(' | ')`);
  console.log(`board: ${boardLines}`);
  await readThrough();

  // Somebody at a cabinet, spoken to from beside them.
  const person = await page.evaluate(`${base}.place.room.people?.[0] ?? null`);
  if (person) {
    const sides = [[-1, 0, 'ArrowRight'], [1, 0, 'ArrowLeft'], [0, 1, 'ArrowUp']];
    const free = await page.evaluate(`(() => { const b = ${base}; const p = ${JSON.stringify(person.tile)};
      for (const [dx, dy, k] of ${JSON.stringify(sides)}) { const t = { x: p.x + dx, y: p.y + dy }; if (b.collision[t.y]?.[t.x] === false) return { t, k }; } return null; })()`);
    if (free) {
      await walkTo(free.t, 'beside a regular');
      await press(free.k);
      await press('Space');
      await wait(1500);
      await shoot('03-regular');
      await readThrough();
    }
  }

  // A free POKéMON JUMP cabinet, and a game to the top tier.
  const front = await page.evaluate(`(() => { const b = ${base};
    return b.place.room.things.filter((t) => t.opens === 'pokemon-jump').flatMap((t) => t.tiles.filter((tile) => !t.tiles.some((o) => o.x === tile.x && o.y === tile.y + 1)))
      .map((tile) => ({ x: tile.x, y: tile.y + 1 })).find((tile) => !b.collision[tile.y][tile.x]); })()`);
  if (!front) fail('no free POKéMON JUMP cabinet');
  await walkTo(front, 'a free JUMP cabinet');
  await press('ArrowUp');
  await press('Space');
  await until(sceneIs('game-corner'), 'the POKéMON JUMP cabinet');
  await wait(300);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'playing'`, 'the vine');
  for (let frame = 0; frame < 60 * 150; frame += 1) {
    const state = await page.evaluate(`(() => { const j = ${GAME}.scene.getScene('game-corner').jumpGame; return j ? { over: j.over, state: j.vineState, timer: j.vineTimer, speed: j.vineSpeed, score: j.score, grounded: j.jumpers.every((p) => p.jumpStart === null) } : null; })()`);
    if (!state || state.over) break;
    const toHit = (0x5ff - state.timer) / Math.max(1, state.speed);
    if (state.grounded && state.state >= 4 && state.state <= 5 && toHit < 9) {
      await page.keyDown('Space');
      await step(1);
      await page.keyUp('Space');
      continue;
    }
    if (state.score >= 6600) {
      for (let rest = 0; rest < 400; rest += 1) {
        await step(1);
        if (await page.evaluate(`${GAME}.scene.getScene('game-corner').jumpGame?.over !== false`)) break;
      }
      break;
    }
    await step(1);
  }
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'menu'`, 'the result');
  const corner = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.gameCorner`);
  console.log(`game corner: ${JSON.stringify(corner)}`);
  if (!corner || (corner.day?.paid?.['pokemon-jump'] ?? 0) <= 0) fail('the game paid nothing');

  // Back out into the arcade: the board and the lamps say what just happened.
  await press('Escape');
  await until(`${baseReady} && ${base}.room?.id === 'game-corner'`, 'the arcade again');
  await wait(400);
  await shoot('04-arcade-after');
  await walkTo({ x: 12, y: 3 }, 'the board again');
  await press('ArrowUp');
  await press('Space');
  await wait(1500);
  await shoot('05-board-after');
  const after = await page.evaluate(`${base}.place.room.things.find((t) => t.name === 'HIGH SCORES').lines`);
  console.log(`board after: ${after.join(' | ')}`);
  if (!after.some((line) => line.startsWith('JUMP:') && line.includes('YOU'))) fail('the score just made is not on the board');
  const note = await page.evaluate(`${base}.place.room.things.find((t) => t.opens === 'pokemon-jump').note`);
  console.log(`cabinet note: ${note}`);
  if (!/paid/.test(note)) fail('the cabinet does not say what it paid');
  console.log('ok');
} finally {
  await browser.close();
}
