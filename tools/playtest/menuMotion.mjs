// Plays how a screen arrives and leaves (`src/game/ui/menuMotion.ts`) and records it.
//
//   node tools/playtest/menuMotion.mjs <test-mode build url> <out dir> [--port=CDP port] [--window=WxH]
//
// On a new save in the harbour it opens and closes YOUR THINGS (a whole screen),
// THE POKéDEX, FAVOURS (a side panel) and THE CHEST's two tabs (one screen
// straight after another), and fails unless:
//
//   - opening starts moves on the screen, all of them stepped, the last of them
//     over within 260ms, and a tab's are fewer and sooner over than a whole screen's;
//   - closing takes the screen out of the menu layer at once, leaves it in the
//     leaving layer for the move and takes that down after it;
//   - with reduced motion asked for, nothing moves and nothing is left behind.
//
// Test mode has screens arrive at once unless the address asks (`screensMove`),
// so this is the one driver that opens the page with `menumotion=1`.
//
// Each move is also recorded as an animated picture at half size, played about
// three times slower than the game so its steps can be seen: the page's
// animations are slowed for the recording, never the game.
import { mkdirSync, writeFileSync } from 'node:fs';
import { animatedPng, decodePng } from './apng.mjs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
if (!url) throw new Error('menuMotion: name a test-mode build url');
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
mkdirSync(out, { recursive: true });

/** How much slower the page's animations run while a move is recorded, and how much slower than the game the picture plays. */
const RECORD_RATE = 0.1;
const PLAYBACK = 3;
const BASE = `${GAME}.scene.getScene('base')`;
const SCREENS = `document.querySelectorAll('#screens > .menu-overlay').length`;
const LEAVING = `document.querySelectorAll('.screens-leaving').length`;
/** Every move the overlay started on a screen (not a rule's own looping one): how many, when the last ends, and any that is not stepped. */
const MOVES = `JSON.stringify((() => { const all = document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && a.effect?.target?.closest?.('.menu-overlay'));
  const timings = all.map((a) => a.effect.getTiming());
  return { count: all.length, endMs: Math.max(0, ...timings.map((t) => (t.delay ?? 0) + Number(t.duration ?? 0))), eased: timings.filter((t) => !String(t.easing).startsWith('steps(')).length }; })())`;

