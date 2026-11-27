// Plays THE CHEST in THE BOLTHOLE (`home/furniture.ts`, `BaseScene.openChest`):
// a new game is given a few raids' worth of things, then:
//
//   - THE CHEST stands downstairs at its own spot, solid, and is named on the
//     hint line as it is walked up to;
//   - SPACE at it throws the lid back, and the things screen opens headed
//     THE CHEST, its storage grid headed CHEST; closing it shuts the lid;
//   - B anywhere opens the same screen headed YOUR THINGS;
//   - the one Pokémon of a new game is offered the partner swap on its card in
//     the POKéMON tab, and C opens it;
//   - decorating (H) picks the chest up and puts it down two tiles west, which
//     the save keeps; X on it is refused and it stays standing.
//
//   node tools/playtest/chest.mjs <test-mode build url> <out dir> [--port=CDP port] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`chest: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;
  const screenTitle = `document.querySelector('#screens .px-title h1')?.textContent ?? ''`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const start = async (data, what) => {
    await page.evaluate(`void ${base}.scene.start('base', ${JSON.stringify(data)})`);
    await until(baseReady, what);
    await wait(400);
    // The first key after a scene is started again by hand is spent on nothing.
    await press('Escape');
    await wait(200);
  };
  const chestAt = () =>
    page.evaluate(`(${base}.place.room?.home?.placed ?? []).filter((p) => p.id === 'chest').map((p) => [p.x, p.y])`);

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...(save.stash.items ?? {}), potion: 4, 'poke-ball': 6, 'great-ball': 2, 'tm40-aerial-ace': 1,
      'thunder-stone': 1, money: 640, 'cable-coil': 2, 'oran-berry': 3 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);

  // Walked up to from the room's middle.
  await start({ room: 'bolthole', at: { x: 12, y: 8 }, facing: 'up' }, 'the front room');
  const home = await chestAt();
  console.log(`THE CHEST stands at ${JSON.stringify(home)}`);
  if (JSON.stringify(home) !== '[[12,5]]') fail(`the chest stands at ${JSON.stringify(home)}, not 12,5`);
  if (!(await page.evaluate(`${base}.place.room.collision[5][12]`))) fail('the chest is not solid');
  for (let i = 0; i < 2; i += 1) {
    await page.keyDown('ArrowUp');
    await step(6);
    await page.keyUp('ArrowUp');
    await wait(400);
  }
  const tile = await page.evaluate(`${base}.currentTile`);
  if (tile.x !== 12 || tile.y !== 6) fail(`walked to ${tile.x},${tile.y}, not 12,6`);
  await shoot('01-walked-up');

  // SPACE: the lid goes, then the screen.
  await press('Space');
  await step(4);
  const lid = await page.evaluate(`${base}.chestImage?.frame?.name`);
  if (String(lid) !== '1') fail(`the lid is frame ${lid}, not open`);
  await shoot('02-lid-open');
  await until(`${sceneIs('things')} && /the chest/i.test(${screenTitle})`, 'THE CHEST screen');
  await wait(400);
  await shoot('03-the-chest');
  const heading = await page.evaluate(`document.querySelector('#screens .things-stash .things-side-name')?.textContent ?? ''`);
  if (!/^chest$/i.test(heading.trim())) fail(`the storage grid is headed "${heading}"`);
  await press('Escape');
  await until(baseReady, 'the front room again');
  await wait(300);
  const shut = await page.evaluate(`${base}.chestImage?.frame?.name`);
  if (String(shut) !== '0') fail(`the lid is frame ${shut} once the screen is shut`);
  await shoot('04-shut-again');

  // B anywhere: the same screen, headed YOUR THINGS.
  await press('KeyB');
  await until(`${sceneIs('things')} && /your things/i.test(${screenTitle})`, 'YOUR THINGS on B');
  await wait(300);
  await shoot('05-b-your-things');
  await press('Escape');
  await until(baseReady, 'back from YOUR THINGS');
  await wait(300);

  // The partner swap BILL'S PC used to offer: a new game has one Pokémon, so
  // its card in THE CHEST offers it, and C opens the swap.
  await press('KeyB');
  await until(`${sceneIs('things')}`, 'YOUR THINGS for the swap');
  await wait(200);
  await press('KeyP');
  await until(`${sceneIs('chest-pokemon')} && Boolean(document.querySelector('#screens .chest-mon-grid'))`, 'the POKéMON tab');
  await wait(300);
  if (!(await page.evaluate(`Boolean(document.querySelector('#screens [data-key="swap"]'))`))) fail('the only Pokémon is not offered the swap');
  await shoot('05b-swap-offered');
  await press('KeyC');
  await until(`${sceneIs('hub')} && /swap your partner/i.test(document.querySelector('#screens .px-title h1')?.textContent ?? '')`, 'the partner swap');
  await wait(300);
  await shoot('05c-swap-screen');
  await press('Escape');
  await until(baseReady, 'back from the swap');
  await wait(300);

  // Decorating: H, pick it up, two tiles west, put it down; X is refused.
  await press('KeyH');
  await wait(200);
  await press('Space');
  await wait(100);
  const held = await page.evaluate(`${base}.decor?.state?.held?.id ?? null`);
  if (held !== 'chest') fail(`decorating picked up ${held}, not the chest`);
  await press('ArrowLeft');
  await press('ArrowLeft');
  await shoot('06-carrying-the-chest');
  await press('Space');
  await wait(200);
  const layout = (await saved()).raidProgress.homeLayout ?? [];
  if (!layout.some((p) => p.id === 'chest' && p.x === 10 && p.y === 5)) fail(`the save keeps ${JSON.stringify(layout)}`);
  await press('KeyX');
  await wait(100);
  const refusal = await page.evaluate(`${base}.decor?.refusal ?? null`);
  if (refusal?.kind !== 'stays-out') fail(`X on the chest gave ${JSON.stringify(refusal)}`);
  await shoot('07-chest-stays-out');
  await press('KeyH');
  await until(`${baseReady} && !${base}.decor`, 'decorating done');
  await wait(300);
  const moved = await chestAt();
  if (JSON.stringify(moved) !== '[[10,5]]') fail(`the chest stands at ${JSON.stringify(moved)} once moved`);
  await shoot('08-moved');
  console.log('chest: every check passed');
} finally {
  await browser.close();
}
