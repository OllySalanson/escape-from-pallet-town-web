// Photographs YOUR TEAM (`scenes/TeamScene.ts`, drawn by `ui/teamView.ts`) on
// a realistic save and walks it by key: two dozen Pokémon in two boxes, some
// hurt, one fainted, three on the team. Then:
//
//   - P in the yard opens it: the six slots, the boxes' icons, the card;
//   - the arrow keys reach every slot and every tile from where the cursor
//     starts (a breadth-first walk over the four arrows), and fail if any is
//     out of reach - the one thing a screenshot cannot show;
//   - ENTER on a box tile takes it onto the team and ENTER on its slot leaves
//     it at home again, so the keyboard path is the whole screen;
//   - the card at the foot follows the cursor.
//
//   node tools/playtest/teamShots.mjs <test-mode build url> <out dir> [--window=WxH] [--before]
//
// `--before` drives a build from before the overhaul, which has no card, so the
// same walk and the same glance measure can be asked of both.
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
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`teamShots: ${why}`);
};

const browser = await launchBrowser({ window: WINDOW });
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
  const baseReady = `${sceneIs('base')} && ${BASE}.ready`;
  const PANEL = '#screens .team-menu';
  const teamUp = `${sceneIs('team')} && Boolean(document.querySelector('${PANEL} [data-member]'))`;
  // What a glance gets: the words in view, the Pokémon wholly in view, and how
  // much of the panel is picture rather than words. Asked of the screen as drawn,
  // so a build from before a change is measured by the same rule (the scorecard
  // in docs/screens/menu-overhaul/).
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
    const pokemon = [...panel.querySelectorAll('[data-member]')].filter((n) => !n.hidden && inView(n.getBoundingClientRect(), n)).length;
    const pictures = [...panel.querySelectorAll('.px-mon-icon, .px-portrait img, .item-icon img')]
      .map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0)
      .reduce((sum, r) => sum + r.width * r.height, 0);
    return JSON.stringify({ words, pokemon, pictureShare: Math.round((100 * pictures) / (box.width * box.height)) });
  })()`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const here = () => page.evaluate(`document.activeElement?.dataset?.member ?? document.activeElement?.tagName ?? ''`);
  const team = () => page.evaluate(`${GAME}.scene.getScene('team').teamIds`);

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${BASE}?.takeStarterForDriver?.("bulbasaur") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // Two dozen Pokémon in two boxes, a few hurt and one fainted, three on the bench.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon[0];
    const species = ['pidgey', 'rattata', 'caterpie', 'weedle', 'oddish', 'poliwag', 'spearow', 'sandshrew', 'nidoran-m', 'mankey', 'growlithe', 'abra', 'machop', 'geodude', 'magnemite', 'krabby', 'voltorb', 'cubone', 'koffing', 'rhyhorn', 'goldeen', 'staryu', 'magikarp'];
    const extra = species.map((speciesId, i) => ({ id: 'seeded-' + i, pokemon: { ...partner.pokemon, speciesId, nickname: null, moves: ['Tackle'], level: 5 + ((i * 7) % 19), xp: 0,
      currentHp: i === 4 ? 0 : i % 5 === 1 ? 3 : i % 7 === 2 ? 9 : 999 } }));
    save.stash.pokemon = [partner, ...extra];
    save.stash.boxes = [
      { name: 'Box 1', pokemonIds: [partner.id, ...extra.slice(0, 14).map((p) => p.id)] },
      { name: 'Box 2', pokemonIds: extra.slice(14).map((p) => p.id) },
    ];
    save.raidProgress.lastBench = [partner.id, 'seeded-9', 'seeded-12'];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.evaluate(`void ${BASE}.scene.start('base', {})`);
  await until(baseReady, 'the harbour again');
  await press('Escape');
  await wait(300);

  await press('KeyP');
  await until(teamUp, 'YOUR TEAM');
  await wait(400);
  await shoot('01-team');
  console.log(`glance: ${await page.evaluate(METRICS)}`);
  if (args.includes('--measure')) {
    console.log(await page.evaluate(`JSON.stringify([...document.querySelectorAll('${PANEL} .team-layout, ${PANEL} .team-layout > *, ${PANEL} .team-boxes > *')].map((n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return [n.className.slice(0, 30), n.hidden, cs.display, Math.round(r.top), Math.round(r.height), cs.flex]; }).filter((x) => x[2] !== 'none'))`));
  }
  console.log(`opened on ${await here()}, team ${await team()}`);

  // Every slot and tile, reached by arrows alone.
  const wanted = await page.evaluate(`[...document.querySelectorAll('${PANEL} [data-member]')].map((b) => b.dataset.member)`);
  const seen = new Set([await here()]);
  const queue = [...seen];
  while (queue.length > 0) {
    const from = queue.shift();
    for (const arrow of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
      await page.evaluate(`document.querySelector('${PANEL} [data-member="' + ${JSON.stringify(from)} + '"]')?.focus()`);
      await press(arrow);
      const to = await here();
      if (to && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  const missed = wanted.filter((id) => !seen.has(id));
  console.log(`arrow keys: ${wanted.length} slots and tiles, ${missed.length ? `UNREACHABLE ${missed.join(', ')}` : 'every one reached'}`);
  if (missed.length) fail(`unreachable by arrow keys: ${missed.join(', ')}`);

  // The card follows the cursor: walk down into the boxes and look.
  await page.evaluate(`document.querySelector('${PANEL} [data-member="seeded-0"]').focus()`);
  await wait(100);
  if (args.includes('--before')) {
    console.log('(before: no card to follow the cursor)');
  } else {
    const card = await page.evaluate(`[...document.querySelectorAll('${PANEL} .team-card')].filter((c) => !c.hidden).map((c) => c.dataset.shownBy)`);
    if (card.length !== 1 || card[0] !== 'seeded-0') fail(`the card shows ${card} for seeded-0`);
  }
  await shoot('02-cursor-in-boxes');
  await press('ArrowRight');
  await press('ArrowRight');
  await shoot('03-cursor-moved');

  // ENTER takes a tile onto the team; ENTER on its slot leaves it at home.
  await page.evaluate(`document.querySelector('${PANEL} [data-member="seeded-0"]').focus()`);
  const taken = await here();
  await press('Enter');
  await wait(200);
  if (!(await team()).includes(taken)) fail(`ENTER did not take ${taken} (team ${await team()})`);
  await shoot('04-taken');
  await page.evaluate(`document.querySelector('${PANEL} [data-member="' + ${JSON.stringify(taken)} + '"]').focus()`);
  await press('Enter');
  await wait(200);
  if ((await team()).includes(taken)) fail(`ENTER on the slot did not leave ${taken} at home`);
  console.log(`ENTER took and left ${taken}`);

  // The fainted one says why it cannot go.
  await page.evaluate(`document.querySelector('${PANEL} [data-member="seeded-4"]').focus()`);
  await wait(100);
  await shoot('05-fainted');
  await press('KeyP');
  await until(`${baseReady} && !${sceneIs('team')}`, 'the harbour after P');
  console.log('teamShots: every check passed');
} finally {
  await browser.close();
}
