// Growing a map in the maker by drawing past its edge, played with real
// pointer strokes: west and north (the ground moves, the window must not), a
// box dragged out south-east, a building planted past the top, a stroke held
// past the window's edge so it scrolls and grows as it goes, undo back to the
// start, and the biggest map refusing to grow past the cap.
//
//   node tools/playtest/makerGrow.mjs <url> [--shots=dir]
//
// Prints PASS or FAIL per case and exits non-zero on any FAIL.
import { join } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.argv.find((arg) => arg.startsWith('--shots='))?.slice('--shots='.length);
const STORE = 'escape-from-pallet-town.maker.v1';

function blank(width, height) {
  return {
    format: 1,
    id: 'grow',
    name: 'Grow',
    maker: 'Tester',
    width,
    height,
    ground: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) =>
        x < 2 || y < 2 || x >= width - 2 || y >= height - 2 ? 'T' : '.',
      ).join(''),
    ),
    buildings: [],
    dropIns: [{ x: 10, y: 10, name: 'Gate' }],
    exits: [{ x: 20, y: 12, name: 'Way out', opens: { when: 'always' } }],
    itemSpots: [{ x: 14, y: 14 }],
    wildlife: 'meadow',
  };
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
  const open = async (file) => {
    await send('Page.navigate', { url });
    await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
    const store = { drafts: [{ key: 'draft-grow', file, updatedAt: 1 }], current: 'draft-grow' };
    await evaluate(`(() => {
      localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify(store))});
      window.__errors = [];
      window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
      window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker');
    })()`);
    await page.waitFor(`document.querySelector('.map-maker canvas[data-map]')?.width === ${file.width * 16}`, { timeoutMs: 10_000 });
    await sleep(800);
  };
  const live = () => evaluate(`window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').history.value`);
  /** The middle of a tile of the map on screen - past its edge too. */
  const tile = (x, y) =>
    evaluate(`(() => { const canvas = document.querySelector('canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').history.value; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
  const press = (x, y) => send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
  const release = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  const drag = async (from, to, steps = 20) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
    await press(from.x, from.y);
    for (let step = 1; step <= steps; step += 1) {
      await move(from.x + ((to.x - from.x) * step) / steps, from.y + ((to.y - from.y) * step) / steps);
      await sleep(8);
    }
    await release(to.x, to.y);
    await sleep(150);
  };
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
    await sleep(80);
  };
  const key = async (name, code, keyCode, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
    await sleep(120);
  };
  /** Pixels of the kept picture that differ from the same map drawn whole. */
  const pictureDrift = () =>
    evaluate(`(() => {
      const scene = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker');
      const shown = document.querySelector('canvas[data-map]');
      const whole = document.createElement('canvas');
      new scene.painter.constructor().show(whole.getContext('2d'), scene.history.value, scene.selected);
      const a = shown.getContext('2d').getImageData(0, 0, shown.width, shown.height).data;
      const b = whole.getContext('2d').getImageData(0, 0, whole.width, whole.height).data;
      if (a.length !== b.length) return -1;
      let count = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count += 1;
      return count;
    })()`);

  await open(blank(40, 30));
  await shot('1-room-round-the-map');

  // West: a stroke from inside the map out past its west edge.
  await click('[data-brush="sand"]');
  const anchorBefore = await tile(10, 10);
  await drag(await tile(8, 12), await tile(-1, 12));
  let file = await live();
  report('a stroke past the west edge grows the map west, two tiles at a time', file.width === 44 && file.height === 30, `${file.width}x${file.height}`);
  report('...and moves everything on it with its ground', file.dropIns[0].x === 14 && file.exits[0].x === 24 && file.itemSpots[0].x === 18, JSON.stringify(file.dropIns[0]));
  report('...and the sand reaches the tile it was drawn to, with a tree of wood past it', file.ground[12].startsWith('TTTdddddddddd.'), file.ground[12]);
  const anchorAfter = await tile(14, 10);
  report('...and the window holds still: the drop-in is where it was on screen', Math.abs(anchorAfter.x - anchorBefore.x) < 1 && Math.abs(anchorAfter.y - anchorBefore.y) < 1, `${anchorBefore.x},${anchorBefore.y} -> ${anchorAfter.x},${anchorAfter.y}`);
  report('...and the kept picture is the picture drawn whole', (await pictureDrift()) === 0);
  await shot('2-grown-west');

  // The map no longer fits its window, so the overview is up in the corner -
  // where the next box starts. It goes away when asked.
  report('a map bigger than its window shows the overview', await evaluate(`!document.querySelector('[data-overview]').hidden`));
  await click('[data-overview-toggle]');
  report('...and puts it away when asked', await evaluate(`document.querySelector('[data-overview]').hidden`));

  // South-east: a box dragged out past the corner.
  await key('r', 'KeyR', 82);
  await click('[data-brush="water"]');
  await drag(await tile(40, 24), await tile(44, 31));
  file = await live();
  report('a box past the south-east corner grows the map east and south, nothing moving', file.width === 47 && file.height === 34 && file.dropIns[0].x === 14, `${file.width}x${file.height}`);
  report('...and the kept picture is the picture drawn whole', (await pictureDrift()) === 0);

  // North: a house planted past the top edge.
  await click('[data-place="building"][data-building="house"]');
  await drag(await tile(24, -2), await tile(24, -2), 1);
  file = await live();
  report('a house planted past the top grows the map north, two rows at a time', file.height === 34 + 4 && file.buildings.length === 1 && file.buildings[0].y === 2 && file.dropIns[0].y === 14, `${file.width}x${file.height} ${JSON.stringify(file.buildings)}`);
  report('...and the kept picture is the picture drawn whole', (await pictureDrift()) === 0);
  await shot('3-grown-three-ways');

  // Undo all the way back.
  for (let step = 0; step < 3; step += 1) {
    await key('z', 'KeyZ', 90, 2);
  }
  file = await live();
  report('undo takes every growth back off', file.width === 40 && file.height === 30, `${file.width}x${file.height}`);
  const anchorUndone = await tile(10, 10);
  report('...with the window held on the same ground', Math.abs(anchorUndone.x - anchorBefore.x) < 1 && Math.abs(anchorUndone.y - anchorBefore.y) < 1, `${anchorBefore.x},${anchorBefore.y} -> ${anchorUndone.x},${anchorUndone.y}`);
  report('...and the kept picture is the picture drawn whole', (await pictureDrift()) === 0);
  const errors = await evaluate('window.__errors');
  report('nothing threw', errors.length === 0, errors.join('; '));

  // Carried past the edge: the drop-in dragged off the east side with Select.
  await key('v', 'KeyV', 86);
  // Let go past the window's edge, over the column beside it: the drag still ends.
  await drag(await tile(10, 10), await tile(41, 10), 10);
  file = await live();
  report('a drop-in carried past the east edge, and let go over the column beside the window, still lands', file.dropIns[0].x > 30 && (await evaluate(`window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').stroke === undefined`)), `${file.width}x${file.height} ${JSON.stringify(file.dropIns[0])}`);
  // A district dragged out past the south-east corner.
  await click('[data-place="district"]');
  await drag(await tile(30, 20), await tile(41, 31), 10);
  file = await live();
  report('a district dragged out past the corner grows the map round it', file.width > 40 && file.height === 34 && file.districts?.[0]?.height === 12, `${file.width}x${file.height} ${JSON.stringify(file.districts)}`);
  report('...and the kept picture is the picture drawn whole', (await pictureDrift()) === 0);
  await key('z', 'KeyZ', 90, 2);
  await key('z', 'KeyZ', 90, 2);

  // Held past the window's edge: the window scrolls, the map grows as it goes.
  await key('b', 'KeyB', 66);
  await click('[data-brush="grass"]');
  const viewport = await evaluate(`(() => { const box = document.querySelector('[data-viewport]').getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom }; })()`);
  const startAt = await tile(30, 20);
  const widthBefore = (await live()).width;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startAt.x, y: startAt.y });
  await press(startAt.x, startAt.y);
  await move(viewport.right + 40, startAt.y);
  await sleep(2_500);
  await release(viewport.right + 40, startAt.y);
  await sleep(200);
  file = await live();
  report('a stroke held past the window edge scrolls on and grows the map as it goes', file.width > widthBefore + 10, `${widthBefore} -> ${file.width}`);
  report('...and the kept picture is the picture drawn whole', (await pictureDrift()) === 0);
  await shot('4-held-past-the-window');

  // At the cap: the room round a 256-wide map is nothing, east and west.
  await open(blank(256, 30));
  await key('b', 'KeyB', 66);
  await click('[data-brush="sand"]');
  await drag(await tile(253, 12), await tile(258, 12), 6);
  file = await live();
  report('the biggest map does not grow past the cap', file.width === 256, `${file.width}`);
} finally {
  await browser.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
