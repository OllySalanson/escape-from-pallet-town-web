// One scripted raid, start to result screen, through real key events and real
// clicks: a fresh save, the first contract, its stop, the nearest open exit,
// the result screen and the lobby behind it.
// It is the measurement the test-mode numbers in README.md came from, and the
// check that a raid plays the same at ten frames a second as at sixty.
//
//   node tools/playtest/raid.mjs http://localhost:5173/ [--testmode] [--stepped] [--pixels]
//        [--window=logic|pixel|WxH] [--seed=N] [--shot=path.png] [--taps] [--avoid-watch]
//        [--insertion=id] [--beaten=bossId,..] [--opened=gateId,..] [--completed=contractId,..]
//        [--hp=N] [--stash=itemId[:n],..] [--read=itemId,..] [--open=LABEL] [--arrange]
//        [--work=LABEL] [--exit=LABEL] [--via=x:y,x:y] [--grab=itemId,..] [--fight]
//        [--progress=path.json]
//
// --seed pins `crypto.getRandomValues` and `Math.random` in the page, so two
// runs roll the same raid and their event logs can be compared line for line.
// --insertion and the save flags beside it are deploy.mjs's; README.md has the
// rest, and how the two endings nobody chooses are reached with them.
import { writeFileSync } from 'node:fs';
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, deployOptions, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const base = args.find((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: raid.mjs <dev server url> [--testmode] [--stepped] [--window=logic|pixel] [--seed=N]');
}
const stepped = flag('stepped');
const pixels = flag('pixels');
const testMode = flag('testmode') || stepped || pixels;
const seed = option('seed');
const url = new URL(base);
if (testMode) {
  url.searchParams.set('testmode', pixels ? 'pixels' : '1');
}

// A dev server reloads the page when anyone saves a file under src/, and the raid
// goes with it. Said here, because what it looks like otherwise is a driver bug.
const STATE = `(() => {
  const g = ${GAME};
  if (!g?.scene.getScene('world')?.runSession && !g?.scene.getScenes(true).some((s) => s.scene.key === 'extraction')) throw new Error('the raid is gone: the page was reloaded under the driver (a file saved under src/?)');
  const active = g.scene.getScenes(true).map((s) => s.scene.key);
  const out = { active, overlays: document.querySelectorAll('.menu-overlay').length };
  const w = g.scene.getScene('world');
  if (active.includes('world')) {
    out.world = {
      tile: w.currentTile, target: w.targetTile, dialog: w.dialogBox.visible,
      prompt: Boolean(w.trainerPrompt), map: w.currentMap.id,
      // The three states in which nothing is on screen to press through and the
      // world is about to change anyway: an authored beat is running (the
      // watch's mark and walk-up is one - see world/cutscenes.ts), the fight
      // it announces is still queued behind the last line of dialogue, and the
      // hand-over to the battle is a fade. A driver that reads "no dialogue,
      // not walking" as "nothing is happening" stops stepping in the middle of
      // all three - and a boss fight is exactly the thing that changes the
      // answer to the next question it asks the map, because winning one opens
      // a gate.
      pendingBattle: Boolean(w.pendingTrainerBattle || w.cutscene || w.isWarping),
      elapsedMs: w.runSession?.manager.snapshot().elapsedMs ?? null,
    };
  }
  const b = g.scene.getScene('battle');
  if (active.includes('battle')) {
    out.battle = { mode: b.mode, commands: b.commandTexts.map((t) => t.text) };
  }
  return out;
})()`;

const SEEDED = (n) => `(() => {
  let a = ${Number(n)} >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = next;
  crypto.getRandomValues = (array) => { for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(next() * 2 ** 32); return array; };
})();`;

// `--window=1920x950` as well as the two named ones, because the DOM screens
// are laid out against the browser window now (`src/game/display/menuStage.ts`)
// and the result screen at the end of a raid is one of them.
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const browser = await launchBrowser({
  window: sized
    ? { width: Number(sized[1]), height: Number(sized[2]) }
    : option('window') === 'pixel' ? PIXEL_WINDOW : LOGIC_WINDOW,
});
const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
};

