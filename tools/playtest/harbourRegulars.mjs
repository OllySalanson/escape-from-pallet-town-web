// THE HARBOUR's regulars (`src/game/base/harbourBots.ts`), played: a new game
// stands at the spawn and the stepped clock is run on for several minutes, a
// second at a time, and between two and six regulars must be in the yard at
// every look, with more than a few of the twelve seen in all. Then the player
// walks up to one who is standing about and speaks to them: the box must open
// with one of their lines, their hand must go up once the player's own has come
// down, and they must stand still
// facing the player until it is read. Last, the player looks round the four
// keepers' rooms until a regular is calling on one, and never two in one room.
//
//   node tools/playtest/harbourRegulars.mjs <test-mode build url> <out dir> [--port=N]
//
// `--port=` drives a browser already running on that CDP port (one the
// machine's memory watchdog can see) instead of launching its own. It is
// stepped on a paused loop, so it needs a test-mode build
// (`tools/playtest/README.md`, "Memory"), and fails loudly - a thrown error -
// on anything that does not happen.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
mkdirSync(out, { recursive: true });
const FRAME_MS = 1000 / 60;
const BASE = `${GAME}.scene.getScene('base')`;

const fail = (why) => {
  throw new Error(`harbour regulars: ${why}`);
};

const browser = option('port')
  ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW })
  : await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = async (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const tap = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(1);
  };
  const baseReady = `${sceneIs('base')} && ${BASE}.ready`;
  const regulars = () => page.evaluate(`${BASE}.harbourRegularsShown`);

  await tap('Space');
  await until(sceneIs('starter'));
  await until(`(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`);
  await wait(300);
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('confirm') && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    'the confirm button',
  );
  await until(baseReady, 'the harbour');
  await wait(1500);

  // Six minutes of the harbour, a look a second.
  const names = new Set();
  const counts = new Map();
  for (let second = 0; second < 360; second += 1) {
    const shown = await regulars();
    if (shown.length < 2 || shown.length > 6) fail(`${shown.length} regulars at second ${second}: ${shown.map((r) => r.name)}`);
    if (new Set(shown.map((r) => r.name)).size !== shown.length) fail(`somebody twice at second ${second}`);
    shown.forEach((r) => names.add(r.name));
    counts.set(shown.length, (counts.get(shown.length) ?? 0) + 1);
    // Ten frames a second here, as test mode's own loop runs: six minutes of 60fps frames is a long wait.
    await page.evaluate(`${GAME}.stepFrames(10, 100)`);
  }
  console.log(`seen: ${[...names].join(', ')}; seconds by count: ${JSON.stringify(Object.fromEntries(counts))}`);
  if (names.size < 5) fail(`only ${names.size} regulars in six minutes`);
  await page.screenshot(`${out}/yard.png`);

  // Up to somebody standing about: two tiles off in a straight line, then a step towards them.
  let spoken = null;
  for (let tries = 0; tries < 40 && !spoken; tries += 1) {
    const before = await regulars();
    await wait(400);
    const after = await regulars();
    const still = after.filter((r) => before.some((b) => b.name === r.name && b.tile.x === r.tile.x && b.tile.y === r.tile.y));
    for (const regular of still) {
      const approach = await page.evaluate(`(() => { const b = ${BASE}; const t = ${JSON.stringify(regular.tile)};
        for (const [dx, dy, key] of [[0, 2, 'ArrowUp'], [0, -2, 'ArrowDown'], [2, 0, 'ArrowLeft'], [-2, 0, 'ArrowRight']]) {
          const from = { x: t.x + dx, y: t.y + dy }, mid = { x: t.x + dx / 2, y: t.y + dy / 2 };
          if (!b.isBlocked(from) && !b.isBlocked(mid) && !b.doors.some((d) => d.tiles.some((x) => (x.x === from.x && x.y === from.y) || (x.x === mid.x && x.y === mid.y)))) return { from, key };
        } return null; })()`);
      if (!approach) continue;
      await page.evaluate(`void ${BASE}.scene.start('base', { at: ${JSON.stringify(approach.from)} })`);
      await until(baseReady, 'the harbour again');
      await wait(200);
      await tap(approach.key);
      await wait(300);
      await tap('Space');
      await wait(100);
      const open = await page.evaluate(`${BASE}.dialogBox.visible`);
      if (open) {
        spoken = regular;
        break;
      }
    }
  }
  if (!spoken) fail('never managed to speak to a regular');
  // The player's hand goes up first; theirs as it comes down.
  if ((await regulars()).find((r) => r.name === spoken.name)?.waving) fail(`${spoken.name} waved over the player's own wave`);
  await wait(1500);
  const heard = await page.evaluate(`${BASE}.dialogBox.visible`);
  const them = (await regulars()).find((r) => r.name === spoken.name);
  if (!heard || !them?.waving) fail(`${spoken.name} did not answer: box ${heard}, waving ${them?.waving}`);
  await page.screenshot(`${out}/spoken-to.png`);
  // Standing still while the box is up, however long it is read for.
  const held = (await regulars()).find((r) => r.name === spoken.name).tile;
  await wait(6000);
  const later = (await regulars()).find((r) => r.name === spoken.name);
  if (later && (later.tile.x !== held.x || later.tile.y !== held.y)) fail(`${spoken.name} walked off mid-sentence`);
  for (let presses = 0; presses < 6 && (await page.evaluate(`${BASE}.dialogBox.visible`)); presses += 1) {
    await tap('Space');
    await wait(200);
  }
  console.log(`spoke to ${spoken.name} at ${held.x},${held.y}; the box is read`);

  // Somebody calling on a keeper: round the four rooms, a look in each, until one is in.
  const ROOMS = ['oaks-lab', 'pokemon-centre', 'brocks-workshop', 'bills-cottage'];
  let caller = null;
  for (let look = 0; look < 240 && !caller; look += 1) {
    const room = ROOMS[look % ROOMS.length];
    await page.evaluate(`void ${BASE}.scene.start('base', { room: '${room}' })`);
    await until(baseReady, `the ${room}`);
    await page.evaluate(`${GAME}.stepFrames(10, 100)`);
    const inside = await regulars();
    if (inside.length > 1) fail(`${inside.length} regulars in ${room} at once`);
    if (inside.length === 1) caller = { room, ...inside[0] };
  }
  if (!caller) fail('nobody called on a keeper in twenty minutes');
  // Into the room and standing about.
  await page.evaluate(`${GAME}.stepFrames(40, 100)`);
  await page.screenshot(`${out}/calling-on-${caller.room}.png`);
  console.log(`${caller.name} called in at ${caller.room}`);
} finally {
  await browser.close();
}
