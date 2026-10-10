// The Underground Path, the way a maker meets it: two of its huts either side
// of a river nobody can cross, the path made between them in two clicks, and
// the whole of it walked - in at one hut, down the stairwell, the length of
// FireRed's tunnel, up the stairs at its far end and out of the other hut.
//
//   node tools/playtest/makerPath.mjs <url of a test-mode build> <out dir> [--real] [--before]
//
// It starts from a draft: a river across the map, a drop-in north of it, the
// only exit south of it, and an Underground Path hut either side. In the maker
// it chooses the north hut, presses MAKE THE UNDERGROUND PATH and clicks the
// south hut, then WALKS IT, key by key. `--before` draws the same river with no
// huts, for a build without the path, and photographs the map's checks. It
// photographs every step at the 3x window, prints PASS or FAIL for each, and
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
const HEIGHT = 40;
const NORTH = { x: 8, y: 8 };
const SOUTH = { x: 26, y: 28 };
const draft = {
  format: 1,
  id: 'riverside',
  name: 'Riverside',
  maker: 'Probe',
  width: WIDTH,
  height: HEIGHT,
  ground: Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) =>
      x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2 ? 'T' : y >= 18 && y <= 21 ? 'W' : '.',
    ).join(''),
  ),
  buildings: before
    ? []
    : [
        { kind: 'underground-path', ...NORTH },
        { kind: 'underground-path', ...SOUTH },
      ],
  dropIns: [{ x: 4, y: 5, name: 'North' }],
  exits: [{ x: 34, y: 35, name: 'South Road', opens: { when: 'always' } }],
  itemSpots: [
    { x: 20, y: 6 },
    { x: 10, y: 30 },
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
  const text = (selector) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);

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
  await click('[data-zoom="4"]');
  await sleep(300);
  await click('[data-tool="select"]');

  if (before) {
    const failing = await maker(
      `s.checks.filter((check) => !check.passed).map((check) => check.id)`,
    );
    report('before: nothing crosses the river', failing.includes('reachable'), failing.join(' '));
    await shot('before-maker-river');
  } else {
    // The north hut, chosen: it offers the path.
    await clickTile(NORTH.x + 1, NORTH.y + 1);
    await sleep(300);
    const offer = await text('[data-lead-path]');
    report('the hut offers the Underground Path', offer === 'Make the Underground Path', offer);
    await shot('maker-1-hut-chosen');
    await click('[data-lead-path]');
    await sleep(300);
    const banner = await text('.maker-passage');
    report(
      'and asks where it comes up',
      /another Underground Path hut/.test(banner),
      banner.slice(0, 120),
    );
    await shot('maker-2-where-it-comes-up');
    await clickTile(SOUTH.x + 1, SOUTH.y + 1);
    await sleep(600);
    const made = await maker(
      `({ area: s.area, kind: s.inside?.kind, size: s.inside && [s.inside.width, s.inside.height], links: s.file.links?.length, areas: s.file.areas?.map((a) => a.name) })`,
    );
    report(
      'clicking the south hut makes the path, and opens its tunnel',
      made.kind === 'tunnel' && made.links === 4 && made.areas.length === 3,
      JSON.stringify(made),
    );
    await shot('maker-3-tunnel');
    await click('[data-area="path-entrance"]');
    await sleep(400);
    await shot('maker-4-entrance');
    await click('[data-area=""]');
    await sleep(300);
    await click('[data-zoom="4"]');
    await sleep(300);
    const failing = await maker(
      `s.checks.filter((check) => !check.passed).map((check) => check.id)`,
    );
    report(
      'every check passes but walking it yourself',
      failing.every((id) => id === 'walked'),
      failing.join(' '),
    );
    await shot('maker-5-outside');

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
    /** Walks one way until the player is on that column or row of the area, or the steps run out. */
    const walkTo = async (key, local, limit = 70) => {
      for (let i = 0; i < limit; i += 1) {
        const now = await where();
        const there =
          key === 'ArrowUp' || key === 'ArrowDown'
            ? now.local?.y === local.y
            : now.local?.x === local.x;
        if (there) {
          return now;
        }
        await step(key);
      }
      return where();
    };

    // In at the north hut.
    await standAt({ x: NORTH.x + 1, y: NORTH.y + 4 });
    await wait(300);
    await shot('play-1-at-the-hut');
    await press('ArrowUp');
    const entrance = await where();
    report(
      'up into the hut, onto the mat of its entrance',
      entrance.area === 'Path entrance' && entrance.local?.x === 6 && entrance.local?.y === 8,
      JSON.stringify(entrance),
    );
    await shot('play-2-in-the-entrance');
    // Round to the floor beside the stairwell, east of it.
    await walkTo('ArrowUp', { y: 6 });
    await walkTo('ArrowRight', { x: 7 });
    const beside = await walkTo('ArrowUp', { y: 4 });
    report(
      'walked round to the stairwell, beside it',
      beside.local?.x === 7 && beside.local?.y === 4,
      JSON.stringify(beside),
    );
    await shot('play-3-at-the-stairwell');
    await press('ArrowLeft');
    const below = await where();
    report(
      'pressing left goes down it, into the tunnel at its north end',
      below.area === 'Underground Path' && below.local?.x === 4 && below.local?.y === 3,
      JSON.stringify(below),
    );
    await shot('play-4-in-the-tunnel');
    // The length of the tunnel.
    await walkTo('ArrowLeft', { x: 3 });
    const halfway = await walkTo('ArrowDown', { y: 30 });
    await shot('play-5-down-the-tunnel');
    const far = await walkTo('ArrowDown', { y: 60 });
    report(
      'walked the length of the tunnel to the stairs at its south end',
      halfway.local?.y === 30 && far.local?.x === 3 && far.local?.y === 60,
      JSON.stringify(far),
    );
    await shot('play-6-at-the-far-stairs');
    await press('ArrowLeft');
    const up = await where();
    report(
      'pressing left goes up them, into the other hut beside its stairwell',
      up.area === 'Path entrance 2' &&
        up.local?.x === 7 &&
        up.local?.y === 4 &&
        up.facing === 'right',
      JSON.stringify(up),
    );
    await shot('play-7-up-in-the-other-entrance');
    await walkTo('ArrowDown', { y: 6 });
    await walkTo('ArrowLeft', { x: 6 });
    await walkTo('ArrowDown', { y: 8 });
    await press('ArrowDown');
    const out = await where();
    report(
      'and out of the other hut, south of the river',
      out.area === 'Riverside' &&
        out.tile.x === SOUTH.x + 1 &&
        out.tile.y === SOUTH.y + 4 &&
        out.facing === 'down',
      JSON.stringify(out),
    );
    await shot('play-8-out-of-the-other-hut');
  }
  const errors = await evaluate('window.__errors ?? []');
  report('no errors on the page', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = results.every(Boolean) ? 0 : 1;
