// Photographs every DOM screen at a real window size and counts what a player
// can actually see on it.
//
//   node tools/playtest/menuShots.mjs <url> <out dir> [--window=1920x950] [--raid]
//
// The screens are laid out against the browser window rather than against the
// canvas (`src/game/display/menuStage.ts`), so "does this list fit?" is a
// question with a different answer at every window size and can only be asked
// of a real one. For each screen this prints, per scrolling pane, how many rows
// it holds and how many of them are wholly on screen - which is the number the
// captain's complaint was about - and fails the run on anything that escapes its
// screen or puts a scrollbar down the side of the browser.
//
// `--raid` also walks into a raid and photographs the three screens that are
// only reachable from inside one: the party, the bag and the field guide.
// `--resize` instead opens one screen and drags the window through every size
// without reloading, which is the only way the live relayout is checked.
// `--keys` walks the arrow keys over a screen laid out in columns and fails if
// any row of it cannot be reached without a mouse - which is the one thing a
// screenshot cannot show, and the thing a multi-column list can quietly break.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const size = /^(\d+)x(\d+)$/.exec(args.find((arg) => arg.startsWith('--window='))?.slice(9) ?? '1920x950');
const window = { width: Number(size[1]), height: Number(size[2]) };
const raid = args.includes('--raid');
/** Chromium hides scrollbars by default here, so a pane's own track is only visible with this. */
const scrollbars = args.includes('--scrollbars');
const tag = `${window.width}x${window.height}`;
const resize = args.includes('--resize');
const keys = args.includes('--keys');
/** Dragged through in order, both ways, so a screen is relaid both growing and shrinking. */
const RESIZES = [[1280, 720], [1920, 950], [2560, 1330], [3840, 2000], [2560, 1330], [1920, 950], [1024, 640], [640, 480], [1920, 950]];
mkdirSync(out, { recursive: true });

/**
 * What one screen is: the room it was given, every scrolling pane's rows and how
 * many of them are whole, anything drawn outside the screen, and whether the
 * page itself scrolls. A row is counted as seen only if it is wholly inside its
 * pane, because half a row is the thing that reads as a fault.
 */
const AUDIT = `(() => {
  const screen = document.querySelector('.menu-overlay');
  if (!screen) return null;
  const box = screen.getBoundingClientRect();
  // A pane that is not on show is not a pane: a screen with a detail pane per
  // row of its list holds one of them open and leaves the rest undrawn,
  // and counting all twenty said nothing about what the player can see.
  const panes = [...screen.querySelectorAll('.px-scroll, .menu-scroll')].filter((pane) => {
    const r = pane.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).map((pane) => {
    const p = pane.getBoundingClientRect();
    // The MORE strip is drawn over the foot of the pane, so a row behind it is
    // not a row the player can read: the fold is the top of the strip.
    const cover = Number.parseFloat(pane.style.getPropertyValue('--more-cover')) || 0;
    const fold = p.bottom - cover;
    const paneUnit = Number.parseFloat(getComputedStyle(pane).getPropertyValue('--u')) || 1;
    const rows = [...pane.children].flatMap((child) =>
      child.matches('button, .px-row, li, .px-empty') ? [child] : [...child.querySelectorAll(':scope > button, :scope > .px-row, :scope > li, :scope > .px-empty')]);
    const whole = rows.filter((row) => {
      const r = row.getBoundingClientRect();
      return r.top >= p.top - 0.5 && r.bottom <= fold + 0.5;
    }).length;
    // A row the fold runs through is drawn with its top half showing and no
    // lower edge, which reads as a fault rather than as "more below" - the
    // strip is meant to take that row whole (scrollCoverHeight).
    const cut = rows.filter((row) => {
      const r = row.getBoundingClientRect();
      return r.top < fold - 0.5 && r.bottom > fold + 0.5 && r.top >= p.top - 0.5;
    }).length;
    return { name: pane.className.split(' ').filter((c) => c !== 'px-scroll').join('.') || 'pane', rows: rows.length, whole, cut, scrolls: pane.scrollHeight - pane.clientHeight > Math.max(1, paneUnit) };
  });
  // What is inside a scrolling pane is allowed to be below its fold; that is
  // what the pane is for, and it is counted above. What may never leave the
  // screen is everything else.
  const escaped = [...screen.querySelectorAll('*')].filter((node) => {
    if (node.closest('.px-scroll, .menu-scroll')) return false;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5 || r.bottom > box.bottom + 0.5 || r.top < box.top - 0.5);
  }).map((node) => node.className || node.tagName);
  // What would actually resample the art: a game pixel that is not a whole
  // number of screen pixels, a screen standing on half of one, or a picture
  // drawn at anything but a whole multiple of its own size. A grid track that
  // splits three ways into a width ending in a third does not - the browser
  // paints a background-drawn frame on whole device pixels either way, which is
  // why this asks about the pictures and the unit rather than about every box.
  // Only of a pixel-ui screen, which since #152 is every screen the game has -
  // the in-raid party, bag and field guide included.
  const pixel = screen.classList.contains('pixel-ui');
  const unit = Number.parseFloat(getComputedStyle(screen).getPropertyValue('--u')) || 0;
  const layer = screen.parentElement.getBoundingClientRect();
  const offGrid = !pixel ? [] : [
    ...(unit > 0 && Number.isInteger(unit) ? [] : ['a game pixel of ' + unit + ' screen pixels']),
    ...(Number.isInteger(layer.left) && Number.isInteger(layer.top) ? [] : ['screen on half a pixel']),
    ...[...screen.querySelectorAll('img, canvas')].filter((node) => {
      const r = node.getBoundingClientRect();
      const source = node.naturalWidth || node.width || 0;
      if (source === 0 || r.width === 0) return false;
      const times = r.width / source;
      return Math.abs(times - Math.round(times)) > 0.01;
    }).map((node) => (node.className || node.tagName) + ' resampled'),
  ];
  return {
    box: { width: Math.round(box.width), height: Math.round(box.height), left: Math.round(box.left), top: Math.round(box.top) },
    unit,
    panes,
    escaped: [...new Set(escaped)].slice(0, 6),
    offGrid: [...new Set(offGrid)].slice(0, 6),
    pageScrolls: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
  };
})()`;

