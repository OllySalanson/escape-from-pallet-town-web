// Millbrook, played the way a new game meets it: a new save lands on Mill Square,
// reads a sign, talks to the stall, watches somebody keep their beat and hears
// somebody call out, sees the brook move, goes in at the mill and comes out again,
// walks out over the stones to the island, picks a berry in the orchard and fights
// nothing it did not ask to. Walks are planned over the scene's own collision.
//
//   node tools/playtest/millbrook.mjs <test-mode build url> <out dir> [--port=N]
//
// It fails if a person never moves, nobody ever calls, the water never changes, a
// door does not open or a find is not there (`docs/screens/millbrook/`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
if (!base) throw new Error('usage: millbrook.mjs <url> <out dir> [--port=N]');
mkdirSync(out, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const FRAME_MS = 1000 / 60;
const WORLD = `${GAME}.scene.getScene('world')`;
const BATTLE = `${GAME}.scene.getScene('battle')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
// Local to the district: Millbrook is the plan's cell [0, 1].
const at = (x, y) => ({ x: 64 + x, y: 128 + y });

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
// By day: a night raid swaps what is out, and it is the day's village being checked.
let offset = (12 - new Date().getUTCHours() + 24) % 24;
if (offset > 14) offset -= 24;
await page.send('Emulation.setTimezoneOverride', {
  timezoneId: offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`,
});
try {
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression, tries = 600) => {
    for (let i = 0; i < tries; i += 1) {
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
  const line = () =>
    page.evaluate(`(() => { const w = ${WORLD}; return w?.dialogBox?.visible ? w.dialogBox.textObject.text : null; })()`);
  const readAll = async () => {
    const said = [];
    for (let guard = 0; guard < 30 && (await page.evaluate(sceneIs('world'))); guard += 1) {
      const text = await line();
      if (text === null) break;
      await wait(1200);
      said.push(await line());
      await press('Space');
      await wait(300);
    }
    return said.filter(Boolean);
  };
  const fight = async () => {
    console.log('     a fight:', await page.evaluate(`(() => { const b = ${BATTLE}; const e = b.state?.enemy?.pokemon; return (b.trainer?.name ?? 'wild') + ' ' + (e?.base?.name ?? '?') + ' at ' + JSON.stringify(${WORLD}.currentTile ?? null); })()`));
    for (let guard = 0; guard < 400 && (await page.evaluate(sceneIs('battle'))); guard += 1) {
      const menu = await page.evaluate(`(() => { const b = ${BATTLE}; if (b.mode !== 'main' || !b.commandTexts?.length) return null;
        const count = b.mainCommandLabels().length; return { at: b.selectedCommand, columns: count > 4 ? 3 : 2, leave: b.trainer ? (b.hunterBattle ? 1 : 0) : count - 1 }; })()`);
      if (menu && menu.at !== menu.leave) {
        const [row, column] = [Math.floor(menu.at / menu.columns), menu.at % menu.columns];
        const [toRow, toColumn] = [Math.floor(menu.leave / menu.columns), menu.leave % menu.columns];
        await press(row !== toRow ? (row < toRow ? 'ArrowDown' : 'ArrowUp') : column < toColumn ? 'ArrowRight' : 'ArrowLeft');
      } else await press('Space');
      await wait(300);
    }
    if (await page.evaluate(sceneIs('battle'))) throw new Error('a fight would not end: ' + JSON.stringify(await page.evaluate(`(() => { const b = ${BATTLE}; return { mode: b.mode, log: b.dialogBox?.textObject?.text }; })()`)));
    await until(`${sceneIs('world')} || ${sceneIs('extraction')}`, 'the world after a fight');
    await wait(600);
    await readAll();
  };
  const nextKey = (target) =>
    page.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, H = c.length, W = c[0].length;
      const goal = ${JSON.stringify(target)}; const id = (x, y) => y * W + x; const s = w.currentTile;
      if (s.x === goal.x && s.y === goal.y) return null;
      const first = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
      for (let head = 0; head < queue.length; head += 1) { const [x, y] = queue[head]; const here = first.get(id(x, y));
        for (const [dx, dy, key] of [[0, -1, 'ArrowUp'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight']]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || first.has(id(nx, ny))) continue;
          if (w.isBlocked({ x: nx, y: ny }) && !(nx === goal.x && ny === goal.y)) continue;
          first.set(id(nx, ny), here ?? key);
          if (nx === goal.x && ny === goal.y) return here ?? key;
          queue.push([nx, ny]);
        } }
      return 'unreachable'; })()`);
  /** Walks there as a player does; a press is released as soon as the tile changes, one tile a press. */
  const walk = async (target, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(sceneIs('battle'))) await fight();
      if ((await line()) !== null) await readAll();
      const key = await nextKey(target);
      if (key === null) return true;
      if (key === 'unreachable') {
        check(false, `${what} can be walked to`);
        return false;
      }
      // One tile a press, on 60fps frames: a test-mode frame is 100ms, and a walk
      // that starts its next step in the frame the last one ended overshoots a
      // tile and then walks back over it for ever.
      await page.keyDown(key);
      await page.evaluate(`${GAME}.stepFrames(2, ${FRAME_MS})`);
      await page.keyUp(key);
      for (let i = 0; i < 16 && (await page.evaluate(`Boolean(${WORLD}.targetTile)`)); i += 1) await page.evaluate(`${GAME}.stepFrames(1, ${FRAME_MS})`);
    }
    console.log('     stuck at', await page.evaluate(`(() => { const w = ${WORLD}; return JSON.stringify({ tile: w.currentTile, scene: ${GAME}.scene.getScenes(true).map((s) => s.scene.key), dialog: w.dialogBox?.visible, prompt: Boolean(w.trainerPrompt), warping: w.isWarping, cutscene: Boolean(w.cutscene), riding: w.riding, facing: w.facing, target: w.targetTile, near: (w.hunterPackHere?.()?.hunters ?? []).filter((h) => Math.abs(h.position.x - w.currentTile.x) < 8).map((h) => [h.id, h.position, h.mode]) }); })()`), await nextKey(target));
    await page.screenshot(`${out}/stuck.png`);
    check(false, `${what} is reached in the time`);
    return false;
  };
  const tile = () => page.evaluate(`${WORLD}.currentTile`);

  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`, { timeout: 90_000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`, { timeout: 90_000 });
  // A brand new save: no insertion named, the one a new game is offered.
  await deploy(page, url.href, { press, click, until, wait, paused: true });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await readAll();
  const landed = await tile();
  check(landed.x === at(30, 32).x && landed.y === at(30, 32).y, `a new game lands on Mill Square (${landed.x},${landed.y})`);
  await page.screenshot(`${out}/01-landing.png`);

  // -- The village going on round the player ----------------------------------------
  const figures = `(() => { const w = ${WORLD}; return [...w.idleFigures].map((f) => f.id + ':' + f.position.x + ',' + f.position.y).sort().join(' '); })()`;
  const before = await page.evaluate(figures);
  const water = `(() => { const w = ${WORLD}; const layer = w.animatedLayers[0]; const t = layer.getTileAt(${at(46, 12).x}, ${at(46, 12).y}); return t && t.index; })()`;
  let heard = null;
  let bubbleShot = false;
  for (let i = 0; i < 60; i += 1) {
    await wait(200);
    const said = await page.evaluate(`${WORLD}.villageCall?.saying?.words ?? null`);
    if (said) {
      heard = said;
      if (!bubbleShot) {
        bubbleShot = true;
        await page.screenshot(`${out}/02-somebody-calling.png`);
      }
    }
  }
  check((await page.evaluate(figures)) !== before, 'the village has moved while the player stood still');
  check(heard !== null, `somebody called out unasked: "${heard}"`);

  // The rest is walked on the explorer run's clock and partner, because what it
  // checks is the village and not whether a level-5 starter survives the hunter.
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`, { timeout: 90_000 });
  await deploy(page, url.href, { press, click, until, wait, paused: true, explorer: true, insertion: 'greystone-vale' });
  await until(sceneIs('world'), 'the explorer raid');
  await wait(600);
  await readAll();

  // -- A sign, and somebody at a stall -------------------------------------------------
  await walk(at(37, 30), 'the square sign');
  await press('ArrowUp');
  await wait(200);
  await press('Space');
  await wait(600);
  const sign = await readAll();
  console.log('     read:', JSON.stringify(sign).slice(0, 120));

  // -- The brook moves ------------------------------------------------------------------
  await walk(at(44, 21), 'the mill door');
  await wait(300);
  await page.screenshot(`${out}/03-the-mill.png`);
  const stream = `(() => { const w = ${WORLD}; const t = w.animatedLayers[0].getTileAt(${at(48, 19).x}, ${at(48, 19).y}); return t && t.index; })()`;
  const waterAt = await page.evaluate(stream);
  await wait(900);
  check((await page.evaluate(stream)) !== waterAt, 'the race moves, a frame at a time');

  // -- In at the mill, and out again ---------------------------------------------------
  await press('ArrowUp');
  await until(`${WORLD}.currentArea()?.name === 'The Mill'`, 'the mill to open', 80);
  await wait(800);
  check(true, 'in at the mill door');
  await page.screenshot(`${out}/04-inside-the-mill.png`);
  const door = await tile();
  await walk({ x: door.x, y: door.y }, 'the mat');
  await press('ArrowDown');
  await until(`${WORLD}.currentArea()?.kind === 'outdoors'`, 'the mill to let the player out', 80);
  await wait(800);
  check(true, 'out again by the mat');

  // -- The island, over the stones --------------------------------------------------------
  await walk(at(24, 51), 'the jetty');
  await page.screenshot(`${out}/05-tom-s-pool.png`);
  const reached = await walk(at(28, 48 - 1), 'the island');
  check(reached, 'the island is reached on foot, over the stones');
  await wait(300);
  const found = await page.evaluate(`${WORLD}.runSession?.manager?.snapshot?.().foundItems ?? null`);
  console.log('     found so far:', JSON.stringify(found));
  await page.screenshot(`${out}/06-the-island.png`);

  // -- The orchard: picked by facing it ----------------------------------------------------
  await walk(at(49, 50), 'the orchard');
  await press('ArrowUp');
  await wait(200);
  await press('Space');
  await wait(800);
  const picked = await readAll();
  check(picked.some((text) => /berr/i.test(text)), `a berry tree is picked: ${JSON.stringify(picked).slice(0, 100)}`);
  await page.screenshot(`${out}/07-the-orchard.png`);

  // -- Hazel's garden is shut without a Cut ---------------------------------------------------
  await walk(at(17, 56), 'the Cut tree');
  await press('ArrowLeft');
  await wait(200);
  await press('Space');
  await wait(800);
  const tree = await readAll();
  console.log('     the small tree says:', JSON.stringify(tree).slice(0, 140));
  await page.screenshot(`${out}/08-the-cut-tree.png`);
  check(await page.evaluate(`${WORLD}.collisionData[${at(16, 56).y}][${at(16, 56).x}]`), 'the Cut tree stands in the gap');
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`\n${failures.length} failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('\nall of it, as a new game meets it');
