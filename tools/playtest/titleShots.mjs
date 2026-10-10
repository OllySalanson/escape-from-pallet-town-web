// Photographs the title screen: a fresh browser, a browser with a game in it,
// and the erase question, at each window size asked for.
//
//   node tools/playtest/titleShots.mjs <url of a test-mode build> <out dir> [--windows=400x256,1200x768] [--frames=3] [--at=1500,4000]
//
// The url should carry `?testmode=pixels` (or point at a `VITE_EPTW_TEST_MODE=pixels`
// build), because Phaser's Canvas renderer draws no tints and the title's water
// is a tint. `--frames=N` takes N pictures of the fresh title a beat apart, so
// the motion on it can be judged rather than assumed, and `--at=ms,..` stops
// the loop, winds the title's own clock back to nought and steps it to each of
// those moments, so a shine or a chase can be photographed exactly where it is. One browser per
// window size, closed at the end of it, whatever happens.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';

const args = process.argv.slice(2);
const [url, out] = args.filter((arg) => !arg.startsWith('--'));
if (!out) throw new Error('usage: titleShots.mjs <url> <out dir> [--windows=WxH,..] [--frames=N]');
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const windows = option('windows', '400x256,1200x768').split(',').map((size) => {
  const [width, height] = size.split('x').map(Number);
  return { width, height, name: size };
});
const frames = Number(option('frames', '1'));
const moments = option('at', '').split(',').filter(Boolean).map(Number);
mkdirSync(out, { recursive: true });

const GAME = 'window.__escapeFromPalletTownGame__';
const onTitle = `${GAME}?.scene?.isActive('title') === true`;

for (const window of windows) {
  const browser = await launchBrowser({ window });
  try {
    const page = await browser.openPage(url);
    await page.waitFor(onTitle, { timeoutMs: 60_000 });
    await sleep(600);
    for (let frame = 0; frame < frames; frame += 1) {
      await page.screenshot(join(out, `fresh-${window.name}${frames > 1 ? `-${frame}` : ''}.png`));
      await sleep(350);
    }
    if (moments.length > 0) {
      const since = `(() => { const t = ${GAME}.scene.getScene('title'); return t.time.now - t.bornAt; })()`;
      await page.evaluate(`${GAME}.pauseLoop()`);
      await page.evaluate(`(() => { const t = ${GAME}.scene.getScene('title'); t.bornAt = t.time.now; })()`);
      for (const moment of moments) {
        const now = await page.evaluate(since);
        const steps = Math.max(0, Math.ceil((moment - now) / 50));
        await page.evaluate(`${GAME}.stepFrames(${steps}, 50)`);
        await sleep(100);
        await page.screenshot(join(out, `at-${moment}-${window.name}.png`));
      }
      await page.evaluate(`${GAME}.resumeLoop()`);
    }
    // A game in progress: the shortest honest way to one is to start it.
    await page.tap('Space');
    await page.waitFor(`${GAME}.scene.isActive('starter')`);
    await page.waitFor(`(() => { const b = document.querySelector('button[data-starter=charmander]'); if (!b) return false; b.click(); return true; })()`);
    await page.waitFor(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Confirm/.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
    await page.waitFor(`localStorage.getItem('escape-from-pallet-town.save.v1') !== null`);
    const loaded = new Promise((resolve) => page.on('Page.loadEventFired', resolve));
    await page.send('Page.navigate', { url });
    await loaded;
    await page.waitFor(onTitle, { timeoutMs: 60_000 });
    await sleep(600);
    await page.screenshot(join(out, `saved-${window.name}.png`));
    await page.tap('ArrowDown');
    await sleep(300);
    await page.tap('Space');
    await sleep(400);
    await page.screenshot(join(out, `erase-${window.name}.png`));
    await page.tap('Escape');
    await sleep(300);
    for (let step = 0; step < 4; step += 1) await page.tap('ArrowDown');
    await sleep(300);
    await page.screenshot(join(out, `bottom-${window.name}.png`));
  } finally {
    await browser.close();
  }
}
console.log(`title shots in ${out}`);
