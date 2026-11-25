// Mashing SPACE through the move chooser must never forget a move.
//
//   node tools/playtest/chooserMash.mjs <test-mode build url> [--presses=6]
//
// The chooser a full moveset opens (a disc read in the raid's own bag, the same
// screen a level-up opens) is pressed through the way somebody hurrying past
// the lines of a fight presses: SPACE, again and again. It used to open with
// the cursor on the first move, so one press marked it and the next pressed
// FORGET - the overnight critic's Oddish lost its only attack (25 Nov 2026,
// problem 45). It fails if any move is gone at the end.
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base] = args.filter((arg) => !arg.startsWith('--'));
const presses = Number(args.find((arg) => arg.startsWith('--presses='))?.slice(10) ?? 6);
if (!base) throw new Error('usage: chooserMash.mjs <test-mode build url> [--presses=6]');
const disc = 'tm13-ice-beam';
const url = new URL(base);
url.searchParams.set('testmode', '1');

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
let failed = false;
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, holdMs = 60) => {
    await page.keyDown(code);
    if (holdMs > 0) await sleep(holdMs);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await sleep(350);
  };
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait: sleep,
    insertion: 'greystone-vale',
    starter: 'Charmander',
    level: '14',
    team: ['seel:24'],
    stash: [`${disc}:1`, 'potion:4'],
    pack: [`${disc}:1`],
  });
  await until(sceneIs('world'), 'the world');
  for (let guard = 0; guard < 12; guard += 1) {
    if (!(await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`))) break;
    await press('Space');
    await sleep(250);
  }
  const seelMoves = `JSON.stringify(${GAME}.scene.getScene('world').party.pokemon.find((p) => p.base.id === 'seel').moves.map((m) => m.base.name))`;
  const before = await page.evaluate(seelMoves);
  await press('KeyB');
  await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the bag');
  await sleep(300);
  await page.evaluate(`document.querySelector('[data-item=${JSON.stringify(disc)}]').click()`);
  await until(`Boolean(document.querySelector('[data-pupil]'))`, 'the teaching screen');
  const seelCard = await page.evaluate(`[...document.querySelectorAll('[data-pupil]')].findIndex((b) => /seel/i.test(b.innerText))`);
  await page.evaluate(`document.querySelectorAll('[data-pupil]')[${seelCard}].click()`);
  await sleep(600);
  await page.evaluate(`document.querySelector('[data-teach]').click()`);
  await until(`Boolean(document.querySelector('[data-forget]'))`, 'the move chooser');
  // Past the chooser's own arming beat, then the mash.
  await sleep(450);
  const start = await page.evaluate(`(() => { const a = document.activeElement; return a?.dataset ? Object.keys(a.dataset).join(',') : null; })()`);
  for (let index = 0; index < presses; index += 1) {
    await press('Space');
    await sleep(160);
  }
  await sleep(400);
  const after = await page.evaluate(seelMoves);
  console.log(`cursor opened on: ${start}`);
  console.log(`moves before: ${before}`);
  console.log(`moves after ${presses} presses: ${after}`);
  const lost = JSON.parse(before).filter((name) => !JSON.parse(after).includes(name));
  if (lost.length > 0) {
    failed = true;
    console.log(`FORGOTTEN by mashing: ${lost.join(', ')}`);
  } else {
    console.log('no move forgotten');
  }
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
