// Photographs THE POKéDEX (`scenes/PokedexScene.ts`, drawn by
// `ui/pokedexView.ts`) on a save part of the way through it and plays every key
// path on it:
//
//   - X in the yard opens it: the count, the rail of Oak's milestones, and all
//     151 as tiles - owned in colour, met as silhouettes, never met as balls;
//   - the arrow keys reach every one of the 151 from where the cursor starts
//     (a breadth-first walk over the four arrows), and fail if any is out of
//     reach - the one thing a screenshot cannot show;
//   - ENTER on an owned kind opens its page, RIGHT and LEFT turn to the next
//     kind met and back, ENTER on CRY is taken, ESC goes back to the grid with
//     the cursor on the tile it left;
//   - ENTER on an empty ball opens nothing and says why;
//   - X closes it, and Oak's PC in his lab opens it too.
//
//   node tools/playtest/pokedexShots.mjs <test-mode build url> <out dir> [--window=WxH] [--before]
//
// `--before` drives a build from before the Pokédex had a screen: it shows that
// X does nothing in the yard and photographs Oak's lab, whose computers say
// nothing there.
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const BEFORE = args.includes('--before');
const FRAME_MS = 1000 / 60;
// A loaded machine pauses a browser ten seconds at a time: boot is given a minute.
const SLOW_MS = 60_000;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`pokedexShots: ${why}`);
};

/**
 * The save: 37 kinds owned (the three starter lines whole, the early routes,
 * Zapdos, and a shiny Pidgey and Magikarp among them), another 21 only met,
 * and Oak's first two rewards handed over - so the next thing to reach is 50.
 */
const OWNED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 23, 25, 26, 27, 29, 32, 35, 39, 41, 43, 46, 52, 54, 60, 74, 129, 133, 145];
const MET = [15, 18, 22, 24, 28, 30, 33, 42, 44, 48, 56, 58, 63, 66, 69, 72, 81, 92, 95, 130, 143];
const SHINY = [16, 129];

