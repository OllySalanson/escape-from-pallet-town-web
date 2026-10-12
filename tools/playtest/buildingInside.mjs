// Walks into a building on a shipped map and back out by its other door, in the
// real game, and reports what a player would see happen
// (`src/game/world/buildingInsides.ts`).
//
//   node tools/playtest/buildingInside.mjs <dev server url> [out dir] [--inside=press-house] [--port=N]
//
// --port=N drives a browser already running on that CDP port rather than
// starting one. Screenshots go in the out dir when one is given.
//
// What only the scene can show: pressing up into a door goes through it - a fade
// onto the room's mat, framed on black and named on the plate - the hunter
// outside loses the trail and walks to the doorstep instead, and stepping off
// the other mat comes out of the other building's door, seen again.
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((a) => !a.startsWith('--'));
const wanted = (args.find((a) => a.startsWith('--inside=')) ?? '').split('=')[1] || 'press-house';
const url = new URL(base);
url.searchParams.set('testmode', args.includes('--pixels') ? 'pixels' : '1');
const port = (args.find((a) => a.startsWith('--port=')) ?? '').split('=')[1];

const browser = port
  ? attachBrowser(Number(port), { window: PIXEL_WINDOW })
  : await launchBrowser({ window: PIXEL_WINDOW });
let page;
try {
  page = await browser.openPage('about:blank');
  // A browser that was attached to may hold a save from an earlier run, and
  // this walk starts from a new game.
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`typeof localStorage !== 'undefined'`);
  await page.evaluate('localStorage.clear()');
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
  const hold = async (code, ms) => { await page.keyDown(code); await wait(ms); await page.keyUp(code); };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  await deploy(page, url.href, { press, click, until, wait, paused: true, ...deployOptions(args) });
  await wait(600);
  for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }

  const world = `${GAME}.scene.getScene('world')`;
  const room = await page.evaluate(
    `(() => { const w = ${world}; const a = (w.currentMap.areas ?? []).find((p) => p.id === ${JSON.stringify(wanted)});
       if (!a) throw new Error('no inside ' + ${JSON.stringify(wanted)} + ' on ' + w.currentMap.id);
       const doors = w.currentMap.warps.filter((p) => p.activation === 'push' && p.toward === 'up'
         && p.destination.x >= a.rect.x && p.destination.x < a.rect.x + a.rect.width
         && p.destination.y >= a.rect.y && p.destination.y < a.rect.y + a.rect.height);
       return { name: a.name, rect: a.rect, hides: a.hides === true, streets: doors.map((d) => d.source) }; })()`,
  );
  console.log(`${room.name}: ${room.streets.length} doors, hides: ${room.hides}`);
  const [front, back] = room.streets;

  const stand = async (tile, facing = 'up') => {
    await page.evaluate(
      `(() => { const w = ${world}; const off = w.player.y - w.currentTile.y * 16;
         w.currentTile = { x: ${tile.x}, y: ${tile.y} }; w.targetTile = null; w.facing = ${JSON.stringify(facing)};
         w.setPlayerPosition(${tile.x} * 16, ${tile.y} * 16 + off); w.configureCamera(); })()`,
    );
    await wait(400);
  };
  const where = () => page.evaluate(
    `(() => { const w = ${world}; return JSON.stringify({ tile: w.currentTile, area: w.currentArea()?.id ?? null, hidden: w.playerIsHidden() }); })()`,
  );

  // The street in front of the first door, with the hunter a few steps down
  // the yard and last having seen the player right here.
  await stand(front);
  const hunterStart = { x: front.x, y: front.y + 3 };
  await page.evaluate(
    `(() => { const w = ${world}; w.hunterState = { ...w.hunterState, spawned: true, defeated: false, mapId: w.currentMap.id,
       position: ${JSON.stringify(hunterStart)}, lastSeen: ${JSON.stringify(front)} }; w.placeFigure('hunter', ${hunterStart.x}, ${hunterStart.y}, 'up'); })()`,
  );
  if (outDir) await page.screenshot(`${outDir}/inside-street.png`);
  console.log('on the doorstep     ', await where());

  // Up into the door: a fade, and the room.
  await hold('ArrowUp', 200);
  await wait(1500);
  console.log('pressed up the door ', await where());
  for (let i = 0; i < 20; i += 1) { await wait(200); }
  if (outDir) await page.screenshot(`${outDir}/inside-room.png`);
  console.log('hunter, while inside', await page.evaluate(`JSON.stringify(${world}.hunterState.position)`), 'walking to', await page.evaluate(`JSON.stringify(${world}.hunterState.lastSeen)`));

  // Along to the other mat and down off it, out of the other building's door.
  const inside = await page.evaluate(`JSON.stringify(${world}.currentTile)`);
  const mats = await page.evaluate(
    `(() => { const w = ${world}; return JSON.stringify(w.currentMap.warps.filter((p) => p.activation === 'push' && p.toward === 'down'
       && p.destination.x === ${back.x} && p.destination.y === ${back.y}).map((p) => p.source)); })()`,
  );
  const otherMat = JSON.parse(mats)[0];
  console.log('came in on', inside, '- the other mat is', JSON.stringify(otherMat));
  await stand(otherMat, 'down');
  await hold('ArrowDown', 200);
  await wait(1500);
  console.log('stepped off the mat ', await where());
  for (let i = 0; i < 4; i += 1) { await wait(200); }
  if (outDir) await page.screenshot(`${outDir}/inside-out-the-back.png`);
  console.log('hunter, seen again: ', await page.evaluate(`JSON.stringify(${world}.hunterState.lastSeen)`));
} finally {
  await page?.close();
  await browser.close();
}
