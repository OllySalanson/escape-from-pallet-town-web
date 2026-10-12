// Decorates THE BOLTHOLE end to end, the way a player does (`src/game/home/`,
// `src/game/base/decorateMode.ts`): into the house, H to pick it up, a pot plant
// carried across the room with the keys, a doll out of the box and onto the
// table, a mat that will not go on the door mat, a Surf Mat and a Snorlax doll
// put down and turned with the pointer, and H again to finish - then the doll
// faced and read, and the page reloaded to prove the house is as it was left.
//
//   node tools/playtest/decorate.mjs <url> <out dir> [--port=N] [--window=1200x768]
//
// `--port=N` drives a browser already running on that CDP port (the machine's
// own, which its memory watchdog can see) rather than launching one. The save
// is seeded with a few kinds in the Pokédex and a Surf Mat in the vault before
// the house is walked into. It fails loudly - a thrown error, not a picture -
// when any promise is broken, and photographs each step into the out dir.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
const port = option('port');
mkdirSync(out, { recursive: true });

const BASE = `${GAME}.scene.getScene('base')`;
const state = () =>
  `(() => { const b = ${BASE}; const live = b && b.sys.isActive() && b.ready && !b.leaving;
    const d = live && b.decor ? b.decor : null;
    return { live: !!live, room: live && b.room ? b.room.id : null, tile: live ? b.currentTile : null,
      facing: live ? b.facing : null, hint: live ? b.hintShown : null,
      dialog: live && b.dialogBox.visible ? b.dialogBox.textObject.text : null,
      complete: live && b.dialogBox.visible ? b.dialogBox.isCurrentMessageComplete : false,
      decorating: !!d, cursor: d ? d.state.cursor : null, held: d && d.state.held ? d.state.held : null,
      panel: d ? [d.title.text, d.status.text] : null,
      placed: live && b.place.room && b.place.room.home ? b.place.room.home.placed.map((p) => [p.id, p.room, p.x, p.y, p.facing]) : null }; })()`;
const saved = () => `JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.homeLayout ?? null`;

