// Photographs every menu, pop-up and card the harbour opens, one per page load,
// on a save some raids in - for the menus audit and the menu look's before and after (`docs/screens/menu-look/`).
//
//   node tools/playtest/menusAudit.mjs <test-mode build url> <out dir> [--only=name,..] [--window=1280x800]
//
// Each screen is opened the way the harbour opens it (the base scene's own
// opener, or a walk to its door), photographed, and the page reloaded, so one
// screen that will not open spoils no other. A screen that fails is reported
// and the run goes on.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, openHallPanel, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const only = option('only')?.split(',');
// --team-of-two: the next raid's team is Squirtle and Pikachu rather than Squirtle alone.
const TEAM_OF_TWO = args.includes('--team-of-two');
// --with=spearow:9,abra:12: more Pokémon in the first box (the trader wants some kinds and not others).
const WITH = (option('with') ?? '').split(',').filter(Boolean).map((entry) => entry.split(':'));
mkdirSync(out, { recursive: true });

const BASE = `${GAME}.scene.getScene('base')`;
const open = (call) => async (page) => {
  await page.evaluate(`${BASE}.${call}`);
};
const hub = (view) => open(`openHub({ savedGame: ${BASE}.savedGame, view: '${view}', at: { ...${BASE}.currentTile } })`);
const key = (code) => async (page) => {
  await page.tap(code);
};

/** name -> how to open it. */
const SCREENS = {
  title: null,
  'harbour-yard': async () => undefined,
  'oaks-lab-room': async (page) => walkIntoBase(page, 'oaks-lab'),
  'oaks-wall-map': hub('wallmap'),
  'pokemon-centre-stash': hub('stash'),
  'brocks-workshop': hub('workshop'),
  'bills-cottage-shop': hub('trader'),
  'day-care': hub('daycare'),
  trades: hub('trades'),
  'friend-room': hub('friend'),
  'your-things': open('openThings()'),
  'your-team': open('openTeam()'),
  pokedex: open('openPokedex()'),
  'the-map': open('openMap()'),
  favours: open('openFavours()'),
  phrases: open('openPhrases()'),
  feedback: key('KeyF'),
  'console-games': open('openGames()'),
  'dojo-counter': open('openDojoCounter()'),
  'game-corner': open("openGameCorner('jump')"),
  'game-corner-prizes': open("openGameCorner('prizes')"),
  'boutique-shop': open("openBoutique('shop')"),
  'boutique-wardrobe': open("openBoutique('wardrobe')"),
  'library-book': open("openBook('bolthole')"),
  'hall-bench': async (page) => { await walkIntoBase(page, 'raid-arena'); await openHallPanel(page, 'bench'); },
  'hall-rack': async (page) => { await walkIntoBase(page, 'raid-arena'); await page.waitFor(takePokemon('Squirtle')); await openHallPanel(page, 'rack'); },
  'hall-locker': async (page) => { await walkIntoBase(page, 'raid-arena'); await page.waitFor(takePokemon('Squirtle')); await openHallPanel(page, 'locker'); },
};

const browser = await launchBrowser({ window: { width, height } });
let failed = 0;
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60_000 });
  await until(sceneIs('title'), 'the title');
  await page.screenshot(`${out}/title.png`);
  await page.tap('Space');
  await until(sceneIs('base'), 'the harbour');
  await until(`${BASE}?.takeStarterForDriver?.("squirtle") === true`, 'Squirtle off the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
    p.firstContractExtracted = true;
    p.reachedInsertions = [...new Set([...(p.reachedInsertions ?? []), 'greystone-vale-moor-top', 'greystone-vale-farmhouse', 'greystone-vale-the-dam'])];
    p.standingContractsBanked = 3;
    for (const stored of save.stash.pokemon) { stored.pokemon.level = 8; stored.pokemon.currentHp = 9999; }
    save.stash.pokemon.push({ id: 'audit-pikachu', pokemon: { speciesId: 'pikachu', level: 9, currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } });
    if (Array.isArray(save.stash.boxes) && save.stash.boxes[0]) save.stash.boxes[0].pokemonIds.push('audit-pikachu');
    for (const [speciesId, level] of ${JSON.stringify(WITH)}) { const id = 'audit-' + speciesId; save.stash.pokemon.push({ id, pokemon: { speciesId, level: Number(level), currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } }); if (Array.isArray(save.stash.boxes) && save.stash.boxes[0]) save.stash.boxes[0].pokemonIds.push(id); }
    if (${TEAM_OF_TWO}) p.lastBench = [save.stash.pokemon[0].id, 'audit-pikachu'];
    Object.assign(save.stash.items, { 'poke-ball': 6, 'great-ball': 2, potion: 5, leftovers: 1, satchel: 1, 'radio-valve': 3, 'mooring-rope': 2, money: 640 });
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  for (const [name, opener] of Object.entries(SCREENS)) {
    if (!opener || (only && !only.includes(name))) continue;
    try {
      await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
      await until(sceneIs('title'), 'the title');
      await page.tap('Space');
      await until(`${sceneIs('base')} && ${BASE}.ready`, 'the harbour');
      await sleep(600);
      await opener(page);
      await sleep(1500);
      await page.screenshot(`${out}/${name}.png`);
      console.log(`shot ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${name}: ${String(error.message).slice(0, 160)}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`${failed} screens failed`);
