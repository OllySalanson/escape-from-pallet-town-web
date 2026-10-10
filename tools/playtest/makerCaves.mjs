// A cave, made in the map maker and walked in the game, the way a maker meets
// it: paint a rock face with the Box tool, cut a Cave mouth into its foot,
// MAKE ITS CAVE, dig a floor below it, then WALK IT - up into the mouth, down
// the ladder and back up it, out by the daylight, and across the cave floor
// until something lives there.
//
//   node tools/playtest/makerCaves.mjs <url of a test-mode build> <out dir> [--real]
//
// `--real` plays it at real speed on an ordinary build. It photographs every
// step at the 3x window, prints PASS or FAIL for what the game does, and exits
// non-zero on any FAIL. It starts from the sample map as a draft, with the one
// find that stands where the rock goes moved off it.
import { readFileSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const real = args.includes('--real');
const STORE = 'escape-from-pallet-town.maker.v1';
const url = new URL(base);
if (!real) {
  url.searchParams.set('testmode', 'pixels');
}
const sample = JSON.parse(
  readFileSync(new URL('../../src/maps/sample/sample-lane.json', import.meta.url), 'utf8'),
);
// The rock face goes east of the fenced field, four wide and five deep, with
// its mouth in the middle of its foot.
const ROCK = { from: { x: 26, y: 10 }, to: { x: 29, y: 14 } };
const MOUTH = { x: 27, y: 14 };
// And a second, in the field west of the lane, which is made a second way
// into the same cave.
const ROCK_WEST = { from: { x: 6, y: 2 }, to: { x: 9, y: 6 } };
const MOUTH_WEST = { x: 7, y: 6 };
const CAVE_WILDLIFE = ['zubat', 'diglett', 'sandshrew'];

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
  const press = (type, x, y) =>
    send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await press('mousePressed', x, y);
    await press('mouseReleased', x, y);
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
  /** Where the middle of a tile of the place on screen is, in the page. */
  const tileAt = (x, y) =>
    evaluate(
      `(() => { const canvas = document.querySelector('.map-maker canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = ${GAME}.scene.getScene('mapmaker').view; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`,
    );
  const clickTile = async (x, y) => {
    const at = await tileAt(x, y);
    await mouse(at.x, at.y);
    await sleep(150);
  };
  const drag = async (from, to) => {
    const start = await tileAt(from.x, from.y);
    const end = await tileAt(to.x, to.y);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y });
    await press('mousePressed', start.x, start.y);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: end.x,
      y: end.y,
      button: 'left',
      buttons: 1,
    });
    await press('mouseReleased', end.x, end.y);
    await sleep(200);
  };
  const maker = (expression) =>
    evaluate(`(() => { const s = ${GAME}.scene.getScene('mapmaker'); return ${expression}; })()`);

  await send('Page.navigate', { url: url.href });
  await page.waitFor(`Boolean(${GAME}?.scene?.getScene('title')?.sys?.isActive())`, {
    timeoutMs: 60_000,
  });
  const draft = {
    ...sample,
    id: 'sample-lane',
    maker: 'Probe',
    itemSpots: sample.itemSpots.map((spot) =>
      spot.x === 28 && spot.y === 12
        ? { x: 25, y: 13 }
        : spot.x === 8 && spot.y === 5
          ? { x: 11, y: 7 }
          : spot,
    ),
  };
  await evaluate(`(() => {
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts: [{ key: 'probe', file: draft, updatedAt: 1 }], current: 'probe' }))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    ${GAME}.scene.getScene('title').scene.start('mapmaker');
  })()`);
  await page.waitFor(`Boolean(document.querySelector('.map-maker canvas[data-map]'))`);
  await sleep(800);

  // A rock face, painted as a maker paints one: the Box tool and the Rock brush.
  await click('[data-tool="rect"]');
  await click('[data-brush="rock"]');
  await drag(ROCK.from, ROCK.to);
  const rock = await maker(
    `s.file.ground.slice(${ROCK.from.y}, ${ROCK.to.y + 1}).map((row) => row.slice(${ROCK.from.x}, ${ROCK.to.x + 1}))`,
  );
  report(
    'the Box tool paints a rock face',
    rock.every((row) => row === 'CCCC'),
    JSON.stringify(rock),
  );

  // A cave mouth in its foot, from the Nature list.
  await click('[data-building="cave-mouth"]');
  await clickTile(MOUTH.x, MOUTH.y);
  const mouth = await maker(
    `s.file.buildings.findIndex((b) => b.kind === 'cave-mouth' && b.x === ${MOUTH.x} && b.y === ${MOUTH.y})`,
  );
  report('a cave mouth is cut into the foot of the rock', mouth >= 0, String(mouth));
  await click('[data-tool="select"]');
  await clickTile(MOUTH.x, MOUTH.y);
  await sleep(300);
  const offer = await evaluate(`document.querySelector('[data-go-inside]')?.textContent ?? ''`);
  report('a cave mouth offers its cave', offer === 'Make its cave', offer);
  await shot('maker-1-mouth-chosen');

  await click('[data-go-inside]');
  await sleep(600);
  const cave = await maker(
    `({ area: s.area, kind: s.inside?.kind, size: [s.view.width, s.view.height], heading: document.querySelector('.maker-settings .px-heading h2')?.textContent })`,
  );
  report(
    'making it opens the cave',
    cave.kind === 'cave' && cave.heading === 'This cave',
    JSON.stringify(cave),
  );
  await shot('maker-2-cave');
  await evaluate(
    `document.querySelector('[data-plant="boulder"]')?.scrollIntoView({ block: 'center' })`,
  );
  await sleep(200);
  const pieces = await evaluate(
    `[...document.querySelectorAll('.maker-tools canvas[data-plant]')].map((canvas) => ({ kind: canvas.dataset.plant, drawn: canvas.getContext('2d').getImageData(0, 0, 16, 16).data.some((value, index) => index % 4 === 3 && value > 0) }))`,
  );
  report(
    "the cave's own pieces, each with its picture, and nothing from a house",
    pieces.length === 4 && pieces.every((piece) => piece.drawn),
    pieces.map((piece) => piece.kind).join(' '),
  );
  await shot('maker-2b-cave-pieces');

  // A floor below, down a ladder.
  await click('[data-add-below]');
  await sleep(600);
  const below = await maker(`({ area: s.area, name: s.inside?.name })`);
  report('adding a floor below opens it', below.name === 'Cave B1F', JSON.stringify(below));
  await shot('maker-3-below');
  await click(`[data-area="${cave.area}"]`);
  await sleep(400);
  await clickTile(10, 14);
  await sleep(300);
  const way = await evaluate(
    `document.querySelector('.maker-selected .px-heading h2')?.textContent ?? ''`,
  );
  report('the daylight in the south wall is the way out', way === 'Way out', way);
  await shot('maker-4-way-out-chosen');
  await click('[data-area=""]');
  await sleep(400);
  const failing = await maker(`s.checks.filter((check) => !check.passed).map((check) => check.id)`);
  // The walk the maker owes it is not a check on the file, and is not asked here.
  report('every check on the map passes', failing.length === 0, failing.join(' '));
  await shot('maker-5-outside');

  // A second way into the same cave, in two clicks: a second rock face and
  // its mouth, then INTO A CAVE YOU HAVE and the cave's south wall.
  await click('[data-tool="rect"]');
  await click('[data-brush="rock"]');
  await drag(ROCK_WEST.from, ROCK_WEST.to);
  await click('[data-building="cave-mouth"]');
  await clickTile(MOUTH_WEST.x, MOUTH_WEST.y);
  await click('[data-tool="select"]');
  await clickTile(MOUTH_WEST.x, MOUTH_WEST.y);
  await sleep(300);
  await click('[data-lead-into]');
  await sleep(300);
  const banner = await evaluate(`document.querySelector('.maker-passage')?.textContent ?? ''`);
  report('the second mouth asks where it comes out', /Where does it come out/.test(banner), banner);
  await shot('maker-6-where-does-it-come-out');
  await click(`[data-area="${cave.area}"]`);
  await sleep(300);
  await clickTile(4, 15);
  await sleep(300);
  const linked = await maker(
    `({ links: s.file.links.length, doorway: s.doorway, heading: document.querySelector('.maker-selected .px-heading h2')?.textContent })`,
  );
  report(
    'clicking the south wall cuts a second way out there',
    linked.links === 3 && linked.heading === 'Way out',
    JSON.stringify(linked),
  );
  await shot('maker-7-second-way-out');
  await click('[data-go-end]');
  await sleep(300);
  const otherEnd = await maker(`({ area: s.area ?? null, doorway: s.doorway })`);
  report(
    'and goes to its other end, the mouth outside',
    otherEnd.area === null,
    JSON.stringify(otherEnd),
  );
  await shot('maker-8-the-other-end');
  const stillFailing = await maker(
    `s.checks.filter((check) => !check.passed).map((check) => check.id)`,
  );
  report('every check on the map still passes', stillFailing.length === 0, stillFailing.join(' '));

  // Walk it.
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
  const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const standAt = (tile, facing = 'up') =>
    evaluate(
      `(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16; w.currentTile = { x: ${tile.x}, y: ${tile.y} }; w.setPlayerPosition(${tile.x} * 16, ${tile.y} * 16 + off); w.facing = '${facing}'; })()`,
    );
  const pushToward = async (toward) => {
    await page.keyDown(keyFor[toward]);
    await wait(300);
    await page.keyUp(keyFor[toward]);
    await wait(1200);
  };
  const where = () =>
    evaluate(
      `(() => { const w = ${GAME}.scene.getScene('world'); return { tile: w.currentTile, facing: w.facing, area: w.currentArea()?.name }; })()`,
    );
  const front = { x: MOUTH.x, y: MOUTH.y + 1 };
  await standAt(front);
  await wait(400);
  await shot('play-1-at-the-mouth');
  await pushToward('up');
  const inCave = await where();
  report(
    'walking up into the mouth goes into the cave, facing in',
    inCave.area === 'Cave' && inCave.facing === 'up',
    JSON.stringify(inCave),
  );
  await shot('play-2-in-the-cave');

  // Down the ladder and back up it.
  const ladder = await evaluate(
    `(() => { const w = ${GAME}.scene.getScene('world'); const area = (tile) => w.currentMap.areas.find(({ rect }) => tile.x >= rect.x && tile.y >= rect.y && tile.x < rect.x + rect.width && tile.y < rect.y + rect.height)?.name; const down = w.currentMap.warps.find((warp) => area(warp.source) === 'Cave' && area(warp.destination) === 'Cave B1F'); const up = w.currentMap.warps.find((warp) => area(warp.source) === 'Cave B1F' && area(warp.destination) === 'Cave'); return down && up ? { from: down.source, to: down.destination, down: down.toward, up: up.toward } : null; })()`,
  );
  await standAt(ladder.from);
  await wait(300);
  await shot('play-3-at-the-ladder-down');
  await pushToward(ladder.down);
  const deeper = await where();
  report(
    'walking into the hole goes down the ladder, onto its foot below',
    deeper.area === 'Cave B1F' && deeper.tile.x === ladder.to.x && deeper.tile.y === ladder.to.y,
    JSON.stringify(deeper),
  );
  await shot('play-4-below');
  // One press, facing away from the ladder as a player arrives: it turns and
  // climbs in the same press.
  await pushToward(ladder.up);
  const back = await where();
  report(
    'and pressing up from its foot climbs back up',
    back.area === 'Cave',
    JSON.stringify(back),
  );

  // Out by the daylight.
  await standAt(inCave.tile);
  await wait(300);
  await pushToward('down');
  const out = await where();
  report(
    'walking down into the daylight comes out in front of the mouth, facing away',
    out.tile.x === front.x && out.tile.y === front.y && out.facing === 'down',
    JSON.stringify(out),
  );
  await shot('play-5-out-again');

  // In by the second mouth, which comes out at the second daylight.
  await standAt({ x: MOUTH_WEST.x, y: MOUTH_WEST.y + 1 });
  await wait(300);
  await pushToward('up');
  const second = await evaluate(
    `(() => { const w = ${GAME}.scene.getScene('world'); const rect = w.currentArea()?.rect; return { area: w.currentArea()?.name, at: rect ? { x: w.currentTile.x - rect.x, y: w.currentTile.y - rect.y } : null }; })()`,
  );
  report(
    'the second mouth goes into the same cave, at its second way out',
    second.area === 'Cave' && second.at?.x === 4 && second.at?.y === 14,
    JSON.stringify(second),
  );
  await shot('play-5b-in-by-the-second-mouth');
  await standAt({ x: MOUTH.x, y: MOUTH.y + 1 });
  await wait(300);

  // And back in, to walk the floor until something lives there.
  await pushToward('up');
  const open = await evaluate(
    `(() => { const w = ${GAME}.scene.getScene('world'); const rect = w.currentArea().rect; return { x: rect.x + 9, y: rect.y + 8 }; })()`,
  );
  await standAt(open, 'left');
  await wait(300);
  let met;
  for (let step = 0; step < 240 && !met; step += 1) {
    await page.tap(step % 6 < 3 ? 'ArrowLeft' : 'ArrowRight');
    await wait(250);
    met = await evaluate(
      `(() => { const b = ${GAME}.scene.getScene('battle'); return b?.sys?.isActive() && b.state ? (b.state.enemy.pokemon.base.id ?? b.state.enemy.pokemon.base.name) : undefined; })()`,
    );
  }
  report(
    "the cave floor is wild ground, and what lives there is a cave's",
    CAVE_WILDLIFE.includes(String(met).toLowerCase()),
    String(met),
  );
  if (met) {
    await wait(1500);
    await shot('play-6-met-in-the-cave');
  }
  const errors = await evaluate('window.__errors ?? []');
  report('no errors on the page', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = results.every(Boolean) ? 0 : 1;
