// Plays THE BATTLE ARENA (the harbour arenas plan's H2a) as a player meets it:
// from the explorer run's spawn along THE PROMENADE to the dojo with BATTLE
// ARENA on its board, in through its door, up the tatami to the counter, CLASS
// BOUTS taken from its three ways to fight, a regular chosen and a team of three from the boxes, then the bout itself on
// the real battle screen - every Pokémon on both sides at Lv 30, no bag, the
// regular on the gym AI - and back to the counter, where the one thing the
// save gains is the dojo's record, and the tickets a win pays.
//
//   node tools/playtest/battleArena.mjs <test-mode build url> <out-dir> [--port=N] [--window=1200x768] [--said]
//
// It runs in the explorer run (`?playtest`), whose boxes hold plenty to choose
// from. Exit code 1 is anything not where it should be.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !out) {
  throw new Error('usage: battleArena.mjs <test-mode build url> <out-dir>');
}
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const FRAME_MS = 100;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const join = url.includes('?') ? '&' : '?';
  const page = await browser.openPage(`${url}${join}testmode=pixels&playtest`);
  await page.waitFor(sceneIs('base'), { what: 'the explorer run in the harbour', timeoutMs: 60_000 });
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
  const raw = () => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PLAYTEST_SAVE_KEY)}))`);
  const inRoom = (id) => `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && b.room?.id === ${JSON.stringify(id)}; })()`;

  /** The first key of the shortest walk to any of `goals` over the scene's own collision. */
  const keyTowards = (goals) =>
    page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving) return null;
      const goals = ${JSON.stringify(goals)};
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
  const walkTo = async (goals, done = null) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (done && (await page.evaluate(done))) return true;
      if (await base('Boolean(b.dialogBox?.visible)')) {
        await press('Space', 300);
        continue;
      }
      const key = await keyTowards(goals);
      if (key === 'there') return true;
      if (key === null) {
        await step(100);
        continue;
      }
      await page.tap(key, 0);
      await step(170);
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) await step(100);
    }
    expect(`got to ${JSON.stringify(goals)}`, false);
    return false;
  };
  const typed = async () => {
    for (let guard = 0; guard < 60 && !(await base('Boolean(b.dialogBox?.isCurrentMessageComplete)')); guard += 1) await step(100);
  };

  await step(1500);
  // --- along the promenade to the dojo ------------------------------------------
  const door = await base(`b.doors.find((each) => each.id === 'battle-arena')`);
  expect('THE BATTLE ARENA has a door in the harbour', Boolean(door));
  await walkTo([{ x: door.tiles[0].x, y: door.tiles[0].y + 2 }]);
  await press('ArrowUp', 300);
  await step(600);
  await shot('00-the-dojo-on-the-promenade');
  await walkTo(door.tiles, inRoom('battle-arena'));
  await until(inRoom('battle-arena'), 'the dojo');
  await step(800);
  await shot('01-inside-the-dojo');
  const fighters = await base(`b.room ? [...b.figures.keys()] : []`);
  expect(`the day's regulars stand in the lines (${fighters.join(', ')})`, fighters.filter((id) => id.startsWith('bot:')).length === 6);

  // --- the counter ----------------------------------------------------------------
  const before = await raw();
  await walkTo([{ x: 5, y: 6 }]);
  await press('ArrowUp', 300);
  await press('Space', 600);
  await typed();
  await shot('02-reception');
  for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) {
    await press('Space', 500);
  }
  await until(sceneIs('dojo-counter'), 'the counter');
  await step(600);
  await shot('03-who-will-you-fight');
  const counter = () => page.evaluate(`${GAME}.scene.getScene('dojo-counter').counterState`);
  // The counter opens on its three ways to fight (#477), the cursor on CLASS
  // BOUTS: ENTER takes that, and the next ENTER the regular it lands on.
  await press('Enter', 600);
  expect(`ENTER at the counter takes CLASS BOUTS (${(await counter()).mode})`, (await counter()).mode === 'class');
  await press('Enter', 600);
  let state = await counter();
  expect(`a regular is chosen (${state.opponent})`, Boolean(state.opponent));
  // Fill the side to three from the boxes, top row down, as a player would.
  for (let guard = 0; guard < 12 && (await counter()).team.length < 3; guard += 1) {
    const next = await page.evaluate(`(() => { const row = [...document.querySelectorAll('.dojo-counter [data-member]:not(.is-selected):not([aria-disabled])')][0]; if (!row) return null; row.click(); return row.dataset.member; })()`);
    if (!next) break;
    await step(300);
  }
  state = await counter();
  expect(`three on the side (${state.team.join(', ')})`, state.team.length === 3);
  await shot('04-your-three');
  await page.evaluate(`document.querySelector('.dojo-counter [data-fight]').click()`);
  await until(sceneIs('battle'), 'the bout');
  await step(1500);

  // --- the bout ---------------------------------------------------------------------
  const bout = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle');
    return { dojo: s.exhibition?.dojo ?? null, run: Boolean(s.runSession), ai: s.trainer?.ai ?? null,
      theirs: s.trainer.party.map((p) => p.level), ours: s.party.pokemon.map((p) => p.level), bag: s.bag.toJSON() }; })()`);
  expect(`a dojo bout on the real battle screen with no raid on it (${bout.dojo})`, bout.dojo === state.opponent && !bout.run);
  expect(`the regular plays the gym AI (${bout.ai})`, bout.ai === 'gym');
  expect(`everybody is Lv 30 (${bout.ours} vs ${bout.theirs})`, [...bout.ours, ...bout.theirs].every((level) => level === 30) && bout.theirs.length === bout.ours.length);
  expect(`no bag (${JSON.stringify(bout.bag)})`, Object.keys(bout.bag).length === 0);
  let fightShot = false;
  let lastSaid = null;
  for (let guard = 0; guard < 900 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
    const said = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return s?.sys.isActive() && s.dialog?.isCurrentMessageComplete ? s.dialog.textObject?.text : null; })()`);
    if (said && said !== lastSaid && args.includes('--said')) {
      lastSaid = said;
      console.log(`battle says: ${said.replace(/\s+/g, ' ')}`);
    }
    if (said && !fightShot && /used/.test(said)) {
      fightShot = true;
      await shot('05-the-bout');
    }
    await page.tap('Space', 0);
    await step(300);
  }
  await until(inRoom('battle-arena'), 'the dojo after the bout');
  await step(900);
  await typed();
  await shot('06-back-at-the-counter');
  const after = await raw();
  const said = await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`);
  expect(`the receptionist says how it went (${String(said).replace(/\s+/g, ' ')})`, /beat|took that one/.test(String(said)));
  const record = after.raidProgress.dojo;
  const held = before.raidProgress.dojo ?? { wins: 0, losses: 0 };
  expect(`a win pays its tickets, a loss none (${before.raidProgress.gameCorner?.tickets ?? 0} -> ${after.raidProgress.gameCorner?.tickets ?? 0})`, (after.raidProgress.gameCorner?.tickets ?? 0) - (before.raidProgress.gameCorner?.tickets ?? 0) === (record.wins > held.wins ? 10 : 0));
  expect(`the save keeps the result (${JSON.stringify(record)})`, record && record.wins + record.losses === held.wins + held.losses + 1);
  const differs = Object.keys({ ...before, ...after }).flatMap((key) =>
    key === 'raidProgress'
      ? Object.keys({ ...before.raidProgress, ...after.raidProgress }).filter(
          (inner) => inner !== 'dojo' && inner !== 'gameCorner' && JSON.stringify(before.raidProgress[inner]) !== JSON.stringify(after.raidProgress[inner]),
        ).map((inner) => `raidProgress.${inner}`)
      : JSON.stringify(before[key]) !== JSON.stringify(after[key]) ? [key] : [],
  );
  expect(`and nothing else: the vault and everything in it are as they were (${differs.join(', ') || 'no other change'})`, differs.length === 0);
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s)`);
  process.exit(1);
}
