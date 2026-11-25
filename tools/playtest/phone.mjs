// The game as a phone sees it: a mobile viewport at the phone's own pixel
// ratio, touch input, and the screenshots a phone would show. See README.md.
//
//   node tools/playtest/phone.mjs <url> <out dir> [--device=portrait|landscape|tablet|desktop]
//        [--save=file.json] [--steps=file.json]
//
// A step is { "tap": [x, y] } (CSS pixels, a real touch through CDP),
// { "touch": "selector" } (a touch on the centre of that element),
// { "hold": [x, y, ms] }, { "key": "Space" }, { "wait": ms }, { "eval": "js" },
// or { "shot": "name" }. With no steps it photographs the title.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep, writeScreenshot } from './browser.mjs';

/** CSS viewports and pixel ratios of the phones the game is judged on. */
export const DEVICES = {
  // A mid-range Android held upright (Pixel 7a / Galaxy A54 class).
  portrait: { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true, touch: true },
  // The same phone on its side, with the browser's bars taken off the height.
  landscape: { width: 915, height: 360, deviceScaleFactor: 2.625, mobile: true, touch: true },
  // A small iPhone (SE / mini class), the narrowest the game must hold.
  small: { width: 375, height: 667, deviceScaleFactor: 2, mobile: true, touch: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true, touch: true },
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, touch: false },
};

/** Puts a page into a device's shoes before anything of the game's runs. */
export async function emulateDevice(page, device) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: device.width,
    height: device.height,
    deviceScaleFactor: device.deviceScaleFactor,
    mobile: device.mobile,
    screenOrientation: device.width > device.height
      ? { type: 'landscapePrimary', angle: 90 }
      : { type: 'portraitPrimary', angle: 0 },
  });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: device.touch, maxTouchPoints: device.touch ? 5 : 0 });
  // `(pointer: coarse)` and `(hover: none)` are what a phone answers.
  await page.send('Emulation.setEmitTouchEventsForMouse', { enabled: device.touch, configuration: device.mobile ? 'mobile' : 'desktop' });
}

/** A finger down and up at one point, as a phone sends it. */
export async function touchTap(page, x, y, holdMs = 60) {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(holdMs);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** The centre of the first element a selector names, in CSS pixels. */
export async function centreOf(page, selector) {
  return page.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  })()`);
}

async function main() {
  const [url, out, ...flags] = process.argv.slice(2);
  if (!url || !out) {
    throw new Error('usage: phone.mjs <url> <out dir> [--device=...] [--save=file] [--steps=file]');
  }
  const flag = (name) => flags.find((each) => each.startsWith(`--${name}=`))?.slice(name.length + 3);
  const device = DEVICES[flag('device') ?? 'portrait'];
  if (!device) {
    throw new Error(`unknown device ${flag('device')}`);
  }
  const save = flag('save') ? JSON.parse(readFileSync(flag('save'), 'utf8')) : undefined;
  const steps = flag('steps') ? JSON.parse(readFileSync(flag('steps'), 'utf8')) : [{ wait: 3000 }, { shot: 'title' }];
  const browser = await launchBrowser({ window: { width: device.width, height: device.height } });
  try {
    const page = await browser.openPage(null, { save });
    await emulateDevice(page, device);
    if (save !== undefined) {
      await page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `localStorage.setItem('escape-from-pallet-town.save.v1', ${JSON.stringify(JSON.stringify(save))});`,
      });
    }
    await page.send('Page.navigate', { url });
    await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__)`, { timeoutMs: 60_000 });
    for (const step of steps) {
      if (step.wait) await sleep(step.wait);
      if (step.tap) await touchTap(page, step.tap[0], step.tap[1]);
      if (step.hold) await touchTap(page, step.hold[0], step.hold[1], step.hold[2]);
      if (step.touch) {
        const point = await centreOf(page, step.touch);
        if (!point) throw new Error(`nothing matches ${step.touch}`);
        await touchTap(page, point[0], point[1]);
      }
      if (step.key) await page.tap(step.key);
      if (step.eval) console.log(JSON.stringify(await page.evaluate(step.eval)));
      if (step.shot) {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
        writeScreenshot(join(out, `${step.shot}.png`), data);
        console.log(`shot ${join(out, `${step.shot}.png`)}`);
      }
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
