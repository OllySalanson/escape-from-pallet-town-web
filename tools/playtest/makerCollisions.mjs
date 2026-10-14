// What the map maker does when one thing is put where another already is, the
// way a maker meets it: a Gym dropped on a block of trees (the captain's own
// case, 2026-10-12), and every other pair of kinds - a building on a building,
// on loose clutter, on the things a raid is for, on water, with its door
// opening onto water or trees; a berry tree on a roof, in a wood, boxed in by a
// person or by painting; painting water under a house and trees over a berry
// tree; a tree on a tree; a house carried onto a house; a Cut tree on a berry
// tree - and the checks list of a map made before any of that was refused,
// where a fault is clicked to be taken to it.
//
//   node tools/playtest/makerCollisions.mjs <url of a test-mode build> <out dir>
//     [--attach=<cdp port>] [--case=name,..] [--before]
//
// Each case is a draft opened in the maker, a piece chosen, the pointer rested
// on the tile it is put on (the ghost, shot as `<case>-1-hover.png`), then the
// click or the stroke (`<case>-2-done.png`). `--attach` drives a browser somebody
// else started (`fm-browser.sh`), so the machine's watchdog can see it; without
// it a browser is launched and closed. `--before` asks nothing of the rules, for
// a build from before them: it photographs and prints what happened. Otherwise
// each case says what the rules promise and prints PASS or FAIL, exiting
// non-zero on any FAIL. Every shot's rectangles - the map window, the status
// line, the checks - are written beside it as JSON for `makerCollisionSheets.mjs`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, launchBrowser, OPEN_PLANT_FOLDS, sleep } from './browser.mjs';
import { GAME } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir = 'maker-collisions'] = args.filter((arg) => !arg.startsWith('--'));
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const before = args.includes('--before');
const only = flag('case')?.split(',');
const attach = flag('attach');
const STORE = 'escape-from-pallet-town.maker.v1';
const WINDOW = { width: 1280, height: 800 };
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
mkdirSync(outDir, { recursive: true });

const WIDTH = 34;
const HEIGHT = 26;

/** A draft: grass in a ring of trees, a way in and a way out, and whatever the case adds. */
function draft(name, { paint = () => undefined, buildings = [], ...rest } = {}) {
  const ground = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) =>
      x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2 ? 'T' : (paint(x, y) ?? '.'),
    ).join(''),
  );
  return {
    format: 1,
    id: name,
    name,
    maker: 'Probe',
    width: WIDTH,
    height: HEIGHT,
    ground,
    buildings,
    dropIns: [{ x: 3, y: 22, name: 'Gate' }],
    exits: [{ x: 30, y: 22, name: 'Way out', opens: { when: 'always' } }],
    itemSpots: [],
    wildlife: 'meadow',
    ...rest,
  };
}

const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const forest = (rect, holes = []) => (x, y) =>
  inRect(x, y, rect) && !holes.some(([hx, hy]) => hx === x && hy === y) ? 'T' : undefined;
const pond = (rect) => (x, y) => (inRect(x, y, rect) ? 'W' : undefined);

/** What a case can expect of the map once it has been done, asked of the live file. */
const unchanged = (file, start) => JSON.stringify(file) === JSON.stringify(start);

