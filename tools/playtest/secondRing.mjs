// The vale's second ring, played on foot from Mill Square: down the lane onto the
// boardwalks, round to the staithe, out on the punt to Duck Island and back, into
// the Drowned Duck, along Mere End, over the Gull Strand road to the quay, up past
// the salt pans and the rope walk, to Bridge End and the bee garden, and on up the
// drove road to the Little Stones and the boulder in front of the Lost Fold.
//
//   node tools/playtest/secondRing.mjs <test-mode build url> <out dir> [--port=N]
//
// It fails if a boat will not sail, a door will not open, a place cannot be walked
// to on foot or names itself wrongly, or the boulder is not in the way
// (`docs/screens/second-ring/`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
if (!base) throw new Error('usage: secondRing.mjs <url> <out dir> [--port=N]');
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
// Local to a district: each is its plan's cell, one column and one row in.
const inCell = (column, row) => (x, y) => ({ x: (column + 1) * 64 + x, y: (row + 1) * 64 + y });
const millbrook = inCell(0, 1);
const reedmere = inCell(0, 2);
const strand = inCell(1, 2);
const crossing = inCell(1, 1);
const moor = inCell(0, 0);

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
  // The explorer run's clock and partner: what is checked is the country, not
  // whether a level-5 starter survives five minutes of hunters.
  await deploy(page, url.href, { press, click, until, wait, paused: true, explorer: true, insertion: 'greystone-vale' });
  await until(sceneIs('world'), 'the explorer raid');
  await wait(600);
  await readAll();
  const place = () => page.evaluate(`${WORLD}.placePlate?.text ?? ${WORLD}.currentDistrictName?.() ?? null`);
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const along = async (points, what) => {
    for (const point of points) {
      if (!(await walk(point, what))) return false;
    }
    return true;
  };
  const voyaging = () => page.evaluate(`Boolean(${WORLD}.voyaging || ${WORLD}.pendingVoyage)`);
  /** Presses out from a jetty and answers the sailor: SAIL is the first choice, and the cursor starts on the other. */
  const sail = async (toward) => {
    await press(toward);
    await wait(300);
    if (!(await page.evaluate(`Boolean(${WORLD}.trainerPrompt)`))) {
      await press('Space');
      await wait(300);
    }
    check(await page.evaluate(`Boolean(${WORLD}.trainerPrompt)`), 'the sailor asks first');
    await press('ArrowLeft');
    await press('Space');
    await wait(300);
    for (let guard = 0; guard < 8 && (await line()) !== null; guard += 1) {
      await press('Space');
      await wait(200);
    }
  };

  // -- Down the lane and onto the boards ------------------------------------------------
  check(
    await along([millbrook(40, 62), reedmere(40, 6), reedmere(41, 12), reedmere(46, 12)], 'the boardwalk'),
    'the lane comes down onto the boardwalk',
  );
  await shot('01-the-boardwalk');
  const boards = await page.evaluate(`(() => { const w = ${WORLD}; const t = w.currentTile; return w.currentMap.terrain[t.y][t.x]; })()`);
  check(boards === 'boards', `the boardwalk is boards underfoot (${boards})`);

  // -- The pond and the drain, then the staithe -----------------------------------------
  await along([reedmere(49, 12)], 'Pond Boy');
  await wait(300);
  await shot('02-pond-boy');
  await along([reedmere(47, 12), reedmere(47, 28), reedmere(44, 30)], 'the staithe');
  await shot('03-the-staithe');

  // -- The punt, out and back ---------------------------------------------------------------
  await walk(reedmere(40, 30), 'the end of the staithe');
  await shot('04-the-punt-moored');
  await sail('ArrowLeft');
  check(await voyaging(), 'the punt puts out from the staithe');
  check(await page.evaluate(`${WORLD}.player.visible`), 'whoever is in the punt is seen standing in it');
  let middle = false;
  for (let guard = 0; guard < 400 && (await voyaging()); guard += 1) {
    await page.evaluate(`${GAME}.stepFrames(1, ${FRAME_MS})`);
    if (!middle && (await tile()).x <= reedmere(34, 0).x) {
      middle = true;
      await page.evaluate(`${GAME}.stepFrames(4, ${FRAME_MS})`);
      await shot('05-on-the-mere');
    }
  }
  const landed = await tile();
  check(landed.x === reedmere(27, 0).x && landed.y === reedmere(0, 30).y, `the punt lands on Duck Island (${landed.x},${landed.y})`);
  await readAll();
  await wait(300);
  await shot('06-duck-island');
  await sail('ArrowRight');
  check(await voyaging(), 'the punt comes back');
  for (let guard = 0; guard < 400 && (await voyaging()); guard += 1) await page.evaluate(`${GAME}.stepFrames(1, ${FRAME_MS})`);
  const back = await tile();
  check(back.x === reedmere(40, 0).x, `the punt lands back at the staithe (${back.x},${back.y})`);
  await readAll();

  // -- Mere End, and in at the Drowned Duck -----------------------------------------------------
  await along([reedmere(45, 32), reedmere(44, 42), reedmere(40, 44)], 'the Drowned Duck');
  await wait(300);
  await shot('07-mere-end');
  await press('ArrowUp');
  await until(`${WORLD}.currentArea()?.name === 'The Drowned Duck'`, 'the Drowned Duck to open', 80);
  await wait(800);
  check(true, 'in at the Drowned Duck');
  await shot('08-the-drowned-duck');
  await press('ArrowDown');
  await until(`${WORLD}.currentArea()?.kind === 'outdoors'`, 'out of the Drowned Duck', 80);
  await wait(800);
  await along([reedmere(42, 47), reedmere(43, 50)], 'the eel market');
  await shot('09-the-eel-market');

  // -- The boardwalk west, to the hide ------------------------------------------------------------
  await along([reedmere(26, 46), reedmere(13, 46), reedmere(13, 51)], 'the duck hide');
  await shot('10-the-duck-hide');

  // -- And over to the sea: the Gull Strand road, the salt pans, the quay --------------------------
  check(
    await along([reedmere(13, 46), reedmere(31, 46), reedmere(45, 44), reedmere(47, 20), reedmere(60, 18), strand(10, 18)], 'Gull Strand'),
    'the boardwalk goes on to Gull Strand',
  );
  await along([strand(16, 17)], 'the Old Light');
  await shot('11-the-old-light');
  await along([strand(34, 18), strand(46, 20), strand(44, 31)], 'the salt pans');
  await shot('12-the-salt-pans');
  await along([strand(43, 40), strand(46, 44)], 'the quay');
  await shot('13-the-quay');

  // -- Up to Bridge End -------------------------------------------------------------------------------
  check(await along([strand(46, 2), crossing(46, 60), crossing(39, 44), crossing(38, 36)], 'Bridge End'), 'the strand road climbs to Bridge End');
  await wait(300);
  await shot('14-bridge-end');
  await along([crossing(32, 31), crossing(32, 28)], 'the Coach and Ponyta');
  await press('ArrowUp');
  await until(`${WORLD}.currentArea()?.name === 'The Coach and Ponyta'`, 'the inn to open', 80);
  await wait(800);
  await shot('15-the-coach-and-ponyta');
  await press('ArrowDown');
  await until(`${WORLD}.currentArea()?.kind === 'outdoors'`, 'out of the inn', 80);
  await wait(800);
  await along([crossing(50, 36), crossing(50, 40)], 'the bee garden');
  await shot('16-the-bee-garden');
  await along([crossing(44, 36), crossing(40, 28), crossing(37, 20), crossing(38, 8), crossing(46, 7)], 'the stone yard');
  await shot('17-the-stone-yard');

  // -- And on the moor: the Little Stones, and the boulder ---------------------------------------------
  check(
    await along([millbrook(30, 2), moor(31, 60), moor(25, 46), moor(30, 38), moor(26, 30), moor(33, 22), moor(36, 13)], 'the Little Stones'),
    'the drove road climbs to the Little Stones',
  );
  await wait(300);
  await shot('18-the-little-stones');
  await along([moor(39, 12)], 'the boulder');
  await shot('19-the-boulder');
  const boulder = moor(40, 12);
  check(
    await page.evaluate(`${WORLD}.currentMap.entities.some((e) => e.boulder && e.position.x === ${boulder.x} && e.position.y === ${boulder.y})`),
    'a boulder stands in the way to the Lost Fold',
  );
} finally {
  await browser.close();
}
console.log(failures.length === 0 ? 'all ok' : `${failures.length} FAILED:\n  ${failures.join('\n  ')}`);
process.exit(failures.length === 0 ? 0 : 1);
