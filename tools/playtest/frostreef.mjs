// Frostreef, played the way a player gets there: the explorer run dropped in
// at the Wreck's salvage camp, a walk to the pier, The Ice Run out across the
// sea, the north shore, Berg Cave's two floors of sliding ice, the frozen
// lagoon and Lapras on it, and away on the whalers' boat.
//
//   node tools/playtest/frostreef.mjs <dev server url> <out dir> [--port=N] [--real]
//
// Every press on the ice is planned the way the player has to plan it, by
// sliding (`src/game/world/slidingFloor.ts`, imported from the dev server), and
// then pressed as a key; the driver never moves the player itself. It fails
// if the boat does not take the player across, if a floor cannot be crossed,
// if Lapras is not there, or if the raid does not end at the whalers' boat.
// Screenshots of each stage land in <out dir>.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
if (!base || !outDir) throw new Error('usage: frostreef.mjs <dev server url> <out dir> [--port=N] [--real]');
mkdirSync(outDir, { recursive: true });
const real = args.includes('--real');
const url = new URL(base);
if (!real) url.searchParams.set('testmode', 'pixels');

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const WORLD = `${GAME}.scene.getScene('world')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const page = await browser.openPage('about:blank');
if (real) await page.send('Page.bringToFront');
try {
  const wait = (ms) =>
    real ? new Promise((resolve) => setTimeout(resolve, ms)) : page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression, tries = 300) => {
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
  const shot = (name) => page.screenshot(`${outDir}/${name}.png`);
  const state = () =>
    page.evaluate(`(() => { const w = ${WORLD}; return { tile: w.currentTile, target: w.targetTile, dialog: w.dialogBox.visible, prompt: Boolean(w.trainerPrompt), voyaging: Boolean(w.voyaging || w.pendingVoyage), elapsedMs: w.runSession?.manager.snapshot().elapsedMs, place: w.placeName ?? null }; })()`);
  const inBattle = () => page.evaluate(sceneIs('battle'));
  const inWorld = () => page.evaluate(sceneIs('world'));
  const fightThrough = async () => {
    for (let guard = 0; guard < 400 && (await inBattle()); guard += 1) {
      if (await page.evaluate(`Boolean(document.querySelector('.move-chooser, [data-move-chooser]'))`)) await press('Escape');
      else await press('Space');
      await wait(300);
    }
    await until(sceneIs('world'), 'the world after a fight', 600);
    await wait(600);
  };
  const settle = async () => {
    for (let guard = 0; guard < 60; guard += 1) {
      if (await inBattle()) {
        await fightThrough();
        continue;
      }
      if (!(await inWorld())) return;
      const now = await state();
      if (now.target) {
        await wait(100);
        continue;
      }
      if (now.dialog) {
        await press('Space');
        await wait(300);
        continue;
      }
      return;
    }
  };

  /**
   * The presses that take the player from where they stand to any of `goals`
   * (tiles, by "x,y"), each a slide on ice and a step anywhere else, and
   * through doorways and ladders where pressing into one goes through it.
   */
  const plan = (goals, avoidIce) =>
    page.evaluate(`(async () => {
      const { slideStops } = await import('/src/game/world/slidingFloor.ts');
      const w = ${WORLD}; const map = w.currentMap; const width = map.width;
      const goals = new Set(${JSON.stringify(goals)});
      const dirs = [['up', 'ArrowUp'], ['down', 'ArrowDown'], ['left', 'ArrowLeft'], ['right', 'ArrowRight']];
      const isBlocked = (t) => t.x < 0 || t.y < 0 || t.x >= width || t.y >= map.height || w.isBlocked(t) || (${avoidIce} && map.terrain[t.y][t.x] === 'ice');
      const start = w.currentTile; const key = (t) => t.x + ',' + t.y;
      const prev = new Map([[key(start), null]]); const queue = [start];
      while (queue.length) {
        const at = queue.shift();
        if (goals.has(key(at))) { const keys = []; let k = key(at); while (prev.get(k)) { const [from, press] = prev.get(k); keys.unshift(press); k = from; } return keys; }
        dirs.forEach(([direction, press], number) => {
          const linked = map.links?.get((at.y * width + at.x) * 4 + number);
          const rest = linked !== undefined ? { x: linked % width, y: Math.floor(linked / width) } : slideStops(map.terrain, isBlocked, at, direction);
          if (!rest || prev.has(key(rest))) return;
          prev.set(key(rest), [key(at), press]); queue.push(rest);
        });
      }
      return null;
    })()`);
  const walk = async (goals, what, { avoidIce = false } = {}) => {
    const keys = await plan(goals, avoidIce);
    if (!keys) throw new Error(`no way to ${what}`);
    console.log(`${what}: ${keys.length} presses`);
    for (const code of keys) {
      const before = JSON.stringify((await state()).tile);
      await page.keyDown(code);
      for (let i = 0; i < 12 && JSON.stringify((await state()).tile) === before && (await inWorld()); i += 1) await wait(50);
      await page.keyUp(code);
      await wait(100);
      await settle();
    }
    return keys.length;
  };
  /** A tile of the composed grid, from a district's own tiles on the vale (Frostreef is cell 4,4 of a ring from -1). */
  const frost = (x, y) => `${320 + x},${320 + y}`;
  const areaTile = (areaId, x, y) =>
    page.evaluate(`(() => { const a = ${WORLD}.currentMap.areas.find((p) => p.id === ${JSON.stringify(areaId)}); return (a.rect.x + ${x}) + ',' + (a.rect.y + ${y}); })()`);

  // -- Into the explorer run, at the salvage camp ----------------------------
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, { press, click, until, wait, paused: !real, explorer: true, insertion: 'greystone-vale-salvage-camp' });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await settle();
  check((await page.evaluate(`${WORLD}.currentMap.id`)) === 'greystone-vale', 'dropped in on Greystone Vale');

  // -- To the pier, and aboard The Ice Run ------------------------------------
  const boat = await page.evaluate(`(() => { const s = ${WORLD}.currentMap.sailings?.[0]; return s && { name: s.name, from: s.ends[0], to: s.ends[1], course: s.course.length }; })()`);
  check(boat?.name === 'The Ice Run', `the vale has The Ice Run (${boat?.course} tiles of sea)`);
  await walk([`${boat.from.landing.x},${boat.from.landing.y}`], 'to the pier', { avoidIce: true });
  await shot('01-the-pier');
  const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[boat.from.toward];
  await press(key);
  await wait(300);
  check((await state()).prompt, 'pressing out to the boat asks before it sails');
  await shot('02-ahoy');
  await press('ArrowLeft');
  await press('Space');
  await wait(300);
  await press('Space');
  await wait(200);
  const cast = (await state()).elapsedMs;
  let mid = false;
  for (let guard = 0; guard < 400 && (await state()).voyaging; guard += 1) {
    await wait(100);
    if (!mid && (await state()).tile.y > boat.from.boat.y + 40) {
      await shot('03-at-sea');
      mid = true;
    }
  }
  await settle();
  const ashore = await state();
  check(ashore.tile.x === boat.to.landing.x && ashore.tile.y === boat.to.landing.y, `put ashore on the Ice Jetty (${JSON.stringify(ashore.tile)})`);
  const crossing = (ashore.elapsedMs - cast) / 1000;
  check(crossing >= (boat.course * 0.15) * 0.9, `the crossing cost the raid clock as walking would (${crossing.toFixed(1)}s for ${boat.course} tiles)`);
  await shot('04-ice-jetty');

  // -- Under the berg ------------------------------------------------------------
  await walk([frost(46, 23)], 'to the berg', { avoidIce: true });
  await shot('05-berg-mouth');
  await press('ArrowUp');
  await wait(600);
  await settle();
  await shot('06-berg-cave-1f');
  const hole = await areaTile('berg-cave-1f', 4, 3);
  await walk([hole], 'across 1F to the ladder down');
  await shot('07-1f-crossed');
  await press('ArrowUp');
  await wait(600);
  await settle();
  const exit2 = await areaTile('berg-cave-b1f', 9, 17);
  await walk([exit2], 'across B1F to the way out');
  await shot('08-b1f-crossed');
  await press('ArrowDown');
  await wait(600);
  await settle();
  await shot('09-the-frozen-lagoon');
  check(JSON.stringify((await state()).tile) === JSON.stringify({ x: 331, y: 350 }), 'out of the cave onto the lagoon shore');

  // -- Lapras, on the lagoon ---------------------------------------------------
  const beside = [frost(31, 36), frost(33, 36), frost(32, 37)];
  await walk(beside, 'to Lapras');
  const lapras = await page.evaluate(`(() => { const w = ${WORLD}; const t = w.currentTile; return ['up','down','left','right'].find((d) => { const n = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[d]; return t.x + n[0] === ${320 + 32} && t.y + n[1] === ${320 + 36}; }); })()`);
  check(Boolean(lapras), 'stood beside Lapras');
  await press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[lapras]);
  await wait(200);
  await shot('10-lapras');
  await press('Space');
  await wait(400);
  for (let guard = 0; guard < 10 && !(await inBattle()); guard += 1) {
    await press('Space');
    await wait(400);
  }
  check(await inBattle(), 'Lapras fights');
  await wait(1500);
  await shot('11-lapras-fight');
  await fightThrough();
  await settle();

  // -- Away on the whalers' boat -------------------------------------------------
  await walk([frost(63, 30)], "to the whalers' boat");
  await until(`${sceneIs('extraction')}`, 'the raid ending at the whalers\' boat', 100);
  await wait(800);
  await shot('12-away');
  check(true, "left Frostreef by the Whaler's Boat");
} catch (error) {
  failures.push(String(error));
  console.error(error);
  await page.screenshot(`${outDir}/zz-failure.png`).catch(() => {});
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
