// A flight of steps on Greystone Vale, climbed the way a player climbs it:
// the explorer run dropped in, walked to the foot of each flight, then UP
// pressed until the player stands on the ground over its head. Gull Strand's
// cliff path down to the cove shipped as steps nobody could climb (the
// captain, 26 Nov 2026), and `src/game/world/stairs.test.ts` holds the rule;
// this is the same walk in the real game, on stepped frames.
//
//   node tools/playtest/stairs.mjs <url of a test-mode build> <out dir> [--port=N]
//
// Each press is a key; the driver never moves the player itself. Prints one
// PASS or FAIL per foot tile and leaves a picture of the player at the head of
// each flight. Exit code 1 is a FAIL.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!base || !outDir) throw new Error('usage: stairs.mjs <url> <out dir> [--port=N]');
mkdirSync(outDir, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const FRAME_MS = 1000 / 60;
const WORLD = `${GAME}.scene.getScene('world')`;

/**
 * The flights to climb, each with the tiles a player stands on at its foot and
 * the row over its head: Gull Strand's rock stair, the one that could not be
 * climbed. Ember Isle's four flights are a boat ride away and are walked by
 * `emberIsle.mjs`; `stairs.test.ts` asks every flight the vale plants.
 */
const FLIGHTS = [
  { name: 'gull-strand-rock-stair', feet: [[135, 225], [136, 225]], head: 221, start: 'greystone-vale-the-strand' },
];

const browser = option('port') ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
let failed = false;
const check = (ok, what) => {
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
};

try {
  const page = await browser.openPage('about:blank');
  const step = (n = 6) => page.evaluate(`${GAME}.stepFrames(${n}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 1500; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(6);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(2);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const tile = () => page.evaluate(`(() => { const t = ${WORLD}.currentTile; return [t.x, t.y]; })()`);
  /** Nothing in the way of the next press: no step under way, no line up, no fight. */
  const settle = async () => {
    for (let guard = 0; guard < 200; guard += 1) {
      if (await page.evaluate(sceneIs('battle'))) {
        // An explorer's level-99 lead gets away from anything wild: RUN is the last command.
        await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('battle'); if (b.mode === 'main' && b.commandTexts?.length) b.selectedCommand = b.mainCommandLabels().length - 1; })()`);
        await press('Space');
        await wait(300);
        continue;
      }
      const now = await page.evaluate(`(() => { const w = ${WORLD}; return { moving: Boolean(w.targetTile), dialog: w.dialogBox.visible, beat: Boolean(w.cutscene), warping: Boolean(w.isWarping) }; })()`);
      if (now.dialog) {
        await press('Space');
        await wait(200);
        continue;
      }
      if (now.moving || now.beat || now.warping) {
        await wait(100);
        continue;
      }
      return;
    }
  };
  /** The arrow keys from where the player stands to `goal`, over the scene's own collision. */
  const plan = (goal) =>
    page.evaluate(`(() => {
      const w = ${WORLD}; const map = w.currentMap; const start = w.currentTile; const key = (t) => t.x + ',' + t.y;
      const dirs = [[0, -1, 'ArrowUp'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight']];
      const prev = new Map([[key(start), null]]); const queue = [start];
      while (queue.length) {
        const at = queue.shift();
        if (at.x === ${goal[0]} && at.y === ${goal[1]}) { const keys = []; let k = key(at); while (prev.get(k)) { const [from, press] = prev.get(k); keys.unshift(press); k = from; } return keys; }
        for (const [dx, dy, press] of dirs) {
          const next = { x: at.x + dx, y: at.y + dy };
          if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height || w.isBlocked(next) || prev.has(key(next))) continue;
          prev.set(key(next), [key(at), press]); queue.push(next);
        }
      }
      return null;
    })()`);
  const walkTo = async (goal) => {
    for (let presses = 0; presses < 400; presses += 1) {
      const keys = await plan(goal);
      if (!keys) return false;
      if (keys.length === 0) return true;
      await press(keys[0]);
      await settle();
    }
    return false;
  };

  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`);
  await page.evaluate('localStorage.clear()');
  for (const flight of FLIGHTS) {
    await page.send('Page.navigate', { url: url.href });
    await page.waitFor(`document.readyState === 'complete'`);
    await deploy(page, url.href, { press, click, until, wait, paused: true, explorer: true, insertion: flight.start });
    await until(sceneIs('world'), 'the raid');
    await settle();
    for (const [number, foot] of flight.feet.entries()) {
      const there = await walkTo(foot);
      check(there, `${flight.name}: walked to its foot at ${foot}`);
      if (!there) continue;
      // Up, a press at a time, as a player climbs: nothing planned round the rock.
      for (let presses = 0; presses < 8 && (await tile())[1] > flight.head; presses += 1) {
        await press('ArrowUp');
        await settle();
      }
      const at = await tile();
      await page.screenshot(`${outDir}/${flight.name}-${number + 1}.png`);
      check(at[1] <= flight.head, `${flight.name}: UP from ${foot} climbs to the ground over its head (stood at ${at})`);
      await walkTo(flight.feet[0]);
    }
  }
} finally {
  browser.close();
}
process.exit(failed ? 1 : 0);
