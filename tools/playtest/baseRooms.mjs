// Walks into every room in the base and photographs it, and plays the three
// promises a room makes: the keeper's screen is one key from the mat, backing
// out of that screen puts you back in the room, and down off the mat is the
// way out (`src/game/base/rooms.ts`).
//
//   node tools/playtest/baseRooms.mjs <url> <out dir> [--built=all|none|id,..] [--hurt=N] [--window=1200x768]
//
// `--built` seeds Brock's ladder and `--hurt` puts that many Pokemon in the
// Center's care, so one run photographs the rooms bare and another full. It
// fails loudly - a thrown error, not a picture - when any promise is broken.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const builtOption = option('built') ?? 'all';
const hurt = Number(option('hurt') ?? '4');
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
const RUNGS = ['radio-mast', 'beacon', 'secure-locker-1', 'secure-locker-2', 'recovery-bay-1', 'recovery-bay-2', 'quarantine-ward'];
const built = builtOption === 'all' ? RUNGS : builtOption === 'none' ? [] : builtOption.split(',');
const ROOMS = ['oaks-lab', 'pokemon-centre', 'brocks-workshop', 'bills-cottage'];
mkdirSync(out, { recursive: true });

const state = () =>
  `(() => { const b = ${GAME}.scene.getScene('base'); const live = b && b.sys.isActive();
    return { base: !!live, hub: ${sceneIs('hub')}, room: live && b.room ? b.room.id : null,
      tile: live ? b.currentTile : null, hint: live ? b.hintShown : null }; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.workshopUpgrades = ${JSON.stringify(built)};
    const seed = save.stash.pokemon[0];
    const extra = Array.from({ length: ${Math.max(1, hurt)} }, (_, i) => ({ id: 'rest-' + i, pokemon: { ...seed.pokemon, speciesId: 'pidgey', moves: ['Tackle'], currentHp: i < ${hurt} ? 1 : 999 } }));
    save.stash.pokemon = [seed, ...extra];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: save.stash.pokemon.map((p) => p.id) }];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await sleep(600);
  await page.screenshot(`${out}/yard.png`);
  console.log(`yard: ${out}/yard.png`);

  for (const id of ROOMS) {
    // Walk to the door and through it, stopping on the mat inside.
    const door = await page.evaluate(
      `${GAME}.scene.getScene('base').doors.find((d) => d.id === ${JSON.stringify(id)}).tiles`,
    );
    for (let guard = 0; guard < 80; guard += 1) {
      const now = await page.evaluate(state());
      if (now.room === id) break;
      const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || b.leaving || b.room) return null;
        const goals = ${JSON.stringify(door)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
        while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || (!at(nx, ny) && b.isBlocked({ x: nx, y: ny }))) continue;
            prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
        let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`);
      if (key) await press(key);
      else await sleep(150);
    }
    await sleep(500);
    const inside = await page.evaluate(state());
    if (inside.room !== id) throw new Error(`walking through the ${id} door did not put the player in the room`);
    if (!inside.hint.includes('[SPACE]') || !inside.hint.includes('[DOWN]')) {
      throw new Error(`the ${id} mat says "${inside.hint}", not both keys`);
    }
    await page.screenshot(`${out}/${id}.png`);
    console.log(`${id}: ${out}/${id}.png  (hint: ${inside.hint})`);

    // One key from the mat is the keeper's screen.
    await press('Space');
    await page.waitFor(sceneIs('hub'), { what: `the ${id} screen from the mat` });
    await sleep(400);
    await page.screenshot(`${out}/${id}-screen.png`);
    // Backing out of it is back in the room, on the mat.
    await page.evaluate(`document.querySelector('[data-back]').click()`);
    await page.waitFor(`${GAME}.scene.getScene('base').sys.isActive() && ${GAME}.scene.getScene('base').room?.id === ${JSON.stringify(id)}`, {
      what: `back in the ${id} room`,
    });
    await sleep(400);
    // And down off the mat is the yard, on the step outside.
    await press('ArrowDown');
    await page.waitFor(`${GAME}.scene.getScene('base').sys.isActive() && !${GAME}.scene.getScene('base').room && ${GAME}.scene.getScene('base').ready`, {
      what: `out of the ${id} into the yard`,
    });
    await sleep(300);
    const outside = await page.evaluate(state());
    console.log(`${id}: in, screen, back, out - standing at ${outside.tile.x},${outside.tile.y}`);
  }

  // And the one-call route every other driver uses still reaches every screen.
  for (const id of ROOMS) {
    await walkIntoBase(page, id);
    await page.evaluate(`document.querySelector('[data-back]').click()`);
    await page.waitFor(sceneIs('base'));
    await sleep(400);
  }
  console.log('walkIntoBase reaches all four screens');
} finally {
  await browser.close();
}
