// Photographs every pop-up the harbour opens over the yard - the dialogue box,
// the questions asked in it (a favour, a knock at the door), the phrase list,
// the knock screen, the name screen - and the screens its keys open, at one
// window size, on a realistic save.
//
//   node tools/playtest/popupShots.mjs <test-mode build url> <out dir> [--window=1280x800] [--only=a,b] [--raid]
//
// `--raid` also deploys and photographs what pops up out there: the raid's
// dialogue, a trainer's challenge, and a wild fight's command and move menus.
//
// The in-raid screens are `menuShots.mjs --raid`'s; the base's rooms are
// `menuShots.mjs`'s. This is the rest: what pops up while the player is walking
// about, which is where a menu is met most often.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const only = option('only')?.split(',') ?? null;
const raid = args.includes('--raid');
const tag = `${width}x${height}`;
mkdirSync(out, { recursive: true });

const page = (base) => `${base}${base.includes('?') ? '&' : '?'}testmode=pixels&harbour=local`;
const BASE = `${GAME}.scene.getScene('base')`;

const browser = await launchBrowser({ window: { width, height } });
let failed = 0;
try {
  const tab = await browser.openPage(page(url));
  const press = async (code) => { await tab.tap(code); await sleep(200); };
  const want = (name) => !only || only.includes(name);
  const shoot = async (name) => {
    await sleep(600);
    await tab.screenshot(`${out}/${name}-${tag}.png`);
    console.log(`  ${name}`);
  };
  /** Runs one pop-up: opens it, photographs it, closes it, and goes on if it throws. */
  const popup = async (name, open, close) => {
    if (!want(name)) return;
    try {
      await tab.evaluate(open);
      await shoot(name);
    } catch (error) {
      failed += 1;
      console.log(`  ${name}: FAILED ${error.message.split('\n')[0]}`);
    }
    try {
      await tab.evaluate(close);
    } catch {
      // Already shut.
    }
    for (let back = 0; back < 4 && !(await tab.evaluate(`${BASE}.sys.isActive() && !document.querySelector('.menu-overlay')`)); back += 1) {
      await press('Escape');
    }
    await sleep(300);
  };

  await tab.waitFor(sceneIs('title'));
  await sleep(1500);
  if (want('title')) await shoot('title');
  await press('Space');
  await tab.waitFor(sceneIs('base'));
  await sleep(800);
  if (want('starter')) await shoot('starter');
  await tab.waitFor(`${BASE}?.takeStarterForDriver?.("bulbasaur") === true`, { what: 'the partner taken' });
  await tab.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await tab.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.raidProgress, { firstContractExtracted: true, completedContracts: ['recover-lost-field-kit'],
      firstWordsHeard: ['lab', 'loadout', 'check', 'center'],
      errands: ['oaks-parcel', 'medicine-bag', 'brocks-crate', 'old-amber'].map((id) => ({ id, status: 'started', found: 0, lossesHeard: 0 })) });
    const seed = save.stash.pokemon[0];
    const species = ['pidgey', 'rattata', 'caterpie', 'weedle', 'oddish', 'poliwag', 'spearow', 'pikachu', 'nidoran-m', 'mankey', 'growlithe', 'abra'];
    const extra = species.map((speciesId, i) => ({ id: 'seeded-' + i, pokemon: { ...seed.pokemon, speciesId, moves: ['Tackle'], level: 5 + (i % 12), xp: 120 + i * 60, currentHp: i % 5 === 0 ? 6 : 999 } }));
    save.stash.pokemon = [seed, ...extra];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: [seed.id, ...extra.map((p) => p.id)] }];
    save.stash.items = { potion: 9, 'super-potion': 3, 'poke-ball': 8, 'great-ball': 4, antidote: 5, 'radio-valve': 3, 'cable-coil': 2, 'parts-crate': 2, 'lamp-oil': 4, 'mooring-rope': 1, 'linen-roll': 3, money: 260 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await tab.send('Page.navigate', { url: page(url) });
  await tab.waitFor(sceneIs('title'));
  await sleep(800);
  await press('Space');
  // A save with no name is asked for one on the way in - over the title or over
  // the yard, a moment after it is drawn: that screen is a pop-up too.
  for (let look = 0; look < 8; look += 1) {
    await sleep(700);
    if (await tab.evaluate(`!!document.querySelector('.player-name-menu')`)) {
      if (want('name-screen')) await shoot('name-screen');
      // LATER, by its button: the cursor starts in the name field, which keeps ESC.
      await tab.evaluate(`[...document.querySelectorAll('.player-name-menu button')].find((b) => b.textContent.trim().toUpperCase() === 'LATER')?.click()`);
      break;
    }
  }
  await tab.waitFor(`${BASE}.ready`).catch(async (error) => {
    await tab.screenshot(`${out}/stalled-${tag}.png`);
    console.log(await tab.evaluate(`JSON.stringify({ scenes: ${GAME}.scene.getScenes(true).map((s) => s.scene.key), overlay: document.querySelector(".menu-overlay")?.className ?? null, buttons: [...document.querySelectorAll(".menu-overlay button")].map((b) => b.textContent.trim()) })`));
    throw error;
  });
  await sleep(1200);
  // Whatever the yard says on arrival is read through first.
  for (let box = 0; box < 12 && (await tab.evaluate(`${BASE}.dialogBox.visible`)); box += 1) {
    await press('Space');
    await sleep(300);
  }
  if (want('yard')) await shoot('yard');

  const finishTyping = `(() => { const d = ${BASE}.dialogBox; for (let i = 0; i < 200 && !d.isCurrentMessageComplete; i += 1) d.update(100); })()`;
  await popup(
    'dialogue',
    `(() => { ${BASE}.dialogBox.showMessages(["Bill: Ah, there you are! The boat's in, and I've a crate of parts that wants carrying up to Brock."]); ${finishTyping}; })()`,
    `${BASE}.dialogBox.dismiss()`,
  );
  await popup(
    'favour-question',
    `${BASE}.askInBox('Will you fetch the parcel from the Old Mill for me?', () => {})`,
    `(() => { const b = ${BASE}; b.boxQuestion?.prompt.destroy(); b.boxQuestion = null; })()`,
  );
  await popup(
    'knock-at-door',
    `${BASE}.askToLetIn({ knockId: 'shot', knockerName: 'AMY' })`,
    `(() => { const b = ${BASE}; b.knockPrompt?.prompt.destroy(); b.knockPrompt = null; })()`,
  );
  await popup('phrases', `${BASE}.openPhrases()`, `${BASE}.closePhrases()`);
  await popup('knock-screen', `${BASE}.openKnock()`, `(() => { const b = ${BASE}; b.knockScreen?.destroy(); b.knockScreen = null; })()`);
  await popup('favours', `${BASE}.openFavours?.()`, '0');
  for (const [key, name] of [['KeyP', 'your-team'], ['KeyB', 'your-things'], ['KeyX', 'pokedex'], ['KeyF', 'feedback']]) {
    if (!want(name)) continue;
    await press(key);
    await sleep(500);
    await shoot(name);
    for (let back = 0; back < 4 && (await tab.evaluate(`!!document.querySelector('.menu-overlay')`)); back += 1) {
      await press('Escape');
    }
    await sleep(300);
  }

  if (raid) {
    const WORLD = `${GAME}.scene.getScene('world')`;
    const BATTLE = `${GAME}.scene.getScene('battle')`;
    await walkIntoBase(tab, 'raid-arena');
    await tab.waitFor(takePokemon('Bulbasaur'), { what: 'Bulbasaur in the raid party' });
    await jumpIn(tab, { until: (expression, what) => tab.waitFor(expression, { what }) });
    await tab.waitFor(sceneIs('world'), { what: 'the raid' });
    await sleep(1500);
    for (let box = 0; box < 12 && (await tab.evaluate(`${WORLD}.dialogBox?.visible === true`)); box += 1) {
      await press('Space');
      await sleep(350);
    }
    const worldFinish = `(() => { const d = ${WORLD}.dialogBox; for (let i = 0; i < 200 && !d.isCurrentMessageComplete; i += 1) d.update(100); })()`;
    if (want('raid-dialogue')) {
      await tab.evaluate(`(() => { ${WORLD}.dialogBox.showMessages(["Hiker Dewey: These hills are mine! Turn back, or show me what that Pokémon of yours can do."]); ${worldFinish}; })()`);
      await shoot('raid-dialogue');
      await tab.evaluate(`${WORLD}.dialogBox.dismiss()`);
    }
    if (want('leave-question')) {
      await tab.evaluate(`${WORLD}.askToLeaveTry ? (${WORLD}.trainerPrompt = null, ${WORLD}.askToLeaveTry()) : 0`);
      await shoot('leave-question');
      await tab.evaluate(`(() => { const w = ${WORLD}; w.trainerPrompt?.destroy(); w.trainerPrompt = null; })()`);
    }
    if (want('battle') || want('battle-moves')) {
      await tab.evaluate(`void ${WORLD}.transitionToBattle({ wild: { speciesId: 'rattata', level: 4 }, teachingBattle: false })`);
      await tab.waitFor(`${sceneIs('battle')} && ${BATTLE}.mode === 'main'`, { what: 'the command menu', timeoutMs: 60_000 }).catch(async () => {
        for (let i = 0; i < 20 && !(await tab.evaluate(`${BATTLE}.mode === 'main'`)); i += 1) await press('Space');
      });
      await shoot('battle');
      await press('Space');
      await sleep(400);
      await shoot('battle-moves');
    }
  }
} finally {
  await browser.close();
}
console.log(failed ? `${failed} pop-up(s) failed` : 'every pop-up photographed');
process.exitCode = failed ? 1 : 0;
