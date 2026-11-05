// An exit's ride in the map maker and on the map it makes
// (`src/game/world/exitVehicles.ts`): the sample lane as a draft, with an exit
// put on the pond's bank and one under a crag, chosen in the maker so its pane
// says what it rides, then walked with WALK IT and left by boat.
//
//   nice -n 15 node tools/playtest/makerExitRides.mjs <test-mode build url> <out dir> [--port=N]
//
// It prints PASS or FAIL for which ride each exit is given, in the maker's
// pane and in the raid, and exits non-zero on any FAIL.
import { readFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((a) => a.startsWith('--port='))?.slice('--port='.length);
const STORE = 'escape-from-pallet-town.maker.v1';
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const sample = JSON.parse(readFileSync(new URL('../../src/maps/sample/sample-lane.json', import.meta.url), 'utf8'));

// The pond is deep water from x4 to x9 on rows 8-11; a crag goes in at the top of the lane.
const POND_EXIT = { x: 10, y: 10, name: 'Ferry Steps', opens: { when: 'always' } };
const CRAG_EXIT = { x: 7, y: 3, name: 'Crag Ledge', opens: { when: 'always' } };
const ground = sample.ground.map((row, y) => (y === 2 ? `${row.slice(0, 6)}CC${row.slice(8)}` : row));
const draft = { ...sample, id: 'sample-lane', maker: 'Probe', ground, exits: [...sample.exits, POND_EXIT, CRAG_EXIT] };

const results = [];
const report = (name, passed, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const { send, evaluate } = page;
  const wait = (ms) => evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
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
    if (!at) throw new Error(`nothing on screen matches ${selector}`);
    await mouse(at.x, at.y);
    await sleep(150);
  };
  const clickTile = async (x, y) => {
    const at = await evaluate(`(() => { const canvas = document.querySelector('.map-maker canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = ${GAME}.scene.getScene('mapmaker').view; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
    await mouse(at.x, at.y);
    await sleep(300);
  };
  const paneSays = () => evaluate(`document.querySelector('.maker-selected')?.innerText ?? ''`);

  await send('Page.navigate', { url: url.href });
  await page.waitFor(`Boolean(${GAME}?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
  await evaluate(`(() => {
    localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts: [{ key: 'probe', file: draft, updatedAt: 1 }], current: 'probe' }))});
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    ${GAME}.scene.getScene('title').scene.start('mapmaker');
  })()`);
  await page.waitFor(`Boolean(document.querySelector('.map-maker [data-stack]'))`);
  await sleep(1200);
  await shot('maker-1-rides');

  await click('[data-tool="select"]');
  await clickTile(POND_EXIT.x, POND_EXIT.y);
  const pond = await paneSays();
  report('the maker says the pond exit rides a boat', /boat/i.test(pond), pond.replace(/\s+/g, ' ').slice(0, 160));
  await shot('maker-2-pond-exit');
  await clickTile(CRAG_EXIT.x, CRAG_EXIT.y);
  const crag = await paneSays();
  report('and the crag exit Pidgeot', /Pidgeot/.test(crag), crag.replace(/\s+/g, ' ').slice(0, 160));
  await shot('maker-3-crag-exit');
  await clickTile(sample.exits[0].x, sample.exits[0].y);
  const lane = await paneSays();
  report('and the lane exit a bicycle', /bicycle/i.test(lane), lane.replace(/\s+/g, ' ').slice(0, 160));

  const blocked = await evaluate(`document.querySelector('[data-try="walk"]')?.getAttribute('aria-disabled') === 'true' ? [...document.querySelectorAll('.maker-checks li, [data-fault]')].map((e) => e.innerText).join(' | ') : ''`);
  report('the map passes its checks', blocked === '', blocked);
  await click('[data-try="walk"]');
  await page.waitFor(`Boolean(${GAME}.scene.getScene('world')?.sys?.isActive())`, { timeoutMs: 20_000 });
  await evaluate(`${GAME}.pauseLoop()`);
  await wait(800);
  for (let i = 0; i < 8; i += 1) {
    await page.tap('Space');
    await wait(200);
  }
  const rides = JSON.parse(
    await evaluate(`JSON.stringify(Object.fromEntries(${GAME}.scene.getScene('world').extractionMarkers.map((m) => [m.point.label, m.ride.ride.vehicle])))`),
  );
  report('the raid gives the same rides', rides['FERRY STEPS'] === 'boat' && rides['CRAG LEDGE'] === 'bird' && rides['NORTH STILE'] === 'bike', JSON.stringify(rides));
  const standAt = (x, y) =>
    evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16;
      w.currentTile = { x: ${x}, y: ${y} }; w.setPlayerPosition(${x} * 16, ${y} * 16 + off);
      w.configureCamera(); w.cameras.main.centerOn(w.player.x, w.player.y); })()`);
  await standAt(17, 5);
  await wait(2000);
  await shot('play-1-crag-and-stile');
  await standAt(11, 10);
  await wait(2000);
  await shot('play-2-ferry-steps');
  await page.keyDown('ArrowLeft');
  await wait(100);
  await page.keyUp('ArrowLeft');
  for (const index of [1, 2, 3]) {
    await wait(200);
    await shot(`play-3-boarding-${index}`);
  }
  const errors = await evaluate('window.__errors ?? []');
  report('no errors on the page', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = results.every(Boolean) ? 0 : 1;
