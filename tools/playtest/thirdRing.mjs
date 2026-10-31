// The vale's third ring, played on foot from Mill Square: through Tanglewood to
// Mislaid and its pub, down the windfalls to the farm at Orchard Terraces and its
// shore, along to the Sunken Quarter, round by the Cut to Smugglers' Cove, and up
// the pass to the quarry, the tarn and Pine Hollow.
//
//   node tools/playtest/thirdRing.mjs <test-mode build url> <out dir> [--port=N]
//
// It fails if a place cannot be walked to on foot or a door will not open
// (`docs/screens/third-ring/`).
import { mkdirSync, readFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
if (!base) throw new Error('usage: thirdRing.mjs <url> <out dir> [--port=N]');
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
const crossing = inCell(1, 1);
const peaks = inCell(1, 0);
const pines = inCell(2, 0);
const wood = inCell(2, 1);
const farm = inCell(2, 2);
const strand = inCell(1, 2);
const quarter = inCell(1, 3);
const cove = inCell(0, 3);

const vale = JSON.parse(readFileSync('src/game/world/maps/greystoneVale.json', 'utf8'));
/** The tile in front of a room's door, out of the map file itself. */
const doorOf = (name) => {
  const { id } = vale.areas.find((area) => area.name === name);
  const { ends } = vale.links.find((link) => link.ends.some((end) => end.area === id));
  const { x, y } = ends.find((end) => end.area === undefined);
  return { x, y };
};
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
  const walk = async (wanted, what) => {
    // A waypoint on a wall or a figure means the nearest tile that is ground.
    const target = await page.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData; const start = ${JSON.stringify(wanted)};
      const seen = new Set([start.y * 1000 + start.x]); const queue = [start];
      while (queue.length) { const t = queue.shift(); if (c[t.y]?.[t.x] === false && !w.isBlocked(t)) return t;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const n = { x: t.x + dx, y: t.y + dy }; const k = n.y * 1000 + n.x;
          if (c[n.y]?.[n.x] !== undefined && !seen.has(k)) { seen.add(k); queue.push(n); } } }
      return start; })()`);
    let shut = 0;
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(sceneIs('battle'))) await fight();
      if ((await line()) !== null) await readAll();
      const key = await nextKey(target);
      if (key === null) return true;
      if (key === 'unreachable') {
        // A hunter or somebody on a beat can stand in a lane for a moment: only
        // ground that stays shut is a fault.
        shut += 1;
        if (shut < 40) {
          await wait(300);
          continue;
        }
        check(false, `${what} can be walked to`);
        return false;
      }
      shut = 0;
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

  /** Walks to a door's mat, presses up through it, photographs the room and comes back out. */
  const inAt = async (name, shotName) => {
    await walk(doorOf(name), name);
    await press('ArrowUp');
    await until(`${WORLD}.currentArea()?.name === ${JSON.stringify(name)}`, `${name} to open`, 80);
    await wait(800);
    check(true, `in at ${name}`);
    await shot(shotName);
    await press('ArrowDown');
    await until(`${WORLD}.currentArea()?.kind === 'outdoors'`, `out of ${name}`, 80);
    await wait(800);
  };

  // -- Tanglewood: the road in, the shrine, Mislaid and its pub -----------------------------
  check(
    await along([millbrook(62, 31), crossing(20, 31), crossing(50, 33), crossing(62, 33), wood(4, 33)], 'Tanglewood'),
    'the road from Bridge End comes into Tanglewood',
  );
  await along([wood(10, 40)], 'the woodmen');
  await shot('01-the-woodmens-stand');
  await along([wood(25, 39), wood(25, 35), wood(38, 35), wood(38, 38)], 'the halfway stone');
  await shot('02-the-halfway-stone');
  await along([wood(41, 33), wood(41, 28)], 'the shrine');
  await shot('03-the-shrine');
  await along([wood(47, 26), wood(47, 20)], 'the cavers');
  await shot('04-the-cavers-camp');
  check(await along([wood(39, 20), wood(38, 13)], 'Mislaid'), 'the lanes come out at Mislaid');
  await wait(400);
  await shot('05-mislaid');
  await inAt('The Way Out', '06-the-way-out');
  await along([wood(30, 13), wood(31, 7), wood(16, 7), wood(10, 8)], 'the mushroom ring');
  await shot('07-the-mushroom-ring');
  await along([wood(31, 7), wood(30, 20), wood(32, 40), wood(29, 42)], 'the hermit');
  await shot('08-the-hermit');
  await along([wood(36, 45), wood(36, 50), wood(26, 53)], 'the butterfly ride');
  await shot('09-the-butterfly-ride');

  // -- Down through the windfalls to the farm ----------------------------------------------
  check(await along([wood(36, 53), wood(36, 58)], 'the windfalls'), 'the deer lane comes down to the windfalls');
  await shot('10-the-windfalls');
  check(await along([wood(36, 62), farm(36, 2), farm(36, 12), farm(26, 14)], 'the farmyard'), 'the wood lets out into the farmyard');
  await wait(400);
  await shot('11-the-farmyard');
  await inAt('The Barn', '12-the-barn');
  await along([farm(37, 18), farm(37, 30), farm(58, 31)], 'the honesty box');
  await shot('13-the-honesty-box');
  await along([farm(50, 31)], 'the cider press');
  await shot('14-the-cider-press');
  await along([farm(37, 31), farm(36, 17), farm(22, 18), farm(22, 28), farm(19, 30)], 'the cowman');
  await shot('15-the-cowman');
  await along([farm(13, 34), farm(21, 38), farm(21, 44)], 'the cornfield');
  await shot('16-the-cornfield');
  await along([farm(40, 45)], 'the dew pond');
  await shot('17-the-dew-pond');
  check(await along([farm(22, 49), farm(12, 51)], 'the cockle beds'), 'the road goes down to the sands');
  await shot('18-the-cockle-beds');
  await along([farm(42, 51), farm(47, 53)], 'the slip');
  await shot('19-the-slip');

  // -- West along the top road to the strand and out to the quarter -----------------------------
  check(
    await along([farm(22, 45), farm(22, 16), farm(0, 15), strand(62, 14), strand(46, 44)], 'Gull Strand'),
    'the farm road comes out on Gull Strand',
  );
  check(await along([strand(44, 62), quarter(44, 2), quarter(44, 11), quarter(40, 15)], 'the Old Quay'), 'the jetty runs out to the Old Quay');
  await shot('20-the-old-quay');
  await along([quarter(31, 18), quarter(30, 22)], 'the upper street');
  await shot('21-the-upper-street');
  await inAt('The Harbour Office', '22-the-harbour-office');
  // Every door is open on the explorer run, so the keeper's street is too.
  await along([quarter(31, 27), quarter(31, 45)], 'the drowned town');
  await shot('23-the-drowned-town');
  check(await along([quarter(30, 47), quarter(12, 47), quarter(6, 44)], 'the shingle'), 'the drowned street runs on to the shingle');

  // -- Round by the Cut to the cove --------------------------------------------------------------
  check(await along([quarter(0, 40), cove(63, 40), cove(50, 40)], 'the Cut'), 'the shore path comes through the Cut');
  await wait(300);
  await shot('24-the-cut');
  check(await along([cove(38, 40), cove(33, 40)], 'Fisher’s Row'), 'the cleft comes out on the cove');
  await shot('25-fishers-row');
  await along([cove(33, 36), cove(35, 35), cove(35, 30)], 'the fish stall');
  await shot('26-the-fish-stall');
  check(await along([cove(31, 27), cove(31, 22), cove(46, 19)], 'the Revenue house'), 'the cove steps climb to the cliff top');
  await wait(300);
  await shot('27-the-revenue-post');
  await along([cove(31, 22), cove(31, 27), cove(35, 30), cove(35, 35), cove(29, 34), cove(25, 34)], 'the landing stage');
  await shot('28-the-landing-stage');

  // -- And the high ground: the pass, the quarry, the tarn, and the pines --------------------------
  check(
    await along([cove(33, 40), cove(38, 40), cove(62, 40), quarter(3, 40), quarter(31, 46), quarter(44, 11), strand(46, 2), crossing(46, 60), crossing(38, 36), crossing(38, 8), crossing(46, 2), peaks(46, 60)], 'the pass'),
    'the road climbs out of The Crossing to the pass',
  );
  await along([peaks(45, 42)], 'Gantry’s stores');
  await shot('29-gantrys-stores');
  await along([peaks(45, 36)], 'the stone carts');
  await shot('30-the-stone-carts');
  await along([peaks(45, 24), peaks(52, 17)], 'the quarry');
  await wait(300);
  await shot('31-the-quarry');
  await along([peaks(45, 24), peaks(38, 12), peaks(38, 6)], 'the tarn');
  await shot('32-the-tarn');
  await along([peaks(41, 7)], 'the bothy');
  await shot('33-the-bothy');
  check(await along([peaks(38, 6), peaks(38, 24), peaks(50, 23), peaks(62, 22), pines(2, 22), pines(9, 16), pines(13, 13)], 'the cold spring'), 'the unsigned path comes out at the cold spring');
  await shot('34-the-cold-spring');
  await along([pines(27, 15), pines(36, 15), pines(36, 30)], 'the weeping pine');
  await wait(300);
  await shot('35-the-weeping-pine');
  await along([pines(46, 33), pines(49, 30), pines(49, 20), pines(55, 19), pines(55, 27), pines(55, 42)], 'the Pikachu glade');
  await shot('36-the-pikachu-glade');
  const noSigns = await page.evaluate(`${WORLD}.currentMap.entities.filter((e) => e.sign && e.position.x >= ${pines(0, 0).x} && e.position.x < ${pines(64, 0).x} && e.position.y >= ${pines(0, 0).y} && e.position.y < ${pines(0, 64).y}).length`);
  check(noSigns === 0, `nothing is signed in Pine Hollow (${noSigns})`);
} finally {
  await browser.close();
}
console.log(failures.length === 0 ? 'all ok' : `${failures.length} FAILED:\n  ${failures.join('\n  ')}`);
process.exit(failures.length === 0 ? 0 : 1);
