// Plays THE PROMENADE's three outdoor games end to end as a player meets
// them: a save that has been on a raid, with a team in the vault, walks east
// past THE GREEN to the DERBY board and races, down onto the beach to THE DIG
// and digs, and out along the pleasure pier to the FISHING DERBY board and
// fishes - each played by keys and by what the screen shows, as a person
// plays it. Every step is photographed.
//
//   node tools/playtest/outdoorGames.mjs <url> <out dir> [--team=suited|unsuited] [--port=<cdp port>]
//
// `suited` brings a Ponyta to race, a Diglett to dig and a Staryu to sit with
// on the pier (Illuminate); `unsuited` a Golem, a Psyduck and a Grimer
// (Stench), which can play and finish but not well. It steps a paused loop, so
// it wants a test-mode page (`?testmode=pixels` for pictures;
// `tools/playtest/README.md`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const teamKind = option('team') ?? 'suited';
const TEAMS = {
  suited: { racer: 'ponyta', digger: 'diglett', lead: 'staryu' },
  unsuited: { racer: 'golem', digger: 'psyduck', lead: 'grimer' },
};
const team = TEAMS[teamKind];
if (!team) throw new Error(`outdoorGames: no team '${teamKind}'`);
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`outdoorGames: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const results = {};
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const shoot = async (name) => {
    await step(2);
    await page.screenshot(`${out}/${teamKind}-${name}.png`);
    console.log(`  ${teamKind}-${name}.png`);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const first = save.stash.pokemon[0];
    for (const [index, species] of ${JSON.stringify(Object.values(team))}.entries()) {
      save.stash.pokemon.push({ ...first, id: species + '-' + (index + 7), pokemon: { ...first.pokemon, speciesId: species, level: 32, nickname: null, moves: [], pendingMoves: [] } });
    }
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour, continued');

  // A walk over the scene's own collision to a tile.
  const walkTo = async (goal, what) => {
    let held = 0;
    for (let guard = 0; guard < 600; guard += 1) {
      const move = await page.evaluate(`(() => { const b = ${base}; if (!b.ready || b.leaving || b.isWalking?.()) return { wait: true };
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
      if (move.unreachable) fail(`nothing walks to ${what}`);
      if (guard < 12 && option('trace')) console.log('trace', guard, JSON.stringify(move), JSON.stringify(await page.evaluate(`${base}.currentTile`)));
      if (move.arrived) return;
      if (move.key) {
        const from = await page.evaluate(`JSON.stringify(${base}.currentTile)`);
        await press(move.key);
        await wait(120);
        if ((await page.evaluate(`JSON.stringify(${base}.currentTile)`)) === from) {
          // Held for a step's worth (a step is 150 ms): held longer it walks
          // two, and the walk back undoes it.
          await page.keyDown(move.key);
          await step(4);
          await page.keyUp(move.key);
          if ((await page.evaluate(`JSON.stringify(${base}.currentTile)`)) === from) {
            // Somebody standing in the way (a regular, their partner): a step aside and on.
            held += 1;
            const aside = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][held % 4];
            await page.keyDown(aside);
            await step(4);
            await page.keyUp(aside);
          } else held = 0;
        }
      }
      await wait(120);
    }
    const why = await page.evaluate(`(() => { const b = ${base}; const keys = ['leaving','resting','namePrompt','knockScreen','favoursScreen','arenaPanel','telescope','fogLift','phrasePicker','knockPrompt','boxQuestion','fishing','decor','targetTile','inspecting','jump']; const o = { kbd: b.input?.keyboard?.enabled, inp: b.input?.enabled, sleeping: b.sys.isSleeping(), visible: b.sys.isVisible(), walk: JSON.stringify(b.walk ?? null), stepping: b.isWalking?.(), tile: b.currentTile, dialog: b.dialogBox?.visible, paused: ${GAME}.scene.isPaused('base'), active: ${GAME}.scene.getScenes(true).map((s) => s.scene.key) }; for (const k of keys) o[k] = Boolean(b[k]); return o; })()`);
    console.log('stuck', JSON.stringify(why));
    await page.screenshot(`${out}/stuck.png`);
    fail(`never reached ${what} (at ${JSON.stringify(await page.evaluate(`${base}.currentTile`))})`);
  };
  const tickets = async () => (await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`)).raidProgress.gameCorner;

  /** Faces a board and opens its game, then picks who plays and presses PLAY. */
  const openGame = async (scene, tile, facing, pick, label) => {
    await walkTo(tile, label);
    await press(facing);
    await wait(200);
    await shoot(`${scene}-01-board`);
    await press('Space');
    await until(sceneIs(scene), `the ${label} screen`);
    await wait(300);
    await shoot(`${scene}-02-who-plays`);
    await page.evaluate(`document.querySelector('[data-player-pick^="${pick}"]').click()`);
    await wait(200);
    await page.evaluate(`document.querySelector('[data-play]').click()`);
    await until(`${GAME}.scene.getScene('${scene}').isPlaying`, `the ${label} under way`);
  };
  const closeGame = async (scene, label) => {
    await until(`!${GAME}.scene.getScene('${scene}').isPlaying`, `the ${label} over`);
    await wait(300);
    await shoot(`${scene}-04-result`);
    results[scene] = (await tickets())?.day?.best?.[scene] ?? 0;
    console.log(`${label}: today's best ${results[scene]}, tickets ${(await tickets())?.tickets ?? 0}`);
    await press('Escape');
    await until(baseReady, 'the harbour again');
    await wait(200);
  };

  // --- THE PROMENADE DERBY --------------------------------------------------
  // Ridden as a person rides it: SPACE on the straights while the bar lasts,
  // off it into a corner, and the line the racer is built for at each fork.
  if (option('only') === 'dig') { await walkTo({ x: 66, y: 19 }, 'dig first'); }
  await openGame('derby', { x: 62, y: 12 }, 'ArrowUp', team.racer, 'DERBY');
  const derby = `${GAME}.scene.getScene('derby')`;
  let shotRace = false;
  for (let frame = 0; frame < 60 * 90; frame += 1) {
    const state = await page.evaluate(`(() => { const r = ${derby}.derbyRace; if (!r) return null; const me = r.runners[0];
      return { clock: r.clock, leg: me.leg, stamina: me.stamina, done: me.finishedMs !== null, swims: me.racer.types.includes('water'), flies: me.racer.types.includes('flying'), big: me.racer.squares === 9 }; })()`);
    if (!state || state.done) break;
    if (state.leg === 0) await page.evaluate(`${derby}.ride({ first: ${state.big ? "'wide'" : "'inside'"}, second: ${state.flies ? "'air'" : state.swims ? "'bay'" : "'pier'"} })`);
    // A tap on each straight stretch now and then, with breath in the bar.
    if (state.clock > 2400 && state.stamina > 200 && frame % 9 === 0 && (state.leg === 0 || state.leg === 2)) {
      await page.keyDown('Space');
      await step(1);
      await page.keyUp('Space');
    }
    if (!shotRace && state.clock > 6000) {
      shotRace = true;
      await page.screenshot(`${out}/${teamKind}-derby-03-racing.png`);
      console.log(`  ${teamKind}-derby-03-racing.png`);
    }
    await step(1);
  }
  await closeGame('derby', 'THE PROMENADE DERBY');

  // --- THE DIG -----------------------------------------------------------------
  // Dug by the pings, as a person digs: a square as far from the last HOT,
  // WARM or COLD as it says, and Keen Eye's glint first.
  await openGame('dig', { x: 66, y: 19 }, 'ArrowDown', team.digger, 'DIG');
  const dig = `${GAME}.scene.getScene('dig')`;
  let shotDig = false;
  for (let turn = 0; turn < 20; turn += 1) {
    const target = await page.evaluate(`(() => { const g = ${dig}.digGame; if (!g || g.over) return null;
      const dug = (x, y) => g.dug.some((d) => d.x === x && d.y === y && !d.caved);
      const want = g.ping && g.ping.ping !== 'found' ? ({ hot: 1, warm: 2, cold: 3 })[g.ping.ping] : null;
      let best = null, bestScore = -1e9;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { if (dug(x, y)) continue;
        let score = Math.random();
        if (g.glint && g.glint.x === x && g.glint.y === y) score += 100;
        if (want !== null) { const d = Math.abs(x - g.ping.x) + Math.abs(y - g.ping.y); score += want < 3 ? (d === want ? 10 : -3) : (d >= 3 ? 3 : -3); }
        else score += (x % 3 === 1 && y % 2 === 1) ? 2 : 0;
        if (score > bestScore) { bestScore = score; best = { x, y }; } }
      return best; })()`);
    if (!target) break;
    await page.evaluate(`${dig}.digSquare(${target.x}, ${target.y})`);
    await wait(250);
    if (!shotDig && turn === 4) {
      shotDig = true;
      await shoot('dig-03-digging');
    }
  }
  await wait(1600);
  await closeGame('dig', 'THE DIG');

  // --- THE FISHING DERBY -----------------------------------------------------
  // Fished as a person fishes: SPACE the moment the line is back out of the water.
  await openGame('fishing-derby', { x: 78, y: 29 }, 'ArrowLeft', team.lead, 'FISHING DERBY');
  const fishing = `${GAME}.scene.getScene('fishing-derby')`;
  let shotFish = false;
  for (let frame = 0; frame < 60 * 140; frame += 6) {
    if (!(await page.evaluate(`${fishing}.isPlaying`))) break;
    await page.evaluate(`${fishing}.castLine()`);
    await step(6);
    const caught = await page.evaluate(`${fishing}.derbyState?.catches ?? 0`);
    if (!shotFish && caught >= 2) {
      shotFish = true;
      await shoot('fishing-derby-03-fishing');
    }
  }
  await closeGame('fishing-derby', 'THE FISHING DERBY');
  console.log(JSON.stringify({ team: teamKind, results, tickets: (await tickets())?.tickets ?? 0 }));
} finally {
  await browser.close();
}
