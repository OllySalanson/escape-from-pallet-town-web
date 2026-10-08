// Holds Enter down on the menus, the way a player leaning on the key does.
//
//   node tools/playtest/heldEnter.mjs <url> [--plain]
//
// A held key sends one keydown and then a stream of keydowns marked `repeat`,
// and Chromium works the focused button on every one of them. Two screens
// were run through by it (playtest 26 #7): the drop-in step's `Review & deploy`
// re-rendered into the final check with the cursor on `Enter the raid`, and the
// next repeat started the raid; and the raid pack's Potion opened its
// recipient list and the repeats gave the Potion away, then the next one.
//
// It deploys a fresh save, holds Enter on `Review & deploy` and reports which
// screen it ended on; then, in the raid, holds Enter on a Potion and reports
// how many were drunk, then taps Enter once more and expects exactly one.
// Exit code 1 is the bug.
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, sceneIs, walkIntoBase } from './deploy.mjs';

const [url = 'http://localhost:5173/'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

/** One press and `repeats` auto-repeats, at a keyboard's own 33ms rate. */
async function holdEnter(page, repeats) {
  const enter = { code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13, text: '\r' };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...enter });
  for (let i = 0; i < repeats; i += 1) {
    await sleep(33);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', autoRepeat: true, ...enter });
  }
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(400);
}

const browser = await launchBrowser();
let failed = false;
try {
  const page = await browser.openPage(process.argv.includes('--plain') ? url : `${url}?testmode=1`);
  const press = async (code) => { await page.tap(code, 60); await sleep(150); };
  const until = (expression, what) => page.waitFor(expression, { what });
  const click = async (label) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`,
      `a button labelled ${label}`,
    );
    await sleep(250);
  };
  const focus = (label) => until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.focus(); return document.activeElement === b; })()`,
    `a button labelled ${label} to focus`,
  );

  await page.waitFor(sceneIs('title'));
  await press('Space'); await until(sceneIs('starter'));
  await until(`(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`, 'the picker');
  await click('Confirm Bulbasaur');
  await until(sceneIs('base'));
  await walkIntoBase(page, 'oaks-lab', { press, until });
  await click('Start a raid');
  await click('Bulbasaur');
  await click('Choose drop-in');

  await focus('Review & deploy');
  await holdEnter(page, 12);
  const inRaid = await page.evaluate(sceneIs('world'));
  console.log(`held Enter on Review & deploy: ${inRaid ? 'RAN INTO THE RAID' : 'stopped at the final check'}`);
  failed ||= inRaid;

  if (!inRaid) {
    await click('Enter the raid');
  }
  await until(sceneIs('world'));
  // Whatever the raid opens on is read before the bag is opened.
  await page.waitFor(`!${GAME}.scene.getScene('world').dialogBox?.isOpen?.()`, { timeoutMs: 3000 }).catch(() => undefined);
  for (let guard = 0; guard < 6 && !(await page.evaluate(sceneIs('bag'))); guard += 1) {
    await press('Space');
    await press('KeyB');
    await sleep(300);
  }
  await until(sceneIs('bag'));
  // Hurt the partner again straight after every heal, so every Potion offered
  // to it is one it will drink: a full partner would refuse the second and
  // hide a double press.
  await page.evaluate(`(() => { const p = ${GAME}.scene.getScene('world').party.pokemon[0]; let hp = 1; Object.defineProperty(p, 'currentHp', { configurable: true, get: () => hp, set: (value) => { hp = value; setTimeout(() => { hp = 1; }, 0); } }); })()`);
  const potions = () => page.evaluate(`${GAME}.scene.getScene('world').bag.count('potion')`);
  const before = await potions();
  await focus('Potion');
  await holdEnter(page, 12);
  const after = await potions();
  console.log(`held Enter on a Potion: ${before - after} drunk (${before} -> ${after})`);
  failed ||= before - after > 1;
  // And a fresh press still works: held, Enter opened the recipient list and
  // went no further, so one more tap gives exactly one Potion.
  await press('Enter');
  await sleep(300);
  const tapped = after - (await potions());
  console.log(`one more tap of Enter: ${tapped} drunk`);
  failed ||= before - after === 0 && tapped !== 1;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
