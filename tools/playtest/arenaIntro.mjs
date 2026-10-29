// Plays THE RAID ARENA's trailer end to end and photographs it, a beat at a time:
//
//   node tools/playtest/arenaIntro.mjs <test-mode build url> <out dir> [--port=N] [--window=WxH] [--live]
//
// A new game walks into the Arena's door, and the trailer plays unasked
// (`scenes/ArenaIntroScene.ts`); every beat is photographed at the moment
// named below, then a key on the closing card has to land on the loadout.
// Backing out and walking in again, it has to play again with SKIP on screen,
// and one key has to skip it to the loadout. The loop is paused and stepped at
// 60fps frames throughout, so the pictures are of exact moments - use a
// test-mode build (`?testmode=pixels` for a picture worth judging;
// `tools/playtest/README.md`, "Memory"). `--live` leaves the loop running and
// waits in real time instead - the one pass at real speed a change is owed -
// so its pictures land near their moments rather than on them.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'arena-intro-shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
const live = args.includes('--live');
mkdirSync(out, { recursive: true });

/** The moments photographed, in milliseconds from the trailer's first frame. */
const SHOTS = [
  ['01-sneak', 1500],
  ['02-find', 4100],
  ['03-prize', 7500],
  ['04-rustle', 9300],
  ['05-battle', 11000],
  ['06-hit', 14000],
  ['07-easy', 15800],
  ['08-warning', 16400],
  ['09-hunter', 19000],
  ['10-swarmed', 21400],
  ['11-trapped', 22800],
  ['12-panel', 24300],
  ['13-panel-word', 25000],
  ['14-landing', 26900],
  ['15-fire', 27900],
  ['16-run', 29700],
  ['17-escape', 32200],
  ['18-exit', 34300],
  ['19-extracted', 37200],
  ['20-host', 42500],
  ['21-ready', 46500],
  ['22-loadout', 48200],
];

const failures = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  // A new game, on a browser that may hold somebody's: the save is cleared first.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`localStorage.removeItem('escape-from-pallet-town.save.v1')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  if (!live) await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (ms) =>
    live ? sleep(ms) : page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(50);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.tap(code, 0);
    await step(FRAME_MS * 2);
  };

  // A new game, straight to the harbour.
  await press('Space');
  await until(sceneIs('starter'), 'the starter picker');
  await until(
    `(() => { const b = document.querySelector('button[data-starter="squirtle"]'); if (!b) return false; b.click(); return true; })()`,
    'the picker',
  );
  await step(200);
  await page.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirm'))?.click()`);
  await until(sceneIs('base'), 'the harbour');
  // Dressed in the boutique's starter pieces rather than the classic figure,
  // so the trailer can be seen to draw the player in what they wear.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1'));
    save.raidProgress.look = { head: 'short-crop', top: 'plain-tee', legs: 'plain-trousers', body: null };
    localStorage.setItem('escape-from-pallet-town.save.v1', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  if (!live) await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(sceneIs('base'), 'the harbour, dressed');
  await step(1500);
  const worn = await page.evaluate(`${GAME}.scene.getScene('base').playerTexture`);

  // Up to the Arena's door, stopping the moment the trailer starts.
  const intro = 'INTRO';
  await walkIntoBase(page, 'raid-arena', {
    press: async (code) => {
      if (await page.evaluate(sceneIs('arenaIntro'))) throw new Error(intro);
      await page.tap(code, 0);
    },
    until,
    wait: step,
  }).catch((error) => {
    if (error.message !== intro) throw error;
  });
  await until(sceneIs('arenaIntro'), 'the trailer');
  const seen = await page.evaluate(`JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1')).raidProgress.arenaIntroSeen === true`);
  expect('the save records the trailer as seen once it starts', seen);
  const drawn = await page.evaluate(`${GAME}.scene.getScene('arenaIntro').playerTexture`);
  expect(`the trailer draws the player in what they wear (${drawn})`, drawn.startsWith('look:') && drawn === worn);
  const chip = await page.evaluate(`${GAME}.scene.getScene('arenaIntro').viewing`);
  expect(`the first viewing is the first (${chip})`, chip === 'first');

  let elapsed = 0;
  for (const [name, at] of SHOTS) {
    await step(at - elapsed);
    elapsed = at;
    await page.screenshot(`${out}/${name}.png`);
    console.log(`${name} at ${at}ms`);
  }
  expect('it waits on the closing card', await page.evaluate(sceneIs('arenaIntro')));
  await step(4000);
  expect('and still waits, with nothing pressed', await page.evaluate(sceneIs('arenaIntro')));
  await press('Space');
  await until(sceneIs('hub'), 'the loadout');
  await step(400);
  const view = await page.evaluate(`(() => { const h = ${GAME}.scene.getScene('hub'); return h.view + ':' + h.flow?.step; })()`);
  expect(`a key on the card lands on the loadout (${view})`, view === 'deploy:loadout');

  // Back out, and in again: it plays with SKIP, and a key skips it. The
  // loadout's first words are up the first time, and Escape puts them down first.
  for (let guard = 0; guard < 6 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
    await press('Escape');
    await step(400);
  }
  await until(sceneIs('base'), 'back in the harbour');
  await step(800);
  await walkIntoBase(page, 'raid-arena', {
    press: async (code) => {
      if (await page.evaluate(sceneIs('arenaIntro'))) throw new Error(intro);
      await page.tap(code, 0);
    },
    until,
    wait: step,
  }).catch((error) => {
    if (error.message !== intro) throw error;
  });
  await until(sceneIs('arenaIntro'), 'the trailer, again');
  const again = await page.evaluate(`${GAME}.scene.getScene('arenaIntro').viewing`);
  expect(`the second viewing offers SKIP (${again})`, again === 'again');
  await step(2400);
  await page.screenshot(`${out}/23-again-skip.png`);
  await press('KeyZ');
  await until(sceneIs('hub'), 'the loadout, skipped to');
  await step(400);
  const skipped = await page.evaluate(`(() => { const h = ${GAME}.scene.getScene('hub'); return h.view + ':' + h.flow?.step; })()`);
  expect(`a key skips it to the loadout (${skipped})`, skipped === 'deploy:loadout');
  await page.screenshot(`${out}/24-skipped-to-loadout.png`);
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
