// THE RAID ARENA's jump-in card, on a save that has raided a while: two
// Pokémon, five ways in, a job on the board and supplies in the pack. It
// photographs the card and then plays its keys, and fails when an arrow does
// two different jobs - which it did until 25 Nov 2026: an arrow moved the map's
// pointer while a landing lay that way and the button highlight when none did,
// so five Lefts in a row went landing, landing, button, button, button.
//
//   node tools/playtest/rimCard.mjs <url> <out dir> [--window=1280x800] [--device=landscape|portrait] [--name=prefix]
//
// The rule it holds the card to (`hub/rimKeys.ts`): Up and Down move the
// highlight between the card's rows, Left and Right change the value a row
// holds (the landing, the job, the sky) or step along the buttons on the
// bottom row, and nothing else moves the landing but a click on a light.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
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

const browser = await launchBrowser({ window: device ? { width: device.width, height: device.height } : { width, height } });
try {
  const page = await browser.openPage('about:blank');
  if (device) await emulateDevice(page, device);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  const press = async (code) => { await page.tap(code); await sleep(250); };
  const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60_000 });

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
    return JSON.stringify({ landing: hub.flow.insertionId, focus: a ? a.dataset.rimRow ?? (a.hasAttribute('data-start') ? 'jump' : a.hasAttribute('data-back') ? 'not-yet' : a.tagName) : null }); })()`;
  const read = async () => JSON.parse(await page.evaluate(state));

  if (!keysOnly) {
    await page.screenshot(`${out}/${prefix}-card.png`);
    console.log(`${prefix}-card`);
  }

  // The keys. Each press is recorded as which of the two things it changed.
  const log = [];
  let before = await read();
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowLeft']) {
    await press(key);
    const after = await read();
    log.push({ key, landing: after.landing !== before.landing, focus: after.focus !== before.focus, at: after.focus, way: after.landing.replace('greystone-vale-', '') });
    if (key === 'ArrowUp' && after.focus === 'landing' && !keysOnly) await page.screenshot(`${out}/${prefix}-on-land.png`);
    before = after;
  }
  for (const entry of log) console.log(JSON.stringify(entry));
  // An arrow never moves both, and only Left and Right on the landing's own row move the landing.
  const wrong = log.filter(
    (entry) => entry.landing && (entry.focus || entry.at !== 'landing' || !/^(ArrowLeft|ArrowRight)$/.test(entry.key)),
  );
  if (!keysOnly) {
    await page.screenshot(`${out}/${prefix}-after-keys.png`);
  }
  // And on the landing's own row, Left and Right do move it: three presses, three landings.
  const moved = log.filter((entry) => entry.landing).length;
  if (moved !== 3) {
    throw new Error(`Left and Right on the LAND row moved the landing ${moved} times of 3`);
  }
  if (wrong.length > 0) {
    throw new Error(`an arrow moved the landing where it should not have: ${JSON.stringify(wrong)}`);
  }
} finally {
  await browser.close();
}
