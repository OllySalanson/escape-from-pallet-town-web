// Plays THE HARBOUR BOUTIQUE end to end: a new game is given a raid's worth of
// money and goods, walks up THE GREEN to the boutique, tries a whole look on
// in the mirror, buys it, walks out in it - photographed in every facing and
// mid-stride - then changes back into the classic look at THE BOLTHOLE's
// wardrobe and checks that a reload keeps what was worn.
//
//   node tools/playtest/boutique.mjs <test-mode build url> <out dir> [--look=champion-red] [--window=WxH]
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
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`boutique: ${why}`);
};

const browser = await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  // A fresh game, with a name so THE BOLTHOLE does not ask for one.
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

  await press('Space');
  await until(sceneIs('starter'), 'the starter picker');
  await until(`(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`);
  await wait(300);
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('confirm') && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    'the confirm button',
  );
  await until(baseReady, 'the harbour');
  // What a good few raids bring home: money and the goods a barter piece asks for.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...(save.stash.items ?? {}), money: 4000, 'linen-roll': 12, 'mooring-rope': 6, 'radio-valve': 4, 'parts-crate': 6, 'cable-coil': 4, 'lamp-oil': 4 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', {})`);
  await until(baseReady, 'the harbour again');
  if ((await page.evaluate(playerTexture)) !== 'character') fail('a new game is not in the classic look');

  // Up THE GREEN and in through the door; the interact key on the mat opens the shop.
  await walkIntoBase(page, 'boutique', { press, until, wait });
  await until(sceneIs('boutique'), 'the boutique');
  await wait(400);
  await shoot('01-shop');
  const shown = await page.evaluate(`document.querySelectorAll('.boutique-card').length`);
  console.log(`the shelves show ${shown} cards`);

  // Point at the whole look - the mirror answers - then try it on and buy it.
  await page.evaluate(`document.querySelector('[data-whole="${lookId}"]').focus()`);
  await wait(200);
  await shoot('02-pointing');
  await page.evaluate(`document.querySelector('[data-whole="${lookId}"]').click()`);
  await wait(200);
  await shoot('03-trying-on');
  const bar = await page.evaluate(`document.querySelector('.confirm-bar')?.innerText`);
  console.log(`the bar says: ${bar?.replace(/\s+/g, ' ')}`);
  await page.evaluate(`document.querySelector('[data-buy]').click()`);
  await wait(300);
  await shoot('04-bought');
  const status = await page.evaluate(`document.querySelector('.px-status-line')?.innerText`);
  console.log(`after buying: ${status}`);
  await press('Escape');
  await until(`${baseReady} && !(${sceneIs('boutique')})`, 'the shop floor');
  const dressed = await page.evaluate(playerTexture);
  if (!dressed.startsWith('look:')) fail(`walked out in ${dressed}`);
  console.log(`walked out as ${dressed}`);

  // Out of the door and round the green, a frame at a time, in every facing.
  await press('ArrowDown');
  await until(`${baseReady} && !${GAME}.scene.getScene('base').room`, 'the yard');
  await wait(1500);
  const crop = async () => {
    const r = await page.evaluate(`(() => { const sc = ${GAME}.scene.getScene('base'); const c = sc.game.canvas.getBoundingClientRect(); const cam = sc.cameras.main; const z = c.width / sc.scale.width; return { x: c.left + (sc.player.x - cam.scrollX) * z, y: c.top + (sc.player.y - cam.scrollY) * z, z }; })()`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x - 8 * r.z, y: r.y, width: 32 * r.z, height: 32 * r.z, scale: 1 } });
    return Buffer.from(data, 'base64');
  };
  let frame = 0;
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
    await page.keyDown(key);
    for (let index = 0; index < 18; index += 1) {
      await step(1);
      if (index % 3 === 2) writeFileSync(`${out}/walk-${String((frame += 1)).padStart(2, '0')}.png`, await crop());
    }
    await page.keyUp(key);
    await wait(300);
  }
  await shoot('05-in-the-yard');

  // A reload keeps the look.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour after a reload');
  if ((await page.evaluate(playerTexture)) !== dressed) fail('a reload lost the look');

  // And THE BOLTHOLE's wardrobe changes back into the classic look.
  await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', { room: 'bolthole-upstairs', at: { x: 2, y: 2 } })`);
  await until(baseReady, 'upstairs');
  await press('ArrowUp');
  await press('Space');
  await until(sceneIs('boutique'), 'the wardrobe');
  await wait(300);
  await shoot('06-wardrobe');
  await page.evaluate(`document.querySelector('[data-classic]').click()`);
  await wait(100);
  await page.evaluate(`document.querySelector('[data-wear-it]').click()`);
  await wait(200);
  await press('Escape');
  await until(`${baseReady} && !(${sceneIs('boutique')})`, 'the bedroom');
  if ((await page.evaluate(playerTexture)) !== 'character') fail('the wardrobe did not change back');
  console.log('changed back into the classic look at home');
} finally {
  await browser.close();
}
