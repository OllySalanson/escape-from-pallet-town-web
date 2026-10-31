// Photographs THE HARBOUR as a player stands in it, a spot at a time, at the
// game's real 3x window, and records a short walk along the waterfront:
//
//   node tools/playtest/harbourTour.mjs <test-mode build url> <out dir> [--built=all] [--clip] [--at=name:x:y,..] [--port=N] [--clock=day|dusk|night] [--window=WxH]
//
// A new game is started (so the harbour is what a newcomer walks into), then
// the base scene is restarted standing on each spot - the spawn, the jetty a
// raid comes home to, the step outside every door - and the picture taken once
// the fade and the captions have settled. `--built=all` writes every rung of
// Brock's ladder into the save first, so the fixtures stand; `--at=` adds
// spots of its own by tile, and `--port=` drives a browser already running on
// that CDP port (one the machine's memory watchdog can see) instead of its own. It is stepped on a paused loop at 60fps frames, so
// it needs a test-mode build (`?testmode=pixels` for a picture worth judging;
// `tools/playtest/README.md`, "Memory"). The pictures are what the
// before-and-after of a harbour change is made from (`docs/screens/harbour/`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { animatedPng, decodePng } from './apng.mjs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const builtAll = option('built') === 'all';
const clip = args.includes('--clip');
const extraSpots = (option('at') ?? '')
  .split(',')
  .filter(Boolean)
  .map((spot) => {
    const [name, x, y] = spot.split(':');
    return { name, at: { x: Number(x), y: Number(y) } };
  });
const FRAME_MS = 1000 / 60;
// `--window=1600x1024` is the README's harbour picture (`docs/readme/README.md`); the default is the 3x window.
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
// `--clock=day|dusk|night` puts the page in a time zone where it is that hour
// now, for the harbour that follows the player's clock (`base/harbourLight.ts`).
const clock = option('clock');
const CLOCK_HOUR = { day: 12, dusk: 19, night: 23 };
const zoneFor = (hour) => {
  let offset = (hour - new Date().getUTCHours() + 24) % 24;
  if (offset > 14) offset -= 24;
  return offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
};
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`harbour tour: ${why}`);
};

const browser = option('port')
  ? attachBrowser(Number(option('port')), { window: WINDOW })
  : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  if (clock !== undefined) {
    if (!(clock in CLOCK_HOUR)) fail('--clock is day, dusk or night');
    await page.send('Emulation.setTimezoneOverride', { timezoneId: zoneFor(CLOCK_HOUR[clock]) });
  }
  // A browser kept between runs keeps its storage: start every tour fresh.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = async (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const tap = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
  };
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;

  // A new game, as a newcomer starts one.
  await tap('Space');
  await until(sceneIs('base'));
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  if (builtAll) {
    await page.evaluate(`(() => {
      const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      save.raidProgress.workshopUpgrades = ['radio-mast', 'beacon', 'secure-locker-1', 'secure-locker-2', 'recovery-bay-1', 'recovery-bay-2', 'quarantine-ward'];
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
    })()`);
  }

  /** Restarts the harbour with `data` and waits for it to settle. */
  const standIn = async (data) => {
    await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', ${JSON.stringify(data)})`);
    await until(baseReady, 'the harbour again');
    // Long enough for the Seagallop to come in to her berth (`ARRIVAL_MS`), and
    // short enough that THE HARBOUR's name is still up.
    await wait(1700);
  };

  const doors = await page.evaluate(`${GAME}.scene.getScene('base').doors.map((door) => ({ id: door.id, at: door.returnTo }))`);
  const spots = [
    { name: 'spawn', data: {} },
    ...doors.map((door) => ({ name: `outside-${door.id}`, data: { from: door.id } })),
    ...extraSpots.map((spot) => ({ name: spot.name, data: { at: spot.at } })),
  ];
  for (const spot of spots) {
    await standIn(spot.data);
    const tile = await page.evaluate(`${GAME}.scene.getScene('base').currentTile`);
    await page.screenshot(`${out}/${spot.name}.png`);
    console.log(`${spot.name} at ${tile.x},${tile.y}`);
  }

  if (clip) {
    // Off the boat and up the yard, east along the front of the keepers' row:
    // the walk a raid that has just come home takes.
    await standIn({});
    const frames = [];
    const record = async () => {
      if ((await page.evaluate(`${GAME}.loop.frame`)) % 2 === 0) {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, ...WINDOW, scale: 0.5 } });
        frames.push(decodePng(Buffer.from(data, 'base64')));
      }
    };
    for (const [code, ms] of [['ArrowUp', 700], ['ArrowRight', 2400]]) {
      await page.keyDown(code);
      for (let index = 0; index < Math.round(ms / FRAME_MS); index += 1) {
        await step(1);
        await record();
      }
      await page.keyUp(code);
    }
    for (let index = 0; index < 20; index += 1) {
      await step(1);
      await record();
    }
    writeFileSync(`${out}/walk.png`, animatedPng(frames));
    console.log(`walk: ${frames.length} frames`);
  }
} finally {
  await browser.close();
}
