// Two players in one raid room, for the drivers that check what a room shares
// (`friendRaid.mjs` walks and leaves, `friendHunter.mjs` is hunted): two tabs
// of one browser on the local stand-in (`?harbour=local`), so not one message
// reaches the live project.
//
// OLLY starts a game, makes a room in Oak's Lab and drops into the raid. AMY is
// the second tab (named by the driver) and types OLLY's code: she is told the
// room is on OLLY's map and that he is already there, gets ready and drops in.
// Both tabs share one browser's storage and so one save. Two players are two
// devices; here the second tab steps round the first's raid-in-flight mark
// (`run/raidInFlight.ts`) so it may deploy at all, which is the one thing these
// drivers do that no player ever could.
import { sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

export const page = (base) => `${base}${base.includes('?') ? '&' : '?'}testmode=pixels&harbour=local`;
export const WORLD = `${GAME}.scene.getScene('world')`;
export const raid = `(() => { const w = ${WORLD}; const live = w && w.sys.isActive();
  return { live: !!live, map: live ? w.currentMap.id : null, tile: live ? w.currentTile : null,
    seen: live ? w.friendFiguresShown : [], chip: live ? (w.friendChip() ?? []).join(' / ') : null,
    dialog: live ? w.dialogBox.visible : false, battle: ${sceneIs('battle')} }; })()`;

/**
 * Reads past every line the raid opens on, so the player can walk. A fight is
 * not read past: Space there chooses FIGHT and then a move, so a driver that
 * meant to flee (`friendHunter.mjs`) would win the fight instead.
 */
export async function readOnRaid(tab, press) {
  for (let guard = 0; guard < 20; guard += 1) {
    const now = await tab.evaluate(raid);
    if (now.battle || (now.live && !now.dialog)) return;
    await press(tab, 'Space');
  }
}

/**
 * Puts OLLY and AMY in one room's raid, each seeing the other, and hands back
 * the two tabs and the way to drive them.
 */
export async function twoInARoom(browser, url, out) {
  // A tab behind another is slowed to a frame a second, so the one being
  // played is brought to the front first; the other, behind it, still hears.
  let front = null;
  const bring = async (tab) => {
    if (front !== tab) {
      await tab.send('Page.bringToFront');
      front = tab;
    }
  };
  const press = async (tab, code) => {
    await bring(tab);
    await tab.tap(code);
    await sleep(220);
  };
  const click = async (tab, label) => {
    await bring(tab);
    await tab.waitFor(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(label)}) && b.getAttribute('aria-disabled') !== 'true'); if (!b) return false; b.click(); return true; })()`,
      { what: `a "${label}" button` },
    );
    await sleep(300);
  };
  const until = async (tab, what, test, timeoutMs = 10_000) => {
    const started = Date.now();
    for (;;) {
      const now = await tab.evaluate(raid);
      if (now.live && test(now)) return now;
      if (Date.now() - started > timeoutMs) throw new Error(`${what}: ${JSON.stringify(now)}`);
      await sleep(200);
    }
  };
  const readOn = (tab) => readOnRaid(tab, press);
  const prepareAndDropIn = async (tab) => {
    await click(tab, 'Get ready');
    // The first Pokemon the vault offers, then on through the steps.
    await bring(tab);
    await tab.waitFor(takePokemon(), { what: 'a Pokémon to take' });
    await sleep(300);
    for (const label of ['Choose drop-in', 'Review & deploy', 'Enter the raid']) await click(tab, label);
    await tab.waitFor(sceneIs('world'), { what: 'the raid' });
    await readOn(tab);
  };
  const keyboardType = async (tab, text) => {
    for (const character of text) {
      const description = { code: `Key${character}`, key: character, text: character, windowsVirtualKeyCode: character.charCodeAt(0) };
      await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', ...description });
      await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', ...description });
      await sleep(40);
    }
  };

  // OLLY: a new game, under his name.
  const olly = await browser.openPage(page(url));
  await olly.waitFor(sceneIs('title'));
  await press(olly, 'Space');
  await olly.waitFor(`!!document.querySelector('[data-name-field]')`, { what: 'YOUR NAME? at NEW GAME' });
  await sleep(450);
  await olly.evaluate(`document.querySelector('[data-name-field]').focus()`);
  await keyboardType(olly, 'OLLY');
  await press(olly, 'Enter');
  await olly.waitFor(sceneIs('starter'));
  await olly.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await olly.waitFor(sceneIs('base'));
  await olly.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);

  // Into Oak's Lab, and a room on the one map a new save can drop into.
  await bring(olly);
  await walkIntoBase(olly, 'oaks-lab', { press: (code) => press(olly, code) });
  await click(olly, 'Raid with a friend');
  await olly.screenshot(`${out}/1-olly-make-a-room.png`);
  await bring(olly);
  await olly.waitFor(`(() => { const b = document.querySelector('[data-room-map]'); if (!b) return false; b.click(); return true; })()`, { what: 'a map to make a room on' });
  const code = await olly.waitFor(`document.querySelector('[data-room-code]')?.textContent.trim() || null`, { what: 'the room code' });
  console.log(`OLLY made room ${code}`);
  await sleep(300);
  await olly.screenshot(`${out}/2-olly-room-code.png`);
  await prepareAndDropIn(olly);
  const ollyStart = await until(olly, 'OLLY in the raid', (s) => s.chip.split(' / ')[0] === `ROOM ${code}`);
  console.log(`OLLY is raiding ${ollyStart.map} at ${JSON.stringify(ollyStart.tile)}, chip "${ollyStart.chip}"`);

  // AMY: the second tab, on the same save, under the name the test gives her.
  const amy = await browser.openPage(page(url), { init: `sessionStorage.setItem('eptw-harbour-local-name', 'AMY');` });
  await amy.waitFor(sceneIs('title'));
  await press(amy, 'Space');
  await amy.waitFor(sceneIs('base'));
  // Two devices would have two saves; this is one browser's (see the header).
  await amy.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); delete save.raidInFlight; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await bring(amy);
  await walkIntoBase(amy, 'oaks-lab', { press: (code) => press(amy, code) });
  await click(amy, 'Raid with a friend');
  await bring(amy);
  await amy.evaluate(`document.querySelector('[data-room-form] .px-field').focus()`);
  await keyboardType(amy, code.toLowerCase());
  await click(amy, 'Join');
  const told = await amy.waitFor(`document.querySelector('[data-room-friend]')?.textContent.includes('OLLY') && document.querySelector('[data-room-friend]').textContent`, { what: 'AMY told OLLY is in the room' });
  console.log(`AMY joined ${code}: "${told}"`);
  await amy.screenshot(`${out}/3-amy-joined.png`);
  await prepareAndDropIn(amy);

  // Each sees the other, by name.
  const amySees = await until(amy, 'AMY seeing OLLY', (s) => s.seen.some((f) => f.name === 'OLLY'));
  console.log(`AMY sees ${JSON.stringify(amySees.seen)}, chip "${amySees.chip}"`);
  await bring(olly);
  const ollySees = await until(olly, 'OLLY seeing AMY', (s) => s.seen.some((f) => f.name === 'AMY'));
  console.log(`OLLY sees ${JSON.stringify(ollySees.seen)}, chip "${ollySees.chip}"`);

  return { olly, amy, code, bring, press, click, until, readOn, forget: () => { front = null; } };
}

/**
 * Runs from whatever fight a tab is in - RUN from a wild one, FLEE from the
 * hunter - and reads on until the world is back. A driver walking a map with
 * tall grass on it meets fights it did not come for.
 */
export async function leaveFight(tab, press) {
  const battle = `(() => { const b = ${GAME}.scene.getScene('battle'); if (!b || !b.sys.isActive()) return null;
    return { mode: b.mode, commands: b.commandTexts.map((t, i) => (i === b.selectedCommand ? '>' : '') + t.text) }; })()`;
  const seen = new Set();
  for (let guard = 0; guard < 200; guard += 1) {
    if (await tab.evaluate(`${WORLD}.sys.isActive()`)) return;
    const b = await tab.evaluate(battle);
    if (b && b.mode === 'main') {
      const selected = b.commands.find((command) => command.startsWith('>')) ?? '';
      if (!selected.includes('RUN') && !selected.includes('FLEE')) {
        const key = seen.has(selected) ? 'ArrowDown' : 'ArrowRight';
        seen.add(selected);
        await press(tab, key);
        continue;
      }
    }
    await press(tab, 'Space');
  }
}

/**
 * The first key of the shortest walk to a tile over the world's own collision,
 * `here` once on it, null if nothing reaches it.
 */
export const stepToward = (goal) => `(() => { const w = ${WORLD}; if (!w.sys.isActive()) return 'away'; const c = w.collisionData, s = w.currentTile, g = ${JSON.stringify(goal)};
  if (s.x === g.x && s.y === g.y) return 'here'; const W = c[0].length, H = c.length, id = (x, y) => y * W + x;
  const prev = new Map([[id(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (x === g.x && y === g.y) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || c[ny][nx]) continue; prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return null; let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;
