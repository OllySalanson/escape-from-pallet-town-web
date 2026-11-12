// Photographs Bill's PC at the Pokémon Center (`HubScene.stashView`) on the
// save menuShots.mjs seeds - two dozen Pokémon, four of them hurt, and a shelf
// of a dozen supplies - and plays its key paths:
//
//   - the box bar, every Pokémon and every supply are reached by the arrow keys
//     from where the cursor starts;
//   - the dossier under the box follows the cursor;
//   - ENTER on a hurt one pays NURSE JOY's raid time and it is fit again;
//   - FIND narrows the box, and ESC leaves for the yard.
//
// It prints the glance measure of the menu overhaul's scorecards - words in
// view, Pokémon and supplies in view, how much of the screen is picture
// (`docs/screens/menu-overhaul/`); `--before` against a build from before.
//
//   node tools/playtest/stashShots.mjs <test-mode build url> <dir> [--window=WxH] [--before]
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [base = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const before = args.includes('--before');
mkdirSync(out, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const SCREEN = '#screens .menu-overlay';
const fail = (why) => {
  throw new Error(`stashShots: ${why}`);
};
const GLANCE = `(() => {
  const screen = document.querySelector('${SCREEN}');
  const box = screen.getBoundingClientRect();
  // In view is above a pane's MORE strip and not folded away under it.
  const inView = (r, node) => {
    const pane = node.parentElement?.closest('.px-scroll');
    const clip = pane ? pane.getBoundingClientRect() : box;
    const fold = pane?.hasAttribute('data-more') ? clip.bottom - (Number.parseFloat(pane.style.getPropertyValue('--more-cover')) || 26) : clip.bottom;
    return r.width > 0 && r.height > 0 && !node.parentElement?.closest('[data-folded]') && r.top >= clip.top - 0.5 && r.bottom <= fold + 0.5 && r.top >= box.top && r.bottom <= box.bottom;
  };
  let words = 0;
  const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim() || node.parentElement.closest('.px-help, .visually-hidden, [hidden], input')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (inView(range.getBoundingClientRect(), node)) words += node.textContent.trim().split(/\\s+/).length;
  }
  const count = (selector) => [...screen.querySelectorAll(selector)].filter((n) => !n.hidden && inView(n.getBoundingClientRect(), n)).length;
  const pictures = [...screen.querySelectorAll('.px-mon-icon, .px-portrait img, .item-icon img')]
    .map((n) => [n, n.getBoundingClientRect()]).filter(([n, r]) => inView(r, n))
    .reduce((sum, [, r]) => sum + r.width * r.height, 0);
  return JSON.stringify({ words, pokemon: count('.stash-roster > .px-mon-tiles > button, .stash-roster > .px-list > button'), supplies: count('[data-supply]'), pictureShare: Math.round((100 * pictures) / (box.width * box.height)) });
})()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(url.href);
  const press = async (code, settle = 200) => {
    await page.tap(code, 60);
    await sleep(settle);
  };
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, { what: 'the partner taken' });
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.raidProgress, { firstContractExtracted: true, completedContracts: ['recover-lost-field-kit'], unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      // Heard already, so no first-words box stands over a screen being
      // photographed - and Escape leaves the screen instead of putting one down.
      firstWordsHeard: ['lab', 'loadout', 'check', 'center'],
      // Every keeper's errand already asked, for the same reason: walking in
      // otherwise opens on the keeper asking, and Escape puts that down.
      errands: ['oaks-parcel', 'medicine-bag', 'brocks-crate', 'old-amber'].map((id) => ({ id, status: 'started', found: 0, lossesHeard: 0 })) });
    const seed = save.stash.pokemon[0];
    const species = ['pidgey', 'rattata', 'caterpie', 'weedle', 'oddish', 'poliwag', 'spearow', 'sandshrew', 'nidoran-m', 'mankey', 'growlithe', 'abra', 'machop', 'geodude', 'magnemite', 'krabby', 'voltorb', 'cubone', 'koffing', 'rhyhorn', 'goldeen', 'staryu', 'magikarp'];
    // Full health on all but a few: a stash where everybody is hurt puts a care
    // strip under every row, which is a different screen from the one anybody
    // has. Saved HP is clamped to the species' own maximum on load, so a big
    // number is "full" without this driver knowing the stat formula.
    const extra = species.map((speciesId, i) => ({ id: 'seeded-' + i, pokemon: { ...seed.pokemon, speciesId, moves: ['Tackle'], level: 5 + (i % 12), xp: 120 + i * 60, currentHp: i % 7 === 0 ? 6 : 999 } }));
    // The partner holds gear, so the raid's party screen has its TAKE to show
    // and the pack a gear row once it is taken.
    seed.pokemon.heldItemId = 'leftovers';
    save.stash.pokemon = [seed, ...extra];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: [seed.id, ...extra.map((p) => p.id)] }];
    save.stash.items = { potion: 9, 'super-potion': 3, 'poke-ball': 8, 'great-ball': 4, antidote: 5, 'radio-valve': 3, 'cable-coil': 2, 'parts-crate': 2, 'lamp-oil': 4, 'mooring-rope': 1, 'linen-roll': 3, money: 260 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await sleep(500);
  await walkIntoBase(page, 'pokemon-centre');
  await page.waitFor(`Boolean(document.querySelector('${SCREEN} .stash-roster'))`, { what: "Bill's PC" });
  await sleep(500);
  await page.screenshot(`${out}/01-stash.png`);
  console.log(`glance: ${await page.evaluate(GLANCE)}`);
  if (args.includes('--probe')) {
    console.log(await page.evaluate(`(() => { const pane = document.querySelector('${SCREEN} .stash-roster > .px-scroll'); const r = pane.getBoundingClientRect(); const kids = [...pane.children].map((c) => { const k = c.getBoundingClientRect(); return [c.className.slice(0, 14), Math.round(k.top - r.top), Math.round(k.height)]; }); return JSON.stringify({ top: r.top, client: pane.clientHeight, scroll: pane.scrollHeight, scrollTop: pane.scrollTop, more: pane.dataset.more, cover: pane.style.getPropertyValue('--more-cover'), first: kids.slice(0, 3), last: kids.slice(-2), window: document.querySelector('${SCREEN} .stash-roster').getBoundingClientRect().height, after: getComputedStyle(pane, '::after').height, afterMargin: getComputedStyle(pane, '::after').marginTop, gridRows: getComputedStyle(pane).gridTemplateRows, without: (() => { const m = pane.getAttribute('data-more'); pane.removeAttribute('data-more'); const h = pane.scrollHeight; pane.setAttribute('data-more', m); return h; })() }); })()`));
  }

  // Every control in the box and on the shelf, by arrows alone.
  const NAME = `(n) => n ? (n.dataset.fit ?? n.dataset.recover ?? n.dataset.refused?.slice(0, 12) ?? n.dataset.supply ?? n.dataset.boxAction ?? n.dataset.view ?? n.textContent.trim().slice(0, 16)) : ''`;
  const here = () => page.evaluate(`(${NAME})(document.activeElement)`);
  const wanted = JSON.parse(await page.evaluate(`JSON.stringify([...document.querySelectorAll('${SCREEN} .stash-roster > .px-mon-tiles > button, ${SCREEN} .stash-roster > .px-list > button, ${SCREEN} [data-supply]')].map(${NAME}))`));
  const seen = new Set([await here()]);
  const queue = [...seen];
  while (queue.length > 0 && seen.size < 120) {
    const from = queue.shift();
    for (const arrow of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
      const landed = await page.evaluate(`(() => { const n = [...document.querySelectorAll('${SCREEN} button')].find((b) => (${NAME})(b) === ${JSON.stringify(from)} && b.offsetParent); if (!n) return false; n.focus(); return true; })()`);
      if (!landed) continue;
      await press(arrow, 90);
      const to = await here();
      if (to && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  const missed = wanted.filter((id) => !seen.has(id));
  console.log(`arrow keys: ${wanted.length} Pokémon and supplies, ${seen.size} controls reached${missed.length ? `, UNREACHABLE ${missed.join(', ')}` : ', every one'}`);
  if (missed.length) fail(`unreachable: ${missed}`);

  // The dossier follows the cursor.
  await page.evaluate(`document.querySelector('${SCREEN} [data-shows="seeded-9"]:not(.px-dossier)').focus()`);
  await sleep(300);
  const shown = await page.evaluate(`[...document.querySelectorAll('${SCREEN} .px-dossier')].filter((d) => !d.hidden).map((d) => d.dataset.shownBy).join()`);
  if (shown !== 'seeded-9') fail(`the dossier shows ${shown} for seeded-9`);
  await page.screenshot(`${out}/02-cursor-moved.png`);

  // ENTER on a hurt one pays NURSE JOY's raid time.
  const hurt = 'seeded-7';
  await page.evaluate(`document.querySelector('${SCREEN} [data-recover="${hurt}"]:not(.px-chip)').focus()`);
  await sleep(300);
  await page.screenshot(`${out}/03-hurt.png`);
  await press('Enter', 600);
  const fit = await page.evaluate(`Boolean(document.querySelector('${SCREEN} [data-fit="${hurt}"]'))`);
  if (!fit) fail(`ENTER did not treat ${hurt}`);
  console.log(`treated: ${hurt} is fit again`);
  await page.screenshot(`${out}/04-treated.png`);
  console.log(`stashShots: every check passed${before ? ' (before)' : ''}`);
} finally {
  await browser.close();
}
