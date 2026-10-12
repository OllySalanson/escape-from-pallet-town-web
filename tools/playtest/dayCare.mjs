// Leaves a Pokémon at the DAY-CARE and fetches it back grown - the way a player
// does it: walk up the lawn past THE BOLTHOLE to the man at his pen, speak to
// him, choose who to leave, watch it in the pen, go on raids without it, and
// speak to him again (`src/game/hub/dayCare.ts`, `src/game/base/dayCarePen.ts`).
//
//   node tools/playtest/dayCare.mjs <url> <out dir> [--raids=2] [--port=N] [--window=1200x768]
//
// A new game is started and a level-4 Pidgey put in its vault beside the
// starter, and a fainted Rattata he must refuse. `--raids` is how many raids are written into the save as having
// gone out and come home while the Pidgey was away. --port=N drives a browser
// already running on that CDP port. Photographs the man's screen both ways,
// the pen with the Pidgey in it, and what he says; fails loudly when a promise
// is broken.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const raids = Number(option('raids') ?? 2);
const port = option('port');
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

const BASE = `${GAME}.scene.getScene('base')`;
const state = () =>
  `(() => { const b = ${BASE}; const live = b && b.sys.isActive() && b.ready && !b.leaving;
    return { live: !!live, room: live && b.room ? b.room.id : null, tile: live ? b.currentTile : null,
      facing: live ? b.facing : null, hint: live ? b.hintShown : null,
      pen: live && b.penPokemon ? { species: b.penPokemon.species, tile: b.penPokemon.tile } : null }; })()`;

