// Plays THE TREASURE MAP's harbour half end to end (`src/game/treasure/`) in a
// browser something else started - this machine's own headless one - by its
// CDP port, photographing every beat:
//
//   node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> [--save-out=path.json]
//   node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --chest=save.json
//   node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --playtest
//
// With no `--chest`: a new game, the bottle on THE BEACH, MARLOW at the library's
// end bookcase, through into THE CHART ROOM, the bottled chart pinned on the
// board, then the vale's three torn charts - put in the vault as three raids
// would have banked them (`raid.mjs --clock=dusk --grab=chart-piece-1` plays one
// of those) - pinned one at a time until the chart is whole. `--save-out` keeps
// the save, which is what the raid half starts from:
//
//   node tools/playtest/raid.mjs <url> --testmode --pixels --insertion=greystone-vale-cove-steps \
//     --beaten=vale-gym-misty --hunt=shore,moor,hollow,fold --level=40 --grab=sea-chest --save-out=dug.json
//
// With `--chest=dug.json`: that raid's save, walked from the yard to MARLOW, who
// opens the chest it brought home.
//
// With `--playtest`: a fresh explorer run (`src/game/dev/playtestMode.ts`),
// whose kit already holds every piece: straight to MARLOW, every piece pinned,
// and what he says once the chart is whole.
import { attachBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [port, url, out] = process.argv.slice(2);
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const PLAYTEST = process.argv.includes('--playtest');
const SAVE_KEY = PLAYTEST ? 'escape-from-pallet-town.save.playtest.v1' : 'escape-from-pallet-town.save.v1';
mkdirSync(out, { recursive: true });
const browser = attachBrowser(Number(port), { window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
const fullUrl = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels${PLAYTEST ? '&playtest' : ''}`;
const log = (...words) => console.log(...words);
const press = async (code, after = 160) => {
  await page.tap(code, 60);
  await sleep(after);
};
const until = (expression, what, timeoutMs = 60_000) => page.waitFor(expression, { what, timeoutMs });
const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
const settled = `(() => { const b = ${GAME}.scene.getScene('base'); return ${sceneIs('base')} && b.ready && !b.leaving; })()`;
let shot = 0;
const snap = async (name) => {
  shot += 1;
  const path = `${out}/${String(shot).padStart(2, '0')}-${name}.png`;
  await page.screenshot(path);
  log('shot', path);
};
const failures = [];
const expect = (what, ok, detail = '') => {
  log(ok ? 'ok  ' : 'FAIL', what, detail);
  if (!ok) failures.push(what);
};
const hunt = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.treasureHunt ?? null`);
const vault = (itemId) => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash.items[${JSON.stringify(itemId)}] ?? 0`);

/** Walks onto a tile, by key presses over the scene's own collision. */
async function walkTo(goals, label) {
  for (let guard = 0; guard < 400; guard += 1) {
    const move = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return { wait: true };
      const goals = ${JSON.stringify(goals)};
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      if (at(s.x, s.y)) return { arrived: true };
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift();
        if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return { unreachable: true, from: s, goals, room: b.room?.id ?? null };
      let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return { key }; })()`);
    if (move.unreachable) throw new Error(`cannot walk to ${label}: ${JSON.stringify(move)}`);
    if (move.arrived) return;
    if (move.wait) {
      await sleep(100);
      continue;
    }
    await page.tap(move.key, 60);
    await sleep(120);
  }
  throw new Error(`never got to ${label}`);
}

/** Turns to face a way, from standing. */
async function face(direction) {
  const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction];
  if ((await base('b.facing')) !== direction) await press(key, 250);
}

/**
 * Presses past whatever is being said, answering YES to any question. With a
 * `name`, every page of it is photographed once it has finished typing, as
 * `name-1`, `name-2`...
 */
async function readThrough(name, { answer = true } = {}) {
  for (let page = 1; page < 60; page += 1) {
    const state = await base(`({ box: b.dialogBox.visible, question: Boolean(b.boxQuestion) })`);
    if (!state.box && !state.question) return;
    if (name) {
      // Long enough for the line to finish typing, even on a loaded machine.
      await sleep(2200);
      await snap(`${name}-${page}`);
    }
    if (state.question && !answer) {
      await press('ArrowRight');
    }
    await press('Space', 350);
  }
  throw new Error('the talking never stopped');
}