try {
  const started = Date.now();
  const page = await browser.openPage('about:blank');
  if (seed !== undefined) {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: SEEDED(seed) });
  }
  await page.send('Page.navigate', { url: url.href });
  // The last the world was seen of is the clock the raid ended on.
  let clockMs = null;
  const state = async () => { const s = await page.evaluate(STATE); clockMs = s.world?.elapsedMs ?? clockMs; return s; };

  // In stepped mode the loop is asleep and game time moves only when asked to:
  // `wait` is the one place that knows which of the two clocks is running.
  const frames = (ms) => Math.max(1, Math.ceil(ms / 100));
  const wait = stepped ? (ms) => page.evaluate(`${GAME}.stepFrames(${frames(ms)})`) : sleep;
  /** `page.waitFor`, for a game that only moves when it is stepped. */
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 300; guard += 1) {
      if (await page.evaluate(expression)) {
        return;
      }
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  // --taps sends every press as a down and an up back to back: the press that
  // falls inside one frame, which the game must still see.
  const press = async (code, holdMs = flag('taps') ? 0 : 60) => {
    await page.keyDown(code);
    if (holdMs > 0) {
      await wait(holdMs);
    }
    await page.keyUp(code);
  };
  // By the words on the button, whatever case the lobby is lettered in this week.
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };

  await deploy(page, url.href, { press, click, until, paused: stepped, ...deployOptions(args) });
  note(`renderer ${(await page.evaluate(`${GAME}.config.renderType`)) === 1 ? 'canvas' : 'webgl'}, test mode ${testMode}, stepped ${stepped}`);
  await wait(600);
  if (option('shot')) {
    await page.screenshot(option('shot').replace(/\.png$/, '-world.png'));
  }
  const cpuAtDeploy = browser.cpuSeconds();
  const raidStarted = Date.now();

  // `plan.loot` is where this raid's loot actually lies. A map's authored
  // position is only a fallback - `generateLoot` re-seats every piece every
  // raid - so the run plan is the only thing that can send a driver to a piece
  // of loot, which is why nothing here could check one until now.
  const plan = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const p = w.runSession.plan;
    return { seed: p.seed, map: w.currentMap.id, start: w.currentTile, contract: p.contract?.name ?? null, markers: (p.contract?.markers ?? []).map((m) => m.position),
      exits: p.extractionPoints.filter((e) => e.mapId === w.currentMap.id).map((e) => ({ label: e.label, position: e.position, opens: e.requirement?.poiId ?? null, open: (e.requirement?.kind ?? (e.unlockAtMs === 0 ? 'always' : 'elapsed')) === 'always' })),
      loot: (p.loot[w.currentMap.id] ?? []).map((l) => ({ id: l.id, itemId: l.itemId, quantity: l.quantity, position: l.position })) }; })()`);
  note(`seed ${plan.seed}, ${plan.map} from ${plan.start.x},${plan.start.y}, contract ${plan.contract}, stops ${JSON.stringify(plan.markers)}`);

  // --avoid-watch plays the player the map is drawn for: one who reads the shaded
  // ground in front of a trainer and does not walk into it. Without it the driver
  // takes the shortest way, and on a map whose fast road is priced with a fight
  // nobody can run from, the shortest way is into that fight every time - which
  // measures the driver, not the map.
  const WATCHED = flag('avoid-watch')
    ? `(() => { const w = ${GAME}.scene.getScene('world'); const out = new Set();
        const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        for (const t of w.trainerEncounters ?? []) { if (t.mapId !== w.currentMap.id || !t.sightRange || w.defeatedTrainerIds.has(t.trainer.id)) continue;
          const [dx, dy] = step[t.facing]; let x = t.position.x, y = t.position.y;
          for (let i = 0; i < t.sightRange; i += 1) { x += dx; y += dy; if (w.collisionData[y]?.[x] !== false) break; out.add(y * w.collisionData[0].length + x); } }
        return out; })()`
    : 'new Set()';

  /** The next key towards `goal` over the live collision, or a reason to stop. */
  const nextKey = (goal) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
    const c = w.collisionData, H = c.length, W = c[0].length, s = w.currentTile, id = (x, y) => y * W + x;
    const watched = ${WATCHED};
    if (s.x === ${goal.x} && s.y === ${goal.y}) return { arrived: true };
    const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
    while (queue.length) { const [x, y] = queue.shift(); if (x === ${goal.x} && y === ${goal.y}) break;
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || watched.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny })) continue;
        prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
    let cur = [${goal.x}, ${goal.y}], key = null; if (!prev.has(id(cur[0], cur[1]))) return { unreachable: true };
    for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return { key }; })()`);

  let steps = 0;
  let walkingMs = 0;
  let ended = false;

  /** Whatever is in the way of walking: dialogue, a prompt, a battle, the result. */
  const seenCommands = new Set();
  const clearInterruptions = async () => {
    for (let guard = 0; guard < 600; guard += 1) {
      const s = await state();
      if (s.active.includes('extraction')) {
        ended = true;
        return;
      }
      if (s.battle) {
        // A level crossed mid-fight can offer a move against a full moveset,
        // and that question is a DOM overlay with no battle command behind it:
        // the driver would sit on the events mode for ever. Escape in a fight
        // is "do not learn", which is the answer a script has no business
        // giving any other way.
        if (s.overlays > 0) {
          note('move chooser: declining');
          await press('Escape');
          await wait(250);
          continue;
        }
        const selected = s.battle.commands.find((command) => command.startsWith('\u25b6')) ?? '';
        if (s.battle.mode === 'main') {
          // A level-5 starter does not win a raid by fighting everything in the
          // reeds. Leave a wild fight; a fight with no RUN on its menu is fought.
          // --fight stays in every one, which with --hp=1 is how a raid is lost.
          const wanted = !flag('fight') && s.battle.commands.some((command) => command.includes('RUN')) ? 'RUN' : 'FIGHT';
          if (!selected.includes(wanted)) {
            // Whatever shape the menu is this week: walk along the row, and drop a
            // row whenever that comes back round to a command already seen.
            const key = seenCommands.has(selected) ? 'ArrowDown' : 'ArrowRight';
            seenCommands.add(selected);
            await press(key);
            await wait(100);
            continue;
          }
          seenCommands.clear();
          note(`battle: ${selected.replace('\u25b6', '').trim()}`);
        }
        await press('Space');
        await wait(300);
      } else if (s.world?.prompt) {
        note('trainer prompt: backing away');
        await press('Space');
        await wait(200);
      } else if (s.world?.dialog) {
        await press('Space');
        await wait(200);
      } else if (s.world?.pendingBattle) {
        await wait(150);
      } else if (s.world && !s.world.target) {
        return;
      } else {
        await wait(100);
      }
    }
    throw new Error(`interruption never cleared: ${JSON.stringify(await state())}`);
  };

  const walkTo = async (goal, what) => {
    if (ended) {
      return;
    }
    note(`walking to ${what} at ${goal.x},${goal.y}`);
    for (let guard = 0; guard < 400 && !ended; guard += 1) {
      await clearInterruptions();
      if (ended) {
        return;
      }
      const next = await nextKey(goal);
      if (next.arrived || next.unreachable) {
        note(next.arrived ? `reached ${what}` : `${what} unreachable`);
        // The last step may have walked into a watch, and the fight it starts
        // can open a gate: leave with the world settled, not mid-approach.
        await clearInterruptions();
        return;
      }
      // One step: the key goes down, and comes up once the game has taken it.
      const before = await state();
      await page.keyDown(next.key);
      for (let poll = 0; poll < 100; poll += 1) {
        await wait(stepped ? 100 : 15);
        const now = await state();
        if (!now.world || now.world.target || now.world.dialog || now.world.tile.x !== before.world.tile.x || now.world.tile.y !== before.world.tile.y) {
          break;
        }
      }
      await page.keyUp(next.key);
      for (let poll = 0; poll < 100; poll += 1) {
        const now = await state();
        if (!now.world || !now.world.target) {
          if (now.world && !now.world.dialog && before.world.elapsedMs !== null) {
            steps += 1;
            walkingMs += now.world.elapsedMs - before.world.elapsedMs;
          }
          break;
        }
        await wait(stepped ? 100 : 15);
      }
    }
  };

  // --read=itemId reads a disc to the first party Pokemon FireRed lets read it,
  // through the raid's own bag - which is the only place a machine is ever
  // used (`items/teaching.ts`, `BagScene.readMachine`). It is how the key to a
  // field-move door is put in a Pokemon's head in a driver run, and it is the
  // only thing that checks the disc end to end: the loadout packs it, the bag
  // spends it, and an HM comes out of the raid still in the pack.
  const readDisc = async (itemId) => {
    note(`reading ${itemId} in the bag`);
    await press('KeyB');
    await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the bag');
    await wait(200);
    // The row, then who reads it. Every pocket is on screen at once, so there
    // is no tab to find first: the row is a button a player clicks, found by
    // what it says, and pressing it is what asks who it is for.
    await until(
      `(() => { const r = [...document.querySelectorAll('[data-item]')].find((r) => r.innerText.toLowerCase().includes(${JSON.stringify(itemId.slice(0, 4))})); if (!r) return false; r.click(); return true; })()`,
      `a bag row for ${itemId}`,
    );
    await wait(150);
    // The first row the bag does not already call a refusal: canon decides who
    // may read a disc, and the driver is not allowed to argue with it.
    await until(
      `(() => { const rows = [...document.querySelectorAll('[data-target]')];
        const ok = rows.find((r) => !/cannot learn|\\bknows\\b/i.test(r.innerText)); if (!ok) return false; ok.click(); return true; })()`,
      `somebody who can read ${itemId}`,
    );
    await wait(250);
    // A full moveset is a question, not a refusal: the disc queues the move and
    // the same chooser a level-up opens asks which of the four to give up
    // (`ui/MoveChooserOverlay.ts`). The driver gives up the first, which is the
    // only answer a script has any business giving.
    if (await page.evaluate(`Boolean(document.querySelector('[data-forget]'))`)) {
      note(`move chooser: forgetting ${await page.evaluate(`document.querySelector('[data-forget]')?.innerText.split('\\n')[0] ?? ''`)}`);
      // The chooser ignores everything for `MOVE_CHOOSER_ARMING_MS` of *wall*
      // time, because it opens on the key that finished the last line and a
      // release would forget a move nobody chose. A stepped driver moves game
      // time and not wall time, so this waits on the clock the guard uses.
      for (let guard = 0; guard < 20; guard += 1) {
        await sleep(120);
        await page.evaluate(`document.querySelector('[data-forget]')?.click()`);
        if (!(await page.evaluate(`Boolean(document.querySelector('[data-forget]'))`))) break;
      }
    }
    note(`bag says: ${await page.evaluate(`document.querySelector('.px-status-line')?.innerText ?? '(nothing)'`)}`);
    // Its own back button rather than the key that opened it: the chooser is an
    // overlay of its own on top of the bag, and the topmost overlay is the one
    // a key reaches (`ui/overlayKeyboard.ts`).
    await until(`(() => { const b = document.querySelector('[data-close]'); if (!b) return false; b.click(); return true; })()`, 'the bag to close');
    await until(`document.querySelectorAll('.menu-overlay').length === 0`, 'the world back');
    await wait(200);
    note(`party moves: ${await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').party.pokemon.map((p) => p.moves.map((m) => m.base.name)))`)}`);
  };
  for (const itemId of (option('read') ?? '').split(',').filter(Boolean)) {
    await readDisc(itemId);
  }

  // --arrange lays the pack out by hand in the middle of the raid, with the
  // arrow keys and nothing else, and reports what the save was left holding
  // when the raid ended. It is the only thing that plays the whole of the
  // promise a laid-out pack makes (`items/gridArrange.ts`): arranged in the
  // field, carried through every fight, and still that way next time.
  const arrangeInTheField = async () => {
    // The raid opens on its briefing, and the world reads no other key while a
    // box is up: the bag is one key away only once there is nothing to read.
    await clearInterruptions();
    note('arranging the pack');
    await press('KeyB');
    await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the bag');
    await wait(200);
    const layout = () =>
      page.evaluate(
        `[...document.querySelectorAll('[data-grid="pack"] [data-grid-piece]')].map((b) => b.dataset.gridPiece + '@' + b.style.gridColumn + '/' + b.style.gridRow).sort().join(' | ')`,
      );
    note(`pack as packed: ${await layout()}`);
    // The cursor is put on a block the way an arrow key would put it there,
    // and everything after it is a real key: take, carry, put down.
    if (!(await page.evaluate(`(() => { const b = document.querySelector('[data-grid="pack"] [data-grid-piece]'); if (!b) return false; b.focus(); return true; })()`))) {
      note('nothing in the pack to arrange');
      await press('KeyB');
      return;
    }
    await press('Enter');
    for (let step = 0; step < 6; step += 1) {
      await press('ArrowRight');
    }
    for (let step = 0; step < 3; step += 1) {
      await press('ArrowDown');
    }
    await press('Enter');
    await wait(200);
    note(`pack as arranged: ${await layout()}`);
    await press('KeyB');
    await until(`document.querySelectorAll('.menu-overlay').length === 0`, 'the world back');
    await wait(200);
    note(`the raid pack now holds ${await page.evaluate(`${GAME}.scene.getScene('world').bag.arrangement.items.length`)} seats`);
  };
  if (flag('arrange') && !ended) {
    await arrangeInTheField();
  }

  // --open=LABEL works a field-move door: the other way a gate opens, and the
  // only one that happens on a keypress in the middle of a raid rather than in
  // the hand-off out of a won fight. The driver walks to a tile beside it,
  // turns into it - movement turns in place against a blocked tile, which is
  // what makes a door faceable at all - and presses the interact key.
  const opening = option('open')?.toLowerCase().replace(/[-_]/g, ' ');
  if (opening && !ended) {
    const door = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
      const g = w.currentMap.gates.find((g) => g.fieldMove && g.label.toLowerCase().includes(${JSON.stringify(opening)})); if (!g) return null;
      const beside = g.tiles.flatMap((t) => [[0,1,'ArrowUp'],[0,-1,'ArrowDown'],[1,0,'ArrowLeft'],[-1,0,'ArrowRight']]
        .map(([dx, dy, key]) => ({ x: t.x + dx, y: t.y + dy, key }))).filter((t) => !w.isBlocked(t));
      return { id: g.id, label: g.label, move: g.fieldMove, beside, shut: w.isBlocked(g.tiles[0]) }; })()`);
    if (!door) {
      throw new Error(`no field-move door called ${opening} on this map`);
    }
    note(`${door.label} wants ${door.move.toUpperCase()}, and is ${door.shut ? 'shut' : 'already open'}`);
    for (const side of door.beside) {
      if ((await nextKey(side)).unreachable) {
        continue;
      }
      await walkTo(side, `the tile beside ${door.label}`);
      await press(side.key);
      await wait(200);
      // Turned into the door and not yet pressed: the caption says what it
      // wants, which is the whole of the instruction a player gets.
      if (option('shot')) {
        await page.screenshot(option('shot').replace(/\.png$/, `-${door.move}-shut.png`));
      }
      await press('Space');
      await wait(300);
      // Whatever the door said - the refusal is two lines and the opening three.
      for (let guard = 0; guard < 12; guard += 1) {
        const line = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return w.dialogBox.visible ? (w.dialogBox.textObject?.text ?? '') : null; })()`);
        if (line === null) break;
        if (line) note(`${door.label}: ${line}`);
        // The last line, whole: the refusal's second, or the promise that the
        // door stays open. Overwritten each time round, so what lands is the end.
        if (option('shot') && line) {
          await page.screenshot(option('shot').replace(/\.png$/, `-${door.move}-said.png`));
        }
        await press('Space');
        await wait(250);
      }
      break;
    }
    await clearInterruptions();
    const state = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
      const g = w.currentMap.gates.find((g) => g.id === ${JSON.stringify(door.id)});
      return { shut: w.isBlocked(g.tiles[0]), saved: JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1')).raidProgress.openedGates ?? [] }; })()`);
    note(`${door.label} is now ${state.shut ? 'STILL SHUT' : 'OPEN'}; the save has ${JSON.stringify(state.saved)}`);
    if (option('shot')) {
      await page.screenshot(option('shot').replace(/\.png$/, `-${door.move}-open.png`));
    }
  }

  // --via=x:y,x:y walks through those tiles first, in order. It is how a walk
  // that is not to anything is checked - the way along a reveal, which the
  // Signal Fire once stood in, so the raid ended halfway across.
  for (const tile of (option('via') ?? '').split(',').filter(Boolean)) {
    const [x, y] = tile.split(':').map(Number);
    await walkTo({ x, y }, `waypoint ${x},${y}`);
  }
  // --grab=itemId picks up every piece of that item this raid laid, wherever it
  // laid it. Loot is re-seated every raid, so a driver cannot be pointed at it
  // with --via: only the run plan knows where it is. It is how anything that is
  // found rather than packed - a material, a note of scrip - is ever checked
  // from the pack it has to come home in.
  const grab = (option('grab') ?? '').split(',').filter(Boolean);
  for (const piece of plan.loot.filter((l) => grab.includes(l.itemId))) {
    await walkTo(piece.position, `${piece.quantity}x ${piece.itemId}`);
  }
  if (grab.length > 0) {
    note(`seats the pack is still holding: ${ended ? 'n/a' : await page.evaluate(`${GAME}.scene.getScene('world').bag.arrangement.items.length`)}`);
  note(`pack now ${JSON.stringify(await page.evaluate(`${GAME}.scene.getScene('world').bag.toJSON()`))}`);
  }
  for (const [index, marker] of plan.markers.entries()) {
    await walkTo(marker, `contract stop ${index + 1}`);
  }
  // --work=LABEL works a landmark before leaving, which is the only way an exit
  // a landmark opens is ever left by. Stood on where it is ground, as the game
  // allows; faced from beside and worked with the interact key where it is not.
  const work = option('work')?.toLowerCase().replace(/[-_]/g, ' ');
  if (work && !ended) {
    const poi = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
      const p = w.currentMap.pois.find((p) => p.label.toLowerCase().includes(${JSON.stringify(work)})); if (!p) return null;
      const beside = [[0,1,'ArrowUp'],[0,-1,'ArrowDown'],[1,0,'ArrowLeft'],[-1,0,'ArrowRight']].map(([dx, dy, key]) => ({ x: p.position.x + dx, y: p.position.y + dy, key })).filter((t) => !w.isBlocked(t));
      return { id: p.id, label: p.label, position: p.position, ground: !w.isBlocked(p.position), beside }; })()`);
    if (!poi) {
      throw new Error(`no landmark called ${work} on this map`);
    }
    if (poi.ground) {
      await walkTo(poi.position, poi.label);
    } else {
      // Whichever side can be walked to: the first is not always on this bank.
      for (const side of poi.beside) {
        if (!(await nextKey(side)).unreachable) {
          await walkTo(side, `the tile beside ${poi.label}`);
          await press(side.key);
          await wait(200);
          await press('Space');
          break;
        }
      }
    }
    await wait(300);
    await clearInterruptions();
    const worked = await page.evaluate(`${GAME}.scene.getScene('world').activatedPoiIds.has(${JSON.stringify(poi.id)})`);
    note(`${poi.label} ${worked ? 'worked' : 'NOT worked'}`);
    if (option('shot')) {
      await page.screenshot(option('shot').replace(/\.png$/, '-worked.png'));
    }
    // The exit it opens is open from now on, so the nearest-open rule may take it.
    plan.exits.forEach((e) => { e.open ||= worked && e.opens === poi.id; });
  }
  if (!ended) {
    // An exit that is open from the first second: the others are a wait or a
    // detour. Nearest by the walk, not by the crow - on a map of rivers and shut
    // gates an exit can be open by its own rule, ten tiles away in a straight
    // line, and on the far side of a door nobody has opened yet.
    const walked = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
      const c = w.collisionData, H = c.length, W = c[0].length, s = w.currentTile, id = (x, y) => y * W + x;
      const watched = ${WATCHED};
      const steps = new Map([[id(s.x, s.y), 0]]); const queue = [[s.x, s.y]];
      while (queue.length) { const [x, y] = queue.shift();
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || steps.has(id(nx, ny)) || watched.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny })) continue;
          steps.set(id(nx, ny), steps.get(id(x, y)) + 1); queue.push([nx, ny]); } }
      return ${JSON.stringify(plan.exits.map((e) => e.position))}.map((p) => steps.get(id(p.x, p.y)) ?? null); })()`);
    const reachable = plan.exits.map((e, index) => ({ ...e, d: walked[index] })).filter((e) => e.d !== null);
    // --exit=LABEL leaves by a named exit instead, open yet or not: the driver
    // stands beside it until the game says it is open, then steps on. It is how
    // a timed exit is checked at all - the nearest-open rule never chooses one,
    // which is how the Ferry Dock stayed walled off from the front door unseen.
    const named = option('exit');
    const exit = named
      ? reachable.find((e) => e.label.toLowerCase() === named.toLowerCase().replace(/[-_]/g, ' '))
      : reachable.filter((e) => e.open).sort((a, b) => a.d - b.d)[0];
    if (!exit) {
      throw new Error(named
        ? `${named} cannot be walked to from here: ${JSON.stringify(plan.exits.map((e, index) => [e.label, walked[index]]))}`
        : 'no exit that is open from the first second can be walked to from here');
    }
    if (named) {
      const beside = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
        return [[0,-1],[0,1],[-1,0],[1,0]].map(([dx, dy]) => ({ x: ${exit.position.x} + dx, y: ${exit.position.y} + dy })).find((t) => !w.isBlocked(t)) ?? null; })()`);
      await walkTo(beside, `the tile beside ${exit.label}`);
      if (!ended) {
        note(`waiting for ${exit.label} to open`);
      }
      for (let guard = 0; guard < 4000 && !ended; guard += 1) {
        await clearInterruptions();
        const open = await page.evaluate(`${GAME}.scene.getScene('world').worldLabels.some((l) => l.label.text.startsWith(${JSON.stringify(exit.label)}) && /EXTRACT OPEN$/.test(l.label.text))`);
        if (open || ended) break;
        await wait(500);
      }
    }
    await walkTo(exit.position, exit.label);
  }
  for (let guard = 0; guard < 100 && !ended; guard += 1) {
    await clearInterruptions();
    await wait(200);
  }

  // A defeat holds each of its beats for a key; every ending is then one report.
  for (let guard = 0; guard < 40 && ended && !(await page.evaluate(`Boolean(document.querySelector('[data-continue]'))`)); guard += 1) {
    await press('Space');
    await wait(500);
  }
  const clock = clockMs === null ? 'unknown' : `${Math.floor(clockMs / 60000)}:${String(Math.floor(clockMs / 1000) % 60).padStart(2, '0')}`;
  const report = await page.evaluate(`document.querySelector('.menu-overlay, #app')?.innerText.replace(/\\n+/g, ' | ').slice(0, 420)`);
  note(`result after ${clock} of raid: ${ended ? report : 'raid did not end'}`);
  const cpu = browser.cpuSeconds() - cpuAtDeploy;
  const wall = (Date.now() - raidStarted) / 1000;
  console.log(JSON.stringify({
    testMode, stepped, steps,
    clockMsPerStep: steps ? Math.round(walkingMs / steps) : null,
    raidWallSeconds: Number(wall.toFixed(1)),
    raidCpuSeconds: Number(cpu.toFixed(2)),
    cpuPerWallSecond: Number((cpu / wall).toFixed(3)),
    totalWallSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  }));
  if (option('shot')) {
    await page.screenshot(option('shot'));
  }
  if (ended) {
    // And home, which is where a second raid starts from: a raid puts the
    // player down on the base's own quay, so `base` is the scene and Oak's Lab
    // is a walk away.
    await click('Back to the lab');
    await until(sceneIs('base'), 'the base');
    await wait(400);
    note(`home at ${await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('base').currentTile)`)}`);
    await walkIntoBase(page, 'oaks-lab', { press, until });
    await wait(400);
    note(`lobby: ${await page.evaluate(`document.querySelector('.menu-overlay')?.innerText.replace(/\\n+/g, ' | ').slice(0, 160)`)}`);
    // What the raid left in the record at base: the count, and the ground it
    // walked. `--progress=path.json` writes it out, which is how a screenshot
    // of the drop-in screen is taken against a survey a raid actually made.
    const progress = await page.evaluate(`JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1')).raidProgress`);
    note(`recorded: ${JSON.stringify(progress.raidRecord)}, surveyed ${Object.keys(progress.surveyed ?? {}).join(', ') || 'nothing'}`);
    // What a pack laid out by hand left behind. The raid writes it on every
    // ending, so this is the last link in "it comes back the way you left it".
    note(`pack layout kept: ${JSON.stringify(progress.packArrangement?.items ?? [])}`);
    if (option('progress')) {
      writeFileSync(option('progress'), JSON.stringify(progress));
    }
    if (option('shot')) {
      await page.screenshot(option('shot').replace(/\.png$/, '-lobby.png'));
    }
  }
} finally {
  await browser.close();
}
