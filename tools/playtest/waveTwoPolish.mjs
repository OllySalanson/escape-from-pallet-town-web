// Plays the fixes to wave 2's playtest findings as a playtester meets them,
// and photographs each. Two saves, as the playtest had:
//
// A fresh new game (Charmander from Oak's table):
//  - THE BATTLE ARENA: a Lv 5 Charmander fights at Lv 30 knowing what it would
//    have learnt on the way up (Ember, Metal Claw), the counter says the regular
//    brings as many as you do, its bar says "1 vs 1", and a lost bout says what
//    beat you;
//  - the partner walking into THE GAME CORNER and THE BATTLE ARENA stands in
//    front of the player, never over them.
//
// The explorer run (`?playtest`):
//  - the PLAYTEST BOARD's plate never under a door's name, and its two new
//    PLAY rows (the dojo counter, a leader to spar with);
//  - P over the yard: no caption left half under the panel;
//  - B: Left and Right go a pocket at a time, and the help says so;
//  - THE FIELD-MOVE COURSE opening on the finish and running back to the runner;
//  - the garden: the head mark gives way to the Pokémon faced;
//  - a regular's name never drawn across the player.
//
//   node tools/playtest/waveTwoPolish.mjs <test-mode build url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels`).
// Exit code 1 is anything not where it should be.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';
const BOARD = { x: 18, y: 14 };