async function intoLibrary() {
  const door = await base(`b.doors.find((d) => d.id === 'great-library').tiles[0]`);
  await walkTo([{ x: door.x, y: door.y + 1 }], 'the library step');
  await press('ArrowUp', 200);
  await until(`${settled} && ${GAME}.scene.getScene('base').room?.id === 'great-library'`, 'the library');
  await sleep(900);
}

async function intoChartRoom() {
  // The arch at the end bookcase's foot, one step up from the floor in front of it.
  await walkTo([{ x: 13, y: 2 }], 'the open bookcase');
  // The partner may be standing in the arch, having followed the player out of
  // it: a tap at it from standing only turns to it, so press again, as a
  // player holding the key does.
  for (let tries = 0; tries < 4 && (await base(`b.room?.id`)) === 'great-library'; tries += 1) {
    await press('ArrowUp', 450);
  }
  await until(`${settled} && ${GAME}.scene.getScene('base').room?.id === 'chart-room'`, 'THE CHART ROOM');
  await sleep(900);
}

/** The floor in front of something in the room, read off the room as it is built. */
const inFrontOf = (does) =>
  base(`(() => { const tiles = b.place.room.things.find((thing) => thing.does === ${JSON.stringify(does)}).tiles;
    const tile = tiles[Math.floor(tiles.length / 2)]; return { x: tile.x, y: tile.y + 1 }; })()`);

async function pinAtTheBoard(name) {
  await walkTo([await inFrontOf('chart-wall')], 'in front of the board');
  await face('up');
  await press('Space', 600);
  await readThrough(name);
  await until(settled, 'the room back');
  await sleep(700);
}

