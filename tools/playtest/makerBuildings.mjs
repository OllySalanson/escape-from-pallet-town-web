// Every building has a way in, the way a maker meets it: Kanto's town buildings
// open where FireRed's own maps put their doors, a door as wide as FireRed
// draws it takes you in from every cell, and a mat takes you out from its
// middle tile - the one FireRed puts its arrow on - and from nowhere else.
//
//   node tools/playtest/makerBuildings.mjs <url of a test-mode build> <out dir> [--real] [--before]
//
// It starts from a small town as a draft - the Bike Shop, Pewter's Gym and its
// Museum on open grass - and in the maker chooses each and makes its inside,
// then WALKS IT: in by the right-hand cell of the Bike Shop's two-cell door,
// not out by the left-hand tile of its mat but out by its middle, and in and
// out of the Gym and the Museum.
// `--before` stops after choosing the Bike Shop, for a build without this step.
// It photographs every step at the 3x window, prints PASS or FAIL for each, and
// exits non-zero on any FAIL.
import { launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const real = args.includes('--real');
const before = args.includes('--before');
const STORE = 'escape-from-pallet-town.maker.v1';
const url = new URL(base);
if (!real) {
  url.searchParams.set('testmode', 'pixels');
}

const WIDTH = 40;
const HEIGHT = 24;
const BUILDINGS = [
  { kind: 'bike-shop', x: 4, y: 3, name: 'Bike shop' },
  { kind: 'pewter-gym', x: 14, y: 4, name: 'Pewter Gym' },
  { kind: 'museum', x: 22, y: 3, name: 'Pewter Museum' },
];
const ground = Array.from({ length: HEIGHT }, (_, y) =>
  y < 2 || y >= HEIGHT - 2 ? 'T'.repeat(WIDTH) : `TT${'.'.repeat(WIDTH - 4)}TT`,
);
const town = {
  format: 1,
  id: 'kanto-street',
  name: 'Kanto Street',
  maker: 'Probe',
  width: WIDTH,
  height: HEIGHT,
  ground,
  buildings: BUILDINGS.map(({ kind, x, y }) => ({ kind, x, y })),
  dropIns: [{ x: 4, y: 19, name: 'Corner' }],
  exits: [{ x: 35, y: 19, name: 'Road', opens: { when: 'always' } }],
  itemSpots: [{ x: 20, y: 16 }],
  wildlife: 'town',
};

const results = [];
const report = (name, passed, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const { send, evaluate } = page;
  const wait = (ms) =>
    real ? sleep(ms) : evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const shot = async (name) => {
    await page.screenshot(`${outDir}/${name}.png`);
    console.log('shot', name);
  };
  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  };
  const click = async (selector) => {
    const at = await evaluate(
      `(() => { const element = document.querySelector(${JSON.stringify(selector)}); element?.scrollIntoView({ block: 'nearest' }); const box = element?.getBoundingClientRect(); return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null; })()`,
    );
    if (!at) {
      throw new Error(`nothing on screen matches ${selector}`);
    }
    await mouse(at.x, at.y);
    await sleep(150);
  };
  const clickTile = async (x, y) => {
    const at = await evaluate(
      `(() => { const canvas = document.querySelector('.map-maker canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = ${GAME}.scene.getScene('mapmaker').view; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`,
    );
    await mouse(at.x, at.y);
    await sleep(150);
  };
  const maker = (expression) =>
    evaluate(`(() => { const s = ${GAME}.scene.getScene('mapmaker'); return ${expression}; })()`);

  await send('Page.navigate', { url: url.href });
  await page.waitFor(`Boolean(${GAME}?.scene?.getScene('title')?.sys?.isActive())`, {
    timeoutMs: 60_000,
  });
  await evaluate(`(() => {
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts: [{ key: 'probe', file: town, updatedAt: 1 }], current: 'probe' }))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    ${GAME}.scene.getScene('title').scene.start('mapmaker');
  })()`);
  await page.waitFor(`Boolean(document.querySelector('.map-maker canvas[data-map]'))`);
  await sleep(800);
  await click('[data-tool="select"]');

  // Choose each building, and make its inside.
  for (const [index, building] of BUILDINGS.entries()) {
    await clickTile(building.x + 1, building.y + 1);
    await sleep(300);
    const offer = await evaluate(`document.querySelector('[data-go-inside]')?.textContent ?? ''`);
    if (before) {
      report(`before: the ${building.name} offers no inside`, offer === '', offer);
      await shot(`before-maker-${building.kind}`);
      continue;
    }
    report(`the ${building.name} offers an inside`, offer === 'Make its inside', offer);
    if (index === 0) {
      await shot('maker-1-bike-shop-chosen');
    }
    await click('[data-go-inside]');
    await sleep(500);
    const inside = await maker(`({ name: s.inside?.name, style: s.inside?.style })`);
    report(`and makes it, named for it`, inside.name === building.name, JSON.stringify(inside));
    await shot(`maker-2-inside-${building.kind}`);
    await click('[data-area=""]');
    await sleep(300);
  }
  if (!before) {
    const failing = await maker(
      `s.checks.filter((check) => !check.passed).map((check) => check.id)`,
    );
    report('every check on the map passes', failing.length === 0, failing.join(' '));
    await shot('maker-3-street');

    await click('[data-try="walk"]');
    await page.waitFor(`Boolean(${GAME}.scene.getScene('world')?.sys?.isActive())`, {
      timeoutMs: 20_000,
    });
    if (!real) {
      await evaluate(`${GAME}.pauseLoop()`);
    }
    await wait(800);
    for (let i = 0; i < 8; i += 1) {
      await page.tap('Space');
      await wait(200);
    }
    const standAt = (tile, facing = 'up') =>
      evaluate(
        `(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16; w.currentTile = { x: ${tile.x}, y: ${tile.y} }; w.setPlayerPosition(${tile.x} * 16, ${tile.y} * 16 + off); w.facing = '${facing}'; })()`,
      );
    const press = async (key) => {
      await page.keyDown(key);
      await wait(300);
      await page.keyUp(key);
      await wait(1200);
    };
    const where = () =>
      evaluate(
        `(() => { const w = ${GAME}.scene.getScene('world'); const rect = w.currentArea()?.rect; return { area: w.currentArea()?.name, tile: w.currentTile, local: rect ? { x: w.currentTile.x - rect.x, y: w.currentTile.y - rect.y } : null, facing: w.facing }; })()`,
      );
    const doorFor = (kind) =>
      evaluate(
        `(() => { const w = ${GAME}.scene.getScene('world'); const area = (tile) => w.currentMap.areas.find(({ rect }) => tile.x >= rect.x && tile.y >= rect.y && tile.x < rect.x + rect.width && tile.y < rect.y + rect.height)?.name; return w.currentMap.warps.filter((warp) => warp.toward === 'up' && area(warp.source) === 'Kanto Street' && area(warp.destination) === ${JSON.stringify(BUILDINGS.find((b) => b.kind === kind).name)}).map((warp) => ({ source: warp.source, destination: warp.destination })); })()`,
      );

    // The Bike Shop's door is two cells wide: in by the right-hand one.
    const shopDoor = await doorFor('bike-shop');
    report(
      'the Bike Shop is gone into from both cells of its door',
      shopDoor.length === 2,
      JSON.stringify(shopDoor),
    );
    const right = shopDoor[1].source;
    await standAt(right);
    await wait(300);
    await shot('play-1-at-the-shop-door');
    await press('ArrowUp');
    const inShop = await where();
    report(
      'in by the right-hand cell, onto the mat, facing in',
      inShop.area === 'Bike shop' && inShop.facing === 'up',
      JSON.stringify(inShop),
    );
    await shot('play-2-in-the-shop');
    // The mat's left-hand tile is floor: stepping down off it goes nowhere.
    await standAt({ x: inShop.tile.x - 1, y: inShop.tile.y });
    await wait(300);
    await press('ArrowDown');
    const offSide = await where();
    report(
      "the mat's left-hand tile is only floor: pressing down off it stays in the shop",
      offSide.area === 'Bike shop' && offSide.tile.x === inShop.tile.x - 1,
      JSON.stringify(offSide),
    );
    // And out by its middle.
    await standAt(inShop.tile);
    await wait(300);
    await press('ArrowDown');
    const outShop = await where();
    report(
      "out by the mat's middle, in front of the door's left-hand cell, facing away",
      outShop.area === 'Kanto Street' &&
        outShop.tile.x === shopDoor[0].source.x &&
        outShop.tile.y === shopDoor[0].source.y &&
        outShop.facing === 'down',
      JSON.stringify(outShop),
    );
    await shot('play-3-out-of-the-shop');

    for (const kind of ['pewter-gym', 'museum']) {
      const [door] = await doorFor(kind);
      await standAt(door.source);
      await wait(300);
      await press('ArrowUp');
      const inside = await where();
      const name = BUILDINGS.find((b) => b.kind === kind).name;
      report(`into the ${name}`, inside.area === name, JSON.stringify(inside));
      await shot(`play-4-in-${kind}`);
      await press('ArrowDown');
      const outside = await where();
      report(`and out of it again`, outside.area === 'Kanto Street', JSON.stringify(outside));
    }
  }
  const errors = await evaluate('window.__errors ?? []');
  report('no errors on the page', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = results.every(Boolean) ? 0 : 1;
