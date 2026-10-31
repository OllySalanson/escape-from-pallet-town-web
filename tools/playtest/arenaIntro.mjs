// Plays THE RAID ARENA's trailer end to end and photographs it, a beat at a time:
//
//   node tools/playtest/arenaIntro.mjs <test-mode build url> <out dir> [--port=N] [--window=WxH] [--live] [--every=FROM:TO:STEP]
//
// A new game walks into the Arena's door, and the trailer plays unasked
// (`scenes/ArenaIntroScene.ts`); every beat is photographed at the moment
// named below, then a key on the closing card has to land in the great hall.
// Backing out and walking in again goes straight to the hall, and the Gym Guide
// at the door runs it again when asked, with SKIP on screen, and one key has to
// skip it to the hall. The loop is paused and stepped at
// 60fps frames throughout, so the pictures are of exact moments - use a
// test-mode build (`?testmode=pixels` for a picture worth judging;
// `tools/playtest/README.md`, "Memory"). `--live` leaves the loop running and
// waits in real time instead - the one pass at real speed a change is owed -
// so its pictures land near their moments rather than on them. `--every=` takes
// a picture every STEP ms between two moments in place of the beats, which is
// how a beat's motion is watched.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'arena-intro-shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
const live = args.includes('--live');
mkdirSync(out, { recursive: true });

/** The moments photographed, in milliseconds from the trailer's first frame. */
const every = /^(\d+):(\d+):(\d+)$/.exec(option('every') ?? '');
const BEATS = [
  ['01-sneak', 1500],
  ['02-find', 4100],
  ['03-prize', 7500],
  ['04-rustle', 9300],
  ['05-battle', 11000],
  ['06-hit', 14000],
  ['07-easy', 15800],
  ['08-warning', 16400],
  ['09-hunter', 19000],
  ['10-swarmed', 21400],
  ['11-trapped', 22800],
  ['12-panel', 24300],
  ['13-panel-word', 25000],
  ['14-landing', 26900],
  ['15-fire', 27900],
  ['16-run', 29700],
  ['17a-hold', 31300],
  ['17b-takeoff', 32800],
  ['17c-chased', 33400],
  ['17d-wall', 34050],
  ['17e-overhead', 34400],
  ['18-look-back', 36000],
  ['19-extracted', 38700],
  ['20-host', 44000],
  ['21-ready', 48000],
  ['22-closing-card', 49700],
];
const SHOTS = every
  ? Array.from({ length: Math.floor((Number(every[2]) - Number(every[1])) / Number(every[3])) + 1 }, (_shot, index) => {
      const at = Number(every[1]) + index * Number(every[3]);
      return [`t${String(at).padStart(5, '0')}`, at];
    })
  : BEATS;

