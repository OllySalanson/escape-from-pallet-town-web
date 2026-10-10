// The inside of a building, made in the map maker and walked into in the game,
// the way a maker meets it: Select the house, MAKE ITS INSIDE, look round the
// room, WALK IT, walk up to the door and press into it, and back out.
//
//   node tools/playtest/makerAreas.mjs <url of a test-mode build> <out dir> [--real]
//
// `--real` plays it at real speed on an ordinary build, waiting on the clock
// rather than stepping frames: the one pass at the speed a player plays.
//
// It photographs every step at the 3x window and prints PASS or FAIL for what
// the game does - where the player stands, which place the camera frames - and
// exits non-zero on any FAIL. It starts from the sample map as a draft, so the
// house is the open-door house at the top of the lane (`maps/sample/`).
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
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const click = async (selector) => {
    const at = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element?.scrollIntoView({ block: 'nearest' }); const box = element?.getBoundingClientRect(); return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null; })()`);
    if (!at) {
      throw new Error(`nothing on screen matches ${selector}`);
    }
    await mouse(at.x, at.y);
    await sleep(150);
  };
  /** Clicks the middle of a tile of the map in the maker's canvas. */
  const clickTile = async (x, y) => {
    const at = await evaluate(`(() => { const canvas = document.querySelector('.map-maker canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = ${GAME}.scene.getScene('mapmaker').view; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
    await mouse(at.x, at.y);
    await sleep(150);
  };

  await send('Page.navigate', { url: url.href });
  await page.waitFor(`Boolean(${GAME}?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
  const draft = { ...sample, id: 'sample-lane', maker: 'Probe' };
  await evaluate(`(() => {
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts: [{ key: 'probe', file: draft, updatedAt: 1 }], current: 'probe' }))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    ${GAME}.scene.getScene('title').scene.start('mapmaker');
  })()`);
  await page.waitFor(`Boolean(document.querySelector('.map-maker [data-stack]'))`);
  await sleep(800);

  // Select the house and look at what the chosen panel offers.
  await click('[data-tool="select"]');
  const house = sample.buildings[0];
  await clickTile(house.x + 2, house.y + 1);
  await sleep(300);
  const offer = await evaluate(`document.querySelector('[data-go-inside]')?.textContent ?? ''`);
  report('a house with a door offers an inside', offer === 'Make its inside', offer);
  await shot('maker-1-house-chosen');

  await click('[data-go-inside]');
  await sleep(600);
  const inside = await evaluate(`(() => { const s = ${GAME}.scene.getScene('mapmaker'); return { area: s.area, size: [s.view.width, s.view.height], heading: document.querySelector('.maker-map .px-heading h2')?.textContent }; })()`);
  report('making it opens the inside', inside.area === 'house', JSON.stringify(inside));
  await shot('maker-2-inside');
  // The furniture of the room, each row pictured on the room's own floor.
  await evaluate(`document.querySelector('[data-plant="bed"]')?.scrollIntoView({ block: 'start' })`);
  await sleep(200);
  const pictured = await evaluate(`[...document.querySelectorAll('.maker-tools canvas[data-plant]')].every((canvas) => canvas.width === 16 && canvas.getContext('2d').getImageData(0, 0, 16, 16).data.some((value, index) => index % 4 === 3 && value > 0))`);
  report('every piece of furniture has a picture', pictured);
  await shot('maker-2b-furniture');

  // A floor above: stairs up against the back wall, and the bedroom they lead to.
  await click('[data-add-upstairs]');
  await sleep(600);
  const above = await evaluate(`${GAME}.scene.getScene('mapmaker').area`);
  report('adding an upstairs opens the floor above', above === 'house-2f', String(above));
  await shot('maker-2c-upstairs');
  await click('[data-area="house"]');
  await sleep(400);

  // Choose the mat, so its panel says where it goes: by the west end, under
  // the house's own door, as FireRed's is.
  await clickTile(3, 8);
  await sleep(300);
  const way = await evaluate(`document.querySelector('.maker-selected .px-heading h2')?.textContent ?? ''`);
  report('the mat is the way out', way === 'Way out', way);
  await shot('maker-3-mat-chosen');

  // Back outside: the strip shows both places, and the house's door is marked.
  await click('[data-area=""]');
  await sleep(400);
  await shot('maker-4-outside-again');

  // Walk it.
  await click('[data-try="walk"]');
  await page.waitFor(`Boolean(${GAME}.scene.getScene('world')?.sys?.isActive())`, { timeoutMs: 20_000 });
  if (!real) {
    await evaluate(`${GAME}.pauseLoop()`);
  }
  await wait(800);
  for (let i = 0; i < 8; i += 1) {
    await page.tap('Space');
    await wait(200);
  }
  const front = { x: house.x + 1, y: house.y + 4 };
  await evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16;
    w.currentTile = { x: ${front.x}, y: ${front.y} }; w.setPlayerPosition(${front.x} * 16, ${front.y} * 16 + off); w.facing = 'up'; })()`);
  await wait(400);
  await shot('play-1-at-the-door');
  await page.keyDown('ArrowUp');
  await wait(300);
  await page.keyUp('ArrowUp');
  await wait(1200);
  const inHouse = await evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return { tile: w.currentTile, facing: w.facing, area: w.currentArea()?.name, plate: w.placeName }; })()`);
  report('pressing into the door goes in, onto the mat, facing in', inHouse.area === 'House' && inHouse.facing === 'up', JSON.stringify(inHouse));
  await shot('play-2-inside');
  // Up the stairs and back down them: stand at the foot of each and press up.
  const stairs = await evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const area = (tile) => w.currentMap.areas.find(({ rect }) => tile.x >= rect.x && tile.y >= rect.y && tile.x < rect.x + rect.width && tile.y < rect.y + rect.height)?.name; const up = w.currentMap.warps.find((warp) => area(warp.source) === 'House' && area(warp.destination) === 'House 2F'); const down = w.currentMap.warps.find((warp) => area(warp.source) === 'House 2F' && area(warp.destination) === 'House'); return up && down ? { from: up.source, to: up.destination, up: up.toward, down: down.toward } : null; })()`);
  const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const standAt = (tile) => evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16; w.currentTile = { x: ${tile.x}, y: ${tile.y} }; w.setPlayerPosition(${tile.x} * 16, ${tile.y} * 16 + off); w.facing = 'up'; })()`);
  await standAt(stairs.from);
  await wait(300);
  await page.keyDown(keyFor[stairs.up]);
  await wait(300);
  await page.keyUp(keyFor[stairs.up]);
  await wait(1200);
  const upstairs = await evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return { tile: w.currentTile, area: w.currentArea()?.name }; })()`);
  report('pressing towards the stairs from their rug goes up them', upstairs.area === 'House 2F' && upstairs.tile.x === stairs.to.x && upstairs.tile.y === stairs.to.y, JSON.stringify(upstairs));
  await shot('play-2b-upstairs');
  // One press, facing away from the stairs as a player arrives: it turns and
  // goes down in the same press.
  await page.keyDown(keyFor[stairs.down]);
  await wait(300);
  await page.keyUp(keyFor[stairs.down]);
  await wait(1200);
  const downstairs = await evaluate(`${GAME}.scene.getScene('world').currentArea()?.name`);
  report('and pressing towards the stairs down from their rug comes back down', downstairs === 'House', String(downstairs));
  await standAt({ x: inHouse.tile.x, y: inHouse.tile.y });
  await wait(300);
  await page.keyDown('ArrowDown');
  await wait(300);
  await page.keyUp('ArrowDown');
  await wait(1200);
  const outAgain = await evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return { tile: w.currentTile, facing: w.facing, area: w.currentArea()?.name }; })()`);
  report(
    'pressing off the mat comes out in front of the door, facing away',
    outAgain.tile.x === front.x && outAgain.tile.y === front.y && outAgain.facing === 'down',
    JSON.stringify(outAgain),
  );
  await shot('play-3-out-again');
  const errors = await evaluate('window.__errors ?? []');
  report('no errors on the page', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = results.every(Boolean) ? 0 : 1;
