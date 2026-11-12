// A new save's gold chevron in THE HARBOUR (`src/game/base/wayMark.ts`) never
// stands on a caption: at the screen's edge it stood on the first letter of
// whichever place's caption was seated there, and THE WAREHOUSES read
// HE WAREHOUSES.
//
//   node tools/playtest/harbourChevron.mjs <test-mode build url> <out dir> [--port=N] [--before]
//
// A new game, stood on the lawn above THE WAREHOUSES, where their caption is
// seated against the left edge at the player's height, and then walked along
// the lawn and the path, the chevron's box asked against every caption on show
// on every frame. Stepped on a paused loop, so it needs a test-mode build.
// `--before` takes the picture and asks nothing.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
const before = args.includes('--before');
const FRAME_MS = 1000 / 60;
const WINDOW = { width: 800, height: 512 };
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`harbourChevron: ${why}`);
};

const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
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
    fail(`never saw ${what}`);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;

  await page.keyDown('Space');
  await step(1);
  await page.keyUp('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  await page.evaluate(`void ${base}.scene.start('base', { at: { x: 42, y: 15 }, facing: 'down' })`);
  await until(baseReady, 'the lawn above the warehouses');
  await until(`${base}.yardWayMark !== null`, 'the chevron of a save yet to raid');

  /** The chevron's box and every caption on show, on the screen, this frame. */
  const seen = () =>
    page.evaluate(`(() => { const b = ${base}; const view = b.cameras.main.worldView; const image = b.yardWayMark.image;
      const turned = image.angle === 90 || image.angle === -90 || image.angle === 270;
      const half = turned ? { x: image.displayHeight / 2, y: image.displayWidth / 2 } : { x: image.displayWidth / 2, y: image.displayHeight / 2 };
      return {
        chevron: image.visible ? { left: image.x - half.x, top: image.y - half.y, width: half.x * 2, height: half.y * 2 } : null,
        captions: b.worldLabels.flatMap((label) => { const at = label.shown(); return at ? [{ left: at.left - view.left, top: at.top - view.top, width: at.width, height: at.height, text: label.label.text.split('\\n')[0] }] : []; }),
      }; })()`);
  const crossing = (now) =>
    now.chevron === null
      ? []
      : now.captions.filter(
          (caption) =>
            now.chevron.left < caption.left + caption.width &&
            now.chevron.left + now.chevron.width > caption.left &&
            now.chevron.top < caption.top + caption.height &&
            now.chevron.top + now.chevron.height > caption.top,
        );
  let frames = 0;
  let onACaption = 0;
  const named = new Set();
  const watch = async (count) => {
    for (let frame = 0; frame < count; frame += 1) {
      await step(1);
      const now = await seen();
      frames += 1;
      now.captions.forEach((caption) => named.add(caption.text));
      const crossed = crossing(now);
      if (crossed.length > 0) {
        onACaption += 1;
        if (!before) fail(`the chevron at ${JSON.stringify(now.chevron)} stands on "${crossed[0].text}" at ${JSON.stringify(crossed[0])}`);
      }
    }
  };

  // Standing, for a whole bob and more; then along the lawn and back, and up to the path and along it.
  await watch(90);
  await page.screenshot(`${out}/lawn-above-the-warehouses.png`);
  for (const [code, count] of [['ArrowRight', 70], ['ArrowLeft', 150], ['ArrowUp', 40], ['ArrowLeft', 120], ['ArrowRight', 200]]) {
    await page.keyDown(code);
    await watch(count);
    await page.keyUp(code);
    await watch(10);
  }
  console.log(`${frames} frames, ${named.size} captions on show (${[...named].join(', ')}), the chevron on one for ${onACaption}`);
  if (!before && named.size === 0) fail('no caption was ever on show, so nothing was asked');
} finally {
  await browser.close();
}
