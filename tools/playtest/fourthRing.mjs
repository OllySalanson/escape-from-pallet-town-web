// The vale's fourth ring, played on foot: the Power Station from its forecourt, round
// the company town and the switchyard, out on the sailing club's dinghy to the valve
// tower, down the south road through Safari Marsh to its nursery, rangers and pools,
// and on through the wood to the cape, the camp, the Lido and aboard The Wreck.
//
//   node tools/playtest/fourthRing.mjs <test-mode build url> <out dir> [--port=N]
//
// It fails if a place cannot be walked to on foot, a door will not open or a boat
// will not sail (`docs/screens/fourth-ring/`). From The Dam, because the walk from
// Mill Square is what `fourthRing.test.ts` measures in steps.
import { mkdirSync, readFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
if (!base) throw new Error('usage: fourthRing.mjs <url> <out dir> [--port=N]');
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
// Local to a district: each is its plan's cell, one column and one row in.
const inCell = (column, row) => (x, y) => ({ x: (column + 1) * 64 + x, y: (row + 1) * 64 + y });
const station = inCell(3, 0);
const marsh = inCell(3, 1);
const cape = inCell(3, 2);

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
  await deploy(page, url.href, { press, click, until, wait, paused: true, explorer: true, insertion: 'greystone-vale-the-dam' });
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

  // -- The Power Station: the picket, the company's road, the town it left behind ----------
  await along([station(31, 28)], 'the forecourt');
  await wait(400);
  await shot('01-the-picket');
  check(await along([station(21, 27), station(17, 27)], 'the company shops'), 'the road runs west past the shops');
  await shot('02-the-company-shops');
  await inAt('The Works Canteen', '03-the-works-canteen');
  await along([station(9, 29), station(9, 36)], 'Turbine Row');
  await shot('04-turbine-row');
  await inAt('The Union Hall', '05-the-union-hall');
  check(await along([station(10, 37), station(10, 40)], 'the allotments'), 'the lane goes through to the allotments');
  await shot('06-the-allotments');
  await along([station(11, 44), station(12, 44)], 'the tip');
  await shot('07-the-tip');
  await along([station(12, 48), station(24, 49)], 'the bus stop');
  await shot('08-the-bus-stop');
  await along([station(30, 49), station(30, 53), station(29, 56)], 'the road mender');
  await shot('09-the-road-mender');
  await along([station(32, 53), station(36, 53), station(41, 57)], 'the gauge house');
  await shot('10-the-gauge-house');
  await along([station(36, 53), station(54, 53), station(54, 46), station(53, 45)], 'the settling pond');
  await shot('11-the-settling-pond');
  await along([station(54, 33), station(49, 33)], 'the warm water');
  await shot('12-the-warm-water');
  check(await along([station(54, 27), station(44, 26), station(31, 29), station(31, 33)], 'the switchyard'), 'the switchyard gate opens off the forecourt');
  await along([station(30, 36)], 'the insulators');
  await shot('13-the-switchyard');
  check(await along([station(31, 30), station(9, 27), station(7, 14)], 'the survey'), 'the Pylon Road climbs round the dam');
  await along([station(11, 12)], 'the survey');
  await shot('14-the-survey');
  await along([station(11, 3), station(18, 3)], 'the north shore');
  await shot('15-the-long-walker');
  check(await along([station(31, 3), station(40, 2), station(40, 6), station(41, 8)], 'the sailing club'), 'the north shore runs on to the sailing club');
  await shot('16-the-sailing-club');
  await along([station(41, 11)], 'the end of the jetty');
  await sail('ArrowLeft');
  for (let guard = 0; guard < 60 && (await voyaging()); guard += 1) await wait(300);
  const stage = await tile();
  check(stage.x === station(31, 11).x && stage.y === station(31, 11).y, `the dinghy lands on the valve tower's stage (${JSON.stringify(stage)})`);
  await wait(300);
  await along([station(29, 11)], 'the stage');
  await shot('17-the-valve-tower');
  await along([station(31, 11)], 'the stage end');
  await sail('ArrowRight');
  for (let guard = 0; guard < 60 && (await voyaging()); guard += 1) await wait(300);
  await along([station(42, 8), station(40, 2), station(52, 2), station(56, 8)], 'the linesmen');
  await shot('18-the-linesmen');

  // -- Down the south road into the marsh -----------------------------------------------------
  check(await along([station(40, 2), station(31, 3), station(11, 3), station(7, 11), station(7, 27), station(31, 27), station(31, 30)], 'back to the forecourt'), 'back round the dam');
  check(await along([station(54, 27), station(54, 53), station(32, 53), station(31, 62), marsh(31, 2)], 'the marsh'), 'the south road comes through the wood to the marsh');
  await along([marsh(31, 7)], 'the north stile');
  await shot('19-the-north-stile');
  await along([marsh(32, 14), marsh(30, 18), marsh(28, 18), marsh(24, 18)], 'the hide');
  await shot('20-the-hide');
  await along([marsh(30, 19), marsh(30, 25)], 'the egg bank');
  await shot('21-the-egg-bank');
  await along([marsh(33, 31)], 'the rest house');
  await shot('22-the-rest-house');
  await inAt('The Property Office', '23-lost-property');
  await along([marsh(39, 28), marsh(46, 27)], 'the nursery');
  await wait(300);
  await shot('24-the-nursery');
  await along([marsh(39, 28), marsh(39, 32), marsh(55, 31)], 'the rangers');
  await shot('25-the-rangers-camp');
  check(await along([marsh(44, 33), marsh(44, 37), marsh(46, 42)], 'the great pool'), 'the reeds lead to the stage on the great pool');
  await shot('26-the-great-pool');
  await along([marsh(44, 33), marsh(32, 33), marsh(26, 36), marsh(22, 35)], 'the tour');
  await shot('27-the-tour');
  await along([marsh(26, 36), marsh(28, 44), marsh(26, 47), marsh(27, 50)], 'the wallow');
  await shot('28-the-wallow');
  check(await along([marsh(23, 46), marsh(22, 54), marsh(21, 58)], 'the south planks'), 'the trail crosses the brook on its planks');
  await shot('29-the-south-planks');

  // -- Through the wood to the cape, down to the camp, and aboard -----------------------------
  check(await along([marsh(20, 62), cape(20, 2), cape(22, 8)], 'the piano'), 'the trail comes down to the piano');
  await wait(300);
  await shot('30-the-piano');
  check(await along([cape(25, 16), cape(30, 25), cape(36, 25), cape(37, 29)], 'the viewpoint'), 'the trail comes out on the cape');
  await shot('31-the-viewpoint');
  await along([cape(17, 29)], 'the Ship Inn');
  await shot('32-the-ship-inn');
  await inAt('The Ship Inn', '33-inside-the-ship-inn');
  await along([cape(14, 30), cape(10, 28), cape(10, 23)], 'the Spears');
  await shot('34-the-spears');
  await along([cape(32, 29), cape(44, 25), cape(49, 24), cape(53, 24)], 'the signal station');
  await shot('35-the-signal-station');
  check(await along([cape(45, 26), cape(45, 37), cape(42, 38)], 'the camp'), 'the cleft comes down to the camp');
  await wait(300);
  await shot('36-the-auction');
  await along([cape(24, 41)], 'the Lido');
  await shot('37-the-lido');
  check(await along([cape(27, 43), cape(27, 46), cape(22, 47), cape(22, 53)], 'the stage'), 'the bar runs out to the salvage stage');
  await along([cape(26, 53)], 'the hole in her side');
  await shot('38-the-salvage-stage');
  await inAt('The Forward Hold', '39-the-forward-hold');
} finally {
  await browser.close();
}
console.log(failures.length === 0 ? 'all ok' : `${failures.length} FAILED:\n  ${failures.join('\n  ')}`);
process.exit(failures.length === 0 ? 0 : 1);
