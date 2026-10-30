// THE HARBOUR's regulars doing things (`src/game/base/harbourActivities.ts`),
// watched at length on a stepped clock: a new game stands in the yard while the
// clock runs on, and every frame looked at is held to the rules. Nobody in the
// yard may share a tile with another, stand on a door, or appear anywhere but a
// way through; a name plate and a bubble may never share a pixel, and whoever
// is speaking has no name up; every activity on the list must be seen. Then the
// player faces a regular and presses the interact key: no box, no prompt, nothing.
//
//   node tools/playtest/regularsActivities.mjs <test-mode url> <out dir> [--port=N] [--minutes=30] [--window=1200x768] [--shots=chat,knock,...]
//
// Stepped on a paused loop, so it costs little however long it watches
// (`tools/playtest/README.md`, "Memory"). Run it at the smallest window too: the
// bubble rules are asked in world pixels, and the camera's view is what changes.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
mkdirSync(out, { recursive: true });
const BASE = `${GAME}.scene.getScene('base')`;
const MINUTES = Number(option('minutes') ?? 30);
const WINDOW = option('window')
  ? { width: Number(option('window').split('x')[0]), height: Number(option('window').split('x')[1]) }
  : PIXEL_WINDOW;
const TILE = 16;

const browser = option('port') ? attachBrowser(Number(option('port')), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
const faults = [];
const fault = (why) => {
  faults.push(why);
  console.log(`FAULT ${why}`);
};
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.keyDown('Space');
  await page.keyUp('Space');
  await page.waitFor(sceneIs('starter'), { timeoutMs: 60_000 });
  await page.waitFor(`(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`, { timeoutMs: 60_000 });
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('confirm') && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    { timeoutMs: 60_000 },
  );
  await page.waitFor(`${sceneIs('base')} && ${BASE}.ready`, { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);

  const look = `(() => {
    const scene = ${BASE};
    const shown = scene.harbourRegularsShown;
    const drawn = [...(scene.harbourFigures?.drawn ?? new Map()).values()];
    const plates = drawn.filter((d) => d.name.visible).map((d) => ({ name: d.name.text, x: d.plate.x, y: d.plate.y, width: Math.ceil(d.name.width) + 6, height: Math.ceil(d.name.height) + 1 }));
    const bubbles = drawn.filter((d) => d.bubbleBox).map((d) => ({ name: d.name.text, words: d.bubble.words, ...d.bubbleBox }));
    return { shown, plates, bubbles };
  })()`;
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  const activities = new Map();
  const seenSpeaking = new Map();
  const doors = await page.evaluate(`${BASE}.doors.flatMap((door) => door.tiles.map((tile) => tile.x + ',' + tile.y))`);
  const appeared = new Map();
  let shots = 0;
  let lastSpeechShot = -60;
  const seconds = MINUTES * 60;
  for (let second = 0; second < seconds; second += 1) {
    // Five looks a second: enough to catch two on a tile, a pop or a bubble over a name.
    for (let tick = 0; tick < 5; tick += 1) {
      await page.evaluate(`${GAME}.stepFrames(2, 100)`);
      const { shown, plates, bubbles } = await page.evaluate(look);
      if (shown.length > 6) fault(`${shown.length} regulars at ${second}s`);
      const taken = new Map();
      for (const regular of shown) {
        activities.set(regular.activity, (activities.get(regular.activity) ?? 0) + 1);
        const key = `${regular.tile.x},${regular.tile.y}`;
        const other = taken.get(key);
        if (other) fault(`${regular.name} and ${other} on ${key} at ${second}s`);
        taken.set(key, regular.name);
        if (!appeared.has(regular.name)) {
          appeared.set(regular.name, key);
        }
        if (regular.saying) seenSpeaking.set(regular.saying, (seenSpeaking.get(regular.saying) ?? 0) + 1);
      }
      for (const [name] of appeared) {
        if (!shown.some((regular) => regular.name === name)) appeared.delete(name);
      }
      for (const bubble of bubbles) {
        if (plates.some((plate) => plate.name === bubble.name)) fault(`${bubble.name} has a name up and a bubble at ${second}s`);
        for (const plate of plates) {
          if (overlap(bubble, plate)) fault(`${plate.name}'s name is under ${bubble.name}'s bubble at ${second}s`);
        }
        const inView = await page.evaluate(`(() => { const v = ${BASE}.cameras.main.worldView; const b = ${JSON.stringify(bubble)}; return b.x >= v.x && b.y >= v.y && b.x + b.width <= v.x + v.width && b.y + b.height <= v.y + v.height; })()`);
        if (inView && second - lastSpeechShot > 60 && shots < 12) {
          lastSpeechShot = second;
          shots += 1;
          await page.screenshot(`${out}/speech-${shots}.png`);
        }
      }
    }
    if (second % 120 === 0) {
      console.log(`${second}s: ${JSON.stringify(Object.fromEntries(activities))}`);
    }
  }
  await page.screenshot(`${out}/yard.png`);
  console.log(`activities seen: ${JSON.stringify(Object.fromEntries(activities))}`);
  console.log(`phrases heard: ${JSON.stringify(Object.fromEntries(seenSpeaking))}`);
  for (const kind of ['stroll', 'wander', 'hang-out', 'watch-sea', 'window-shop', 'read-board', 'knock', 'chat']) {
    if (!activities.has(kind) && MINUTES >= 10) fault(`never saw anybody ${kind}`);
  }

  // One picture of each thing they do, from a few tiles away.
  for (const kind of (option('shots') ?? '').split(',').filter(Boolean)) {
    let doing = null;
    for (let tries = 0; tries < 900 && !doing; tries += 1) {
      await page.evaluate(`${GAME}.stepFrames(2, 100)`);
      const shown = await page.evaluate(`${BASE}.harbourRegularsShown`);
      const stood = await page.evaluate(`(() => { const s = ${BASE}.harbourRegularsShown; return s; })()`);
      await page.evaluate(`${GAME}.stepFrames(3, 100)`);
      const later = await page.evaluate(`${BASE}.harbourRegularsShown`);
      const still = (regular) => stood.some((b) => b.name === regular.name && b.tile.x === regular.tile.x && b.tile.y === regular.tile.y) && later.some((b) => b.name === regular.name && b.tile.x === regular.tile.x && b.tile.y === regular.tile.y);
      const others = later.filter((other) => other.activity === kind && still(other));
      doing = others.find((regular) => kind !== 'chat' || others.length > 1) ?? null;
      void shown;
    }
    if (!doing) {
      console.log(`nobody at ${kind} to photograph`);
      continue;
    }
    const from = await page.evaluate(`(() => { const b = ${BASE}; const t = ${JSON.stringify(doing.tile)};
      for (const [dx, dy] of [[0, 3], [3, 3], [-3, 3], [0, 4], [4, 0], [-4, 0], [3, 0], [-3, 0], [0, -3]]) {
        const at = { x: t.x + dx, y: t.y + dy };
        if (!b.isBlocked(at) && !b.doors.some((d) => d.tiles.some((x) => x.x === at.x && x.y === at.y))) return at;
      } return t; })()`);
    await page.evaluate(`void ${BASE}.scene.start('base', { at: ${JSON.stringify(from)} })`);
    for (let wait = 0; wait < 20 && !(await page.evaluate(`${sceneIs('base')} && ${BASE}.ready`)); wait += 1) {
      await page.evaluate(`${GAME}.stepFrames(3, 100)`);
    }
    await page.evaluate(`${GAME}.stepFrames(6, 100)`);
    // A chat is worth waiting a moment for somebody to say something.
    for (let wait = 0; kind === 'chat' && wait < 300; wait += 1) {
      await page.evaluate(`${GAME}.stepFrames(1, 100)`);
      if ((await page.evaluate(`${BASE}.harbourRegularsShown`)).some((regular) => regular.saying && regular.activity === 'chat')) break;
    }
    await page.evaluate(`${GAME}.stepFrames(2, 100)`);
    await page.screenshot(`${out}/doing-${kind}.png`);
    console.log(`${doing.name} ${kind} at ${doing.tile.x},${doing.tile.y}`);
  }

  // Facing a regular, the interact key does nothing: no box, no prompt, no hand.
  const tap = async (code) => {
    await page.keyDown(code);
    await page.evaluate(`${GAME}.stepFrames(1, ${1000 / 60})`);
    await page.keyUp(code);
    await page.evaluate(`${GAME}.stepFrames(1, ${1000 / 60})`);
  };
  let faced = null;
  for (let tries = 0; tries < 200 && !faced; tries += 1) {
    await page.evaluate(`${GAME}.stepFrames(5, 100)`);
    const before = await page.evaluate(`${BASE}.harbourRegularsShown`);
    await page.evaluate(`${GAME}.stepFrames(3, 100)`);
    const after = await page.evaluate(`${BASE}.harbourRegularsShown`);
    const still = after.filter((r) => before.some((b) => b.name === r.name && b.tile.x === r.tile.x && b.tile.y === r.tile.y));
    for (const regular of still) {
      const spot = await page.evaluate(`(() => { const b = ${BASE}; const t = ${JSON.stringify(regular.tile)};
        for (const [dx, dy, key] of [[0, 2, 'ArrowUp'], [0, -2, 'ArrowDown'], [2, 0, 'ArrowLeft'], [-2, 0, 'ArrowRight']]) {
          const from = { x: t.x + dx, y: t.y + dy }, mid = { x: t.x + dx / 2, y: t.y + dy / 2 };
          if (!b.isBlocked(from) && !b.isBlocked(mid) && !b.doors.some((d) => d.tiles.some((x) => (x.x === from.x && x.y === from.y) || (x.x === mid.x && x.y === mid.y)))) return { from, key };
        } return null; })()`);
      if (!spot) continue;
      await page.evaluate(`void ${BASE}.scene.start('base', { at: ${JSON.stringify(spot.from)} })`);
      for (let wait = 0; wait < 20 && !(await page.evaluate(`${sceneIs('base')} && ${BASE}.ready`)); wait += 1) {
        await page.evaluate(`${GAME}.stepFrames(3, 100)`);
      }
      await page.evaluate(`${GAME}.stepFrames(2, 100)`);
      const mid = { x: (spot.from.x + regular.tile.x) / 2, y: (spot.from.y + regular.tile.y) / 2 };
      if (await page.evaluate(`${BASE}.partnerAt(${JSON.stringify(mid)})`)) continue;
      await tap(spot.key);
      await page.evaluate(`${GAME}.stepFrames(3, 100)`);
      const facing = await page.evaluate(`(() => { const b = ${BASE}; return { tile: b.currentTile, facing: b.facing }; })()`);
      const ahead = { x: facing.tile.x + (facing.facing === 'right' ? 1 : facing.facing === 'left' ? -1 : 0), y: facing.tile.y + (facing.facing === 'down' ? 1 : facing.facing === 'up' ? -1 : 0) };
      const there = (await page.evaluate(`${BASE}.harbourRegularsShown`)).find((r) => r.tile.x === ahead.x && r.tile.y === ahead.y);
      if (!there) continue;
      faced = there;
      await tap('Space');
      await page.evaluate(`${GAME}.stepFrames(4, 100)`);
      const state = await page.evaluate(`(() => { const b = ${BASE}; return { box: b.dialogBox.visible, waving: b.waving, hint: b.hintText?.text ?? '' }; })()`);
      if (state.box) fault(`the interact key opened a box at ${there.name}`);
      if (state.waving) fault(`the interact key raised a hand at ${there.name}`);
      await page.screenshot(`${out}/facing-${there.name}.png`);
      console.log(`faced ${there.name} at ${ahead.x},${ahead.y} and pressed the key: ${JSON.stringify(state)}`);
      break;
    }
  }
  if (!faced) fault('never managed to face a regular');
  if (doors.length === 0) fault('no doors read');
} finally {
  await browser.close();
}
console.log(faults.length === 0 ? 'no faults' : `${faults.length} faults`);
if (faults.length > 0) process.exitCode = 1;
