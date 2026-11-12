// Photographs the raid's result screen (`scenes/ExtractionScene.ts`) without
// playing a raid: it opens the screen straight from the title on a report made
// here - a raid walked out of with a haul, a contract's reward, a caught
// Pokémon, gear and field experience; and the same raid lost. A raid played
// to its end costs minutes of a loaded machine; the screen is only the report.
//
// It prints the glance measure of the menu overhaul's scorecards (words in
// view, things in view, how much of the screen is picture), and checks the one
// control, the way back, is on screen.
//
//   node tools/playtest/resultShots.mjs <test-mode build url> <dir> [--window=WxH] [--before]
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const before = args.includes('--before');
mkdirSync(out, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');

const group = (pokemon, items) => ({ pokemon, items });
const item = (itemId, label, quantity) => ({ itemId, label, quantity });
const bulbasaur = { name: 'Bulbasaur', dexId: 1, level: 13, currentHp: 11, maxHp: 28 };
const pidgey = { name: 'Pidgey', dexId: 16, level: 7, currentHp: 21, maxHp: 21 };
const found = [item('mooring-rope', 'Mooring rope', 2), item('super-potion', 'Super Potion', 2), item('radio-valve', 'Radio valve', 1), item('thunder-stone', 'Thunder Stone', 1), item('money', 'Pokédollars', 140)];
const common = {
  clockLabel: '4:00 of 5:00',
  elapsedMs: 240000,
  durationMs: 300000,
  haulTier: 'loaded',
  contract: { description: 'Bring Oak the parcel from Millbrook', complete: true, reward: 'A Great Ball, and the Quarry opens as a way in.' },
  partner: bulbasaur,
  securedEmptyText: 'Nothing was in the secure slot.',
  spent: [item('potion', 'Potion', 1)],
  dropped: [],
  progress: [
    { name: 'Bulbasaur', dexId: 1, fromLevel: 12, toLevel: 13, experienceGained: 310, experienceToNextLevel: 120 },
    { name: 'Pidgey', dexId: 16, fromLevel: 7, toLevel: 7, experienceGained: 40, experienceToNextLevel: 55 },
  ],
  progressSummary: null,
  gear: [{ itemId: 'quick-claw', label: 'Quick Claw', holder: 'held by Bulbasaur', fate: 'found' }],
  gearSummary: null,
  pack: { itemId: 'raid-pack', name: 'Raid pack', squares: 18, fate: 'kept' },
  packSummary: null,
  pressure: ['2 trainers beaten'],
  baseNote: null,
  saved: true,
};
const REPORTS = {
  escaped: {
    ...common,
    outcome: 'ESCAPED',
    eyebrow: 'Extracted · Mere Path',
    headline: 'YOU WALKED OUT LOADED.',
    summary: 'Banked 2 Mooring ropes, 2 Super Potions, a Radio valve, a Thunder Stone, ₽140 and a Pidgey. 3 Potions and your Raid pack rode out unprotected and came home.',
    ledger: group([pidgey], found),
    ledgerFound: group([pidgey], found),
    ledgerPaid: group([], [item('great-ball', 'Great Ball', 1)]),
    ledgerHeading: 'Banked',
    ledgerEmptyText: 'Nothing was banked.',
    secured: group([], [item('potion', 'Potion', 2)]),
    risked: group([], [item('potion', 'Potion', 3)]),
    gambleVerdict: 'A wipe would have cost you the haul and the Raid pack.',
  },
  lost: {
    ...common,
    outcome: 'WIPED',
    cause: 'timer',
    eyebrow: 'Raid lost · Mere Path',
    headline: 'THE CLOCK RAN OUT.',
    summary: 'Everything carried unprotected is gone, and the Raid pack with it.',
    contract: undefined,
    progress: [],
    gear: [{ itemId: 'quick-claw', label: 'Quick Claw', holder: 'held by Pidgey', fate: 'lost' }],
    pack: { itemId: 'raid-pack', name: 'Raid pack', squares: 18, fate: 'lost' },
    ledger: group([pidgey], found),
    ledgerFound: group([pidgey], found),
    ledgerPaid: group([], []),
    ledgerHeading: 'Gone for good',
    ledgerEmptyText: 'Nothing was lost.',
    secured: group([], [item('potion', 'Potion', 2)]),
    risked: group([], []),
    gambleVerdict: 'The secure slot held. Bulbasaur came home as your partner.',
    fallen: [],
  },
};

const METRICS = `(() => {
  const screen = document.querySelector('#screens .menu-overlay');
  const box = screen.getBoundingClientRect();
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
  const things = [...screen.querySelectorAll('.result-tile, .extraction-ledger .px-row.has-icon, .extraction-gamble .px-row.has-icon')]
    .filter((n) => inView(n.getBoundingClientRect(), n)).length;
  const pictures = [...screen.querySelectorAll('.px-mon-icon, .px-portrait img, .item-icon img')]
    .map((n) => [n, n.getBoundingClientRect()]).filter(([n, r]) => inView(r, n))
    .reduce((sum, [, r]) => sum + r.width * r.height, 0);
  return JSON.stringify({ words, things, pictureShare: Math.round((100 * pictures) / (box.width * box.height)) });
})()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(url.href);
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  for (const [name, report] of Object.entries(REPORTS)) {
    await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('extraction', { report: ${JSON.stringify(report)} })`);
    await page.waitFor(`Boolean(document.querySelector('#screens .menu-overlay [data-continue]'))`, { what: `the ${name} result` });
    // Every tile popped in, a twelfth of a second apart.
    await sleep(2500);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`${name}: ${await page.evaluate(METRICS)}`);
    const back = await page.evaluate(`(() => { const r = document.querySelector('#screens [data-continue]').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.width > 0; })()`);
    if (!back) throw new Error(`resultShots: the way back is off the ${name} screen`);
  }
  console.log(`resultShots: every check passed${before ? ' (before)' : ''}`);
} finally {
  await browser.close();
}
