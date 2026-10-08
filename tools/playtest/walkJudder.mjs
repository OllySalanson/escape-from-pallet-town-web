// Holds a direction key and prints how far the player moved on every frame.
//
//   node tools/playtest/walkJudder.mjs <dev server url> [--scene=base|world] [--fps=60]
//
// A held walk should move the same distance every frame: 16 pixels a tile over
// `STEP_DURATION_MS` is 1.78 pixels a frame at sixty. Playtest 28 (F1) found
// `1.78 x7, 0, 3.55` instead - one frame standing still and the next moving two
// frames' worth, once a tile, and the camera follows the player so the whole
// map shook with it. The step clock's own test cannot see that, because no game
// time is lost; only the per-frame picture shows it, which is what this prints.
// It exits non-zero when any frame of the walk differs from the steady rate.
//
// The loop is paused and stepped at an exact frame length, so the result is the
// same on any machine. `--scene=base` walks the harbour (a fresh save's yard);
// `--scene=world` deploys into the Floodplain and walks there.
import { launchBrowser } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base] = args.filter((a) => !a.startsWith('--'));
const option = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sceneKey = option('scene', 'world');
const frameMs = 1000 / Number(option('fps', '60'));
const url = new URL(base);
url.searchParams.set('testmode', '1');

const browser = await launchBrowser();
let failed = false;
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => {
    await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`);
    await wait(350);
  };

  if (sceneKey === 'world') {
    await deploy(page, url.href, { press, click, until, wait, paused: true });
    await wait(600);
    // The briefing the raid opens on.
    for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }
  } else {
    await page.waitFor(sceneIs('title'));
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space'); await until(sceneIs('starter'));
    await until(`(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`, 'the picker');
    await click('Confirm Bulbasaur');
    await until(`${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`, 'the base');
    await wait(600);
  }

  // The longest run of open ground running east that no step on it would stop
  // (tall grass rolls, a door or an exit takes the player): stand at its west end.
  const lane = await page.evaluate(`(() => {
    const s = ${GAME}.scene.getScene('${sceneKey}');
    const grid = s.collisionData ?? s.collision;
    const quiet = (x, y) => grid[y]?.[x] === false && !s.isBlocked({ x, y })
      && (!s.currentMap || (!s.currentMap.tallGrass?.[y]?.[x] && !(s.extractionPointsForCurrentMap?.() ?? []).some((e) => e.position.x === x && e.position.y === y)))
      && !(s.doors ?? []).some((d) => d.tiles.some((t) => t.x === x && t.y === y));
    let best = null;
    for (let y = 0; y < grid.length; y += 1) {
      let start = null;
      for (let x = 0; x <= grid[y].length; x += 1) {
        if (x < grid[y].length && quiet(x, y)) { if (start === null) start = x; continue; }
        if (start !== null && (!best || x - start > best.length)) best = { x: start, y, length: x - start };
        start = null;
      }
    }
    const off = s.player.y - s.currentTile.y * 16;
    s.currentTile = { x: best.x, y: best.y };
    s.setPlayerPosition(best.x * 16, best.y * 16 + off);
    return best; })()`);
  const tiles = Math.min(lane.length - 1, 6);
  console.log(`${sceneKey}: walking east from ${lane.x},${lane.y} for ${tiles} tiles at ${(1000 / frameMs).toFixed(0)} fps`);

  const xs = [await page.evaluate(`${GAME}.scene.getScene('${sceneKey}').player.x`)];
  await page.keyDown('ArrowRight');
  const frames = Math.floor((tiles * 150) / frameMs) - 2;
  for (let i = 0; i < frames; i += 1) {
    xs.push(await page.evaluate(`(${GAME}.stepFrames(1, ${frameMs}), ${GAME}.scene.getScene('${sceneKey}').player.x)`));
  }
  await page.keyUp('ArrowRight');

  const moves = xs.slice(1).map((x, i) => Math.round((x - xs[i]) * 100) / 100);
  const steady = 16 / (150 / frameMs);
  // The first frame begins the step from rest and moves nothing, as it always has.
  const walked = moves.slice(1);
  const off = walked.filter((m) => Math.abs(m - steady) > 0.05);
  console.log('per-frame movement:', moves.join(' '));
  console.log(`steady rate ${steady.toFixed(2)} px; ${off.length} of ${walked.length} frames off it`);
  failed = off.length > 0;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
