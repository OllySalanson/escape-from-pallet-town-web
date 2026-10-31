// Plays what THE RAID ARENA does for somebody who has come back to it.
//
//   node tools/playtest/arenaFun.mjs <url> <out-dir> [--window=1200x768] [--port=N] [--only=crowd]
//
// A save is written as it would stand after that many raids, the raid's ending is
// handed to the hall as the result screen hands it, and everything is played with
// the real keys: the crowd's answer to each kind of raid, a wave at the stands and
// a lap of the ring. Exit code 1 is anything not where it should be. It also holds
// the one promise the whole of this rests on: home on the rim, SPACE and ENTER are
// still all that a raid asks.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'arena-fun-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const only = option('only');
const SAVE = 'escape-from-pallet-town.save.v1';
const FRAME_MS = 100;
const address = `${url}?testmode=pixels`;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE)})`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, after = FRAME_MS * 2) => {
    await page.tap(code, 0);
    await step(after);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
  const shot = (name) => page.screenshot(`${out}/${name}.png`);

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
  const walkTo = async (goal) => {
    for (let guard = 0; guard < 300; guard += 1) {
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

  // A new game, across the harbour, past the trailer and into the hall.
  await press('Space');
  await until(sceneIs('starter'), 'the starter picker');
  await until(`(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`, 'the picker');
  await step(200);
  await page.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirm'))?.click()`);
  await until(sceneIs('base'), 'the harbour');
  await step(1000);
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

  /** Writes the raids on the record, and comes home to the rim from a raid that ended as told. */
  const comeHome = async (mood, record, tile = { x: 32, y: 56 }) => {
    await page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE)})); s.raidProgress.raidRecord = { 'greystone-vale': ${JSON.stringify(record)} }; localStorage.setItem(${JSON.stringify(SAVE)}, JSON.stringify(s)); })()`);
    await base(`(() => { b.currentTile = ${JSON.stringify(tile)}; b.scene.start('base', { arrival: 'raid', room: 'raid-arena', raidMood: ${JSON.stringify(mood)}, at: ${JSON.stringify(tile)} }); return 1; })()`);
    await step(200);
    await until(inHall, 'the hall again');
  };
  const posedUp = () => base(`b.arena.posed.filter((each) => each.visible).length`);

  // --- the crowd ---------------------------------------------------------------
  if (!only || only === 'crowd') {
    // Near the outer wall, on the south side, so the seats are in the picture whatever the look does.
    await comeHome('roar', { deployed: 16, extracted: 14, wiped: 2 });
    expect('the view has gone round to the crowd', await base('b.crowdLookMs > 0'));
    await step(1300);
    await shot('crowd-roar');
    expect('a big haul has them on their feet', (await posedUp()) > 20);
    await step(1200);
    await shot('crowd-roar-paper');
    expect('and throwing paper', await base('b.arena.crowd.paperMs !== null'));
    await step(6000);

    await comeHome('groan', { deployed: 16, extracted: 13, wiped: 3 });
    await step(1200);
    await shot('crowd-groan');
    expect('a wipe gets nobody up but those leaving', (await posedUp()) < 25);
    expect('and the fires burn low', await base('b.arena.crowd.fireShare < 0.7'));

    // The house it was before a raid was ever banked, and the house after many.
    await comeHome('clap', { deployed: 1, extracted: 1, wiped: 0 });
    await step(1000);
    await shot('crowd-thin-house');
    const thin = await base('b.arena.house');
    await comeHome('clap', { deployed: 30, extracted: 20, wiped: 2 });
    await step(1000);
    await shot('crowd-full-house');
    expect('a veteran plays to a fuller house', (await base('b.arena.house')) > thin);

    // Home on the rim, SPACE and ENTER: nothing here gets in the way.
    await comeHome('roar', { deployed: 16, extracted: 14, wiped: 2 });
    await step(200);
    await press('Space', 700);
    for (let guard = 0; guard < 16 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 500);
    }
    await until(sceneIs('hub'), 'the rim');
    expect('SPACE on the rim still looks down at once, whatever the crowd is doing', await page.evaluate(sceneIs('hub')));
    await step(400);
    await press('Escape', 500);
    await step(9000);

    // A wave at the stands from the outer floor.
    await walkTo({ x: 32, y: 6 });
    await press('ArrowUp', 300);
    await step(2600);
    expect(`the far wall offers a wave (${await base('b.hintShown')})`, (await base('b.hintShown')) === '[SPACE] WAVE TO THE CROWD');
    expect('nobody up before it', (await posedUp()) === 0);
    await press('Space', 800);
    await shot('crowd-wave');
    expect('the nearest section waves back', (await posedUp()) > 3);
    await step(3000);
    expect('and sits down again', (await posedUp()) === 0);

    // A run round the outer floor has the view on the people getting up for it.
    for (const [name, x, y] of [['ne', 47, 11], ['e', 60, 33], ['se', 47, 55]]) {
      await walkTo({ x, y });
      await shot(`crowd-run-${name}`);
    }
    expect('a run round the outer floor gets them up', (await posedUp()) > 3);
    await step(2600);

    // A lap of the ring, on the rim.
    const centre = { x: 32.5, y: 33 };
    const rim = (await base(`b.arenaRim.map((t) => ({ x: t.x, y: t.y }))`)).sort(
      (a, b) => Math.atan2(a.y - centre.y, a.x - centre.x) - Math.atan2(b.y - centre.y, b.x - centre.x),
    );
    let start = 0;
    let away = 1e9;
    rim.forEach((tile, index) => {
      const d = Math.abs(tile.x - 32) + Math.abs(tile.y - 56);
      if (d < away) {
        away = d;
        start = index;
      }
    });
    await walkTo(rim[start]);
    let bandSeen = false;
    let lapSign = false;
    for (let index = 1; index <= rim.length + 2; index += 1) {
      await walkTo(rim[(start + index) % rim.length]);
      bandSeen ||= await base('b.arena.crowd.band !== null');
      if (index === Math.round(rim.length * 0.3) || index === Math.round(rim.length * 0.5)) await shot(`crowd-lap-${index}`);
      lapSign ||= await base('Boolean(b.hallSign)');
    }
    await step(400);
    await shot('crowd-lap-done');
    expect('the band runs with a runner', bandSeen);
    expect('and a whole lap is called', lapSign);
    console.log('sign:', await base(`b.hallSign?.text?.text`));
  }
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.error(`${faults.length} fault(s)`);
  process.exit(1);
}
