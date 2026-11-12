// Photographs the raid's PARTY (`scenes/PartyScene.ts`) on a raid worth
// looking at, and plays every key path on it: five deployed, a few hurt and one
// fainted, the lead holding a Quick Claw and Leftovers in the pack. Then:
//
//   - P opens it: the six slots and the dossier under them;
//   - the arrow keys reach every member's slot from where the cursor starts;
//   - ENTER picks the second up, the arrows carry the cursor to the first, and
//     ENTER puts it down there: the second leads now;
//   - TAB crosses into the dossier, which gives the Leftovers from the pack and
//     takes the Quick Claw back into it;
//   - ESC closes it, and the raid runs again.
//
// It prints the glance measure the menu overhaul's scorecards are made of:
// words in view, Pokémon in view, how much of the panel is picture
// (`docs/screens/menu-overhaul/`). `--before` drives a build from before a
// redraw (rows rather than slots).
//
//   node tools/playtest/partyShots.mjs <test-mode build url> <out dir> [--window=WxH] [--before]
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const before = args.includes('--before');
mkdirSync(out, { recursive: true });

const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const SLOW_MS = 60_000;
const browser = await launchBrowser({ window: { width, height } });
const page = await browser.openPage(url.href);
const world = `${GAME}.scene.getScene('world')`;
const PANEL = '#screens .party-menu';

const fail = (why) => {
  throw new Error(`partyShots: ${why}`);
};
const press = async (code, settle = 300) => {
  await page.tap(code, 60);
  await sleep(settle);
};
const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: SLOW_MS });
const click = async (text) => {
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    `button ${text}`,
  );
  await sleep(350);
};
const shot = (name) => page.screenshot(`${out}/${name}.png`);
const here = () => page.evaluate(`document.activeElement?.dataset?.member ?? document.activeElement?.dataset?.gearGive ?? document.activeElement?.tagName ?? ''`);
const order = () => page.evaluate(`${world}.party.pokemon.map((p) => p.name).join(',')`);
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
    if (inView(range.getBoundingClientRect(), node)) words += node.textContent.trim().split(/\\s+/).length;
  }
  const pokemon = [...panel.querySelectorAll('[data-member]')].filter((n) => !n.hidden && inView(n.getBoundingClientRect(), n)).length;
  const pictures = [...panel.querySelectorAll('.px-mon-icon, .px-portrait img, .item-icon img')]
    .map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.top >= box.top && r.bottom <= box.bottom)
    .reduce((sum, r) => sum + r.width * r.height, 0);
  return JSON.stringify({ words, pokemon, pictureShare: Math.round((100 * pictures) / (box.width * box.height)) });
})()`;

try {
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await deploy(page, url.href, {
    press: (code) => press(code, 220),
    click,
    until,
    wait: sleep,
    starter: 'Charmander',
    level: '14',
    team: ['pidgeotto:16', 'nidorino:15', 'geodude:13', 'psyduck:12'],
    stash: ['potion:4', 'poke-ball:4', 'quick-claw:1', 'leftovers:1'],
    pack: ['potion:2', 'quick-claw:1', 'leftovers:1'],
  });
  await until(sceneIs('world'), 'the raid');
  await sleep(1500);
  for (let box = 0; box < 10 && (await page.evaluate(`${world}.dialogBox.visible`)); box += 1) {
    await press('Space', 500);
  }
  // A raid a few fights in: the lead holding its claw, two hurt, one down.
  await page.evaluate(`(() => { const party = ${world}.party.pokemon; const bag = ${world}.bag;
    if (bag.remove('quick-claw', 1)) party[0].giveHeldItem('quick-claw');
    party[1].currentHp = Math.ceil(party[1].maxHp * 0.4);
    party[2].currentHp = 3;
    party[3].currentHp = 0;
  })()`);
  const team = (await order()).split(',');
  if (team.length < 5) fail(`only ${team.length} deployed: ${team}`);

  await press('KeyP', 900);
  await until(`Boolean(document.querySelector('${PANEL}'))`, 'the party');
  await shot('01-party');
  console.log(`glance: ${await page.evaluate(METRICS)}`);

  // Every member by arrows alone.
  const wanted = await page.evaluate(`[...document.querySelectorAll('${PANEL} [data-member]')].map((b) => b.dataset.member)`);
  const seen = new Set([await here()]);
  const queue = [...seen];
  while (queue.length > 0) {
    const from = queue.shift();
    for (const arrow of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
      await page.evaluate(`document.querySelector('${PANEL} [data-member="' + ${JSON.stringify(from)} + '"]')?.focus()`);
      await press(arrow, 120);
      const to = await here();
      if (to && /^\d+$/.test(to) && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  const missed = wanted.filter((id) => !seen.has(id));
  console.log(`arrow keys: ${wanted.length} members, ${missed.length ? `UNREACHABLE ${missed.join(', ')}` : 'every one reached'}`);
  if (missed.length) fail(`unreachable: ${missed}`);

  // Reorder by keys: the second picked up and put down on the first.
  await page.evaluate(`document.querySelector('${PANEL} [data-member="1"]').focus()`);
  await press('Enter', 400);
  await shot('02-in-hand');
  await page.evaluate(`document.querySelector('${PANEL} [data-member="0"]').focus()`);
  await shot('03-carried-to-the-lead');
  await press('Enter', 400);
  const swapped = (await order()).split(',');
  if (swapped[0] !== team[1] || swapped[1] !== team[0]) fail(`ENTER, ENTER did not swap: ${swapped}`);
  console.log(`reordered: ${swapped[0]} leads`);
  await shot('04-new-lead');

  // Gear by keys: TAB into the dossier of the old lead (now second), give and take.
  await page.evaluate(`document.querySelector('${PANEL} [data-member="1"]').focus()`);
  await press('Tab', 300);
  const giveSelector = `${PANEL} [data-gear-give="leftovers"][data-gear-member="1"]`;
  const takeSelector = `${PANEL} [data-gear-take="1"]`;
  if (!(await page.evaluate(`Boolean(document.querySelector('${takeSelector}')?.offsetParent)`))) fail('no TAKE for the claw in the dossier');
  await shot('05-dossier');
  await page.evaluate(`document.querySelector('${giveSelector}').focus()`);
  await press('Enter', 400);
  await page.evaluate(`document.querySelector('${PANEL} [data-member="1"]').focus()`);
  const held = await page.evaluate(`${world}.party.pokemon[1].heldItemId`);
  if (held !== 'leftovers') fail(`giving Leftovers left it holding ${held}`);
  await shot('06-gave-leftovers');
  // The dossier shown is the one for the slot the cursor came from, so come from it.
  await page.evaluate(`document.querySelector('${PANEL} [data-member="1"]').focus()`);
  await press('Tab', 300);
  await page.evaluate(`document.querySelector('${takeSelector}').focus()`);
  await press('Enter', 400);
  if ((await page.evaluate(`${world}.party.pokemon[1].heldItemId`)) !== null) fail('TAKE left the gear on');
  console.log('gear: gave Leftovers (claw back in the pack), took them back');

  await press('Escape', 600);
  if (await page.evaluate(`Boolean(document.querySelector('${PANEL}'))`)) fail('ESC left the party up');
  console.log(`partyShots: every check passed${before ? ' (before)' : ''}`);
} finally {
  await browser.close();
}
