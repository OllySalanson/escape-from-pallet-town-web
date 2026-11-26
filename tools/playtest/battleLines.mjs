// What a fight says, line by line, with a picture of each (`docs/screens/battle-lines/`).
//
//   node tools/playtest/battleLines.mjs <test-mode build url> <dir> [--port=N] [--hp=N] [--status=burn] [--move=NAME] [--items] [--party] [--moves] [--full-pack]
//
// Deploys a new save into Greystone Vale with a Charmander on 7 HP leading a
// Pikachu, Potions packed, and starts a wild Gastly fight. Reads every line
// to the commands, then uses SCRATCH - a NORMAL move a GHOST is immune to -
// and reads every line of that turn. Each line is photographed as
// `<n>-line.png` and printed, so two builds' fights can be laid side by side.
// `--hp=N` starts the Charmander on N HP instead, `--move=EMBER` uses that
// move instead of SCRATCH (EMBER at a third of its HP or less is where BLAZE
// powers it), and `--items` opens ITEM before the move and photographs the
// list with the line under its first medicine. `--status=burn` (or any
// status) puts the Charmander in it, and `--party` opens POKéMON before the
// move and photographs the list. `--moves` opens FIGHT, puts the cursor on
// the move asked for and photographs the list and the lines under it.
// `--full-pack` fills the raid's pack with materials and medicine first, then throws a ball
// and photographs the refusal and the panel it opens.
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep, writeScreenshot } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url, dir] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !dir) throw new Error('usage: battleLines.mjs <test-mode build url> <dir> [--port=N]');
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
const hp = Number(option('hp') ?? 7);
const moveName = (option('move') ?? 'SCRATCH').toUpperCase();

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
const BATTLE = `${GAME}.scene.getScene('battle')`;
const PACK = ['potion:2', 'poke-ball:3'];
const read = () =>
  page.evaluate(
    `(() => { const b = ${BATTLE}; const d = b.describeForTest(); return { mode: b.mode, command: b.mode === 'main' ? b.mainActions()[b.selectedCommand]?.type : null, line: d.message?.text ?? null }; })()`,
  );
let shot = 0;
/** Photographs and prints each new line, pressing OK through them, until the commands are up. */
const readLines = async () => {
  let last = null;
  for (let k = 0; k < 60; k += 1) {
    const now = await read();
    if (now.mode === 'main') break;
    if (now.line && now.line !== last) {
      await sleep(700);
      const settled = await read();
      shot += 1;
      console.log(`${shot}: ${settled.line}`);
      await writeScreenshot(`${dir}/${shot}-line.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
      last = settled.line;
    }
    await press('Space');
    await sleep(500);
  }
  await sleep(600);
  console.log(`commands open on: ${(await read()).command}`);
};

try {
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url, { press, click, until, wait: sleep, starter: 'Charmander', team: ['pikachu:12'], level: 12, stash: PACK, pack: PACK });
  await until(sceneIs('world'), 'the world');
  if (args.includes('--full-pack')) {
    console.log(`pack filled: ${await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('world').bag; let n = 0; for (const id of ['parts-crate', 'linen-roll', 'mooring-rope', 'lamp-oil', 'cable-coil', 'radio-valve', 'potion', 'antidote']) while (n < 400 && b.add(id, 1)) n += 1; return n; })()`)} things`);
  }
  await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); w.party.pokemon[0].currentHp = ${hp}; w.party.pokemon[0].primaryStatus = ${JSON.stringify(option('status') ?? null)}; w.transitionToBattle({ wild: { speciesId: 'gastly', level: 12, shiny: false }, teachingBattle: false }); })()`);
  await until(sceneIs('battle'), 'the battle');
  await sleep(1200);
  await readLines();
  await writeScreenshot(`${dir}/${++shot}-commands.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
  if (args.includes('--items')) {
    await page.evaluate(`${BATTLE}.dispatchAction({ type: 'choose-item' })`);
    await sleep(800);
    console.log(`ITEM: ${(await page.evaluate(`${BATTLE}.describeForTest().commands.join(' | ')`))}`);
    console.log(`under it: ${await page.evaluate(`${BATTLE}.moveGuidanceTexts[0]?.text ?? ''`)}`);
    await writeScreenshot(`${dir}/${++shot}-items.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    await press('Escape');
    await sleep(600);
  }
  if (args.includes('--full-pack')) {
    await page.evaluate(`${BATTLE}.dispatchAction({ type: 'choose-ball' })`);
    await sleep(800);
    await page.evaluate(`${BATTLE}.dispatchAction({ type: 'throw-ball', ballIndex: 0 })`);
    await until(`${BATTLE}.describeForTest().message?.complete === true`, 'the refusal read out');
    await sleep(400);
    console.log(`the ball says: ${await page.evaluate(`${BATTLE}.describeForTest().message?.text ?? ''`)}`);
    await writeScreenshot(`${dir}/${++shot}-no-room.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    await press('Space');
    await sleep(1000);
    if ((await page.evaluate(`${BATTLE}.mode`)) === 'events') {
      await press('Space');
      await sleep(1000);
    }
    console.log(`then: ${await page.evaluate(`${BATTLE}.mode`)} - ${await page.evaluate(`${BATTLE}.describeForTest().commands.join(' | ')`)}`);
    await writeScreenshot(`${dir}/${++shot}-make-room.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
  }
  if (args.includes('--moves')) {
    await page.evaluate(`${BATTLE}.dispatchAction({ type: 'choose-fight' })`);
    await sleep(600);
    await page.evaluate(`(() => { const b = ${BATTLE}; b.selectedCommand = Math.max(0, b.state.player.moves.findIndex((m) => m.base.name.toUpperCase() === ${JSON.stringify(moveName)})); b.showCommands(); })()`);
    await sleep(600);
    console.log(`FIGHT on ${moveName}: ${(await page.evaluate(`${BATTLE}.moveGuidanceTexts.map((t) => t.text).join(' / ')`))}`);
    await writeScreenshot(`${dir}/${++shot}-moves.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    await press('Escape');
    await sleep(600);
  }
  if (args.includes('--party')) {
    await page.evaluate(`${BATTLE}.dispatchAction({ type: 'choose-pokemon' })`);
    await sleep(800);
    console.log(`POKéMON: ${(await page.evaluate(`${BATTLE}.describeForTest().commands.join(' | ')`))}`);
    await writeScreenshot(`${dir}/${++shot}-party.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    await press('Escape');
    await sleep(600);
  }
  // The move asked for (SCRATCH, a NORMAL move a GHOST is immune to, unless
  // --move says otherwise); Math.random is pinned so the rolls repeat.
  await page.evaluate(`(() => { Math.random = () => 0.99; const b = ${BATTLE}; const i = b.state.player.moves.findIndex((m) => m.base.name.toUpperCase() === ${JSON.stringify(moveName)}); if (i < 0) throw new Error('no move ${moveName}'); b.useMove(i); })()`);
  await readLines();
} finally {
  await browser.close();
}
