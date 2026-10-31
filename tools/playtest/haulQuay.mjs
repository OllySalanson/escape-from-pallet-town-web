// The haul on the quay: `haulQuay.mjs <test-mode build url> <dir> [--port=N]`.
// Comes home from a raid as the result screen hands over, on the Arena's rim,
// walks out of the door and photographs the boat's haul; goes through a door and
// back and fails if it has not been carried off, or if a lost raid leaves any.
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
const goHome = (haul) => `void ${base}.scene.start('base', { arrival: 'raid', room: 'raid-arena', ${haul ? `haul: ${JSON.stringify(haul)}, ` : ''}raidMood: 'quiet' })`;
const goTo = (data) => `void ${base}.scene.start('base', ${JSON.stringify(data)})`;

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
  await page.waitFor(ready);

  const haul = ['potion', 'poke-ball', 'parts-crate', 'money', 'radio-valve', 'mooring-rope', 'cable-coil'];
  await page.evaluate(goHome(haul));
  await sleep(600);
  await page.waitFor(ready);
  expectThat((await page.evaluate(`${base}.room?.id`)) === 'raid-arena', 'a raid comes home to the Arena, as it did');
  expectThat((await page.evaluate(`${base}.haulOnTheQuay.length`)) === 0, 'and nothing of the haul is in the hall');

  // Out of the Arena's door, and to the quay above the boat.
  await page.evaluate(goTo({ from: 'raid-arena' }));
  await sleep(600);
  await page.waitFor(ready);
  await page.screenshot(join(out, 'quay-from-the-door.png'));
  expectThat((await page.evaluate(`${base}.haulOnTheQuay.length`)) === haul.length, 'the first time out in the yard it is on the quay');
  await page.evaluate(`${base}.walkThen([{ x: 8, y: 17 }], null, () => undefined)`);
  await page.waitFor(`${base}.walkPlan === null && !${base}.targetTile`, { timeoutMs: 30_000 });
  await sleep(500);
  await page.screenshot(join(out, 'quay-the-haul.png'));

  // Speak to the sailor about it.
  const sailorSays = await page.evaluate(`(() => { const b = ${base}; const said = []; const say = b.say; b.say = (lines) => said.push(...lines); b.harbourLife.at = () => ({ id: 'seagallop-sailor', kind: 'person' }); b.harbourLife.face = () => undefined; b.tryInteract(); b.say = say; return said; })()`);
  expectThat(sailorSays[0]?.includes('your haul'), `the sailor says so (${JSON.stringify(sailorSays[0])})`);

  // Through a door and back: carried off.
  await page.evaluate(goTo({ from: 'oaks-lab' }));
  await sleep(600);
  await page.waitFor(ready);
  expectThat((await page.evaluate(`${base}.haulOnTheQuay.length`)) === 0, 'the next time, it has gone up to the vault');

  // A lost raid hands over nothing, and the boat still ties up with nothing on the quay.
  await page.evaluate(goHome(null));
  await sleep(600);
  await page.waitFor(ready);
  await page.evaluate(goTo({ from: 'raid-arena' }));
  await sleep(600);
  await page.waitFor(ready);
  expectThat((await page.evaluate(`${base}.haulOnTheQuay.length`)) === 0, 'a lost raid leaves nothing on the quay');
  await page.close();
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log('the haul came home, and went up to the vault');
