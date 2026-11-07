// THE RAID ARENA's polish, played as a player meets it.
//
//   node tools/playtest/raidArenaPolish.mjs <test-mode build url> <out-dir> [--window=1200x768] [--port=N]
//
// Two games. A new one, with a level-30 Pidgey beside the starter on the bench:
// the partner arrives beside the player at the yard's spawn and on the hall's
// mat, never on the tile below them where it is drawn over them; the bench, the
// rack and the locker are named at a glance from the mat (plates in the hall's
// own lettering, `scripts/draw-arena-hall.mts`); and the locker secures the
// starter ahead of the higher-level catch (`hub/secureAutofill.ts`). Then the
// explorer run, whose partner is a level-99 Charizard - the big follower that
// used to stand over the player on the mat. Exit code 1 is anything not where it
// should be; the pictures go in <out-dir>.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'raid-arena-polish-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const FRAME_MS = 100;
const address = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels`;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  const step = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 600; guard += 1) {
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
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const load = async () => {
    await page.send('Page.navigate', { url: address });
    await page.waitFor(sceneIs('title'), { what: 'the title' });
    await page.evaluate(`${GAME}.pauseLoop()`);
  };
  const ready = `(() => { const b = ${GAME}.scene.getScene('base'); return b?.sys.isActive() && b.ready && !b.leaving; })()`;

  /** Where the partner stands against the player: never a row below, where it is drawn over them. */
  const partnerBesideNotBelow = async (where) => {
    const at = await base(`({ player: { ...b.currentTile }, partner: b.partner?.standingTile() ?? null })`);
    console.log(`     ${where}: player ${JSON.stringify(at.player)}, partner ${JSON.stringify(at.partner)}`);
    expect(`${where}: the partner is out`, at.partner !== null);
    expect(
      `${where}: the partner is beside or ahead of the player, never on the tile below`,
      at.partner !== null && at.partner.y <= at.player.y && Math.abs(at.partner.x - at.player.x) + Math.abs(at.partner.y - at.player.y) === 1,
    );
  };

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
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'; })()`;
  const intoTheHall = async () => {
    for (let guard = 0; guard < 120 && !(await page.evaluate(inHall)); guard += 1) {
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
    await step(800);
  };

  // --- A new game, with a catch higher than the starter. ------------------------
  await load();
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)})`);
  await load();
  await press('Space');
  await until(sceneIs('base'), 'the harbour');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`, "Oak's table");
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.pokemon.push({ id: 'polish-pidgey', pokemon: { speciesId: 'pidgey', level: 30, currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } });
    if (Array.isArray(save.stash.boxes) && save.stash.boxes[0]) save.stash.boxes[0].pokemonIds.push('polish-pidgey');
    save.raidProgress.lastBench = save.stash.pokemon.map((stored) => stored.id);
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await load();
  await press('Space');
  await until(ready, 'the harbour, continued');
  await step(1500);
  await shot('1-yard-spawn');
  await partnerBesideNotBelow('the yard spawn');

  await intoTheHall();
  await shot('2-hall-mat');
  await partnerBesideNotBelow("the hall's mat");
  expect(
    'the three stations are named on plates over them (the hall art carries them)',
    await base(`b.arenaStations.map((s) => s.id).join() === 'bench,rack,locker'`),
  );
  const flow = await base(`({ party: b.kit.flow.party.map((s) => s.id), secured: b.kit.flow.securedPokemon.map((s) => s.id), partner: b.savedGame.stash.partnerId() })`);
  console.log(`     bench ${JSON.stringify(flow.party)}, locker ${JSON.stringify(flow.secured)}, partner ${flow.partner}`);
  expect('the Lv 30 Pidgey is on the bench beside the starter', flow.party.includes('polish-pidgey') && flow.party.includes(flow.partner));
  expect('the locker secures the starter, not the higher-level catch', flow.secured[0] === flow.partner);

  // From a step up the runner, the whole row of stations at a glance.
  for (let guard = 0; guard < 3; guard += 1) await press('ArrowUp');
  await step(400);
  await shot('3-stations-at-a-glance');

  // Walked up to, each station still says what it holds, and its caption keeps
  // clear of its plate rather than lying over it.
  for (const id of ['bench', 'rack', 'locker']) {
    const goal = await base(`(() => { const t = b.arenaStations.find((s) => s.id === ${JSON.stringify(id)}).tiles; const m = t[Math.floor(t.length / 2)]; return { x: m.x, y: m.y + 1 }; })()`);
    for (let guard = 0; guard < 60; guard += 1) {
      const key = await keyTowards([goal]);
      if (key === 'there') break;
      if (key) await press(key);
      await step(200);
    }
    await press('ArrowUp');
    await step(500);
    await shot(`3-${id}-up-close`);
  }

  // --- The explorer run: a level-99 Charizard at heel. ---------------------------
  // `?playtest` goes straight into the explorer run (`dev/playtestMode.ts`).
  await page.send('Page.navigate', { url: `${address}&playtest` });
  await page.waitFor(`${sceneIs("base")} || ${sceneIs("title")}`, { what: "the explorer run" });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await until(ready, 'the explorer harbour');
  await step(1500);
  await shot('4-explorer-yard');
  await partnerBesideNotBelow('the explorer yard');
  await intoTheHall();
  await shot('5-explorer-hall-mat');
  await partnerBesideNotBelow("the explorer hall's mat");
} finally {
  await browser.close();
}

if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s):\n- ${faults.join('\n- ')}`);
  process.exit(1);
}
console.log('\nall well');
