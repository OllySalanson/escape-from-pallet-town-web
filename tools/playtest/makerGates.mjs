// FireRed's gatehouses, the way a maker meets them: each stands in a wall of
// trees, is given its inside in the map maker, and is walked through from one
// side to the other and back.
//
//   node tools/playtest/makerGates.mjs <url of a test-mode build> <out dir> [--real] [--before]
//
// It starts from a draft split by trees - Route 2's gatehouse and Saffron's
// north-south one in a row of them across the map, Saffron's east-west one in
// a column of them down it - and in the maker chooses each and makes its
// inside, then WALKS IT: up the steps into each north-south gatehouse, up the
// room and out of its back door onto the ridge of its roof, and back down
// through it; and in at the east-west one's west porch, across the room and out
// of its east porch, and back. `--before` places only Route 2's and stops after
// choosing it, for a build without gatehouses. It photographs every step at the 3x window, prints
// PASS or FAIL for each, and exits non-zero on any FAIL.
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

const WIDTH = 48;
const HEIGHT = 36;
const GATES = [
  { kind: 'route-gate', x: 6, y: 13, width: 6, height: 7, name: 'Gatehouse' },
  { kind: 'saffron-gate', x: 16, y: 12, width: 6, height: 8, name: 'Saffron gatehouse' },
  { kind: 'saffron-side-gate', x: 30, y: 26, width: 8, height: 5, name: 'Gatehouse 2' },
];
const rows = Array.from({ length: HEIGHT }, (_, y) =>
  Array.from({ length: WIDTH }, (_, x) => {
    if (x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2) return 'T';
    if (y >= 13 && y <= 19) return 'T';
    if (y >= 20 && x >= 30 && x <= 37) return 'T';
    return '.';
  }),
);
for (const gate of GATES) {
  for (let y = 0; y < gate.height; y += 1) {
    for (let x = 0; x < gate.width; x += 1) {
      rows[gate.y + y][gate.x + x] = '.';
    }
  }
}
const draft = {
  format: 1,
  id: 'gatehouses',
  name: 'Gatehouses',
  maker: 'Probe',
  width: WIDTH,
  height: HEIGHT,
  ground: rows.map((row) => row.join('')),
  // A build without gatehouses has only Route 2's, as a building with no door.
  buildings: (before ? GATES.slice(0, 1) : GATES).map(({ kind, x, y }) => ({ kind, x, y })),
  dropIns: [{ x: 4, y: 5, name: 'North' }],
  exits: [{ x: 44, y: 32, name: 'East Road', opens: { when: 'always' } }],
  itemSpots: [
    { x: 24, y: 6 },
    { x: 10, y: 24 },
  ],
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
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts: [{ key: 'probe', file: draft, updatedAt: 1 }], current: 'probe' }))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    ${GAME}.scene.getScene('title').scene.start('mapmaker');
  })()`);
  await page.waitFor(`Boolean(document.querySelector('.map-maker canvas[data-map]'))`);
  await sleep(800);
  await click('[data-tool="select"]');

  // Choose each gatehouse and make its inside.
  for (const [index, gate] of (before ? GATES.slice(0, 1) : GATES).entries()) {
    // The whole map in the window, as a maker would look at it.
    await click('[data-zoom="4"]');
    await sleep(300);
    await clickTile(gate.x + 2, gate.y + 2);
    await sleep(300);
    const offer = await evaluate(`document.querySelector('[data-go-inside]')?.textContent ?? ''`);
    const pane = await evaluate(`document.querySelector('.maker-selected')?.textContent ?? ''`);
    if (before) {
      report(`before: the ${gate.kind} offers no inside`, offer === '', offer);
      await shot(`before-maker-${gate.kind}`);
      continue;
    }
    report(
      `the ${gate.kind} offers an inside, and says it is walked through`,
      offer === 'Make its inside' &&
        /walks through it, in at one side and out at the other/.test(pane),
      offer,
    );
    if (index === 0) {
      await shot('maker-1-gatehouse-chosen');
    }
    await click('[data-go-inside]');
    await sleep(500);
    const inside = await maker(
      `({ name: s.inside?.name, style: s.inside?.style, size: s.inside && [s.inside.width, s.inside.height] })`,
    );
    report(
      `and makes it, a gatehouse`,
      inside.name === gate.name && inside.style === 'gatehouse',
      JSON.stringify(inside),
    );
    await shot(`maker-2-inside-${gate.kind}`);
    await click('[data-area=""]');
    await sleep(300);
  }
  if (!before) {
    const failing = await maker(
      `s.checks.filter((check) => !check.passed).map((check) => check.id)`,
    );
    report('every check on the map passes', failing.length === 0, failing.join(' '));
    // The east-west one's west mat, chosen in its room.
    await click(`[data-area="gatehouse-2"]`);
    await sleep(300);
    await clickTile(1, 5);
    await sleep(300);
    const matPane = await evaluate(`document.querySelector('.maker-selected')?.textContent ?? ''`);
    report(
      'a mat in a side wall says so',
      /let into the side wall/.test(matPane) && /pressing left/.test(matPane),
      matPane.slice(0, 120),
    );
    await shot('maker-3-side-mat-chosen');
    await click('[data-area=""]');
    await sleep(300);
    await click('[data-zoom="4"]');
    await sleep(300);
    await shot('maker-4-outside');

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
    const step = async (key) => {
      await page.keyDown(key);
      await wait(200);
      await page.keyUp(key);
      await wait(300);
    };
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
    /** Walks a way until the player stands on a tile of the area that is `local` or the steps run out. */
    const walkTo = async (key, local, limit = 16) => {
      for (let i = 0; i < limit; i += 1) {
        const now = await where();
        if (now.local && now.local.x === local.x && now.local.y === local.y) {
          return now;
        }
        await step(key);
      }
      return where();
    };

    // North to south and back, through each north-south gatehouse.
    for (const [gate, room] of [
      [GATES[0], { mat: { x: 6, y: 10 }, back: { x: 6, y: 2 } }],
      [GATES[1], { mat: { x: 4, y: 9 }, back: { x: 4, y: 2 } }],
    ]) {
      const steps = { x: gate.x + 2, y: gate.y + gate.height - 1 };
      const ridge = { x: gate.x + 2, y: gate.y };
      await standAt({ x: steps.x, y: steps.y + 1 });
      await wait(300);
      await step('ArrowUp');
      const onSteps = await where();
      report(
        `${gate.kind}: its steps are walked up`,
        onSteps.tile.y === steps.y,
        JSON.stringify(onSteps),
      );
      if (gate.kind === 'saffron-gate') {
        await shot('play-1-on-the-steps');
      }
      await press('ArrowUp');
      const inside = await where();
      report(
        `${gate.kind}: up into its door, onto the mat, facing in`,
        inside.area === gate.name &&
          inside.local?.x === room.mat.x &&
          inside.local?.y === room.mat.y &&
          inside.facing === 'up',
        JSON.stringify(inside),
      );
      if (gate.kind === 'saffron-gate') {
        await shot('play-2-in-the-gatehouse');
      }
      const below = await walkTo('ArrowUp', room.back);
      report(
        `${gate.kind}: walked up the room to its back door`,
        below.local?.x === room.back.x && below.local?.y === room.back.y,
        JSON.stringify(below),
      );
      if (gate.kind === 'saffron-gate') {
        await shot('play-3-at-the-back-door');
      }
      await press('ArrowUp');
      const out = await where();
      report(
        `${gate.kind}: out of the back door onto the ridge of the roof, facing north`,
        out.area === 'Gatehouses' &&
          out.tile.x === ridge.x &&
          out.tile.y === ridge.y &&
          out.facing === 'up',
        JSON.stringify(out),
      );
      if (gate.kind === 'saffron-gate') {
        await shot('play-4-on-the-ridge');
      }
      await step('ArrowUp');
      const away = await where();
      report(`${gate.kind}: and on north`, away.tile.y === ridge.y - 1, JSON.stringify(away));
      // And back: down onto the ridge and down off it, into the room.
      await step('ArrowDown');
      await press('ArrowDown');
      const backIn = await where();
      report(
        `${gate.kind}: back down off the ridge, in at the back door`,
        backIn.area === gate.name &&
          backIn.local?.x === room.back.x &&
          backIn.local?.y === room.back.y,
        JSON.stringify(backIn),
      );
    }

    // West to east and back, through the east-west one.
    const side = GATES[2];
    const westPorch = { x: side.x, y: side.y + 3 };
    const eastPorch = { x: side.x + 7, y: side.y + 3 };
    await standAt({ x: westPorch.x - 1, y: westPorch.y }, 'right');
    await wait(300);
    await step('ArrowRight');
    const porch = await where();
    report('east-west: onto its west porch', porch.tile.x === westPorch.x, JSON.stringify(porch));
    await shot('play-5-on-the-porch');
    await press('ArrowRight');
    const inSide = await where();
    report(
      'east-west: in at the porch, onto the west mat, facing in',
      inSide.area === side.name &&
        inSide.local?.x === 1 &&
        inSide.local?.y === 5 &&
        inSide.facing === 'right',
      JSON.stringify(inSide),
    );
    await shot('play-6-in-the-east-west-gatehouse');
    const across = await walkTo('ArrowRight', { x: 11, y: 5 });
    report(
      'east-west: across the room to the east mat',
      across.local?.x === 11,
      JSON.stringify(across),
    );
    await press('ArrowRight');
    const outEast = await where();
    report(
      'east-west: out onto the east porch, facing east',
      outEast.area === 'Gatehouses' &&
        outEast.tile.x === eastPorch.x &&
        outEast.tile.y === eastPorch.y &&
        outEast.facing === 'right',
      JSON.stringify(outEast),
    );
    await shot('play-7-out-of-the-east-porch');
    await press('ArrowLeft');
    const backWest = await where();
    report(
      'east-west: and back in from the east porch, onto the east mat',
      backWest.area === side.name && backWest.local?.x === 11 && backWest.local?.y === 5,
      JSON.stringify(backWest),
    );
  }
  const errors = await evaluate('window.__errors ?? []');
  report('no errors on the page', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = results.every(Boolean) ? 0 : 1;
