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
// --beaten=bossId,bossId tours the map as a player who has beaten those bosses
// sees it. It goes the way a player does: the game writes its own save, the
// bosses are marked beaten in it, the page is reloaded and the next raid is
// deployed from that save - so the doors are open because the raid was built
// with them open, not because a scene's private state was poked.
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
const args = process.argv.slice(2);
const beaten = (args.find((a) => a.startsWith('--beaten=')) ?? '--beaten=').slice(9).split(',').filter(Boolean);
const [base, outDir, ...stops] = args.filter((a) => !a.startsWith('--'));
const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const GAME = 'window.__escapeFromPalletTownGame__';
const url = new URL(base); url.searchParams.set('testmode', 'pixels');
const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const sceneIs = (key) => `${GAME}?.scene.getScenes(true).some((s) => s.scene.key === '${key}')`;
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => { for (let i = 0; i < 300; i += 1) { if (await page.evaluate(expression)) return; await wait(100); } throw new Error(`never saw ${what}`); };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => { await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`); await wait(350); };
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space'); await until(sceneIs('starter'));
  await click('Confirm Bulbasaur');
  if (beaten.length > 0) {
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the game to write its save');
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      save.raidProgress.defeatedBosses = ${JSON.stringify(beaten)}; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: url.href });
    await page.waitFor(sceneIs('title'));
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space'); await until(sceneIs('hub'));
    console.log('continuing from a save with beaten:', beaten.join(', '));
  }
  for (const label of ['Start a raid', 'Bulbasaur', 'Review & deploy', 'Enter the raid']) await click(label);
  await until(sceneIs('world')); await wait(600);
  console.log('gates open in this raid:', await page.evaluate(`${GAME}.scene.getScene('world').defeatedBosses.join(', ') || '(none)'`));
  // Clear the opening dialogue so it is not across every frame.
  for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }
  for (const stop of stops) {
    const [name, x, y] = stop.split(':');
    await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16;
      w.currentTile = { x: ${x}, y: ${y} }; w.setPlayerPosition(${x} * 16, ${y} * 16 + off); })()`);
    await wait(900);
    await page.screenshot(`${outDir}/tour-${name}.png`);
    console.log('shot', name, x, y);
  }
} finally {
  await browser.close();
}
