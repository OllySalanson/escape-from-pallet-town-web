// Plays YOUR THINGS end to end (`scenes/ThingsScene.ts`): a new game is given
// a few raids' worth of things - medicine, balls, a TM and an HM, two stones,
// found goods, furniture and clothes - and a Pikachu in its boxes, then:
//
//   - B in the yard opens the panel, every pocket shows, nothing can be dropped,
//     and B closes it onto the harbour again;
//   - TM40 is read to the partner at home, and the disc is gone from storage;
//   - two quick ENTERs on a Thunder Stone open the list of who it is for and
//     evolve nobody; then it is used on the Pikachu, which evolves on a moment
//     of its own that a key ends, and is a Raichu at home;
//   - B opens it in every room of the harbour, and in THE RAID ARENA's hall,
//     where it shows the pack the rack has out.
//
//   node tools/playtest/yourThings.mjs <test-mode build url> <out dir> [--port=CDP port] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`yourThings: ${why}`);
};

/** Every room a player can stand in, by its id in `base/rooms.ts`. */
const ROOMS = [
  'oaks-lab',
  'pokemon-centre',
  'brocks-workshop',
  'bills-cottage',
  'boutique',
  'game-corner',
  'prize-window',
  'bolthole',
  'bolthole-upstairs',
];

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;
  const thingsUp = `${sceneIs('things')} && Boolean(document.querySelector('#screens .things-menu'))`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const click = async (selector) => {
    const found = await page.evaluate(`(() => { const el = document.querySelector('#screens .things-menu ${selector}'); el?.click(); return Boolean(el); })()`);
    if (!found) fail(`no ${selector} on the panel`);
    await wait(200);
  };
  const openThings = async (where) => {
    await press('KeyB');
    await until(thingsUp, `YOUR THINGS ${where}`);
    await wait(300);
  };
  const closeThings = async (where) => {
    await press('KeyB');
    await until(`!${sceneIs('things')} && ${baseReady} && !${GAME}.scene.isPaused('base')`, `the harbour again after ${where}`);
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // What a few raids bring home, and a Pikachu in the boxes for the stone.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...(save.stash.items ?? {}), potion: 4, 'super-potion': 1, 'poke-ball': 6, 'great-ball': 2,
      'tm40-aerial-ace': 1, 'hm01-cut': 1, 'thunder-stone': 1, 'fire-stone': 1, money: 640, 'cable-coil': 2,
      'linen-roll': 3, 'old-rod': 1, 'ranger-pack': 1 };
    const partner = save.stash.pokemon[0].pokemon;
    const id = 'pikachu-77';
    save.stash.pokemon.push({ id, pokemon: { ...partner, speciesId: 'pikachu', level: 12, xp: 1728, moves: ['Thunder Shock', 'Growl'], nickname: null } });
    if (save.stash.boxes?.[0]) save.stash.boxes[0].pokemonIds.push(id);
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', {})`);
  await until(baseReady, 'the harbour again');

  // In the yard.
  // The first key after a scene is started again by hand is spent on nothing
  // (O as much as B), so one is pressed that does nothing in the yard.
  await press('Escape');
  await wait(300);
  await openThings('in the yard');
  await shoot('01-yard-things');
  const headings = await page.evaluate(`[...document.querySelectorAll('#screens .things-menu .px-subheading')].map((h) => h.textContent)`);
  console.log(`pockets: ${headings.join(', ')}`);
  for (const pocket of ['Medicine', 'Poké Balls', 'Discs', 'Stones', 'Tools', 'Packs', 'Found goods']) {
    if (!headings.includes(pocket)) fail(`no ${pocket} pocket`);
  }
  if (await page.evaluate(`Boolean(document.querySelector('#screens .things-menu [data-drop]'))`)) fail('something can be dropped');
  if (!(await page.evaluate(`document.querySelector('#screens .things-menu .things-pack')?.textContent.includes('Next raid')`))) {
    fail('the next raid pack is not shown');
  }
  // A row that is not used here says where it is.
  await click('[data-thing="cable-coil"]');
  const said = await page.evaluate(`document.querySelector('#screens .things-menu .px-status-line')?.textContent ?? ''`);
  if (!/Brock/.test(said)) fail(`a cable coil says "${said}"`);
  await shoot('02-where-it-is-used');

  // A TM read at home.
  await click('[data-thing="tm40-aerial-ace"]');
  await shoot('03-teach-at-home');
  await click('[data-pupil="0"]');
  // A press within RELEASE_ARMING_MS (500ms) of the question appearing is the
  // second half of a double-tap, and answers nothing (`BagScene`, `ThingsScene`).
  await wait(400);
  await click('[data-teach]');
  await wait(300);
  await shoot('04-taught');
  const taught = await saved();
  const charmander = taught.stash.pokemon.find((entry) => entry.pokemon.speciesId === 'charmander');
  const moves = JSON.stringify(charmander);
  if (!/Aerial Ace/i.test(moves)) fail('TM40 was not learned');
  if ((taught.stash.items['tm40-aerial-ace'] ?? 0) !== 0) fail('TM40 is still in storage');

  // A stone used at home. Two quick ENTERs on its row open the list of who it
  // is for and evolve nobody: the second is the double-tap's, and it lands on
  // the first able Pokémon on a list nobody has seen (playtest of PRs 490-508).
  await page.evaluate(`document.querySelector('#screens .things-menu [data-thing="thunder-stone"]').focus()`);
  await press('Enter');
  await press('Enter');
  await wait(100);
  if (!(await page.evaluate(`Boolean(document.querySelector('#screens .things-menu [data-target]'))`))) {
    fail('a double ENTER on the stone did not leave the list of who it is for');
  }
  if (await page.evaluate(`Boolean(document.querySelector('#screens [data-evolve-moment]'))`)) {
    fail('a double ENTER on the stone evolved somebody');
  }
  const unspent = await saved();
  if ((unspent.stash.items['thunder-stone'] ?? 0) !== 1) fail('a double ENTER on the stone spent it');
  console.log('a double ENTER on the stone opens who it is for and spends nothing');
  await shoot('05-stone-targets');
  await wait(400);
  await click('[data-target="0"]');
  await wait(600);
  await shoot('06-evolved');
  const evolved = await saved();
  if (!JSON.stringify(evolved.stash.pokemon).includes('raichu')) fail('the Pikachu did not evolve');
  if ((evolved.stash.items['thunder-stone'] ?? 0) !== 0) fail('the Thunder Stone is still in storage');
  // The evolution is a moment of its own (`ui/evolveMoment.ts`): it ignores
  // keys until it has been seen, then any key ends it, back on the list - so
  // the B that closes the panel comes after that key, not instead of it.
  if (!(await page.evaluate(`Boolean(document.querySelector('#screens [data-evolve-moment]'))`))) {
    fail('the evolution was not shown as a moment');
  }
  await wait(1200);
  await press('Enter');
  await until(`!document.querySelector('#screens [data-evolve-moment]') && ${thingsUp}`, 'the list again after the evolution');
  const after = await page.evaluate(`document.querySelector('#screens .things-menu .px-status-line')?.textContent ?? ''`);
  if (!/Raichu/.test(after)) fail(`the list says "${after}" after the evolution`);
  await closeThings('the yard');

  // Every room.
  for (const room of ROOMS) {
    await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', { room: '${room}' })`);
    await until(`${baseReady} && ${GAME}.scene.getScene('base').room?.id === '${room}'`, `the ${room}`);
    await wait(400);
    // Anything said on the way in is read first, and the first key after a
    // restart by hand is spent on nothing.
    await press('Escape');
    await wait(200);
    for (let guard = 0; guard < 20 && (await page.evaluate(`${GAME}.scene.getScene('base').dialogBox.visible`)); guard += 1) {
      await press('Escape');
      await wait(200);
    }
    await openThings(`in ${room}`);
    if (room === 'bolthole-upstairs') await shoot('07-upstairs');
    await closeThings(room);
    console.log(`B opens YOUR THINGS in ${room}`);
  }

  // THE RAID ARENA's hall, where the pack shown is the one on the rack.
  await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', {})`);
  await until(baseReady, 'the yard before the hall');
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  await press('Escape');
  await until(`${baseReady} && !${sceneIs('hub')}`, 'the hall with no panel');
  await wait(400);
  await openThings('in the hall');
  await shoot('08-hall');
  await closeThings('the hall');
  console.log('B opens YOUR THINGS in the hall');
  console.log('yourThings: every check passed');
} finally {
  await browser.close();
}
