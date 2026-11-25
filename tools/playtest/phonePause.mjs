// A raid on a phone, put away and taken out again: the page hidden as a phone
// hides it going to another app, the pause plate photographed, then OK tapped
// on the touch pad to play on - which must take the plate down and do nothing
// else. Needs a build that is not in test mode, which never pauses.
//
//   node tools/playtest/phonePause.mjs <plain build url> <out dir>
import { join } from 'node:path';
import { launchBrowser, sleep, writeScreenshot } from './browser.mjs';
import { deploy, GAME, sceneIs } from './deploy.mjs';
import { DEVICES, centreOf, emulateDevice, touchTap } from './phone.mjs';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  throw new Error('usage: phonePause.mjs <plain build url> <out dir>');
}
const device = DEVICES.portrait;
const browser = await launchBrowser({ window: { width: device.width, height: device.height } });
try {
  const page = await browser.openPage(null);
  await emulateDevice(page, device);
  // A tab opened over CDP is not focused; this one is, so a blur means something.
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await page.send('Page.navigate', { url });
  const until = (expression, what = expression, timeoutMs = 60_000) => page.waitFor(expression, { timeoutMs, what });
  const shot = async (name) => {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeScreenshot(join(out, `${name}.png`), data);
    console.log(`shot ${join(out, `${name}.png`)}`);
  };
  const touch = async (selector) => {
    const point = await centreOf(page, selector);
    await touchTap(page, point[0], point[1]);
  };
  await until(sceneIs('title'));
  const press = async (code) => { await page.tap(code); await sleep(150); };
  await deploy(page, url, { press, click: async (s) => page.evaluate(`document.querySelector(${JSON.stringify(s)})?.click()`), until, wait: sleep });
  await until(sceneIs('world'), 'the raid', 90_000);
  const WORLD = `${GAME}.scene.getScene('world')`;
  // Through the first raid's briefing with OK, as a thumb would.
  await touchTap(page, 4, 4);
  for (let guard = 0; guard < 8 && (await page.evaluate(`Boolean(${WORLD}.dialogBox?.visible)`)); guard += 1) {
    await touch('.tp-ok');
    await sleep(500);
  }
  await sleep(800);
  // Put away: the page hidden, as a phone hides it for another app.
  await page.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));`);
  await page.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'));`);
  await sleep(800);
  const state = () => page.evaluate(`(() => { const w = ${WORLD}; return { plate: w.windowPausePlate !== null, dialog: Boolean(w.dialogBox?.visible) }; })()`);
  console.log('after hiding', JSON.stringify(await state()));
  await shot('paused');
  await touch('.tp-ok');
  await sleep(800);
  console.log('after OK', JSON.stringify(await state()));
  await shot('played-on');
} finally {
  await browser.close();
}
