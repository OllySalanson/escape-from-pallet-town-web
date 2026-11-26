// Photographs the game in the window round it - the frame that fills what the
// whole-pixel stage leaves over (`display/stageFrame.ts`), the controls bar and
// its FULL SCREEN tile - at the window sizes a player brings: a 1440p and a
// 1080p desktop, a laptop and a phone held each way. One browser, resized
// between pictures with the device metrics, so the game refits as it does when
// a real window is dragged.
//
//   node tools/playtest/frameShots.mjs <test-mode build url> <out dir> [--sizes=WxH[@dpr],...] [--raid]
//
// It takes the partner on the title's table and stands in the harbour yard;
// `--raid` also jumps into a raid and photographs that at every size. It steps
// a paused loop, so it wants a test-mode build (`?testmode=pixels`;
// `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { GAME, jumpIn, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const SIZES = (option('sizes') ?? '2560x1440,1920x1080,1366x768,1280x800,844x390@3,390x844@3')
  .split(',')
  .map((each) => {
    const [, width, height, ratio] = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(each) ?? [];
    if (!width) throw new Error(`frameShots: not a size: ${each}`);
    return { width: Number(width), height: Number(height), ratio: Number(ratio ?? 1) };
  });
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ window: { width: SIZES[0].width, height: SIZES[0].height } });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    await page.screenshot(`${out}/stuck.png`);
    throw new Error(`frameShots: never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const resize = async ({ width, height, ratio }) => {
    const mobile = ratio > 1 && Math.min(width, height) < 500;
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: ratio, mobile });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    // A resized WebGL canvas is cleared until it draws again, and a headless
    // compositor can lag the stepped frame: step, let it paint, step again.
    await wait(300);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await wait(100);
  };
  const shootAll = async (name) => {
    for (const size of SIZES) {
      await resize(size);
      const file = `${out}/${name}-${size.width}x${size.height}${size.ratio > 1 ? `@${size.ratio}` : ''}.png`;
      await page.screenshot(file);
      console.log(file);
    }
    await resize(SIZES[0]);
  };

  await shootAll('title');
  const BASE = `${GAME}.scene.getScene('base')`;
  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${BASE}?.takeStarterForDriver?.("squirtle") === true`);
  await wait(300);
  await until(`${sceneIs('base')} && ${BASE}.ready`, 'the harbour');
  await wait(600);
  await shootAll('yard');
  // FULL SCREEN, by the tile a player clicks and by ALT ENTER, and back each way.
  const full = `Boolean(document.fullscreenElement)`;
  const tile = `document.querySelector('.controls-bar:not([hidden]) [data-open="full-screen"], .stage-frame-full:not([hidden])')`;
  const clickTile = async () => {
    const box = await page.evaluate(`(() => { const r = ${tile}?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; })()`);
    if (!box) throw new Error('frameShots: no FULL SCREEN tile');
    for (const type of ['mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    await wait(100);
  };
  const altEnter = async () => {
    for (const type of ['keyDown', 'keyUp']) {
      await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 1 });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    await wait(100);
  };
  for (const size of [SIZES[0], SIZES[1] ?? SIZES[0]]) {
    await resize(size);
    // Round the touch pad there is no tile, and on an iPhone no full screen.
    if (!(await page.evaluate(`Boolean(${tile})`))) {
      console.log(`full screen at ${size.width}x${size.height}: no tile`);
      continue;
    }
    await clickTile();
    const on = await page.evaluate(full);
    await page.screenshot(`${out}/full-on-${size.width}x${size.height}.png`);
    await clickTile();
    const off = await page.evaluate(full);
    await altEnter();
    const keyOn = await page.evaluate(full);
    await altEnter();
    const keyOff = await page.evaluate(full);
    console.log(`full screen at ${size.width}x${size.height}: tile ${on}/${off}, ALT ENTER ${keyOn}/${keyOff}`);
  }
  await resize(SIZES[0]);
  if (args.includes('--raid')) {
    await jumpIn(page, { press, until, wait });
    await wait(1500);
    await shootAll('raid');
  }
} finally {
  await browser.close();
}
