// Plays Bill's cabinet of oddities end to end: strike a barter at his table,
// back out into his cottage and find what you paid with standing on his
// shelves, then look along them - with the keys from where you stand, and with
// the pointer (`src/game/base/cabinet.ts`).
//
//   node tools/playtest/billCabinet.mjs <url> <out dir> [--traded=N] [--window=1200x768]
//
// `--traded=N` writes a book of at least N things traded before the one this
// run strikes, so one run photographs the first trade and another a cabinet
// that has filled its second pair of units and its crates. It fails loudly -
// a thrown error, not a picture - when any promise the cabinet makes is broken.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const traded = Number(option('traded') ?? '0');
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

// Deals as `hub/trader.ts` prices them, for writing a history into the save.
// The Focus Band is left off: it is the one this run strikes for real.
const ONCE = [
  ['barter-quick-claw', [['parts-crate', 2], ['cable-coil', 1]], 'quick-claw'],
  ['barter-hm06', [['parts-crate', 1], ['cable-coil', 1], ['radio-valve', 1]], 'hm06-rock-smash'],
  ['barter-hm03', [['mooring-rope', 2], ['lamp-oil', 1]], 'hm03-surf'],
  ['barter-leftovers', [['linen-roll', 2], ['lamp-oil', 1], ['mooring-rope', 1]], 'leftovers'],
];
const STONES = [
  ['barter-thunder-stone', [['radio-valve', 2], ['cable-coil', 2], ['lamp-oil', 1]], 'thunder-stone'],
  ['barter-water-stone', [['mooring-rope', 2], ['linen-roll', 2], ['cable-coil', 1]], 'water-stone'],
  ['barter-moon-stone', [['parts-crate', 2], ['radio-valve', 2], ['mooring-rope', 1]], 'moon-stone'],
  ['barter-fire-stone', [['lamp-oil', 2], ['parts-crate', 2], ['radio-valve', 1]], 'fire-stone'],
  ['barter-leaf-stone', [['linen-roll', 2], ['lamp-oil', 2], ['parts-crate', 1]], 'leaf-stone'],
];
const book = [];
for (let deal = 0, given = 0; given < traded; deal += 1) {
  const [barter, gave, got] = deal < ONCE.length ? ONCE[deal] : STONES[(deal - ONCE.length) % STONES.length];
  const day = new Date(2026, 7, 1 + deal);
  book.push({
    barter,
    gave: gave.map(([itemId, quantity]) => ({ itemId, quantity })),
    got: { itemId: got, quantity: 1 },
    day: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
  });
  given += gave.reduce((sum, [, quantity]) => sum + quantity, 0);
}

