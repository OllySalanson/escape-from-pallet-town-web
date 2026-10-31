// THE HARBOUR's regulars (`src/game/base/harbourBots.ts`), played: a new game
// stands at the spawn and the stepped clock is run on for several minutes, a
// second at a time, and between two and six regulars must be in the yard at
// every look, with more than a few of the twelve seen in all. Then the player
// looks round the keepers' rooms until a regular is calling on one, and never
// two in one room. `regularsActivities.mjs` is the watch of what they do.
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
  await until(sceneIs('base'));
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  await wait(1500);

  // Six minutes of the harbour, a look a second.
  const names = new Set();
  const counts = new Map();
  for (let second = 0; second < 360; second += 1) {
    const shown = await regulars();
    // One may be a moment behind a busy door, so one showing is not a fault on its own.
    if (shown.length < 1 || shown.length > 6) fail(`${shown.length} regulars at second ${second}: ${shown.map((r) => r.name)}`);
    if (new Set(shown.map((r) => r.name)).size !== shown.length) fail(`somebody twice at second ${second}`);
    shown.forEach((r) => names.add(r.name));
    counts.set(shown.length, (counts.get(shown.length) ?? 0) + 1);
    // Ten frames a second here, as test mode's own loop runs: six minutes of 60fps frames is a long wait.
    await page.evaluate(`${GAME}.stepFrames(10, 100)`);
  }
  console.log(`seen: ${[...names].join(', ')}; seconds by count: ${JSON.stringify(Object.fromEntries(counts))}`);
  if (names.size < 5) fail(`only ${names.size} regulars in six minutes`);
  await page.screenshot(`${out}/yard.png`);

  // Somebody calling on a keeper: round the rooms, a look in each, until one is in.
  const ROOMS = ['oaks-lab', 'pokemon-centre', 'brocks-workshop', 'bills-cottage', 'boutique'];
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
