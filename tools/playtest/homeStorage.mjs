// Plays home storage end to end (`base/homeGarden.ts`, MY PC in `base/rooms.ts`):
// a new game is given a few raids' worth of things and eight Pokémon in its
// boxes, then:
//
//   - THE BOLTHOLE's door says what is kept there;
//   - six of the boxed Pokémon walk about the garden beside the house - the six
//     highest level, never the partner - and facing one says who it is and asks
//     to take it on the next raid; YES writes it onto the team;
//   - MY PC upstairs opens storage, headed MY PC, with every thing in pockets,
//     and its garden chip brings a Pokémon in and puts another out;
//   - BILL'S PC at the Center is the same storage in the same pockets.
//
//   node tools/playtest/homeStorage.mjs <test-mode build url> <out dir> [--port=CDP port] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`homeStorage: ${why}`);
};

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
  const base = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const start = async (data, what) => {
    await page.evaluate(`void ${base}.scene.start('base', ${JSON.stringify(data)})`);
    await until(baseReady, what);
    await wait(400);
    // The first key after a scene is started again by hand is spent on nothing.
    await press('Escape');
    await wait(200);
  };
  const readBox = async () => {
    for (let guard = 0; guard < 20 && (await page.evaluate(`${base}.dialogBox.visible`)); guard += 1) {
      await press('Space');
      await wait(250);
    }
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // A few raids home: things of every kind, and eight more Pokémon in the boxes.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...(save.stash.items ?? {}), potion: 4, 'super-potion': 1, 'poke-ball': 6, 'great-ball': 2,
      'tm40-aerial-ace': 1, 'thunder-stone': 1, money: 640, 'cable-coil': 2, 'linen-roll': 3, 'old-rod': 1, 'ranger-pack': 1 };
    const partner = save.stash.pokemon[0].pokemon;
    const kinds = [['pikachu', 14], ['rattata', 6], ['pidgey', 11], ['oddish', 9], ['psyduck', 13], ['eevee', 12], ['geodude', 10], ['magikarp', 5]]
      .filter(([, level]) => level > 0);
    kinds.forEach(([speciesId, level], index) => {
      const id = speciesId + '-' + (90 + index);
      save.stash.pokemon.push({ id, pokemon: { ...partner, speciesId, level, currentHp: 999, xp: level * level * level, moves: ['Tackle'], nickname: null, heldItemId: null, primaryStatus: null } });
      if (save.stash.boxes?.[0]) save.stash.boxes[0].pokemonIds.push(id);
    });
    save.raidProgress.raidsDeployed = 3;
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 3, extracted: 2, wiped: 1 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);

  // The yard, standing in front of the house.
  await start({ at: { x: 40, y: 13 }, facing: 'up' }, 'the yard by the house');
  await shoot('01-garden');
  const out1 = await page.evaluate(`${base}.garden?.out ?? []`);
  console.log(`garden: ${out1.map((one) => `${one.id}@${one.tile.x},${one.tile.y}`).join(' ')}`);
  if (out1.length !== 6) fail(`${out1.length} Pokémon in the garden, not 6`);
  const ids = out1.map((one) => one.id);
  if (ids.some((id) => id.startsWith('charmander'))) fail('the partner is in the garden');
  if (ids.includes('rattata-91') || ids.includes('magikarp-97')) fail('a low level one is out before a higher one');
  // Held L names everything in view: the house's door says what is kept there.
  await page.keyDown('KeyL');
  await step(10);
  await shoot('01b-door-caption');
  await page.keyUp('KeyL');
  await step(2);

  // Face one from below, standing where no garden Pokémon is ever put - the
  // path, or the lawn in front of the mast's foot - so the garden is laid out
  // just as it was when the yard is drawn again.
  const target = out1.find((one) => one.tile.y === 11 || (one.tile.x === 42 && one.tile.y === 10));
  if (!target) fail('nobody in the garden can be faced from below');
  const stand = { x: target.tile.x, y: target.tile.y + 1 };
  await start({ at: stand, facing: 'up' }, 'beside a garden Pokémon');
  const facing = await page.evaluate(`(() => { const g = ${base}.garden; return g?.out.find((one) => one.tile.x === ${stand.x} && one.tile.y === ${stand.y - 1})?.id ?? null; })()`);
  if (!facing) fail(`nobody stands above ${stand.x},${stand.y} once the yard is drawn again`);
  await press('Space');
  await wait(300);
  await shoot('02-garden-pokemon-says');
  for (let guard = 0; guard < 6 && (await page.evaluate(`${base}.dialogBox.visible`)); guard += 1) {
    await press('Space');
    await wait(250);
  }
  await until(`${base}.boxQuestion !== null`, 'the question');
  await shoot('03-take-it');
  await press('Space');
  await wait(300);
  await shoot('04-taken');
  await readBox();
  const afterYes = await saved();
  if (!(afterYes.raidProgress.lastBench ?? []).includes(facing)) fail(`${facing} is not on the team`);
  const out2 = await page.evaluate(`${base}.garden?.out.map((one) => one.id) ?? []`);
  if (out2.includes(facing)) fail(`${facing} is still in the garden once on the team`);
  console.log(`took ${facing} onto the team; the garden now holds ${out2.length}`);

  // MY PC upstairs.
  await start({ room: 'bolthole-upstairs', at: { x: 0, y: 2 }, facing: 'up' }, 'upstairs');
  await shoot('05-upstairs');
  await press('Space');
  await until(`${sceneIs('hub')} && Boolean(document.querySelector('#screens .px-title'))`, 'MY PC');
  await wait(400);
  await shoot('06-my-pc');
  const title = await page.evaluate(`document.querySelector('#screens .px-title')?.textContent ?? ''`);
  if (!/My PC/i.test(title)) fail(`the PC is headed "${title}"`);
  const pockets = await page.evaluate(`[...document.querySelectorAll('#screens .stash-side .px-subheading')].map((h) => h.textContent)`);
  console.log(`MY PC title: ${title.trim()} · pockets: ${pockets.join(', ')}`);
  for (const pocket of ['Medicine', 'Poké Balls', 'Discs', 'Stones', 'Tools', 'Packs', 'Found goods']) {
    if (!pockets.includes(pocket)) fail(`no ${pocket} pocket on MY PC`);
  }
  // Bring the first one out in the garden in, and put the highest one left in its box out.
  const garden = await page.evaluate(`(() => [...document.querySelectorAll('#screens [data-garden]')].map((chip) => ({ id: chip.dataset.garden, label: chip.textContent })))()`);
  const inGarden = garden.find((chip) => /In the garden/.test(chip.label));
  const inBox = garden.find((chip) => /Out to garden/.test(chip.label));
  if (!inGarden || !inBox) fail(`garden chips: ${JSON.stringify(garden)}`);
  await page.evaluate(`document.querySelector('#screens [data-garden="${inGarden.id}"]').click()`);
  await wait(300);
  await page.evaluate(`document.querySelector('#screens [data-garden="${inBox.id}"]').click()`);
  await wait(300);
  await page.evaluate(`document.querySelector('#screens [data-shows="${inBox.id}"]')?.focus()`);
  await wait(200);
  await shoot('07-my-pc-garden-chip');
  const chosen = (await saved()).raidProgress.garden ?? [];
  if (chosen.includes(inGarden.id) || !chosen.includes(inBox.id)) fail(`the garden saved as ${chosen.join(', ')}`);
  console.log(`brought ${inGarden.id} in and put ${inBox.id} out: ${chosen.join(', ')}`);
  await page.evaluate(`document.querySelector('#screens [data-back]').click()`);
  await until(`${baseReady} && ${base}.room?.id === 'bolthole-upstairs'`, 'upstairs again');

  // The garden as chosen.
  await start({ at: { x: 40, y: 13 }, facing: 'up' }, 'the yard again');
  const out3 = await page.evaluate(`${base}.garden?.out.map((one) => one.id) ?? []`);
  if (out3.includes(inGarden.id) || !out3.includes(inBox.id)) fail(`the garden shows ${out3.join(', ')}`);
  await shoot('08-garden-as-chosen');

  // A visitor's eye: the PC is the owner's.
  // BILL'S PC at the Center: the same storage, in the same pockets.
  await start({ room: 'pokemon-centre' }, 'the Center');
  await page.evaluate(`void ${base}.openHub({ savedGame: ${base}.savedGame, view: 'stash', from: 'pokemon-centre' })`);
  await until(`${sceneIs('hub')} && Boolean(document.querySelector('#screens .px-title'))`, "BILL'S PC");
  await wait(400);
  await shoot('09-bills-pc');
  const billTitle = await page.evaluate(`document.querySelector('#screens .px-title')?.textContent ?? ''`);
  const billPockets = await page.evaluate(`[...document.querySelectorAll('#screens .stash-side .px-subheading')].map((h) => h.textContent)`);
  if (!/Bill/i.test(billTitle) || billPockets.join() !== pockets.join()) fail(`Bill's PC: ${billTitle} · ${billPockets.join(', ')}`);
  console.log(`BILL'S PC: ${billTitle.trim()} · the same pockets`);
  console.log('homeStorage: every check passed');
} finally {
  await browser.close();
}