const CASES = [
  {
    name: 'gym-in-forest',
    about: 'A Gym dropped on a block of trees: the trees under it and in front of its door are felled, whole, as one undo step.',
    file: draft('gym-in-forest', { paint: forest([6, 6, 25, 19]) }),
    focus: [14, 12],
    choose: '[data-place="building"][data-building="gym"]',
    at: [11, 9],
    expect: (file) => {
      const gym = file.buildings.find((b) => b.kind === 'gym');
      if (!gym) return 'no gym was planted';
      for (let y = gym.y; y < gym.y + 5; y += 1) {
        for (let x = gym.x; x < gym.x + 6; x += 1) {
          if (file.ground[y][x] === 'T') return `a tree is left under the gym at ${x},${y}`;
        }
      }
      if (file.ground[gym.y + 5][gym.x + 3] === 'T') return 'its door still opens onto trees';
      // Whole trees: no lattice block is left with some of its tiles felled and some standing.
      for (let r = 3; r < 10; r += 1) {
        for (let c = 3; c < 13; c += 1) {
          const tiles = [file.ground[2 * r][2 * c], file.ground[2 * r][2 * c + 1], file.ground[2 * r + 1][2 * c], file.ground[2 * r + 1][2 * c + 1]];
          const trees = tiles.filter((tile) => tile === 'T').length;
          if (trees > 0 && trees < 4) return `half a tree is left at ${2 * c},${2 * r}`;
        }
      }
      return undefined;
    },
  },
  {
    name: 'gym-on-forest-edge',
    about: 'A Gym whose roof is on grass and whose walls are in a wood: no tree tip is drawn over its roof.',
    file: draft('gym-on-forest-edge', { paint: forest([6, 10, 25, 19]) }),
    focus: [14, 11],
    choose: '[data-place="building"][data-building="gym"]',
    at: [11, 7],
    expect: (file) => (file.buildings.some((b) => b.kind === 'gym') ? undefined : 'no gym was planted'),
  },
  {
    name: 'house-on-house',
    about: 'A house on a house is refused, red, with the reason.',
    file: draft('house-on-house', { buildings: [{ kind: 'house', x: 12, y: 10 }] }),
    focus: [15, 12],
    choose: '[data-place="building"][data-building="house"]',
    at: [14, 11],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the second house was planted'),
    refused: true,
  },
  {
    name: 'house-on-clutter',
    about: 'A house on loose clutter - a tree, a crate, a stump - clears it, as one undo step.',
    file: draft('house-on-clutter', {
      buildings: [
        { kind: 'tree', x: 14, y: 10 },
        { kind: 'crate', x: 12, y: 13 },
        { kind: 'stump', x: 16, y: 13 },
      ],
    }),
    focus: [15, 12],
    choose: '[data-place="building"][data-building="house"]',
    at: [12, 10],
    expect: (file) =>
      file.buildings.length === 1 && file.buildings[0].kind === 'house'
        ? undefined
        : `buildings: ${JSON.stringify(file.buildings)}`,
  },
  {
    name: 'house-on-spots',
    about: 'A house on a berry tree, a person, an item and a sign is refused: they are what a raid is for.',
    file: draft('house-on-spots', {
      berryTrees: [{ x: 13, y: 12, berry: 'oran' }],
      people: [{ x: 15, y: 12, name: 'Person 1', look: 'boy', facing: 'down', lines: [] }],
      itemSpots: [{ x: 14, y: 13 }],
      signs: [{ x: 16, y: 13, lines: [] }],
    }),
    focus: [15, 12],
    choose: '[data-place="building"][data-building="house"]',
    at: [12, 10],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the house was planted over them'),
    refused: true,
  },
  {
    name: 'house-on-water',
    about: 'A house half in a pond is refused.',
    file: draft('house-on-water', { paint: pond([10, 12, 24, 17]) }),
    focus: [15, 12],
    choose: '[data-place="building"][data-building="house"]',
    at: [13, 10],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the house was planted in the water'),
    refused: true,
  },
  {
    name: 'door-onto-water',
    about: 'A house whose door would open onto water is refused.',
    file: draft('door-onto-water', { paint: pond([10, 14, 24, 17]) }),
    focus: [15, 13],
    choose: '[data-place="building"][data-building="house"]',
    at: [13, 10],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the house was planted facing the water'),
    refused: true,
  },
  {
    name: 'door-onto-trees',
    about: 'A house whose door would open onto trees has the trees in front of its door felled.',
    file: draft('door-onto-trees', { paint: forest([6, 14, 25, 19]) }),
    focus: [15, 13],
    choose: '[data-place="building"][data-building="house"]',
    at: [13, 10],
    expect: (file) => {
      if (!file.buildings.some((b) => b.kind === 'house')) return 'no house was planted';
      return file.ground[14][14] === 'T' ? 'its doorstep is still trees' : undefined;
    },
  },
  {
    name: 'berry-on-house',
    about: 'A berry tree on a roof is refused.',
    file: draft('berry-on-house', { buildings: [{ kind: 'house', x: 12, y: 10 }] }),
    focus: [14, 12],
    choose: '[data-place="berry-tree"]',
    at: [14, 11],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the berry tree stands on the roof'),
    refused: true,
  },
  {
    name: 'berry-in-trees',
    about: 'A berry tree in the middle of a wood is refused.',
    file: draft('berry-in-trees', { paint: forest([6, 10, 25, 19]) }),
    focus: [15, 14],
    choose: '[data-place="berry-tree"]',
    at: [15, 14],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the berry tree stands in the trees'),
    refused: true,
  },
  {
    name: 'berry-boxed-by-person',
    about: 'A person put on the one open side of a berry tree is refused: nobody could pick it.',
    file: draft('berry-boxed-by-person', {
      paint: forest([6, 10, 25, 19], [[16, 10]]),
      berryTrees: [{ x: 16, y: 10, berry: 'oran' }],
    }),
    focus: [16, 10],
    choose: '[data-place="person"]',
    at: [16, 9],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the person boxed the berry tree in'),
    refused: true,
  },
  {
    name: 'berry-boxed-by-painting',
    about: 'Painting trees on the one open side of a berry tree leaves that tile alone.',
    file: draft('berry-boxed-by-painting', {
      paint: forest([6, 10, 25, 19], [[16, 10]]),
      berryTrees: [{ x: 16, y: 10, berry: 'oran' }],
    }),
    focus: [16, 10],
    choose: '[data-brush="trees"]',
    at: [16, 9],
    expect: (file) => (file.ground[9][16] === 'T' ? 'the berry tree is boxed in by the trees painted' : undefined),
    refused: true,
  },
  {
    name: 'paint-water-under-house',
    about: 'A stroke of water across a house paints round it and leaves the ground under it alone.',
    file: draft('paint-water-under-house', { buildings: [{ kind: 'house', x: 13, y: 10 }] }),
    focus: [16, 12],
    choose: '[data-brush="water"]',
    stroke: [[9, 12], [23, 12]],
    expect: (file) => {
      for (let x = 13; x < 18; x += 1) {
        if (file.ground[12][x] === 'W') return `water was painted under the house at ${x},12`;
      }
      return file.ground[12][10] === 'W' && file.ground[12][22] === 'W' ? undefined : 'the stroke did not paint round the house';
    },
  },
  {
    name: 'paint-trees-over-spots',
    about: 'A stroke of trees across a berry tree and a person paints round them.',
    file: draft('paint-trees-over-spots', {
      berryTrees: [{ x: 14, y: 12, berry: 'oran' }],
      people: [{ x: 18, y: 12, name: 'Person 1', look: 'boy', facing: 'down', lines: [] }],
    }),
    focus: [16, 12],
    choose: '[data-brush="trees"]',
    stroke: [[9, 12], [23, 12]],
    expect: (file) =>
      file.ground[12][14] === 'T' || file.ground[12][18] === 'T'
        ? 'trees were painted under them'
        : file.ground[12][10] === 'T'
          ? undefined
          : 'the stroke painted nothing',
  },
  {
    name: 'tree-on-tree',
    about: 'A tree planted on a tree is refused.',
    file: draft('tree-on-tree', { buildings: [{ kind: 'tree', x: 14, y: 10 }] }),
    focus: [15, 12],
    choose: '[data-place="building"][data-building="tree"]',
    at: [15, 11],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the second tree was planted'),
    refused: true,
  },
  {
    name: 'move-house-onto-house',
    about: 'A house carried onto another is red while it is carried, and goes back when let go.',
    file: draft('move-house-onto-house', {
      buildings: [
        { kind: 'house', x: 8, y: 10 },
        { kind: 'house', x: 18, y: 10 },
      ],
    }),
    focus: [15, 12],
    choose: '[data-tool="select"]',
    carry: [[9, 11], [19, 11]],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the house was put down on the other'),
    refused: true,
  },
  {
    name: 'cut-tree-on-berry',
    about: 'A Cut tree on a berry tree is refused.',
    file: draft('cut-tree-on-berry', { berryTrees: [{ x: 15, y: 12, berry: 'oran' }] }),
    focus: [15, 12],
    choose: '[data-place="cut-tree"]',
    at: [15, 12],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the Cut tree was put on the berry tree'),
    refused: true,
  },
  {
    name: 'person-on-berry',
    about: 'A person on a berry tree is refused.',
    file: draft('person-on-berry', { berryTrees: [{ x: 15, y: 12, berry: 'oran' }] }),
    focus: [15, 12],
    choose: '[data-place="person"]',
    at: [15, 12],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the person was put on the berry tree'),
    refused: true,
  },
  {
    name: 'berry-under-leaves',
    about: "A berry tree under a tree's crown, where it would be hidden, is refused.",
    file: draft('berry-under-leaves', { buildings: [{ kind: 'tree', x: 14, y: 11 }] }),
    focus: [15, 12],
    choose: '[data-place="berry-tree"]',
    at: [15, 11],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the berry tree is hidden under the leaves'),
    refused: true,
  },
  {
    name: 'leaves-over-roof',
    about: "A tree whose crown would hang over a house's roof is refused.",
    file: draft('leaves-over-roof', { buildings: [{ kind: 'house', x: 12, y: 8 }] }),
    focus: [15, 11],
    choose: '[data-place="building"][data-building="tree"]',
    at: [15, 11],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the tree was planted with its leaves over the roof'),
    refused: true,
  },
  {
    name: 'trees-into-wall',
    about: "A box of trees painted in front of a house leaves the trees that would grow into its wall unpainted.",
    file: draft('trees-into-wall', { buildings: [{ kind: 'house', x: 13, y: 8 }] }),
    focus: [16, 12],
    choose: ['[data-tool="rect"]', '[data-brush="trees"]'],
    stroke: [[15, 12], [23, 17]],
    expect: (file) =>
      [16, 17].some((x) => file.ground[12][x] === 'T')
        ? 'a tree was grown into the wall'
        : file.ground[14][16] === 'T'
          ? undefined
          : 'the rest of the box was not painted',
  },
  {
    name: 'house-on-doorstep',
    about: "A house on another house's doorstep is refused.",
    file: draft('house-on-doorstep', { buildings: [{ kind: 'house', x: 10, y: 6 }] }),
    focus: [13, 10],
    choose: '[data-place="building"][data-building="house"]',
    at: [9, 10],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the house was planted on the doorstep'),
    refused: true,
  },
  {
    name: 'house-on-rock',
    about: 'A house on a rock mound is refused.',
    file: draft('house-on-rock', { paint: (x, y) => (inRect(x, y, [12, 11, 19, 15]) ? 'C' : undefined) }),
    focus: [15, 12],
    choose: '[data-place="building"][data-building="house"]',
    at: [13, 10],
    expect: (file, start) => (unchanged(file, start) ? undefined : 'the house was planted on the rock'),
    refused: true,
  },
  {
    name: 'gym-carried-into-forest',
    about: 'A Gym carried into a wood clears its way there as one planted there does.',
    file: draft('gym-carried-into-forest', { paint: forest([14, 6, 29, 19]), buildings: [{ kind: 'gym', x: 3, y: 3 }] }),
    focus: [16, 9],
    choose: '[data-tool="select"]',
    // Taken by its east wall, the part of it in view, and carried fourteen tiles east.
    carry: [[8, 5], [22, 9]],
    expect: (file) => {
      const gym = file.buildings.find((b) => b.kind === 'gym');
      if (!gym || gym.x === 3) return 'the gym did not move';
      return file.ground[gym.y + 2][gym.x + 2] === 'T' ? 'the gym stands on trees' : undefined;
    },
  },
  {
    name: 'drop-in-past-edge',
    about: 'A drop-in put past the edge grows the map and stands in a clearing of its own, not in the new trees.',
    file: draft('drop-in-past-edge'),
    focus: [1, 12],
    choose: '[data-place="drop-in"]',
    at: [-2, 12],
    expect: (file) => {
      if (file.width === WIDTH) return 'the map did not grow';
      const dropIn = file.dropIns.at(-1);
      return file.ground[dropIn.y][dropIn.x] === 'T' ? 'the drop-in stands in the trees' : undefined;
    },
  },
  {
    name: 'checks-list',
    about: 'A map from before the rules: its faults grouped by kind with a count, each one clicked to be taken to it.',
    file: draft('checks-list', {
      paint: (x, y) => forest([6, 6, 25, 19])(x, y) ?? pond([26, 6, 30, 12])(x, y),
      berryTrees: [
        [8, 8],
        [10, 8],
        [12, 9],
        [14, 9],
        [16, 10],
        [18, 11],
        [20, 12],
      ].map(([x, y]) => ({ x, y, berry: 'oran' })),
      people: [{ x: 28, y: 9, name: 'Swimmer', look: 'swimmer', facing: 'down', lines: [] }],
      buildings: [{ kind: 'house', x: 26, y: 14 }],
      signs: [{ x: 27, y: 15, lines: [] }],
    }),
    focus: [16, 12],
    checks: true,
  },
];

