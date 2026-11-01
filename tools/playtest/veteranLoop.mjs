// The loop the character tests found, played for real: a new save, raid after raid
// on stepped 60fps frames with real keys, and what each one paid, cost and ran into.
//
//   node tools/playtest/veteranLoop.mjs <url> <out-dir> [--policy=veteran|stay|potter]
//        [--raids=N] [--port=N] [--shots]
//
// `veteran` picks up what lies within 25 steps of the landing and walks out by the
// nearest open way. `stay` goes after the raid's stake along the money and then
// walks out. `potter` walks up and down near the landing until a hunter comes,
// then runs for the way out, which is the first five minutes of somebody who
// has not read anything. Fights are mashed. It writes `<out>/<policy>.json` and,
// with --shots, a picture of each moment worth judging. Run it on a test-mode
// build (`tools/playtest/README.md`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, jumpIn, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'veteran-loop'] = args.filter((arg) => !arg.startsWith('--'));
const policy = option('policy') ?? 'veteran';
const raids = Number(option('raids') ?? 10);
const shots = args.includes('--shots');
mkdirSync(out, { recursive: true });

const FRAME_MS = 1000 / 60;
const REACH = 25;
const browser = option('port') ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const world = `${GAME}.scene.getScene('world')`;
const taken = new Set();
const results = [];
const trace = args.includes('--trace') ? (what) => console.log(`[${(performance.now() / 1000).toFixed(1)}s] ${what}`) : () => {};

