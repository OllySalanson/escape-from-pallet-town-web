// Plays THE BATTLE ARENA's cup of the week and daily rental run (the harbour
// arenas plan's H3): the explorer walks into the dojo, reads THE CUP BOARD,
// asks at the counter and finds three ways to fight - CLASS BOUTS, this week's
// cup, RENTALS - fights a cup bout with a side that keeps the rule (copies at
// the cup's level, under its weather), then borrows three of today's six, wins
// or loses on the real battle screen, and - after a win - comes back to the
// counter open on the run, takes one of the beaten team in a swap and fights
// bout two. Then, on a run four wins in, START AGAIN with the same three must
// fight bout one of a new run, against the regular the page names. Every bout's
// result is read back out of the save.
//
//   node tools/playtest/arenaCups.mjs <test-mode build url> <out-dir> [--port=N] [--window=1200x768]
//
// Exit code 1 is anything not where it should be.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !out) {
  throw new Error('usage: arenaCups.mjs <test-mode build url> <out-dir>');
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
    expect(`got to ${JSON.stringify(goals)} (at ${JSON.stringify(await base('[b.currentTile, b.ready, b.leaving, Boolean(b.dialogBox?.visible)]'))})`, false);
    return false;
  };
  const typed = async () => {
    for (let guard = 0; guard < 60 && !(await base('Boolean(b.dialogBox?.isCurrentMessageComplete)')); guard += 1) await step(100);
  };


  const talkAtCounter = async () => {
    await walkTo([{ x: 5, y: 6 }]);
    await press('ArrowUp', 300);
    await press('Space', 600);
    await typed();
    for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) await press('Space', 500);
    await until(sceneIs('dojo-counter'), 'the counter');
    await step(600);
  };
  const counter = () => page.evaluate(`${GAME}.scene.getScene('dojo-counter').counterState`);
  const click = async (selector, after = 400) => {
    const ok = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true; })()`);
    await step(after);
    return ok;
  };
  const fightAndCome = async () => {
    await click('.dojo-counter [data-fight]', 200);
    await until(sceneIs('battle'), 'the bout');
    await step(1200);
    const bout = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return { run: s.exhibition?.run, weather: s.state?.weather?.id ?? null, ours: s.state ? [s.state.player.pokemon.base.id, s.state.player.pokemon.level] : null, theirs: s.trainer.party.map((p) => p.base.id), trainer: s.trainer.name }; })()`);
    await shot(`${bout.run?.mode ?? 'class'}-bout`);
    // Space throws the first move; every few turns the next one, so a Flash Fire or an immunity never stalls the bout.
    for (let guard = 0; guard < 900 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
      const choosing = await page.evaluate(`${GAME}.scene.getScene('battle').mode === 'moves'`);
      if (choosing && guard % 3 === 0) await page.tap(guard % 2 === 0 ? 'ArrowRight' : 'ArrowDown', 0);
      await page.tap('Space', 0);
      await step(300);
    }
    const where = await page.evaluate(`(() => { const g = ${GAME}; const b = g.scene.getScene('base'); const s = g.scene.getScene('battle');
      return { active: g.scene.getScenes(true).map((x) => x.sys.settings.key), room: b.room?.id ?? null, ready: b.ready, leaving: b.leaving, outcome: s.state?.outcome ?? null }; })()`);
    if (!(await page.evaluate(inRoom('battle-arena')))) console.log(`     after the bout: ${JSON.stringify(where)}`);
    await until(inRoom('battle-arena'), 'the dojo after the bout');
    await step(900);
    await typed();
    return bout;
  };

  await step(1500);
  // A dojo nobody has fought in: no cup or rental run from an earlier session.
  await page.evaluate(`(() => { const k = ${JSON.stringify(PLAYTEST_SAVE_KEY)}; const s = JSON.parse(localStorage.getItem(k));
    delete s.raidProgress.dojo; localStorage.setItem(k, JSON.stringify(s)); return true; })()`);
  const door = await base(`b.doors.find((each) => each.id === 'battle-arena')`);
  await walkTo(door.tiles, inRoom('battle-arena'));
  await until(inRoom('battle-arena'), 'the dojo');
  await step(800);

  // THE CUP BOARD, read from below it on the east of the back wall.
  await walkTo([{ x: 8, y: 2 }, { x: 9, y: 2 }, { x: 10, y: 2 }]);
  await press('ArrowUp', 300);
  await press('Space', 600);
  await typed();
  const boardSays = String(await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`));
  expect(`the cup board says this week's cup (${boardSays.replace(/\s+/g, ' ')})`, /This week: the [A-Z]+ CUP/.test(boardSays));
  await shot('00-the-cup-board');
  for (let guard = 0; guard < 6 && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) await press('Space', 400);

  // The counter: three ways to fight.
  await talkAtCounter();
  const modes = await page.evaluate(`[...document.querySelectorAll('.dojo-counter [data-mode]')].map((r) => r.dataset.mode)`);
  expect(`the counter offers class, cup and rentals (${modes})`, JSON.stringify(modes) === '["class","cup","rental"]');
  await shot('01-three-ways-to-fight');

  // A cup bout, with a side that keeps the rule.
  await click('.dojo-counter [data-mode="cup"]');
  await page.evaluate(`(() => { for (const row of document.querySelectorAll('.dojo-counter [data-member].is-selected')) row.click(); })()`);
  await step(300);
  for (let guard = 0; guard < 12 && (await counter()).team.length < 3; guard += 1) {
    if (!(await click('.dojo-counter [data-member]:not(.is-selected):not([aria-disabled])', 300))) break;
  }
  const refused = await page.evaluate(`document.querySelectorAll('.dojo-counter [data-member][aria-disabled]').length`);
  console.log(`     ${(await counter()).team.length} on the side; ${refused} rows refused by the rule or the clauses`);
  await shot('02-the-cup-team');
  const ready = await page.evaluate(`!document.querySelector('.dojo-counter [data-fight]')?.hasAttribute('aria-disabled')`);
  if (ready) {
    const before = (await raw()).raidProgress.dojo?.cup;
    const bout = await fightAndCome();
    expect(`the cup bout is fought at the cup's level (${JSON.stringify(bout)})`, bout.run?.mode === 'cup' && (bout.ours?.[1] === 30 || bout.ours?.[1] === 15));
    const cup = (await raw()).raidProgress.dojo?.cup;
    const said = String(await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`));
    expect(`the cup run is written down (${JSON.stringify(before)} -> ${JSON.stringify(cup)}): ${said.replace(/\s+/g, ' ')}`, Boolean(cup?.week));
    await shot('03-after-the-cup-bout');
    for (let guard = 0; guard < 8 && !(await page.evaluate(sceneIs('dojo-counter'))) && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) await press('Space', 400);
    if (await page.evaluate(sceneIs('dojo-counter'))) {
      expect('a cup win opens the counter on the next bout', (await counter()).mode === 'cup');
      await press('Escape', 300);
      await press('Escape', 300);
    }
    await step(600);
    await talkAtCounter();
  } else {
    expect('the explorer has a side that keeps this week’s rule', false);
  }

  // The rentals: three of today's six, then the run.
  await click('.dojo-counter [data-mode="rental"]');
  const six = await page.evaluate(`[...document.querySelectorAll('.dojo-counter [data-rental]')].map((r) => r.dataset.rental)`);
  expect(`six on loan today (${six})`, six.length === 6);
  for (const species of six.slice(0, 3)) await click(`.dojo-counter [data-rental="${species}"]`, 300);
  await shot('04-three-on-loan');
  let swapped = false;
  for (let bout = 1; bout <= 3; bout += 1) {
    const fought = await fightAndCome();
    expect(`rental bout ${bout} is on loan (${JSON.stringify(fought)})`, fought.run?.mode === 'rental' && fought.ours?.[1] === 30);
    const rental = (await raw()).raidProgress.dojo?.rental;
    const said = String(await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`));
    console.log(`     ${said.replace(/\s+/g, ' ')} ${JSON.stringify(rental)}`);
    expect(`the rental run is written down after bout ${bout}`, Boolean(rental?.scoredDay));
    if (!rental?.run) {
      await shot('05-run-over');
      break;
    }
    for (let guard = 0; guard < 8 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) await press('Space', 400);
    await until(sceneIs('dojo-counter'), 'the counter open on the run');
    await step(600);
    expect(`a win opens the counter on the rental run (${JSON.stringify(await counter())})`, (await counter()).mode === 'rental');
    if (!swapped) {
      await click('.dojo-counter [data-theirs]', 300);
      await click('.dojo-counter [data-yours]', 300);
      const team = (await counter()).rentalTeam;
      swapped = team.some((id) => !rental.run.team.includes(id));
      expect(`one of the beaten team swapped in (${rental.run.team} -> ${team})`, swapped);
      await shot('05-the-swap');
    }
  }

  // START AGAIN with the same three, on a run four wins in: bout one of a new run, against whoever the
  // page names, and not bout five of the old one (the arenas hunt, finding 2).
  for (let guard = 0; guard < 8 && !(await page.evaluate(sceneIs('dojo-counter'))) && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) await press('Space', 400);
  for (let guard = 0; guard < 4 && (await page.evaluate(sceneIs('dojo-counter'))); guard += 1) await press('Escape', 300);
  await step(600);
  await page.evaluate(`(() => { const k = ${JSON.stringify(PLAYTEST_SAVE_KEY)}; const s = JSON.parse(localStorage.getItem(k));
    const d = new Date(); const two = (v) => String(v).padStart(2, '0'); const day = d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
    s.raidProgress.dojo = { ...(s.raidProgress.dojo ?? {}), rental: { run: { day, team: ${JSON.stringify(six.slice(0, 3))}, won: 4, scored: true }, scoredDay: day } };
    localStorage.setItem(k, JSON.stringify(s)); return true; })()`);
  await talkAtCounter();
  await click('.dojo-counter [data-mode="rental"]');
  const atFour = /Bout (\d) of 7: (\S+) brings/.exec(await page.evaluate(`document.querySelector('.dojo-counter').innerText`));
  expect(`a run four wins in offers bout five (${atFour?.[0]})`, atFour?.[1] === '5');
  expect('START AGAIN is offered', await click('.dojo-counter [data-new-run]', 300));
  for (const species of six.slice(0, 3)) await click(`.dojo-counter [data-rental="${species}"]`, 300);
  const shows = /Bout (\d) of 7: (\S+) brings/.exec(await page.evaluate(`document.querySelector('.dojo-counter').innerText`));
  await shot('06-start-again-same-three');
  expect(`START AGAIN with the same three says bout one (${shows?.[0]})`, shows?.[1] === '1');
  const again = await fightAndCome();
  expect(`and fights bout one against ${shows?.[2]} (${again.trainer}, bout ${again.run?.bout})`, again.run?.bout === 1 && again.trainer === shows?.[2]);
  const after = (await raw()).raidProgress.dojo?.rental?.run;
  const saidAfter = String(await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`)).replace(/\s+/g, ' ');
  console.log(`     ${saidAfter} ${JSON.stringify(after)}`);
  expect(`and its result is a run of its own, not the old one's fifth (${JSON.stringify(after)})`, !after || after.won === 1);
  await shot('07-after-start-again');
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s)`);
  process.exitCode = 1;
}