const browser = await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    await page.screenshot(`${out}/stuck.png`);
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const BASE = `${GAME}.scene.getScene('base')`;
  const DEX = `${GAME}.scene.getScene('pokedex')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready`;
  const PANEL = '#screens .pokedex-menu';
  const dexUp = `${sceneIs('pokedex')} && Boolean(document.querySelector('${PANEL} [data-dex]'))`;
  const pageUp = (dexId) => `Boolean(document.querySelector('${PANEL} [data-dex-page="${dexId}"]'))`;
  // What a glance gets: the words in view, the kinds wholly in view, and how
  // much of the screen is picture rather than words (the menu overhaul's own
  // measure, docs/screens/menu-overhaul/).
  const METRICS = `(() => {
    const panel = document.querySelector('${PANEL}');
    const box = panel.getBoundingClientRect();
    const inView = (r, node) => {
      const pane = node.parentElement?.closest('.px-scroll');
      const clip = pane ? pane.getBoundingClientRect() : box;
      return r.width > 0 && r.height > 0 && r.top >= clip.top - 0.5 && r.bottom <= clip.bottom + 0.5 && r.top >= box.top && r.bottom <= box.bottom;
    };
    let words = 0;
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('.px-help, .visually-hidden, [hidden], input')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (inView(r, node)) words += node.textContent.trim().split(/\\s+/).length;
    }
    const tiles = [...panel.querySelectorAll('[data-dex]')].filter((n) => inView(n.getBoundingClientRect(), n)).length;
    const pictures = [...panel.querySelectorAll('.px-mon-icon, .dex-ball, .px-portrait img, .item-icon img')]
      .map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0)
      .reduce((sum, r) => sum + r.width * r.height, 0);
    return JSON.stringify({ words, tilesInView: tiles, pictureShare: Math.round((100 * pictures) / (box.width * box.height)) });
  })()`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const here = () => page.evaluate(`document.activeElement?.dataset?.dex ?? document.activeElement?.tagName ?? ''`);
  const focusTile = (dexId) => page.evaluate(`document.querySelector('${PANEL} [data-dex="${dexId}"]')?.focus()`);

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${BASE}?.takeStarterForDriver?.("bulbasaur") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon[0];
    const kept = [['pidgey', true], ['magikarp', true], ['zapdos', false], ['pikachu', false]];
    const extra = kept.map(([speciesId, shiny], i) => ({ id: 'seeded-' + i, pokemon: { ...partner.pokemon, speciesId, nickname: null, moves: ['Tackle'], level: 12 + i, xp: 0, currentHp: 999, ...(shiny ? { shiny: true } : {}) } }));
    save.stash.pokemon = [partner, ...extra];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: [partner.id, ...extra.map((p) => p.id)] }];
    save.raidProgress.pokedexOwned = ${JSON.stringify(OWNED)};
    save.raidProgress.pokedexSeen = ${JSON.stringify(MET)};
    save.raidProgress.pokedexShiny = ${JSON.stringify(SHINY)};
    save.raidProgress.pokedexRewards = [10, 25];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.evaluate(`void ${BASE}.scene.start('base', {})`);
  await until(baseReady, 'the harbour again');
  await press('Escape');
  await wait(300);
  await shoot('00-yard');

  if (BEFORE) {
    await press('KeyX');
    await wait(400);
    if (await page.evaluate(sceneIs('pokedex'))) fail('a build from before has a Pokédex');
    console.log('(before: X does nothing in the yard - there is no Pokédex to open)');
  } else {
    await press('KeyX');
    await until(dexUp, 'THE POKéDEX');
    await wait(500);
    await shoot('01-list');
    console.log(`glance: ${await page.evaluate(METRICS)}`);
    const opened = await here();
    console.log(`opened on ${opened}`);
    if (opened !== '1') fail(`the cursor opened on ${opened}, not the first kind met`);
    const drawn = await page.evaluate(`JSON.stringify(['owned', 'seen', 'unknown'].map((s) => document.querySelectorAll('${PANEL} .dex-tile.is-' + s).length))`);
    if (drawn !== JSON.stringify([OWNED.length, MET.length, 151 - OWNED.length - MET.length])) fail(`tiles drawn ${drawn}`);
    const stars = await page.evaluate(`[...document.querySelectorAll('${PANEL} .dex-tile.is-shiny')].map((t) => Number(t.dataset.dex))`);
    if (JSON.stringify(stars) !== JSON.stringify(SHINY)) fail(`shiny stars on ${stars}`);
    if (args.includes('--measure')) {
      console.log(await page.evaluate(`JSON.stringify([...document.querySelectorAll('${PANEL} .px-screen > *, ${PANEL} .dex-layout > *, ${PANEL} .dex-main > *, ${PANEL} .dex-band > *, ${PANEL} .dex-tiles')].map((n) => { const r = n.getBoundingClientRect(); const u = parseFloat(getComputedStyle(n).getPropertyValue('--u')); return [n.className.slice(0, 26), Math.round(r.left / u), Math.round(r.top / u), Math.round(r.width / u), Math.round(r.height / u)]; }))`));
      console.log(await page.evaluate(`JSON.stringify({ room: document.querySelector('${PANEL}').dataset.room, short: document.querySelector('${PANEL}').hasAttribute('data-short'), more: document.querySelector('${PANEL} .dex-tiles').hasAttribute('data-more') })`));
    }

    // Every one of the 151, reached by arrows alone.
    const seen = new Set([await here()]);
    const queue = [...seen];
    while (queue.length > 0) {
      const from = queue.shift();
      for (const arrow of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
        await focusTile(from);
        await press(arrow);
        const to = await here();
        if (to && /^\d+$/.test(to) && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    const missed = Array.from({ length: 151 }, (_, i) => String(i + 1)).filter((id) => !seen.has(id));
    console.log(`arrow keys: 151 tiles, ${missed.length ? `UNREACHABLE ${missed.join(', ')}` : 'every one reached'}`);
    if (missed.length) fail(`unreachable by arrow keys: ${missed.join(', ')}`);

    // A shiny, a silhouette and an empty ball under the cursor.
    await focusTile(16);
    await wait(200);
    await shoot('02-cursor-on-a-shiny');
    await focusTile(143);
    await wait(200);
    await shoot('03-cursor-on-one-only-met');

    // ENTER on an empty ball opens nothing and says why.
    await focusTile(150);
    await press('Enter');
    await wait(200);
    if ((await page.evaluate(`${DEX}.page`)) !== null) fail('an empty ball opened a page');
    const refusal = await page.evaluate(`document.querySelector('${PANEL} .px-status-line')?.textContent ?? ''`);
    if (!/not been met/.test(refusal)) fail(`an empty ball said "${refusal}"`);
    await shoot('04-empty-ball');
    console.log(`an empty ball: ${refusal}`);

    // ENTER on an owned kind is its page; RIGHT and LEFT turn; ESC goes back to its tile.
    await focusTile(25);
    await press('Enter');
    await until(pageUp(25), "PIKACHU's page");
    await wait(600);
    await shoot('05-page-owned');
    console.log(`page glance: ${await page.evaluate(METRICS)}`);
    const where = await page.evaluate(`[...document.querySelectorAll('${PANEL} .dex-where p')].map((p) => p.textContent)`);
    console.log(`PIKACHU is found: ${where.join(' | ')}`);
    if (where.length === 0) fail('the page names nowhere');
    await press('Enter');
    await wait(300);
    if ((await page.evaluate(`${DEX}.page`)) !== 25) fail('CRY left the page');
    await press('ArrowRight');
    await until(pageUp(26), "RAICHU's page, a page on");
    await press('ArrowLeft');
    await until(pageUp(25), "PIKACHU's page, a page back");
    await press('Escape');
    await until(`${dexUp} && ${DEX}.page === null`, 'the grid again');
    await wait(200);
    if ((await here()) !== '25') fail(`ESC came back to ${await here()}, not the tile it left`);

    // A shiny owned shows both; a kind only met is its shape; a legend stands on gold.
    for (const [dexId, name] of [[129, '06-page-shiny'], [143, '07-page-only-met'], [145, '08-page-legend']]) {
      await focusTile(dexId);
      await press('Enter');
      await until(pageUp(dexId), `the page of ${dexId}`);
      await wait(600);
      await shoot(name);
      await press('Backspace');
      await until(`${dexUp} && ${DEX}.page === null`, 'the grid again');
    }
    // The last page has nowhere on to go, and says so rather than turning.
    await focusTile(145);
    await press('Enter');
    await until(pageUp(145), "ZAPDOS's page");
    await press('ArrowRight');
    await wait(200);
    if ((await page.evaluate(`${DEX}.page`)) !== 145) fail('RIGHT turned past the last kind met');
    await press('KeyX');
    await until(`${baseReady} && !${sceneIs('pokedex')}`, 'the harbour after X on a page');
    console.log('pages: ENTER opens, CRY sounds, LEFT and RIGHT turn, ESC and BACKSPACE go back, X closes');
  }

  // Oak's lab: his computers along the back wall.
  await page.evaluate(`void ${BASE}.scene.start('base', { room: 'oaks-lab', at: { x: 3, y: 3 }, facing: 'up' })`);
  await until(baseReady, "Oak's lab");
  await press('Escape');
  await wait(600);
  await shoot('09-oaks-lab');
  if (!BEFORE) {
    await press('Space');
    await until(dexUp, "THE POKéDEX from Oak's PC");
    await press('KeyX');
    await until(`${baseReady} && !${sceneIs('pokedex')}`, 'the lab after X');
    console.log("Oak's PC opens it, and X closes it back to the lab");
  }
  console.log('pokedexShots: every check passed');
} finally {
  await browser.close();
}
