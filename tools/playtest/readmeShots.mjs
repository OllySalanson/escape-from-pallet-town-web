// Photographs the game for the repository's front page (README.md, docs/readme/).
//
//   node tools/playtest/readmeShots.mjs <url of a test-mode build> <out dir> [--part=raid|base|maker|place] [--window=WxH]
//
//   raid (default)  the title, Oak's Lab, the loadout, drop-in and final check, a
//                   raid in Viridian City (or --insertion=), the frames of a walk,
//                   the pack, the hunter arriving, being caught and the fight
//   base            the harbour with every workshop rung built, and each room in
//                   --rooms=id,.. (default oaks-lab) with the keeper's screen
//   maker           the map maker with the sample map open as a draft, at 1X
//   place           the briefing and the first view of a raid on --insertion=
//
// The default window, 800x512, is the stage at exactly 2x (`src/game/display/stage.ts`):
// GitHub's README column is a little wider than 800 pixels, so a picture is
// shown at its own size, every game pixel a crisp 2x2 square. --window=1600x1024
// is the same view at 4x, shown at half size. `frames/` holds the walk, one PNG
// per 15th of a second; ffmpeg turns it into the animation (docs/readme/README.md).
import { mkdirSync, readFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, deployOptions, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((a) => !a.startsWith('--'));
const flag = (name) => args.includes(`--${name}`);
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
mkdirSync(`${outDir}/frames`, { recursive: true });

const sized = /^(\d+)x(\d+)$/.exec(args.find((a) => a.startsWith('--window='))?.slice(9) ?? '800x512');
const browser = await launchBrowser({ window: { width: Number(sized[1]), height: Number(sized[2]) } });
const main = async () => {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms, frameMs = 100) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / frameMs))}, ${frameMs})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) { if (await page.evaluate(expression)) return; await wait(100); }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => {
    await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`);
    await wait(350);
  };
  const shot = async (name) => { await wait(200); await page.screenshot(`${outDir}/${name}.png`); console.log('shot', name); };
  const world = `${GAME}.scene.getScene('world')`;

  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await wait(1500);
  const part = args.find((a) => a.startsWith('--part='))?.slice(7) ?? 'raid';

  if (part === 'base') {
    // A save that has built every rung, so the harbour and its rooms show
    // what a player's base becomes.
    await press('Space');
    await until(sceneIs('starter'));
    await until(`(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`);
    await click('Confirm Charmander');
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`);
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      save.raidProgress.workshopUpgrades = ${JSON.stringify(['radio-mast', 'beacon', 'secure-locker-1', 'secure-locker-2', 'recovery-bay-1', 'recovery-bay-2', 'quarantine-ward'])};
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: url.href });
    await page.waitFor(sceneIs('title'));
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(sceneIs('base'));
    await wait(1500);
    await shot('base');
    for (const door of args.find((a) => a.startsWith('--rooms='))?.slice(8).split(',') ?? ['oaks-lab']) {
      // Photograph the room on its mat, before the keeper's screen opens.
      let taken = false;
      const roomPress = async (code) => {
        if (code === 'Space' && !taken && (await page.evaluate(`${GAME}.scene.getScene('base').room?.id === ${JSON.stringify(door)}`))) {
          await wait(800);
          await shot(`room-${door}`);
          taken = true;
        }
        await press(code);
      };
      await walkIntoBase(page, door, { press: roomPress, until, wait });
      await shot(`screen-${door}`);
      await press('Escape');
      await wait(800);
    }
    return;
  }

  if (part === 'maker') {
    const file = JSON.parse(readFileSync(new URL('../../src/maps/sample/sample-lane.json', import.meta.url), 'utf8'));
    const draft = { ...file, id: 'cherry-lane', name: 'Cherry Lane', maker: 'You' };
    await page.evaluate(`localStorage.setItem('escape-from-pallet-town.maker.v1', JSON.stringify({ drafts: [{ key: 'readme', file: ${JSON.stringify(draft)}, updatedAt: Date.now() }], current: 'readme' }))`);
    await page.evaluate(`void ${GAME}.scene.getScene('title').scene.start('mapmaker')`);
    await until(sceneIs('mapmaker'));
    await wait(1500);
    // The map at one tile to sixteen pixels, so the drawing is what is looked at.
    await page.evaluate(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '1X')?.click()`);
    await wait(800);
    await shot('maker');
    return;
  }

  if (part === 'place') {
    // Somewhere else to stand: the briefing a contract raid opens on, then the
    // map it opens onto, on whichever insertion is asked for.
    const options = deployOptions(args);
    await deploy(page, url.href, { press, until, wait, click, paused: true, ...options });
    await until(sceneIs('world'));
    await wait(1200);
    await shot('place-briefing');
    for (let i = 0; i < 12 && (await page.evaluate(`${world}.dialogBox.visible`)); i += 1) { await press('Space'); await wait(250); }
    await wait(600);
    await shot('place');
    return;
  }

  await shot('title');

  // deploy() takes the starter, walks into Oak's Lab and drops in; the lobby
  // shots are taken on the way by a second, slower pass below.
  const options = deployOptions(args);
  const hooks = {
    press,
    until,
    wait,
    click: async (text) => {
      if (/start a raid/i.test(text)) await shot('oaks-lab');
      if (/choose drop-in/i.test(text)) await shot('loadout');
      if (/review & deploy/i.test(text)) await shot('drop-in');
      if (/enter the raid/i.test(text)) await shot('final-check');
      await click(text);
    },
  };
  await deploy(page, url.href, { ...hooks, paused: true, ...options, insertion: options.insertion ?? 'viridian-city' });
  await until(sceneIs('world'));
  await wait(600);
  await shot('briefing');
  for (let i = 0; i < 12 && (await page.evaluate(`${world}.dialogBox.visible`)); i += 1) { await press('Space'); await wait(250); }
  await wait(400);
  await shot('raid');

  // The walk: a held key per straight run, one picture per 50ms frame, on
  // ground with no tall grass so nothing interrupts it.
  const path = await page.evaluate(`(() => { const w = ${world};
    const c = w.collisionData, g = w.currentMap.tallGrass, H = c.length, W = c[0].length, s = w.currentTile, id = (x, y) => y * W + x;
    const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y, 0]]; let far = null;
    while (queue.length) { const [x, y, d] = queue.shift(); if (d === 26) { far = [x, y]; break; }
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny }) || g[ny]?.[nx]) continue;
        prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny, d + 1]); } }
    const keys = []; let cur = far; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; keys.unshift(p[2]); cur = [p[0], p[1]]; }
    return keys; })()`);
  console.log('walk', path.join(' '));
  let frame = 0;
  let held = null;
  // Fifteen frames a second keeps the file small; a townsperson keeping a beat
  // can step into the lane after it was planned, and the walk ends there rather
  // than filming the player bumping into them.
  const frameMs = 1000 / 15;
  walk: for (const key of path) {
    if (key !== held) { if (held) await page.keyUp(held); await page.keyDown(key); held = key; }
    const from = await page.evaluate(`${world}.currentTile`);
    for (let guard = 0; ; guard += 1) {
      if (guard === 4 || frame === 60) break walk;
      await wait(frameMs, frameMs);
      await page.screenshot(`${outDir}/frames/${String(frame).padStart(3, '0')}.png`);
      frame += 1;
      const now = await page.evaluate(`${world}.currentTile`);
      if (now.x !== from.x || now.y !== from.y) break;
    }
  }
  if (held) await page.keyUp(held);
  await wait(300);

  // The pack, opened in the raid, holding what a raid this far in might have
  // found: a crate, a roll of linen, a valve, a stone and a bundle of money.
  await page.evaluate(`(() => { const b = ${world}.bag;
    for (const [id, n] of [['parts-crate', 1], ['linen-roll', 1], ['radio-valve', 1], ['super-potion', 1], ['thunder-stone', 1], ['money', 40]]) b.add(id, n); })()`);
  await press('KeyB');
  await wait(600);
  await shot('pack');
  await press('Escape');
  await wait(400);

  // The hunter, brought in beside the player rather than waited for.
  await page.evaluate(`(() => { const w = ${world}; const s = w.runSession;
    s.plan = { ...s.plan, hunter: { ...s.plan.hunter, spawnDelayMs: 0 } }; s.stepsTaken = 99; })()`);
  await until(`${world}.dialogBox.visible`, 'the hunter to arrive');
  await wait(4000);
  await shot('hunter');
  for (let i = 0; i < 6 && (await page.evaluate(`${world}.dialogBox.visible`)); i += 1) { await press('Space'); await wait(250); }
  await page.evaluate(`(() => { const w = ${world}; const t = w.currentTile;
    const beside = [[0,-1,'up'],[1,0,'right'],[-1,0,'left'],[0,1,'down']].find(([dx, dy]) => w.collisionData[t.y + dy]?.[t.x + dx] === false);
    const [dx, dy, facing] = beside; const p = { x: t.x + dx, y: t.y + dy };
    w.hunterState = { ...w.hunterState, position: p, mapId: w.currentMap.id };
    w.placeFigure('rival-hunter', p.x, p.y, 'down');
    w.tryWalkIntoHunter(facing); })()`);
  await until(`${world}.dialogBox.visible`, 'the caught line');
  await wait(3000);
  await shot('caught');
  for (let i = 0; i < 8 && !(await page.evaluate(sceneIs('battle'))); i += 1) { await press('Space'); await wait(400); }
  await until(sceneIs('battle'));
  // The entrance is a wall-clock tween, so it is watched at real speed.
  await page.evaluate(`${GAME}.resumeLoop()`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await shot('battle');
  if (flag('battle-frames')) {
    mkdirSync(`${outDir}/battle`, { recursive: true });
    for (let i = 0; i < 6; i += 1) { await press('Space'); await wait(200); }
    await page.evaluate(`${GAME}.resumeLoop()`);
    for (let i = 0; i < 80; i += 1) {
      await page.screenshot(`${outDir}/battle/${String(i).padStart(3, '0')}.png`);
      if (i % 12 === 11) await page.tap('Space', 40);
    }
    await page.evaluate(`${GAME}.pauseLoop()`);
  }
};
try {
  await main();
} finally {
  await browser.close();
}
