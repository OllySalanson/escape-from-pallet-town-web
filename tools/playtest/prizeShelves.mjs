// Photographs THE PRIZE WINDOW drawn as things on shelves (`docs/screens/prize-shelves/`):
// a save with 2,760 tickets, ABRA already had, a SMOKE BALL at home, a
// Sitrus Berry at home and TM18 bought this week. It opens the window, puts the
// cursor on the Sitrus Berry, then asks about DRATINI and waits at the question.
//
//   node tools/playtest/prizeShelves.mjs <url> <out dir> [--window=WxH]
//
// It steps a paused loop: run it against a test-mode build with
// `?testmode=pixels` (`tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });
const fail = (why) => {
  throw new Error(`prizeShelves: ${why}`);
};

const browser = await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'SAM')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
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
  const shoot = async (name) => {
    await step(2);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  const now = new Date();
  const two = (value) => String(value).padStart(2, '0');
  const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.gameCorner = {
      tickets: 2760,
      day: { day: '${day}', paid: { 'pokemon-jump': 30, 'berry-picking': 30, 'battle-arena': 50, 'field-course': 10 }, berries: {}, bought: { 'oran-berry': 1, 'cheri-berry': 1 }, best: {} },
      best: { 'pokemon-jump': 2600 },
      week: { week: (() => { const date = new Date(Date.UTC(${now.getFullYear()}, ${now.getMonth()}, ${now.getDate()})); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day); const start = Date.UTC(date.getUTCFullYear(), 0, 1); return date.getUTCFullYear() + '-W' + String(Math.ceil(((date.getTime() - start) / 86400000 + 1) / 7)).padStart(2, '0'); })(), bought: { 'tm18-rain-dance': 1 } },
      taken: ['abra'],
    };
    save.stash.items = { ...save.stash.items, 'smoke-ball': 1, 'sitrus-berry': 1 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await walkIntoBase(page, 'prize-window', { press, until, wait, settleMs: 150 });
  await until(sceneIs('game-corner'), 'the prize window');
  await wait(600);
  await shoot('01-the-wall');
  for (const code of ['ArrowRight']) await press(code);
  await wait(200);
  await shoot('02-sitrus-berry');
  await page.evaluate(`document.querySelector('[data-prize="dratini"]').focus()`);
  await wait(200);
  await shoot('03-dratini');
  await press('Enter');
  await wait(600);
  if (!(await page.evaluate(`document.activeElement?.matches('[data-prize-cancel]')`))) fail('the question did not open on NOT NOW');
  await shoot('04-buy-dratini');
  await page.evaluate(`document.querySelector('[data-prize="porygon"]').focus()`);
  await wait(200);
  await shoot('05-porygon-short');
} finally {
  await browser.close();
}