/** The first step of the shortest walk to any of `goals`, over the scene's own collision. */
const firstStep = (goals) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const goals = ${JSON.stringify(goals)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
  if (at(s.x, s.y)) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || (!at(nx, ny) && b.isBlocked({ x: nx, y: ny }))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

const browser = port ? attachBrowser(Number(port), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
const page = await browser.openPage(`${url}?testmode=pixels`);
try {
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  const walkTo = async (goals) => {
    for (let guard = 0; guard < 160; guard += 1) {
      const key = await page.evaluate(firstStep(goals));
      if (key === 'here') return;
      if (key === 'unreachable') throw new Error(`nothing reaches ${JSON.stringify(goals)}`);
      if (key) await press(key);
      else await sleep(150);
    }
    throw new Error(`gave up walking to ${JSON.stringify(goals)}`);
  };
  const click = async (selector, what = selector) => {
    await page.waitFor(
      `(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b || b.disabled) return false; b.click(); return true; })()`,
      { what },
    );
    await sleep(400);
  };
  const text = (selector) =>
    page.evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  const editSave = async (edit) => {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${edit})(save);
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
    await page.waitFor(sceneIs('title'));
    await press('Space');
    await page.waitFor(sceneIs('base'));
    await page.waitFor(`${state()}.live`, { what: 'the yard' });
    await sleep(400);
  };
  /** Up the lawn to the man, facing him, and the interact key: his screen. */
  const speakToHim = async () => {
    const man = await page.evaluate(`${BASE}.figures.has('day-care-man')`);
    if (!man) throw new Error('nobody is standing at the Day-Care');
    await walkTo([{ x: 33, y: 11 }]);
    await press('ArrowRight');
    const facing = await page.evaluate(state());
    if (facing.hint !== '[SPACE] DAY-CARE MAN') throw new Error(`facing him, the hint says "${facing.hint}"`);
    await press('Space');
    await page.waitFor(sceneIs('hub'), { what: 'his screen' });
    await sleep(600);
  };

  // A new game, whatever a browser driven before left in its storage.
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  // A level-4 Pidgey beside the starter, so there is somebody to leave.
  await editSave(`(save) => {
    save.stash.pokemon.push({ id: 'pidgey-1', pokemon: { speciesId: 'pidgey', level: 4, currentHp: 17, xp: 96, moves: ['Tackle'], primaryStatus: null } });
    save.stash.pokemon.push({ id: 'rattata-1', pokemon: { speciesId: 'rattata', level: 3, currentHp: 0, xp: 27, moves: ['Tackle'], primaryStatus: null } });
    save.raidProgress.keysLearned = ['walk', 'look'];
  }`);

  await speakToHim();
  await sleep(1500);
  await page.screenshot(`${out}/choose.png`);
  console.log(`bar: ${JSON.stringify(await page.evaluate(`(() => { const l = document.querySelector('.stash-roster .px-scroll'); const b = document.querySelector('.box-bar'); return { top: l.scrollTop, above: l.dataset.above, more: l.dataset.more, cover: getComputedStyle(l).getPropertyValue('--above-cover'), bar: b.getBoundingClientRect().top, list: l.getBoundingClientRect().top, attrs: [...l.attributes].map((a) => a.name + '=' + a.value).join(' ') }; })()`))}`);
  const heading = await text('.px-heading h2');
  if (!heading.includes('Which Pokémon should I raise?')) throw new Error(`his screen is headed ${JSON.stringify(heading)}`);
  // A fainted one is sent to the Pokémon Center: he heals nothing, so it would be raised fainted.
  const fainted = await page.evaluate(
    `(() => { const b = document.querySelector('button[data-shows="rattata-1"].px-row'); return b && { leave: b.hasAttribute('data-day-care-leave'), help: b.dataset.help }; })()`,
  );
  if (!fainted || fainted.leave || !fainted.help.includes('Take it to the Pokémon Center first')) {
    throw new Error(`the fainted Rattata's row is ${JSON.stringify(fainted)}`);
  }
  console.log(`fainted: ${fainted.help}`);
  await click('button[data-day-care-leave="pidgey-1"]', 'the Pidgey');
  const left = await text('.px-speech-line');
  if (!left[0]?.startsWith('Fine, I’ll look after your Pidgey')) throw new Error(`he says ${JSON.stringify(left)}`);
  await page.screenshot(`${out}/left.png`);
  console.log(`left: ${left.join(' / ')}`);
  await click('[data-speech-done]', 'Got it');
  await page.screenshot(`${out}/raising.png`);
  await click('[data-back]', 'back to the yard');
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`${state()}.live`, { what: 'the yard again' });
  await sleep(2500);
  const back = await page.evaluate(state());
  if (back.tile.x !== 33 || back.tile.y !== 11 || back.facing !== 'right') {
    throw new Error(`backing out put the player on ${JSON.stringify(back.tile)} facing ${back.facing}`);
  }
  if (back.pen?.species !== 'pidgey') throw new Error(`the pen holds ${JSON.stringify(back.pen)}`);
  await page.screenshot(`${out}/pen.png`);
  console.log(`pen: ${back.pen.species} at ${back.pen.tile.x},${back.pen.tile.y}`);

  // Raids go out and come home without it.
  await editSave(`(save) => { save.raidProgress.raidRecord = { 'floodplain-relay': { deployed: ${raids}, extracted: ${raids}, wiped: 0 } }; }`);
  await speakToHim();
  await page.screenshot(`${out}/grown.png`);
  console.log(`grown: ${(await text('.daycare-layout .px-lead .px-wrap, .daycare-layout .px-heading, .confirm-bar strong')).join(' / ')}`);
  await click('[data-day-care-take]', 'Take it back');
  const taken = await text('.px-speech-line');
  await page.screenshot(`${out}/taken.png`);
  console.log(`taken: ${taken.join(' / ')}`);
  const level = await page.evaluate(
    `JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash.pokemon.find((p) => p.id === 'pidgey-1')?.pokemon.level`,
  );
  if (level !== 4 + Math.floor(raids / 2)) throw new Error(`the Pidgey came back at level ${level}`);
  console.log(`the Pidgey is back at Lv ${level}`);
} finally {
  await page.close();
  await browser.close();
}
