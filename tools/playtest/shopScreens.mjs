// Stands in front of a rung you can afford, one you cannot, and one behind a
// door, and asks the screen the four questions a player asks before spending:
// what is it, what does it cost, what do I hold, and what is stopping me.
//
//   node tools/playtest/shopScreens.mjs <url> <out dir> [--window=1600x900]
//
// It walks the cursor with the arrow keys rather than clicking, because the
// detail pane has to follow the cursor and not the mouse, and it photographs
// every state it stops in. It also arms a barter and checks that the first
// press spends nothing, which is the one promise a screenshot cannot show.
//
// The two counters on the Ferryman's screen each answer for themselves: this
// fails if pointing at the shelf blanks the pane under the barter table, which
// is exactly what a screen-wide detail swap used to do.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const size = /^(\d+)x(\d+)$/.exec(args.find((arg) => arg.startsWith('--window='))?.slice(9) ?? '1600x900');
const window = { width: Number(size[1]), height: Number(size[2]) };
const tag = `${window.width}x${window.height}`;
mkdirSync(out, { recursive: true });

/**
 * A save standing mid-way through both shelves: enough parts for the first
 * locker, nothing like enough for the second, and the Ferryman opened as far
 * as TRUSTED so his table has an affordable deal, a short one and a shut one.
 */
const SEED = `(() => {
  const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
  Object.assign(save.raidProgress, {
    firstContractExtracted: true,
    completedContracts: ['recover-lost-field-kit', 'survey-the-braid'],
    unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    defeatedBosses: ['floodplain-toll-keeper', 'floodplain-sluice-keeper', 'floodplain-orchard-warden'],
  });
  const seed = save.stash.pokemon[0];
  // A vault with a real amount in it, because the title bar's own count is one
  // of the things a small screen has to find room for beside the ladder.
  const extra = ['pidgey', 'rattata', 'caterpie', 'oddish', 'weedle', 'spearow', 'sandshrew', 'mankey', 'geodude', 'krabby', 'voltorb', 'cubone', 'koffing', 'goldeen', 'staryu', 'magikarp'].map((speciesId, i) => ({
    id: 'seeded-' + i,
    pokemon: { ...seed.pokemon, speciesId, moves: ['Tackle'], level: 5 + i, xp: 120 + i * 60, currentHp: 999 },
  }));
  save.stash.pokemon = [seed, ...extra];
  save.stash.boxes = [{ name: 'Box 1', pokemonIds: [seed.id, ...extra.map((p) => p.id)] }];
  save.stash.items = { potion: 4, 'super-potion': 2, 'poke-ball': 4, 'great-ball': 2, antidote: 2, 'parts-crate': 2, 'cable-coil': 1, 'radio-valve': 1, 'linen-roll': 1, scrip: 300 };
  localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
})()`;

/**
 * What the pointed-at row and its pane are actually saying, read off the live
 * screen: the name the cursor is on, the price beside it, and every line of the
 * pane that names it. Whitespace is squeezed so a wrapped sentence reads as one.
 */
