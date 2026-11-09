// Plays THE BATTLE ARENA's classes (the harbour arenas plan's H2b): a player
// in POKé BALL class with a run of three behind them walks into the dojo,
// finds BLACK BELT HIDEKI standing under the class board, reads the board,
// asks at the counter - his row lit and first - brings three and beats him on
// the real battle screen (tried again on a loss, the run seeded afresh, since
// a bout is dice), and comes back GREAT BALL class: 110 tickets, the board's
// second ball lit, MIKE under it, and GREAT BALL's regulars bringing their
// second stages. Then a loss to a regular, which ends a run and never a class.
//
//   node tools/playtest/dojoClasses.mjs <test-mode build url> <out-dir> [--port=N] [--window=1200x768]
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
  throw new Error('usage: dojoClasses.mjs <test-mode build url> <out-dir>');
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


  const seed = (dojo) =>
    page.evaluate(`(() => { const k = ${JSON.stringify(PLAYTEST_SAVE_KEY)}; const s = JSON.parse(localStorage.getItem(k));
      s.raidProgress.dojo = ${JSON.stringify(dojo)}; localStorage.setItem(k, JSON.stringify(s)); return true; })()`);
  const RUN = { wins: 3, losses: 0, beaten: ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes'], streak: ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes'] };
  const talkAtCounter = async () => {
    await walkTo([{ x: 5, y: 6 }]);
    await press('ArrowUp', 300);
    await press('Space', 600);
    await typed();
    for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) await press('Space', 500);
    await until(sceneIs('dojo-counter'), 'the counter');
    await step(600);
    // Since #477 the counter opens on HOW WILL YOU FIGHT?: the class's bouts are the first of its three.
    if (await page.evaluate(`Boolean(document.querySelector('.dojo-counter [data-mode="class"]'))`)) {
      await page.evaluate(`document.querySelector('.dojo-counter [data-mode="class"]').click()`);
      await step(400);
    }
  };
  const counter = () => page.evaluate(`${GAME}.scene.getScene('dojo-counter').counterState`);
  const fightWith = async (opponent, strongest) => {
    await page.evaluate(`document.querySelector('.dojo-counter [data-opponent=${JSON.stringify(opponent)}]').click()`);
    await step(400);
    const state = await counter();
    if (state.opponent !== opponent) return null;
    // Leave whoever was brought last time, and bring the three highest levels: copies at Lv 30 all the same.
    await page.evaluate(`(() => { for (const row of document.querySelectorAll('.dojo-counter [data-member].is-selected')) row.click(); })()`);
    await step(300);
    for (let guard = 0; guard < 12 && (await counter()).team.length < 3; guard += 1) {
      const rows = await page.evaluate(`[...document.querySelectorAll('.dojo-counter [data-member]:not(.is-selected):not([aria-disabled])')].map((r) => r.dataset.member)`);
      const pick = rows.find((id) => strongest.includes(id)) ?? rows[0];
      if (!pick) break;
      await page.evaluate(`document.querySelector('.dojo-counter [data-member=${JSON.stringify(pick)}]').click()`);
      await step(300);
    }
    await page.evaluate(`document.querySelector('.dojo-counter [data-fight]').click()`);
    await until(sceneIs('battle'), 'the bout');
    await step(1200);
    const bout = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return { dojo: s.exhibition?.dojo, name: s.trainer?.name, theirs: s.trainer.party.map((p) => p.base.id) }; })()`);
    for (let guard = 0; guard < 900 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
      await page.tap('Space', 0);
      await step(300);
    }
    await until(inRoom('battle-arena'), 'the dojo after the bout');
    await step(900);
    await typed();
    return bout;
  };

  const leaveRoom = async () => {
    await walkTo([{ x: 5, y: 13 }]);
    for (let guard = 0; guard < 10 && !(await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.room; })()`)); guard += 1) await press('ArrowDown', 500);
    await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.room; })()`, 'the promenade');
    await step(600);
  };

  await step(1500);
  await seed(RUN);
  const door = await base(`b.doors.find((each) => each.id === 'battle-arena')`);
  await walkTo(door.tiles, inRoom('battle-arena'));
  await until(inRoom('battle-arena'), 'the dojo');
  await step(800);
  const figures = await base(`[...b.figures.keys()]`);
  expect(`BLACK BELT HIDEKI stands in the dojo (${figures.join(', ')})`, figures.includes('belt:hideki'));
  await shot('00-hideki-under-the-class-board');
  await walkTo([{ x: 0, y: 2 }]);
  await press('ArrowUp', 300);
  await press('Space', 600);
  await typed();
  const boardSays = await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`);
  expect(`the class board says the class and the run (${String(boardSays).replace(/\s+/g, ' ')})`, /POKé BALL class/.test(String(boardSays)));
  await shot('01-the-class-board');
  for (let guard = 0; guard < 6 && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) await press('Space', 400);

  const strongest = await page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem(${JSON.stringify(PLAYTEST_SAVE_KEY)}));
    return (s.stash?.pokemon ?? []).slice().sort((a, b) => (b.level ?? 0) - (a.level ?? 0)).map((p) => p.id); })()`);
  let promoted = false;
  for (let attempt = 0; attempt < 4 && !promoted; attempt += 1) {
    await talkAtCounter();
    if (attempt === 0) {
      const head = await page.evaluate(`(() => { const r = document.querySelector('.dojo-counter [data-opponent="belt:hideki"]'); return r ? { lit: !r.hasAttribute('aria-disabled'), note: document.querySelector('.dojo-counter .px-heading')?.textContent ?? '' } : null; })()`);
      expect(`the counter offers HIDEKI after a run of three (${JSON.stringify(head)})`, head?.lit === true);
      await shot('02-hideki-will-see-you');
    }
    const bout = await fightWith('belt:hideki', strongest);
    expect(`the bout is against HIDEKI's team (${bout?.name}: ${bout?.theirs})`, bout?.dojo === 'belt:hideki');
    const dojo = (await raw()).raidProgress.dojo;
    promoted = dojo.classId === 'great-ball';
    if (!promoted) {
      console.log(`     lost to HIDEKI on try ${attempt + 1}; the run seeded again`);
      await seed({ ...dojo, streak: RUN.streak });
      await leaveRoom();
      await step(600);
      await walkTo(door.tiles, inRoom('battle-arena'));
      await step(600);
    }
  }
  const said = await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`);
  await shot('03-great-ball-class');
  const after = (await raw()).raidProgress;
  expect(`beating HIDEKI makes GREAT BALL class (${String(said).replace(/\s+/g, ' ')})`, after.dojo.classId === 'great-ball' && /GREAT BALL class now/.test(String(said)));
  expect(`the run is spent on the step up (${JSON.stringify(after.dojo.streak ?? [])})`, !after.dojo.streak);

  // Out and in again: the room is drawn for the new class.
  for (let guard = 0; guard < 6 && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) await press('Space', 400);
  await leaveRoom();
  await step(600);
  await walkTo(door.tiles, inRoom('battle-arena'));
  await step(800);
  const nowFigures = await base(`[...b.figures.keys()]`);
  expect(`MIKE stands under the board now (${nowFigures.filter((id) => id.startsWith('belt:')).join(', ')})`, nowFigures.includes('belt:mike') && !nowFigures.includes('belt:hideki'));
  await shot('04-mike-under-the-board');
  await talkAtCounter();
  const rows = await page.evaluate(`[...document.querySelectorAll('.dojo-counter [data-opponent^="bot:"] small')].map((s) => s.textContent)`);
  expect(`GREAT BALL's regulars bring second stages (${rows[0]})`, rows.length === 6 && rows.every((line) => !/\bBULBASAUR\b|\bCHARMANDER\b|\bSQUIRTLE\b/.test(line)));
  const mike = await page.evaluate(`document.querySelector('.dojo-counter [data-opponent="belt:mike"]')?.getAttribute('aria-disabled')`);
  expect(`MIKE waits for a run of three (${mike})`, mike === 'true');
  await shot('05-great-ball-counter');
  await page.tap('Escape', 0);
  await step(600);
  if (await page.evaluate(sceneIs('dojo-counter'))) {
    await page.tap('Escape', 0);
    await step(600);
  }
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s)`);
  process.exit(1);
}
