// The map maker on the biggest map a maker may draw, measured the way a maker
// meets it: real pointer strokes on a 256x256 draft, timed inside the page.
//
//   node tools/playtest/makerHuge.mjs <url> [--shots=dir] [--try]
//
// Prints how long the maker takes to open the map, what one tile of a brush
// stroke costs, what letting go costs, and whether the picture the maker kept
// up a patch at a time is pixel for pixel the picture drawn whole. `--try`
// then walks it in TRY IT and reports the world's frame times. Run it against
// a build at real speed (no `?testmode`), one browser, closed at the end.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.argv.find((arg) => arg.startsWith('--shots='))?.slice('--shots='.length);
const tryIt = process.argv.includes('--try');
const STORE = 'escape-from-pallet-town.maker.v1';
const SIZE = Number(process.argv.find((arg) => arg.startsWith('--size='))?.slice('--size='.length) ?? 256);

/** The sample lane laid side by side to SIZE, with its own places in the top-left copy. */
function hugeMap() {
  const sample = JSON.parse(readFileSync(new URL('../../src/maps/sample/sample-lane.json', import.meta.url), 'utf8'));
  const ground = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => sample.ground[y % sample.height][x % sample.width]).join(''),
  );
  const buildings = [];
  for (let oy = 0; oy + sample.height <= SIZE; oy += sample.height) {
    for (let ox = 0; ox + sample.width <= SIZE; ox += sample.width) {
      buildings.push(...sample.buildings.map((b) => ({ ...b, x: b.x + ox, y: b.y + oy })));
    }
  }
  return { ...sample, id: 'huge', name: 'Huge', width: SIZE, height: SIZE, ground, buildings };
}

const results = [];
const report = (name, passed, detail) => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0;
const worst = (list) => Math.max(0, ...list);
const ms = (value) => `${value.toFixed(1)}ms`;

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  const page = await browser.openPage('about:blank');
  const { send, evaluate } = page;
  await send('Page.navigate', { url });
  await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
  const store = { drafts: [{ key: 'draft-huge', file: hugeMap(), updatedAt: 1 }], current: 'draft-huge' };
  const opened = await evaluate(`(async () => {
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify(store))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    const started = performance.now();
    window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker');
    while (!(document.querySelector('.map-maker canvas[data-map]')?.width === ${SIZE * 16})) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return performance.now() - started;
  })()`);
  await sleep(1_500);
  console.log(`opens a ${SIZE}x${SIZE} map in ${ms(opened)}`);

  // Every stroke is timed inside the page: what the handler cost, not what CDP did.
  await evaluate(`(() => {
    const scene = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker');
    window.__timed = { pointerMove: [], pointerUp: [] };
    for (const name of ['pointerMove', 'pointerUp']) {
      const original = scene[name];
      scene[name] = function (...args) {
        const start = performance.now();
        original.apply(this, args);
        window.__timed[name].push(performance.now() - start);
      };
    }
  })()`);
  const tile = (x, y) =>
    evaluate(`(() => { const canvas = document.querySelector('canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').history.value; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
  const stroke = async (from, to, steps) => {
    const start = await tile(from.x, from.y);
    const end = await tile(to.x, to.y);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= steps; step += 1) {
      const x = start.x + ((end.x - start.x) * step) / steps;
      const y = start.y + ((end.y - start.y) * step) / steps;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(100);
  };
  // Grass across the middle of what is in view, then tall grass down it.
  await evaluate(`document.querySelector('[data-brush="grass"]')?.click()`);
  await stroke({ x: 6, y: 10 }, { x: 30, y: 14 }, 40);
  await evaluate(`document.querySelector('[data-brush="tall-grass"]')?.click()`);
  await stroke({ x: 12, y: 4 }, { x: 14, y: 30 }, 40);
  const timed = await evaluate('window.__timed');
  console.log(`one brush step: median ${ms(median(timed.pointerMove))}, worst ${ms(worst(timed.pointerMove))} over ${timed.pointerMove.length}`);
  console.log(`letting go (commit, checks, screen): ${timed.pointerUp.map(ms).join(', ')}`);
  report('a brush step keeps up with the pointer (median under 16ms)', median(timed.pointerMove) < 16);

  // The kept picture against the picture drawn whole, pixel for pixel.
  const differing = await evaluate(`(() => {
    const scene = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker');
    const shown = document.querySelector('canvas[data-map]');
    const whole = document.createElement('canvas');
    const fresh = new scene.painter.constructor();
    fresh.show(whole.getContext('2d'), scene.history.value, scene.selected);
    const a = shown.getContext('2d').getImageData(0, 0, shown.width, shown.height).data;
    const b = whole.getContext('2d').getImageData(0, 0, whole.width, whole.height).data;
    if (a.length !== b.length) return -1;
    let count = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count += 1;
    }
    return count;
  })()`);
  report('the picture kept a patch at a time is the picture drawn whole', differing === 0, `${differing} pixels differ`);

  if (shots) {
    await page.screenshot(join(shots, `maker-${SIZE}.png`));
  }
  const errors = await evaluate('window.__errors');
  report('nothing threw', errors.length === 0, errors.join('; '));

  if (tryIt) {
    const started = Date.now();
    await evaluate(`document.querySelector('[data-try="walk"]')?.click()`);
    await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__.scene.getScene('world')?.sys?.isActive())`, { timeoutMs: 60_000 });
    console.log(`TRY IT: the world is up ${Date.now() - started}ms after the click`);
    await sleep(2_000);
    await evaluate(`(() => {
      window.__frames = [];
      let last = performance.now();
      const tick = (now) => { window.__frames.push(now - last); last = now; if (window.__frames.length < 600) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    })()`);
    // Through the briefing, then walk a while.
    for (let press = 0; press < 6; press += 1) {
      await page.tap('Space');
      await sleep(150);
    }
    for (const code of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
      await page.tap(code, 1_500);
    }
    await sleep(500);
    const frames = await evaluate('window.__frames');
    const slow = frames.filter((frame) => frame > 34).length;
    console.log(`TRY IT frames: median ${ms(median(frames))}, worst ${ms(worst(frames))}, ${slow} of ${frames.length} over 34ms`);
    report('the world on the biggest map holds its frame rate (median under 20ms)', median(frames) < 20);
    if (shots) {
      await page.screenshot(join(shots, `try-${SIZE}.png`));
    }
  }
} finally {
  await browser.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
