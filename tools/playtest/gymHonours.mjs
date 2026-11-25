// Plays the gym honours (`src/game/look/gymHonours.ts`) end to end: a save
// that has beaten MISTY and KOGA walks THE HARBOUR wearing both - photographed
// close up in every facing, standing and mid-stride - takes one off at THE
// BOLTHOLE's wardrobe and is seen without it, sees every honour on the
// boutique's GYM HONOURS shelf, and opens the result card a gym's badge
// opens on, where the player turns round in what they won.
//
//   node tools/playtest/gymHonours.mjs <test-mode build url> <out dir> [--look=champion-red|starter|gym-misty|classic] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const lookId = option('look') ?? 'champion-red';
/** The looks it can dress the player in: a whole boutique look, or the classic figure. */
const LOOKS = {
  'champion-red': { head: 'red-cap', top: 'red-vest', legs: 'denim-jeans', body: null },
  starter: { head: 'short-crop', top: 'plain-tee', legs: 'plain-trousers', body: null },
  'gym-misty': { head: 'misty-tail', top: 'plain-tee', legs: 'plain-trousers', body: 'swimsuit' },
  classic: null,
};
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`gymHonours: ${why}`);
};

const browser = await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
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
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;
  const playerTexture = `${GAME}.scene.getScene('base').player.texture.key`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const saved = (path) => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).${path}`);

  await press('Space');
  await until(sceneIs('base'), 'the starter picker');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  // Two gyms beaten, in a look from the boutique.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.defeatedBosses = [...(save.raidProgress.defeatedBosses ?? []), 'vale-gym-misty', 'vale-gym-koga'];
    save.raidProgress.look = ${JSON.stringify(LOOKS[lookId] ?? null)};
    save.raidProgress.wardrobe = ${JSON.stringify(Object.values(LOOKS[lookId] ?? {}).filter(Boolean))};
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  // A reload, as a player coming back to the game: CONTINUE reads the save afresh.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour again');
  const both = await page.evaluate(playerTexture);
  if (!both.endsWith('~cascade.soul')) fail(`two gyms in, the player is drawn as ${both}`);
  console.log(`two gyms in: ${both}`);

  // Close up, a frame at a time, in every facing.
  const crop = async () => {
    const r = await page.evaluate(`(() => { const sc = ${GAME}.scene.getScene('base'); const c = sc.game.canvas.getBoundingClientRect(); const cam = sc.cameras.main; const z = (c.width / sc.scale.width) * cam.zoom; return { x: c.left + (sc.player.x - cam.worldView.x) * z, y: c.top + (sc.player.y - cam.worldView.y) * z, z }; })()`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x - 8 * r.z, y: r.y, width: 32 * r.z, height: 32 * r.z, scale: 1 } });
    return Buffer.from(data, 'base64');
  };
  await press('ArrowDown');
  await until(`${baseReady} && !${GAME}.scene.getScene('base').room`, 'the yard');
  await wait(800);
  let frame = 0;
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
    await page.keyDown(key);
    for (let index = 0; index < 12; index += 1) {
      await step(1);
      if (index % 3 === 2) writeFileSync(`${out}/walk-${String((frame += 1)).padStart(2, '0')}.png`, await crop());
    }
    await page.keyUp(key);
    await wait(300);
    writeFileSync(`${out}/stand-${key.slice(5).toLowerCase()}.png`, await crop());
  }
  await shoot('01-in-the-yard');

  // The boutique's shelf of honours: every one, never for sale.
  await walkIntoBase(page, 'boutique', { press, until, wait });
  await until(sceneIs('boutique'), 'the boutique');
  await wait(300);
  await page.evaluate(`document.querySelector('[data-honour="soul"]').scrollIntoView({ block: 'center' }); document.querySelector('[data-honour="soul"]').focus()`);
  await wait(200);
  await shoot('02-shop-gym-honours');
  const shopCards = await page.evaluate(`[...document.querySelectorAll('[data-honour]')].map((card) => card.innerText.replace(/\\s+/g, ' ')).join(' | ')`);
  console.log(`the shop's honours: ${shopCards}`);
  await press('Escape');
  await until(`${baseReady} && !(${sceneIs('boutique')})`, 'the shop floor');

  // THE BOLTHOLE's wardrobe: both worn, and one taken off.
  await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', { room: 'bolthole-upstairs', at: { x: 2, y: 2 } })`);
  await until(baseReady, 'upstairs');
  await press('ArrowUp');
  await press('Space');
  await until(sceneIs('boutique'), 'the wardrobe');
  await wait(300);
  await shoot('03-wardrobe');
  await page.evaluate(`document.querySelector('[data-honour="cascade"]').focus()`);
  await wait(200);
  await shoot('04-wardrobe-pointing-at-cascade');
  await press('Enter');
  await wait(200);
  if (JSON.stringify(await saved('raidProgress.honoursHidden')) !== '["cascade"]') fail('ENTER did not take the neckerchief off');
  await shoot('05-wardrobe-cascade-off');
  console.log(`the status line: ${await page.evaluate(`document.querySelector('.px-status-line')?.innerText`)}`);
  await press('Escape');
  await until(`${baseReady} && !(${sceneIs('boutique')})`, 'the bedroom');
  const one = await page.evaluate(playerTexture);
  if (!one.endsWith('~soul')) fail(`with the neckerchief off, the player is drawn as ${one}`);
  console.log(`taken off: ${one}`);
  writeFileSync(`${out}/stand-without-cascade.png`, await crop());

  // The result card a gym's badge opens on.
  const report = {
    outcome: 'ESCAPED',
    eyebrow: 'Extracted · Gull Strand',
    headline: 'YOU WALKED OUT.',
    summary: 'Banked a Mystic Water.',
    clockLabel: '3:10 used of 5:00',
    elapsedMs: 190000,
    durationMs: 300000,
    haulTier: 'light',
    securedEmptyText: 'Nothing was in the secure slot.',
    spent: [],
    dropped: [],
    progress: [],
    progressSummary: null,
    gear: [],
    gearSummary: null,
    pack: null,
    packSummary: null,
    pressure: ['MISTY beaten'],
    baseNote: null,
    saved: true,
    ledger: { pokemon: [], items: [{ itemId: 'money', label: 'Pokédollars', quantity: 620 }] },
    ledgerFound: { pokemon: [], items: [] },
    ledgerPaid: { pokemon: [], items: [{ itemId: 'money', label: 'Pokédollars', quantity: 620 }] },
    ledgerHeading: 'Banked',
    ledgerEmptyText: 'Nothing was banked.',
    secured: { pokemon: [], items: [] },
    risked: { pokemon: [], items: [] },
    gambleVerdict: '',
    badgesWon: ['You won the CASCADE BADGE! Misty no longer holds THE COAST.'],
    honoursWon: ['cascade'],
  };
  // Put the neckerchief back on first: the card shows what was won being worn.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); delete save.raidProgress.honoursHidden; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('extraction', { report: ${JSON.stringify(report)} })`);
  await until(`Boolean(document.querySelector('#screens .moment-picture.is-honour'))`, 'the honour on the result card');
  for (const at of [0, 1, 2, 3]) {
    await new Promise((resolve) => setTimeout(resolve, at === 0 ? 300 : 900));
    await shoot(`06-result-card-${at}`);
  }
  console.log(`the card: ${await page.evaluate(`document.querySelector('.extraction-moment')?.innerText.replace(/\\s+/g, ' ')`)}`);
  console.log('gymHonours: every check passed');
} finally {
  await browser.close();
}
