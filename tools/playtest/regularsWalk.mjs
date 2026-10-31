// THE HARBOUR's regulars, watched walking at real speed: a new game stands at
// the spawn and every regular's drawn figure is sampled each animation frame
// for ten seconds of sixty-frame steps. A regular must never step straight back
// onto the tile it has just left, nor take a step quicker than a player walks
// - the captain saw them shake "one step forward and one step back" (29 Oct).
//
//   node tools/playtest/regularsWalk.mjs <test-mode url> <out dir> [--port=N]
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=1', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
mkdirSync(out, { recursive: true });
const BASE = `${GAME}.scene.getScene('base')`;
const TILE = 16;
const STEP_MS = 150;

const browser = option('port')
  ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW })
  : await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.keyDown('Space');
  await page.keyUp('Space');
  await page.waitFor(sceneIs('base'), { timeoutMs: 60_000 });
  await page.waitFor(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, { timeoutMs: 60_000 });
  await page.waitFor(`${sceneIs('base')} && ${BASE}.ready`, { timeoutMs: 60_000 });
  // Ten seconds at sixty frames a second, stepped so a slow machine is not
  // read as a fault: each regular's sprite, where it is drawn, every frame.
  await page.evaluate(`${GAME}.pauseLoop()`);
  const FRAME_MS = 1000 / 60;
  const samples = [];
  for (let frame = 0; frame < 600; frame += 1) {
    await page.evaluate(`${GAME}.stepFrames(1, ${FRAME_MS})`);
    const figures = await page.evaluate(`(() => {
      const scene = ${BASE};
      const names = new Set(scene.harbourRegularsShown.map((r) => r.name));
      return [...(scene.harbourFigures?.drawn ?? new Map()).values()]
        .filter((d) => names.has(d.name.text))
        .map((d) => ({ name: d.name.text, x: d.sprite.x, y: d.sprite.y, anim: d.sprite.anims.currentAnim?.key ?? null }));
    })()`);
    samples.push({ at: frame * FRAME_MS, figures });
  }
  await page.screenshot(`${out}/regulars.png`);
  const faults = [];
  const trail = new Map();
  let animSwaps = 0;
  for (const frame of samples) {
    for (const figure of frame.figures) {
      const tile = { x: Math.round(figure.x / TILE), y: Math.round((figure.y) / TILE) };
      const last = trail.get(figure.name);
      if (last && last.anim && figure.anim && last.anim !== figure.anim) animSwaps += 1;
      if (!last) {
        trail.set(figure.name, { tile, left: null, since: frame.at, anim: figure.anim });
        continue;
      }
      last.anim = figure.anim;
      if (tile.x === last.tile.x && tile.y === last.tile.y) continue;
      if (last.left && last.left.x === tile.x && last.left.y === tile.y && frame.at - last.since < 2 * STEP_MS) {
        faults.push(`${figure.name} stepped straight back at ${Math.round(frame.at)}ms`);
      }
      if (frame.at - last.since < STEP_MS * 0.6) faults.push(`${figure.name} took a step in ${Math.round(frame.at - last.since)}ms`);
      trail.set(figure.name, { tile, left: last.tile, since: frame.at, anim: figure.anim });
    }
  }
  const names = [...trail.keys()];
  console.log(`${samples.length} frames; regulars: ${names.join(', ')}; walk animation changes: ${animSwaps}; faults: ${faults.length}`);
  faults.slice(0, 10).forEach((fault) => console.log(`  ${fault}`));
  if (faults.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
