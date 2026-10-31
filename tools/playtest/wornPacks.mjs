// The pack on the player's back, played end to end (`src/game/look/wornPack.ts`):
//
//   node tools/playtest/wornPacks.mjs <test-mode build url> <out dir>
//
// In the harbour, in every facing and walking, with each pack the vault can hold;
// empty-handed; at the rack, where choosing another changes the figure at once;
// over the rail and down into a raid, wearing what was chosen; on the Bicycle,
// and off it again. It fails loudly - a thrown error, not a picture - if the
// figure is ever drawn from the wrong sheet or a frame costs more than the rest.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = process.argv.slice(2);
const FRAME_MS = 1000 / 60;
const WINDOW = { width: 1200, height: 768 };
mkdirSync(out, { recursive: true });
const PACKS = ['satchel', 'raid-pack', 'ranger-pack', 'hauler-frame'];
const FACINGS = [['down', 'ArrowDown'], ['right', 'ArrowRight'], ['up', 'ArrowUp'], ['left', 'ArrowLeft']];
const BASE = `${GAME}.scene.getScene('base')`;
const WORLD = `${GAME}.scene.getScene('world')`;

const fail = (why) => {
  throw new Error(`worn packs: ${why}`);
};

const browser = await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(1);
  };
  const shot = async (name, clip) => {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    writeFileSync(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  };
  const textureOf = (scene) => page.evaluate(`${scene}.player.texture.key`);
  const expectTexture = async (scene, wanted, when) => {
    const key = await textureOf(scene);
    if (!wanted(key)) fail(`${when}: the figure is drawn from ${key}`);
    console.log(`${when}: ${key}`);
  };

  /** The square of screen round the player's own figure, at the window's scale. */
  const aroundPlayer = (scene) =>
    page.evaluate(`(() => { const s = ${scene}; const c = s.cameras.main; const z = c.zoom * (document.querySelector('canvas').getBoundingClientRect().width / s.scale.width);
      const rect = document.querySelector('canvas').getBoundingClientRect();
      const x = (s.player.x + 8 - c.worldView.x) * z + rect.left; const y = (s.player.y + 16 - c.worldView.y) * z + rect.top;
      return { x: Math.round(x - 48), y: Math.round(y - 56), width: 96, height: 112 }; })()`);

  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(sceneIs('base'));
  await until(`${BASE}?.takeStarterForDriver?.('charmander') === true`, 'the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null && ${BASE}.ready && !${BASE}.choosing`, 'a game in the yard');
  await wait(800);

  // -- every pack, in every facing ---------------------------------------------
  for (const look of [null, { head: 'youngster-cap-red', top: 'casual-jacket', legs: 'cargo-trousers', body: null }]) {
    const lookName = look ? 'dressed' : 'classic';
    for (const pack of PACKS) {
      await page.evaluate(`(() => { const b = ${BASE}; const s = b.savedGame.stash;
        for (const id of ${JSON.stringify(PACKS)}) { const n = s.itemCount(id); if (n) s.removeItem(id, n); }
        s.addItem('${pack}', 1);
        b.savedGame.raidProgress = { ...b.savedGame.raidProgress, look: ${JSON.stringify(look)} };
        b.dressPlayer(); })()`);
      await expectTexture(BASE, (key) => key.endsWith(`#${pack}`) && key.includes(look ? 'youngster' : 'classic'), `${lookName}, ${pack}`);
      for (const [facing] of FACINGS) {
        await page.evaluate(`(() => { const b = ${BASE}; b.facing = '${facing}'; b.showIdlePose?.(); b.player.stop(); b.player.setFrame(${{ down: 0, right: 17, up: 34, left: 51 }[facing]}); })()`);
        await step(1);
        await shot(`${lookName}-${pack}-${facing}`, await aroundPlayer(BASE));
      }
    }
  }

  // -- walking: from a real save, in the open ------------------------------------
  const rewrite = async (packs, look) => {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      for (const id of ${JSON.stringify(PACKS)}) delete save.stash.items[id];
      for (const id of ${JSON.stringify(packs)}) save.stash.items[id] = 1;
      if (${JSON.stringify(look)}) save.raidProgress.look = ${JSON.stringify(look)}; else delete save.raidProgress.look;
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.evaluate(`void ${BASE}.scene.restart({ savedGame: ${BASE}.saveManager.load() })`);
    await until(`${BASE}.ready`, 'the yard again');
    await wait(500);
  };
  await rewrite(['hauler-frame'], null);
  await expectTexture(BASE, (key) => key === 'look:classic#hauler-frame', 'walking, the save says');
  // Out and back along one line, so no door is walked into.
  for (const [facing, code] of [FACINGS[1], FACINGS[3], FACINGS[0], FACINGS[2]]) {
    await page.keyDown(code);
    for (let frame = 0; frame < 6; frame += 1) {
      await step(3);
      await shot(`walk-hauler-${facing}-${frame}`, await aroundPlayer(BASE));
    }
    await page.keyUp(code);
    await wait(250);
  }
  if (await page.evaluate(`${BASE}.room !== null && ${BASE}.room !== undefined`)) fail('walked into a door');
  await page.keyDown('ArrowRight');
  await step(6);
  const walkKey = await page.evaluate(`${BASE}.player.anims.currentAnim?.key ?? ''`);
  if (!walkKey.includes('#hauler-frame')) fail(`the walk is ${walkKey}`);
  await page.keyUp('ArrowRight');
  await wait(250);
  await shot('harbour-hauler');

  // -- empty-handed -------------------------------------------------------------
  await page.evaluate(`(() => { const b = ${BASE}; const s = b.savedGame.stash; for (const id of ${JSON.stringify(PACKS)}) { const n = s.itemCount(id); if (n) s.removeItem(id, n); } b.dressPlayer(); })()`);
  await expectTexture(BASE, (key) => key === 'character', 'empty-handed');
  await step(2);
  await shot('empty-handed', await aroundPlayer(BASE));

  // -- at the rack: back to a real save, all four in the vault --------------------
  await rewrite(PACKS, null);
  await expectTexture(BASE, (key) => key.endsWith('#hauler-frame'), 'best pack in the vault');
  const waitOpt = { press: (code) => press(code), until, wait: (ms) => wait(ms), step };
  await walkIntoBase(page, 'raid-arena', waitOpt);
  await until(`${BASE}.arenaPanel !== null || ${sceneIs('hub')}`, 'a panel');
  await shot('hall-bench');
  await page.keyDown('Escape'); await step(1); await page.keyUp('Escape'); await wait(300);
  await openHallPanel(page, 'rack', waitOpt);
  await until(`Boolean(document.querySelector('[data-pack="ranger-pack"]'))`, 'the rack');
  await page.evaluate(`document.querySelector('[data-pack="ranger-pack"]').click()`);
  await step(2);
  await expectTexture(BASE, (key) => key.endsWith('#ranger-pack'), 'chosen at the rack');
  await shot('hall-rack-ranger');
  await page.keyDown('Escape'); await step(1); await page.keyUp('Escape'); await wait(300);
  await expectTexture(BASE, (key) => key.endsWith('#ranger-pack'), 'back from the rack');
  await shot('hall-floor');

  // -- over the rail and into a raid ---------------------------------------------
  await jumpIn(page, { ...waitOpt, until: async (expression, what) => {
    // The dive is photographed on the way past.
    for (let tries = 0; tries < 900; tries += 1) {
      if (await page.evaluate(expression)) return;
      await step(4);
      if (tries === 40 || tries === 70) await shot(`dive-${tries}`);
    }
    fail(`never saw ${what}`);
  } });
  await until(sceneIs('world'), 'the raid');
  await until(`!${WORLD}.arrival`, 'the landing');
  await expectTexture(WORLD, (key) => key.endsWith('#ranger-pack'), 'in the raid');
  await shot('raid-ranger');
  await page.evaluate(`(() => { const w = ${WORLD}; w.setRiding(true); })()`);
  await step(1);
  await expectTexture(WORLD, (key) => key === 'player-bike#ranger-pack', 'on the Bicycle');
  await shot('raid-bike', await aroundPlayer(WORLD));
  // The raid opens on its briefing: read through it, then ride whichever way is open.
  for (let tries = 0; tries < 12 && (await page.evaluate(`${WORLD}.dialogBox?.visible === true`)); tries += 1) {
    await press('Space');
    await wait(200);
  }
  let pedal = '';
  for (const [, code] of FACINGS) {
    await page.keyDown(code);
    await wait(120);
    pedal = await page.evaluate(`${WORLD}.player.anims.isPlaying ? ${WORLD}.player.anims.currentAnim.key : ''`);
    if (pedal) {
      await shot('raid-bike-moving', await aroundPlayer(WORLD));
    }
    await page.keyUp(code);
    await wait(250);
    if (pedal) break;
  }
  if (!pedal.startsWith('player-bike#ranger-pack-walk-')) fail(`the pedalling is "${pedal}"`);
  console.log(`pedalling: ${pedal}`);
  await page.evaluate(`(() => { const w = ${WORLD}; w.setRiding(false); })()`);
  await step(1);
  await expectTexture(WORLD, (key) => key.endsWith('#ranger-pack') && !key.startsWith('player-bike'), 'off the Bicycle');
  console.log('worn packs: every promise held');
} finally {
  await browser.close();
}
