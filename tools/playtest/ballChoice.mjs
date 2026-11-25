// Olly's ball, replayed on a real build with real keys (`docs/screens/ball-choice/`).
//
//   node tools/playtest/ballChoice.mjs <test-mode build url> <dir> [--port=N]
//
// It deploys a new save into Greystone Vale, packs one Poke Ball and two Great
// Balls, and starts a wild fight with a Chansey (which almost never stays in a
// ball) the way the grass does (`WorldScene.transitionToBattle`). Then, single
// presses only: BALL, ENTER on the Poke Ball, read on, BALL again - which must
// open the list on the last kind left rather than throw it (25 Nov 2026). Then
// two ENTER presses 120ms apart on BALL, and a double click on it, which must
// open the list and throw nothing. Every step is photographed and logged; it
// exits non-zero on the first thing that goes wrong.
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep, writeScreenshot } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const [url, dir] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !dir) throw new Error('usage: ballChoice.mjs <test-mode build url> <dir> [--port=N]');

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
await page.send('Page.bringToFront');
const until = async (expression, what = expression) => {
  for (let i = 0; i < 600; i += 1) {
    if (await page.evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`never saw ${what}`);
};
const press = async (code, holdMs = 60) => {
  await page.keyDown(code);
  await sleep(holdMs);
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
const read = () =>
  page.evaluate(`(() => { const b = ${BATTLE}; return { mode: b.mode, cursor: b.selectedCommand, poke: b.bag.count('poke-ball'), great: b.bag.count('great-ball') }; })()`);
const expectState = async (what, check) => {
  const state = await read();
  console.log(`${what}: ${JSON.stringify(state)}`);
  if (!check(state)) throw new Error(`wrong after ${what}`);
  return state;
};
/** Reads on with SPACE, one press at a time, until the commands are back. */
const readOn = async () => {
  for (let k = 0; k < 60 && (await read()).mode !== 'main'; k += 1) {
    await press('Space');
    await sleep(500);
  }
  await sleep(700);
};
/** Clicks the middle of the battle text whose words include `label`, twice when asked. */
const clickText = async (label, clicks = 1) => {
  const at = await page.evaluate(`(() => {
    const b = ${BATTLE};
    const text = b.commandTexts.find((t) => t.visible !== false && t.text.includes(${JSON.stringify(label)}));
    if (!text) return null;
    const bounds = text.getBounds();
    const cam = b.cameras.main;
    const canvas = ${GAME}.canvas.getBoundingClientRect();
    const scale = canvas.width / ${GAME}.scale.width;
    return { x: canvas.left + (bounds.centerX - cam.scrollX) * cam.zoom * scale, y: canvas.top + (bounds.centerY - cam.scrollY) * cam.zoom * scale };
  })()`);
  if (!at) throw new Error(`no battle text ${label}`);
  for (let n = 1; n <= clicks; n += 1) {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: n });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: n });
    await sleep(110);
  }
};
const fight = async (poke, great) => {
  await until(sceneIs('world'), 'the world');
  await page.evaluate(`(() => { const bag = ${GAME}.scene.getScene('world').bag; for (const id of ['poke-ball', 'great-ball']) bag.remove(id, bag.count(id)); if (${poke}) bag.add('poke-ball', ${poke}); if (${great}) bag.add('great-ball', ${great}); })()`);
  await page.evaluate(`${GAME}.scene.getScene('world').transitionToBattle({ wild: { speciesId: 'chansey', level: 4, shiny: false }, teachingBattle: false })`);
  await until(sceneIs('battle'), 'the battle');
  await readOn();
  // Onto BALL by the arrows, as a player gets there.
  for (let k = 0; k < 6 && (await read()).cursor !== 1; k += 1) {
    await press('ArrowRight');
    await sleep(200);
  }
  await expectState('on BALL', (s) => s.mode === 'main' && s.cursor === 1);
};
const leave = async () => {
  await page.evaluate(`(() => { const b = ${BATTLE}; b.mode = 'main'; b.flee(); })()`);
  for (let k = 0; k < 60 && (await page.evaluate(sceneIs('battle'))); k += 1) {
    await press('Space');
    await sleep(400);
  }
};

try {
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url, { press, click, until, wait: sleep });

  // Olly's steps.
  await fight(1, 2);
  await capture('1-menu');
  await press('Enter');
  await sleep(700);
  await expectState('BALL', (s) => s.mode === 'balls' && s.cursor === 0);
  await capture('2-list');
  await press('Enter');
  await sleep(300);
  await expectState('ENTER on the Poke Ball', (s) => s.poke === 0 && s.great === 2);
  await readOn();
  await expectState('read on', (s) => s.mode === 'main' && s.cursor === 1);
  await capture('3-menu-again');
  await press('Enter');
  await sleep(700);
  await expectState('BALL with one kind left', (s) => s.mode === 'balls' && s.great === 2);
  await capture('4-list-of-one');
  await leave();

  // A double press of ENTER on BALL.
  await fight(1, 2);
  await press('Enter', 40);
  await sleep(80);
  await press('Enter', 40);
  await sleep(700);
  await expectState('two ENTERs 120ms apart', (s) => s.mode === 'balls' && s.poke === 1 && s.great === 2);
  await capture('5-double-enter');
  await press('Escape');
  await sleep(400);

  // A double click on BALL.
  await expectState('ESC back', (s) => s.mode === 'main' && s.cursor === 1);
  await sleep(700);
  await clickText('BALL x', 2);
  await sleep(700);
  await expectState('double click', (s) => s.mode === 'balls' && s.poke === 1 && s.great === 2);
  await capture('6-double-click');
  await leave();
  console.log('ok');
} finally {
  await browser.close();
}