const READING = `(() => {
  const text = (node) => (node ? node.textContent.replace(/\\s+/g, ' ').trim() : null);
  const focused = document.activeElement?.closest('.px-row, .px-button');
  const shows = document.activeElement?.closest('[data-shows]')?.dataset.shows;
  const panes = [...document.querySelectorAll('.shop-detail')].filter((pane) => !pane.hidden);
  return {
    on: text(focused?.querySelector('.px-name')) ?? text(focused),
    does: text(focused?.querySelector('.px-row-main small')),
    price: text(focused?.querySelector('.px-price')),
    tag: text(focused?.querySelector('.px-tag'))?.toUpperCase() ?? null,
    help: text(document.querySelector('[data-help-text]')),
    // Anything drawn outside the screen, named well enough to find it again.
    escaped: (() => {
      const screen = document.querySelector('.menu-overlay');
      const box = screen.getBoundingClientRect();
      return [...new Set([...screen.querySelectorAll('*')].filter((node) => {
        if (node.closest('.px-scroll, .menu-scroll')) return false;
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5 || r.bottom > box.bottom + 0.5 || r.top < box.top - 0.5);
      }).map((node) => (node.className || node.tagName) + ' "' + node.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) + '"'))];
    })(),
    shows,
    open: panes.map((pane) => ({
      id: pane.dataset.shownBy,
      does: text(pane.querySelector('.shop-does')),
      price: text(pane.querySelector('.shop-price')),
      cut: pane.scrollHeight - pane.clientHeight > 1,
      // Every ask in a price starts on the same pixel or the list is not a
      // column: the one with no icon of its own is drawn an empty icon slot.
      asks: [...new Set([...pane.querySelectorAll('.shop-price-list dt > span:last-child')]
        .map((span) => Math.round(span.getBoundingClientRect().left)))],
    })),
  };
})()`;

const browser = await launchBrowser({ window });
let bad = 0;
const fail = (why) => {
  bad += 1;
  console.log(`  FAULT ${why}`);
};

