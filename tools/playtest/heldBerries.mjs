// A held berry and a weather disc, played the way a player meets them: a Chesto
// Berry given on the raid's team screen, TM11 Sunny Day read out of the raid
// pack, then a wild Oddish that knows nothing but Sleep Powder. The berry has
// to wake its holder by itself, on the turn it was put to sleep, and the plate
// has to stop naming it; Sunny Day has to put harsh sunlight over the field.
//
//   node tools/playtest/heldBerries.mjs <url> <out dir> [--port=N]
//
// The Oddish is stood up by the scene's own way into a wild fight
// (`WorldScene.transitionToBattle`) and its moves cut to Sleep Powder in the
// fight's state, because a wild Oddish rolls its own move; nothing about the
// berry or the disc is reached round. Screenshots of every step land in <out dir>.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice(7);
if (!base || !outDir) throw new Error('usage: heldBerries.mjs <url> <out dir> [--port=N]');
mkdirSync(outDir, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const WORLD = `${GAME}.scene.getScene('world')`;
const BATTLE = `${GAME}.scene.getScene('battle')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const page = await browser.openPage('about:blank');
try {
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 400; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await wait(60);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const clickFirst = (selector, what) =>
    until(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return false; b.click(); return true; })()`, what);

  // A fresh save, packed with one Chesto Berry and the disc.
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); true`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait,
    paused: true,
    level: '20',
    stash: ['chesto-berry:1', 'tm11-sunny-day:1'],
    pack: ['chesto-berry:1', 'tm11-sunny-day:1'],
  });
  await until(sceneIs('world'), 'the raid');
  for (let guard = 0; guard < 12 && (await page.evaluate(`${WORLD}.dialogBox.visible`)); guard += 1) {
    await press('Space');
    await wait(300);
  }

  // -- The berry, given on the team screen -----------------------------------
  await press('KeyP');
  await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the team screen');
  await wait(300);
  await clickFirst('[data-gear-give="chesto-berry"]', 'a Give Chesto Berry chip');
  await wait(300);
  const held = await page.evaluate(`${WORLD}.party.pokemon[0].heldItemId`);
  check(held === 'chesto-berry', `the lead holds the berry it was given (${held})`);
  await page.screenshot(`${outDir}/1-team-holding-chesto.png`);
  await clickFirst('[data-close]', 'the team screen to close');
  await until(`document.querySelectorAll('.menu-overlay').length === 0`, 'the world back');

  // -- The disc, read out of the pack ----------------------------------------
  await press('KeyB');
  await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the pack');
  await wait(200);
  await until(
    `(() => { const r = [...document.querySelectorAll('[data-item]')].find((r) => r.innerText.toLowerCase().includes('tm11')); if (!r) return false; r.click(); return true; })()`,
    'the TM11 row',
  );
  await wait(200);
  await clickFirst('[data-pupil]:not([aria-disabled])', 'somebody who can read TM11');
  // TEACH answers nothing within RELEASE_ARMING_MS (500ms) of the card being chosen.
  await wait(600);
  await page.screenshot(`${outDir}/2-teach-sunny-day.png`);
  await clickFirst('[data-teach]:not([aria-disabled])', 'the TEACH button');
  await wait(400);
  if (await page.evaluate(`Boolean(document.querySelector('[data-forget]'))`)) {
    // A full moveset: give up the first, marked and then confirmed.
    for (let guard = 0; guard < 20; guard += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await page.evaluate(
        `document.querySelector('[data-forget-confirm]') ? document.querySelector('[data-forget-confirm]').click() : document.querySelector('[data-forget]')?.click()`,
      );
      if (!(await page.evaluate(`Boolean(document.querySelector('[data-forget]'))`))) break;
    }
  }
  const moves = await page.evaluate(`JSON.stringify(${WORLD}.party.pokemon[0].moves.map((m) => m.base.name))`);
  check(moves.includes('Sunny Day'), `the lead knows Sunny Day (${moves})`);
  check(
    !(await page.evaluate(`${WORLD}.bag.count('tm11-sunny-day')`)),
    'the TM was used up by the reading',
  );
  await clickFirst('[data-close]', 'the pack to close');
  await until(`document.querySelectorAll('.menu-overlay').length === 0`, 'the world back');
  await wait(300);

  // -- The fight -------------------------------------------------------------
  await page.evaluate(`${WORLD}.transitionToBattle({ wild: { speciesId: 'oddish', level: 18 }, teachingBattle: false })`);
  await until(sceneIs('battle'), 'the fight');
  await wait(1500);
  const cutToSleepPowder = `(() => { const b = ${BATTLE}; const e = b.state.enemy;
    b.state = { ...b.state, enemy: { ...e, moves: e.moves.filter((m) => m.base.name === 'Sleep Powder') } };
    e.pokemon.stats = { ...e.pokemon.stats, speed: 999 }; return b.state.enemy.moves.length; })()`;
  check((await page.evaluate(cutToSleepPowder)) === 1, 'the Oddish knows only Sleep Powder');

  const said = [];
  let berryShot = false;
  let sunShot = false;
  let plateAfter = null;
  /** Reads every line the turn puts up, photographing the ones this is about. */
  const readTurn = async () => {
    for (let guard = 0; guard < 60; guard += 1) {
      const s = await page.evaluate(`(() => { const b = ${BATTLE}; return { mode: b.mode, done: b.dialog?.isCurrentMessageComplete, text: b.dialog?.textObject?.text ?? '' }; })()`);
      if (s.mode === 'main' || s.mode === 'finished' && !s.text) return;
      if (s.done && s.text && said.at(-1) !== s.text) {
        said.push(s.text);
        console.log(`  battle: ${s.text.replace(/\n/g, ' ')}`);
        if (/CHESTO BERRY/.test(s.text) && !berryShot) {
          berryShot = true;
          await page.screenshot(`${outDir}/3-chesto-wakes.png`);
          plateAfter = await page.evaluate(`${BATTLE}.plates.get('player0')?.gearText?.text ?? null`);
        }
        if (/sunlight/i.test(s.text) && !sunShot) {
          sunShot = true;
          await page.screenshot(`${outDir}/4-sunny-day.png`);
        }
      }
      if (s.done) await press('Space');
      await wait(200);
    }
  };
  const chooseMove = async (name) => {
    await until(`${BATTLE}.mode === 'main'`, 'the command menu');
    await page.evaluate(`${BATTLE}.selectedCommand = 0`);
    await press('Space');
    await until(`${BATTLE}.mode === 'moves'`, 'the move list');
    const index = await page.evaluate(`${BATTLE}.state.player.moves.findIndex((m) => m.base.name === ${JSON.stringify(name)})`);
    await page.evaluate(`(() => { const b = ${BATTLE}; b.selectedCommand = ${index}; b.render?.(); })()`);
    await wait(200);
    await press('Space');
    await wait(300);
  };
  await readTurn();
  const platesBefore = await page.evaluate(`${BATTLE}.plates.get('player0')?.gearText?.text ?? null`);
  check(platesBefore === 'CHESTO BERRY', `the plate names the berry before the fight (${platesBefore})`);
  await page.screenshot(`${outDir}/0-plate-before.png`);
  for (let turn = 0; turn < 6 && !(berryShot && sunShot); turn += 1) {
    await chooseMove(sunShot ? 'Razor Leaf' : 'Sunny Day');
    await readTurn();
  }
  check(berryShot, 'a Chesto Berry woke its holder by itself');
  check(plateAfter === '', `the plate stops naming the berry on that line ("${plateAfter}")`);
  check(sunShot, 'Sunny Day put harsh sunlight over the field');
  check(
    (await page.evaluate(`${WORLD}.party.pokemon[0].heldItemId ?? null`)) === null,
    'the berry is gone from the Pokemon',
  );
  const asleep = said.findIndex((line) => /fell asleep/i.test(line));
  const woke = said.findIndex((line) => /CHESTO BERRY/.test(line));
  check(asleep >= 0 && woke === asleep + 1, 'the berry is eaten on the very next line after the sleep');
} finally {
  await page.close?.();
  if (!port) browser.close();
}
if (failures.length > 0) {
  console.log(`${failures.length} failed`);
  process.exitCode = 1;
}
