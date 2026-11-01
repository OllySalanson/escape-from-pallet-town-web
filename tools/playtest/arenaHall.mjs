// Gets ready for a raid in THE RAID ARENA's great hall as a player does, and
// goes over the fence.
//
//   node tools/playtest/arenaHall.mjs <url> <out-dir> [--window=1200x768] [--port=N] [--tour] [--still]
//
// A new game walks across the harbour and through the Arena's door, skips the
// trailer and lands on the hall's mat, and from there it asks what the captain
// asked for: nobody speaks on arrival; the marshal says what the room is once,
// when spoken to, and opens no screen; the bench, the rack and the locker each
// open a panel over the room and backing out of one stands the player where they
// were; what was chosen stands on the furniture; the rim says which way in it is
// over and looks down at it; a jump goes over the fence, down through the cloud
// and lands in the raid; a raid's ending comes home to the rim with the cloud
// lifting off what it walked. `--tour` also stops at the compass points of the
// ring, `--port=` drives a browser already running, and `--still` asks for
// reduced motion: no dive, and the fires hold still. Exit code 1 is anything not
// where it should be.
import { mkdirSync } from 'node:fs';
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
const still = args.includes('--still');
const address = `${url}?testmode=pixels`;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  if (still) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE)})`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`${GAME}.pauseLoop()`);
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
  const hub = (expression) => page.evaluate(`(() => { const h = ${GAME}.scene.getScene('hub'); return ${expression}; })()`);
  const shot = (name) => page.screenshot(`${out}/${name}.png`);

  // A new game, straight to the harbour.
  await press('Space');
  await until(sceneIs('base'), 'the starter picker');
  await until(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`,
    'the picker',
  );
  await step(200);
  await until(sceneIs('base'), 'the harbour');
  await step(1000);

  /** A step's worth of the way to some tiles, as a key, over the scene's own collision. */
  const keyTowards = (goals) =>
    page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving) return null;
      const goals = ${JSON.stringify(goals)} ?? b.doors.find((each) => each.id === 'raid-arena').tiles;
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      if (at(s.x, s.y)) return 'there';
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return key; })()`);

  // To the Arena's door, and past the trailer.
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'; })()`;
  for (let guard = 0; guard < 80 && !(await page.evaluate(inHall)); guard += 1) {
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await step(700);
      await press('Escape');
      await step(400);
      continue;
    }
    const key = await keyTowards(null);
    if (key && key !== 'there') await press(key);
    await step(200);
  }
  await until(inHall, 'the great hall');
  await step(500);
  await shot('1-arrival');

  // Nobody speaks on arrival, and the marshal wants a word.
  expect('no box from anybody on arriving', !(await base('b.dialogBox.visible')));
  expect('stood on the mat', await base(`b.currentTile.x === b.room.mat.x && b.currentTile.y === b.room.mat.y`));
  expect('the marshal has something to say to a newcomer', await base('Boolean(b.keeperMark)'));
  expect('the hint on the mat says the way out', (await base('b.hintShown')) === '[DOWN] OUT');
  expect('the key on the mat opens nothing', await (async () => {
    await press('Space');
    await step(300);
    return !(await page.evaluate(sceneIs('hub'))) && !(await base('b.dialogBox.visible'));
  })());
  const fires = () => base(`JSON.stringify(b.arena.fires.map((fire) => fire.frame))`);
  const before = await fires();
  await step(600);
  const after = await fires();
  expect(still ? 'the fires hold still' : 'the fires burn', still ? before === after : before !== after);

  /** Walks the player to a tile, a step at a time, as keys. */
  const walkTo = async (goal) => {
    for (let guard = 0; guard < 240; guard += 1) {
      const key = await keyTowards([goal]);
      if (key === 'there') return true;
      if (key === null) {
        await step(100);
        continue;
      }
      await page.tap(key, 0);
      await step(170);
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) {
        await step(100);
      }
    }
    expect(`got to ${JSON.stringify(goal)}`, false);
    return false;
  };
  const face = async (code) => {
    await press(code);
    await step(120);
  };
  const front = (id, along = 0) => base(`(() => { const t = b.arenaStations.find((each) => each.id === ${JSON.stringify(id)}).tiles[${along}]; return { x: t.x, y: t.y + 1 }; })()`);

  // The marshal: a newcomer's words, once, and no screen.
  const keeper = await base('({ ...b.room.keeper.position })');
  await walkTo({ x: keeper.x + 1, y: keeper.y });
  await face('ArrowLeft');
  expect('the hint names her', (await base('b.hintShown')) === '[SPACE] THE MARSHAL');
  await press('Space');
  await step(900);
  expect('she tells a newcomer what the room is', await base('b.dialogBox.visible'));
  await shot('2-marshal');
  for (let guard = 0; guard < 16 && (await base('b.dialogBox.visible')); guard += 1) {
    await press('Space');
    await step(500);
  }
  expect('and opens no screen', !(await page.evaluate(sceneIs('hub'))));
  expect('and the mark comes down', !(await base('Boolean(b.keeperMark)')));

  // The three panels, each opened where it stands, each backing out to the same tile.
  for (const [station, along, heading, name] of [
    ['bench', 3, 'The bench', '3-bench'],
    ['rack', 1, 'The armoury rack', '4-rack'],
    ['locker', 0, 'The locker', '5-locker'],
  ]) {
    const tile = await front(station, along);
    await walkTo(tile);
    await face('ArrowUp');
    await step(200);
    await shot(`${name}-front`);
    await press('Space');
    await until(sceneIs('hub'), `the ${station}`);
    await step(600);
    await shot(name);
    expect(`the ${station} opens over the room`, (await hub('h.view')) === station && (await page.evaluate(sceneIs('base'))));
    expect(`it is headed ${heading}`, (await page.evaluate(`document.querySelector('.px-title h1')?.textContent`)) === heading);
    if (station === 'rack') {
      // A ball, for something to read on the rack from across the room.
      await page.evaluate(`document.querySelector('button[data-count-kind="item"][data-count-id="poke-ball"][data-count-dir="1"]')?.click()`);
      await step(300);
    }
    await press('Escape');
    await step(400);
    expect(`backing out of the ${station} stands the player where they were`, await base(`b.currentTile.x === ${tile.x} && b.currentTile.y === ${tile.y} && !b.arenaPanel`));
  }

  // To the rim, up the runner.
  const mat = await base('({ ...b.room.mat })');
  await walkTo({ x: mat.x, y: 53 });
  await face('ArrowUp');
  await step(300);
  await shot('6-rim');
  const hint = await base('b.hintShown');
  expect(`the rim says where it is over (${hint})`, hint.startsWith('[SPACE] JUMP IN AT '));

  if (args.includes('--tour')) {
    for (const [name, x, y] of [['east', 59, 33], ['north', 35, 9], ['west', 11, 33]]) {
      const nearest = await base(`(() => { let best = null, away = 1e9; for (const t of b.arenaRim) { const d = Math.abs(t.x - ${x}) + Math.abs(t.y - ${y}); if (d < away) { away = d; best = t; } } return best; })()`);
      await walkTo(nearest);
      await step(300);
      await shot(`6-rim-${name}`);
      console.log(`${name}: ${await base('b.hintShown')}`);
    }
    await walkTo({ x: mat.x, y: 53 });
  }

  // Looking down, with the marshal's words the first time.
  await press('Space');
  await step(900);
  expect('the marshal says what is down there, in the hall, before anything opens', (await base('b.dialogBox.visible')) && !(await page.evaluate(sceneIs('hub'))));
  await shot('7-rim-words');
  await press('Escape');
  await until(sceneIs('hub'), 'the rim');
  await step(900);
  await shot('8-looking-down');
  expect('it is looking the plan over', (await hub('h.flow.step')) === 'confirm');
  expect('the cursor is on the jump', await page.evaluate(`document.activeElement?.hasAttribute('data-start') === true`));
  await press('Escape');
  await step(500);
  expect('NOT YET is back on the rim', await base(`b.currentTile.x === ${mat.x} && b.currentTile.y === 56 && !b.arenaPanel`));
  await press('Space');
  await until(sceneIs('hub'), 'the rim again');
  await step(500);

  // Over the fence.
  await press('Enter');
  if (still) {
    await until(sceneIs('world'), 'the raid');
    expect('with reduced motion it is a plain fade into the raid', !(await page.evaluate(`Boolean(${GAME}.scene.getScene('world').arrival)`)));
  } else {
    for (let frame = 0; frame < 60 && (await page.evaluate(`!(${sceneIs('world')})`)); frame += 1) {
      await step(200);
      if (frame % 2 === 0) await shot(`9-jump-${String(frame).padStart(2, '0')}`);
    }
    for (let frame = 0; frame < 30 && (await page.evaluate(`Boolean(${GAME}.scene.getScene('world').arrival)`)); frame += 1) {
      await shot(`10-landing-${frame}`);
      await step(160);
    }
  }
  await step(300);
  await shot('11-landed');
  expect('and lands on the way in', await page.evaluate(sceneIs('world')));

  // Home again: back on the rim, with the cloud lifting off what the raid walked.
  for (let guard = 0; guard < 4 && (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`)); guard += 1) {
    await press('Space');
    await step(400);
  }
  await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const s = w.currentTile;
    for (let n = 0; n < 50; n += 1) { w.currentTile = { x: s.x + n, y: s.y + (n >> 1) }; w.surveyGround(); }
    w.currentTile = s;
    const way = w.runSession.plan.extractionPoints[0]; w.extractThrough(way); })()`);
  await step(800);
  await until(sceneIs('extraction'), 'the result screen');
  await step(1500);
  await press('Enter');
  await until(sceneIs('base'), 'home');
  expect('home is the hall, on the rim it left from', await base(`b.room?.id === 'raid-arena' && b.currentTile.x === ${mat.x} && b.currentTile.y === 56`));
  if (!still) {
    expect('the cloud lifts off what the raid walked', await base('Boolean(b.fogLift)'));
    await step(900);
    await shot('12-fog-lifting');
    await step(1100);
    await shot('13-fog-lifted');
  }
  for (let guard = 0; guard < 40 && (await base('Boolean(b.fogLift)')); guard += 1) {
    await step(200);
  }
  await step(300);
  await shot('14-home');
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.error(`${faults.length} fault(s)`);
  process.exit(1);
}
