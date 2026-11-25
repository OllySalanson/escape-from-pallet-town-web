// Walks THE RAID ARENA's tunnel in and pushes its great doors, as a player does,
// and photographs every beat of it.
//
//   node tools/playtest/arenaDoors.mjs <url> <out-dir> [--window=1200x768] [--port=N] [--still]
//
// A new game crosses the harbour, skips the trailer and stands on the hall's mat,
// and from there it asks: the doors are shut from the harbour side; walking up the
// runner stops in front of them and pushes them, and they swing on the scene's own
// clock and then let the same held key walk on through, under the wall, on to the
// oval and up to the rail; walking back out of the hall and in again finds them
// shut; SPACE at them pushes them too; and a panel opened at a station leaves them
// as they were. `--still` asks for reduced motion, where a push opens them at once.
// It photographs the tunnel from the mat, the doors mid-swing, the way through, the
// doors from the oval and the room at the tunnel's end. Exit code 1 is anything not
// where it should be.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'arena-doors-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const still = args.includes('--still');
const address = `${url}?testmode=pixels`;
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  if (still) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
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
  const tile = () => base('({ ...b.currentTile })');
  const doors = () => base('({ open: b.hallDoors?.open ?? null, swinging: b.hallDoors?.swinging ?? null })');
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && b.room?.id === 'raid-arena'; })()`;
  const inHarbour = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && !b.room; })()`;

  /** A key held on stepped 60fps frames until the player has stood still a while, or `stop` says so: where they got to. */
  const hold = async (direction, stop = () => false) => {
    await page.keyDown(KEY[direction]);
    let last = await tile();
    let stillFor = 0;
    for (let frame = 0; frame < 2400 && stillFor < 45; frame += 1) {
      await frames(1);
      const at = await tile();
      if (await stop(at)) break;
      stillFor = at.x === last.x && at.y === last.y ? stillFor + 1 : 0;
      last = at;
    }
    await page.keyUp(KEY[direction]);
    for (let guard = 0; guard < 40 && (await base('Boolean(b.targetTile)')); guard += 1) await frames(1);
    return tile();
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.('charmander') === true`, 'the starter table');
  await step(1000);

  const towardsHallDoor = () =>
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
  const intoTheHall = async () => {
    for (let guard = 0; guard < 160 && !(await page.evaluate(inHall)); guard += 1) {
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
      const key = await towardsHallDoor();
      if (key) await press(key);
      await step(200);
    }
    await until(inHall, 'the great hall');
    await step(600);
  };

  await intoTheHall();
  const facts = await base('({ mat: b.room.mat, doorStep: b.arenaDoorStep, rail: b.arenaRim.filter((t) => t.x === b.room.mat.x).reduce((a, c) => (a.y > c.y ? a : c)) })');
  expect('the hall opens with the player on the mat', JSON.stringify(await tile()) === JSON.stringify(facts.mat));
  expect('the great doors are shut to somebody in from the harbour', (await doors()).open === false);
  await shot('tunnel-from-the-mat');

  // Up the runner: the held key stops at the doors and pushes them.
  let swingSeen = false;
  const atDoors = await hold('up', async (at) => {
    if (at.y === facts.doorStep.y && !swingSeen && (await doors()).swinging) {
      swingSeen = true;
      await frames(still ? 1 : 12);
      await shot('doors-swinging');
      return true;
    }
    return false;
  });
  expect('a held key up the tunnel stops in front of the doors', atDoors.y === facts.doorStep.y && atDoors.x === facts.mat.x);
  expect(still ? 'reduced motion opens them at once' : 'walking into them pushes them, and they swing', still ? (await doors()).open : swingSeen);
  await step(1000);
  expect('they come to rest open', (await doors()).open === true);
  await step(2000);
  await shot('doors-open');

  // On through, under the wall, and up the runner to the rail on the same key.
  const throughFrames = [];
  const atRail = await hold('up', async (at) => {
    if (at.y < facts.doorStep.y && at.y >= facts.doorStep.y - 4 && !throughFrames.includes(at.y)) {
      throughFrames.push(at.y);
      await shot(`through-the-doors-row-${at.y}`);
    }
    return false;
  });
  expect('the held key goes on through the open doors to the rail', atRail.y === facts.rail.y && atRail.x === facts.rail.x);

  // Looking back at the doors from the oval: walk down a few steps and photograph.
  await press('ArrowDown');
  for (let i = 0; i < 4; i += 1) await press('ArrowDown');
  await step(1500);
  await shot('doors-from-the-oval');

  // A panel at a station leaves them as they were.
  await hold('down', async (at) => at.y >= facts.doorStep.y + 1);
  await hold('left');
  await press('ArrowUp');
  await press('Space');
  await until(sceneIs('hub'), 'the bench');
  await step(600);
  await shot('at-the-bench');
  await press('Escape');
  await until(`!${sceneIs('hub')}`, 'the hall again');
  await step(400);
  expect('a panel opened at a station leaves the doors open', (await doors()).open === true);
  await shot('room-at-the-tunnels-end');

  // Out by the mat, and back in: shut again.
  await hold('right', async (at) => at.x === facts.mat.x);
  await hold('down');
  await press('ArrowDown');
  await until(inHarbour, 'the harbour');
  await step(600);
  await intoTheHall();
  expect('back in from the harbour, the doors are shut again', (await doors()).open === false);

  // SPACE at them pushes them as well: up to them by a tap at a time, so nothing walks into them first.
  await hold('up', async (at) => at.y === facts.doorStep.y + 2);
  await step(300);
  await press('ArrowUp');
  await step(300);
  expect('a tap up to the doors only stands the player in front of them', (await doors()).open === false && JSON.stringify(await tile()) === JSON.stringify(facts.doorStep));
  expect('the hint at the doors names the push', String(await base('b.hintShown')).includes('PUSH THE DOORS'));
  await press('Space');
  await step(1500);
  expect('SPACE at the doors pushes them open', (await doors()).open === true);
} catch (error) {
  faults.push(String(error?.stack ?? error));
  console.error(error);
} finally {
  await browser.close();
}
if (faults.length) {
  console.log(`\n${faults.length} fault(s)`);
  process.exit(1);
}
