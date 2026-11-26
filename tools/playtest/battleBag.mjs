// The bag in a fight as picture cards (`docs/screens/menu-look/battle-bag/`).
//
//   node tools/playtest/battleBag.mjs <test-mode build url> <dir>
//
// Deploys a new save into Greystone Vale with medicine and balls packed,
// starts a wild fight the way the grass does, reads the opening lines, then
// opens ITEM (and walks its cursor a card right) and BALL, photographing each.
// Exits non-zero if a list does not open or its cursor does not move.
import { launchBrowser, PIXEL_WINDOW, sleep, writeScreenshot } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const [url, dir] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!url || !dir) throw new Error('usage: battleBag.mjs <test-mode build url> <dir>');

const browser = await launchBrowser({ window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
const until = async (expression, what = expression) => {
  for (let i = 0; i < 600; i += 1) {
    if (await page.evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`never saw ${what}`);
};
const press = async (code) => {
  await page.keyDown(code);
  await sleep(60);
  await page.keyUp(code);
};
const click = async (text) => {
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    `button "${text}"`,
  );
  await sleep(350);
};
const capture = async (name) =>
  writeScreenshot(`${dir}/${name}.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
const BATTLE = `${GAME}.scene.getScene('battle')`;
/** What goes in the pack, put at home first so it can be packed. */
const BAG = ['potion:2', 'super-potion:1', 'antidote:1', 'oran-berry:2', 'poke-ball:3', 'great-ball:2'];
const read = () => page.evaluate(`(() => { const b = ${BATTLE}; return { mode: b.mode, cursor: b.selectedCommand }; })()`);
/** Presses the command whose words start with `word`, by its row's own click handler. */
const choose = (word) => page.evaluate(`(() => { const t = ${BATTLE}.commandTexts.find((t) => t.text.startsWith(${JSON.stringify(word)})); t.emit('pointerdown'); return Boolean(t); })()`);

try {
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url, {
    press,
    click,
    until,
    wait: sleep,
    stash: BAG,
    pack: BAG,
  });
  await until(sceneIs('world'), 'the world');
  await page.evaluate(`${GAME}.scene.getScene('world').transitionToBattle({ wild: { speciesId: 'rattata', level: 3, shiny: false }, teachingBattle: false })`);
  await until(sceneIs('battle'), 'the battle');
  await sleep(1200);
  for (let k = 0; k < 30 && (await read()).mode !== 'main'; k += 1) {
    await press('Space');
    await sleep(500);
  }
  if ((await read()).mode !== 'main') throw new Error('never reached the commands');
  await sleep(800);

  await choose('ITEM');
  await sleep(800);
  if ((await read()).mode !== 'items') throw new Error('ITEM did not open the bag');
  await capture('1-items');
  await press('ArrowRight');
  await sleep(400);
  const moved = await read();
  console.log(`ITEM, one card right: ${JSON.stringify(moved)}`);
  if (moved.cursor !== 1) throw new Error('Right did not move to the next card');
  await capture('2-items-next-card');
  await press('Escape');
  await sleep(600);

  await choose('BALL');
  await sleep(800);
  if ((await read()).mode !== 'balls') throw new Error('BALL did not open the balls');
  await capture('3-balls');
  console.log('ok');
} finally {
  await browser.close();
}
