// The graveyard's Gastly fight as Olly met it (`docs/screens/graveyard-battle/`).
//
//   node tools/playtest/graveyardBattle.mjs <test-mode build url> <dir> [--port=N]
//
// Deploys a new save into Greystone Vale with a Charmander and a Pikachu,
// a CHERI BERRY and Potions packed, paralyses the lead and starts a wild
// Gastly fight the way the churchyard's grass does. It photographs the
// commands the fight opens on, then swaps to the other Pokémon and back and
// photographs the menu each swap comes back on. Prints the cursor after each
// swap; exits non-zero if the menu does not come back on FIGHT.
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep, writeScreenshot } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url, dir] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !dir) throw new Error('usage: graveyardBattle.mjs <test-mode build url> <dir> [--port=N]');
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
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
const PACK = ['potion:2', 'cheri-berry:1', 'poke-ball:3'];
const read = () =>
  page.evaluate(
    `(() => { const b = ${BATTLE}; return { mode: b.mode, command: b.mode === 'main' ? b.mainActions()[b.selectedCommand]?.type : null, cursor: b.selectedCommand, line: b.dialog?.currentMessage ?? null }; })()`,
  );
/** Presses OK until the commands are up. */
const readOnToCommands = async () => {
  for (let k = 0; k < 40 && (await read()).mode !== 'main'; k += 1) {
    await press('Space');
    await sleep(500);
  }
  if ((await read()).mode !== 'main') throw new Error('never reached the commands');
  await sleep(600);
};
const choose = (word) =>
  page.evaluate(`(() => { const t = ${BATTLE}.commandTexts.find((t) => t.text.replace('▶ ', '').startsWith(${JSON.stringify(word)})); t?.emit('pointerdown'); return Boolean(t); })()`);

let failed = false;
try {
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url, { press, click, until, wait: sleep, starter: 'Charmander', team: ['pikachu:12'], lead: 'Pikachu', level: 12, stash: PACK, pack: PACK });
  await until(sceneIs('world'), 'the world');
  await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); w.party.pokemon[0].primaryStatus = 'paralysis'; w.transitionToBattle({ wild: { speciesId: 'gastly', level: 12, shiny: false }, teachingBattle: false }); })()`);
  await until(sceneIs('battle'), 'the battle');
  await sleep(1200);
  await readOnToCommands();
  console.log(`commands open on: ${(await read()).command}`);

  for (const [n, partyIndex] of [
    [4, 1],
    [5, 0],
  ]) {
    if (!(await choose('POK'))) throw new Error('no POKéMON command');
    await sleep(800);
    await page.evaluate(`${BATTLE}.switchPokemon(${partyIndex})`);
    await readOnToCommands();
    const after = await read();
    console.log(`after the switch the menu is on: ${after.command}`);
    await capture(`${n}-menu-after-switch`);
    if (after.command !== 'choose-fight') failed = true;
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
