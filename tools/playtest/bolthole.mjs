// Walks into THE BOLTHOLE - the player's own house in the harbour - and plays
// what a house promises: the door at the end of the keepers' row takes you in,
// the orange mat at the foot of the stairs takes you up and back down, the
// things in it answer when faced, the sign in the garden says whose house it
// is, and down off the mat is the step outside (`src/game/base/rooms.ts`).
//
//   node tools/playtest/bolthole.mjs <url> <out dir> [--built=all|none|id,..] [--beaten=bossId,..]
//     [--raids=mapId:deployed:extracted,..] [--starter=charmander] [--window=1200x768]
//
// `--beaten` fills the badge case and `--raids` the pennants, the raid log and
// the calendar, by writing the save before the house is walked into. Reads the
// badge case, the telly, the pennants, sleeps in the bed and plays the console
// until the fourth game is won. Photographs the yard, both floors and the
// sign's line on the way. It fails loudly - a thrown error, not a picture -
// when any promise is broken.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const builtOption = option('built') ?? 'none';
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
const RUNGS = ['radio-mast', 'beacon', 'secure-locker-1', 'secure-locker-2', 'recovery-bay-1', 'recovery-bay-2', 'quarantine-ward'];
const built = builtOption === 'all' ? RUNGS : builtOption === 'none' ? [] : builtOption.split(',');
const beaten = (option('beaten') ?? '').split(',').filter(Boolean);
const raidRecord = Object.fromEntries(
  (option('raids') ?? '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [mapId, deployed, extracted] = entry.split(':').map((part, index) => (index === 0 ? part : Number(part)));
      return [mapId, { deployed, extracted, wiped: deployed - extracted }];
    }),
);
mkdirSync(out, { recursive: true });

const BASE = `${GAME}.scene.getScene('base')`;
const state = () =>
  `(() => { const b = ${BASE}; const live = b && b.sys.isActive() && b.ready && !b.leaving;
    return { live: !!live, room: live && b.room ? b.room.id : null, tile: live ? b.currentTile : null,
      facing: live ? b.facing : null, hint: live ? b.hintShown : null,
      dialog: live && b.dialogBox.visible ? b.dialogBox.textObject.text : null,
      complete: live && b.dialogBox.visible ? b.dialogBox.isCurrentMessageComplete : false }; })()`;

/**
 * The first step of the shortest walk to any of `goals`, over the scene's own
 * collision - asked only while the player is standing still, or a press made
 * mid-step is read against the tile they are leaving and walks them one too far.
 */
