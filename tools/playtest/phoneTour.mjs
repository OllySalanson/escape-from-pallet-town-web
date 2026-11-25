// Every screen the touch pad changes, on a phone: the title, the harbour with
// the yard's keys on the pad, YOUR THINGS opened from its PACK... key, a raid
// with the raid's keys, and a battle. See README.md, "On a phone".
//
//   node tools/playtest/phoneTour.mjs <test-mode build url> <out dir> [--device=portrait|landscape|small]
//
// Gets about the way a player does: the starter off Oak's table and the raid
// deployed by `deploy.mjs`, both by keys; then everything on screen is pressed
// by a finger on the pad, through `phone.mjs`'s real touches.
import { launchBrowser, sleep, writeScreenshot } from './browser.mjs';
import { deploy, GAME, sceneIs } from './deploy.mjs';
import { DEVICES, centreOf, emulateDevice, touchTap } from './phone.mjs';
import { join } from 'node:path';

const [url, out, ...flags] = process.argv.slice(2);
const flag = (name) => flags.find((each) => each.startsWith(`--${name}=`))?.slice(name.length + 3);
const deviceName = flag('device') ?? 'portrait';
const device = DEVICES[deviceName];
if (!url || !out || !device) {
  throw new Error('usage: phoneTour.mjs <url> <out dir> [--device=portrait|landscape|small]');
}

const browser = await launchBrowser({ window: { width: device.width, height: device.height } });
try {
  const page = await browser.openPage(null);
  await emulateDevice(page, device);
  await page.send('Page.navigate', { url });
  const until = async (expression, what = expression, timeoutMs = 60_000) => page.waitFor(expression, { timeoutMs, what });
  const shot = async (name) => {
    await sleep(700);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeScreenshot(join(out, `${deviceName}-${name}.png`), data);
    console.log(`shot ${join(out, `${deviceName}-${name}.png`)}`);
  };
  /** A finger on one of the pad's parts, found by selector. */
  const touch = async (selector, holdMs = 70) => {
    const point = await centreOf(page, selector);
    if (!point) throw new Error(`no ${selector} on screen`);
    await touchTap(page, point[0], point[1], holdMs);
    await sleep(250);
  };
  const chip = (label) => `(() => { const c = [...document.querySelectorAll('.tp-chip')].find((c) => c.textContent === ${JSON.stringify(label)}); if (!c) return null; c.dataset.tour = 'here'; return true; })()`;
  const touchChip = async (label) => {
    await until(chip(label), `the pad to offer ${label}`, 15_000);
    await touch('.tp-chip[data-tour="here"]');
    await page.evaluate(`document.querySelectorAll('[data-tour]').forEach((c) => delete c.dataset.tour)`);
  };

  await until(sceneIs('title'));
  await sleep(2500);
  await shot('1-title');

  // Into the harbour with a partner, the way a driver does (`deploy.mjs`).
  const press = async (code) => { await page.tap(code); await sleep(120); };
  await press('Space');
  await until(sceneIs('base'));
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.('bulbasaur') === true`, 'the starter off the table');
  // Out of the lab door to the yard, on the pad.
  await until(`${GAME}.scene.getScene('base')?.ready && !${GAME}.scene.getScene('base').place?.room`, 'the yard', 60_000);
  // A key pressed by the keyboard takes the pad away; a touch brings it back.
  await touchTap(page, 4, 4);
  await sleep(1200);
  await shot('2-harbour');
  await touchChip('THINGS');
  await until(`Boolean(document.querySelector('#screens .menu-overlay'))`, 'YOUR THINGS', 15_000);
  await shot('3-things');
  if (process.env.PHONE_TOUR_PROBE) console.log(await page.evaluate(`(() => { const e = document.elementFromPoint(200, 30); return [e?.tagName, e?.id, e?.className, getComputedStyle(document.body).backgroundColor]; })()`));
  await touch('.tp-back');
  await until(`!document.querySelector('#screens .menu-overlay')`, 'YOUR THINGS to close', 15_000);
  await touchChip('TEAM');
  await until(`Boolean(document.querySelector('#screens .menu-overlay'))`, 'YOUR TEAM', 15_000);
  await shot('4-team');
  await touch('.tp-back');
  await sleep(600);

  // A raid, deployed by the driver; then the pad again.
  await page.evaluate(`localStorage.removeItem('escape-from-pallet-town.save.v1')`);
  await page.send('Page.reload');
  await until(sceneIs('title'));
  await deploy(page, url, {
    press,
    click: async (selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`),
    until,
    wait: sleep,
    insertion: undefined,
  }).catch(async (error) => { await shot('deploy-stuck'); throw error; });
  await until(sceneIs('world'), 'the raid', 90_000);
  await touchTap(page, 4, 4);
  await sleep(2500);
  await shot('5-raid');
  // The first raid's briefing is read through with OK before anything else.
  for (let guard = 0; guard < 8 && (await page.evaluate(`Boolean(${GAME}.scene.getScene('world').dialogBox?.visible)`)); guard += 1) {
    await touch('.tp-ok');
    await sleep(500);
  }
  await touchChip('PACK');
  await until(`Boolean(document.querySelector('#screens .menu-overlay'))`, 'the raid pack', 15_000);
  await shot('6-pack');
  await touch('.tp-back');
  await sleep(800);
  await shot('7-raid-after');
} finally {
  await browser.close();
}
