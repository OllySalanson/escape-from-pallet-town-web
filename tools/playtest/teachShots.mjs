// A disc read in the raid's own bag, photographed at every step: the pocket
// with the disc in it, the teaching screen, the pointer resting on a card it
// has not chosen, the card chosen and the bar asking, the move chooser a full
// moveset opens, a move marked to forget, and the line the bag says after.
//
//   node tools/playtest/teachShots.mjs http://localhost:5173/ <out dir>
//        [--window=1920x950] [--disc=tm13-ice-beam] [--hover-check]
//
// --hover-check fails the run if resting the pointer on a Pokemon moves the
// cursor, the way the captain found it doing on 2026-09-27: pointing is a
// question and only a click or ENTER is an answer (`ui/MenuOverlay.ts`).
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const [base, outDir = 'docs/screens/teach-a-move'] = args.filter((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: teachShots.mjs <dev server url> <out dir> [--window=WxH] [--disc=itemId]');
}
const size = /^(\d+)x(\d+)$/.exec(option('window') ?? '1920x950');
const window = { width: Number(size[1]), height: Number(size[2]) };
const disc = option('disc') ?? 'tm13-ice-beam';
const url = new URL(base);
if (!flag('plain')) url.searchParams.set('testmode', 'pixels');
mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = sleep;
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, holdMs = 60) => {
    await page.keyDown(code);
    if (holdMs > 0) await wait(holdMs);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const shot = async (name) => {
    await wait(300);
    const path = `${outDir}/${name}-${window.width}x${window.height}.png`;
    await page.screenshot(path);
    console.log(path);
  };
  /** The real pointer, moved over the middle of the first element matching. */
  const pointAt = async (selector) => {
    const box = await page.evaluate(
      `(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`,
    );
    if (!box) throw new Error(`nothing to point at: ${selector}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await wait(200);
  };
  const focused = () =>
    page.evaluate(`(() => { const a = document.activeElement; return a?.dataset?.target ?? a?.dataset?.forget ?? a?.dataset?.item ?? a?.innerText?.split('\\n')[0] ?? null; })()`);

  // A party of four who answer the disc four different ways: the starter
  // cannot read Ice Beam, the Squirtle can into a free slot, the Lapras
  // already knows it, and the Seel can with a full moveset, which is the one
  // that opens the chooser.
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait,
    insertion: 'viridian-forest',
    starter: 'Charmander',
    level: '14',
    team: ['squirtle:5', 'lapras:32', 'seel:24'],
    stash: [`${disc}:1`, 'potion:4', 'tm23-iron-tail:1'],
    pack: [`${disc}:1`, 'tm23-iron-tail:1'],
  });
  await until(sceneIs('world'), 'the world');
  // The briefing is up on the raid's first frame; read it away.
  for (let guard = 0; guard < 12; guard += 1) {
    if (!(await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`))) break;
    await press('Space');
    await wait(250);
  }
  await press('KeyB');
  await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the bag');
  await wait(300);
  await page.evaluate(`document.querySelector('[data-item=${JSON.stringify(disc)}]')?.focus()`);
  await shot('1-pocket');
  await page.evaluate(`document.querySelector('[data-item=${JSON.stringify(disc)}]').click()`);
  await until(`Boolean(document.querySelector('[data-pupil]'))`, 'the teaching screen');
  await wait(300);
  await shot('2-who-learns-it');

  // The cursor on the first card that can learn it, the pointer then resting
  // on the last card: the cursor must stay where it was.
  const before = await focused();
  await pointAt('[data-pupil="3"]');
  const after = await focused();
  const help = await page.evaluate(`document.querySelector('[data-help-text]')?.textContent ?? ''`);
  console.log(`cursor before the pointer: ${before}, after resting on card 3: ${after}; help bar: ${help}`);
  await shot('3-pointer-resting');
  if (flag('hover-check') && before !== after) {
    throw new Error(`the pointer moved the cursor from ${before} to ${after}`);
  }
  // The arrow keys still carry the cursor with the pointer resting on a card.
  await press('ArrowRight');
  console.log(`after ArrowRight: ${await focused()}`);

  // Choosing the Seel, which knows four moves, marks it and asks.
  await page.evaluate(`document.querySelector('[data-pupil="3"]').click()`);
  await wait(300);
  console.log(`after choosing: cursor on ${await focused()}, bar says: ${await page.evaluate(`document.querySelector('.teach-bar strong')?.textContent`)}`);
  await shot('4-chosen');
  await page.evaluate(`document.querySelector('[data-teach]').click()`);
  await until(`Boolean(document.querySelector('[data-forget]'))`, 'the move chooser');
  await wait(500);
  await shot('5-move-chooser');
  const chooserBefore = await focused();
  await pointAt('[data-forget="3"]');
  console.log(`chooser cursor before the pointer: ${chooserBefore}, after: ${await focused()}`);
  if (flag('hover-check') && chooserBefore !== (await focused())) {
    throw new Error('the pointer moved the chooser cursor');
  }
  await page.evaluate(`document.querySelector('[data-forget="0"]').click()`);
  await wait(300);
  console.log(`marked: cursor on ${await focused()}, bar: ${await page.evaluate(`document.querySelector('.move-chooser-actions strong')?.textContent`)}`);
  await shot('6-forget-marked');
  await page.evaluate(`document.querySelector('[data-forget-confirm]').click()`);
  await wait(400);
  console.log(`bag says: ${await page.evaluate(`document.querySelector('.px-status-line')?.textContent ?? ''`)}`);
  await shot('7-learned');
} finally {
  await browser.close();
}
