// The harbour's edges: `harbourEdges.mjs <test-mode build url> <dir> [--port=N]`.
// Replays the harbour playtest of 14 Nov 2026 in the game and fails on any of
// its findings coming back: the invisible wall at the long pier's head, a rod
// cast into a rowing boat, the WAREHOUSES caption on the boutique's step, and
// the lab's door under the FEEDBACK tab on the smallest screen. (The fourth,
// the rim's SAFE line off the screen, is the first jump: `firstRaid.mjs --shots`.)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const [url, out] = process.argv.slice(2);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
const failures = [];
const expectThat = (holds, what) => {
  console.log(`${holds ? 'ok  ' : 'FAIL'} ${what}`);
  if (!holds) failures.push(what);
};
const base = `${GAME}.scene.getScene('base')`;
const ready = `${sceneIs('base')} && ${base}.ready && !${base}.leaving`;
const standAt = (at) => `void ${base}.scene.start('base', ${JSON.stringify(at ? { at } : {})})`;
const here = () => `${base}.currentTile`;
const settled = `${ready} && !${base}.targetTile && ${base}.walkPlan === null`;
/** The captions on the screen right now, by their words. */
const captions = `${base}.worldLabels.filter((label) => label.shown()).map((label) => label.label.text.replace(/\\n/g, ' / '))`;

mkdirSync(out, { recursive: true });
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage(url);
  await page.evaluate(`localStorage.clear()`);
  await page.send('Page.reload', {});
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await sleep(500);
  await page.tap('Space');
  await page.waitFor(`${base}?.takeStarterForDriver?.("charmander") === true`, { timeoutMs: 60_000 });
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.waitFor(ready, { timeoutMs: 60_000 });
  // A rod of their own: the angler's book has a MAGIKARP in it.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); save.raidProgress.harbourCatches = [129]; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);

  const goTo = async (at) => {
    await page.evaluate(standAt(at));
    await sleep(400);
    await page.waitFor(settled, { timeoutMs: 60_000 });
    await sleep(300);
  };
  const press = async (code) => {
    await page.tap(code);
    await sleep(120);
    await page.waitFor(settled, { timeoutMs: 60_000 });
  };
  /** Turns to face the water, pressing again if a press went in before the scene listened. */
  const faceDown = async () => {
    for (let tries = 0; tries < 5 && (await page.evaluate(`${base}.facing`)) !== 'down'; tries += 1) {
      await press('ArrowDown');
      await sleep(200);
    }
    await sleep(200);
    return (await page.evaluate(`${base}.facing`)) === 'down';
  };

  // 1. Out of HARBOUR SQUARE on the left of its three-wide way out, straight down the pier.
  await goTo({ x: 27, y: 19 });
  for (let step = 0; step < 4; step += 1) await press('ArrowDown');
  const walked = await page.evaluate(here());
  expectThat(walked.x === 27 && walked.y === 23, `walks from (27,19) down on to the pier, to (27,23) (stood at ${walked.x},${walked.y})`);
  await page.screenshot(join(out, '1-pier-head-walked.png'));

  // 2. Face the red rowing boat under the fish stall, then the open water beside it.
  await goTo({ x: 38, y: 20 });
  expectThat(await faceDown(), 'turns to face the rowing boat at (38,21)');
  const atBoat = await page.evaluate(`${base}.hintShown`);
  expectThat(!String(atBoat).includes('FISH'), `facing the rowing boat at (38,21) offers no cast (${JSON.stringify(atBoat)})`);
  await page.screenshot(join(out, '2-facing-the-boat.png'));
  await goTo({ x: 41, y: 20 });
  expectThat(await faceDown(), 'turns to face the sea at (41,21)');
  const atSea = await page.evaluate(`${base}.hintShown`);
  expectThat(String(atSea).includes('FISH'), `facing the sea at (41,21) still does (${JSON.stringify(atSea)})`);

  // 3. The boutique's step: the boutique speaks there, the warehouses do not.
  await goTo({ x: 49, y: 18 });
  const onStep = await page.evaluate(captions);
  expectThat(!onStep.some((text) => text.includes('WAREHOUSES')), `the warehouses are silent on the boutique's step (${JSON.stringify(onStep)})`);
  await page.screenshot(join(out, '3-boutique-step.png'));
  await goTo({ x: 40, y: 19 });
  const atFront = await page.evaluate(captions);
  expectThat(atFront.some((text) => text.includes('WAREHOUSES')), `and still name themselves along their own front (${JSON.stringify(atFront)})`);

  // 4. A new visit on the smallest screen, at twice and three times over: the lab's door clear of the tab.
  for (const window of [{ width: 640, height: 480 }, { width: 960, height: 720 }]) {
    await page.send('Emulation.setDeviceMetricsOverride', { ...window, deviceScaleFactor: 1, mobile: false });
    await sleep(600);
    await goTo(null);
    const placed = await page.evaluate(`(() => {
      const b = ${base};
      const canvas = ${GAME}.canvas.getBoundingClientRect();
      const view = b.cameras.main.worldView;
      const scale = canvas.width / b.scale.width;
      const tab = document.querySelector('.feedback-tab').getBoundingClientRect();
      // Each door's tiles, the lab's two wide; a door is read by its doorway,
      // the middle half of them (\`harbourLooks.test.ts\`).
      const doors = [[8, 8, 12], [19, 19, 11], [25, 26, 11], [14, 14, 17]].map(([from, to, y]) => ({
        x: from === to ? String(from) : from + '-' + to, y,
        left: canvas.left + (from * 16 - view.x) * scale,
        right: canvas.left + ((to + 1) * 16 - view.x) * scale,
        top: canvas.top + (y * 16 - view.y) * scale,
        size: 16 * scale,
      }));
      return { canvas: { left: canvas.left, top: canvas.top, right: canvas.right, bottom: canvas.bottom }, tab: { left: tab.left, top: tab.top, right: tab.right, bottom: tab.bottom }, doors, stage: [b.scale.width, b.scale.height] };
    })()`);
    for (const door of placed.doors) {
      const inside =
        door.left >= placed.canvas.left - 0.5 && door.right <= placed.canvas.right + 0.5 &&
        door.top >= placed.canvas.top - 0.5 && door.top + door.size <= placed.canvas.bottom + 0.5;
      const quarter = (door.right - door.left) / 4;
      const underTab =
        door.left + quarter < placed.tab.right && door.right - quarter > placed.tab.left && door.top < placed.tab.bottom && door.top + door.size > placed.tab.top;
      expectThat(inside && !underTab, `${window.width}x${window.height} (stage ${placed.stage.join('x')}): the door at ${door.x},${door.y} is on the screen, its doorway clear of the FEEDBACK tab`);
    }
    await page.screenshot(join(out, `4-arrival-${window.width}x${window.height}.png`));
  }
  await page.close();
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log("the harbour's edges hold");
