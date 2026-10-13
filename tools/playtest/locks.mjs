// Locks and keys, played in the real game: Pallet Town's locked WEIR GATE and
// its KILN STRONGBOX, met first with nothing to open them and then with the
// Weir Key, a Lockpick and a Pickaxe in the pack - the gate opened and walked
// out through, the crate picked open, and the ROCKFALL dug out.
//
//   node tools/playtest/locks.mjs <dev server url> <out dir> [--port=N] [--real]
//
// The player is stood beside each thing rather than walked across the valley to
// it: what is being checked is the lock, not the walk. Screenshots land in
// <out dir>. It fails if a line, a count or the ending is not what the rules in
// `src/game/world/extractionPoints.ts` and `src/game/world/pois.ts` promise.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
if (!base || !outDir) {
  throw new Error('usage: locks.mjs <dev server url> <out dir> [--port=N] [--real]');
}
mkdirSync(outDir, { recursive: true });
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
  /** Every line the world's dialogue box says until it closes, pressing through each. */
  const readAll = async () => {
    const lines = [];
    for (let guard = 0; guard < 20; guard += 1) {
      let line = null;
      for (let i = 0; i < 40; i += 1) {
        const shown = await page.evaluate(
          `(() => { const box = ${WORLD}.dialogBox; if (!box.visible) return { text: null }; return { text: box.textObject.text, done: box.isCurrentMessageComplete }; })()`,
        );
        if (shown.text === null) return lines;
        if (shown.done) {
          line = shown.text;
          break;
        }
        await wait(100);
      }
      if (line === null) throw new Error('a line never finished typing');
      lines.push(line.replace(/\s+/g, ' '));
      await press('Space');
      await wait(300);
    }
    return lines;
  };
  /**
   * Stands the player on the one open tile beside `tile`, facing it, and
   * settles the view - a caption speaks within five steps, so the thing's
   * name is up by the time the picture is taken.
   */
  const standFacing = async (tile) => {
    await page.evaluate(`(() => { const w = ${WORLD};
      const sides = [[0,-1,'down'],[0,1,'up'],[-1,0,'right'],[1,0,'left']];
      const [dx, dy, facing] = sides.find(([dx, dy]) => !w.collisionData[${tile.y} + dy]?.[${tile.x} + dx]);
      const x = ${tile.x} + dx, y = ${tile.y} + dy;
      const offX = w.player.x - w.currentTile.x * 16, offY = w.player.y - w.currentTile.y * 16;
      w.currentTile = { x, y }; w.setPlayerPosition(x * 16 + offX, y * 16 + offY); w.facing = facing; })()`);
    await wait(300);
    // Pressing into something solid turns the player to face it, as a player
    // does; a crate is ground, so it is faced by the facing set above.
    if (await page.evaluate(`${WORLD}.isBlocked(${JSON.stringify(tile)})`)) {
      const facing = await page.evaluate(`${WORLD}.facing`);
      await press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[facing]);
    }
    await wait(800);
  };
  const deployWith = async (options) => {
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
      insertion: 'town-square',
      completed: ['recover-lost-field-kit'],
      level: '12',
      ...options,
    });
    await until(sceneIs('world'), 'the raid');
    await wait(600);
    await readAll();
  };
  const exit = (label) =>
    page.evaluate(`${WORLD}.extractionPointsForCurrentMap().find((p) => p.label === ${JSON.stringify(label)}).position`);
  const crate = (label) =>
    page.evaluate(`${WORLD}.currentMap.pois.find((p) => p.label === ${JSON.stringify(label)}).position`);
  const count = (itemId) => page.evaluate(`${WORLD}.bag.count(${JSON.stringify(itemId)})`);

  // -- With nothing to open them ---------------------------------------------
  await deployWith({ stash: [], pack: [] });
  const gate = await exit('WEIR GATE');
  await standFacing(gate);
  check(await page.evaluate(`${WORLD}.isBlocked(${JSON.stringify(gate)})`), 'the locked gate is a wall');
  await page.screenshot(`${outDir}/weir-gate-locked.png`);
  await press('Space');
  await wait(200);
  const refused = await readAll();
  check(
    refused.join(' | ') ===
      'WEIR GATE: the gate is locked… | No! It needs the Weir Key! | The Weir Key is a rare find, somewhere on this map.',
    `no key: FireRed's words at a locked door, and where its key is found ("${refused.join(' | ')}")`,
  );

  const strongbox = await crate('KILN STRONGBOX');
  await standFacing(strongbox);
  await page.screenshot(`${outDir}/kiln-strongbox-locked.png`);
  await press('Space');
  await wait(200);
  const locked = await readAll();
  check(locked[0] === 'KILN STRONGBOX: the crate is locked…', `no pick: the crate is locked ("${locked[0]}")`);
  check((await count('super-potion')) === 0, 'no pick: the crate paid nothing');

  // -- With the key, a Lockpick and a Pickaxe ---------------------------------
  await deployWith({
    stash: ['weir-key', 'lockpick', 'pickaxe'],
    pack: ['weir-key', 'lockpick', 'pickaxe'],
  });
  check((await count('weir-key')) === 1 && (await count('lockpick')) === 1, 'the key and the pick are packed');
  await press('KeyB');
  await wait(600);
  await page.screenshot(`${outDir}/pack-with-key-and-pick.png`);
  await press('Escape');
  await wait(400);

  await standFacing(await crate('KILN STRONGBOX'));
  await press('Space');
  await wait(200);
  const opened = await readAll();
  check(opened[0] === 'The Lockpick turned the lock, and snapped in it.', `the pick opens the crate ("${opened[0]}")`);
  check((await count('lockpick')) === 0, 'the pick is spent');
  check((await count('super-potion')) >= 1 && (await count('parts-crate')) === 1, 'the crate paid its cache');

  const rubble = await exit('ROCKFALL');
  await standFacing(rubble);
  await page.screenshot(`${outDir}/rockfall-buried.png`);
  await press('Space');
  await wait(200);
  const dug = await readAll();
  check(dug[0] === 'You swung the Pickaxe into the rubble and dug it out.', `the Pickaxe digs the rockfall ("${dug[0]}")`);

  await standFacing(gate);
  await press('Space');
  await wait(200);
  const unlocked = await readAll();
  check(unlocked[0] === 'Bingo! The Weir Key opened the gate!', `the key opens the gate ("${unlocked[0]}")`);
  check((await count('weir-key')) === 1, 'the key is not used up');
  await wait(400);
  await page.screenshot(`${outDir}/weir-gate-open.png`);
  // Through it: an open exit takes whoever steps on it.
  const facing = await page.evaluate(`${WORLD}.facing`);
  const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[facing];
  await page.keyDown(keyFor);
  await wait(400);
  await page.keyUp(keyFor);
  await until(sceneIs('extraction'), 'the raid ending through the gate');
  await wait(1500);
  const report = await page.evaluate(`document.body.innerText`);
  check(/weir key/i.test(report), 'the result screen banks the Weir Key with the haul');
  await page.screenshot(`${outDir}/extracted-through-weir-gate.png`);
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('all lock checks passed');