const firstStep = (goals) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const goals = ${JSON.stringify(goals)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
  if (at(s.x, s.y)) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || (!at(nx, ny) && b.isBlocked({ x: nx, y: ny }))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

/** Where on the page a tile of the room is, for the pointer. */
const tileOnPage = (tile) => `(() => { const b = ${BASE}; const cam = b.cameras.main; const r = b.game.canvas.getBoundingClientRect();
  const sx = r.width / b.scale.width, sy = r.height / b.scale.height;
  return { x: r.left + (${tile.x} * 16 + 8 - cam.worldView.x) * sx, y: r.top + (${tile.y} * 16 + 8 - cam.worldView.y) * sy }; })()`;

const fail = (message) => {
  throw new Error(message);
};

const browser = port ? attachBrowser(Number(port), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  const now = () => page.evaluate(state());
  const settle = async (what, test) => {
    await page.waitFor(`(() => { const s = ${state()}; return s.live && (${test}); })()`, { what });
    await sleep(350);
    return now();
  };
  const walkTo = async (goals, done = async () => false) => {
    for (let guard = 0; guard < 120; guard += 1) {
      if (await done()) return;
      const key = await page.evaluate(firstStep(goals));
      if (key === 'here') return;
      if (key === 'unreachable') fail(`nothing reaches ${JSON.stringify(goals)} from ${JSON.stringify(await now())}`);
      if (key) await press(key);
      else await sleep(150);
    }
    fail(`gave up walking to ${JSON.stringify(goals)}`);
  };
  /** Moves the decorating cursor to a tile with the arrow keys. */
  const cursorTo = async (tile) => {
    for (let guard = 0; guard < 40; guard += 1) {
      const { cursor } = await now();
      if (cursor.x === tile.x && cursor.y === tile.y) return;
      await press(cursor.x < tile.x ? 'ArrowRight' : cursor.x > tile.x ? 'ArrowLeft' : cursor.y < tile.y ? 'ArrowDown' : 'ArrowUp');
    }
    fail(`the cursor never reached ${JSON.stringify(tile)}`);
  };
  /** Walks the box with E until this piece is in hand. */
  const takeOut = async (id) => {
    for (let guard = 0; guard < 200; guard += 1) {
      if ((await now()).held?.id === id) return;
      await press('KeyE');
    }
    fail(`${id} never came out of the box`);
  };
  const mouse = async (type, tile, button = 'none') => {
    const at = await page.evaluate(tileOnPage(tile));
    await page.send('Input.dispatchMouseEvent', {
      type,
      x: at.x,
      y: at.y,
      button,
      buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0,
      clickCount: type === 'mouseMoved' ? 0 : 1,
    });
    await sleep(type === 'mouseMoved' ? 220 : 60);
  };
  const click = async (tile, button = 'left') => {
    await mouse('mouseMoved', tile);
    await mouse('mousePressed', tile, button);
    await mouse('mouseReleased', tile, button);
    await sleep(220);
  };
  const expectStanding = async (entry, what) => {
    const layout = await page.evaluate(saved());
    if (!layout?.some((each) => each.id === entry[0] && each.room === entry[1] && each.x === entry[2] && each.y === entry[3] && each.facing === entry[4])) {
      fail(`${what}: the save does not hold ${JSON.stringify(entry)} - it holds ${JSON.stringify(layout)}`);
    }
    console.log(`${what}: saved ${JSON.stringify(entry)}`);
  };

  // A new game - a browser that has been driven before keeps its save, so it
  // is cleared first - then the save given a few kinds in the Pokédex and a
  // Surf Mat in the vault, and loaded again.
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.pokedexOwned = [1, 7, 16, 25, 143];
    save.stash.items = { ...save.stash.items, 'surf-mat': 1 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
    // A name already given, so the house lets the player in without asking
    // (\`src/game/home/houseName.ts\`; \`bolthole.mjs\` plays the asking).
    localStorage.setItem('escape-from-pallet-town.player.name', 'DECORATOR'); })()`);
  const enterHouse = async () => {
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
    await page.waitFor(sceneIs('title'));
    await press('Space');
    await page.waitFor(sceneIs('base'));
    await settle('the yard', 's.room === null');
    const door = await page.evaluate(`${BASE}.doors.find((d) => d.id === 'bolthole')`);
    await walkTo(door.tiles, async () => (await now()).room === 'bolthole');
    return settle('inside THE BOLTHOLE', "s.room === 'bolthole'");
  };
  const inside = await enterHouse();
  if (inside.placed?.length !== 3) fail(`a house nobody has decorated stands ${JSON.stringify(inside.placed)}`);
  await page.screenshot(`${out}/1-as-it-was.png`);

  // Off the mat, the house offers to be decorated.
  await press('ArrowUp');
  const off = await settle('off the mat', 's.hint !== null');
  if (off.hint !== '[H] DECORATE') fail(`off the mat the house says "${off.hint}"`);
  await press('KeyH');
  const decorating = await settle('decorating', 's.decorating');
  console.log(`decorating: cursor on ${JSON.stringify(decorating.cursor)}, panel ${JSON.stringify(decorating.panel)}, hint "${decorating.hint}"`);
  await page.screenshot(`${out}/2-decorating.png`);

  // The west pot plant, carried across the room with the keys.
  await cursorTo({ x: 0, y: 7 });
  await press('Space');
  if ((await now()).held?.id !== 'pot-plant') fail(`picking up at 0,7 holds ${JSON.stringify((await now()).held)}`);
  await cursorTo({ x: 2, y: 7 });
  await page.screenshot(`${out}/3-carrying.png`);
  await press('Space');
  await expectStanding(['pot-plant', 'bolthole', 2, 6, 0], 'the plant moved');

  // The Pikachu doll, out of the box and onto the table.
  await takeOut('doll-25');
  await cursorTo({ x: 6, y: 4 });
  await page.screenshot(`${out}/4-doll-on-the-table.png`);
  await press('Space');
  await expectStanding(['doll-25', 'bolthole', 6, 4, 0], 'the doll on the table');

  // Something will not go on the door mat, and the panel says why.
  await takeOut('small-chair');
  await cursorTo({ x: 7, y: 8 });
  const refused = await now();
  if (refused.panel?.[1] !== 'KEEP THE MATS CLEAR') fail(`on the door mat the panel says ${JSON.stringify(refused.panel)}`);
  await page.screenshot(`${out}/5-refused.png`);
  await press('Space');
  if ((await now()).held?.id !== 'small-chair') fail('a refused piece left the player\'s hands');
  await press('Escape');
  if ((await now()).held !== null) fail('Escape kept the piece in hand');

  // The pointer: the Surf Mat laid with a click, a Snorlax doll stood on it
  // and turned with a right click.
  await takeOut('surf-mat');
  await click({ x: 11, y: 6 });
  await expectStanding(['surf-mat', 'bolthole', 10, 4, 0], 'the mat, by the pointer');
  await takeOut('doll-143');
  await mouse('mouseMoved', { x: 11, y: 6 });
  await click({ x: 11, y: 6 }, 'right');
  if ((await now()).held?.facing !== 1) fail(`a right click left the doll facing ${(await now()).held?.facing}`);
  await page.screenshot(`${out}/6-snorlax-turned.png`);
  await click({ x: 11, y: 6 });
  await expectStanding(['doll-143', 'bolthole', 11, 5, 1], 'the Snorlax doll, turned');

  await press('KeyH');
  const done = await settle('done decorating', '!s.decorating');
  await page.screenshot(`${out}/7-decorated.png`);
  const blocked = await page.evaluate(`[${BASE}.isBlocked({ x: 11, y: 6 }), ${BASE}.isBlocked({ x: 0, y: 6 }), ${BASE}.isBlocked({ x: 2, y: 6 })]`);
  if (blocked.join() !== 'true,false,true') fail(`after decorating, solid at the doll, the old plant spot, the new one: ${blocked}`);
  console.log(`done: ${done.placed.length} pieces standing, hint "${done.hint}"`);

  // The doll on the table answers when faced.
  await walkTo([{ x: 6, y: 3 }]);
  await press('ArrowDown');
  await press('Space');
  const line = await page.waitFor(`(() => { const s = ${state()}; return s.dialog && s.complete ? s.dialog : null; })()`, { what: 'the doll speaking' });
  if (!line.includes('PIKACHU')) fail(`facing the doll says "${line}"`);
  console.log(`the doll: ${line}`);
  await press('Space');

  // And the house is as it was left after a reload.
  const again = await enterHouse();
  for (const entry of [['doll-25', 'bolthole', 6, 4, 0], ['surf-mat', 'bolthole', 10, 4, 0], ['doll-143', 'bolthole', 11, 5, 1], ['pot-plant', 'bolthole', 2, 6, 0]]) {
    if (!again.placed.some((each) => each.join() === entry.join())) fail(`after a reload the house stands ${JSON.stringify(again.placed)}`);
  }
  await page.screenshot(`${out}/8-after-reload.png`);
  console.log(`after a reload: ${again.placed.length} pieces where they were left`);
  await page.close();
} finally {
  await browser.close();
}
