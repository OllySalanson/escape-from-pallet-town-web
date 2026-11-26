// THE MAP on M (`src/game/ui/MapScreen.ts`), played as a player plays it: a
// new save's first raid, a few steps walked, M pressed, the raid clock watched
// running while the map is up, M again to close it - and then home to the
// harbour, a walk round the yard, and M there: THE HARBOUR, in colour where
// it was walked, and still so after a reload.
//
//   node tools/playtest/mapScreen.mjs <test-mode build url> <out dir> [--before] [--port=N]
//
// `--before` photographs
// a build from before THE MAP, where M was the sound and nothing opened: the
// same frames, for the pull request's before and after.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const before = args.includes('--before');
const port = option('port');
if (!base || !outDir) {
  throw new Error('usage: mapScreen.mjs <test-mode build url> <out dir> [--before] [--port=N]');
}
mkdirSync(outDir, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const DESCRIBE = `${GAME}.describe()`;
const world = (field) => `${DESCRIBE}.scene.world?.${field}`;

const page = await browser.openPage('about:blank');
try {
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 400; i += 1) {
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
  const shot = async (name) => {
    await page.screenshot(`${outDir}/${name}.png`);
    console.log(`     ${outDir}/${name}.png`);
  };
  /** Presses through whatever the world has to say, until there is nothing on screen to read. */
  const readThrough = async () => {
    for (let i = 0; i < 60; i += 1) {
      const busy = await page.evaluate(`(() => { const w = ${DESCRIBE}.scene.world; return Boolean(w && (w.dialogue || w.choice || w.busy)); })()`);
      if (!busy) return;
      await press('Space');
      await wait(300);
    }
  };
  const describe = async () => page.evaluate(`JSON.stringify(${DESCRIBE})`).then((text) => JSON.parse(text));

  // -- a raid ----------------------------------------------------------------
  await page.send('Page.navigate', { url: url.toString() });
  await deploy(page, url.toString(), { press, click, until, wait, paused: true });
  await until(sceneIs('world'), 'the raid');
  await wait(1500);
  await readThrough();
  // A few steps along the street, as anybody would before wondering where they are.
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
    await press(key);
    await wait(300);
    await readThrough();
  }
  await shot('1-raid');
  const tile = JSON.stringify(await page.evaluate(world('tile')));
  const startMs = await page.evaluate(world('raid.remainingMs'));
  await press('KeyM');
  await wait(800);
  if (before) {
    check((await page.evaluate(world('chart'))) === undefined, 'M opens nothing before THE MAP');
    await shot('2-raid-m');
  } else {
    await until(`(${DESCRIBE}.scene.world?.chart?.known ?? null) !== null`, 'the map to be drawn');
    const known = await page.evaluate(world('chart.known'));
    check(known > 0, `the map shows the ground walked in colour (${known} tiles)`);
    check((await page.evaluate(`${GAME}.scene.getScene('world').mapScreen?.zoomed`)) === 'close', 'it opens close round the player');
    await shot('2-raid-map');
    const openMs = await page.evaluate(world('raid.remainingMs'));
    await wait(3000);
    const laterMs = await page.evaluate(world('raid.remainingMs'));
    check(openMs - laterMs >= 2900, `the raid clock runs while the map is open (${openMs} then ${laterMs})`);
    const clockText = await page.evaluate(`document.querySelector('[data-chart-clock]')?.textContent ?? null`);
    check(clockText !== null, `the map shows the clock (${clockText})`);
    // Arrows walk nobody while the map is up.
    await press('ArrowLeft');
    await wait(400);
    check(JSON.stringify(await page.evaluate(world('tile'))) === tile, 'the player stands still under the map');
    await shot('3-raid-map-later');
    await press('KeyZ');
    await wait(300);
    check((await page.evaluate(`${GAME}.scene.getScene('world').mapScreen?.zoomed`)) === 'whole', 'Z shows the whole place');
    await shot('3b-raid-map-whole');
    await press('KeyM');
    await wait(300);
    check((await page.evaluate(world('chart'))) === null, 'M closes the map');
    check(startMs - (await page.evaluate(world('raid.remainingMs'))) >= 3000, 'and the time spent looking was spent');
    // And Esc does too.
    await press('KeyM');
    await until(`(${DESCRIBE}.scene.world?.chart?.known ?? null) !== null`, 'the map again');
    await press('Escape');
    await wait(300);
    check((await page.evaluate(world('chart'))) === null, 'Esc closes the map');
    await shot('4-raid-after');
  }

  // -- the harbour ----------------------------------------------------------------
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    // Home, as from a raid that ended: nothing is out.
    delete save.raidInFlight;
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
    for (const key of Object.keys(localStorage)) if (key.includes('raid-resume')) localStorage.removeItem(key);
  })()`);
  const home = async () => {
    await page.send('Page.navigate', { url: url.toString() });
    // The loop is the page's own until the title is up, so this waits in real time.
    await page.waitFor(`Boolean(${GAME}) && ${sceneIs('title')}`, { timeoutMs: 60_000, what: 'the title' });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(`${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`, 'the harbour');
    await wait(1500);
    for (let i = 0; i < 30 && (await page.evaluate(`Boolean(${DESCRIBE}.scene.base?.dialogue)`)); i += 1) {
      await press('Space');
      await wait(300);
    }
  };
  // The harbour waits under the map, paused, so it is asked directly rather than through describe().
  const harbourMap = `${GAME}.scene.getScene('base').mapScreen`;
  const openHarbourMap = async () => {
    await press('KeyM');
    await wait(800);
    await until(`(${harbourMap}?.knownTiles ?? null) !== null`, 'the harbour map to be drawn');
    return page.evaluate(`${harbourMap}.knownTiles`);
  };
  await home();
  const walkedTo = new Set();
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown']) {
    await press(key);
    await wait(400);
    const at = await page.evaluate(`${GAME}.scene.getScene('base').currentTile`);
    walkedTo.add(`${at.x},${at.y}`);
  }
  await shot('5-harbour');
  if (before) {
    await press('KeyM');
    await wait(800);
  } else {
    const known = await openHarbourMap();
    const name = await page.evaluate(`document.querySelector('.chart-name')?.textContent ?? null`);
    check(name === 'THE HARBOUR', `M at home is the map of where you are: ${name}`);
    check(known >= walkedTo.size, `the yard walked is in colour (${known} tiles for ${walkedTo.size} stood on)`);
    check(await page.evaluate(`Boolean(document.querySelector('.chart-here'))`), 'with the player on it');
  }
  await shot('6-harbour-m');
  if (!before) {
    // The yard fits whole at least as big as close up: there is no Z to press.
    check(await page.evaluate(`document.querySelector('[data-chart-zoom]')?.hidden === true`), 'and no zoom to change on a place seen whole');
    await press('KeyM');
    await wait(300);
    check((await page.evaluate(harbourMap)) === null, 'M closes it at home too');
    const kept = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.harbourWalked ?? null`);
    check(kept !== null, 'the walk is in the save');
    await home();
    const again = await openHarbourMap();
    check(again >= walkedTo.size, `and still lit after a reload (${again} tiles)`);
    await press('KeyM');
    await wait(300);
  }
  console.log(JSON.stringify((await describe()).scene.base?.hint ?? null));
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.log(`${failures.length} failed`);
  process.exitCode = 1;
}