const firstStep = (goals) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const goals = ${JSON.stringify(goals)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
  if (at(s.x, s.y)) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || (!at(nx, ny) && b.isBlocked({ x: nx, y: ny }))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  /** Walks to one of `goals` and stops there - or, for a door or a stair, wherever it took you. */
  const walkTo = async (goals, done = async () => false) => {
    for (let guard = 0; guard < 120; guard += 1) {
      if (await done()) return;
      const key = await page.evaluate(firstStep(goals));
      if (key === 'here') return;
      if (key === 'unreachable') {
        const now = await page.evaluate(state());
        throw new Error(`nothing reaches ${JSON.stringify(goals)} from ${JSON.stringify(now)}`);
      }
      if (key) await press(key);
      else await sleep(150);
    }
    throw new Error(`gave up walking to ${JSON.stringify(goals)}`);
  };
  const settle = async (what, test) => {
    await page.waitFor(`(() => { const s = ${state()}; return s.live && (${test}); })()`, { what });
    await sleep(350);
    return page.evaluate(state());
  };
  /**
   * Faces `direction` from where the player stands, presses the key, and
   * returns every box that was said, each read whole before it is moved on.
   */
  const read = async (direction, { shot } = {}) => {
    await press(direction);
    await press('Space');
    const said = [];
    for (let guard = 0; guard < 60; guard += 1) {
      const now = await page.evaluate(state());
      if (now.dialog !== null && now.complete) break;
      await sleep(150);
    }
    if (shot) await page.screenshot(shot);
    // Long enough for the badge case's twelve boxes typed out at forty letters a second.
    for (let guard = 0; guard < 400; guard += 1) {
      const now = await page.evaluate(state());
      if (now.dialog === null) break;
      if (now.complete) {
        if (said.at(-1) !== now.dialog) said.push(now.dialog);
        await press('Space');
      } else {
        await sleep(150);
      }
    }
    return said;
  };

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  const starter = option('starter');
  if (starter) {
    await page.waitFor(`(() => { const b = document.querySelector('button[data-starter=${JSON.stringify(starter)}]'); if (!b) return false; b.click(); return true; })()`);
    await sleep(300);
  }
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  if (built.length > 0 || beaten.length > 0 || Object.keys(raidRecord).length > 0) {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      save.raidProgress.workshopUpgrades = ${JSON.stringify(built)};
      save.raidProgress.defeatedBosses = ${JSON.stringify(beaten)};
      save.raidProgress.raidRecord = ${JSON.stringify(raidRecord)};
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
    await page.waitFor(sceneIs('title'));
    await press('Space');
    await page.waitFor(sceneIs('base'));
  }
  await settle('the yard', 's.room === null');
  await page.screenshot(`${out}/yard.png`);

  // The house's own sign, in its garden.
  const door = await page.evaluate(`${BASE}.doors.find((d) => d.id === 'bolthole')`);
  if (!door) throw new Error('the base has no door called bolthole');
  await walkTo([{ x: door.returnTo.x, y: door.returnTo.y + 1 }]);
  const sign = (await read('ArrowRight')).join(' / ');
  if (!sign.startsWith('THE BOLTHOLE')) throw new Error(`the garden sign says "${sign}"`);
  console.log(`sign: ${sign}`);
  await page.screenshot(`${out}/garden.png`);

  // In through the door.
  await walkTo(door.tiles, async () => (await page.evaluate(state())).room === 'bolthole');
  const inside = await settle('inside THE BOLTHOLE', "s.room === 'bolthole'");
  if (inside.hint !== '[DOWN] OUT') throw new Error(`the house's mat says "${inside.hint}"`);
  await page.screenshot(`${out}/downstairs.png`);
  console.log(`downstairs: in on ${inside.tile.x},${inside.tile.y} (hint: ${inside.hint})`);

  // The badge case, read from the floor under it.
  const badgeCase = await page.evaluate(`${BASE}.place.room.posters.find((p) => p.kind === 'badge-case').area`);
  await walkTo([{ x: badgeCase.x + 1, y: badgeCase.y + badgeCase.height }]);
  const badges = await read('ArrowUp', { shot: `${out}/badge-case.png` });
  if (!badges[0]?.startsWith('THE BADGE CASE')) throw new Error(`the badge case says "${badges[0]}"`);
  if (badges.length !== beaten.length + 1 && beaten.length > 0) {
    throw new Error(`the badge case read ${badges.length - 1} badges for ${beaten.length} keepers beaten`);
  }
  console.log(`badge case: ${badges.join(' / ')}`);

  // The house is dressed for the month on the player's own clock.
  const month = await page.evaluate('new Date().getMonth()');
  const names = await page.evaluate(`${BASE}.place.room.things.map((t) => t.name)`);
  if (month === 9 && !names.includes('A PUMPKIN')) throw new Error('it is October and there is no pumpkin by the door');
  if (month === 11 && !names.includes('THE TREE')) throw new Error('it is December and there is no tree in the corner');
  const windowTile = await page.evaluate(`${BASE}.place.room.things.find((t) => t.name === 'THE WINDOW').tiles[0]`);
  await walkTo([{ x: windowTile.x, y: windowTile.y + 1 }]);
  console.log(`window: ${(await read('ArrowUp')).join(' / ')}`);

  const telly = await page.evaluate(`${BASE}.place.room.things.find((t) => t.name === 'THE TELLY').tiles[0]`);
  await walkTo([{ x: telly.x, y: telly.y + 1 }]);
  const forecast = await read('ArrowUp');
  if (!forecast[0]?.startsWith('KANTO TONIGHT')) throw new Error(`the telly says "${forecast[0]}"`);
  console.log(`telly: ${forecast.join(' / ')}`);

  // Up the stairs: step onto the orange mat.
  const up = await page.evaluate(`${BASE}.room.stairs[0]`);
  await walkTo([up.tile], async () => (await page.evaluate(state())).room === 'bolthole-upstairs');
  const upstairs = await settle('upstairs', "s.room === 'bolthole-upstairs'");
  const down = await page.evaluate(`${BASE}.room.stairs[0]`);
  if (upstairs.tile.x !== down.tile.x || upstairs.tile.y !== down.tile.y || upstairs.facing !== 'down') {
    throw new Error(`climbing put the player on ${JSON.stringify(upstairs.tile)} facing ${upstairs.facing}`);
  }
  await page.screenshot(`${out}/upstairs.png`);
  console.log(`upstairs: arrived on the stair mat ${upstairs.tile.x},${upstairs.tile.y} facing down`);

  const heard = {};
  for (const name of ['PENNANTS', 'YOUR BED', 'YOUR PC', 'THE CONSOLE', 'THE CONSOLE', 'THE CONSOLE', 'THE CONSOLE', 'THE CALENDAR']) {
    const tiles = await page.evaluate(`${BASE}.place.room.things.find((t) => t.name === ${JSON.stringify(name)}).tiles`);
    const stands = [];
    for (const tile of tiles) {
      for (const [dx, dy, key] of [[0, 1, 'ArrowUp'], [1, 0, 'ArrowLeft'], [-1, 0, 'ArrowRight'], [0, -1, 'ArrowDown']]) {
        stands.push({ x: tile.x + dx, y: tile.y + dy, key });
      }
    }
    const open = [];
    for (const stand of stands) {
      if (!(await page.evaluate(`${BASE}.isBlocked(${JSON.stringify({ x: stand.x, y: stand.y })})`))) open.push(stand);
    }
    await walkTo(open);
    const here = (await page.evaluate(state())).tile;
    const stand = open.find((each) => each.x === here.x && each.y === here.y);
    const lines = await read(stand.key, name === 'YOUR BED' ? { shot: `${out}/bed.png` } : {});
    heard[name] = [...(heard[name] ?? []), lines.join(' / ')];
    console.log(`${name}: ${lines.join(' / ')}`);
  }
  if (!heard['PENNANTS'][0].startsWith('PENNANTS')) throw new Error(`the pennants say "${heard['PENNANTS'][0]}"`);
  if (!heard['YOUR BED'][0].includes('NURSE JOY')) throw new Error('the bed did not send the player to Joy for healing');
  if (!heard['THE CONSOLE'][3].includes('finally beat')) throw new Error(`the fourth game says "${heard['THE CONSOLE'][3]}"`);
  await page.screenshot(`${out}/upstairs-read.png`);

  // Off the mat and back on is the way down.
  await walkTo([{ x: down.tile.x, y: down.tile.y + 1 }]);
  await walkTo([down.tile], async () => (await page.evaluate(state())).room === 'bolthole');
  const back = await settle('back downstairs', "s.room === 'bolthole'");
  if (back.tile.x !== up.tile.x || back.tile.y !== up.tile.y) {
    throw new Error(`coming down put the player on ${JSON.stringify(back.tile)}, not the stair mat`);
  }
  console.log(`downstairs again on the stair mat ${back.tile.x},${back.tile.y}`);

  // And down off the door mat is the step outside.
  const mat = await page.evaluate(`${BASE}.room.mat`);
  await walkTo([mat]);
  await press('ArrowDown');
  const outside = await settle('out in the yard', 's.room === null');
  if (outside.tile.x !== door.returnTo.x || outside.tile.y !== door.returnTo.y) {
    throw new Error(`leaving put the player on ${JSON.stringify(outside.tile)}, not the step`);
  }
  await page.screenshot(`${out}/outside.png`);
  console.log(`out on the step ${outside.tile.x},${outside.tile.y}`);
} finally {
  await browser.close();
}
