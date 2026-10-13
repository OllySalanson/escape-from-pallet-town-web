// Raiding with a friend: two tabs of one browser, each a player, in one raid
// room over the local stand-in (`?harbour=local`, `src/game/raidRoom/`), so not
// one message reaches the live project - a driven page cannot reach it anyway
// (`browser.mjs`).
//
//   node tools/playtest/friendRaid.mjs <url> <out dir> [--window=800x512]
//
// OLLY starts a game, makes a room in Oak's Lab and drops into the raid. AMY is
// the second tab (named by the test) and types OLLY's code: she is told the
// room is on OLLY's map and that he is already there, gets ready and drops in.
// Each must see the other in the raid under their name, OLLY walks and AMY
// must see him arrive where he stopped, and then OLLY's tab is closed - the
// friend disconnecting - and AMY must see him gone, be told he left, and still
// be raiding. It fails loudly - a thrown error - when any of that does not
// happen, and photographs both screens on the way.
//
// Both tabs share one browser's storage and so one save. Two players are two
// devices; here the second tab steps round the first's raid-in-flight mark
// (`run/raidInFlight.ts`) so it may deploy at all, which is the one thing the
// test does that no player ever could.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const page = (base) => `${base}${base.includes('?') ? '&' : '?'}testmode=pixels&harbour=local`;
const WORLD = `${GAME}.scene.getScene('world')`;
const raid = `(() => { const w = ${WORLD}; const live = w && w.sys.isActive();
  return { live: !!live, map: live ? w.currentMap.id : null, tile: live ? w.currentTile : null,
    seen: live ? w.friendFiguresShown : [], chip: live ? (w.friendChip() ?? []).join(' / ') : null,
    dialog: live ? w.dialogBox.visible : false, battle: ${sceneIs('battle')} }; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
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
  /** Reads past every line the raid opens on, so the player can walk. */
  const readOn = async (tab) => {
    for (let guard = 0; guard < 20; guard += 1) {
      const now = await tab.evaluate(raid);
      if (now.live && !now.dialog) return;
      await press(tab, 'Space');
    }
  };
  const prepareAndDropIn = async (tab) => {
    await click(tab, 'Get ready');
    // The first Pokemon the vault offers, then on through the steps.
    await bring(tab);
    await tab.waitFor(
      `(() => { const b = document.querySelector('button[data-pokemon]:not(.is-selected)'); if (!b) return false; b.click(); return true; })()`,
      { what: 'a Pokémon to take' },
    );
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
  const ollyStart = await until(olly, 'OLLY in the raid', (s) => s.chip === `ROOM ${code}`);
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

  // OLLY walks; AMY sees him get where he stopped.
  const ollyWalk = await olly.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, s = w.currentTile;
    const open = (x, y) => y >= 0 && x >= 0 && y < c.length && x < c[0].length && !c[y][x];
    for (const [dx, dy, k] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']]) {
      if (open(s.x + dx, s.y + dy) && open(s.x + 2 * dx, s.y + 2 * dy)) return { key: k, goal: { x: s.x + 2 * dx, y: s.y + 2 * dy } }; }
    return null; })()`);
  if (!ollyWalk) throw new Error('OLLY has nowhere to walk two tiles');
  for (let step = 0; step < 2; step += 1) await press(olly, ollyWalk.key);
  const walked = await until(olly, 'OLLY walking two tiles', (s) => (s.tile.x === ollyWalk.goal.x && s.tile.y === ollyWalk.goal.y) || s.battle);
  console.log(`OLLY walked to ${JSON.stringify(walked.tile)}`);
  await bring(amy);
  await until(amy, 'AMY seeing OLLY arrive', (s) => s.seen.some((f) => f.name === 'OLLY' && f.tile.x === walked.tile.x && f.tile.y === walked.tile.y));
  console.log(`AMY saw OLLY walk to ${walked.tile.x},${walked.tile.y}`);
  await sleep(400);
  await amy.screenshot(`${out}/4-amy-sees-olly.png`);
  await bring(olly);
  await sleep(400);
  await olly.screenshot(`${out}/5-olly-sees-amy.png`);

  // OLLY's tab goes: AMY is told, his figure goes, and her raid carries on.
  await olly.close();
  front = null;
  await bring(amy);
  const gone = await until(amy, 'AMY told OLLY left', (s) => s.chip === 'OLLY LEFT THE RAID' && s.seen.length === 0);
  console.log(`OLLY's tab closed; AMY's chip says "${gone.chip}"`);
  await amy.screenshot(`${out}/6-amy-olly-left.png`);
  const after = await until(amy, 'AMY still raiding, alone in the room', (s) => s.chip === `ROOM ${code}`, 8_000);
  console.log(`AMY raids on: chip "${after.chip}" on ${after.map}`);
} finally {
  await browser.close();
}