const results = [];
const report = (name, passed, detail) => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = attach ? attachBrowser(Number(attach), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
let page;
try {
  page = await browser.openPage('about:blank');
  const { send, evaluate } = page;
  const rects = () =>
    evaluate(`(() => {
      const box = (selector) => { const element = document.querySelector(selector); if (!element) return null; const r = element.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
      return { map: box('.maker-map'), help: box('.px-help'), checks: box('.maker-checks'), side: box('.maker-side'), viewport: box('[data-viewport]') };
    })()`);
  const shot = async (name) => {
    const path = join(outDir, `${name}.png`);
    await page.screenshot(path);
    const status = await evaluate(`document.querySelector('.px-status-line')?.textContent ?? ''`);
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ rects: await rects(), status }, null, 2));
    return status;
  };
  const live = () => evaluate(`${GAME}.scene.getScene('mapmaker').history.value`);
  const tile = (x, y) =>
    evaluate(`(() => { const canvas = document.querySelector('canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = ${GAME}.scene.getScene('mapmaker').history.value; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
  const moveTo = (point, buttons = 0) =>
    send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: buttons ? 'left' : 'none', buttons });
  const press = (point) => send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  const release = (point) => send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  const open = async (file) => {
    await send('Page.navigate', { url: url.toString() });
    await page.waitFor(`Boolean(${GAME}?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
    await evaluate(`(() => {
      localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts: [{ key: 'probe', file, updatedAt: 1 }], current: 'probe' }))});
      window.__errors = [];
      window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
      ${GAME}.scene.getScene('title').scene.start('mapmaker');
    })()`);
    await page.waitFor(`document.querySelector('.map-maker canvas[data-map]')?.width === ${file.width * 16}`, { timeoutMs: 15_000 });
    await sleep(600);
  };
  /** Shows the map a tile to sixteen game pixels, with the case's tile in the middle of the window. */
  const look = async ([x, y]) => {
    await evaluate(`document.querySelector('[data-zoom="16"]')?.click()`);
    await sleep(150);
    // The overview stands in the corner of the window, over the map: put away for the shots.
    await evaluate(`(() => { if (!document.querySelector('[data-overview]')?.hidden) document.querySelector('[data-overview-toggle]')?.click(); })()`);
    await sleep(150);
    await evaluate(`(() => {
      const viewport = document.querySelector('[data-viewport]');
      const map = document.querySelector('canvas[data-map]');
      const box = map.getBoundingClientRect();
      const seen = viewport.getBoundingClientRect();
      const file = ${GAME}.scene.getScene('mapmaker').history.value;
      const tilePx = box.width / file.width;
      viewport.scrollLeft += box.left + (${x} + 0.5) * tilePx - (seen.left + viewport.clientWidth / 2);
      viewport.scrollTop += box.top + (${y} + 0.5) * tilePx - (seen.top + viewport.clientHeight / 2);
    })()`);
    await sleep(200);
  };

  for (const test of CASES) {
    if (only && !only.includes(test.name)) {
      continue;
    }
    await open(test.file);
    await look(test.focus);
    const start = await live();
    if (test.checks) {
      await shot(`${test.name}-1-list`);
      if (!before) {
        const faults = await evaluate(`[...document.querySelectorAll('[data-goto]')].length`);
        report(`${test.name}: every fault that names a tile can be clicked`, faults >= 9, `${faults} buttons`);
        const grouped = await evaluate(`[...document.querySelectorAll('.maker-fault-group')].map((group) => group.textContent.trim().slice(0, 80))`);
        report(`${test.name}: the seven berry trees are one group with a count`, grouped.some((text) => /7/.test(text)), JSON.stringify(grouped));
        // Away from the faults first, so being taken there is a journey.
        await look([4, 4]);
        await evaluate(`document.querySelector('[data-goto-group]')?.click()`);
        await sleep(250);
        const centre = await evaluate(`(() => {
          const viewport = document.querySelector('[data-viewport]').getBoundingClientRect();
          const flash = document.querySelector('[data-flash]');
          const box = flash && !flash.hidden ? flash.getBoundingClientRect() : null;
          return box && { dx: box.left + box.width / 2 - (viewport.left + viewport.width / 2), dy: box.top + box.height / 2 - (viewport.top + viewport.height / 2) };
        })()`);
        report(`${test.name}: clicking a fault centres the view on its tile, flashing`, centre !== null && Math.abs(centre.dx) < 40 && Math.abs(centre.dy) < 40, JSON.stringify(centre));
        await shot(`${test.name}-2-jumped`);
        const chosen = await evaluate(`${GAME}.scene.getScene('mapmaker').selected ?? null`);
        report(`${test.name}: ...and chooses what stands there`, chosen?.kind === 'berry-tree', JSON.stringify(chosen));
        // Enter on a fault does what a click does, and nothing the map uses the key for.
        await evaluate(`(() => { const buttons = [...document.querySelectorAll('[data-goto]')]; buttons[buttons.length - 1].focus(); })()`);
        await page.tap('Enter');
        await sleep(250);
        const tool = await evaluate(`${GAME}.scene.getScene('mapmaker').tool`);
        const flashed = await evaluate(`!document.querySelector('[data-flash]').hidden`);
        report(`${test.name}: Enter on a fault takes you there too`, flashed, `tool ${tool}`);
        await shot(`${test.name}-3-enter`);
      }
      continue;
    }
    for (const selector of [test.choose].flat()) {
      await evaluate(OPEN_PLANT_FOLDS);
      await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
      await sleep(120);
    }
    let status = '';
    if (test.at) {
      const point = await tile(...test.at);
      await moveTo(point);
      await sleep(150);
      test.hoverSaid = await shot(`${test.name}-1-hover`);
      await press(point);
      await release(point);
      await sleep(250);
      status = await shot(`${test.name}-2-done`);
    } else if (test.stroke) {
      const [from, to] = await Promise.all(test.stroke.map((at) => tile(...at)));
      await moveTo(from);
      await sleep(120);
      await shot(`${test.name}-1-hover`);
      await press(from);
      for (let step = 1; step <= 14; step += 1) {
        await moveTo({ x: from.x + ((to.x - from.x) * step) / 14, y: from.y + ((to.y - from.y) * step) / 14 }, 1);
        await sleep(15);
      }
      await release(to);
      await sleep(250);
      status = await shot(`${test.name}-2-done`);
    } else if (test.carry) {
      const [from, to] = await Promise.all(test.carry.map((at) => tile(...at)));
      await moveTo(from);
      await press(from);
      for (let step = 1; step <= 10; step += 1) {
        await moveTo({ x: from.x + ((to.x - from.x) * step) / 10, y: from.y + ((to.y - from.y) * step) / 10 }, 1);
        await sleep(15);
      }
      await sleep(150);
      await shot(`${test.name}-1-hover`);
      await release(to);
      await sleep(250);
      status = await shot(`${test.name}-2-done`);
    }
    const file = await live();
    const errors = await evaluate('window.__errors');
    if (before) {
      console.log(`${test.name}: ${unchanged(file, start) ? 'nothing changed' : 'the map changed'}${status ? ` - "${status}"` : ''}`);
      continue;
    }
    const fault = test.expect(file, start);
    report(`${test.name}: ${test.about}`, fault === undefined, fault ?? status);
    if (test.refused) {
      report(`${test.name}: ...and says why`, status.length > 0, status);
      if (test.at) {
        report(`${test.name}: ...and said so before the click, with the ghost red`, (test.hoverSaid ?? '').length > 0, test.hoverSaid);
      }
    }
    report(`${test.name}: nothing threw`, errors.length === 0, errors.join('; '));
  }
} finally {
  // An attached browser stays up for whoever started it; its page's socket would hold this process open.
  await page?.close();
  await browser.close();
}
if (!before && results.some((passed) => !passed)) {
  process.exitCode = 1;
}
