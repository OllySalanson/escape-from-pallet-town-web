// One scripted raid, start to result screen, through real key events and real
// clicks: a fresh save, the first contract, its stop, the nearest open exit.
// It is the measurement the test-mode numbers in README.md came from, and the
// check that a raid plays the same at ten frames a second as at sixty.
//
//   node tools/playtest/raid.mjs http://localhost:5173/ [--testmode] [--stepped] [--pixels]
//        [--window=logic|pixel] [--seed=N] [--shot=path.png] [--taps]
//
// --seed pins `crypto.getRandomValues` and `Math.random` in the page, so two
// runs roll the same raid and their event logs can be compared line for line.
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';

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

const GAME = 'window.__escapeFromPalletTownGame__';
const STATE = `(() => {
  const g = ${GAME};
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
  const state = () => page.evaluate(STATE);
  const sceneIs = (key) => `${GAME}?.scene.getScenes(true).some((s) => s.scene.key === '${key}')`;

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

  await page.waitFor(sceneIs('title'));
  if (stepped) {
    await page.evaluate(`${GAME}.pauseLoop()`);
  }
  note(`renderer ${(await page.evaluate(`${GAME}.config.renderType`)) === 1 ? 'canvas' : 'webgl'}, test mode ${testMode}, stepped ${stepped}`);
  await press('Space');
  await until(sceneIs('starter'));
  await click('Confirm Bulbasaur');
  await click('Start a raid');
  await click('Bulbasaur');
  await click('Review & deploy');
  await click('Enter the raid');
  await until(sceneIs('world'));
  await wait(600);
  if (option('shot')) {
    await page.screenshot(option('shot').replace(/\.png$/, '-world.png'));
  }
  const cpuAtDeploy = browser.cpuSeconds();
  const raidStarted = Date.now();

  const plan = await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const p = w.runSession.plan;
    return { seed: p.seed, markers: (p.contract?.markers ?? []).map((m) => m.position),
      exits: p.extractionPoints.filter((e) => e.mapId === w.currentMap.id).map((e) => ({ label: e.label, position: e.position, open: (e.requirement?.kind ?? (e.unlockAtMs === 0 ? 'always' : 'elapsed')) === 'always' })) }; })()`);
  note(`seed ${plan.seed}, stops ${JSON.stringify(plan.markers)}`);

  /** The next key towards `goal` over the live collision, or a reason to stop. */
  const nextKey = (goal) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
    const c = w.collisionData, H = c.length, W = c[0].length, s = w.currentTile, id = (x, y) => y * W + x;
    if (s.x === ${goal.x} && s.y === ${goal.y}) return { arrived: true };
    const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
    while (queue.length) { const [x, y] = queue.shift(); if (x === ${goal.x} && y === ${goal.y}) break;
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny })) continue;
        prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
    let cur = [${goal.x}, ${goal.y}], key = null; if (!prev.has(id(cur[0], cur[1]))) return { unreachable: true };
    for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return { key }; })()`);

  let steps = 0;
  let walkingMs = 0;
  let ended = false;

  /** Whatever is in the way of walking: dialogue, a prompt, a battle, the result. */
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
          const wanted = s.battle.commands.some((command) => command.includes('RUN')) ? 'RUN' : 'FIGHT';
          if (!selected.includes(wanted)) {
            await press(wanted === 'RUN' ? 'ArrowDown' : 'ArrowUp');
            await wait(100);
            continue;
          }
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
    throw new Error('interruption never cleared');
  };

  const walkTo = async (goal, what) => {
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

  for (const [index, marker] of plan.markers.entries()) {
    await walkTo(marker, `contract stop ${index + 1}`);
  }
  if (!ended) {
    const here = (await state()).world.tile;
    // An exit that is open from the first second: the others are a wait or a detour.
    const exit = plan.exits
      .filter((e) => e.open)
      .map((e) => ({ ...e, d: Math.abs(e.position.x - here.x) + Math.abs(e.position.y - here.y) }))
      .sort((a, b) => a.d - b.d)[0];
    await walkTo(exit.position, exit.label);
  }
  for (let guard = 0; guard < 100 && !ended; guard += 1) {
    await clearInterruptions();
    await wait(200);
  }

  const report = await page.evaluate(`document.querySelector('.menu-overlay, #app')?.innerText.replace(/\\n+/g, ' | ').slice(0, 260)`);
  note(`result: ${ended ? report : 'raid did not end'}`);
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
} finally {
  await browser.close();
}
