// Plays THE PRIZE WINDOW grown (the harbour arenas plan's H5) as a player meets
// it: a new game earns its tickets at the POKéMON JUMP cabinet, then - standing
// in for a few weeks of play, since the cabinets pay at most 285 a day - the
// save is handed the tickets those weeks would have paid. At the window it buys
// a rumour from THE RUMOUR MILL, DRATINI, a SMOKE BALL, a POKé FLUTE and
// TM18 Rain Dance, is refused a second Rain Dance in the same week, and finds
// DRATINI on YOUR TEAM. Then it gives the SMOKE BALL to its lead, packs the
// flute, goes on a raid, plays the flute from the pack, walks into tall grass
// and runs from the first wild POKéMON it meets on the SMOKE BALL.
//
//   node tools/playtest/prizeWindow.mjs <url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
/** The tickets a few weeks of the cabinets would have paid, at the daily ceiling. */
const WEEKS_OF_PLAY = 9000;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`prizeWindow: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
let page;
try {
  page = await browser.openPage('about:blank');
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
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const save = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const editSave = async (body) => {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); ${body}; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url });
    await page.waitFor(sceneIs('title'));
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(baseReady, 'the harbour, continued');
  };
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  // A save that has been on a raid, with three FAST jumpers beside the partner.
  await editSave(`const first = save.stash.pokemon[0];
    for (const [index, species] of ['rattata', 'mankey', 'growlithe'].entries()) {
      save.stash.pokemon.push({ ...first, id: species + '-' + (index + 7), pokemon: { ...first.pokemon, speciesId: species, nickname: null, moves: [], pendingMoves: [] } });
    }
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };`);

  // Tickets earned at the cabinet, by the screen, as a person plays it.
  await walkIntoBase(page, 'game-corner', { press, until, wait, settleMs: 150 });
  await until(sceneIs('game-corner'), 'the POKéMON JUMP cabinet');
  await wait(300);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'playing'`, 'the vine');
  for (let frame = 0; frame < 60 * 120; frame += 1) {
    const state = await page.evaluate(`(() => { const j = ${GAME}.scene.getScene('game-corner').jumpGame; return j ? { over: j.over, state: j.vineState, timer: j.vineTimer, speed: j.vineSpeed, score: j.score, grounded: j.jumpers.every((p) => p.jumpStart === null) } : null; })()`);
    if (!state || state.over || state.score >= 6600) break;
    const toHit = (0x5ff - state.timer) / Math.max(1, state.speed);
    if (state.grounded && state.state >= 4 && state.state <= 5 && toHit < 9) {
      await page.keyDown('Space');
      await step(1);
      await page.keyUp('Space');
      continue;
    }
    await step(1);
  }
  for (let rest = 0; rest < 600; rest += 1) {
    await step(1);
    if (await page.evaluate(`${GAME}.scene.getScene('game-corner').phaseKind === 'menu'`)) break;
  }
  await until(`${GAME}.scene.getScene('game-corner').phaseKind === 'menu'`, 'the result');
  await wait(300);
  await shoot('01-jump-paid');
  const earned = (await save()).raidProgress.gameCorner.tickets;
  console.log(`earned at the cabinet: ${earned} tickets`);
  if (earned <= 0) fail('the cabinet paid nothing');
  await press('Escape');
  await until(baseReady, 'the arcade again');

  // A few weeks of the cabinets, at the daily ceiling.
  // The window reads the save as it opens, so this needs no reload.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); save.raidProgress.gameCorner.tickets += ${WEEKS_OF_PLAY}; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await walkIntoBase(page, 'prize-window', { press, until, wait, settleMs: 150 });
  await until(sceneIs('game-corner'), 'the prize window');
  await wait(600);
  await shoot('02-prize-window');
  const scrollTo = async (id) => {
    await page.evaluate(`document.querySelector('[data-prize="${id}"]')?.scrollIntoView({ block: 'center' }); document.querySelector('[data-prize="${id}"]')?.focus()`);
    await wait(100);
  };
  const buy = async (id, shot) => {
    await scrollTo(id);
    const before = (await save()).raidProgress.gameCorner.tickets;
    await page.evaluate(`document.querySelector('[data-prize="${id}"]').click()`);
    await wait(200);
    await scrollTo(id);
    if (shot) await shoot(shot);
    const after = (await save()).raidProgress.gameCorner.tickets;
    console.log(`  ${id}: ${before} -> ${after} tickets; status: ${await page.evaluate(`document.querySelector('.px-status-line')?.textContent ?? ''`)}`);
    return before - after;
  };
  if ((await buy('rumour', '03-rumour-mill')) !== 50) fail('the rumour did not cost 50');
  const heard = (await save()).raidProgress.rumoursHeard ?? [];
  console.log(`  rumours heard: ${heard.join(', ')}`);
  if (!heard.some((id) => id.startsWith('mill-'))) fail('the mill sold none of its own slips');
  if ((await buy('dratini', '04-dratini')) !== 2500) fail('DRATINI did not cost 2,500');
  if ((await buy('smoke-ball')) !== 600) fail('the SMOKE BALL did not cost 600');
  if ((await buy('poke-flute')) !== 800) fail('the POKé FLUTE did not cost 800');
  if ((await buy('tm18-rain-dance', '05-raid-shelf')) !== 600) fail('TM18 did not cost 600');
  if ((await buy('tm18-rain-dance', '06-one-a-week')) !== 0) fail('a second TM18 was sold in one week');
  if ((await buy('smoke-ball')) !== 0) fail('a second SMOKE BALL was sold while one is held');
  await scrollTo('smoke-ball');
  await shoot('07-one-at-a-time');
  const vault = (await save()).stash;
  console.log(`  vault: smoke-ball ${vault.items['smoke-ball']}, poke-flute ${vault.items['poke-flute']}, tm18 ${vault.items['tm18-rain-dance']}; dratini ${vault.pokemon.some((p) => p.pokemon.speciesId === 'dratini')}`);
  await press('Escape');
  await until(baseReady, 'the prize room');

  // DRATINI on YOUR TEAM, from anywhere in the harbour.
  await press('KeyP');
  await until(sceneIs('team'), 'YOUR TEAM');
  await wait(300);
  await page.evaluate(`[...document.querySelectorAll('button')].find((b) => /DRATINI/i.test(b.textContent))?.focus()`);
  await wait(200);
  await shoot('08-dratini-in-a-box');
  await press('Escape');
  await until(baseReady, 'the harbour after the team');

  // The SMOKE BALL given to the lead (the gear slot is the team screen's, and
  // older than this change), then a raid with the flute packed.
  await editSave(`const lead = save.stash.pokemon[0]; lead.pokemon.heldItemId = 'smoke-ball'; save.stash.items['smoke-ball'] -= 1; if (save.stash.items['smoke-ball'] <= 0) delete save.stash.items['smoke-ball'];`);
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  await until(takePokemon('Charmander'), 'Charmander on the bench');
  await openHallPanel(page, 'rack', { press, until, wait });
  await until(
    `(() => { const b = document.querySelector('button[data-count-kind="item"][data-count-id="poke-flute"][data-count-dir="1"]'); if (!b || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`,
    'the rack to pack the flute',
  );
  await wait(200);
  await shoot('09-flute-packed');
  await jumpIn(page, { press, until, wait });
  for (let line = 0; line < 20 && (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`)); line += 1) {
    await press('Space');
    await wait(200);
  }
  await press('KeyB');
  await until(sceneIs('bag'), 'the raid pack');
  await wait(300);
  await page.evaluate(`document.querySelector('[data-item="poke-flute"]')?.focus()`);
  await wait(100);
  await page.evaluate(`document.querySelector('[data-item="poke-flute"]').click()`);
  await wait(300);
  await shoot('10-catchy-tune');
  await press('Escape');
  await until(`!${sceneIs('bag')}`, 'the raid again');
  await wait(300);

  // Into the nearest tall grass, back and forth until something jumps out.
  const towardGrass = `(() => { const w = ${GAME}.scene.getScene('world'); if (!w.sys.isActive() || w.targetTile || w.dialogBox.visible || w.cutscene) return { wait: true };
    const map = w.currentMap, s = w.currentTile, c = w.collisionData, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
    // In grass, step to a neighbour that is grass too, else to any open one and back.
    if (map.tallGrass[s.y]?.[s.x]) {
      const ways = [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']].filter(([dx, dy]) => !w.isBlocked({ x: s.x + dx, y: s.y + dy }));
      const grass = ways.filter(([dx, dy]) => map.tallGrass[s.y + dy]?.[s.x + dx]);
      const pick = (grass.length ? grass : ways)[Math.floor(Math.random() * (grass.length || ways.length))];
      return pick ? { key: pick[2] } : { none: true };
    }
    const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
    while (queue.length) { const [x, y] = queue.shift(); if (map.tallGrass[y]?.[x]) { found = [x, y]; break; }
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny })) continue;
        prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
    if (!found) return { none: true };
    let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
    return { key }; })()`;
  for (let guard = 0; guard < 1200 && !(await page.evaluate(sceneIs('battle'))); guard += 1) {
    if (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`)) {
      await press('Space');
      continue;
    }
    const move = await page.evaluate(towardGrass);
    if (guard % 60 === 0) {
      console.log(`  walk ${guard}: ${JSON.stringify(move)} ${await page.evaluate(`JSON.stringify((() => { const w = ${GAME}.scene.getScene('world'); return { tile: w.currentTile, grass: w.currentMap.tallGrass[w.currentTile.y]?.[w.currentTile.x], scenes: ${GAME}.scene.getScenes(true).map((x) => x.scene.key) }; })())`)}`);
    }
    if (move.none) fail('no tall grass to walk into');
    if (move.key) await press(move.key);
    await wait(160);
  }
  await until(sceneIs('battle'), 'a wild POKéMON');
  // Read the opening lines, as a player does, until the commands are up.
  const commandsUp = `(() => { const b = ${GAME}.scene.getScene('battle'); return b.mode === 'main' && b.commandContainer?.visible === true; })()`;
  for (let line = 0; line < 30 && !(await page.evaluate(commandsUp)); line += 1) {
    await press('Space');
    await wait(400);
  }
  await until(commandsUp, 'the command menu');
  await shoot('11-wild-meets-a-smoke-ball');
  const foe = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('battle'); return { foe: b.state.enemy.pokemon.name, foeSpeed: b.state.enemy.pokemon.stats.speed, mine: b.state.player.pokemon.stats.speed, held: b.state.player.pokemon.heldItemId }; })()`);
  console.log(`  wild fight: ${JSON.stringify(foe)}`);
  // RUN is the last command; the label says the odds before it is chosen.
  const onRun = `(() => { const b = ${GAME}.scene.getScene('battle'); return /RUN/.test(b.commandTexts[b.selectedCommand]?.text ?? ''); })()`;
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp']) {
    if (await page.evaluate(onRun)) break;
    await press(key);
    await wait(80);
  }
  if (!(await page.evaluate(onRun))) fail('the cursor never reached RUN');
  console.log(`  run label: ${await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('battle'); return b.commandTexts[b.selectedCommand].text; })()`)}`);
  await shoot('12-run-from-wild');
  await press('Space');
  await until(`${GAME}.scene.getScene('battle').dialog?.isCurrentMessageComplete === true`, 'the line typed out');
  await wait(200);
  await shoot('13-fled-using-smoke-ball');
  const said = await page.evaluate(`${GAME}.scene.getScene('battle').dialog?.textObject?.text ?? ''`);
  console.log(`  said: ${said}`);
  if (!/SMOKE BALL/.test(said)) fail('the escape did not say the SMOKE BALL');
  console.log('ok');
} catch (error) {
  console.error(error);
  await page?.screenshot(`${out}/zz-failed.png`).catch(() => {});
  console.error(await page?.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return JSON.stringify({ scenes: ${GAME}.scene.getScenes(true).map((x) => x.scene.key), tile: b?.currentTile, room: b?.room?.id, box: b?.dialogBox?.visible, question: Boolean(b?.boxQuestion) }); })()`).catch(() => ''));
  process.exitCode = 1;
} finally {
  await browser.close();
}
