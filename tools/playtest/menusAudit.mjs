// Photographs every menu, pop-up and card the harbour opens, one per page load,
// on a save some raids in - for the menus audit and the menu look's before and after (`docs/screens/menu-look/`).
//
//   node tools/playtest/menusAudit.mjs <test-mode build url> <out dir> [--only=name,..] [--window=1280x800] [--port=CDP port] [--fit]
//
// `--fit` also asks each screen whether everything on it is inside it, for a
// small-window pass: it names any card drawn past the foot or the side of the
// screen's body, and any card that is not a list and holds more than it shows
// (cut through, with no MORE strip to say so). It prints them and counts them;
// it does not fail the run, because a picture of the fault is the point.
//
// Each screen is opened the way the harbour opens it (the base scene's own
// opener, or a walk to its door), photographed, and the page reloaded, so one
// screen that will not open spoils no other. A screen that fails is reported
// and the run goes on.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
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

const FIT = args.includes('--fit');
/**
 * What is not inside the screen that holds it, by what a player would see:
 *
 *  - a card, a row, a tile or a line of words drawn past the foot or the side
 *    of the screen's body - out of its card and over whatever is under it;
 *  - one cut through from above or below by a card that is not a list (a list
 *    scrolls, and says MORE; anything else that clips is hiding something).
 *
 * Named by its classes, with by how many CSS pixels, once for each thing that
 * does the cutting. Words cut short at the side are left alone: a name too
 * long for its line is meant to stop there.
 */
const SPILLS = `JSON.stringify((() => {
  const body = document.querySelector('#screens .menu-overlay .px-body');
  if (!body) return [];
  const box = body.getBoundingClientRect();
  const name = (node) => String(node.className?.baseVal ?? node.className).split(/\\s+/).filter((each) => each && !['px-window', 'px-wrap', 'px-scroll', 'px-list'].includes(each)).slice(0, 2).join('.') || node.tagName.toLowerCase();
  const scrolls = (node) => { const style = getComputedStyle(node); return (style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1; };
  const clips = (node) => getComputedStyle(node).overflowY !== 'visible';
  const past = new Map();
  const cut = new Map();
  const worst = (map, key, by) => map.set(key, Math.max(map.get(key) ?? 0, by));
  for (const node of body.querySelectorAll('.px-window, .px-detail, .px-card, .px-row, .px-item-tile, button, strong, small, p, li, h2, h3')) {
    if (node.closest('[hidden]')) continue;
    const at = node.getBoundingClientRect();
    if (at.width < 1 || at.height < 1 || getComputedStyle(node).visibility === 'hidden') continue;
    // The nearest thing that clips it: a list is fine, anything else is a cut.
    let held = false;
    for (let up = node.parentElement; up && up !== body.parentElement; up = up.parentElement) {
      if (!clips(up)) continue;
      held = true;
      if (!scrolls(up) && !up.matches('.px-scroll')) {
        const by = Math.round(Math.max(at.bottom - up.getBoundingClientRect().bottom, up.getBoundingClientRect().top - at.top));
        // A whole line of words or more, not a rounding: a pixel of a descender is not a cut.
        if (by > 3 && at.top < up.getBoundingClientRect().bottom && at.bottom > up.getBoundingClientRect().top) worst(cut, name(up), by);
      }
      break;
    }
    if (!held) {
      const by = Math.round(Math.max(at.bottom - box.bottom, at.right - box.right, box.top - at.top, box.left - at.left));
      if (by > 1) worst(past, name(node), by);
    }
  }
  return [
    ...[...past].map(([what, by]) => what + ' is ' + by + 'px past the screen'),
    ...[...cut].map(([what, by]) => 'something in ' + what + ' is cut by ' + by + 'px'),
  ];
})())`;
let spills = 0;

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
  'brocks-workshop': hub('workshop'),
  'bills-cottage-shop': hub('trader'),
  'day-care': hub('daycare'),
  trades: hub('trades'),
  'friend-room': hub('friend'),
  'your-things': open('openThings()'),
  // THE CHEST in THE BOLTHOLE: its things, and its POKéMON tab.
  chest: open('openThings(undefined, true)'),
  'chest-pokemon': open('openChestPokemon(true)'),
  'your-team': open('openTeam()'),
  pokedex: open('openPokedex()'),
  'the-map': open('openMap()'),
  favours: open('openFavours()'),
  phrases: open('openPhrases()'),
  feedback: key('KeyF'),
  // The controls bar's two: SETTINGS and HELP.
  settings: async (page) => { await page.evaluate(`document.querySelector('.cb-settings').click()`); },
  help: async (page) => { await page.evaluate(`document.querySelector('.cb-help').click()`); },
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

// --port=N drives a browser already running on that CDP port (the machine's watched one) instead of launching its own.
const browser = option('port') ? attachBrowser(Number(option('port')), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
let failed = 0;
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  // An attached browser keeps the last driver's save: start from none, as a launched one does.
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
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
      if (FIT) {
        for (const spill of JSON.parse(await page.evaluate(SPILLS))) {
          spills += 1;
          console.log(`  SPILL ${name}: ${spill}`);
        }
      }
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${name}: ${String(error.message).slice(0, 160)}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`${failed} screens failed`);
if (FIT) console.log(`${spills} things not inside their screen at ${width}x${height}`);
