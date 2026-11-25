// THE MAP on M (`src/game/ui/MapScreen.ts`), played as a player plays it: a
// new save's first raid, a few steps walked, M pressed, the raid clock watched
// running while the map is up, M again to close it - and then home to the
// harbour on a save that has walked a good deal of the vale, and M there.
//
//   node tools/playtest/mapScreen.mjs <test-mode build url> <out dir> [--survey=file.json] [--before] [--port=N]
//
// `--survey=` is a `raidProgress.surveyed` record (`tools/tileset/sampleSurvey.mts`)
// laid on the save before the harbour is visited, with no steps kept beside it,
// so the harbour's map is the one a player from before THE MAP gets: their
// steps read back off their survey (`world/trodden.ts`). `--before` photographs
// a build from before THE MAP, where M was the sound and nothing opened: the
// same frames, for the pull request's before and after.
import { mkdirSync, readFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const before = args.includes('--before');
const port = option('port');
const survey = option('survey');
if (!base || !outDir) {
  throw new Error('usage: mapScreen.mjs <test-mode build url> <out dir> [--survey=file.json] [--before] [--port=N]');
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

  // -- the harbour, on a save that has walked a good deal -----------------------
  const surveyed = survey ? readFileSync(survey, 'utf8') : 'null';
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const p = save.raidProgress;
    const walked = ${surveyed};
    if (walked) { p.surveyed = { ...p.surveyed, ...walked }; delete p.trodden; }
    // Home, as from a raid that ended: nothing is out.
    delete save.raidInFlight;
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
    for (const key of Object.keys(localStorage)) if (key.includes('raid-resume')) localStorage.removeItem(key);
  })()`);
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
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) {
    await press(key);
    await wait(400);
  }
  await shot('5-harbour');
  await press('KeyM');
  await wait(800);
  if (!before) {
    // The harbour waits under the map, paused, so it is asked directly rather than through describe().
    const harbourMap = `${GAME}.scene.getScene('base').mapScreen`;
    await until(`(${harbourMap}?.knownTiles ?? null) !== null`, 'the harbour map to be drawn');
    const known = await page.evaluate(`${harbourMap}.knownTiles`);
    check(known > 0, `the harbour map shows every step read back off the survey (${known} tiles)`);
  }
  await shot('6-harbour-m');
  if (!before) {
    await press('KeyM');
    await wait(300);
    check((await page.evaluate(`${GAME}.scene.getScene('base').mapScreen`)) === null, 'M closes it at home too');
  }
  console.log(JSON.stringify((await describe()).scene.base?.hint ?? null));
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.log(`${failures.length} failed`);
  process.exitCode = 1;
}
