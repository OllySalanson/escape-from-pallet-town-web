// Fishing, played the way a player plays it: deploy, walk to the nearest bank,
// turn to the water and press the interact key - first with no rod in the pack,
// then with one, casting until something bites and the fight it starts is on
// screen (`src/game/world/fishing.ts`).
//
//   node tools/playtest/fishing.mjs <dev server url> <out dir> [--rod=good-rod]
//     [--insertion=id] [--district=NAME] [--port=N] [--real]
//
// It fails if the no-rod line is not said, if a cast does not charge the raid
// clock for its whole length, if the dots do not come up, or if a bite does not
// lead to a wild fight against something the water's own table holds.
// It walks round tall grass where it can and through it where it must, fighting
// whatever it meets on the first move (deploy with --level=N for that).
// --district=NAME walks to a bank in that place (`--insertion=town-square
// --district="THE SALTINGS"` is the sea); --port=N drives a browser already
// running on that CDP port rather than starting one. Screenshots of the cast,
// the bite and the fight land in <out dir>.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const rod = option('rod') ?? 'good-rod';
const district = option('district');
const port = option('port');
if (!base || !outDir) {
  throw new Error(
    'usage: fishing.mjs <dev server url> <out dir> [--rod=id] [--insertion=id] [--district=NAME] [--port=N]',
  );
}
mkdirSync(outDir, { recursive: true });
// --real plays it on the plain page at real speed, which is the one pass every
// change gets before it is called done; otherwise the loop is stepped.
const real = args.includes('--real');
const url = new URL(base);
if (!real) url.searchParams.set('testmode', 'pixels');

const browser = port
  ? attachBrowser(Number(port), { window: PIXEL_WINDOW })
  : await launchBrowser({ window: PIXEL_WINDOW });
