// Plays the one thing about THE POKéDEX a screenshot cannot show: that a kind
// met in a fight is in the save the moment it appears, and is still there when
// the raid it was met on is lost.
//
//   - a brand new save deploys, and a wild SNORLAX appears
//     (`WorldScene.transitionToBattle`, as `heldBerries.mjs` starts its fight);
//   - before a move is chosen the save already holds No. 143 as met
//     (`SaveManager.registerSeen`), and not as owned;
//   - the page is loaded again mid-fight, which abandons the raid: back at the
//     harbour, X opens the Pokédex and SNORLAX's tile is its shape - met, not
//     owned - with its page behind ENTER, while the kinds never met are balls.
//
//   node tools/playtest/pokedexMet.mjs <test-mode build url> <out dir>
//
// It steps a paused loop, so it wants a test-mode build
// (`tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
if (!base || !outDir) throw new Error('usage: pokedexMet.mjs <test-mode build url> <out dir>');
mkdirSync(outDir, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
// A loaded machine pauses a browser ten seconds at a time: boot is given a minute.
const SLOW_MS = 60_000;

const WORLD = `${GAME}.scene.getScene('world')`;
const BASE = `${GAME}.scene.getScene('base')`;
const PANEL = '#screens .pokedex-menu';
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 400; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    await page.screenshot(`${outDir}/stuck.png`);
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
  const progress = () => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).raidProgress`);

  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`, { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.clear(); true`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`, { timeoutMs: SLOW_MS });
  await deploy(page, url.href, { press, click, until, wait, paused: true });
  await until(sceneIs('world'), 'the raid');
  for (let guard = 0; guard < 12 && (await page.evaluate(`${WORLD}.dialogBox.visible`)); guard += 1) {
    await press('Space');
    await wait(300);
  }
  const before = await progress();
  check(!(before.pokedexSeen ?? []).includes(143), `a new save has not met SNORLAX (met ${JSON.stringify(before.pokedexSeen ?? [])})`);

  await page.evaluate(`${WORLD}.transitionToBattle({ wild: { speciesId: 'snorlax', level: 30 }, teachingBattle: false })`);
  await until(sceneIs('battle'), 'the fight');
  await wait(1500);
  const during = await progress();
  check((during.pokedexSeen ?? []).includes(143), `the save holds No. 143 as met while the fight is still on (met ${JSON.stringify(during.pokedexSeen ?? [])})`);
  check(!(during.pokedexOwned ?? []).includes(143), `and not as owned (owned ${JSON.stringify(during.pokedexOwned ?? [])})`);
  await page.screenshot(`${outDir}/1-a-wild-snorlax.png`);

  // The raid is lost: the page goes away with the fight still on.
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(sceneIs('base'), 'the harbour after the raid was abandoned');
  for (let guard = 0; guard < 30 && !(await page.evaluate(`${BASE}.ready && !${BASE}.dialogBox.visible`)); guard += 1) {
    await press('Space');
    await wait(300);
  }
  const after = await progress();
  check((after.pokedexSeen ?? []).includes(143), `the raid is gone and SNORLAX is still met (met ${JSON.stringify(after.pokedexSeen ?? [])})`);

  await press('Escape');
  await wait(300);
  await press('KeyX');
  await until(`${sceneIs('pokedex')} && Boolean(document.querySelector('${PANEL} [data-dex]'))`, 'THE POKéDEX');
  await wait(400);
  const tile = await page.evaluate(`document.querySelector('${PANEL} [data-dex="143"]').className`);
  check(/is-seen/.test(tile), `its tile is its shape: met, not owned (${tile})`);
  const counts = await page.evaluate(`JSON.stringify(['owned', 'seen', 'unknown'].map((s) => document.querySelectorAll('${PANEL} .dex-tile.is-' + s).length))`);
  check(counts === JSON.stringify([1, 1, 149]), `one owned, one met, 149 empty balls (${counts})`);
  await page.evaluate(`document.querySelector('${PANEL} [data-dex="143"]').focus()`);
  await wait(200);
  await page.screenshot(`${outDir}/2-met-not-owned.png`);
  await press('Enter');
  await until(`Boolean(document.querySelector('${PANEL} [data-dex-page="143"]'))`, "SNORLAX's page");
  await wait(500);
  await page.screenshot(`${outDir}/3-its-page.png`);
  check(await page.evaluate(`document.querySelector('${PANEL} .dex-entry').textContent.includes('Met, not owned')`), 'its page says met, not owned');

  if (failures.length > 0) throw new Error(`pokedexMet: ${failures.length} failed: ${failures.join('; ')}`);
  console.log('pokedexMet: every check passed');
} finally {
  await browser.close();
}
