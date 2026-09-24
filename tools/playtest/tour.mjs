// A looking-only tour of a map in the real game: stand the player at a vantage
// in each place named and photograph the frame (WebGL, stepped, 3x window).
// Walking a raid is raid.mjs's job; this is for judging a screen by eye, which a
// render cannot do - captions, watch shading, gate barricades, drop-in marks and
// what a canopy hides are only drawn by the scene.
//
//   nice -n 15 node tools/playtest/tour.mjs <dev server url> <out dir> name:x:y [name:x:y ...]
//
// The player is placed, not walked, so it goes through shut gates: a stop inside
// a sealed district shows that district as a fresh save would never see it.
//
// --look holds the look key for every shot, which is the map with every caption on it: the
// map-editor view, which is what the game used to draw all the time. Without it a shot is what a
// player walking there sees - see `src/game/ui/captionReveal.ts`.
//
// --remaining=SECONDS winds the raid clock on, for the screens that only exist late in a raid: an
// open exit calls its own name once the clock goes red - see `src/game/ui/captionReveal.ts`.
//
// --insertion=id tours another map, or another part of this one (`town-square`,
// `route-1`, `route-1-overlook`, `viridian-forest`, a Floodplain drop-in), and
// --beaten=bossId,bossId tours it as a player who has beaten those bosses sees
// it. Both go the way a player does - see deploy.mjs - so the doors are open
// because the raid was built with them open.
//
// A stop that is not ground (a roof, a trainer's own tile) is moved to the
// nearest tile that is, and the log says where.
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions } from './deploy.mjs';
const args = process.argv.slice(2);
const [base, outDir, ...stops] = args.filter((a) => !a.startsWith('--'));
const url = new URL(base); url.searchParams.set('testmode', 'pixels');
const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => { for (let i = 0; i < 300; i += 1) { if (await page.evaluate(expression)) return; await wait(100); } throw new Error(`never saw ${what}`); };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => { await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`); await wait(350); };
  await deploy(page, url.href, { press, click, until, wait, paused: true, ...deployOptions(args) });
  await wait(600);
  console.log('map:', await page.evaluate(`${GAME}.scene.getScene('world').currentMap.id`));
  console.log('gates open in this raid:', await page.evaluate(`${GAME}.scene.getScene('world').defeatedBosses.join(', ') || '(none)'`));
  // Clear the opening dialogue so it is not across every frame.
  for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }
  if (args.includes('--look')) { await page.keyDown('KeyL'); await wait(200); }
  const remaining = args.find((a) => a.startsWith('--remaining='));
  if (remaining) { const s = Number(remaining.split('=')[1]);
    await page.evaluate(`(() => { const m = ${GAME}.scene.getScene('world').runSession.manager; m.elapsedMsValue = m.durationMs - ${s} * 1000; })()`);
    await wait(200); console.log('raid clock wound to', s, 'seconds left'); }
  for (const stop of stops) {
    const [name, wantX, wantY] = stop.split(':');
    const { x, y } = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const c = w.collisionData;
      const free = (t) => c[t.y]?.[t.x] === false && !w.isBlocked(t); const seen = new Set(); const queue = [{ x: ${Number(wantX)}, y: ${Number(wantY)} }];
      while (queue.length) { const t = queue.shift(); if (free(t)) return t;
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) { const n = { x: t.x + dx, y: t.y + dy }; const k = n.y * 1000 + n.x;
          if (c[n.y]?.[n.x] !== undefined && !seen.has(k)) { seen.add(k); queue.push(n); } } }
      throw new Error('no ground on this map'); })()`);
    if (x !== Number(wantX) || y !== Number(wantY)) console.log(`${name}: ${wantX},${wantY} is not ground, standing at ${x},${y}`);
    await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16;
      w.currentTile = { x: ${x}, y: ${y} }; w.setPlayerPosition(${x} * 16, ${y} * 16 + off); })()`);
    // Long enough for whatever the scene starts on arrival to have finished.
    // Phaser advances a tween on the real clock rather than on the game time a
    // stepped frame hands it, so a stepped frame is worth a few milliseconds to
    // one: at 900ms of game time an interior's lid (`world/interiors.ts`) was
    // still halfway through coming back on, and the shot showed a hillside with
    // a cave visible through it.
    await wait(4000);
    await page.screenshot(`${outDir}/tour-${name}.png`);
    console.log('shot', name, x, y);
  }
} finally {
  await browser.close();
}
