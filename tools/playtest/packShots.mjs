// Photographs the raid's PACK (`scenes/BagScene.ts`) with a dozen kinds in it,
// and plays every key path on it: a party of three, one hurt. Then:
//
//   - B opens it: the pockets as tiles, the squares beside them;
//   - the arrow keys reach every tile from where the cursor starts;
//   - ENTER on the Potion asks who for, as FireRed's party with each one's HP;
//     ENTER on the hurt one uses it;
//   - ENTER on the Thunder Stone says ABLE or NOT ABLE on every slot; ESC back;
//   - X on the Antidote drops one; ESC closes it, and the raid runs again.
//
// It prints the glance measure the menu overhaul's scorecards are made of:
// words in view, Pokémon in view, how much of the panel is picture
// (`docs/screens/menu-overhaul/`). `--before` drives a build from before a
// redraw (rows rather than slots).
//
//   node tools/playtest/packShots.mjs <test-mode build url> <out dir> [--window=WxH] [--before]
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
const PANEL = '#screens .bag-menu';

const fail = (why) => {
  throw new Error(`packShots: ${why}`);
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
const here = () => page.evaluate(`document.activeElement?.dataset?.target ? 'target-' + document.activeElement.dataset.target : document.activeElement?.dataset?.item ?? document.activeElement?.tagName ?? ''`);
const count = (itemId) => page.evaluate(`${world}.bag.count(${JSON.stringify(itemId)})`);
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
  const things = [...panel.querySelectorAll('[data-item]:not([data-target])')].filter((n) => !n.hidden && inView(n.getBoundingClientRect(), n)).length;
  const pictures = [...panel.querySelectorAll('.px-mon-icon, .px-portrait img, .item-icon img')]
    .map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.top >= box.top && r.bottom <= box.bottom)
    .reduce((sum, r) => sum + r.width * r.height, 0);
  return JSON.stringify({ words, things, pictureShare: Math.round((100 * pictures) / (box.width * box.height)) });
})()`;

try {
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  // Within the 18 squares of the pack every new save is given.
  const kinds = ['potion:2', 'super-potion:1', 'antidote:2', 'poke-ball:3', 'great-ball:1', 'thunder-stone:1', 'tm40-aerial-ace:1', 'leftovers:1', 'quick-claw:1'];
  await deploy(page, url.href, {
    press: (code) => press(code, 220),
    click,
    until,
    wait: sleep,
    starter: 'Charmander',
    level: '14',
    team: ['pikachu:15', 'geodude:13'],
    stash: kinds,
    pack: kinds,
  });
  await until(sceneIs('world'), 'the raid');
  await sleep(1500);
  for (let box = 0; box < 10 && (await page.evaluate(`${world}.dialogBox.visible`)); box += 1) {
    await press('Space', 500);
  }
  // Found goods are found, never packed: one in as a raid would, if it fits.
  await page.evaluate(`(() => { ${world}.bag.add('radio-valve', 1); ${world}.party.pokemon[1].currentHp = 6; })()`);

  await press('KeyB', 900);
  await until(`Boolean(document.querySelector('${PANEL}'))`, 'the pack');
  await shot('01-pack');
  console.log(`glance: ${await page.evaluate(METRICS)}`);

  const wanted = await page.evaluate(`[...document.querySelectorAll('${PANEL} [data-item]')].map((b) => b.dataset.item)`);
  const seen = new Set([await here()]);
  const queue = [...seen];
  while (queue.length > 0) {
    const from = queue.shift();
    for (const arrow of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
      await page.evaluate(`document.querySelector('${PANEL} [data-item="' + ${JSON.stringify(from)} + '"]')?.focus()`);
      await press(arrow, 120);
      const to = await here();
      if (to && wanted.includes(to) && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  const missed = wanted.filter((id) => !seen.has(id));
  console.log(`arrow keys: ${wanted.length} kinds, ${missed.length ? `UNREACHABLE ${missed.join(', ')}` : 'every one reached'}`);
  if (missed.length) fail(`unreachable: ${missed}`);
  await page.evaluate(`document.querySelector('${PANEL} [data-item="tm40-aerial-ace"]').focus()`);
  await sleep(200);
  await shot('02-cursor-on-a-disc');

  // A Potion: who for, then on the hurt one.
  await page.evaluate(`document.querySelector('${PANEL} [data-item="potion"]').focus()`);
  await press('Enter', 500);
  await until(`Boolean(document.querySelector('${PANEL} [data-target]'))`, 'who the Potion is for');
  await shot('03-potion-for-whom');
  const hp = await page.evaluate(`${world}.party.pokemon[1].currentHp`);
  await page.evaluate(`document.querySelector('${PANEL} [data-target="1"]').focus()`);
  await press('Enter', 600);
  if ((await page.evaluate(`${world}.party.pokemon[1].currentHp`)) <= hp) fail('the Potion did not heal');
  if ((await count('potion')) !== 1) fail(`the Potion was not spent (${await count('potion')})`);
  console.log('potion: used on the hurt one');
  for (let back = 0; back < 3 && (await page.evaluate(`Boolean(document.querySelector('${PANEL} [data-target]'))`)); back += 1) {
    await press('Escape', 400);
  }

  // A stone: ABLE or NOT ABLE on every slot.
  await page.evaluate(`document.querySelector('${PANEL} [data-item="thunder-stone"]').focus()`);
  await press('Enter', 500);
  await until(`Boolean(document.querySelector('${PANEL} [data-target]'))`, 'who the stone is for');
  const notes = await page.evaluate(`[...document.querySelectorAll('${PANEL} [data-target] .px-tag')].map((t) => t.textContent).join(',')`);
  if (!/Able/.test(notes) || !/Not able/.test(notes)) fail(`the stone's slots say ${notes}`);
  await shot('04-stone-able');
  await press('Escape', 500);

  // X drops one.
  await page.evaluate(`document.querySelector('${PANEL} [data-item="antidote"]').focus()`);
  await press('KeyX', 500);
  if ((await count('antidote')) !== 1) fail(`X did not drop an Antidote (${await count('antidote')})`);
  console.log('drop: X put an Antidote down');
  await shot('05-after-drop');
  await press('Escape', 600);
  if (await page.evaluate(`Boolean(document.querySelector('${PANEL}'))`)) fail('ESC left the pack up');
  console.log(`packShots: every check passed${before ? ' (before)' : ''}`);
} finally {
  await browser.close();
}
