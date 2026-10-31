// Walks THE RAID ARENA's great hall as a player and photographs it.
//
//   node tools/playtest/arenaHall.mjs <url> <out-dir> [--window=1200x768] [--survey=save-surveyed.json] [--port=N] [--tour] [--still]
//
// A new game walks across the harbour and through the Arena's door, skips the
// trailer and lands on the hall's mat, and from there it asks what the captain
// asked for: nobody speaks on arrival; the platform runs all the way round; the
// fence can be looked over and says what is down there; the marshal opens the
// loadout from the mat with a newcomer's words said first and only once; and
// backing out of the loadout is back on the mat. `--tour` also stops at the
// compass points of the ring. `--survey=` is a `raidProgress.surveyed` record
// (`tools/tileset/sampleSurvey.mts`) for an explored save. `--port=` drives a
// browser already running, and `--still` asks for reduced motion and checks the
// fires hold still under it. Exit code 1 is anything not where it should be.
import { mkdirSync, readFileSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'arena-hall-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const SAVE = 'escape-from-pallet-town.save.v1';
const FRAME_MS = 100;
const tour = args.includes('--tour');
const survey = option('survey') ? JSON.parse(readFileSync(option('survey'), 'utf8')) : null;
const address = `${url}?testmode=pixels`;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  if (args.includes('--still')) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE)})`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  const pause = () => page.evaluate(`${GAME}.pauseLoop()`);
  await pause();
  const step = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.tap(code, 0);
    await step(FRAME_MS * 2);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);

  // A new game, straight to the harbour.
  await press('Space');
  await until(sceneIs('starter'), 'the starter picker');
  await until(
    `(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`,
    'the picker',
  );
  await step(200);
  await page.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirm'))?.click()`);
  await until(sceneIs('base'), 'the harbour');
  if (survey) {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE)}));
      save.raidProgress.surveyed = ${JSON.stringify(survey)};
      localStorage.setItem(${JSON.stringify(SAVE)}, JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: address });
    await page.waitFor(sceneIs('title'), { what: 'the title' });
    await pause();
    await press('Space');
    await until(sceneIs('base'), 'the harbour, explored');
  }
  await step(1000);

  // To the Arena's door, stopping once the hall is up rather than on the loadout.
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'; })()`;
  for (let guard = 0; guard < 80 && !(await page.evaluate(inHall)); guard += 1) {
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await step(700);
      await press('Escape');
      await step(400);
      continue;
    }
    const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving) return null;
      const goals = b.doors.find((each) => each.id === 'raid-arena').tiles;
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return key; })()`);
    if (key) await press(key);
    await step(200);
  }
  await until(inHall, 'the great hall');
  await step(500);
  await page.screenshot(`${out}/1-arrival.png`);

  // Nobody speaks on arrival: no first words, no dialogue box.
  expect('no box from anybody on arriving', !(await base('b.dialogBox.visible')));
  expect('no first-words box on the page', !(await page.evaluate(`Boolean(document.querySelector('[data-speech-done]'))`)));
  expect('stood on the mat', await base(`b.currentTile.x === b.room.mat.x && b.currentTile.y === b.room.mat.y`));
  console.log(`hint: ${await base('b.hintShown')}`);
  // A flame licks, unless the browser has been asked for stillness.
  const fires = () => base(`JSON.stringify(b.arena.fires.map((fire) => fire.frame))`);
  const before = await fires();
  await step(600);
  const after = await fires();
  expect(args.includes('--still') ? 'the fires hold still' : 'the fires burn', args.includes('--still') ? before === after : before !== after);

  /** Walks the player to a tile, a step at a time, as keys. */
  const walkTo = async (goal, what) => {
    for (let guard = 0; guard < 240; guard += 1) {
      const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const goal = ${JSON.stringify(goal)};
        const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
        if (s.x === goal.x && s.y === goal.y) return 'there';
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift(); if (x === goal.x && y === goal.y) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            // Round the partner: a tap towards it is a turn to face it, not a step.
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny }) || b.partnerAt({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return b.partnerAt(goal) ? 'partner' : null;
        let cur = found, key = null;
        for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return key; })()`);
      if (key === 'there') return true;
      if (key === 'partner') {
        // The partner stands on it. A stop on the ring is near enough; the mat
        // has to be stood on, so walk on up the runner, it follows, and come back.
        if (goal.y < 62) return true;
        await walkTo({ x: goal.x, y: goal.y - 3 }, `${what}, clearing it`);
        continue;
      }
      if (key === null) {
        expect(`${what}: can be walked to`, false);
        return false;
      }
      await page.tap(key, 0);
      await step(170);
      // One step at a time: a tap made mid-step is kept, and a second one down
      // onto the mat would be a step off it.
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) {
        await step(100);
      }
    }
    expect(`${what}: got there (stuck at ${await base('JSON.stringify([b.currentTile, b.facing, b.partner?.tile, b.dialogBox.visible, b.leaving])')}, heading for ${JSON.stringify(goal)})`, false);
    return false;
  };

  // Up the runner to the fence, and look over it.
  const mat = await base('({ ...b.room.mat })');
  const fenceFront = await base(`(() => { let y = b.currentTile.y; while (!b.isBlocked({ x: b.currentTile.x, y: y - 1 })) y -= 1; return { x: b.currentTile.x, y }; })()`);
  await walkTo(fenceFront, 'the fence');
  await press('ArrowUp');
  await step(300);
  await page.screenshot(`${out}/2-south-fence.png`);
  console.log(`hint: ${await base('b.hintShown')}`);
  expect('the fence says it can be looked over', (await base('b.hintShown')) === '[SPACE] LOOK DOWN');
  await press('Space');
  await step(900);
  expect('looking over it says what is there', await base('b.dialogBox.visible'));
  await page.screenshot(`${out}/3-looking-down.png`);
  for (let guard = 0; guard < 6 && (await base('b.dialogBox.visible')); guard += 1) {
    await press('Space');
    await step(600);
  }

  if (tour) {
    // Stops at the fence round the ring, found by walking out from the pit's
    // middle to the first tile that can be stood on, and on along the platform.
    const stop = (dx, dy, on = 0) =>
      base(`(() => { let x = 32, y = 33; while (b.isBlocked({ x, y })) { x += ${dx}; y += ${dy}; } return { x: x + ${dx} * ${on}, y: y + ${dy} * ${on} }; })()`);
    for (const [name, dx, dy, on, facing] of [
      ['4-east-fence', 1, 0, 0, 'ArrowLeft'],
      ['5-north-east', 1, -1, 2, null],
      ['6-north-fence', 0, -1, 0, 'ArrowDown'],
      ['7-north-wall', 0, -1, 4, null],
      ['8-west-fence', -1, 0, 0, 'ArrowRight'],
      ['8b-south-east', 1, 1, 1, null],
    ]) {
      if (await walkTo(await stop(dx, dy, on), name)) {
        if (facing) await press(facing);
        await step(500);
        await page.screenshot(`${out}/${name}.png`);
        if (facing) console.log(`${name}: ${await base('b.hintShown')}`);
      }
    }
    await walkTo(mat, 'the mat again');
  } else {
    await walkTo(mat, 'the mat again');
  }
  await step(300);

  // One key from the mat: the marshal's words, once, then the loadout.
  await press('Space');
  await step(900);
  expect('the marshal tells a newcomer what is next', await base('b.dialogBox.visible'));
  await page.screenshot(`${out}/9-marshal.png`);
  for (let guard = 0; guard < 12 && !(await page.evaluate(sceneIs('hub'))); guard += 1) {
    await press('Space');
    await step(500);
  }
  await until(sceneIs('hub'), 'the loadout');
  await step(800);
  await page.screenshot(`${out}/10-loadout.png`);
  expect('the loadout opens with nothing said over it', !(await page.evaluate(`Boolean(document.querySelector('[data-speech-done]'))`)));
  expect('it is the raid loadout', (await page.evaluate(`(() => { const h = ${GAME}.scene.getScene('hub'); return h.view + ':' + h.flow.step; })()`)) === 'deploy:loadout');
  await press('Escape');
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready; })()`, 'back in the hall');
  await step(500);
  expect('backing out is back on the hall mat', await base(`b.room?.id === 'raid-arena' && b.currentTile.x === b.room.mat.x && b.currentTile.y === b.room.mat.y`));
  await press('Space');
  await step(600);
  expect('the words are said once: the loadout opens at once', await page.evaluate(sceneIs('hub')));
  await until(sceneIs('hub'), 'the loadout again');
  await press('Escape');
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready; })()`, 'the hall again');
  await step(400);
  await press('ArrowDown');
  await step(600);
  expect('down off the mat is the yard, on the Arena step', await base(`b.room === null && b.currentTile.x === b.doors.find((d) => d.id === 'raid-arena').returnTo.x`));
  await page.screenshot(`${out}/11-out.png`);
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.error(`${faults.length} fault(s)`);
  process.exit(1);
}
