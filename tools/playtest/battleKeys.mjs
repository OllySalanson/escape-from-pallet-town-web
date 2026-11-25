// The battle's keys and mouse, on a real build (`docs/screens/battle-keys/`).
//
//   node tools/playtest/battleKeys.mjs <test-mode build url> <dir> [--port=N]
//
// It deploys a new save into Greystone Vale and starts a wild fight the way the
// grass does (`WorldScene.transitionToBattle`). Then: the opening lines are read
// with mouse clicks alone, which must reach the command menu; the pointer rests
// on ITEM, which must light it and leave the cursor on FIGHT; D must move the
// cursor as Right does; Right held on past the end of the row must stop there
// rather than wrap to FIGHT. Each step is photographed and logged, and it exits
// non-zero on the first that goes wrong.
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep, writeScreenshot } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const [url, dir] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !dir) throw new Error('usage: battleKeys.mjs <test-mode build url> <dir> [--port=N]');

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
const read = () => page.evaluate(`(() => { const b = ${BATTLE}; return { mode: b.mode, cursor: b.selectedCommand }; })()`);
const expectState = async (what, check) => {
  const state = await read();
  console.log(`${what}: ${JSON.stringify(state)}`);
  if (!check(state)) throw new Error(`wrong after ${what}`);
  return state;
};
/** Where on the page a point of the battle screen is drawn. */
const onPage = (expression) =>
  page.evaluate(`(() => {
    const b = ${BATTLE};
    const p = ${expression};
    if (!p) return null;
    const cam = b.cameras.main;
    const canvas = ${GAME}.canvas.getBoundingClientRect();
    const scale = canvas.width / ${GAME}.scale.width;
    return { x: canvas.left + (p.x - cam.scrollX) * cam.zoom * scale, y: canvas.top + (p.y - cam.scrollY) * cam.zoom * scale };
  })()`);
const mouse = async (type, at) =>
  page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });

try {
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url, { press, click, until, wait: sleep });
  await until(sceneIs('world'), 'the world');
  await page.evaluate(`${GAME}.scene.getScene('world').transitionToBattle({ wild: { speciesId: 'rattata', level: 3, shiny: false }, teachingBattle: false })`);
  await until(sceneIs('battle'), 'the battle');
  await sleep(1200);

  // The opening lines, read with the mouse alone: a click on the line.
  const line = await onPage(`({ x: 160, y: 200 })`);
  await capture('1-line');
  for (let k = 0; k < 30 && (await read()).mode !== 'main'; k += 1) {
    await mouse('mousePressed', line);
    await mouse('mouseReleased', line);
    await sleep(500);
  }
  await expectState('lines read by clicking', (s) => s.mode === 'main' && s.cursor === 0);
  await sleep(700);

  // Pointing at ITEM lights it; the cursor stays on FIGHT.
  const item = await onPage(`(() => { const t = b.commandTexts.find((t) => t.text.includes('ITEM')); return t && { x: t.getBounds().centerX, y: t.getBounds().centerY }; })()`);
  await mouse('mouseMoved', item);
  await sleep(300);
  await expectState('pointer on ITEM', (s) => s.mode === 'main' && s.cursor === 0);
  const ink = await page.evaluate(`${BATTLE}.commandTexts.find((t) => t.text.includes('ITEM')).style.color`);
  console.log(`ITEM ink while pointed at: ${ink}`);
  await capture('2-pointing-at-item');
  await mouse('mouseMoved', { x: 4, y: 4 });
  await sleep(200);

  // D is Right.
  await press('KeyD');
  await sleep(250);
  await expectState('D', (s) => s.cursor === 1);
  // Right past the end of the row stops there.
  for (let k = 0; k < 4; k += 1) {
    await press('ArrowRight');
    await sleep(200);
  }
  const end = await expectState('Right to the end of the row', (s) => s.cursor > 1);
  await press('ArrowRight');
  await sleep(250);
  await expectState('Right once more', (s) => s.cursor === end.cursor);
  await capture('3-end-of-row');
  console.log('ok');
} finally {
  await browser.close();
}
