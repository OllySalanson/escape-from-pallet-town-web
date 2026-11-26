// Walks to each of Brock's builds in the yard with every one built, faces it,
// and photographs it, then opens BROCK'S WORKSHOP on his plans - the pictures a
// change to a build's art is judged by (`docs/screens/brock-builds-art/`) - and
// moves THE MAST with MOVE IT, photographing each place it may stand
// (`docs/screens/brock-build-places/`).
//
//   node tools/playtest/brockBuilds.mjs <url> <outDir> [--port=<cdp port>] [--window=WxH]
//
// Attaches to a browser somebody else started, as this PC's WSL Chromium helper
// starts one. A broken promise throws.
import { attachBrowser, launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const [url, out] = process.argv.slice(2);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice(7);
if (!url || !out) throw new Error('usage: brockBuilds.mjs <url> <outDir> [--port=<cdp port>]');
const size = process.argv.find((arg) => arg.startsWith('--window='))?.slice(9).split('x').map(Number);
const window = size ? { width: size[0], height: size[1] } : PIXEL_WINDOW;
const browser = port ? attachBrowser(Number(port), { window }) : await launchBrowser({ window });
const testUrl = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels`;
const page = await browser.openPage(testUrl);

const press = async (code, ms = 240) => { await page.tap(code, 60); await sleep(ms); };
const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60000 });
const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
const walkOnto = async (goal) => {
  for (let guard = 0; guard < 600; guard += 1) {
    const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.ready || b.leaving || b.targetTile) return 'wait';
      const goal = ${JSON.stringify(goal)}, s = b.currentTile;
      if (s.x === goal.x && s.y === goal.y) return null;
      const W = b.collision[0].length, H = b.collision.length, id = (x, y) => y * W + x, prev = new Map([[id(s.x, s.y), null]]), q = [[s.x, s.y]];
      while (q.length) { const [x, y] = q.shift(); if (x === goal.x && y === goal.y) { let cur = [x, y], k = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) return k; k = p[2]; cur = [p[0], p[1]]; } }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue; if (!(nx === goal.x && ny === goal.y) && b.isBlocked({ x: nx, y: ny })) continue; prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
      throw new Error('nothing walks there'); })()`);
    if (key === null) return;
    if (key === 'wait') await sleep(100);
    else await press(key, 200);
  }
  throw new Error('never got there');
};

try {
  await until(sceneIs('title'), 'the title');
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: testUrl });
  await until(sceneIs('title'), 'the title again');
  await sleep(600);
  await press('Space', 700);
  await until(sceneIs('base'), 'the starter');
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, 'Bulbasaur');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'a save');
  await sleep(800);
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); save.raidProgress.workshopUpgrades = ['radio-mast', 'beacon', 'secure-locker-1', 'secure-locker-2', 'recovery-bay-1', 'recovery-bay-2', 'quarantine-ward']; save.raidProgress.firstWordsHeard = ['lab', 'loadout', 'center', 'workshop', 'cottage', 'moved']; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: testUrl });
  await until(sceneIs('title'), 'the title');
  await sleep(500);
  await press('Space', 400);
  await until(sceneIs('base'), 'the yard');
  await sleep(800);
  const fixtures = await base('b.fixtures.map((f) => ({ id: f.upgradeId, at: f.at }))');
  for (const { id, at } of fixtures) {
    // From below if the ground is there, else from the side it is read from.
    const sides = [[0, 1, 'ArrowUp'], [1, 0, 'ArrowLeft'], [-1, 0, 'ArrowRight'], [0, -1, 'ArrowDown']];
    let faced = null;
    for (const [dx, dy, key] of sides) {
      if (await base(`b.isBlocked({ x: ${at.x + dx}, y: ${at.y + dy} })`)) continue;
      await walkOnto({ x: at.x + dx, y: at.y + dy });
      faced = key;
      break;
    }
    if (!faced) throw new Error(`${id} can be faced from nowhere`);
    await press(faced, 300);
    await sleep(500);
    await page.screenshot(`${out}/${id}.png`);
    console.log(`ok - ${id} photographed from below ${at.x},${at.y}`);
  }
  // And the builds as BROCK'S WORKSHOP's cards draw them.
  await walkIntoBase(page, 'brocks-workshop');
  await until(sceneIs('hub'), 'his workshop');
  await sleep(800);
  await page.screenshot(`${out}/workshop-cards.png`);
  console.log('ok - the workshop screen photographed');

  // The owner's own case: THE MAST built, and not where he wants it. MOVE IT
  // takes it out to the yard, the arrows show each place, ENTER puts it there.
  for (let guard = 0; guard < 8 && (await page.evaluate('document.activeElement?.dataset?.shows ?? null')) !== 'radio-mast'; guard += 1) await press('ArrowLeft', 200);
  await press('Space', 900);
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.placing !== null; })()`, 'the yard, moving the mast');
  const count = await base('b.placing.fixture.places.length');
  for (let index = 0; index < count; index += 1) {
    await sleep(700);
    await page.screenshot(`${out}/move-mast-${index + 1}.png`);
    console.log(`ok - the mast shown in place ${index + 1}: ${await base('b.placing.fixture.places[b.placing.index].name')}`);
    if (index + 1 < count) await press('ArrowRight', 200);
  }
  // Round to the Battle Arena's lawn, and put it there.
  while ((await base('b.placing.index')) !== 1) await press('ArrowRight', 300);
  await press('Space', 900);
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.placing === null && b.dialogBox.visible; })()`, 'the mast moved');
  const moved = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.fixturePlaces`);
  if (moved?.['radio-mast'] !== 1) throw new Error(`the mast was not moved: ${JSON.stringify(moved)}`);
  await sleep(500);
  await page.screenshot(`${out}/move-mast-done.png`);
  console.log('ok - the mast moved, and nothing spent');
  console.log('all good');
} finally {
  await browser.close();
}