try {
  const page = await browser.openPage(url);
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate(`${GAME}.pauseLoop()`);

  const frames = (count) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => frames(Math.max(1, Math.round(ms / FRAME_MS)));
  const shot = async (name, once = true) => {
    if (shots && (!once || !taken.has(name))) {
      taken.add(name);
      await page.screenshot(`${out}/${policy}-${name}.png`);
    }
  };
  const until = async (expression, what, maxFrames = 3000) => {
    for (let frame = 0; frame < maxFrames; frame += 6) {
      if (await page.evaluate(expression)) {
        return;
      }
      if (frame % 600 === 0) {
        trace(`waiting for ${what}: ${await page.evaluate(`JSON.stringify({ active: ${GAME}.scene.getScenes(true).map((s) => s.scene.key), tile: ${world}?.currentTile, pending: ${world}?.pendingResultScreen, session: Boolean(${world}?.runSession), phase: ${world}?.runSession?.manager.phase, dialog: ${world}?.dialogBox?.visible, text: ${world}?.dialogBox?.visible ? ${world}.dialogBox.currentMessage : null, warping: ${world}?.isWarping })`)}`);
      }
      await frames(6);
      await watchTheRail();
    }
    throw new Error(`never saw ${what}`);
  };
  // The held breath is over in a second and is what the picture is for.
  const watchTheRail = async () => {
    if (shots && (await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const breath = b?.jump?.breath; return Boolean(breath && breath.elapsedMs > breath.ms - 300); })()`))) {
      await shot(`rail-${results.length + 1}`);
    }
  };
  const press = async (code, holdFrames = 3) => {
    await page.keyDown(code);
    await frames(holdFrames);
    await page.keyUp(code);
    await frames(2);
  };

  trace('title');
  await press('Space');
  await until(sceneIs('base'), 'the base');
  trace('base');
  await frames(30);
  await page.evaluate(`${GAME}.scene.getScene('base').takeStarterForDriver('charmander')`);
  await until(`${GAME}.scene.getScene('base').ready`, 'the yard');

  const inRaid = `${world}.runSession && ${sceneIs('world')} && !${sceneIs('extraction')}`;
  const nextKey = (goal) =>
    page.evaluate(`(() => { const w = ${world}; const goal = ${JSON.stringify(goal)};
      const c = w.collisionData, H = c.length, W = c[0].length, s = w.currentTile, id = (x, y) => y * W + x;
      const figures = new Set(); for (const e of w.currentMap.entities) figures.add(e.position.y * W + e.position.x); for (const t of w.trainersForCurrentMap()) figures.add(t.position.y * W + t.position.x);
      const free = (x, y) => !c[y][x] && !figures.has(y * W + x);
      if (s.x === goal.x && s.y === goal.y) return { arrived: true };
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let head = 0; let found = false;
      while (head < queue.length) { const [x, y] = queue[head++];
        if (x === goal.x && y === goal.y) { found = true; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || !free(nx, ny)) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return { unreachable: true };
      let cur = [goal.x, goal.y], key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return { key }; })()`);
  const raidOver = () => page.evaluate(`!(${inRaid})`);
  /** Whatever stands between the player and the next step: a box, a question, a fight. */
  const clear = async (record) => {
    for (let guard = 0; guard < 2000; guard += 1) {
      const state = await page.evaluate(`(() => { const g = ${GAME}; const w = ${world};
        const active = g.scene.getScenes(true).map((s) => s.scene.key);
        return { battle: active.includes('battle'), over: active.includes('extraction'), dialog: w.dialogBox?.visible, prompt: Boolean(w.trainerPrompt), busy: Boolean(w.cutscene && !w.cutscene.waitingForPlayer) || Boolean(w.pendingTrainerBattle) || Boolean(w.pendingWildBattle) || w.isWarping, overlay: document.querySelectorAll('.menu-overlay').length };
      })()`);
      if (guard % 50 === 49) {
        trace(`held up: ${JSON.stringify(state)}`);
      }
      if (state.over) {
        return;
      }
      if (state.battle) {
        record.fights = record.fightSeen ? record.fights : record.fights + 1;
        record.fightSeen = true;
        await press(guard % 2 === 0 ? 'Space' : 'Enter');
        await frames(6);
        continue;
      }
      record.fightSeen = false;
      if (state.dialog || state.prompt || state.overlay > 0) {
        await press(state.overlay > 0 ? 'Enter' : 'Space');
        continue;
      }
      if (state.busy) {
        await frames(6);
        continue;
      }
      return;
    }
  };
  const note = (record) =>
    page.evaluate(`(() => { const w = ${world}; const pack = w.hunterPackHere?.(); const after = pack?.hunters.filter((h) => h.mode === 'alerted' || h.mode === 'chase') ?? [];
      return { after: after.length, gap: after[0]?.gap ?? null, elapsed: w.runSession?.manager.snapshot().elapsedMs ?? 0, cue: w.objectiveCue }; })()`).then((state) => {
      if (state.after > 0 && record.huntedAtMs === null) {
        record.huntedAtMs = Math.round(state.elapsed);
      }
      return state;
    });
  const walkTo = async (goal, record, shotName) => {
    for (let guard = 0; guard < 900; guard += 1) {
      await clear(record);
      if (await raidOver()) {
        trace('raid over');
        return false;
      }
      const state = await note(record);
      if (shotName && state.after > 0) {
        await shot(`${shotName}-chase`);
      }
      const next = await nextKey(goal);
      trace(`to ${goal.x},${goal.y}: ${JSON.stringify(next)}`);
      if (next.arrived) {
        return true;
      }
      if (next.unreachable) {
        return false;
      }
      await press(next.key, 2);
      for (let poll = 0; poll < 40 && (await page.evaluate(`Boolean(${world}.targetTile) && ${inRaid}`)); poll += 1) {
        await frames(2);
      }
      record.steps += 1;
    }
    return false;
  };
  const planned = () =>
    page.evaluate(`(() => { const w = ${world}; const plan = w.runSession.plan; const map = plan.insertion.mapId;
      const left = plan.loot[map].filter((piece) => !w.collectedLootIds.has(piece.id));
      const c = w.collisionData, H = c.length, W = c[0].length, s = w.currentTile;
      const figures = new Set(); for (const e of w.currentMap.entities) figures.add(e.position.y * W + e.position.x); for (const t of w.trainersForCurrentMap()) figures.add(t.position.y * W + t.position.x);
      const free = (x, y) => !c[y][x] && !figures.has(y * W + x);
      const dist = new Map([[s.y * W + s.x, 0]]); const queue = [[s.x, s.y]]; let head = 0;
      while (head < queue.length) { const [x, y] = queue[head++]; const d = dist.get(y * W + x);
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist.has(ny * W + nx) || !free(nx, ny)) continue;
          dist.set(ny * W + nx, d + 1); queue.push([nx, ny]); } }
      return left.map((piece) => ({ id: piece.id, position: piece.position, itemId: piece.itemId, quantity: piece.quantity, steps: dist.get(piece.position.y * W + piece.position.x) ?? -1 })).filter((piece) => piece.steps >= 0).sort((a, b) => a.steps - b.steps); })()`);
  const exitTile = () => page.evaluate(`${world}.nearestOpenExitHere().nearestOpenExit?.position ?? null`);

  for (let raid = 1; raid <= raids; raid += 1) {
    await walkIntoBase(page, 'raid-arena', { press: (code) => press(code), until, wait, settleMs: 100 });
    trace('hall');
    if (raid > 1 && shots) {
      await openHallPanel(page, 'rim', { press: (code) => press(code), until, wait, settleMs: 100 });
      await frames(20);
      await shot(`rim-${raid}`);
    }
    // Somebody who took their partner out of the locker, to see what the rail says of it.
    if (args.includes('--partner-at-risk')) {
      await page.evaluate(`(() => { const flow = ${GAME}.scene.getScene('base').kit?.flow; for (const stored of [...(flow?.securedPokemon ?? [])]) flow.toggleSecurePokemon(stored.id); })()`);
    }
    await jumpIn(page, { press: (code) => press(code), until, wait });
    trace('landed');
    const before = await page.evaluate(`(() => { const w = ${world}; return { seed: w.runSession.plan.seed, delay: w.runSession.plan.hunter.spawnDelayMs, staged: Boolean(w.runSession.plan.stagedChase) }; })()`);
    const record = { raid, seed: before.seed, firstHunterAtMs: before.delay, staged: before.staged, steps: 0, fights: 0, fightSeen: false, huntedAtMs: null };
    await frames(20);
    await shot(`landing-${raid}`);
    if (policy === 'veteran') {
      for (let again = 0; again < 12; again += 1) {
        trace('asking what is near');
        const near = (await planned()).find((piece) => piece.steps <= REACH);
        trace(`near: ${near?.id}`);
        if (!near || !(await walkTo(near.position, record))) {
          break;
        }
      }
    } else if (policy === 'stay') {
      for (const name of ['/stake-money-1', '/stake-money-2', '/stake']) {
        const target = (await planned()).find((piece) => piece.id.endsWith(name));
        if (target && !(await walkTo(target.position, record, `raid-${raid}`))) {
          break;
        }
        if (name === '/stake') {
          await frames(4);
          await shot(`taken-${raid}`);
        }
      }
    } else {
      // Pottering: to and fro by the landing, reading nothing, until somebody comes.
      const home = await page.evaluate(`({ ...${world}.currentTile })`);
      const pieces = (await planned()).filter((piece) => piece.steps <= 18);
      for (let pass = 0; pass < 60 && record.huntedAtMs === null && !(await raidOver()); pass += 1) {
        const spot = pieces[pass % Math.max(1, pieces.length)]?.position ?? home;
        await walkTo(pass % 2 === 0 ? spot : home, record);
        await note(record);
      }
      await frames(20);
      await shot(`chase-${raid}`);
    }
    for (let guard = 0; guard < 6 && !(await raidOver()); guard += 1) {
      trace('asking the way out');
      const exit = await exitTile();
      if (!exit) {
        break;
      }
      await walkTo(exit, record, policy === 'stay' ? `out-${raid}` : undefined);
    }
    trace('to the result screen');
    await clear(record);
    await until(sceneIs('extraction'), 'the result screen', 18000);
    trace('result');
    await frames(240);
    const ended = await page.evaluate(`(() => { const r = ${GAME}.scene.getScene('extraction'); const w = ${world};
      const saved = JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1'));
      return { title: document.querySelector('.px-title')?.innerText?.split('\\n')[0]?.trim(), money: saved?.stash?.items?.money ?? 0, items: saved?.stash?.items ?? {}, elapsedMs: Math.round(r.report?.snapshot?.elapsedMs ?? w.runSession?.manager.snapshot().elapsedMs ?? 0), escaped: r.report?.outcome === 'ESCAPED', outcome: r.report?.outcome, cause: r.report?.cause }; })()`);
    await shot(`result-${raid}`);
    const previous = results[results.length - 1];
    const gained = Object.entries(ended.items).flatMap(([id, count]) => {
      const was = previous?.items?.[id] ?? 0;
      return count !== was ? [`${id} ${count - was > 0 ? '+' : ''}${count - was}`] : [];
    });
    results.push({ ...record, title: ended.title ?? ended.outcome, escaped: ended.escaped, elapsedMs: ended.elapsedMs, money: ended.money, gained, items: ended.items });
    console.log(`raid ${raid}: ${ended.title ?? `${ended.outcome} ${ended.cause ?? ''}`}; ${(ended.elapsedMs / 1000).toFixed(1)}s on the clock, ${record.steps} steps, ${record.fights} fights, hunted ${record.huntedAtMs === null ? 'never' : `at ${(record.huntedAtMs / 1000).toFixed(0)}s`}; money ${ended.money}; ${gained.join(', ')}`);
    // A raid lost leaves a bot that does not go to Nurse Joy with nobody to send.
    if (ended.escaped === false) {
      console.log('lost: the loop stops here');
      break;
    }
    await press('Space');
    await frames(30);
    for (let guard = 0; guard < 200 && (await page.evaluate(sceneIs('extraction'))); guard += 1) {
      await press('Enter');
      await frames(10);
    }
  }
  writeFileSync(`${out}/${policy}.json`, JSON.stringify(results.map(({ items, fightSeen, ...rest }) => rest), null, 1));
  const clocks = results.map((each) => each.elapsedMs / 1000);
  console.log(
    `${policy}: ${results.length} raids, ${results.filter((each) => each.escaped).length} out, mean ${(clocks.reduce((a, b) => a + b, 0) / clocks.length).toFixed(1)}s on the clock, hunted in ${results.filter((each) => each.huntedAtMs !== null).length}, fights ${results.reduce((sum, each) => sum + each.fights, 0)}, money ${results[results.length - 1].money}`,
  );
} finally {
  browser.close();
}