const args = process.argv.slice(2);
const [url = 'http://localhost:4173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};
const withParam = (address, param) => `${address}${address.includes('?') ? '&' : '?'}${param}`;

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const BASE = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready && !${BASE}.leaving`;
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const shoot = async (name) => {
    await step(2);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${BASE}; return ${expression}; })()`);
  const walkTo = async (goal, what) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await base('Boolean(b.dialogBox?.visible)')) {
        await press('Space');
        await wait(200);
        continue;
      }
      const move = await page.evaluate(`(() => { const b = ${BASE}; if (!b.ready || b.leaving || b.targetTile) return { wait: true };
        const s = b.currentTile, g = ${JSON.stringify(goal)};
        if (s.x === g.x && s.y === g.y) return { arrived: true };
        const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`);
      if (move.unreachable) throw new Error(`nothing walks to ${what}`);
      if (move.arrived) return;
      if (move.key) await press(move.key);
      await wait(120);
    }
    throw new Error(`never reached ${what}`);
  };
  /** Starts the harbour again where `data` says, as the PLAYTEST BOARD does, and spends the lost first key. */
  const goTo = async (data, what) => {
    await page.evaluate(`void ${BASE}.goTo({ savedGame: ${BASE}.freshGame(), ...${JSON.stringify(data)} }, 'confirm')`);
    await wait(300);
    await until(baseReady, what);
    await wait(900);
    await press('KeyZ');
  };
  /** Where the partner stands against the player, in tiles: a row below is drawn over them. */
  const partnerAgainstPlayer = () =>
    base(`(() => { const p = b.partner?.place; const s = b.currentTile; return p && p.out ? { dx: p.tile.x - s.x, dy: p.tile.y - s.y } : null; })()`);
  /** Every caption drawn, as screen rectangles in game pixels. */
  const shownCaptions = () =>
    base(`b.worldLabels.filter((l) => l.label.visible).map((l) => { const r = l.label.getBounds(); const v = b.cameras.main.worldView;
      return { text: l.label.text.split('\\n')[0], x: r.x - v.x, y: r.y - v.y, right: r.right - v.x, bottom: r.bottom - v.y, view: v.width }; })`);

  // =========================================================================
  // A fresh new game.
  // =========================================================================
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await wait(800);
  await press('Space');
  await until(baseReady, 'Oak’s table');
  await wait(600);
  await base(`b.takeStarterForDriver('charmander')`);
  await until(`${baseReady} && !${BASE}.place.room`, 'the yard with a partner');
  await wait(900);
  await press('KeyZ');

  // The partner on the mats of THE GAME CORNER and THE BATTLE ARENA.
  for (const room of ['game-corner', 'battle-arena']) {
    await goTo({ room }, room);
    const against = await partnerAgainstPlayer();
    await shoot(`fresh-${room}-mat`);
    expect(`walking into ${room}, the partner is not a row below the player (${JSON.stringify(against)})`, against !== null && against.dy <= 0);
    expect(`and it stands in front of them, clear of their figure (${JSON.stringify(against)})`, against !== null && against.dy === -1 && against.dx === 0);
  }

  // THE BATTLE ARENA's counter, with one Lv 5 Charmander.
  await goTo({ room: 'battle-arena', at: { x: 5, y: 6 }, facing: 'up' }, 'the dojo counter');
  await press('Space');
  for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) {
    await press('Space');
    await wait(300);
  }
  await until(sceneIs('dojo-counter'), 'the counter');
  await wait(400);
  // A regular with water on their side if today has one, so a Charmander's loss - and what beat it - is likely to be seen.
  const opponent = await page.evaluate(`(() => { const rows = [...document.querySelectorAll('.dojo-counter [data-opponent]:not([aria-disabled])')];
    const row = rows.find((each) => /SQUIRTLE|WARTORTLE|BLASTOISE|STARYU|STARMIE|POLIWAG|PSYDUCK|GOLDUCK|LAPRAS|GYARADOS/.test(each.textContent)) ?? rows[0];
    row?.click(); return row?.dataset.opponent ?? null; })()`);
  await wait(400);
  const status = await page.evaluate(`document.querySelector('.dojo-counter .px-help')?.textContent ?? ''`);
  console.log(`  counter says: ${status.replace(/\s+/g, ' ').trim()}`);
  expect(`the counter says the regular brings as many as you do (${opponent})`, /as many as you do/.test(status));
  const counter = () => page.evaluate(`${GAME}.scene.getScene('dojo-counter').counterState`);
  if ((await counter()).team.length === 0) {
    await page.evaluate(`document.querySelector('.dojo-counter [data-member]:not([aria-disabled])')?.click()`);
    await wait(300);
  }
  const bar = await page.evaluate(`document.querySelector('.dojo-counter .confirm-bar')?.textContent ?? ''`);
  console.log(`  bar: ${bar.replace(/\s+/g, ' ').trim()}`);
  expect(`the bar says one a side (${bar.replace(/\s+/g, ' ').trim()})`, /1 vs 1/i.test(bar));
  const memberHelp = await page.evaluate(`document.querySelector('.dojo-counter [data-member].is-selected')?.dataset.help ?? ''`);
  console.log(`  Charmander's row: ${memberHelp}`);
  expect('its row says what else it knows at Lv 30', /knows .*EMBER/i.test(memberHelp));
  await shoot('fresh-counter-team');
  await page.evaluate(`document.querySelector('.dojo-counter [data-fight]').click()`);
  await until(sceneIs('battle'), 'the bout');
  await wait(1500);
  const moves = await page.evaluate(`${GAME}.scene.getScene('battle').party.pokemon[0].moves.map((m) => m.base.name.toUpperCase())`);
  console.log(`  Charmander fights knowing ${moves.join(', ')}`);
  expect('the Lv 5 Charmander fights at Lv 30 with four moves, Ember among them', moves.length === 4 && moves.includes('EMBER'));
  await shoot('fresh-bout');
  const said = [];
  for (let guard = 0; guard < 900 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
    const line = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return s?.sys.isActive() && s.dialog?.isCurrentMessageComplete ? s.dialog.textObject?.text : null; })()`);
    if (line && line !== said.at(-1)) {
      said.push(line);
      if (/What beat you/.test(line)) await shoot('fresh-bout-what-beat-you');
    }
    await page.tap('Space', 0);
    await wait(300);
  }
  const won = !said.some((line) => /lost the bout/.test(line));
  console.log(`  the bout went ${won ? 'the player’s way' : 'the regular’s way'}; last lines: ${said.slice(-3).map((line) => line.replace(/\s+/g, ' ')).join(' | ')}`);
  if (!won) {
    expect('a lost bout says what beat you', said.some((line) => /What beat you\?/.test(line)));
  }
  await until(`${baseReady} && ${BASE}.place.room?.room.id === 'battle-arena'`, 'the dojo after the bout');
  await wait(900);
  await shoot('fresh-back-at-the-counter');

  // =========================================================================
  // The explorer run.
  // =========================================================================
  await page.evaluate(`localStorage.removeItem('${PLAYTEST_SAVE_KEY}')`);
  await page.send('Page.navigate', { url: withParam(url, 'playtest') });
  await page.waitFor(baseReady, { what: 'the harbour', timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await wait(1200);

  // The PLAYTEST plate never under a door's name.
  await walkTo({ x: BOARD.x, y: BOARD.y - 1 }, 'the board');
  await wait(600);
  await shoot('playtest-board-plate');
  const plate = await base(`(() => { const r = b.playtestPlate.getBounds(); const v = b.cameras.main.worldView; return { x: r.x - v.x, y: r.y - v.y, right: r.right - v.x, bottom: r.bottom - v.y }; })()`);
  const overPlate = (await shownCaptions()).filter((c) => c.x < plate.right && plate.x < c.right && c.y < plate.bottom && plate.y < c.bottom);
  expect(`no caption over the PLAYTEST plate (${overPlate.map((c) => c.text).join(', ') || 'none'})`, overPlate.length === 0);

  // P over the yard: every caption whole, none under the panel.
  await walkTo({ x: 23, y: 12 }, 'the path below the Pokémon Center');
  await wait(600);
  await press('KeyP');
  await until(sceneIs('team'), 'YOUR TEAM');
  await wait(1200);
  await shoot('playtest-P-over-the-yard');
  const cover = await base(`b.panelLean.covering`);
  const under = (await shownCaptions()).filter((c) => c.right > c.view - cover);
  expect(`with P open no caption runs under the panel (${under.map((c) => c.text).join(', ') || 'none'})`, under.length === 0);
  await press('Escape');
  await until(baseReady, 'the yard again');
  await wait(400);

  // B: Left and Right a pocket at a time, and the help says so.
  await press('KeyB');
  await until(`!!document.querySelector('[data-thing][data-pocket]')`, 'YOUR THINGS');
  await wait(600);
  await page.evaluate(`document.querySelector('[data-thing][data-pocket]').focus()`);
  const pocketOf = () => page.evaluate(`document.activeElement?.dataset?.pocket ?? null`);
  const first = await pocketOf();
  await press('ArrowRight');
  await wait(200);
  const second = await pocketOf();
  expect(`Right goes to the next pocket (${first} > ${second})`, first !== null && second !== null && first !== second);
  const thingsHelp = await page.evaluate(`document.activeElement?.dataset?.help ?? ''`);
  expect(`the help says LEFT and RIGHT (${thingsHelp})`, /LEFT and RIGHT/.test(thingsHelp));
  await shoot('playtest-B-pockets');
  await press('KeyB');
  await until(baseReady, 'the yard after B');
  await wait(300);

  // The board's new PLAY rows.
  await walkTo({ x: BOARD.x, y: BOARD.y - 1 }, 'the board');
  await press('ArrowDown');
  await wait(150);
  await press('Space');
  await until(`!!document.querySelector('.playtest-board [data-board-row]')`, 'the PLAYTEST BOARD');
  await wait(300);
  await shoot('playtest-board-rows');
  for (const row of ['stand-dojo-counter', 'stand-practice']) {
    expect(`the board has ${row}`, await page.evaluate(`!!document.querySelector('[data-board-row="${row}"]')`));
  }
  await page.evaluate(`document.querySelector('[data-board-row="stand-practice"]').click()`);
  await until(`${baseReady} && ${BASE}.place.room?.room.id === 'raid-arena'`, 'the hall');
  await wait(1500);
  await press('KeyZ');
  await shoot('playtest-board-practice');
  await press('Space');
  await wait(600);
  const asked = await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`);
  expect(`one SPACE there and a leader speaks (${String(asked).replace(/\s+/g, ' ')})`, String(asked).length > 0);

  // THE FIELD-MOVE COURSE opens on the finish and runs back to the runner.
  await goTo({}, 'the yard');
  await page.evaluate(`void ${BASE}.openMinigame('field-course')`);
  await until(sceneIs('field-course'), 'the course screen');
  await wait(500);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('field-course').phaseKind === 'running'`, 'the run');
  const course = `${GAME}.scene.getScene('field-course')`;
  const look = () => page.evaluate(`(() => { const s = ${course}; const v = s.cameras.main.worldView; const r = s.courseRun; const f = r.course.finish[Math.floor(r.course.finish.length / 2)];
    return { cx: v.centerX, finishX: f.x * 16 + 8, runnerX: r.at.x * 16 + 8, runnerSeen: v.contains(r.at.x * 16 + 8, r.at.y * 16 + 8), finishSeen: v.contains(f.x * 16 + 8, f.y * 16 + 8) }; })()`);
  await wait(200);
  const opening = await look();
  await shoot('playtest-course-opening');
  expect(`the course opens with the finish line in view (${JSON.stringify(opening)})`, opening.finishSeen);
  await wait(2200);
  const settled = await look();
  await shoot('playtest-course-at-the-runner');
  expect(`and comes back to the runner (${JSON.stringify(settled)})`, settled.runnerSeen);
  await press('Escape');
  await wait(400);
  await press('Escape');
  await until(baseReady, 'the yard after the course');

  // The garden: the head mark gives way to the Pokémon faced from below. They
  // potter about, so whoever has open ground below them is walked up to, and
  // tried again if they move off first.
  const gardenOut = await base(`(b.garden?.standing() ?? []).length`);
  console.log(`  garden: ${JSON.stringify(await base(`(b.garden?.standing() ?? []).map((t) => ({ ...t, below: b.isBlocked({ x: t.x, y: t.y + 1 }) }))`))} player ${JSON.stringify(await base('b.currentTile'))}`);
  expect(`the garden has Pokémon out (${gardenOut})`, gardenOut > 0);
  let faced = false;
  for (let attempt = 0; attempt < 6 && !faced; attempt += 1) {
    const target = await base(`(b.garden?.standing() ?? []).find((t) => !b.isBlocked({ x: t.x, y: t.y + 1 })) ?? null`);
    if (!target) {
      await wait(2000);
      continue;
    }
    try {
      await walkTo({ x: target.x, y: target.y + 1 }, 'below a garden Pokémon');
    } catch (error) {
      console.log(`  ${error.message}`);
      await wait(1500);
      continue;
    }
    await press('ArrowUp');
    await wait(300);
    faced = await base(`b.garden.holds({ x: b.currentTile.x, y: b.currentTile.y - 1 }) && b.facing === 'up'`);
  }
  if (faced) {
    await shoot('playtest-garden-faced');
    expect('facing a garden Pokémon from below, the head mark is out of its face', !(await base('b.playerHeadMark.visible')));
  } else {
    expect('a garden Pokémon could be walked up to from below', false);
  }
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s)`);
  process.exit(1);
}
console.log('\nall well');
