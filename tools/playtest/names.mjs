// Names, one each, and a new map's name, end to end over the local stand-in
// (`?harbour=local`, `src/game/names/nameService.ts`), which never reaches the
// live project. ASH is somebody else's in this test.
//
//   node tools/playtest/names.mjs <url> <out dir> [--window=1200x768]
//
// NEW GAME asks nothing, and the first CONTINUE asks YOUR NAME? (the hall asks as a first
// raid comes home, which needs a raid). "ash" is typed, the line under
// it says it is taken, and OK is refused; MISTY is free and is kept. CONTINUE
// does not ask again. A player with no name is asked at CONTINUE, and can put
// it off. MAKE A MAP starts a map with one of the world's names, and REROLL
// draws another. It fails loudly - a thrown error - when any of that does not
// happen, and photographs the screens on the way.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

const NAME_KEY = 'escape-from-pallet-town.player.name';
const address = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels&harbour=local`;
const screen = `(() => ({ up: !!document.querySelector('[data-name-field]'),
  value: document.querySelector('[data-name-field]')?.value ?? null,
  count: document.querySelector('[data-name-count]')?.textContent ?? null,
  status: document.querySelector('.player-name-menu .px-status-line')?.textContent ?? null }))()`;

async function type(page, text) {
  for (const character of text) {
    const upper = character.toUpperCase();
    const code = /[a-z]/i.test(character) ? `Key${upper}` : 'Space';
    const description = { code, key: character, text: character, windowsVirtualKeyCode: upper.charCodeAt(0) };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...description });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...description });
    await sleep(40);
  }
}

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(address, { init: `sessionStorage.setItem('eptw-names-local-taken', 'ASH');` });
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  const until = async (what, test, timeoutMs = 8000) => {
    const started = Date.now();
    for (;;) {
      const now = await page.evaluate(screen);
      if (test(now)) return now;
      if (Date.now() - started > timeoutMs) throw new Error(`${what}: ${JSON.stringify(now)}`);
      await sleep(150);
    }
  };
  const clearField = () => page.evaluate(`(() => { const f = document.querySelector('[data-name-field]'); f.value = ''; f.dispatchEvent(new Event('input')); f.focus(); })()`);

  // NEW GAME: nobody is stopped to be asked. The first CONTINUE asks.
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.removeItem('${NAME_KEY}')`);
  await press('Space');
  await page.waitFor(sceneIs('base'), { what: 'the lab with no name asked' });
  if ((await page.evaluate(screen)).up) throw new Error('NEW GAME asked for a name');
  await page.waitFor(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`,
  );
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await until('YOUR NAME? at the first CONTINUE', (s) => s.up);
  await sleep(450);
  await page.evaluate(`document.querySelector('[data-name-field]').focus()`);
  await type(page, 'ash');
  const taken = await until('ASH said to be taken', (s) => s.count?.includes('taken'));
  if (taken.value !== 'ASH') throw new Error(`the line holds "${taken.value}"`);
  await page.screenshot(`${out}/name-taken.png`);
  await press('Enter');
  const refused = await until('ASH refused', (s) => s.status?.includes('already has that name'));
  console.log(`ash: ${taken.count}; OK says "${refused.status}"`);
  await clearField();
  await type(page, 'misty');
  const free = await until('MISTY said to be free', (s) => s.count?.includes('free'));
  await page.screenshot(`${out}/name-free.png`);
  console.log(`misty: ${free.count}`);
  await press('Enter');
  await page.waitFor(sceneIs('base'), { what: 'the harbour after the name' });
  if ((await page.evaluate(`localStorage.getItem('${NAME_KEY}')`)) !== 'MISTY') throw new Error('MISTY was not kept');
  console.log('NEW GAME asked nothing; the first CONTINUE: named MISTY, then the harbour');

  // CONTINUE with a name: straight in.
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('base'), { what: 'CONTINUE straight into the harbour' });
  if ((await page.evaluate(screen)).up) throw new Error('CONTINUE asked a named player their name');
  console.log('CONTINUE with a name: not asked');

  // CONTINUE with no name: asked once, and LATER puts it off.
  await page.evaluate(`localStorage.removeItem('${NAME_KEY}')`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await until('YOUR NAME? at CONTINUE', (s) => s.up);
  await sleep(450);
  await page.screenshot(`${out}/name-continue.png`);
  await press('Escape');
  await page.waitFor(sceneIs('base'), { what: 'LATER into the harbour' });
  console.log('CONTINUE with no name: asked, and LATER went in without one');

  // MAKE A MAP: a world name, and REROLL.
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`(() => { const t = ${GAME}.scene.getScene('title'); t.choice = 'maker'; t.chooseSelected(); })()`);
  await page.waitFor(`!!document.querySelector('[data-map-name]')`, { what: 'the map maker', timeoutMs: 20000 });
  await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((b) => /^new$/i.test(b.textContent.trim())); b?.click(); })()`);
  await sleep(600);
  const first = await page.evaluate(`document.querySelector('[data-map-name]').value`);
  if (!first || /my map/i.test(first)) throw new Error(`a new map is called "${first}"`);
  await page.evaluate(`document.querySelector('[data-map-reroll]').click()`);
  await sleep(600);
  const second = await page.evaluate(`document.querySelector('[data-map-name]').value`);
  if (!second || second === first) throw new Error(`REROLL left "${first}" as "${second}"`);
  await page.evaluate(`document.querySelector('[data-map-name]').scrollIntoView({ block: 'center' })`);
  await sleep(300);
  await page.screenshot(`${out}/map-name.png`);
  console.log(`map names: "${first}", then "${second}"`);
} finally {
  await browser.close();
}
