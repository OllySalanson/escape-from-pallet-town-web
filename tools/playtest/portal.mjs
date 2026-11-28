// THE RAID ARENA's portal - the pit with the map at its bottom - played as a
// player meets it: walked up to, looked down into, a landing chosen, and gone
// over. It films each stage on a stepped loop, so the frames are the same every
// run and the machine pays only for the frames asked for.
//
//   node tools/playtest/portal.mjs <test-mode build url> <out dir> [--fresh] [--window=1280x800 | --device=landscape]
//     [--tz=Asia/Tokyo] [--eval=<expression>] [--port=N]
//
// --tz sees the pit at another clock's hour (it keeps the player's own), and
// --eval prints an expression once the portal is up and stops there.
//
// Without --fresh the save is a returning player's: two Pokémon, six ways in
// walked to, jobs banked. With --fresh it is a new save's first raid, which goes
// over at the rail without the card (`hub/firstRaid.ts`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';
import { DEVICES, emulateDevice } from './phone.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const device = option('device') ? DEVICES[option('device')] : undefined;
const [width, height] = device ? [device.width, device.height] : (option('window') ?? '1280x800').split('x').map(Number);
const fresh = args.includes('--fresh');
const only = option('only');
mkdirSync(out, { recursive: true });

const LANDINGS = [
  'greystone-vale',
  'greystone-vale-moor-top',
  'greystone-vale-the-quarry',
  'greystone-vale-stepping-stones',
  'greystone-vale-farmhouse',
  'greystone-vale-the-dam',
];
const FRAME_MS = 1000 / 30;

