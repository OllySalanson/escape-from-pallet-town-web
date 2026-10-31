// Walks THE RAID ARENA's wide east and west floors watching the camera, then plays
// a brass telescope as a player does, by keys and by mouse.
//
//   node tools/playtest/arenaTelescope.mjs <dev-url> <out-dir> [--window=1200x768] [--port=N] [--new] [--still] [--clock=day|dusk|night]
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
  // The player's own clock, by the time zone that makes it that hour now.
  if (option('clock')) {
    const wanted = { night: 23, dusk: 19, day: 12 }[option('clock')];
    const shift = ((wanted - new Date().getUTCHours() + 36) % 24) - 12;
    await page.send('Emulation.setTimezoneOverride', { timezoneId: `Etc/GMT${shift >= 0 ? '-' : '+'}${Math.abs(shift)}` });
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
      return { open: t.isOpen, zoom: r.zoom, level: r.level, canPan: r.canPan, rect: r.mapRect(), cursor: r.cursor, way: t.wayIn?.id ?? null, wings: t.wingsCrossing, card: t.cardShown, bar: t.barEnds }; })()`);
  const size = await base('({ width: b.scale.width, height: b.scale.height })');
  const wholeCard = (seen) =>
    !seen.card || (seen.card.x >= 0 && seen.card.y >= 0 && seen.card.x + seen.card.width <= size.width && seen.card.y + seen.card.height <= size.height - 16);
  const held = async (key, ms) => {
    await page.keyDown(key);
    await step(ms);
    await page.keyUp(key);
    await step(100);
  };
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
  expect('it opens on the whole map, all of it on the screen', whole.level === 0 && whole.rect.left >= 0 && whole.rect.right <= size.width && whole.rect.top >= 0 && whole.rect.bottom <= size.height - 16);
  expect('the cursor starts on the way in they are stood over, saying what it is', whole.way !== null && whole.card?.title.length > 0 && wholeCard(whole));
  expect('none of the keys along the foot is cut off', whole.bar <= size.width - 4);
  // The foot of the screen is the keys and the rest of it is map: nothing black beside it.
  const pictureBlack = await blackShare('whole-vale-black');
  expect(`the map fills the screen: no black bars (${(pictureBlack * 100).toFixed(2)}%)`, pictureBlack < 0.002);
  if (still) {
    await step(3000);
    expect('nothing crosses it with reduced motion', !(await state()).wings);
  } else {
    for (let guard = 0; guard < 100 && !(await state()).wings; guard += 1) await step(200);
    // It comes out from behind the frame a few seconds into a crossing.
    await step(7000);
    expect('the wings cross it', (await state()).wings);
    await shot('whole-vale-wings');
  }

  // The keys: from the first press something moves, on the whole map as closer up.
  const landings = await base(`b.arena.share.landings.length`);
  const before = await state();
  await held('ArrowUp', 400);
  const moved = await state();
  expect('an arrow moves the cursor on the whole map', moved.cursor.y < before.cursor.y);
  expect('with the map holding still', moved.rect.top === before.rect.top);
  expect('and off the way in the card goes or names the ground', moved.way === null && wholeCard(moved));
  await shot('cursor-off-a-way-in');
  await page.tap('Enter', 0);
  await step(200);
  const refused = await state();
  expect('ENTER out over the country says there is no way in here', refused.card?.title === 'NO WAY IN HERE' && refused.open);
  await shot('no-way-in-here');
  await step(1300);
  for (const [key, axis, sign] of [['KeyD', 'x', 1], ['KeyA', 'x', -1], ['KeyS', 'y', 1], ['KeyW', 'y', -1]]) {
    const from = (await state()).cursor[axis];
    await held(key, 300);
    expect(`${key} moves it`, Math.sign((await state()).cursor[axis] - from) === sign);
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
  await held('ArrowLeft', 9000);
  await step(400);
  const atEdge = await state();
  expect('closer up the view goes with the cursor', atEdge.rect.left > closest.rect.left || closest.rect.left === 0);
  expect('and stops at the west edge of the map', atEdge.rect.left === 0 && atEdge.cursor.x <= 10);
  await shot('stopped-at-the-west-edge');

  // By mouse: a drag pans, the wheel goes out and in, and the pointer is the cursor.
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
  const wheel = async () => {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: canvasScale.x + 200 * canvasScale.scale, y: canvasScale.y + 100 * canvasScale.scale, deltaX: 0, deltaY: 120, button: 'none' });
    await step(700);
  };
  await wheel();
  expect('the wheel goes further out', (await state()).level === 1);
  await wheel();
  const backOut = await state();
  expect('and out to the whole map', backOut.level === 0 && backOut.rect.left >= 0);

  // Way in by way in: Q and E, and the card whole beside every one at this level and closer.
  const lightOf = (id) => base(`(() => { const t = b.telescope; const l = b.arena.share.landings.find((each) => each.id === ${JSON.stringify(id)}); return t.rules.screenOf({ x: l.tile.x + 0.5, y: l.tile.y + 0.5 }); })()`);
  if (landings > 1) {
    const seen = new Set();
    let tidy = true;
    for (let turn = 0; turn < landings; turn += 1) {
      await press('KeyE');
      await step(300);
      const now = await state();
      seen.add(now.way);
      tidy &&= wholeCard(now);
    }
    expect('E walks every way in, each with its card whole on the screen', seen.size === landings && tidy);
    await shot('next-way-in');
    const first = (await state()).way;
    await press('KeyE');
    await step(200);
    await press('KeyQ');
    await step(200);
    expect('Q walks back', (await state()).way === first);
    await press('KeyZ');
    await step(600);
    for (let turn = 0; turn < landings; turn += 1) {
      await press('KeyE');
      await step(400);
      expect(`closer up, the card is whole by way in ${turn}`, wholeCard(await state()));
    }
    await press('KeyZ');
    await step(600);
    await press('KeyZ');
    await step(700);
    // Holding a key cannot go over a way in: it stops there.
    const other = await base(`(() => { const t = b.telescope; const l = b.arena.share.landings.find((each) => each.id !== t.wayIn?.id); const at = t.rules.screenOf({ x: l.tile.x + 0.5, y: l.tile.y + 0.5 }); return { id: l.id, ...at }; })()`);
    await hover(other.x + 3, other.y + 3);
    await step(100);
    expect('the pointer on a light is the cursor on it', (await state()).way === other.id);
    await shot('pointing-at-a-way-in');
    const empty = { x: 8, y: 150 };
    await hover(empty.x, empty.y);
    await step(100);
    expect('and off it the card goes with it', (await state()).way === null);
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

  // ENTER on a way in goes round to the rail and opens the rim's card on it, and there is no list on it.
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
  expect('ENTER opens the rim on the way in pointed at', (await page.evaluate(sceneIs('hub'))) && (await base('b.kit.flow.insertionId')) === going);
  await step(800);
  await shot('rim-card');
  const rimCard = await page.evaluate(`(() => {
    const root = document.querySelector('#screens .arena-panel.is-rim');
    const box = root.getBoundingClientRect();
    const canvas = ${GAME}.canvas.getBoundingClientRect();
    return {
      top: box.top, bottom: box.bottom, windowHeight: window.innerHeight,
      lists: root.querySelectorAll('.px-scroll, .px-list, .px-row, [data-more]').length,
      overflow: root.scrollHeight > root.clientHeight + 1,
      pitLeft: box.top - canvas.top,
      focused: document.activeElement?.hasAttribute('data-start') === true,
    };
  })()`);
  expect('the rim is one card: no list and nothing to scroll', rimCard.lists === 0 && !rimCard.overflow);
  expect('whole on the screen, with the pit above it', rimCard.bottom <= rimCard.windowHeight && rimCard.pitLeft > 80);
  expect('and the cursor on JUMP IN, for the second press', rimCard.focused);
  expect('with the player round at the rail', await base(`b.arenaRim.some((tile) => tile.x === b.currentTile.x && tile.y === b.currentTile.y)`));
  if (landings > 1) {
    const way = () => base('b.kit.flow.insertionId');
    const from = await way();
    const seen = new Set([from]);
    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
      await page.tap(key, 0);
      await step(300);
      seen.add(await way());
    }
    expect('the arrows point at other ways in on the map', seen.size > 1);
    await step(1200);
    await shot('rim-another-way-in');
    const stillOnJump = await page.evaluate(`document.activeElement?.hasAttribute('data-start') === true`);
    expect('and leave the cursor on JUMP IN', stillOnJump);
    // A click on a light in the pit points at it too.
    const light = await base(`(() => { const a = b.arena; const flow = b.kit.flow; const c = b.cameras.main; const seen = a.share.landings.filter((l) => l.id !== flow.insertionId).map((l) => { const p = a.pointOfLanding(l); return { id: l.id, x: p.x - c.scrollX, y: p.y - c.scrollY }; }).filter((p) => p.x > 8 && p.x < b.scale.width - 8 && p.y > 8 && p.y < ${Math.floor((rimCard.top - (await page.evaluate(`${GAME}.canvas.getBoundingClientRect().top`))) / canvasScale.scale) - 8}); return seen[0] ?? null; })()`);
    if (light) {
      await click(light.x, light.y);
      await step(300);
      expect('a click on a light in the pit points at it', (await way()) === light.id);
      await step(1200);
      await shot('rim-clicked-a-light');
    }
  }
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
  await step(400);
  await page.tap('Enter', 0);
  await until(sceneIs('world'), 'the raid');
  expect('and the second press jumps', true);
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.error(`${faults.length} fault(s)`);
  process.exit(1);
}
