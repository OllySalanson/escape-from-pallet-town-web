// Plays the Raid Arena end to end: the one way into a raid.
//
//   node tools/playtest/raidArena.mjs <url> <out-dir>
//
// A fresh save walks out into the harbour, across to the Raid Arena at its
// west end, and through its door into the great hall, where one key on the mat
// opens the loadout. Backing out of the loadout stands the player on that mat,
// and down off it is the Arena's step.
// Oak's Lab is then opened to check it starts no raid of its own, and the
// player walks back to the Arena and deploys. Each stop is photographed into
// <out-dir>; exit code 1 is anything not where it should be.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, sceneIs, takePokemon, walkIntoBase, jumpIn, openHallPanel } from './deploy.mjs';

const [url = 'http://localhost:5173/', out = 'raid-arena-shots'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ window: PIXEL_WINDOW });
const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code, 60); await sleep(150); };
  const until = (expression, what) => page.waitFor(expression, { what });
  const click = async (label) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)}) && b.getAttribute('aria-disabled') !== 'true'); if (!b) return false; b.click(); return true; })()`,
      `a button labelled ${label}`,
    );
    await sleep(300);
  };
  // A newcomer is told things once (`hub/firstWords.ts`); the box is put down
  // as a player reads it and presses Got it.
  const putDownFirstWords = async () => {
    for (let guard = 0; guard < 8; guard += 1) {
      const put = await page.evaluate(`(() => { const b = document.querySelector('[data-speech-done]'); if (b) b.click(); return !!b; })()`);
      if (!put) return;
      await sleep(300);
    }
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
  const hub = (expression) => page.evaluate(`(() => { const h = ${GAME}.scene.getScene('hub'); return ${expression}; })()`);

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await until(sceneIs('starter'));
  await until(`(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`, 'the picker');
  await click('Confirm Charmander');
  await until(sceneIs('base'));
  await sleep(1200);
  await page.screenshot(`${out}/1-harbour-spawn.png`);

  await walkIntoBase(page, 'raid-arena', { press, until });
  await until(`${GAME}.scene.getScene('hub')?.sys.isActive()`, 'the hub');
  await sleep(600);
  expect('the hall\'s bench opens the party', (await hub(`h.view`)) === 'bench');
  await putDownFirstWords();
  await page.screenshot(`${out}/2-arena-bench.png`);

  await press('Escape');
  await until(sceneIs('base'), 'back in the hall');
  await sleep(1000);
  const atBench = await base(`b.room?.id === 'raid-arena' && b.arenaStations[0].tiles.some((tile) => tile.x === b.currentTile.x && tile.y + 1 === b.currentTile.y)`);
  expect('backing out stands the player where they stood, at the bench', atBench);
  await page.screenshot(`${out}/3-arena-hall.png`);
  const walkIntoMat = async () => {
    const key = await base(`(() => { const s = b.currentTile, m = b.room.mat; if (s.x === m.x && s.y === m.y) return 'ArrowDown'; if (s.y < 59 || s.x !== m.x) return s.y < 59 ? 'ArrowDown' : (s.x < m.x ? 'ArrowRight' : 'ArrowLeft'); return 'ArrowDown'; })()`);
    await press(key);
    await sleep(250);
  };
  for (let guard = 0; guard < 60 && (await base('Boolean(b.room)')); guard += 1) {
    await walkIntoMat();
  }
  const standing = await base(`JSON.stringify({ room: b.room?.id ?? null, tile: b.currentTile })`);
  expect(`down off the mat is the Arena's step (${standing})`, standing === JSON.stringify({ room: null, tile: { x: 8, y: 13 } }));

  await walkIntoBase(page, 'oaks-lab', { press, until });
  await sleep(600);
  await putDownFirstWords();
  const lab = await page.evaluate(`document.querySelector('.pixel-ui')?.innerHTML ?? ''`);
  expect('Oak’s Lab starts no raid', !lab.includes('data-deploy-flow') && !lab.includes('data-contract=') && !lab.includes('Start a raid'));
  expect('Oak’s Lab says where raids start', lab.includes('The Raid Arena'));
  await page.screenshot(`${out}/4-oaks-lab.png`);

  await press('Escape');
  await until(sceneIs('base'), 'back in the lab');
  await walkIntoBase(page, 'raid-arena', { press, until });
  await sleep(600);
  await putDownFirstWords();
  await until(takePokemon('Charmander'), 'Charmander in the raid party');
  await jumpIn(page, { press, until });
  await sleep(1500);
  expect('the raid starts from the Arena', await page.evaluate(sceneIs('world')));
  await page.screenshot(`${out}/5-raid.png`);
} catch (error) {
  faults.push(String(error?.message ?? error));
  console.error(error);
} finally {
  await browser.close();
}
process.exit(faults.length === 0 ? 0 : 1);