try {
  await page.send('Page.navigate', { url: fullUrl });
  await until(`${GAME}?.scene.getScenes(true).length > 0`, 'the game');
  if (option('chest')) {
    // The save the raid that dug the chest up banked.
    await page.evaluate(`localStorage.setItem('${SAVE_KEY}', ${JSON.stringify(readFileSync(option('chest'), 'utf8'))})`);
    await page.send('Page.navigate', { url: fullUrl });
    await until(sceneIs('title'), 'the title');
    await sleep(800);
    await press('Space');
    await until(settled, 'the harbour');
    await sleep(800);
    await readThrough();
    if (await base('Boolean(b.room)')) {
      // Home from the raid lands on the Arena's rim: out of the hall first.
      await walkTo([await base('b.room.mat ?? b.room.stairs[0].tile')], 'the way out');
      await press('ArrowDown', 900);
      await until(`${settled} && !${GAME}.scene.getScene('base').room`, 'the yard');
    }
    expect('the chest came home in the vault', (await vault('sea-chest')) === 1);
    await intoLibrary();
    await intoChartRoom();
    await snap('chart-room-with-the-chest');
    await walkTo([await inFrontOf('chart-keeper')], 'below MARLOW');
    await face('up');
    await press('Space', 600);
    await readThrough('marlow-opens-the-chest');
    await until(settled, 'the room back');
    await sleep(900);
    await snap('the-chest-on-show');
    expect('the chest is open', (await hunt())?.chestOpened === true);
    expect('the chest is out of the vault', (await vault('sea-chest')) === 0);
    expect('the Hauler frame is in the vault', (await vault('hauler-frame')) >= 1);
    log('money now', await vault('money'));
  } else if (PLAYTEST) {
    // A fresh explorer run: `?playtest` goes straight in, with the kit's pieces.
    await page.evaluate('localStorage.clear()');
    await page.send('Page.navigate', { url: fullUrl });
    await sleep(1500);
    await until(`Boolean(${GAME}?.scene.getScenes(true).length > 0) && ${settled}`, 'the harbour');
    await sleep(800);
    await readThrough();
    if (await base('Boolean(b.room)')) {
      await walkTo([await base('b.room.mat ?? b.room.stairs[0].tile')], 'the way out');
      await press('ArrowDown', 900);
      await until(`${settled} && !${GAME}.scene.getScene('base').room`, 'the yard');
    }
    log('pieces in the kit', JSON.stringify(Object.fromEntries(await Promise.all(['bottled-chart', 'chart-piece-1', 'chart-piece-2', 'chart-piece-3', 'sea-chest'].map(async (id) => [id, await vault(id)])))));
    await intoLibrary();
    await snap('library-with-marlow');
    await walkTo([{ x: 13, y: 2 }], 'beside MARLOW');
    await face('right');
    await press('Space', 600);
    await readThrough('marlow-library');
    await until(`${settled} && ${GAME}.scene.getScene('base').room?.id === 'chart-room'`, 'THE CHART ROOM');
    await sleep(900);
    await readThrough('chart-room-arrival');
    await snap('chart-room-empty-board');
    for (let piece = 1; piece <= 4 && ((await hunt())?.pinned.length ?? 0) < 4; piece += 1) {
      await pinAtTheBoard(`pin-${piece}`);
      await snap(`board-after-${piece}`);
    }
    expect('the chart is whole', (await hunt())?.pinned.length === 4, JSON.stringify(await hunt()));
    await pinAtTheBoard('board-when-whole');
    await walkTo([await inFrontOf('chart-keeper')], 'below MARLOW');
    await face('up');
    await press('Space', 600);
    await readThrough('marlow-when-whole');
    await until(settled, 'the room back');
    await sleep(700);
    await snap('room-at-the-end');
    log('the hunt', JSON.stringify(await hunt()), 'chests left', await vault('sea-chest'));
  } else {
    await until(sceneIs('title'), 'the title');
    await page.evaluate('localStorage.clear()');
    await page.send('Page.navigate', { url: fullUrl });
    await until(sceneIs('title'), 'the title');
    await sleep(800);
    await press('Space');
    await until(settled, 'the lab');
    await page.evaluate(`${GAME}.scene.getScene('base').takeStarterForDriver('bulbasaur')`);
    await until(`${settled} && !${GAME}.scene.getScene('base').room`, 'the yard');
    await sleep(800);
    await readThrough();

    // 1. THE BEACH: the bottle at the tide line, past the pleasure pier.
    await walkTo([{ x: 83, y: 22 }], 'beside the bottle');
    await face('right');
    await sleep(2600);
    await snap('bottle-on-the-beach');
    await press('Space', 500);
    await readThrough('bottle-found');
    expect('the bottled chart is in the vault', (await vault('bottled-chart')) === 1);
    expect('the bottle is gone from the sand', (await base('b.beachBottle.length')) === 0);

    // 2. MARLOW, at the library's end bookcase.
    await intoLibrary();
    await snap('library-with-marlow');
    await walkTo([{ x: 13, y: 2 }], 'beside MARLOW');
    await face('right');
    await press('Space', 600);
    await readThrough('marlow-library');
    await until(`${settled} && ${GAME}.scene.getScene('base').room?.id === 'chart-room'`, 'THE CHART ROOM');
    await sleep(900);
    await readThrough('chart-room-arrival');
    await snap('chart-room-empty-board');
    expect('the room is open for good', (await hunt())?.roomOpen === true);

    // 3. The bottled chart on the board, and MARLOW's decision.
    await walkTo([await inFrontOf('chart-wall')], 'in front of the board');
    await face('up');
    await press('Space', 600);
    await readThrough('shore');
    await until(settled, 'the room back');
    await sleep(700);
    await snap('board-with-the-shore');
    expect('the shore piece is pinned', (await hunt())?.pinned.includes('shore'));

    // 4. Back through the bookcase: it stands open from the library side now.
    await walkTo([{ x: 0, y: 2 }], 'below the arch');
    await press('ArrowUp', 200);
    await until(`${settled} && ${GAME}.scene.getScene('base').room?.id === 'great-library'`, 'the library');
    await sleep(900);
    await snap('library-bookcase-open');

    // 5. The vale's three torn charts, as three raids would have banked them.
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      for (const id of ['chart-piece-1', 'chart-piece-2', 'chart-piece-3']) save.stash.items[id] = 1;
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await intoChartRoom();
    for (const [name, pieceId] of [['moor', 'moor'], ['hollow', 'hollow'], ['fold', 'fold']]) {
      await walkTo([await inFrontOf('chart-wall')], 'in front of the board');
      await face('up');
      await press('Space', 600);
      await readThrough(name);
      await until(settled, 'the room back');
      await sleep(700);
      expect(`the ${name} piece is pinned`, (await hunt())?.pinned.includes(pieceId));
      await snap(`board-after-${name}`);
    }
    const final = await hunt();
    expect('the chart is whole', ['shore', 'moor', 'hollow', 'fold'].every((id) => final?.pinned.includes(id)), JSON.stringify(final));
    await walkTo([await inFrontOf('chart-keeper')], 'below MARLOW');
    await face('up');
    await press('Space', 600);
    await readThrough('marlow-go-dig');
    if (option('save-out')) {
      writeFileSync(option('save-out'), await page.evaluate(`localStorage.getItem('${SAVE_KEY}')`));
      log('save written to', option('save-out'));
    }
  }
} catch (error) {
  await page.screenshot(`${out}/failed.png`).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} failed: ${failures.join('; ')}`);
  process.exit(1);
}
