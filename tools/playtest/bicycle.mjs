// The Bicycle, played the way a player plays it: pack it at base, drop in, open
// the pack and choose it (FireRed's USE), ride, and get off again (WALK)
// (`src/game/world/bicycle.ts`).
//
//   node tools/playtest/bicycle.mjs <dev server url> <out dir> [--insertion=id] [--port=N] [--real]
//
// It fails if the pack does not offer USE, if choosing it does not put the
// player on the ridden figure, if a ridden tile does not cost half the raid
// clock a walked one does while still counting as one step, or if WALK does not
// put them back on foot. Screenshots of the pack, the rider and the walker land
// in <out dir>. --port=N drives a browser already running on that CDP port.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
if (!base || !outDir) {
  throw new Error('usage: bicycle.mjs <dev server url> <out dir> [--insertion=id] [--port=N] [--real]');
}
mkdirSync(outDir, { recursive: true });
const real = args.includes('--real');
const url = new URL(base);
if (!real) url.searchParams.set('testmode', 'pixels');

const browser = port
  ? attachBrowser(Number(port), { window: PIXEL_WINDOW })
  : await launchBrowser({ window: PIXEL_WINDOW });
const WORLD = `${GAME}.scene.getScene('world')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const page = await browser.openPage('about:blank');
if (real) await page.send('Page.bringToFront');
try {
  const wait = (ms) =>
    real
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await wait(60);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const clearDialog = async () => {
    for (let guard = 0; guard < 20 && (await page.evaluate(`${WORLD}.dialogBox.visible`)); guard += 1) {
      await press('Space');
      await wait(300);
    }
  };
  const state = () =>
    page.evaluate(
      `(() => { const w = ${WORLD}; return { riding: w.riding, texture: w.player.texture.key, tile: { ...w.currentTile }, steps: w.runSession.stepsTaken ?? 0, clock: w.runSession.manager.snapshot().elapsedMs }; })()`,
    );

  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait,
    paused: !real,
    ...deployOptions(args),
    stash: ['bicycle:1'],
    pack: ['bicycle:1', 'potion:0'],
  });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await clearDialog();

  // -- The pack offers it, in FireRed's word -------------------------------
  await press('KeyB');
  await until(`Boolean(document.querySelector('button[data-item="bicycle"]'))`, 'the Bicycle in the pack');
  const help = await page.evaluate(`document.querySelector('button[data-item="bicycle"]').dataset.help`);
  check(help.includes('USE: ride the Bicycle'), `the pack offers USE ("${help}")`);
  await page.evaluate(`document.querySelector('button[data-item="bicycle"]').focus()`);
  await wait(200);
  await page.screenshot(`${outDir}/bicycle-pack.png`);
  await page.evaluate(`document.querySelector('button[data-item="bicycle"]').click()`);
  await until(sceneIs('world') + ` && !${GAME}.scene.isActive('bag')`, 'the pack to close onto the world');
  await wait(300);
  const mounted = await state();
  check(mounted.riding && mounted.texture === 'player-bike', `on the Bicycle (${mounted.texture})`);

  // -- A ridden tile, against a walked one ----------------------------------
  // Two tiles out and back along whichever way is open, so nothing on the way
  // is the measurement's business.
  const way = await page.evaluate(`(() => { const w = ${WORLD}; const t = w.currentTile;
    const ways = [['ArrowRight', 1, 0, 'ArrowLeft'], ['ArrowLeft', -1, 0, 'ArrowRight'], ['ArrowDown', 0, 1, 'ArrowUp'], ['ArrowUp', 0, -1, 'ArrowDown']];
    return ways.find(([, dx, dy]) => !w.isBlocked({ x: t.x + dx, y: t.y + dy }) && !w.isBlocked({ x: t.x + 2 * dx, y: t.y + 2 * dy }) && !w.currentMap.tallGrass[t.y + dy]?.[t.x + dx] && !w.currentMap.tallGrass[t.y + 2 * dy]?.[t.x + 2 * dx]) ?? null; })()`);
  if (!way) throw new Error('no open ground two tiles long beside the landing');
  const stepOnce = async (key) => {
    const before = await state();
    await page.keyDown(key);
    for (let i = 0; i < 20 && (await state()).steps === before.steps; i += 1) await wait(10);
    await page.keyUp(key);
    await wait(300);
    await clearDialog();
    const after = await state();
    return { steps: after.steps - before.steps, tile: after.tile };
  };
  const measure = async () => {
    const start = await state();
    for (const key of [way[0], way[0], way[3], way[3]]) await stepOnce(key);
    const end = await state();
    return { steps: end.steps - start.steps, back: end.tile.x === start.tile.x && end.tile.y === start.tile.y };
  };
  const ridden = await measure();
  check(ridden.steps === 4 && ridden.back, `four ridden tiles are four steps (${ridden.steps})`);
  await stepOnce(way[0]);
  await page.screenshot(`${outDir}/bicycle-riding.png`);
  await stepOnce(way[3]);

  // The clock per tile, read off the scene's own step: the tile the game
  // charges, stepped at a known frame, rather than a timer round a driver.
  const perTile = await page.evaluate(`${WORLD}.stepDurationMs`);
  check(perTile === 75, `a ridden tile is 75ms of raid clock (${perTile})`);

  // -- WALK puts them back on foot ------------------------------------------
  await press('KeyB');
  await until(`Boolean(document.querySelector('button[data-item="bicycle"]'))`, 'the pack again');
  const walkHelp = await page.evaluate(`document.querySelector('button[data-item="bicycle"]').dataset.help`);
  check(walkHelp.includes('WALK: get off the Bicycle'), `the pack offers WALK ("${walkHelp}")`);
  await page.evaluate(`document.querySelector('button[data-item="bicycle"]').click()`);
  await until(sceneIs('world') + ` && !${GAME}.scene.isActive('bag')`, 'the pack to close again');
  await wait(300);
  const walking = await state();
  check(!walking.riding && walking.texture !== 'player-bike', `on foot again (${walking.texture})`);
  await stepOnce(way[0]);
  const walkedTile = await page.evaluate(`${WORLD}.stepDurationMs`);
  check(walkedTile === 150, `a walked tile is 150ms of raid clock (${walkedTile})`);
  await page.screenshot(`${outDir}/bicycle-walking.png`);
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log('all checks passed');