const browser = await launchBrowser({ window, scrollbars });
let bad = 0;
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code); await sleep(150); };
  const click = async (label) => {
    await page.waitFor(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`,
      { what: `a button labelled ${label}` },
    );
    await sleep(250);
  };
  const clickSel = async (selector) => {
    await page.waitFor(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return false; b.click(); return true; })()`, { what: selector });
    await sleep(250);
  };
  const shoot = async (name) => {
    await sleep(400);
    const audit = JSON.parse(await page.evaluate(`JSON.stringify(${AUDIT})`));
    if (!audit) {
      console.log(`  ${name}: no DOM screen on show`);
      return;
    }
    const faults = [
      ...(audit.panes.some((p) => p.cut > 0) ? [`ROW CUT in ${audit.panes.filter((p) => p.cut > 0).map((p) => p.name).join(', ')}`] : []),
      ...(audit.pageScrolls ? ['PAGE SCROLLS'] : []),
      ...(audit.escaped.length ? [`ESCAPED ${audit.escaped.join(', ')}`] : []),
      ...(audit.offGrid.length ? [`OFF GRID ${audit.offGrid.join(', ')}`] : []),
    ];
    bad += faults.length;
    // A pane of no rows is a band rather than a list - the stash's detail pane
    // is one - and is only worth a line when it is holding something back.
    const shown = audit.panes.filter((p) => p.rows > 0 || p.scrolls);
    const panes = shown.length === 0
      ? 'nothing scrolls'
      : shown.map((p) => `${p.name} ${p.whole}/${p.rows}${p.scrolls ? ' SCROLLS' : ''}`).join('; ');
    console.log(`  ${name.padEnd(14)} ${audit.box.width}x${audit.box.height} @${audit.unit} | ${panes}${faults.length ? ` | ${faults.join(' | ')}` : ''}`);
    await page.screenshot(`${out}/${name}-${tag}.png`);
  };

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await shoot('starter');
  await click('Confirm Bulbasaur');
  await page.waitFor(sceneIs('hub'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  // A save with a real amount in it: four maps unlocked, two dozen Pokemon and
  // a shelf of supplies. A thin save is the one shape these screens have never
  // had trouble with, so the lists this is about have to have rows to hide.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.raidProgress, { firstContractExtracted: true, completedContracts: ['recover-lost-field-kit'], unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'] });
    const seed = save.stash.pokemon[0];
    const species = ['pidgey', 'rattata', 'caterpie', 'weedle', 'oddish', 'poliwag', 'spearow', 'sandshrew', 'nidoran-m', 'mankey', 'growlithe', 'abra', 'machop', 'geodude', 'magnemite', 'krabby', 'voltorb', 'cubone', 'koffing', 'rhyhorn', 'goldeen', 'staryu', 'magikarp'];
    // Full health on all but a few: a stash where everybody is hurt puts a care
    // strip under every row, which is a different screen from the one anybody
    // has. Saved HP is clamped to the species' own maximum on load, so a big
    // number is "full" without this driver knowing the stat formula.
    const extra = species.map((speciesId, i) => ({ id: 'seeded-' + i, pokemon: { ...seed.pokemon, speciesId, moves: ['Tackle'], level: 5 + (i % 12), xp: 120 + i * 60, currentHp: i % 7 === 0 ? 6 : 999 } }));
    save.stash.pokemon = [seed, ...extra];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: [seed.id, ...extra.map((p) => p.id)] }];
    save.stash.items = { potion: 9, 'super-potion': 3, 'poke-ball': 8, 'great-ball': 4, antidote: 5, 'radio-valve': 3, 'cable-coil': 2, 'parts-crate': 2, 'lamp-oil': 4, 'mooring-rope': 1, 'linen-roll': 3, scrip: 260 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('hub'));
  await sleep(500);

  await shoot('lobby');
  await clickSel('button[data-view="stash"]');
  await shoot('stash');
  await press('Escape');
  await clickSel('button[data-view="outfitter"]');
  await shoot('outfitter');
  await press('Escape');
  await clickSel('button[data-view="trader"]');
  await shoot('ferryman');
  await press('Escape');
  await click('Start a raid');
  await shoot('loadout');
  await click('Bulbasaur');
  // Pack something, so the final check is photographed with a loadout on it
  // rather than as two empty windows: what those screens look like full is the
  // question, and an empty one answers it for nobody.
  for (const itemId of ['potion', 'poke-ball', 'super-potion']) {
    await clickSel(`[data-count-id="${itemId}"][data-count-dir="1"]`);
    await clickSel(`[data-count-id="${itemId}"][data-count-dir="1"]`);
  }
  await click('Choose drop-in');
  await shoot('dropin');
  await click('Review & deploy');
  await shoot('final-check');

  if (raid) {
    await click('Enter the raid');
    await page.waitFor(sceneIs('world'));
    await sleep(900);
    await press('Space');
    await sleep(400);
    for (const [key, name] of [['KeyP', 'party'], ['KeyB', 'bag'], ['KeyO', 'field-guide']]) {
      await press(key);
      await shoot(name);
      await press('Escape');
      await sleep(250);
    }
  }
  if (keys) {
    // A list in columns is only a list if the cursor can still reach all of it.
    // Every control is walked from the one the screen starts the cursor on, a
    // breadth-first search over the four arrow keys, and every row of every
    // list has to turn up in it. A screenshot cannot show this, and columns are
    // exactly the change that can quietly break it.
    for (let back = 0; back < 6; back += 1) {
      if (await page.evaluate(`Boolean(document.querySelector('button[data-view="stash"]'))`)) break;
      await press('Escape');
      await sleep(250);
    }
    await clickSel('button[data-view="stash"]');
    await sleep(400);
    // A control is named by its wiring, which is what survives a re-render.
    const NAME = `(node) => node ? [...Object.entries(node.dataset)].filter(([k]) => k !== 'help').map(([k, v]) => k + '=' + v).sort().join('|') || node.textContent.trim().slice(0, 20) : ''`;
    const here = `(() => (${NAME})(document.activeElement))()`;
    const wanted = JSON.parse(await page.evaluate(
      `JSON.stringify([...document.querySelectorAll('.stash-roster > .px-list > button, .stash-side .px-list > button')].map(${NAME}))`,
    ));
    const start = await page.evaluate(here);
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0 && seen.size < 80) {
      const from = queue.shift();
      for (const arrow of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
        // Put the cursor back where this leg starts, so each is walked from the
        // same place however the last one ended.
        const landed = await page.evaluate(
          `(() => { const n = [...document.querySelectorAll('button, input')].find((b) => (${NAME})(b) === ${JSON.stringify(from)}); if (!n) return false; n.focus(); return true; })()`,
        );
        if (!landed) continue;
        await press(arrow);
        const to = await page.evaluate(here);
        if (to && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    const missed = wanted.filter((id) => id && !seen.has(id));
    console.log(`  ${'arrow keys'.padEnd(14)} ${wanted.length} rows, ${seen.size} controls reached${missed.length ? ` | UNREACHABLE ${missed.join(', ')}` : ''}`);
    bad += missed.length ? 1 : 0;
  }
  if (resize) {
    // One screen, every window, no reload: a menu is laid out on `resize` and a
    // screen that only ever looks right on a fresh load is a screen that breaks
    // the first time somebody drags a corner.
    for (let back = 0; back < 6; back += 1) {
      if (await page.evaluate(`Boolean(document.querySelector('button[data-view="stash"]'))`)) break;
      await press('Escape');
      await sleep(250);
    }
    await clickSel('button[data-view="stash"]');
    for (const [width, height] of RESIZES) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await sleep(500);
      await shoot(`resized-${width}x${height}`);
    }
  }
  console.log(bad ? `${bad} fault(s) at ${tag}` : `clean at ${tag}`);
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
}
