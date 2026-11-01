// Walks THE RAID ARENA's great hall the way a person does, by arrow keys only, and
// counts what the walk cost: from the door to everything a player needs in the
// room, and back, with how many times the key changed, how many times the player
// stopped against something, and how many tiles it took.
//
//   node tools/playtest/arenaFlow.mjs <url> <out-dir> [--port=N] [--veteran] [--shots] [--holds] [--window=400x256]
//
// The person knows where they are going and nothing else. They hold the key that
// takes them nearer until something stops them or they have gone far enough, then
// change to the other key that takes them nearer; if neither moves them they
// sidestep. It presses real keys into the real scene on stepped 60fps frames, so
// what it counts is what the game does. `--veteran` plays a save with raids behind
// it and the rival on the far floor; `--holds` goes round the hall on one held key a
// side instead. `--shots` photographs it, on a heavier page. Exit code 1 is a route
// that never arrived.
import { mkdirSync, writeFileSync } from 'node:fs';
import { LOGIC_WINDOW, PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'arena-flow-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? (args.includes('--shots') ? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}` : `${LOGIC_WINDOW.width}x${LOGIC_WINDOW.height}`)).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const veteran = args.includes('--veteran');
const shots = args.includes('--shots');
const address = `${url}?testmode=${shots ? 'pixels' : '1'}`;
const STEP_FRAMES = 10;
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
let failed = false;
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 90000 });
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)})`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 90000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (ms, frame = 100) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / frame))}, ${frame})`);
  const frames = (count) => page.evaluate(`${GAME}.stepFrames(${count}, 1000 / 60)`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.tap(code, 0);
    await step(200);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.('charmander') === true`, 'the starter table');
  await step(1000);
  if (veteran) {
    await page.evaluate(`(() => {
      const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
      const progress = save.raidProgress;
      progress.arenaIntroSeen = true;
      progress.firstWordsHeard = ['lab', 'loadout', 'center', 'workshop', 'cottage'];
      progress.raidRecord = { 'greystone-vale': { deployed: 40, extracted: 30, wiped: 10 } };
      localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(save));
    })()`);
    await page.send('Page.navigate', { url: address });
    await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 90000 });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(sceneIs('base'), 'the harbour');
    await step(1000);
  }

  // Through the Arena's door and past the reel, however the driver gets there.
  const towardsDoor = () =>
    base(`(() => { if (!b.sys.isActive() || !b.ready || b.leaving) return null;
      const goals = b.doors.find((each) => each.id === 'raid-arena').tiles;
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return key; })()`);
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'; })()`;
  for (let guard = 0; guard < 120 && !(await page.evaluate(inHall)); guard += 1) {
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await step(700);
      await press('Escape');
      await step(400);
      continue;
    }
    if (await base('b.dialogBox?.visible')) {
      await press('Space');
      continue;
    }
    const key = await towardsDoor();
    if (key) await press(key);
    await step(200);
  }
  await until(inHall, 'the great hall');
  await step(600);
  if (shots) await page.screenshot(`${out}/from-the-door.png`);

  const rest = async () => {
    for (let guard = 0; guard < 40 && (await base('Boolean(b.targetTile)')); guard += 1) await frames(1);
  };
  const tile = () => base('({ ...b.currentTile })');
  const sidestep = (goal) =>
    base(`(() => { const goal = ${JSON.stringify(goal)}; const s = b.currentTile, id = (x, y) => y * 200 + x;
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (x === goal.x && y === goal.y) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'up'],[0,1,'down'],[-1,0,'left'],[1,0,'right']]) { const nx = x + dx, ny = y + dy;
          if (prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return key; })()`);
  /**
   * One step of a held key: down until the step has begun, then up, or a stepped
   * frame carries the walk on past the tile a person would change key on. What it
   * returns is whether anything moved.
   */
  const stepHolding = async (direction) => {
    await page.keyDown(KEY[direction]);
    let moved = false;
    for (let frame = 0; frame < 12 && !moved; frame += 1) {
      await frames(1);
      moved = await base('Boolean(b.targetTile)');
    }
    await page.keyUp(KEY[direction]);
    await rest();
    await frames(1);
    return moved;
  };
  /** The player's own walk from where they stand to a tile, by held keys, counted. */
  const walk = async (goal) => {
    const counts = { keys: 0, stops: 0, tiles: 0 };
    let held = null;
    // Once something has stopped them they look where they are going for a while.
    let wary = 0;
    const take = async (direction) => {
      if (direction !== held) {
        counts.keys += 1;
        held = direction;
      }
      return stepHolding(direction);
    };
    for (let guard = 0; guard < 400; guard += 1) {
      const at = await tile();
      if (at.x === goal.x && at.y === goal.y) {
        return counts;
      }
      const across = goal.x - at.x;
      const down = goal.y - at.y;
      const wanted = [];
      if (across !== 0) wanted.push(across > 0 ? 'right' : 'left');
      if (down !== 0) wanted.push(down > 0 ? 'down' : 'up');
      // The longer way first; the key already held for as long as it still helps.
      if (Math.abs(down) > Math.abs(across)) wanted.reverse();
      // They can see what stands by the door: anything past it is up the runner first.
      if (at.y >= 56 && goal.y < 56 && !wanted[0].includes('up') && wanted.includes('up')) wanted.reverse();
      if (held && wanted.includes(held)) wanted.unshift(held);
      const open = (direction) => base(`!b.isBlocked({ x: ${at.x + DELTA[direction][0]}, y: ${at.y + DELTA[direction][1]} })`);
      let next = wanted[0];
      if (wary > 0) {
        wary -= 1;
        next = null;
        for (const direction of wanted) {
          if (await open(direction)) {
            next = direction;
            break;
          }
        }
        next ??= held && (await open(held)) && !wanted.length ? held : await sidestep(goal);
      }
      if (!next) throw new Error(`stuck at ${JSON.stringify(at)} going to ${JSON.stringify(goal)}`);
      if (await take(next)) {
        counts.tiles += 1;
        continue;
      }
      counts.stops += 1;
      wary = 16;
    }
    throw new Error(`never reached ${JSON.stringify(goal)}`);
  };

  const facts = await base(`({
    mat: b.room.mat,
    stations: b.arenaStations.map((station) => ({ id: station.id, tiles: station.tiles })),
    things: b.place.room.things.filter((thing) => thing.opens === 'telescope').map((thing) => thing.tiles[0]),
    plates: (b.arenaTelescopes ?? []).map((telescope) => telescope.stance),
    rail: b.arenaRim.filter((tile) => tile.x === b.room.mat.x).reduce((a, c) => (a.y > c.y ? a : c)),
  })`);
  const stanceOf = (tile) =>
    facts.plates.find((plate) => Math.abs(plate.x - tile.x) + Math.abs(plate.y - tile.y) === 1) ?? { x: tile.x + (tile.x < facts.mat.x ? -1 : 1), y: tile.y };
  const middle = (tiles) => tiles[Math.floor(tiles.length / 2)];
  const places = [
    ...facts.stations.map((station) => [station.id, { x: middle(station.tiles).x, y: middle(station.tiles).y + 1 }]),
    ...facts.things.map((telescope) => [`telescope ${telescope.x < 35 ? 'west' : 'east'}`, stanceOf(telescope)]),
    ['rail, in front of the door', facts.rail],
  ];
  const results = [];
  if (args.includes('--holds')) {
    /** One key held down on stepped 60fps frames until the player has stood still for a while. */
    const holdDown = async (direction) => {
      const from = await tile();
      await page.keyDown(KEY[direction]);
      let last = from;
      let tiles = 0;
      let still = 0;
      for (let frame = 0; frame < 2400 && still < 30; frame += 1) {
        await frames(1);
        const at = await tile();
        if (at.x === last.x && at.y === last.y) {
          still += 1;
        } else {
          tiles += 1;
          still = 0;
          last = at;
        }
      }
      await page.keyUp(KEY[direction]);
      await rest();
      console.log(`held ${direction.padEnd(5)} from ${from.x},${from.y} to ${last.x},${last.y}: ${tiles} tiles`);
      if (shots) await page.screenshot(`${out}/held-${direction}-to-${last.x}-${last.y}.png`);
      return last;
    };
    for (const direction of ['up', 'right', 'up', 'left', 'down', 'right', 'down']) {
      await holdDown(direction);
    }
    places.length = 0;
  }
  for (const [name, goal] of places) {
    const there = await walk(goal);
    if (shots) await page.screenshot(`${out}/at-${name.replaceAll(' ', '-').replaceAll(',', '')}.png`);
    const back = await walk(facts.mat);
    results.push({ name, goal, there, back });
    console.log(`${name.padEnd(28)} there: ${there.keys} keys, ${there.stops} stops, ${there.tiles} tiles   back: ${back.keys} keys, ${back.stops} stops, ${back.tiles} tiles`);
    await step(200);
  }
  writeFileSync(`${out}/counts.json`, JSON.stringify(results, null, 2));
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
