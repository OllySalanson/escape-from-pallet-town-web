// A refusal at THE RAID ARENA's rim is said where it can be read
// (`.arena-panel.is-rim`, `HubScene.setStatus`): two tabs of one browser on one
// save, the way the bug hunt of 9 Nov found it.
//
//   node tools/playtest/rimRefusal.mjs <url> <out dir> [--window=800x512]
//
// OLLY starts a game and jumps into a raid. The second tab CONTINUEs the same
// save, walks to the Raid Arena, takes a Pokémon and goes to the rim, and its
// JUMP IN is refused - a raid is under way in the other window. The rim card has
// no help bar of its own, and the status line stood in the hidden one: the jump
// played the denied sound and said nothing. The line must be on screen, with
// its words, and gone again once it is taken down. It fails loudly - a thrown
// error - when any of that does not happen, and photographs the rim before the
// check it shows.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';
import { continueGame, nameTab, page } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

/** The rim's status line as it is drawn: its words and its size on the page. */
const statusLine = `(() => { const line = document.querySelector('.arena-panel.is-rim .px-status-line');
  if (!line) return null; const box = line.getBoundingClientRect();
  return { text: line.textContent.trim(), width: Math.round(box.width), height: Math.round(box.height) }; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  let front = null;
  const press = async (tab, code) => {
    if (front !== tab) {
      await tab.send('Page.bringToFront');
      front = tab;
    }
    await tab.tap(code);
    await sleep(220);
  };
  const until = (tab) => (expression, what) => tab.waitFor(expression, { what });

  // OLLY: a new game, a starter, and over the rail into a raid.
  const olly = await browser.openPage(page(url), { init: nameTab('OLLY') });
  await olly.waitFor(sceneIs('title'));
  await press(olly, 'Space');
  await olly.waitFor(sceneIs('base'), { what: 'NEW GAME, straight into the harbour' });
  await olly.waitFor(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`);
  await olly.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await walkIntoBase(olly, 'raid-arena', { press: (code) => press(olly, code) });
  await olly.waitFor(takePokemon(), { what: 'a Pokémon to take' });
  await jumpIn(olly, { press: (code) => press(olly, code), until: until(olly) });
  console.log('OLLY is raiding');

  // The second tab, on the same save, to the rim.
  const amy = await browser.openPage(page(url), { init: nameTab('AMY') });
  await amy.waitFor(sceneIs('title'));
  await continueGame(amy, press);
  await walkIntoBase(amy, 'raid-arena', { press: (code) => press(amy, code) });
  await amy.waitFor(takePokemon(), { what: 'a Pokémon to take' });
  await sleep(300);
  await openHallPanel(amy, 'rim', { press: (code) => press(amy, code), until: until(amy) });
  await amy.waitFor(`!!document.querySelector('.arena-panel.is-rim button[data-start]')`, { what: 'the rim card' });
  await sleep(400);
  await amy.screenshot(`${out}/r1-the-rim-card.png`);

  // JUMP IN, refused.
  await amy.evaluate(`document.querySelector('.arena-panel.is-rim button[data-start]').click()`);
  await sleep(400);
  const said = await amy.evaluate(statusLine);
  await amy.screenshot(`${out}/r2-jump-in-refused.png`);
  if (!said || !said.text.includes('another window')) throw new Error(`the rim said nothing of the raid elsewhere: ${JSON.stringify(said)}`);
  if (said.width === 0 || said.height === 0) throw new Error(`the rim's refusal is not on screen: ${JSON.stringify(said)}`);
  console.log(`JUMP IN refused, on screen at ${said.width}x${said.height}: "${said.text}"`);
  if (await amy.evaluate(sceneIs('world'))) throw new Error('the second tab jumped in anyway');

  // And taken down again, leaving the card as it was.
  await amy.waitFor(`${statusLine} === null`, { what: 'the refusal taken down', timeoutMs: 8_000 });
  const help = await amy.evaluate(`(() => { const help = document.querySelector('.arena-panel.is-rim .px-help'); return help ? getComputedStyle(help).display : null; })()`);
  if (help !== 'none') throw new Error(`the rim card kept a help bar once the refusal went: display ${help}`);
  console.log('the refusal went after its time, and the card has no help bar again');
} finally {
  await browser.close();
}
