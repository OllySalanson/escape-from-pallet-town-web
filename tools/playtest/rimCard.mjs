// THE RAID ARENA's jump-in card, on a save that has raided a while: two
// Pokémon, five ways in, a job on the board and supplies in the pack. It
// photographs the card and then plays its keys, and fails when a key does two
// different jobs - which the arrows did until 25 Nov 2026 (the map's pointer
// one press, the buttons the next) - or when the arrows do anything but move
// between the drop-ins, or Enter does not jump in (the captain, 26 Nov 2026).
//
//   node tools/playtest/rimCard.mjs <url> <out dir> [--window=1280x800] [--device=landscape|portrait] [--name=prefix] [--keys] [--port=N]
//
// `--port` drives a browser already running on that CDP port (`attachBrowser`).
//
// The rule it holds the card to (`hub/rimCard.ts`): the arrows move between
// the drop-ins by where their lights lie and never the highlight, Tab moves the
// highlight and never the landing, and Enter jumps in.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, openHallPanel, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';
import { DEVICES, emulateDevice } from './phone.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const device = option('device') ? DEVICES[option('device')] : undefined;
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const prefix = option('name') ?? (device ? option('device') : `${width}x${height}`);
const keysOnly = args.includes('--keys');
mkdirSync(out, { recursive: true });

const LANDINGS = [
  'greystone-vale',
  'greystone-vale-moor-top',
  'greystone-vale-the-quarry',
  'greystone-vale-stepping-stones',
  'greystone-vale-farmhouse',
  'greystone-vale-the-dam',
];

const size = { window: device ? { width: device.width, height: device.height } : { width, height } };
const browser = option('port') ? attachBrowser(Number(option('port')), size) : await launchBrowser(size);
try {
  const page = await browser.openPage('about:blank');
  if (device) await emulateDevice(page, device);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  const press = async (code) => { await page.tap(code); await sleep(250); };
  const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60_000 });

  await until(sceneIs('title'), 'the title');
  // An attached browser keeps the last driver's save: start from none.
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await until(sceneIs('title'), 'the title');
  await press('Space');
  await until(sceneIs('base'), 'the harbour');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("squirtle") === true`, 'Squirtle off the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  // A save some raids in: five ways in walked to, three jobs banked, a Pikachu
  // caught, and supplies in the vault for the rack to pack.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
    p.firstContractExtracted = true;
    p.reachedInsertions = [...new Set([...(p.reachedInsertions ?? []), ...${JSON.stringify(LANDINGS)}])];
    p.standingContractsBanked = 3;
    for (const stored of save.stash.pokemon) { stored.pokemon.level = 8; stored.pokemon.currentHp = 9999; }
    save.stash.pokemon.push({ id: 'rim-card-pikachu', pokemon: { speciesId: 'pikachu', level: 9, currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } });
    if (Array.isArray(save.stash.boxes) && save.stash.boxes[0]) save.stash.boxes[0].pokemonIds.push('rim-card-pikachu');
    Object.assign(save.stash.items, { 'poke-ball': 3, 'great-ball': 1, potion: 4, leftovers: 1, satchel: 1 });
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await until(sceneIs('title'), 'the title again');
  await press('Space');
  await until(sceneIs('base'), 'the harbour again');
  await walkIntoBase(page, 'raid-arena');
  await until(takePokemon('Squirtle'), 'Squirtle on the bench');
  await until(takePokemon('Pikachu'), 'Pikachu on the bench');
  await openHallPanel(page, 'rim');
  await until(`!!document.querySelector('.arena-panel.is-rim button[data-start]')`, 'the rim card');
  await sleep(800);

  const state = `(() => { const hub = ${GAME}.scene.getScene('hub'); const a = document.activeElement;
    // Which control, by what it is rather than what it says: a row's words change with its value.
    return JSON.stringify({ landing: hub.flow.insertionId, focus: a ? a.dataset.rimRow ?? (a.hasAttribute('data-start') ? 'jump' : a.hasAttribute('data-close') ? 'close' : a.tagName) : null }); })()`;
  const read = async () => JSON.parse(await page.evaluate(state));

  if (!keysOnly) {
    await page.screenshot(`${out}/${prefix}-card.png`);
    console.log(`${prefix}-card`);
  }

  // The keys. Each press is recorded as which of the two things it changed.
  const log = [];
  let before = await read();
  const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'KeyD', 'KeyW', 'Tab', 'Tab', 'ArrowRight', 'Tab', 'Tab', 'ArrowLeft'];
  for (const [index, key] of keys.entries()) {
    await press(key);
    const after = await read();
    log.push({ key, landing: after.landing !== before.landing, focus: after.focus !== before.focus, at: after.focus, way: after.landing.replace('greystone-vale-', '') });
    if (index === 2 && !keysOnly) await page.screenshot(`${out}/${prefix}-arrowed.png`);
    before = after;
  }
  for (const entry of log) console.log(JSON.stringify(entry));
  const arrow = (entry) => /^(Arrow|Key[WASD])/.test(entry.key);
  // An arrow never moves the highlight, and Tab never moves the landing.
  const wrong = log.filter((entry) => (arrow(entry) && entry.focus) || (entry.key === 'Tab' && entry.landing));
  if (!keysOnly) {
    await page.screenshot(`${out}/${prefix}-after-keys.png`);
  }
  // And the arrows do move it: most presses land somewhere new.
  const moved = log.filter((entry) => arrow(entry) && entry.landing).length;
  if (moved < 5) {
    throw new Error(`the arrows moved the landing only ${moved} times`);
  }
  if (wrong.length > 0) {
    throw new Error(`a key did another key's job: ${JSON.stringify(wrong)}`);
  }
  // Enter jumps in, from wherever the highlight is.
  await press('Enter');
  await until(`${sceneIs('world')} || !document.querySelector('.arena-panel.is-rim')`, 'Enter to jump in');
  console.log('Enter jumped in');
} finally {
  await browser.close();
}
