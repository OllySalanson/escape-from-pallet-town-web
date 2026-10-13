// Ember Isle, played the way a player gets there: the explorer run dropped in
// at the Cove Steps, down to the smugglers' jetty, The Smugglers' Run out
// across the sea to the island, round the cone's foot and up its south face to
// the Lava Tube, through the tube into the crater - every step of whose ash
// rolls for a wild Pokemon - past the smugglers to their hoard, and away on the
// charcoal burners' Cinder Boat.
//
//   node tools/playtest/emberIsle.mjs <url of a test-mode build> <out dir> [--port=N] [--real]
//
// Every press is planned over the scene's own collision and doorways, and
// pressed as a key; the driver never moves the player itself. It fails if the
// skiff does not take the player across, if the crater can be walked into
// round the tube, if a step on the crater's ash never starts a fight, if the
// hoard is not there, or if the raid does not end at the Cinder Boat.
// Screenshots of each stage land in <out dir>.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
if (!base || !outDir) throw new Error('usage: emberIsle.mjs <dev server url> <out dir> [--port=N] [--real]');
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
      // The game's own rule (world/slidingFloor.ts), restated here because a
      // build serves no source modules: a step onto ice carries on until the
      // next tile is blocked or the step lands on ground that does not carry.
      const deltas = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const slideStops = (terrain, blocked, from, direction) => {
        const [dx, dy] = deltas[direction];
        let at = { x: from.x + dx, y: from.y + dy };
        if (blocked(at)) return null;
        while (terrain[at.y][at.x] === 'ice' && !blocked({ x: at.x + dx, y: at.y + dy })) at = { x: at.x + dx, y: at.y + dy };
        return at;
      };
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
    // Planned again before every press: a fight or a line on the way can take
    // a press, and the plan is only ever the way from where the player stands.
    let presses = 0;
    for (; presses < 300; presses += 1) {
      const keys = await plan(goals, avoidIce);
      if (!keys) throw new Error(`no way ${what}`);
      if (keys.length === 0) break;
      await press(keys[0]);
      await settle();
    }
    console.log(`${what}: ${presses} presses`);
    return presses;
  };
  /** A tile of the composed grid, from Ember Isle's own tiles (cell -1,4 of a ring from -1: origin 0,320). */
  const ember = (x, y) => `${x},${320 + y}`;
  const areaTile = (areaId, x, y) =>
    page.evaluate(`(() => { const a = ${WORLD}.currentMap.areas.find((p) => p.id === ${JSON.stringify(areaId)}); return (a.rect.x + ${x}) + ',' + (a.rect.y + ${y}); })()`);
  let battles = 0;
  const countingSettle = async () => {
    if (await inBattle()) battles += 1;
    await settle();
  };

  // -- Into the explorer run, at the Cove Steps -------------------------------
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, { press, click, until, wait, paused: !real, explorer: true, insertion: 'greystone-vale-cove-steps' });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await settle();
  check((await page.evaluate(`${WORLD}.currentMap.id`)) === 'greystone-vale', 'dropped in on Greystone Vale');

  // -- Down to the jetty, and aboard the smugglers' skiff -----------------------
  const boat = await page.evaluate(`(() => { const s = ${WORLD}.currentMap.sailings?.find((one) => one.name === "The Smugglers' Run"); return s && { name: s.name, from: s.ends[0], to: s.ends[1], course: s.course.length }; })()`);
  check(boat?.name === "The Smugglers' Run", `the vale has The Smugglers' Run (${boat?.course} tiles of sea)`);
  await walk([`${boat.from.landing.x},${boat.from.landing.y}`], "to the smugglers' jetty");
  await shot('01-the-cove-jetty');
  const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[boat.from.toward];
  await press(key);
  await wait(300);
  check((await state()).prompt, 'pressing out to the skiff asks before it sails');
  await shot('02-ahoy');
  await press('ArrowLeft');
  await press('Space');
  await wait(300);
  await press('Space');
  await wait(200);
  const cast = (await state()).elapsedMs;
  let mid = false;
  for (let guard = 0; guard < 600 && (await state()).voyaging; guard += 1) {
    await wait(100);
    if ((await state()).dialog) {
      const said = await page.evaluate(`${WORLD}.dialogBox.textObject?.text ?? ''`);
      console.log(`said at sea: ${JSON.stringify(said)}`);
      await press('Space');
      await wait(200);
    }
    if (!mid && (await state()).tile.y > 318) {
      await shot('03-at-sea');
      mid = true;
    }
  }
  await settle();
  const ashore = await state();
  check(ashore.tile.x === boat.to.landing.x && ashore.tile.y === boat.to.landing.y, `put ashore at the Smugglers' Landing (${JSON.stringify(ashore.tile)})`);
  const crossing = (ashore.elapsedMs - cast) / 1000;
  check(crossing >= boat.course * 0.15 * 0.9, `the crossing cost the raid clock as walking would (${crossing.toFixed(1)}s for ${boat.course} tiles)`);
  await shot('04-smugglers-landing');

  // -- Round the cone and up its south face to the Lava Tube --------------------
  await walk([ember(13, 33)], "to the charcoal burners' kiln");
  await shot('05-burners-camp');
  await walk([ember(36, 52)], 'up the steps onto the lower terrace');
  await shot('06-the-climb');
  await walk([ember(25, 47)], 'along the upper terrace to the Lava Tube');
  await shot('07-lava-tube-mouth');
  await press('ArrowUp');
  await wait(600);
  await countingSettle();
  check((await page.evaluate(`${WORLD}.currentMap.areas.find((a) => a.id === 'lava-tube') !== undefined`)), 'the vale carries the Lava Tube');
  await shot('08-lava-tube');
  const out = await areaTile('lava-tube', 4, 20);
  await walk([out], 'through the tube to the crater');
  await press('ArrowDown');
  await wait(600);
  await countingSettle();
  check(JSON.stringify((await state()).tile) === JSON.stringify({ x: 35, y: 352 }), 'out of the tube onto the crater floor');
  await shot('09-the-crater');

  // -- Across the ash: every step rolls -----------------------------------------
  const before = battles;
  const roll = await page.evaluate(`(() => { const w = ${WORLD}; const t = w.currentTile; return { district: w.currentMap.id, grass: w.currentMap.tallGrass[t.y][t.x] }; })()`);
  check(roll.grass === false, 'the crater floor is no tall grass');
  // Back and forth over the ash until the floor itself starts a fight.
  for (let pass = 0; pass < 40 && battles === before; pass += 1) {
    await press(pass % 2 === 0 ? 'ArrowDown' : 'ArrowUp');
    await wait(250);
    if (await inBattle()) {
      battles += 1;
      await wait(1500);
      await shot('10-a-wild-pokemon-on-the-ash');
      await fightThrough();
    }
    await settle();
  }
  check(battles > before, `a step on the crater's ash, no grass on it, started a fight (${battles - before})`);

  // -- Past the smugglers to the hoard --------------------------------------------
  await walk([ember(50, 43), ember(51, 42)], "to the smugglers' hoard");
  await shot('11-the-hoard');
  const hoard = await page.evaluate(`(() => { const w = ${WORLD}; const loot = w.runSession?.plan?.loot[w.currentMap.id] ?? []; return loot.filter((p) => p.position.x >= 49 && p.position.x <= 54 && p.position.y >= 361 && p.position.y <= 364).map((p) => p.itemId); })()`);
  check(hoard.length > 0, `the hoard holds this raid's share of the smugglers' take (${hoard.join(', ')})`);

  // -- Back through the tube and away on the Cinder Boat ------------------------
  await walk([ember(35, 32)], 'back to the tube');
  await press('ArrowUp');
  await wait(600);
  await countingSettle();
  const back = await areaTile('lava-tube', 23, 21);
  await walk([back], 'back through the tube');
  await press('ArrowDown');
  await wait(600);
  await countingSettle();
  await walk([ember(0, 40)], 'down to the Cinder Boat');
  await until(`${sceneIs('extraction')}`, 'the raid ending at the Cinder Boat', 100);
  await wait(800);
  await shot('12-away-on-the-cinder-boat');
  check(true, 'left Ember Isle on the Cinder Boat');
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
// An attached browser's socket would otherwise keep the driver running.
process.exit(0);