// `--port` drives a browser already running on that CDP port, which keeps the last driver's save: it starts from none.
const browser = option('port') ? attachBrowser(Number(option('port')), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage('about:blank');
  if (device) await emulateDevice(page, device);
  // Another clock's hour, to see the pit by day or by night: the pit keeps the player's own clock.
  if (option('tz')) await page.send('Emulation.setTimezoneOverride', { timezoneId: option('tz') });
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  const until = (expression, what, timeoutMs = 60_000) => page.waitFor(expression, { what, timeoutMs });
  if (option('port')) {
    await until(`Boolean(${GAME}?.scene)`, 'the game');
    await page.evaluate('localStorage.clear()');
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  }
  const live = async (code) => { await page.tap(code); await sleep(250); };
  const step = (frames) => page.evaluate(`${GAME}.stepFrames(${frames}, ${FRAME_MS})`);
  // A press on the stepped loop: down for a frame, up for a frame.
  const press = async (code) => { await page.keyDown(code); await step(1); await page.keyUp(code); await step(1); };
  // Waiting on the stepped loop: nothing moves unless it is stepped.
  const stepUntil = async (expression, what, press = null) => {
    for (let guard = 0; guard < 300; guard += 1) {
      if (await page.evaluate(expression)) return;
      if (press && guard % 10 === 9) { await page.keyDown(press); await step(1); await page.keyUp(press); }
      await step(3);
    }
    throw new Error(`never reached ${what}`);
  };
  const shot = async (name) => { await page.screenshot(`${out}/${name}.png`); console.log(name); };
  // Films `ms` of game time, a picture every `every` ms.
  const film = async (name, ms, every = 200) => {
    for (let t = 0, n = 0; t < ms; t += every, n += 1) {
      await step(Math.round(every / FRAME_MS));
      await shot(`${name}-${String(n).padStart(2, '0')}`);
    }
  };

  await until(sceneIs('title'), 'the title');
  await live('Space');
  await until(sceneIs('base'), 'the harbour');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("squirtle") === true`, 'Squirtle off the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  if (!fresh) {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
      p.firstContractExtracted = true;
      p.arenaIntroSeen = true;
      p.reachedInsertions = [...new Set([...(p.reachedInsertions ?? []), ...${JSON.stringify(LANDINGS)}])];
      p.standingContractsBanked = 3;
      for (const stored of save.stash.pokemon) { stored.pokemon.level = 8; stored.pokemon.currentHp = 9999; }
      save.stash.pokemon.push({ id: 'portal-pikachu', pokemon: { speciesId: 'pikachu', level: 9, currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } });
      if (Array.isArray(save.stash.boxes) && save.stash.boxes[0]) save.stash.boxes[0].pokemonIds.push('portal-pikachu');
      Object.assign(save.stash.items, { 'poke-ball': 3, potion: 4 });
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
    await until(sceneIs('title'), 'the title again');
    await live('Space');
    await until(sceneIs('base'), 'the harbour again');
  }
  await walkIntoBase(page, 'raid-arena');
  if (!fresh) {
    await until(takePokemon('Pikachu'), 'Pikachu on the bench');
  }
  await live('Escape');
  await until(`!${sceneIs('hub')}`, 'the bench closed');
  await sleep(500);
  await page.evaluate(`${GAME}.pauseLoop()`);
  await step(10);
  await shot('1-in-the-hall');

  // Up to the rail by the shortest walk, one stepped press a tile.
  const toRail = `(() => { const b = ${GAME}.scene.getScene('base'); if (b.targetTile) return { wait: true };
    const goals = b.arenaRim; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
    const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
    if (at(s.x, s.y)) return { there: true };
    const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
    while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
        prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
    let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
    return { key }; })()`;
  let walked = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const move = await page.evaluate(toRail);
    if (move.there) break;
    if (move.key) {
      await page.keyDown(move.key);
      await step(3);
      await page.keyUp(move.key);
      walked += 1;
      if (walked % 4 === 0 && only !== 'card') await shot(`2-walking-${String(walked).padStart(2, '0')}`);
    } else {
      await step(2);
    }
  }
  await step(30);
  await shot('3-at-the-rail');

  await press('Space');
  if (fresh) {
    // The first raid asks in the box before it goes over.
    await film('4-asked', 1200, 400);
    await press('Space');
  }
  await film('5-drawing-back', 640, 80);
  await film('5-looking-down', 1000, 250);
  if (option('eval')) {
    console.log(await page.evaluate(option('eval')));
    process.exit(0);
  }
  if (!fresh && (await page.evaluate(sceneIs('hub')))) {
    // ESC is back to the rail, and SPACE looks down again.
    await press('Escape');
    await film('5b-back-to-the-rail', 320, 80);
    await step(10);
    await press('Space');
    await film('5c-looking-down-again', 800, 400);
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp']) await press(key);
    await step(5);
    await shot('6-land-row');
    await press('ArrowRight');
    await film('7-next-landing', 400, 50);
    await film('7-next-landing-rest', 600, 300);
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) await press(key);
    await step(5);
    await shot('8-on-jump-in');
    await press('Space');
  }
  await film('9-jump', 9000, 300);
  await until(`${sceneIs('world')} || ${sceneIs('base')}`, 'the raid or the hall');
  await film('10-landing', 4000, 400);
  if (await page.evaluate(sceneIs('world'))) {
    // Home again, having walked some new ground: the cloud lifts off it in the portal.
    for (let guard = 0; guard < 4 && (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`)); guard += 1) {
      await press('Space');
      await step(12);
    }
    await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const s = w.currentTile;
      for (let n = 0; n < 160; n += 1) { w.currentTile = { x: s.x + n, y: s.y + (n >> 1) }; w.surveyGround(); w.currentTile = { x: s.x - n, y: s.y + n }; w.surveyGround(); }
      w.currentTile = s;
      const way = w.runSession.plan.extractionPoints[0]; w.extractThrough(way); })()`);
    await stepUntil(sceneIs('extraction'), 'the result screen');
    await step(45);
    await stepUntil(sceneIs('base'), 'home', 'Enter');
    await film('11-home', 4400, 200);
  }
} finally {
  await browser.close();
}
