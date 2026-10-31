// Walks THE RAID ARENA's wide east and west floors watching the camera, then plays
// a brass telescope as a player does, by keys and by mouse.
//
//   node tools/playtest/arenaTelescope.mjs <dev-url> <out-dir> [--window=1200x768] [--port=N] [--new] [--still]
//
// `--new` plays a save that has walked nothing, with the one way in a new game has;
// otherwise the save holds every way in on the vale, some walked ground and a few
// raids' marks. It is pointed at the dev server, because it imports the game's own
// map to lay that ground. `--still` asks for reduced motion: no round of the glass
// opening, no cloud moving and nothing crossing. Exit code 1 is anything not where
// it should be.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';
import { readPng } from '../tileset/tileSheet.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'arena-telescope-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const brandNew = args.includes('--new');
const still = args.includes('--still');
const address = `${url}?testmode=pixels`;
/** The fastest the camera may turn, in game pixels a 60fps frame: `cameraEased`'s own limit, and a little for a step begun in the frame. */
const CALM_PER_FRAME = 4.5;

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
  const shot = (name) => page.screenshot(`${out}/${name}.png`);

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.('charmander') === true`, 'the starter table');
  await step(1000);

  if (!brandNew) {
    // Every way in, some ground walked round the middle of the vale, and what a few raids left.
    await page.evaluate(`(async () => {
      const { getWorldMap } = await import('/src/game/worldMap.ts');
      const { runInsertions } = await import('/src/game/run/runGeneration.ts');
      const map = getWorldMap('greystone-vale');
      const bytes = new Uint8Array(Math.ceil((map.width * map.height) / 8));
      for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
        const near = Math.hypot(x - 190, y - 215) < 92 || Math.hypot(x - 110, y - 120) < 40 || Math.hypot(x - 280, y - 110) < 34;
        if (near) bytes[Math.floor((y * map.width + x) / 8)] |= 1 << ((y * map.width + x) % 8);
      }
      const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
      const progress = save.raidProgress;
      progress.surveyed = { ...(progress.surveyed ?? {}), 'greystone-vale': { width: map.width, tiles: btoa(String.fromCharCode(...bytes)) } };
      progress.reachedInsertions = runInsertions().filter((each) => each.mapId === 'greystone-vale').map((each) => each.id);
      progress.raidMemory = {
        marks: [
          { mapId: 'greystone-vale', x: 196, y: 240, kind: 'out', line: 'Out by the Mill Stair, with 14 squares' },
          { mapId: 'greystone-vale', x: 118, y: 128, kind: 'fell', line: 'Blue caught you here' },
          { mapId: 'greystone-vale', x: 262, y: 170, kind: 'out', line: 'Out with the clock red' },
        ],
        trail: { mapId: 'greystone-vale', points: Array.from({ length: 50 }, (_each, at) => [150 + at * 2, 190 + Math.round(Math.sin(at / 6) * 18)]).flat() },
      };
      localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(save));
    })()`);
    await page.send('Page.navigate', { url: address });
    await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 90000 });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(sceneIs('base'), 'the harbour');
    await step(1000);
  }

  const keyTowards = (goals) =>
    page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving) return null;
      const goals = ${JSON.stringify(goals)} ?? b.doors.find((each) => each.id === 'raid-arena').tiles;
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      if (at(s.x, s.y)) return 'there';
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
  for (let guard = 0; guard < 80 && !(await page.evaluate(inHall)); guard += 1) {
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await step(700);
      await press('Escape');
      await step(400);
      continue;
    }
    const key = await keyTowards(null);
    if (key && key !== 'there') await press(key);
    await step(200);
  }
  await until(inHall, 'the great hall');
  await step(500);

  // --- the camera, walked on 60fps frames --------------------------------------
  const frames = (count) =>
    page.evaluate(`(() => { const g = ${GAME}; const b = g.scene.getScene('base'); const c = b.cameras.main; const seen = [];
      for (let at = 0; at < ${count}; at += 1) { g.stepFrames(1, 1000 / 60); seen.push([c.scrollX, c.scrollY, b.player.x, b.player.y]); }
      return seen; })()`);
  const log = [];
  const walkWatching = async (goal) => {
    for (let guard = 0; guard < 240; guard += 1) {
      const key = await keyTowards([goal]);
      if (key === 'there') return true;
      if (!key) {
        await frames(6);
        continue;
      }
      await page.keyDown(key);
      log.push(...(await frames(2)));
      await page.keyUp(key);
      log.push(...(await frames(9)));
    }
    return false;
  };
  /** How much of the screen is the pure black of nothing being drawn there, in the canvas. */
  const blackShare = async (name) => {
    await shot(name);
    const { width, height, data } = readPng(`${out}/${name}.png`);
    let black = 0;
    for (let at = 0; at < width * height; at += 1) {
      if (data[at * 4] === 0 && data[at * 4 + 1] === 0 && data[at * 4 + 2] === 0) black += 1;
    }
    return black / (width * height);
  };
  const telescopes = await base(`b.place.room.things.filter((each) => each.opens === 'telescope').map((each) => ({ ...each.tiles[0] }))`);
  const [west, east] = telescopes;
  const middle = (west.x + east.x) / 2;
  const row = west.y;
  const solid = await base('b.collision');
  const wallSide = (from, way) => {
    let x = from;
    while (solid[row]?.[x + way] === false || solid[row]?.[x + way * 2] === false) x += way;
    return solid[row]?.[x] === false ? x : x - way;
  };
  const eastWall = wallSide(east.x + 1, 1);
  const westWall = wallSide(west.x - 1, -1);
  console.log(`east floor: ${eastWall - east.x} tiles from the telescope to the wall`);
  expect('there is real room to walk beside the pit, east and west', eastWall - east.x >= 7 && west.x - westWall >= 7);
  // The hall has no black beyond its own doorway: what is measured is the walks either side.
  for (const [name, goal] of [
    ['camera-east-rail', { x: east.x + 1, y: row + 1 }],
    ['camera-east-wall', { x: eastWall, y: row + 1 }],
    ['camera-north-east', { x: Math.round(middle + (eastWall - middle) * 0.7), y: row - 15 }],
    ['camera-north-wall', { x: middle + 2, y: 8 }],
    ['camera-west-wall', { x: westWall, y: row + 1 }],
    ['camera-west-rail', { x: west.x - 1, y: row + 1 }],
  ]) {
    await walkWatching(goal);
    log.push(...(await frames(30)));
    const black = await blackShare(name);
    expect(`no black past the hall at ${name} (${(black * 100).toFixed(2)}%)`, black < 0.002);
  }
  let fastest = 0;
  for (let at = 1; at < log.length; at += 1) {
    const camera = Math.hypot(log[at][0] - log[at - 1][0] - (log[at][2] - log[at - 1][2]), log[at][1] - log[at - 1][1] - (log[at][3] - log[at - 1][3]));
    fastest = Math.max(fastest, camera);
  }
  console.log(`fastest the view moved against the player: ${fastest.toFixed(1)} px a frame`);
  // With reduced motion a look somewhere else is a cut, which is what was asked for.
  expect('the camera follows calmly: no jump anywhere round the ring', still || fastest <= CALM_PER_FRAME);

  // --- the telescope ------------------------------------------------------------
  const walk = async (goal) => {
    for (let guard = 0; guard < 240; guard += 1) {
      const key = await keyTowards([goal]);
      if (key === 'there') return true;
      if (!key) {
        await step(100);
        continue;
      }
      await page.tap(key, 0);
      await step(170);
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) await step(100);
    }
    return false;
  };
  const state = () =>
    base(`(() => { const t = b.telescope; if (!t) return null; const r = t.rules;
      return { open: t.isOpen, zoom: r.zoom, level: r.level, canPan: r.canPan, rect: r.mapRect(), way: t.wayIn?.id ?? null, wings: t.wingsCrossing }; })()`);
  await walk({ x: east.x + 1, y: east.y });
  await step(400);
  await shot('at-the-telescope');
  expect('the hint names it', (await base('b.hintShown')) === '[SPACE] LOOK THROUGH THE TELESCOPE');
  await press('Space');
  await step(60);
  await shot('eye-to-the-glass');
  await until(`${GAME}.scene.getScene('base').telescope?.isOpen === true`, 'the glass');
  await step(200);
  await shot('whole-vale');
  const whole = await state();
  const size = await base('({ width: b.scale.width, height: b.scale.height })');
  expect('it opens on the whole map, all of it on the screen', whole.level === 0 && whole.rect.left >= 0 && whole.rect.right <= size.width && whole.rect.top >= 0 && whole.rect.bottom <= size.height - 18);
  expect('with nothing to pan to yet', !whole.canPan);
  if (still) {
    await step(3000);
    expect('nothing crosses it with reduced motion', !(await state()).wings);
  } else {
    for (let guard = 0; guard < 80 && !(await state()).wings; guard += 1) await step(200);
    // It comes out from behind the frame a few seconds into a crossing.
    await step(7000);
    expect('the wings cross it', (await state()).wings);
    await shot('whole-vale-wings');
  }

  await press('KeyZ');
  await step(700);
  const closer = await state();
  expect('Z goes closer', closer.level === 1 && closer.zoom === 1);
  await press('KeyZ');
  await step(700);
  const closest = await state();
  expect('and closer again', closest.level === 2 && closest.zoom === 2);
  await shot('closest');
  for (const [key, axis, sign] of [
    ['KeyD', 'left', -1],
    ['ArrowLeft', 'left', 1],
    ['KeyS', 'top', -1],
    ['ArrowUp', 'top', 1],
  ]) {
    const before = (await state()).rect[axis];
    await page.keyDown(key);
    await step(500);
    await page.keyUp(key);
    await step(400);
    const after = (await state()).rect[axis];
    expect(`${key} pans it`, Math.sign(after - before) === sign);
  }
  // Held against the edge, it stops there.
  await page.keyDown('KeyA');
  await step(6000);
  await page.keyUp('KeyA');
  await step(400);
  const atEdge = await state();
  expect('panning stops at the edge of the map', atEdge.rect.left === 0);
  await shot('stopped-at-the-west-edge');

  // By mouse: a drag pans, the wheel goes out and in.
  const canvasScale = await page.evaluate(`(() => { const c = ${GAME}.canvas.getBoundingClientRect(); const b = ${GAME}.scene.getScene('base'); return { x: c.left, y: c.top, scale: c.width / b.scale.width }; })()`);
  const mouse = (type, x, y, extra = {}) =>
    page.send('Input.dispatchMouseEvent', { type, x: canvasScale.x + x * canvasScale.scale, y: canvasScale.y + y * canvasScale.scale, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
  const hover = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: canvasScale.x + x * canvasScale.scale, y: canvasScale.y + y * canvasScale.scale, button: 'none', buttons: 0 });
  const click = async (x, y) => {
    await hover(x, y);
    await step(40);
    await mouse('mousePressed', x, y);
    await step(40);
    await mouse('mouseReleased', x, y);
    await step(100);
  };
  const dragFrom = (await state()).rect;
  await hover(200, 120);
  await mouse('mousePressed', 200, 120);
  await step(40);
  await mouse('mouseMoved', 160, 90);
  await step(40);
  await mouse('mouseMoved', 120, 60);
  await step(40);
  await mouse('mouseReleased', 120, 60);
  await step(300);
  const dragTo = (await state()).rect;
  expect('a drag pans it', dragTo.left < dragFrom.left && dragTo.top < dragFrom.top);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: canvasScale.x + 200 * canvasScale.scale, y: canvasScale.y + 100 * canvasScale.scale, deltaX: 0, deltaY: 120, button: 'none' });
  await step(700);
  expect('the wheel goes further out', (await state()).level === 1);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: canvasScale.x + 200 * canvasScale.scale, y: canvasScale.y + 100 * canvasScale.scale, deltaX: 0, deltaY: 120, button: 'none' });
  await step(700);
  const backOut = await state();
  expect('and out to the whole map', backOut.level === 0 && backOut.rect.left >= 0);

  // Choosing a way in, by key and by mouse, and neither moved by panning.
  const landings = await base(`b.arena.share.landings.length`);
  if (landings > 1) {
    const first = (await state()).way;
    await press('KeyE');
    await step(300);
    const second = (await state()).way;
    expect('E walks on to the next way in', second !== first);
    await shot('next-way-in');
    await press('KeyQ');
    await step(300);
    expect('Q walks back', (await state()).way === first);
    await press('KeyZ');
    await step(600);
    await page.keyDown('KeyS');
    await step(800);
    await page.keyUp('KeyS');
    await step(300);
    expect('panning does not change the choice', (await state()).way === first);
    await shot('chosen-out-of-sight');
    await press('KeyZ');
    await step(300);
    await press('KeyZ');
    await step(700);
    // A click on another light chooses it.
    const other = await base(`(() => { const t = b.telescope; const l = b.arena.share.landings.find((each) => each.id !== t.wayIn.id && Math.abs(each.tile.x - 192) < 150); const at = t.rules.screenOf({ x: l.tile.x + 0.5, y: l.tile.y + 0.5 }); return { id: l.id, ...at }; })()`);
    await click(other.x, other.y);
    await step(300);
    expect('a click on a light chooses it', (await state()).way === other.id);
    await shot('clicked-a-way-in');
  }

  await page.tap('Escape', 0);
  await step(800);
  expect('ESC steps back', (await state()) === null);
  const backOn = await base('({ ...b.currentTile })');
  expect('stood where they looked from', backOn.x === east.x + 1 && backOn.y === east.y);
  await shot('stepped-back');
  await press('Space');
  await until(`${GAME}.scene.getScene('base').telescope?.isOpen === true`, 'the glass again');
  await step(200);
  await press('Space');
  await step(800);
  expect('the interact key steps back too', (await state()) === null);

  // ENTER goes round to the rail and looks that way in over: there the panel says what it risks.
  await press('Space');
  await until(`${GAME}.scene.getScene('base').telescope?.isOpen === true`, 'the glass again');
  await step(200);
  const going = (await state()).way;
  await press('Enter');
  for (let guard = 0; guard < 60 && !(await page.evaluate(sceneIs('hub'))); guard += 1) {
    await step(200);
    if (await base('b.dialogBox.visible')) {
      await page.tap('Escape', 0);
      await step(300);
    }
  }
  expect('ENTER opens the rim panel on the way in chosen', (await page.evaluate(sceneIs('hub'))) && (await base('b.kit.flow.insertionId')) === going);
  await step(800);
  await shot('looked-over-from-the-glass');
  expect('with the player round at the rail', await base(`b.arenaRim.some((tile) => tile.x === b.currentTile.x && tile.y === b.currentTile.y)`));
  await page.tap('Escape', 0);
  await step(500);

  // The mouse walks up to it and looks too.
  await walk({ x: west.x - 3, y: west.y });
  await step(300);
  const telescopeOnScreen = await base(`({ x: ${west.x * 16 + 8} - b.cameras.main.scrollX, y: ${west.y * 16 + 4} - b.cameras.main.scrollY })`);
  await click(telescopeOnScreen.x, telescopeOnScreen.y);
  await step(1500);
  await until(`${GAME}.scene.getScene('base').telescope?.isOpen === true`, 'the glass, by mouse');
  expect('a click on it walks up and looks', true);
  await shot('west-telescope-by-mouse');
  await press('Space');
  await step(800);

  // The fast route never passes through it: up the runner, SPACE, ENTER.
  const mat = await base('({ ...b.room.mat })');
  await walk({ x: mat.x, y: 56 });
  await step(300);
  await press('Space');
  for (let guard = 0; guard < 8 && (await base('b.dialogBox.visible')); guard += 1) {
    await page.tap('Escape', 0);
    await step(300);
  }
  await until(sceneIs('hub'), 'the rim');
  expect('the two presses at the rail never touch the telescope', !(await base('Boolean(b.telescope)')));
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.error(`${faults.length} fault(s)`);
  process.exit(1);
}
