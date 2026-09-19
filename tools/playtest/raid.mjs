// One scripted raid, start to result screen, through real key events and real
// clicks: a fresh save, the first contract, its stop, the nearest open exit,
// the result screen and the lobby behind it.
// It is the measurement the test-mode numbers in README.md came from, and the
// check that a raid plays the same at ten frames a second as at sixty.
//
//   node tools/playtest/raid.mjs http://localhost:5173/ [--testmode] [--stepped] [--pixels]
//        [--window=logic|pixel] [--seed=N] [--shot=path.png] [--taps] [--avoid-watch]
//        [--insertion=id] [--beaten=bossId,..] [--completed=contractId,..] [--hp=N]
//        [--work=LABEL] [--exit=LABEL] [--via=x:y,x:y] [--fight]
//
// --seed pins `crypto.getRandomValues` and `Math.random` in the page, so two
// runs roll the same raid and their event logs can be compared line for line.
// --insertion and the save flags beside it are deploy.mjs's; README.md has the
// rest, and how the two endings nobody chooses are reached with them.
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, deployOptions, sceneIs } from './deploy.mjs';

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

const browser = await launchBrowser({ window: option('window') === 'pixel' ? PIXEL_WINDOW : LOGIC_WINDOW });
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

  const plan = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const p = w.runSession.plan;
    return { seed: p.seed, map: w.currentMap.id, start: w.currentTile, contract: p.contract?.name ?? null, markers: (p.contract?.markers ?? []).map((m) => m.position),
      exits: p.extractionPoints.filter((e) => e.mapId === w.currentMap.id).map((e) => ({ label: e.label, position: e.position, opens: e.requirement?.poiId ?? null, open: (e.requirement?.kind ?? (e.unlockAtMs === 0 ? 'always' : 'elapsed')) === 'always' })) }; })()`);
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

  // --via=x:y,x:y walks through those tiles first, in order. It is how a walk
  // that is not to anything is checked - the way along a reveal, which the
  // Signal Fire once stood in, so the raid ended halfway across.
  for (const tile of (option('via') ?? '').split(',').filter(Boolean)) {
    const [x, y] = tile.split(':').map(Number);
    await walkTo({ x, y }, `waypoint ${x},${y}`);
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
    // And home, which is where a second raid starts from.
    await click('Back to base');
    await until(sceneIs('hub'), 'the lobby');
    await wait(400);
    note(`lobby: ${await page.evaluate(`document.querySelector('.menu-overlay')?.innerText.replace(/\\n+/g, ' | ').slice(0, 160)`)}`);
    if (option('shot')) {
      await page.screenshot(option('shot').replace(/\.png$/, '-lobby.png'));
    }
  }
} finally {
  await browser.close();
}