try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(160);
  };
  const clickSel = async (selector) => {
    await page.waitFor(
      `(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return false; b.click(); return true; })()`,
      { what: selector },
    );
    await sleep(260);
  };
  const read = async () => JSON.parse(await page.evaluate(`JSON.stringify(${READING})`));
  const shoot = async (name) => {
    await sleep(280);
    await page.screenshot(`${out}/${name}-${tag}.png`);
  };
  const say = (reading) =>
    console.log(
      `  ${String(reading.on).padEnd(18)} | ${reading.does ?? '-'} | ${reading.price ?? '-'} | ${reading.tag ?? '-'}`,
    );

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm Bulbasaur')); if (!b) return false; b.click(); return true; })()`,
    { what: 'the starter confirmation' },
  );
  await page.waitFor(sceneIs('hub'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.evaluate(SEED);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('hub'));
  await sleep(500);

  // The ladder is laid out in columns, so the cursor is walked with all four
  // arrows rather than down one lane: a rung the keyboard cannot reach is a
  // rung the pane can never answer for.
  const times = (key, count) => Array.from({ length: count }, () => key);
  const walk = [...times('ArrowDown', 8), 'ArrowRight', ...times('ArrowUp', 8), ...times('ArrowDown', 8)];

  console.log('The Outfitter, one rung at a time:');
  await clickSel('button[data-view="outfitter"]');
  await sleep(400);
  const seen = new Map();
  for (const key of ['', ...walk]) {
    if (key) await press(key);
    const reading = await read();
    if (!reading.on || seen.has(reading.on)) continue;
    seen.set(reading.on, reading);
    say(reading);
    // Every rung says what it does and what it costs at the same time, and
    // the pane under the list answers for the one the cursor is on.
    if (!reading.does) fail(`${reading.on} says nothing about what it does`);
    if (!reading.price) fail(`${reading.on} shows no price`);
    for (const escaped of reading.escaped) fail(`drawn off the screen: ${escaped}`);
    const pane = reading.open.find((open) => open.id === reading.shows);
    if (!pane) fail(`${reading.on} opens no pane`);
    else {
      if (!pane.does) fail(`${reading.on}'s pane says nothing about what it does`);
      if (!pane.price) fail(`${reading.on}'s pane prices nothing`);
      if (pane.asks.length > 1) fail(`${reading.on}'s price does not line up: ${pane.asks.join(', ')}`);
      if (reading.tag === 'LOCKED' && !/after/i.test(pane.price)) {
        fail(`${reading.on} is locked and never says behind what`);
      }
      if (reading.tag === 'SHORT' && !/still needs/i.test(pane.price)) {
        fail(`${reading.on} is short and never says of what`);
      }
    }
    await shoot(`outfitter-${String(reading.on).toLowerCase().replace(/\W+/g, '-')}`);
  }
  if (seen.size < 6) fail(`the arrow keys reached only ${seen.size} of the seven rungs`);
  for (const wanted of ['BUILD', 'SHORT', 'LOCKED']) {
    if (![...seen.values()].some((reading) => reading.tag === wanted)) {
      fail(`no rung in the state ${wanted} was stood in front of`);
    }
  }

  console.log('The Ferryman:');
  await press('Escape');
  await sleep(300);
  await clickSel('button[data-view="trader"]');
  await sleep(400);
  const shelfReading = await read();
  say(shelfReading);
  await shoot('ferryman-shelf');
  if (!shelfReading.does) fail(`${shelfReading.on} on the shelf says nothing about what it does`);
  if (!shelfReading.price) fail(`${shelfReading.on} on the shelf shows no price`);
  for (const pane of shelfReading.open) {
    if (pane.asks.length > 1) fail(`${pane.id}'s price does not line up: ${pane.asks.join(', ')}`);
  }
  // Two counters, two answers: pointing at the shelf must leave the pane under
  // the barter table showing the barter table.
  if (shelfReading.open.length < 2) {
    fail(`only ${shelfReading.open.length} of the two counters is answering`);
  }
  if (!shelfReading.open.some((open) => open.id?.startsWith('barter-'))) {
    fail('pointing at the shelf blanked the barter table\u2019s pane');
  }

  // Into the barter table, and onto a deal this vault can actually strike.
  let deal = null;
  for (const key of ['ArrowRight', ...walk, 'ArrowDown', 'ArrowDown']) {
    await press(key);
    const reading = await read();
    if (reading.shows?.startsWith('barter-') && reading.tag === 'TRADE') {
      deal = reading;
      break;
    }
  }
  if (!deal) fail('no barter this vault can strike was reachable by the arrow keys');
  else {
    say(deal);
    await shoot('ferryman-table');
    if (!deal.does) fail(`${deal.on} says nothing about what it hands back`);
    if (!deal.price) fail(`${deal.on} says nothing about what it takes`);
    const pane = deal.open.find((open) => open.id === deal.shows);
    if (!pane?.price?.includes('vault')) fail(`${deal.on} never says what the vault holds`);
    if (pane && pane.asks.length > 1) fail(`${deal.on}'s price does not line up: ${pane.asks.join(', ')}`);

    // A barter is asked again before it is struck, and the first press spends
    // nothing: the goods are still in the vault and the cursor is on keeping them.
    const before = await page.evaluate(`localStorage.getItem('${SAVE_KEY}')`);
    await press('Enter');
    await sleep(340);
    const armed = await read();
    say(armed);
    await shoot('ferryman-armed');
    if ((await page.evaluate(`localStorage.getItem('${SAVE_KEY}')`)) !== before) {
      fail('one press on a barter spent the goods');
    }
    if (!/keep/i.test(String(armed.on))) {
      fail(`the armed cursor rests on "${armed.on}", not on keeping them`);
    }
    // The pane has to keep answering for the deal being asked about: it is
    // where what you get and what you hand over are both written down, and the
    // armed strip has room for neither.
    if (armed.shows !== deal.shows) {
      fail(`the armed strip points at ${armed.shows}, not at ${deal.shows}`);
    }
    if (!armed.open.some((open) => open.id === deal.shows)) {
      fail(`the pane stopped answering for ${deal.shows} the moment it was armed`);
    }
    await press('Enter');
    await sleep(340);
    if ((await page.evaluate(`localStorage.getItem('${SAVE_KEY}')`)) !== before) {
      fail('keeping them spent them anyway');
    }
    await shoot('ferryman-kept');
  }

  console.log(bad === 0 ? `clean at ${tag}` : `${bad} fault(s) at ${tag}`);
} finally {
  await browser.close();
}
process.exit(bad === 0 ? 0 : 1);
