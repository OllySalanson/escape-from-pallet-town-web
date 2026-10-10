// Finding your way round a huge map in the maker, with real input: Ctrl and
// the wheel zoom about the pointer, the middle button and Space-and-drag move
// the map without drawing, the overview in the corner jumps the window, and
// FIT stands back.
//
//   node tools/playtest/makerNav.mjs <url> [--shots=dir]
//
// Prints PASS or FAIL per case and exits non-zero on any FAIL.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.argv.find((arg) => arg.startsWith('--shots='))?.slice('--shots='.length);
const STORE = 'escape-from-pallet-town.maker.v1';
const SIZE = 256;

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

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  const page = await browser.openPage('about:blank');
  const { send, evaluate } = page;
  const shot = async (name) => {
    if (shots) {
      await page.screenshot(join(shots, `${name}.png`));
    }
  };
  await send('Page.navigate', { url });
  await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
  const store = { drafts: [{ key: 'draft-huge', file: hugeMap(), updatedAt: 1 }], current: 'draft-huge' };
  await evaluate(`(() => {
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify(store))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker');
  })()`);
  await page.waitFor(`document.querySelector('.map-maker canvas[data-map]')?.width === ${SIZE * 16}`, { timeoutMs: 10_000 });
  await sleep(1_000);

  const scene = `window.__escapeFromPalletTownGame__.scene.getScene('mapmaker')`;
  const view = () => evaluate(`(() => { const v = document.querySelector('[data-viewport]'); const b = v.getBoundingClientRect(); return { left: v.scrollLeft, top: v.scrollTop, x: b.left, y: b.top, width: v.clientWidth, height: v.clientHeight }; })()`);
  /** Which tile of the map is under a point on screen, fractions and all. */
  const tileUnder = (x, y) =>
    evaluate(`(() => { const box = document.querySelector('canvas[data-map]').getBoundingClientRect(); const file = ${scene}.history.value; return { x: (${x} - box.left) / box.width * file.width, y: (${y} - box.top) / box.height * file.height }; })()`);
  const edits = () => evaluate(`${scene}.history.canUndo`);
  const zoom = () => evaluate(`${scene}.zoom`);

  const overviewShown = await evaluate(`!document.querySelector('[data-overview]').hidden`);
  report('a map bigger than its window shows an overview in the corner', overviewShown);
  await shot('1-overview');

  // Ctrl and the wheel, about the pointer.
  let box = await view();
  const point = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.4 };
  const before = await tileUnder(point.x, point.y);
  const zoomBefore = await zoom();
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY: -120, modifiers: 2 });
  await sleep(300);
  const after = await tileUnder(point.x, point.y);
  report('Ctrl and the wheel zoom in a step', (await zoom()) === zoomBefore * 2, `${zoomBefore} -> ${await zoom()}`);
  report('...about the tile under the pointer', Math.abs(after.x - before.x) < 0.2 && Math.abs(after.y - before.y) < 0.2, `${before.x.toFixed(2)},${before.y.toFixed(2)} -> ${after.x.toFixed(2)},${after.y.toFixed(2)}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY: 120, modifiers: 2 });
  await sleep(300);
  report('...and out again', (await zoom()) === zoomBefore);

  // The middle button moves the map and draws nothing.
  box = await view();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'middle', buttons: 4, clickCount: 1 });
  for (let step = 1; step <= 10; step += 1) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x - step * 15, y: from.y - step * 10, button: 'middle', buttons: 4 });
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x - 150, y: from.y - 100, button: 'middle', buttons: 0, clickCount: 1 });
  await sleep(150);
  let moved = await view();
  report('dragging with the middle button moves the map with the pointer', Math.abs(moved.left - box.left - 150) <= 1 && Math.abs(moved.top - box.top - 100) <= 1, `scroll ${box.left},${box.top} -> ${moved.left},${moved.top}`);
  report('...and draws nothing', (await edits()) === false);

  // Space held over the map: the same, with the left button.
  box = moved;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
  const toolBefore = await evaluate(`${scene}.tool`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 10; step += 1) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + step * 12, y: from.y + step * 6, button: 'left', buttons: 1 });
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x + 120, y: from.y + 60, button: 'left', buttons: 0, clickCount: 1 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await sleep(150);
  moved = await view();
  report('Space held and a drag moves the map', Math.abs(box.left - moved.left - 120) <= 1 && Math.abs(box.top - moved.top - 60) <= 1, `scroll ${box.left},${box.top} -> ${moved.left},${moved.top}`);
  report('...draws nothing, and presses no tool', (await edits()) === false && (await evaluate(`${scene}.tool`)) === toolBefore);
  // Let go, a press draws again.
  await evaluate(`document.querySelector('[data-brush="sand"]')?.click()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x, y: from.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(150);
  report('...and once Space is let go, a press draws again', (await edits()) === true);

  // The overview: a press there looks at that part of the map.
  const target = await evaluate(`(() => { const b = document.querySelector('[data-overview-map]').getBoundingClientRect(); return { x: b.left + b.width * 0.8, y: b.top + b.height * 0.8 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(200);
  box = await view();
  const middle = await tileUnder(box.x + box.width / 2, box.y + box.height / 2);
  report('a press on the overview looks at that part of the map', Math.abs(middle.x - SIZE * 0.8) < 4 && Math.abs(middle.y - SIZE * 0.8) < 4, `${middle.x.toFixed(1)},${middle.y.toFixed(1)}`);
  await shot('2-after-the-overview');

  // FIT stands back as far as the zooms go.
  await evaluate(`document.querySelector('[data-fit]').click()`);
  await sleep(300);
  report('FIT stands back to the furthest zoom for a map this size', (await zoom()) === 2, `zoom ${await zoom()}`);
  await shot('3-fit');

  const errors = await evaluate('window.__errors');
  report('nothing threw', errors.length === 0, errors.join('; '));
} finally {
  await browser.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
