// The rides on a raid's ways out (`src/game/world/exitVehicles.ts`), photographed
// in the real game: stand beside an exit and look at its ride, then step onto
// one and watch it leave with the player.
//
//   nice -n 15 node tools/playtest/exitRides.mjs <test-mode build url> <out dir> [stops] [deploy options] [--port=N]
//
// A stop is `name:x:y`, which stands the player on that tile (placed, not
// walked, as tour.mjs does) and photographs the frame, or `board:name:x:y:dir`,
// which stands them there, then presses `dir` (up, down, left, right) to step
// onto the exit beside them and photographs the ride leaving at four moments.
// A board stop ends the raid, so it is the last stop.
//
// Every frame is stepped (`stepFrames`), so the ride's swell, wings and
// departure are the scene clock's and the pictures are the same every run.
// Deploy options are deploy.mjs's: `--explorer --insertion=player-sample-lane/south-road`
// is the sample player map.
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir, ...stops] = args.filter((a) => !a.startsWith('--'));
if (!base || !outDir) {
  console.error('usage: node tools/playtest/exitRides.mjs <url> <out dir> name:x:y.. [board:name:x:y:dir] [--port=N]');
  process.exit(2);
}
const port = args.find((a) => a.startsWith('--port='))?.slice('--port='.length);
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const url = new URL(base);
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

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
  const press = async (code) => {
    await page.keyDown(code);
    await wait(60);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  await deploy(page, url.href, { press, click, until, wait, paused: true, ...deployOptions(args) });
  await wait(600);
  console.log('map:', await page.evaluate(`${GAME}.scene.getScene('world').currentMap.id`));
  for (let i = 0; i < 12; i += 1) {
    await press('Space');
    await wait(200);
  }
  // What every exit on the map is riding, as the scene drew it.
  console.log(
    await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').extractionMarkers.map((m) => [m.point.label, m.ride?.ride.vehicle ?? 'square', m.ride?.ride.facing ?? '', m.point.position.x + ',' + m.point.position.y]))`),
  );
  const standAt = (x, y) =>
    page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16;
      w.currentTile = { x: ${x}, y: ${y} }; w.setPlayerPosition(${x} * 16, ${y} * 16 + off);
      w.configureCamera(); w.cameras.main.centerOn(w.player.x, w.player.y); })()`);
  for (const stop of stops) {
    const parts = stop.split(':');
    if (parts[0] === 'board') {
      const [, name, x, y, dir] = parts;
      await standAt(Number(x), Number(y));
      await wait(2000);
      await page.screenshot(`${outDir}/board-${name}-0.png`);
      await page.keyDown(KEYS[dir]);
      await wait(100);
      await page.keyUp(KEYS[dir]);
      // The step is 150ms; the ride takes 640ms to go, inside the 700ms the world stands.
      for (const [index, ms] of [[1, 200], [2, 150], [3, 150], [4, 150]]) {
        await wait(ms);
        await page.screenshot(`${outDir}/board-${name}-${index}.png`);
      }
      console.log('boarded', name);
      break;
    }
    const [name, x, y] = parts;
    await standAt(Number(x), Number(y));
    await wait(3000);
    await page.screenshot(`${outDir}/ride-${name}.png`);
    console.log('shot', name, x, y);
  }
} finally {
  await browser.close();
}
