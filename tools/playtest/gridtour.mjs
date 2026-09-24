// A blind tour of a map in the real game: the map's size is read from the
// running game and tiled with playable-view frames (400x256 logical, 25x16
// tiles, WebGL, stepped, 3x window), so whoever looks at the frames needs to
// know nothing about the map first. tour.mjs wants named stops, and knowing the
// stops is knowing the map - which is exactly what a memory test may not.
//
//   nice -n 15 node tools/playtest/gridtour.mjs <dev server url> <out dir> [--insertion=id] [--beaten=bossId,..]
//
// Frames are named `tour-g_<y>_<x>.png` for the tile asked for; a stop that is
// not ground is moved to the nearest tile that is, and the log says where. The
// player is placed, not walked, so it goes through shut gates - see tour.mjs.
//
// The method it is for (README.md, "The stranger's memory test"): hand the
// frames, once each and in order, to someone who has read nothing else - a
// fresh agent told to open no other file - and have them draw the map from
// memory. What they cannot place is what the map does not say.
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
  const dims = await page.evaluate(`(() => { const c = ${GAME}.scene.getScene('world').collisionData; return { w: c[0].length, h: c.length }; })()`);
  const start = await page.evaluate(`${GAME}.scene.getScene('world').currentTile`);
  console.log('size', dims.w, dims.h, 'insertion', JSON.stringify(start));
  const centres = (n, view) => { if (n <= view) return [Math.floor(n / 2)]; const k = Math.ceil((n - 2) / (view - 3)); const out = []; for (let i = 0; i < k; i += 1) out.push(Math.round(view / 2 - 1 + i * (n - view + 2) / Math.max(1, k - 1))); return out; };
  stops.length = 0;
  for (const y of centres(dims.h, 16)) for (const x of centres(dims.w, 25)) stops.push(`g_${y}_${x}:${x}:${y}`);
  console.log('grid', stops.join(' '));
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
    await wait(900);
    await page.screenshot(`${outDir}/tour-${name}.png`);
    console.log('shot', name, x, y);
  }
} finally {
  await browser.close();
}
