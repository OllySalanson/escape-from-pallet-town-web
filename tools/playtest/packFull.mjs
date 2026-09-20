// A raid played with the pack filled to its last square, to the refusals that
// fullness causes: the catch a battle cannot make room for (the captain's own
// report of 2026-09-20), the ground loot that will not go in, and the gift the
// giver keeps hold of.
//
//   node tools/playtest/packFull.mjs http://localhost:5173/ <out dir>
//        [--stepped] [--pixels] [--window=pixel] [--drop] [--keep]
//        [--loot] [--gift]
//
// Nothing else can reach these: the pack is only full when the *loadout* filled
// it, which needs a vault with the supplies to fill it from (deploy.mjs's
// --stash), and a wild fight to be standing in.
import { mkdirSync } from 'node:fs';
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const [base, outDir = 'docs/screens/pack-full'] = args.filter((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: packFull.mjs <dev server url> <out dir> [--drop|--keep] [--loot] [--gift]');
}
const stepped = flag('stepped');
const pixels = flag('pixels') || option('window') === 'pixel';
const url = new URL(base);
// --plain is the one real-speed pass on a plain URL, which every check owes
// before it is believed (tools/playtest/README.md).
if (!flag('plain')) url.searchParams.set('testmode', pixels ? 'pixels' : '1');
mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser({ window: pixels ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const frames = (ms) => Math.max(1, Math.ceil(ms / 100));
  const wait = stepped ? (ms) => page.evaluate(`${GAME}.stepFrames(${frames(ms)})`) : sleep;
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, holdMs = 60) => {
    await page.keyDown(code);
    if (holdMs > 0) await wait(holdMs);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  // Named by the stage it was taken at, as every other screen shot here is.
  const stage = pixels ? PIXEL_WINDOW : LOGIC_WINDOW;
  const shot = async (name) => {
    await wait(200);
    const path = `${outDir}/${name}-${stage.width}x${stage.height}.png`;
    await page.screenshot(path);
    console.log(path);
  };

  // Seventeen Potions and a Poke Ball is eighteen squares: the pack is full
  // before the raid starts, which is the state every refusal below needs.
  await deploy(page, url.href, {
    press,
    click,
    until,
    paused: stepped,
    insertion: option('insertion') ?? 'viridian-forest',
    starter: option('starter') ?? 'Charmander',
    level: option('level') ?? '12',
    stash: ['potion:30', 'poke-ball:10'],
    pack: [`potion:${option('potions') ?? '17'}`, `poke-ball:${option('balls') ?? '1'}`],
  });
  await until(sceneIs('world'), 'the world');
  await wait(600);
  console.log(
    'pack:',
    await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').bag.toJSON())`),
  );

  /** Picks a row of the battle panel by the words on it. */
  const choose = async (match) => {
    await until(
      `(() => { const b = ${GAME}.scene.getScene('battle'); const i = b.commandTexts.findIndex((t) => t.text.includes(${JSON.stringify(match)})); if (i < 0) return false; b.commandTexts[i].emit('pointerdown'); return true; })()`,
      `the row "${match}"`,
    );
    await wait(250);
  };

  /** One key towards a tile over the live collision, the way raid.mjs walks. */
  const nextKey = (goal) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
    const c = w.collisionData, H = c.length, W = c[0].length, s = w.currentTile, id = (x, y) => y * W + x;
    if (s.x === ${goal.x} && s.y === ${goal.y}) return { arrived: true };
    const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
    while (queue.length) { const [x, y] = queue.shift(); if (x === ${goal.x} && y === ${goal.y}) break;
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny })) continue;
        prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
    let cur = [${goal.x}, ${goal.y}], key = null; if (!prev.has(id(cur[0], cur[1]))) return { unreachable: true };
    for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return { key }; })()`);

  /** Walks to a tile, reading away anything the walk raises. */
  const walkTo = async (goal, guardSteps = 240) => {
    for (let guard = 0; guard < guardSteps; guard += 1) {
      // Arrival is asked first, so a line the last step raised is still on
      // screen when the walk stops - it is the thing being photographed.
      if (await page.evaluate(sceneIs('world'))) {
        const here = await nextKey(goal);
        if (here.arrived) return true;
        if (here.unreachable) return false;
      }
      if (await page.evaluate(sceneIs('battle'))) {
        for (let read = 0; read < 30; read += 1) {
          if (await page.evaluate(sceneIs('world'))) break;
          const mode = await page.evaluate(`${GAME}.scene.getScene('battle')?.mode`);
          if (mode === 'main') {
            // A trainer fight cannot be left - the checkpoint on the way to
            // the reeds is one - so the driver fights whatever will not let go.
            const commands = await page.evaluate(
              `JSON.stringify(${GAME}.scene.getScene('battle').commandTexts.map((t) => t.text))`,
            );
            await choose(String(commands).includes('RUN') ? 'RUN' : 'FIGHT');
          } else if (mode === 'moves') await choose('\u25b6');
          else await press('Space');
          await wait(250);
        }
        continue;
      }
      if (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`)) {
        await press('Space');
        await wait(200);
        continue;
      }
      const step = await nextKey(goal);
      if (step.arrived) return true;
      if (step.unreachable || !step.key) return false;
      await press(step.key, 180);
      await wait(60);
    }
    return false;
  };

  if (flag('loot') || flag('gift')) {
    for (let guard = 0; guard < 6; guard += 1) {
      if (!(await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`))) break;
      await press('Space');
      await wait(200);
    }
    const goal = flag('gift')
      ? { x: 19, y: 24 }
      : await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world');
          const here = w.runSession.plan.loot[w.currentMap.id] ?? []; const s = w.currentTile;
          const near = [...here].sort((a, b) => (Math.abs(a.position.x - s.x) + Math.abs(a.position.y - s.y)) - (Math.abs(b.position.x - s.x) + Math.abs(b.position.y - s.y)))[0];
          return near ? near.position : null; })()`);
    if (!goal) throw new Error('nothing to walk to');
    console.log('walking to', JSON.stringify(goal));
    console.log('arrived:', await walkTo(goal), await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').currentTile)`));
    if (flag('gift')) {
      // A figure is collision, so walking into her turns the player in place;
      // then the interact key is what asks.
      await press('ArrowUp', 180);
      await wait(200);
      await press('Space');
      await wait(500);
      // Read her offer to its last line, which is the refusal.
      for (let guard = 0; guard < 24; guard += 1) {
        const open = await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`);
        const text = await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.textObject.text`);
        if (!open || String(text).includes('room in the pack')) break;
        await press('Space');
        await wait(400);
      }
    }
    // Let the line finish typing rather than photographing it half written.
    for (let guard = 0; guard < 30; guard += 1) {
      if (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.isCurrentMessageComplete`)) break;
      await wait(200);
    }
    await shot(flag('gift') ? 'gift-refused' : 'loot-refused');
    console.log('pack:', await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').bag.toJSON())`));
    await browser.close();
    process.exit(0);
  }

  // Read the briefing away, then walk in the tall grass until something comes
  // out of it: the only honest way to be standing in a wild fight.
  for (let guard = 0; guard < 6; guard += 1) {
    if (!(await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`))) break;
    await press('Space');
    await wait(200);
  }
  const KEYS = ['ArrowLeft', 'ArrowRight'];
  for (let guard = 0; guard < 400 && !(await page.evaluate(sceneIs('battle'))); guard += 1) {
    await press(KEYS[guard % KEYS.length], 180);
    await wait(120);
  }
  await until(sceneIs('battle'), 'a wild battle');
  // The opening lines are read the way a player reads them.
  for (let guard = 0; guard < 20; guard += 1) {
    if ((await page.evaluate(`${GAME}.scene.getScene('battle').mode`)) === 'main') break;
    await press('Space');
    await wait(250);
  }
  await until(
    `${GAME}.scene.getScene('battle').mode === 'main'`,
    'the battle command menu',
  );
  const enemy = await page.evaluate(
    `${GAME}.scene.getScene('battle').state.enemy.pokemon.base.name`,
  );
  console.log(`wild ${enemy}`);
  await shot('1-battle');

  await choose('BALL x');
  await wait(300);
  console.log('refusal:', await page.evaluate(`${GAME}.scene.getScene('battle').dialog.visibleText`));

  // One press finishes the line, the next advances past it.
  for (let guard = 0; guard < 8; guard += 1) {
    if ((await page.evaluate(`${GAME}.scene.getScene('battle').mode`)) === 'make-room') break;
    await press('Space');
    await wait(300);
    if (guard === 0) await shot('2-refusal');
  }
  await until(`${GAME}.scene.getScene('battle').mode === 'make-room'`, 'the make-room panel');
  console.log(
    'panel:',
    await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('battle').commandTexts.map((t) => t.text))`),
  );
  await shot('3-make-room');

  if (flag('keep')) {
    // The panel is walked with the arrow keys as well as pointed at: the
    // prompt answers whichever row the cursor is on, so the page is redrawn.
    await press('ArrowRight');
    await wait(250);
    console.log(
      'cursor right:',
      await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('battle').commandTexts.map((t) => t.text))`),
    );
    await press('Escape');
    await wait(300);
    console.log('escape leaves:', await page.evaluate(`${GAME}.scene.getScene('battle').mode`));
    await choose('BALL x');
    for (let guard = 0; guard < 8; guard += 1) {
      if ((await page.evaluate(`${GAME}.scene.getScene('battle').mode`)) === 'make-room') break;
      await press('Space');
      await wait(300);
    }
    await choose('KEEP THE PACK');
    await until(`${GAME}.scene.getScene('battle').mode === 'main'`, 'the commands back');
    console.log(
      'kept:',
      await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('battle').bag.toJSON())`),
    );
    await shot('4-kept');
  } else {
    for (let guard = 0; guard < 8; guard += 1) {
      const mode = await page.evaluate(`${GAME}.scene.getScene('battle').mode`);
      if (mode !== 'make-room') break;
      await choose('POTION x');
      await wait(250);
    }
    await wait(400);
    // The catch is a roll like any other, so the driver throws until it lands
    // or the balls run out - which is the fight the report came from.
    for (let guard = 0; guard < 8; guard += 1) {
      const outcome = await page.evaluate(`${GAME}.scene.getScene('battle')?.state.outcome`);
      if (outcome !== 'active') break;
      for (let read = 0; read < 6; read += 1) {
        if ((await page.evaluate(`${GAME}.scene.getScene('battle').mode`)) === 'main') break;
        await press('Space');
        await wait(250);
      }
      if ((await page.evaluate(`${GAME}.scene.getScene('battle').bag.count('poke-ball')`)) === 0) break;
      await choose('BALL x');
      await wait(400);
    }
    console.log(
      'after dropping:',
      await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('battle').bag.toJSON())`),
      await page.evaluate(`${GAME}.scene.getScene('battle').state.outcome`),
    );
    await shot('4-thrown');
    for (let guard = 0; guard < 12; guard += 1) {
      await press('Space');
      await wait(250);
      if (await page.evaluate(sceneIs('world'))) break;
    }
    console.log(
      'carried home:',
      await page.evaluate(
        `JSON.stringify((${GAME}.scene.getScene('world').runSession?.manager.snapshot().caughtPokemon ?? []).map((p) => p.base.name))`,
      ),
    );
    await shot('5-caught');
  }
} finally {
  await browser.close();
}
