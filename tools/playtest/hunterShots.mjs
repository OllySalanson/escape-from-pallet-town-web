// Photographs what the playtest-5 hunter and loadout changes put on screen, in
// the order a player meets them: the loadout with the stash's medicine packed
// for them, the final check naming who is hunting, each of the five hunters
// arriving on the map in their own words and art, being caught, and the fight
// it leads to (one Pokemon to one).
//
//   nice -n 15 node tools/playtest/hunterShots.mjs <url> <out dir>
//
// The first raid is hunted by Blue because the turn is counted in raids; the
// other four are photographed by handing the same raid each rival's id, which
// is the only field on a rival the raid reads (`src/game/world/hunters.ts`).
// The hunter is brought in early and stood beside the player rather than
// waited and walked for, because what is being judged is the art and the
// words, not the pursuit.
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs, walkIntoBase } from './deploy.mjs';

const [base, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
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
  await press('Space');
  await until(sceneIs('starter'));
  await until(`(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`);
  await click('Confirm Bulbasaur');
  await walkIntoBase(page, 'oaks-lab', { press, until });
  await click('Start a raid');
  await click('Bulbasaur');
  // Point at the Potion row so its help line says why it is packed.
  await page.evaluate(`document.querySelector('button[data-count-kind="item"][data-count-id="potion"][data-count-dir="-1"]')?.focus()`);
  await shot('01-loadout-medicine-packed');
  await click('Choose drop-in');
  await click('Review & deploy');
  await shot('02-final-check-hunter');
  await click('Enter the raid');
  await until(sceneIs('world'));
  await wait(600);
  for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }

  for (const [index, rival] of ['blue', 'misty', 'lt-surge', 'koga', 'sabrina'].entries()) {
    await page.evaluate(`(() => { const w = ${world}; const s = w.runSession;
      s.plan = { ...s.plan, hunter: { ...s.plan.hunter, rivalId: ${JSON.stringify(rival)}, spawnDelayMs: 0 } };
      s.stepsTaken = 99;
      w.npcSprites.get('rival-hunter')?.destroy(); w.npcSprites.delete('rival-hunter');
      w.hunterState = { spawned: false, defeated: false }; })()`);
    await until(`${world}.dialogBox.visible`, `${rival} to arrive`);
    // The box types its line out; let it finish.
    await wait(4000);
    await shot(`${String(index + 3).padStart(2, '0')}-arrival-${rival}`);
    for (let i = 0; i < 6 && (await page.evaluate(`${world}.dialogBox.visible`)); i += 1) { await press('Space'); await wait(250); }
  }

  // Sabrina is on the map now; stand her beside the player and walk into her.
  await page.evaluate(`(() => { const w = ${world}; const t = w.currentTile;
    const beside = [[0,-1,'up'],[1,0,'right'],[-1,0,'left'],[0,1,'down']].find(([dx, dy]) => w.collisionData[t.y + dy]?.[t.x + dx] === false);
    const [dx, dy, facing] = beside; const p = { x: t.x + dx, y: t.y + dy };
    w.hunterState = { ...w.hunterState, position: p, mapId: w.currentMap.id };
    w.placeFigure('rival-hunter', p.x, p.y, 'down');
    w.tryWalkIntoHunter(facing); })()`);
  await until(`${world}.dialogBox.visible`, 'the caught line');
  await wait(3000);
  await shot('08-caught-sabrina');
  for (let i = 0; i < 8 && !(await page.evaluate(sceneIs('battle'))); i += 1) { await press('Space'); await wait(400); }
  await until(sceneIs('battle'));
  // The entrance is a wall-clock tween, so it is watched at real speed.
  await page.evaluate(`${GAME}.resumeLoop()`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await shot('09-battle-one-to-one');
  console.log('hunter party:', await page.evaluate(`${GAME}.scene.getScene('battle').state.trainer?.party.map((p) => p.base.name + ' ' + p.level).join(', ')`));
} finally {
  await browser.close();
}
