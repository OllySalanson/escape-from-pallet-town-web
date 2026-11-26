// Photographs THE BATTLE ARENA's cup of the week and daily rentals in Champion
// Red (`docs/screens/arena-bold/`): the explorer run walks into the arena with
// two cup bouts won this week, opens the cup's page, chooses three for it,
// then takes today's pair on loan and stands the cursor on a third rental.
//
//   node tools/playtest/arenaBold.mjs <test-mode build url> <out dir> [--window=WxH]
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !out) throw new Error('usage: arenaBold.mjs <test-mode build url> <out-dir>');
mkdirSync(out, { recursive: true });
const [width, height] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const FRAME_MS = 100;

const browser = await launchBrowser({ window: { width, height } });
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
  const shot = async (name) => {
    await step(300);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const click = async (selector, after = 400) => {
    const ok = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true; })()`);
    await step(after);
    return ok;
  };
  const inRoom = (id) => `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && b.room?.id === ${JSON.stringify(id)}; })()`;
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
      if (done && (await page.evaluate(done))) return;
      if (await base('Boolean(b.dialogBox?.visible)')) {
        await press('Space', 300);
        continue;
      }
      const key = await keyTowards(goals);
      if (key === 'there') return;
      if (key === null) {
        await step(100);
        continue;
      }
      await page.tap(key, 0);
      await step(170);
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) await step(100);
    }
    throw new Error(`never got to ${JSON.stringify(goals)}`);
  };

  // Two bouts of this week's cup won already.
  await page.evaluate(`(() => { const k = ${JSON.stringify(PLAYTEST_SAVE_KEY)}; const s = JSON.parse(localStorage.getItem(k));
    const now = new Date(); const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day);
    const week = date.getUTCFullYear() + '-W' + String(Math.ceil(((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0');
    s.raidProgress.dojo = { ...(s.raidProgress.dojo ?? {}), cup: { week, run: 2, best: 2, paid: 0 } };
    delete s.raidProgress.dojo.rental;
    const first = s.stash.pokemon[0];
    s.stash.pokemon.push({ ...first, id: 'dugtrio-cup', pokemon: { ...first.pokemon, speciesId: 'dugtrio', nickname: null, moves: [], pendingMoves: [] } });
    localStorage.setItem(k, JSON.stringify(s)); })()`);
  const door = await base(`b.doors.find((each) => each.id === 'battle-arena')`);
  await walkTo(door.tiles, inRoom('battle-arena'));
  await until(inRoom('battle-arena'), 'the arena');
  await step(800);
  await walkTo([{ x: 5, y: 6 }]);
  await press('ArrowUp', 300);
  await press('Space', 600);
  for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) await press('Space', 500);
  await until(sceneIs('dojo-counter'), 'the counter');
  await step(600);
  await shot('00-three-ways');

  await click('.dojo-counter [data-mode="cup"]');
  await shot('01-the-cup');
  await click('.dojo-counter [data-pick-team]');
  await page.evaluate(`(() => { for (const row of document.querySelectorAll('.dojo-counter [data-member].is-selected')) row.click(); })()`);
  await step(300);
  // The Ground type first, so the side keeps the cup's rule.
  await click('.dojo-counter [data-member="dugtrio-cup"]', 300);
  for (let guard = 0; guard < 12; guard += 1) {
    const team = await page.evaluate(`${GAME}.scene.getScene('dojo-counter').counterState.team.length`);
    if (team >= 3) break;
    if (!(await click('.dojo-counter [data-member]:not(.is-selected):not([aria-disabled])', 300))) break;
  }
  await shot('02-who-goes');
  await press('Escape', 400);
  await shot('03-the-cup-with-three');

  await press('KeyE', 400);
  // Before this change the cup's page had no tabs: the counter's first page is where RENTALS is.
  if (!(await page.evaluate(`Boolean(document.querySelector('.dojo-counter [data-rental]'))`))) await click('.dojo-counter [data-mode="rental"]');
  await shot('04-today-s-six');
  const six = await page.evaluate(`[...document.querySelectorAll('.dojo-counter [data-rental]')].map((r) => r.dataset.rental)`);
  for (const species of six.slice(0, 2)) await click(`.dojo-counter [data-rental="${species}"]`, 300);
  await page.evaluate(`document.querySelector('.dojo-counter [data-rental="${six[2]}"]')?.focus()`);
  await step(300);
  await shot('05-a-third-on-loan');

  // A run two wins in: the three on loan, and one of the team just beaten to swap in.
  await press('Escape', 300);
  await press('Escape', 300);
  await page.evaluate(`(() => { const k = ${JSON.stringify(PLAYTEST_SAVE_KEY)}; const s = JSON.parse(localStorage.getItem(k));
    const d = new Date(); const two = (v) => String(v).padStart(2, '0'); const day = d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
    s.raidProgress.dojo = { ...(s.raidProgress.dojo ?? {}), rental: { run: { day, team: ${JSON.stringify(['gastly', 'sandshrew', 'pikachu'])}, won: 2, scored: true, swapFrom: ['ponyta', 'cubone', 'growlithe'] }, scoredDay: day } };
    localStorage.setItem(k, JSON.stringify(s)); })()`);
  await step(600);
  await walkTo([{ x: 5, y: 6 }]);
  await press('ArrowUp', 300);
  await press('Space', 600);
  for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('dojo-counter'))); guard += 1) await press('Space', 500);
  await until(sceneIs('dojo-counter'), 'the counter again');
  await step(600);
  await click('.dojo-counter [data-mode="rental"]');
  await shot('06-a-run-two-wins-in');
  await click('.dojo-counter [data-theirs="ponyta"]');
  await shot('07-swap-ponyta-in');
} finally {
  await browser.close();
}