const WORLD = `${GAME}.scene.getScene('world')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const page = await browser.openPage('about:blank');
// A tab opened over CDP is a background tab, and a browser this driver did not
// launch was not told to animate those: at real speed nothing would draw.
if (real) await page.send('Page.bringToFront');
try {
  const wait = (ms) =>
    real
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) {
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
  /** The line in the world's dialogue box once it has finished typing, or null with none up. */
  const dialog = async () => {
    for (let i = 0; i < 40; i += 1) {
      const line = await page.evaluate(
        `(() => { const box = ${WORLD}.dialogBox; if (!box.visible) return { text: null }; return { text: box.textObject.text, done: box.isCurrentMessageComplete }; })()`,
      );
      if (line.text === null || line.done) return line.text;
      await wait(100);
    }
    throw new Error('a line never finished typing');
  };
  const elapsed = () => page.evaluate(`${WORLD}.runSession.manager.snapshot().elapsedMs`);
  const clearDialog = async () => {
    for (let guard = 0; guard < 20 && (await dialog()) !== null; guard += 1) {
      await press('Space');
      await wait(300);
    }
  };

  /**
   * The nearest bank to where the player stands, by walking steps that keep out
   * of tall grass, and the key that turns the player to face the water from it.
   */
  /** A wild fight met on the way to the water, fought out on the first move until the world is back. */
  const fightThrough = async () => {
    for (let guard = 0; guard < 400 && (await page.evaluate(sceneIs('battle'))); guard += 1) {
      // A level crossed can ask which move to forget; a script declines.
      if (
        await page.evaluate(`Boolean(document.querySelector('.move-chooser, [data-move-chooser]'))`)
      ) {
        await press('Escape');
      } else {
        await press('Space');
      }
      await wait(300);
    }
    await until(sceneIs('world'), 'the world after a fight on the way');
    await wait(600);
    await clearDialog();
  };

  const nearestBank = (throughGrass) =>
    page.evaluate(`(async () => { const w = ${WORLD}; const map = w.currentMap, c = w.collisionData, H = c.length, W = c[0].length;
      // The game's own module, from the dev server, so a place is named by the rule the game names it by.
      const { districtAt } = await import('/src/game/world/districts.ts');
      const wanted = ${JSON.stringify(district ?? null)};
      const water = (x, y) => map.terrain[y]?.[x] === 'water' && c[y]?.[x] === true;
      const sides = [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']];
      const s = w.currentTile, id = (x, y) => y * W + x; const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
      while (queue.length) { const [x, y] = queue.shift();
        const face = sides.find(([dx, dy]) => water(x + dx, y + dy));
        if (face && (!wanted || districtAt(map.id, { x, y })?.name === wanted)) {
          const path = []; let cur = [x, y]; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; path.unshift(p[2]); cur = [p[0], p[1]]; }
          return { x, y, face: face[2], path, district: districtAt(map.id, { x, y })?.name ?? null }; }
        for (const [dx, dy, k] of sides) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny }) || (!${throughGrass} && map.tallGrass[ny]?.[nx])) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      return null; })()`);

  const deployWith = async (options) => {
    // A fresh save each time. The raid page is left first, because leaving it
    // saves (`pagehide`) and would write the old game back over a clear.
    await page.send('Page.navigate', { url: 'about:blank' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.send('Page.navigate', { url: url.href });
    await page.waitFor(
      `document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`,
    );
    await page.evaluate('localStorage.clear()');
    await page.send('Page.navigate', { url: url.href });
    await page.waitFor(`document.readyState === 'complete'`);
    await deploy(page, url.href, {
      press,
      click,
      until,
      wait,
      paused: !real,
      ...deployOptions(args),
      ...options,
    });
    await until(sceneIs('world'), 'the raid');
    await wait(600);
    await clearDialog();
  };

  const walkToTheWater = async () => {
    // Round the tall grass where there is a way round, and through it where not.
    const bank = (await nearestBank(false)) ?? (await nearestBank(true));
    if (!bank) throw new Error(`no bank${district ? ` in ${district}` : ''} to walk to`);
    console.log(
      `walking ${bank.path.length} steps to the bank at ${bank.x},${bank.y} in ${bank.district}`,
    );
    for (const key of bank.path) {
      const before = await page.evaluate(`JSON.stringify(${WORLD}.currentTile)`);
      await page.keyDown(key);
      for (
        let i = 0;
        i < 10 && (await page.evaluate(`JSON.stringify(${WORLD}.currentTile)`)) === before;
        i += 1
      )
        await wait(50);
      await page.keyUp(key);
      await wait(200);
      await clearDialog();
      if (await page.evaluate(sceneIs('battle'))) await fightThrough();
    }
    // Pressing into the water turns the player to face it: the step planner
    // turns in place against anything solid.
    await press(bank.face);
    await wait(300);
    await clearDialog();
    return bank;
  };

  // -- Without a rod: the water says what would reach it ---------------------
  await deployWith({ stash: [], pack: [] });
  await walkToTheWater();
  await press('Space');
  await wait(200);
  const hint = await dialog();
  check(Boolean(hint?.includes('deep')), `no rod: the water says what is in it ("${hint}")`);
  await page.screenshot(`${outDir}/fishing-no-rod.png`);
  await press('Space');
  await wait(300);
  const rodLine = await dialog();
  check(
    Boolean(rodLine?.includes('fishing rod')),
    `no rod: and what would reach it ("${rodLine}")`,
  );
  await clearDialog();
  check(!(await page.evaluate(`Boolean(${WORLD}.fishing)`)), 'no rod: nothing is cast');

  // -- With one --------------------------------------------------------------
  await deployWith({ stash: [rod], pack: [rod] });
  check(
    await page.evaluate(`${WORLD}.bag.count(${JSON.stringify(rod)}) === 1`),
    `the ${rod} is in the raid's pack`,
  );
  await press('KeyB');
  await wait(600);
  await page.screenshot(`${outDir}/fishing-pack.png`);
  await press('Escape');
  await wait(400);
  await walkToTheWater();
  console.log(`fishing on ${await page.evaluate(`${WORLD}.currentMap.id`)}`);

  let bite = null;
  for (let cast = 1; cast <= 12 && !bite; cast += 1) {
    const before = await elapsed();
    await press('Space');
    check(
      await page.evaluate(`Boolean(${WORLD}.fishing)`),
      `cast ${cast}: the line is in the water`,
    );
    let frames = 0;
    let shotDots = false;
    while (await page.evaluate(`Boolean(${WORLD}.fishing)`)) {
      await wait(100);
      frames += 1;
      if (!shotDots && frames === 22) {
        await page.screenshot(`${outDir}/fishing-dots.png`);
        shotDots = true;
      }
      if (frames > 80) throw new Error('a cast never ended');
    }
    const spent = (await elapsed()) - before;
    // 60ms of the press, then the cast: a second, four to ten dots and one beat.
    check(
      spent >= 1000 + 5 * (1000 / 3) && spent <= 1000 + 11 * (1000 / 3) + 300,
      `cast ${cast}: ${spent}ms of raid clock`,
    );
    const answer = await dialog();
    const pending = await page.evaluate(`${WORLD}.pendingWildBattle ?? null`);
    console.log(
      `cast ${cast}: "${answer}"${pending ? ` - ${pending.speciesId} L${pending.level}` : ''}`,
    );
    if (pending) {
      check(answer === "A POKéMON's on the hook!", 'a bite says so');
      await page.screenshot(`${outDir}/fishing-on-the-hook.png`);
      bite = pending;
    } else {
      check(answer === 'Not even a nibble...', 'no bite says so');
      if (cast === 1) await page.screenshot(`${outDir}/fishing-not-a-nibble.png`);
      await clearDialog();
    }
  }
  check(bite !== null, 'something bit within twelve casts');
  if (bite) {
    for (let guard = 0; guard < 10 && !(await page.evaluate(sceneIs('battle'))); guard += 1) {
      await press('Space');
      await wait(400);
    }
    await until(sceneIs('battle'), 'the fight a bite starts');
    await wait(3000);
    // A sprite's entrance is a tween on the wall clock, which stepped frames do
    // not move (README.md), so the picture waits for it in real time.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const foe = await page.evaluate(
      `(() => { const s = ${GAME}.scene.getScene('battle').state; return { species: s.enemy.pokemon.base.id, level: s.enemy.pokemon.level }; })()`,
    );
    check(
      foe.species === bite.speciesId && foe.level === bite.level,
      `the fight is against what bit: ${foe.species} L${foe.level}`,
    );
    await page.screenshot(`${outDir}/fishing-fight.png`);
  }
} finally {
  // A browser this driver only attached to outlives it, and a game tab left in
  // it would go on sharing the next run's save.
  await page.close();
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('fishing played end to end');
