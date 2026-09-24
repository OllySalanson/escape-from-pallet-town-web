// Walks in and out of a roofed place in the real game and reports what a player
// would see happen (`src/game/world/interiors.ts`).
//
//   nice -n 15 node tools/playtest/interior.mjs <dev server url> [out dir] [--interior=id]
//
// Three things about an interior cannot be checked anywhere else, because all
// three are the scene rather than the map:
//
//  - the **lid** comes off when the player steps in and back on when they step
//    out, which is a tile layer's alpha and nothing a unit test can see;
//  - the hunter **loses the trail** - it keeps walking to the tile it last saw
//    the player on rather than to the player - and the chip says so;
//  - the floor **rolls for wildlife** on every step, which is the only ground in
//    the game that is not tall grass and still costs fights.
//
// It also walks the fourth thing, which is the rule the whole shape of an
// interior exists for: the hunter is stood in one of the two mouths and the
// player still gets out of the other. A room with one door would fail here.
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((a) => !a.startsWith('--'));
const wanted = (args.find((a) => a.startsWith('--interior=')) ?? '').split('=')[1] ?? 'pallet-delve';
const url = new URL(base);
url.searchParams.set('testmode', outDir ? 'pixels' : '1');

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  await deploy(page, url.href, { press, click, until, wait, paused: true, ...deployOptions(args) });
  await wait(600);
  for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }

  const interior = await page.evaluate(
    `(() => { const w = ${GAME}.scene.getScene('world');
       const it = w.currentMap.interiors.find((i) => i.id === ${JSON.stringify(wanted)});
       if (!it) throw new Error('no interior ' + ${JSON.stringify(wanted)} + ' on ' + w.currentMap.id);
       return { id: it.id, label: it.label, roof: it.roof, mouths: it.mouths }; })()`,
  );
  console.log(`${interior.label} on this map, ${interior.mouths.length} mouths`);

  const stand = async (tile) => {
    await page.evaluate(
      `(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16;
         w.currentTile = { x: ${tile.x}, y: ${tile.y} }; w.setPlayerPosition(${tile.x} * 16, ${tile.y} * 16 + off);
         w.noteInterior(); })()`,
    );
    // The lid is a tween, and Phaser advances a tween on the *real* clock
    // rather than on the game time a stepped frame hands it - a stepped frame
    // is worth a few milliseconds to one - so a check on the lid has to step
    // enough frames for a quarter of a second to have gone by. It is the same
    // thing AGENTS.md records about the battle screen's HP bars.
    await wait(6000);
  };
  // The lid is one layer per map, so its alpha is the answer for whichever
  // interior the player is in.
  const lid = () =>
    page.evaluate(
      `(() => { const w = ${GAME}.scene.getScene('world');
         const layers = [...w.roofLayers.values()][0] ?? []; return layers.map((l) => Math.round(l.alpha * 100)); })()`,
    );

  const outside = { x: interior.mouths[0].x - 1, y: interior.mouths[0].y };
  await stand(outside);
  console.log('standing outside at', outside, 'lid alpha', await lid());
  if (outDir) await page.screenshot(`${outDir}/interior-outside.png`);

  await stand(interior.mouths[0]);
  console.log('standing in the mouth  lid alpha', await lid());
  const middle = await page.evaluate(
    `(() => { const w = ${GAME}.scene.getScene('world'); const r = ${JSON.stringify(interior.roof)};
       for (let y = r.y; y < r.y + r.height; y += 1) for (let x = r.x; x < r.x + r.width; x += 1)
         if (!w.collisionData[y][x] && (x !== ${interior.mouths[0].x} || y !== ${interior.mouths[0].y})) return { x, y };
       throw new Error('no floor'); })()`,
  );
  await stand(middle);
  console.log('standing inside at', middle, 'lid alpha', await lid());
  if (outDir) await page.screenshot(`${outDir}/interior-inside.png`);

  // The hunter outside, on the tile it last saw the player standing on. This is
  // the whole point of a roof: it is hunting a sighting that is no longer true.
  const hunterAt = async (tile) => {
    await page.evaluate(
      `(() => { const w = ${GAME}.scene.getScene('world');
         w.hunterState = { spawned: true, defeated: false, mapId: w.currentMap.id,
           position: ${JSON.stringify(tile)}, lastSeen: ${JSON.stringify(outside)} }; })()`,
    );
    await wait(300);
  };
  await hunterAt(outside);
  console.log('hunter outside - hidden from it:', await page.evaluate(`${GAME}.scene.getScene('world').playerIsHidden()`));
  console.log(
    'and it is walking to      :',
    await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').hunterState.lastSeen)`),
    '(the player is at',
    await page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').currentTile)`) + ')',
  );

  // And the same hunter standing in the mouth the player came in by. It can see
  // them now - a cave you are both in is not a hiding place - and the rule the
  // whole shape of an interior exists for is that there is still a way out.
  await hunterAt(interior.mouths[0]);
  console.log('hunter in the mouth - hidden from it:', await page.evaluate(`${GAME}.scene.getScene('world').playerIsHidden()`));
  const out = await page.evaluate(
    `(() => { const w = ${GAME}.scene.getScene('world'); const blocked = ${JSON.stringify(interior.mouths[0])};
       const seen = new Set([w.currentTile.y * 1000 + w.currentTile.x]); let frontier = [w.currentTile]; let steps = 0;
       const mouths = ${JSON.stringify(interior.mouths.slice(1))};
       while (frontier.length) { steps += 1; const next = [];
         for (const t of frontier) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
           const n = { x: t.x + dx, y: t.y + dy }; const k = n.y * 1000 + n.x;
           if (w.collisionData[n.y]?.[n.x] !== false || seen.has(k)) continue;
           if (n.x === blocked.x && n.y === blocked.y) continue;
           if (mouths.some((m) => m.x === n.x && m.y === n.y)) return steps;
           seen.add(k); next.push(n); }
         frontier = next; }
       return -1; })()`,
  );
  console.log('with the hunter in that mouth, the other one is', out, 'steps away');

  await stand(outside);
  console.log('back outside     lid alpha', await lid());
  console.log(
    'the floor rolls for wildlife:',
    await page.evaluate(
      `(() => { const w = ${GAME}.scene.getScene('world');
         return JSON.stringify(w.encountersAtCurrentTile() !== undefined); })()`,
    ),
  );
} finally {
  await browser.close();
}