const faults = [];
const fail = (why) => {
  faults.push(why);
  console.log(`  FAULT ${why}`);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels&menumotion=1`);
  const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 90_000 });
  const harbour = async () => {
    await page.send('Page.navigate', { url: `${url}?testmode=pixels&menumotion=1` });
    await until(sceneIs('title'), 'the title');
    await page.tap('Space');
    await until(`${sceneIs('base')} && ${BASE}.ready`, 'the harbour');
    await sleep(600);
  };
  // An attached browser keeps the last driver's save: start from none.
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: `${url}?testmode=pixels&menumotion=1` });
  await until(sceneIs('title'), 'the title');
  await page.tap('Space');
  await until(sceneIs('base'), 'the harbour');
  await until(`${BASE}?.takeStarterForDriver?.("squirtle") === true`, 'Squirtle off the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.stash.items, { 'poke-ball': 6, 'great-ball': 2, potion: 5, 'mooring-rope': 2, 'lamp-oil': 2, money: 640 });
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await harbour();
  await page.send('Animation.enable');

  /** Frames of whatever `act` starts, until `frames` of them are taken; `act` is not waited on first. */
  const record = async (name, act, frames) => {
    await page.send('Animation.setPlaybackRate', { playbackRate: RECORD_RATE });
    const taken = [];
    const stamps = [];
    const started = Date.now();
    const acting = act();
    for (let at = 0; at < frames; at += 1) {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 0.5 } });
      taken.push(decodePng(Buffer.from(data, 'base64')));
      stamps.push(Date.now() - started);
    }
    await acting;
    await page.send('Animation.setPlaybackRate', { playbackRate: 1 });
    // Each frame held as long as it stood, brought back to three times slower than the game; the last one rests.
    const held = stamps.map((stamp, index) => (index + 1 < stamps.length ? Math.max(20, (stamps[index + 1] - stamp) * RECORD_RATE * PLAYBACK) : 1200));
    writeFileSync(`${out}/${name}.png`, animatedPng(taken, held));
    return taken;
  };

  /** Opens a screen with `open`, checks its arrival, closes it with Escape and checks its leaving. */
  const play = async (name, open, { following = false, up = `document.querySelector('#screens .px-screen') !== null` } = {}) => {
    // Slowed while they are counted: a tab's moves are over in an eighth of a
    // second, before a question can be asked of the page. What a move's timing
    // says is the game's own, whatever the page plays it at.
    await page.send('Animation.setPlaybackRate', { playbackRate: RECORD_RATE });
    await open();
    await until(`${SCREENS} > 0 && ${up}`, `${name} on screen`);
    const moves = JSON.parse(await page.evaluate(MOVES));
    await page.send('Animation.setPlaybackRate', { playbackRate: 1 });
    console.log(`${name}: ${moves.count} moves, the last over at ${moves.endMs}ms`);
    if (moves.count === 0) fail(`${name} arrived with nothing moving`);
    if (moves.eased > 0) fail(`${name} has ${moves.eased} moves that are not stepped`);
    if (moves.endMs > 260) fail(`${name} takes ${moves.endMs}ms to arrive`);
    await sleep(500);
    if (following) return moves;
    await page.tap('Escape');
    await until(`${SCREENS} === 0`, `${name} out of the menu layer`);
    const leaving = Number(await page.evaluate(LEAVING));
    await sleep(450);
    if (Number(await page.evaluate(LEAVING)) !== 0) fail(`${name} left its leaving layer behind`);
    console.log(`  closed: out of the menu layer at once, ${leaving === 1 ? 'seen leaving' : 'already gone when looked at'}, nothing left behind`);
    return moves;
  };

  const whole = await play('YOUR THINGS', () => page.tap('KeyB'));
  await play('THE POKéDEX', () => page.tap('KeyX'));
  await play('FAVOURS', () => page.tap('KeyO'));
  await page.evaluate(`${BASE}.openThings(undefined, true)`);
  await until(`${sceneIs('things')} && document.querySelector('#screens [data-chest-tab="pokemon"]') !== null`, 'the chest');
  await sleep(500);
  // The tab is up when its own grid is: the screen it follows is still there to be found until then.
  const tab = await play("THE CHEST's POKéMON tab", () => page.tap('KeyP'), { following: true, up: `document.querySelector('#screens .chest-mon-grid') !== null` });
  if (tab.endMs >= whole.endMs) fail(`a tab takes as long to arrive as a whole screen (${tab.endMs}ms against ${whole.endMs}ms)`);
  if (tab.count >= whole.count) fail(`a tab moves as much as a whole screen (${tab.count} against ${whole.count})`);
  await page.tap('Escape');
  await until(`${SCREENS} === 0`, 'the chest shut');
  await sleep(600);

  // The pictures: the same moves again, slowed.
  await harbour();
  const opening = await record('after-open', () => page.tap('KeyB'), 20);
  // What a cut is, for setting beside it: the place, then the whole screen.
  writeFileSync(`${out}/cut.png`, animatedPng([opening[0], opening.at(-1)], [1200, 1200]));
  await sleep(1500);
  await record('after-close', () => page.tap('Escape'), 10);
  await sleep(1500);

  // Reduced motion: nothing moves, nothing is left behind.
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.tap('KeyB');
  await until(`${SCREENS} > 0 && document.querySelector('#screens .px-screen') !== null`, 'YOUR THINGS with reduced motion');
  const still = JSON.parse(await page.evaluate(MOVES));
  if (still.count !== 0) fail(`${still.count} moves played with reduced motion asked for`);
  await page.tap('Escape');
  await until(`${SCREENS} === 0`, 'YOUR THINGS shut');
  if (Number(await page.evaluate(LEAVING)) !== 0) fail('a screen was left leaving with reduced motion asked for');
  console.log('reduced motion: nothing moves, nothing is left behind');
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`menuMotion: ${faults.length} faults`);
  process.exit(1);
}
console.log('menuMotion: every check passed');