const base = `${GAME}.scene.getScene('base')`;
const state = () =>
  `(() => { const b = ${base}; const live = b && b.sys.isActive() && b.ready;
    return { live, room: live && b.room ? b.room.id : null, tile: live ? b.currentTile : null,
      facing: live ? b.facing : null, hint: live ? b.hintShown : null,
      inspecting: live ? b.inspecting : null, placed: live ? (b.place.room?.cabinet?.layout.placed.length ?? 0) : 0,
      units: live ? (b.place.room?.cabinet?.layout.units ?? 0) : 0, crates: live ? (b.place.room?.cabinet?.layout.crates.length ?? 0) : 0 }; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  const shoot = async (name) => {
    await sleep(350);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`${name}: ${out}/${name}.png`);
  };
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  // Enough of every material for the Focus Band, and a partner's standing, so
  // the deal is on the table; and whatever history was asked for.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.stash.items, { 'parts-crate': 6, 'mooring-rope': 3, 'cable-coil': 2, 'linen-roll': 2, 'lamp-oil': 2, 'radio-valve': 2 });
    save.raidProgress.traderMoneySpent = 5200;
    save.raidProgress.traderCabinet = ${JSON.stringify(book)};
    save.raidProgress.traderBarters = ${JSON.stringify(book.map((entry) => entry.barter).filter((id) => ONCE.some(([once]) => once === id)))};
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await sleep(500);

  // Into the cottage, and one key from the mat is Bill's table - but first a
  // look at the cabinet as it stands before this run's deal.
  await walkIntoBase(page, 'bills-cottage');
  await page.evaluate(`document.querySelector('[data-back]').click()`);
  await page.waitFor(`${base}.sys.isActive() && ${base}.ready && ${base}.room?.id === 'bills-cottage'`, { what: 'the cottage' });
  await shoot('before');
  await press('Space');
  await page.waitFor(sceneIs('hub'), { what: "Bill's table from the mat" });
  await page.waitFor(`document.querySelector('[data-barter="barter-focus-band"]')`, { what: 'the Focus Band on the table' });
  await sleep(300);
  await page.evaluate(`document.querySelector('[data-barter="barter-focus-band"]').click()`);
  await page.waitFor(`document.querySelector('[data-barter-confirm="barter-focus-band"]')`, { what: 'the deal asking again' });
  await page.evaluate(`document.querySelector('[data-barter-confirm="barter-focus-band"]').click()`);
  await sleep(300);
  const said = await page.evaluate(`document.querySelector('.pixel-ui')?.textContent ?? ''`);
  if (!said.includes('shelves')) throw new Error('striking the deal did not say where the goods went');
  await shoot('traded');

  // Back out of his screen: in the cottage, on the mat, and the four things
  // just paid are on the shelf.
  await page.evaluate(`document.querySelector('[data-back]').click()`);
  await page.waitFor(`${base}.sys.isActive() && ${base}.ready && ${base}.room?.id === 'bills-cottage'`, { what: 'back in the cottage' });
  await sleep(300);
  const back = await page.evaluate(state());
  const expected = Math.min(96, book.reduce((sum, entry) => sum + entry.gave.reduce((n, stack) => n + stack.quantity, 0), 0) + 4);
  if (back.placed !== expected) throw new Error(`the shelves hold ${back.placed} things, not ${expected}`);
  console.log(`cabinet: ${back.placed} on the shelves, ${back.units} units standing, ${back.crates} crates`);
  await shoot('cottage');

  // Walk up to the cabinet the newest thing stands on and face it.
  const newest = await page.evaluate(`(() => { const p = ${base}.place.room.cabinet.layout.placed; const last = p[p.length - 1]; return { unit: last.unit, x: Math.floor((last.x + last.width / 2) / 16) }; })()`);
  const unit = await page.evaluate(`${JSON.stringify([{ x: 1, y: 5 }, { x: 9, y: 5 }, { x: 1, y: 8 }, { x: 9, y: 8 }])}[${newest.unit}]`);
  // The tile in front of that unit nearest the thing, that can be stood on.
  const stand = await page.evaluate(`(() => { const b = ${base}; const row = ${unit.y + 2};
    const xs = [0, 1, 2, 3, 4].map((dx) => ${unit.x} + dx).filter((x) => !b.isBlocked({ x, y: row }));
    xs.sort((a, c) => Math.abs(a - ${newest.x}) - Math.abs(c - ${newest.x})); return { x: xs[0], y: row }; })()`);
  const faceKey = 'ArrowUp';
  for (let guard = 0; guard < 60; guard += 1) {
    const key = await page.evaluate(`(() => { const b = ${base}; if (b.targetTile) return 'wait'; const goal = ${JSON.stringify(stand)};
      const s = b.currentTile; if (s.x === goal.x && s.y === goal.y) return null;
      const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
      const prev = new Map([[id(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
      while (q.length) { const [x, y] = q.shift(); if (x === goal.x && y === goal.y) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
      if (!found) throw new Error('nowhere to stand in front of the cabinet');
      let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`);
    if (key === null) break;
    if (key !== 'wait') await press(key);
    else await sleep(100);
  }
  await press(faceKey);
  const facing = await page.evaluate(state());
  if (facing.hint !== '[SPACE] LOOK CLOSER') throw new Error(`facing the cabinet says "${facing.hint}"`);
  await shoot('facing-cabinet');

  // The interact key looks closer, from exactly where the player stands.
  await press('Space');
  const looking = await page.evaluate(state());
  if (looking.inspecting?.by !== 'keys') throw new Error('the interact key did not look closer');
  await shoot('inspect');
  await press('ArrowLeft');
  await press('ArrowLeft');
  const along = await page.evaluate(state());
  if (along.inspecting?.index === looking.inspecting.index) throw new Error('the arrow keys did not look along the shelf');
  if (along.tile.x !== looking.tile.x || along.tile.y !== looking.tile.y) throw new Error('looking along the shelf walked the player');
  await shoot('inspect-along');
  if (traded > 0) {
    await press('ArrowUp');
    await shoot('inspect-up');
  }
  await press('Escape');
  const done = await page.evaluate(state());
  if (done.inspecting !== null) throw new Error('Escape did not stop looking');

  // The pointer asks the same question by resting on a thing.
  const target = await page.evaluate(`(() => { const b = ${base}; const p = b.place.room.cabinet.layout.placed[1];
    const cam = b.cameras.main; const rect = ${GAME}.canvas.getBoundingClientRect(); const scale = rect.width / ${GAME}.scale.width;
    return { x: rect.left + (p.x + p.width / 2 - cam.worldView.x) * cam.zoom * scale, y: rect.top + (p.y + p.height / 2 - cam.worldView.y) * cam.zoom * scale }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y });
  await sleep(250);
  const pointed = await page.evaluate(state());
  if (pointed.inspecting?.by !== 'pointer' || pointed.inspecting.index !== 1) throw new Error('resting the pointer on a thing did not say what it is');
  await shoot('pointer');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await sleep(250);
  if ((await page.evaluate(state())).inspecting !== null) throw new Error('moving the pointer away left the label up');
  console.log('traded, shelved, looked along with the keys, and pointed at');
} finally {
  await browser.close();
}
