// The Bunker, played the way a player gets there: the explorer run dropped in
// at the Dam with the Card Key and a Lockpick in the pack, through the power
// station's door into the turbine hall, down the stair to B1F, the shutter
// opened with the card, the lift found dead, down the stairs to B2F, across
// the spinner floor to the generator and back to the lift, down to B4F, the
// war room and the strongroom, and out by the escape hatch.
//
//   node tools/playtest/bunker.mjs <url of a test-mode build> <out dir> [--port=N] [--real]
//
// Every press on the arrows is planned the way the player has to plan it, by
// spinning (`src/game/world/slidingFloor.ts`'s rule, restated below because a
// build serves no source modules), and then pressed as a key; the driver
// never moves the player itself. It fails if the shutter does not open, if
// the lift runs before the generator or not after it, if a floor cannot be
// crossed, or if the raid does not end at the escape hatch. Screenshots of
// each stage land in <out dir>.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
if (!base || !outDir) throw new Error('usage: bunker.mjs <dev server url> <out dir> [--port=N] [--real]');
mkdirSync(outDir, { recursive: true });
const real = args.includes('--real');
const url = new URL(base);
if (!real) url.searchParams.set('testmode', 'pixels');

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const WORLD = `${GAME}.scene.getScene('world')`;
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
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
    page.evaluate(
      `(() => { const w = ${WORLD}; return { tile: w.currentTile, facing: w.facing, target: w.targetTile, dialog: w.dialogBox.visible, prompt: Boolean(w.trainerPrompt), warping: w.isWarping, thrown: w.runSession?.switchesThrown ?? [], said: w.dialogBox.typewriter?.currentMessage ?? w.dialogBox.textObject?.text ?? '' }; })()`,
    );
  const inBattle = () => page.evaluate(sceneIs('battle'));
  const inWorld = () => page.evaluate(sceneIs('world'));
  const battle = () =>
    page.evaluate(
      `(() => { const b = ${GAME}.scene.getScene('battle'); return { mode: b.mode, selected: b.selectedCommand, commands: b.commandTexts.map((t) => t.text) }; })()`,
    );
  const fightThrough = async () => {
    // Every step of the Bunker rolls the dark, and a raid is not won by
    // fighting all of it: a wild fight is left by RUN (a level-99 partner is
    // always faster), and a fight with no RUN on its menu - a grunt's - is
    // fought.
    for (let guard = 0; guard < 600 && (await inBattle()); guard += 1) {
      if (await page.evaluate(`Boolean(document.querySelector('.move-chooser, [data-move-chooser]'))`)) {
        await press('Escape');
        await wait(250);
        continue;
      }
      const b = await battle();
      if (b.mode === 'main') {
        const wanted = b.commands.findIndex((command) => command.includes(b.commands.some((c) => c.includes('RUN')) ? 'RUN' : 'FIGHT'));
        if (wanted >= 0 && b.selected !== wanted) {
          // Two rows: a wild fight's five commands stand three to a row.
          const columns = b.commands.length > 4 ? 3 : 2;
          const across = (wanted % columns) - (b.selected % columns);
          const down = Math.floor(wanted / columns) - Math.floor(b.selected / columns);
          await press(down > 0 ? 'ArrowDown' : down < 0 ? 'ArrowUp' : across > 0 ? 'ArrowRight' : 'ArrowLeft');
          await wait(100);
          continue;
        }
      }
      await press('Space');
      await wait(300);
    }
    await until(sceneIs('world'), 'the world after a fight', 600);
    await wait(600);
  };
  const said = [];
  const settle = async () => {
    for (let guard = 0; guard < 80; guard += 1) {
      if (await inBattle()) {
        await fightThrough();
        continue;
      }
      if (!(await inWorld())) return;
      const now = await state();
      if (now.target || now.warping) {
        await wait(100);
        continue;
      }
      if (now.dialog) {
        said.push(now.said);
        await press('Space');
        await wait(300);
        continue;
      }
      return;
    }
  };

  /**
   * The presses that take the player from where they stand to any of `goals`
   * (tiles, by "x,y"): a spin wherever an arrow takes hold, a step anywhere
   * else, and through doorways where pressing into one goes through it.
   */
  const plan = (goals) =>
    page.evaluate(`(async () => {
      // The game's own rule (world/slidingFloor.ts): an arrow spins whoever
      // lands on it on the way it points, and a spin goes on over plain floor,
      // turned by every arrow it crosses, until a stop plate or something in
      // the way stops it.
      const deltas = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const spins = { 'spin-up': 'up', 'spin-down': 'down', 'spin-left': 'left', 'spin-right': 'right' };
      const rest = (terrain, blocked, from, direction) => {
        let heading = direction; let spinning = false;
        let at = { x: from.x + deltas[heading][0], y: from.y + deltas[heading][1] };
        if (blocked(at)) return null;
        for (let guard = 0; guard < 400; guard += 1) {
          const here = terrain[at.y][at.x];
          if (spins[here]) { spinning = true; heading = spins[here]; }
          else if (here === 'spin-stop') return at;
          else if (here !== 'ice' && !spinning) return at;
          const next = { x: at.x + deltas[heading][0], y: at.y + deltas[heading][1] };
          if (blocked(next)) return at;
          at = next;
        }
        return at;
      };
      const w = ${WORLD}; const map = w.currentMap; const width = map.width;
      const goals = new Set(${JSON.stringify(goals)});
      const dirs = [['up', 'ArrowUp'], ['down', 'ArrowDown'], ['left', 'ArrowLeft'], ['right', 'ArrowRight']];
      const isBlocked = (t) => t.x < 0 || t.y < 0 || t.x >= width || t.y >= map.height || w.isBlocked(t);
      const start = w.currentTile; const key = (t) => t.x + ',' + t.y;
      const prev = new Map([[key(start), null]]); const queue = [start];
      while (queue.length) {
        const at = queue.shift();
        if (goals.has(key(at))) { const keys = []; let k = key(at); while (prev.get(k)) { const [from, press] = prev.get(k); keys.unshift(press); k = from; } return keys; }
        dirs.forEach(([direction, press], number) => {
          const linked = map.links?.get((at.y * width + at.x) * 4 + number);
          const to = linked !== undefined ? { x: linked % width, y: Math.floor(linked / width) } : rest(map.terrain, isBlocked, at, direction);
          if (!to || prev.has(key(to))) return;
          prev.set(key(to), [key(at), press]); queue.push(to);
        });
      }
      return null;
    })()`);
  const walk = async (goals, what) => {
    let presses = 0;
    for (; presses < 400; presses += 1) {
      const keys = await plan(goals);
      if (!keys) throw new Error(`no way ${what}`);
      if (keys.length === 0) break;
      await press(keys[0]);
      await settle();
    }
    console.log(`${what}: ${presses} presses`);
    return presses;
  };
  /** A tile of the grid, from a place's own tiles: an area of the vale, or the power station's district (cell 3,1 of a ring from -1). */
  const tile = (areaId, x, y) =>
    areaId === 'power-station'
      ? `${256 + x},${64 + y}`
      : page.evaluate(`(() => { const a = ${WORLD}.currentMap.areas.find((p) => p.id === ${JSON.stringify(areaId)}); return (a.rect.x + ${x}) + ',' + (a.rect.y + ${y}); })()`);
  const at = async (areaId, x, y) => JSON.stringify((await state()).tile) === JSON.stringify(Object.fromEntries((await tile(areaId, x, y)).split(',').map((v, i) => [i ? 'y' : 'x', Number(v)])));
  const face = async (direction) => {
    await press(KEYS[direction]);
    await wait(200);
  };

  // -- Into the explorer run, at the Dam, with the card and a pick -----------------
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, { press, click, until, wait, paused: !real, explorer: true, insertion: 'greystone-vale-the-dam', pack: ['card-key', 'lockpick', 'potion:2', 'super-potion:0', 'antidote:0'] });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await settle();
  check((await page.evaluate(`${WORLD}.currentMap.id`)) === 'greystone-vale', 'dropped in on Greystone Vale at the Dam');
  check(await page.evaluate(`${WORLD}.bag.count('card-key') === 1`), 'carrying the Card Key');

  // -- The station's door, the turbine hall, the stair down ------------------------
  await walk([tile('power-station', 31, 24)], "to the power station's door");
  await shot('01-the-station-door');
  await face('up');
  await settle();
  check(await at('turbine-hall', 12, 15), 'in through the door, onto the turbine hall mat');
  await shot('02-turbine-hall');
  await walk([await tile('turbine-hall', 20, 12)], 'across the hall to the stair down');
  await shot('03-the-stair-down');
  await face('right');
  await settle();
  check(await at('bunker-b1f', 3, 3), 'down the stair to B1F');
  await shot('04-b1f-stair-foot');

  // -- The shutter ----------------------------------------------------------------
  await walk([await tile('bunker-b1f', 5, 7)], 'to the shutter');
  await face('down');
  await shot('05-the-shutter');
  await press('Space');
  await wait(300);
  const opened = (await state()).said;
  await shot('06-the-card-key');
  await settle();
  check(opened.includes('Card Key opened the door'), `the Card Key opens the shutter ("${opened}")`);
  check(!(await page.evaluate(`${WORLD}.isBlocked({ x: ${(await tile('bunker-b1f', 5, 8)).replace(',', ', y: ')} })`)), 'the shutter is open');

  // -- The lift, dead --------------------------------------------------------------
  await walk([await tile('bunker-b1f', 12, 13)], 'to the lift on B1F');
  await face('up');
  await wait(300);
  const dead = (await state()).said;
  await shot('07-the-lift-is-dead');
  await settle();
  check(dead.includes("elevator doesn't work"), `the lift is dead until its generator runs ("${dead}")`);

  // -- B2F: across the arrows to the generator -------------------------------------
  await walk([await tile('bunker-b1f', 28, 13)], 'to the stairs down to B2F');
  await face('right');
  await settle();
  check(await at('bunker-b2f', 29, 3), 'down the stairs to B2F');
  await shot('08-b2f-the-spinner-floor');
  const presses = await walk([await tile('bunker-b2f', 4, 3)], 'across the spinner floor to the generator');
  check(presses >= 8, `the generator is a puzzle away (${presses} presses)`);
  await shot('09-at-the-generator');
  check((await state()).facing === 'left', 'stopped against the generator, facing it');
  await press('Space');
  await wait(300);
  const running = (await state()).said;
  await shot('10-the-generator-runs');
  await settle();
  check(running.includes('generator roared'), `the generator runs ("${running}")`);
  check((await state()).thrown.length > 0, 'the switch is thrown for the raid');

  // -- Back across, and down in the lift ----------------------------------------------
  await walk([await tile('bunker-b2f', 23, 3)], 'back across the arrows to the lift');
  await face('up');
  await wait(300);
  check((await state()).prompt, 'the lift asks which floor');
  await shot('11-which-floor');
  // The cursor starts on this floor, B2F; B4F is two on.
  await press('ArrowRight');
  await press('ArrowRight');
  await press('Space');
  await wait(1500);
  await settle();
  check(await at('bunker-b4f', 4, 3), 'the lift goes down to B4F');
  await shot('12-b4f');

  // -- B4F: the war room, the strongroom, the escape hatch --------------------------
  await walk([await tile('bunker-b4f', 21, 8)], 'to the war room');
  await shot('13-the-war-room');
  const heard = said.length;
  await walk([await tile('bunker-b4f', 26, 18)], 'to the strongroom');
  await shot('14-the-strongroom');
  console.log(`the strongroom: ${JSON.stringify(said.slice(heard))}`);
  check(await page.evaluate(`${WORLD}.bag.count('lockpick') === 0`), 'the strongroom took the Lockpick and paid out');
  await walk([await tile('bunker-b4f', 16, 17)], 'to the escape hatch');
  await until(`${sceneIs('extraction')}`, 'the raid ending at the escape hatch', 100);
  await wait(800);
  await shot('15-out-by-the-escape-hatch');
  check(true, 'left the Bunker by the Escape Hatch');
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