const failures = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  // A new game, on a browser that may hold somebody's: the save is cleared first.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`localStorage.removeItem('escape-from-pallet-town.save.v1')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  if (!live) await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (ms) =>
    live ? sleep(ms) : page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(50);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.tap(code, 0);
    await step(FRAME_MS * 2);
  };

  // A new game, straight to the harbour.
  await press('Space');
  await until(sceneIs('base'), 'the starter picker');
  await until(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("squirtle") === true`,
    'the picker',
  );
  await step(200);
  await until(sceneIs('base'), 'the harbour');
  // Dressed in the boutique's starter pieces rather than the classic figure,
  // so the trailer can be seen to draw the player in what they wear.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1'));
    save.raidProgress.look = { head: 'short-crop', top: 'plain-tee', legs: 'plain-trousers', body: null };
    localStorage.setItem('escape-from-pallet-town.save.v1', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  if (!live) await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(sceneIs('base'), 'the harbour, dressed');
  await step(1500);
  const worn = await page.evaluate(`${GAME}.scene.getScene('base').playerTexture`);

  // Up to the Arena's door, stopping the moment the trailer starts.
  const intro = 'INTRO';
  await walkIntoBase(page, 'raid-arena', {
    press: async (code) => {
      if (await page.evaluate(sceneIs('arenaIntro'))) throw new Error(intro);
      await page.tap(code, 0);
    },
    until,
    wait: step,
  }).catch((error) => {
    if (error.message !== intro) throw error;
  });
  await until(sceneIs('arenaIntro'), 'the trailer');
  const seen = await page.evaluate(`JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1')).raidProgress.arenaIntroSeen === true`);
  expect('the save records the trailer as seen once it starts', seen);
  const drawn = await page.evaluate(`${GAME}.scene.getScene('arenaIntro').playerTexture`);
  expect(`the trailer draws the player in what they wear (${drawn})`, drawn.startsWith('look:') && drawn === worn);
  const chip = await page.evaluate(`${GAME}.scene.getScene('arenaIntro').viewing`);
  expect(`the first viewing is the first (${chip})`, chip === 'first');

  let elapsed = 0;
  for (const [name, at] of SHOTS) {
    await step(at - elapsed);
    elapsed = at;
    await page.screenshot(`${out}/${name}.png`);
    console.log(`${name} at ${at}ms`);
  }
  expect('it waits on the closing card', await page.evaluate(sceneIs('arenaIntro')));
  await step(4000);
  expect('and still waits, with nothing pressed', await page.evaluate(sceneIs('arenaIntro')));
  await press('Space');
  const onTheMat = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.room?.id === 'raid-arena' && b.currentTile.x === b.room.mat.x && b.currentTile.y === b.room.mat.y; })()`;
  await until(onTheMat, 'the great hall');
  await step(400);
  expect('a key on the card lands on the mat of the great hall', await page.evaluate(onTheMat));

  // Out of the door and in again: it is a door like any other now.
  await press('ArrowDown');
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.room; })()`, 'back in the harbour');
  await step(800);
  await press('ArrowUp');
  await step(800);
  expect('the door goes straight to the hall the second time', !(await page.evaluate(sceneIs('arenaIntro'))));
  await until(onTheMat, 'the great hall, straight through the door');
  await press('ArrowDown');
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.room; })()`, 'back in the harbour again');
  await step(800);

  // The Gym Guide, who closes the trailer, runs it again for anybody who asks.
  const toTheGuide = () =>
    page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.ready || b.targetTile) return null;
      const at = b.harbourLife.spriteAt('gym-guide'); const g = { x: Math.round(at.x / 16), y: Math.round((at.y + 8) / 16) };
      const s = b.currentTile; const near = (x, y) => Math.abs(x - g.x) + Math.abs(y - g.y) === 1;
      if (near(s.x, s.y)) return { face: g.x > s.x ? 'ArrowRight' : g.x < s.x ? 'ArrowLeft' : g.y > s.y ? 'ArrowDown' : 'ArrowUp' };
      const c = b.collision, W = c[0].length, H = c.length, id = (x, y) => y * W + x, prev = new Map([[id(s.x, s.y), null]]), queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (near(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny }) || b.doors.some((d) => d.tiles.some((t) => t.x === nx && t.y === ny))) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return { key }; })()`);
  for (let guard = 0; guard < 40; guard += 1) {
    const move = await toTheGuide();
    if (move?.face) {
      await press(move.face);
      break;
    }
    if (move?.key) await press(move.key);
    await step(240);
  }
  await press('Space');
  for (let guard = 0; guard < 16 && !(await page.evaluate(`Boolean(${GAME}.scene.getScene('base').boxQuestion)`)); guard += 1) {
    await press('Space');
    await step(400);
  }
  expect('he asks once he has said the day\'s work', await page.evaluate(`Boolean(${GAME}.scene.getScene('base').boxQuestion)`));
  await page.screenshot(`${out}/22a-reel-question.png`);
  expect('the cursor starts on NOT NOW', await page.evaluate(`${GAME}.scene.getScene('base').boxQuestion.prompt.selected === 1`));
  await press('ArrowLeft');
  await press('Space');
  await until(sceneIs('arenaIntro'), 'the trailer, asked for');
  const again = await page.evaluate(`${GAME}.scene.getScene('arenaIntro').viewing`);
  expect(`asked for, it offers SKIP (${again})`, again === 'again');
  await step(2400);
  await page.screenshot(`${out}/23-again-skip.png`);
  await press('KeyZ');
  await until(onTheMat, 'the great hall, skipped to');
  await step(400);
  expect('a key skips it to the mat of the great hall', await page.evaluate(onTheMat));
  await page.screenshot(`${out}/24-skipped-to-hall.png`);
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
