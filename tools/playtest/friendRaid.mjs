// Raiding with a friend: two tabs of one browser, each a player, in one raid
// room over the local stand-in (`?harbour=local`, `src/game/raidRoom/`), so not
// one message reaches the live project.
//
//   node tools/playtest/friendRaid.mjs <url> <out dir> [--window=800x512]
//
// The two get into one room's raid (`friendTabs.mjs`) and must see each other
// under their names, in their looks from THE HARBOUR BOUTIQUE; OLLY walks and
// AMY must see him arrive where he stopped,
// and then OLLY's tab is closed - the friend disconnecting - and AMY must see
// him gone, be told he left, and still be raiding. It fails loudly - a thrown
// error - when any of that does not happen, and photographs both screens.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { FRIEND_LOOK, WORLD, twoInARoom } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ window: { width, height } });
try {
  const { olly, amy, code, bring, press, until, forget } = await twoInARoom(browser, url, out);
  // Both dropped in by the same door: on one tile, OLLY's name plate must not
  // be drawn over the head AMY shares with him (playtest 48 finding 6, raid half).
  const shared = await amy.evaluate(`(() => { const w = ${WORLD}; const me = w.currentTile;
    const drawn = [...(w.friendFigures?.drawn?.values() ?? [])];
    return { me, seen: w.friendFiguresShown, plates: drawn.map((d) => d.name.visible) }; })()`);
  if (shared.seen.some((f) => f.tile.x === shared.me.x && f.tile.y === shared.me.y)) {
    if (shared.plates.some(Boolean)) throw new Error(`AMY's screen names OLLY over the head they share: ${JSON.stringify(shared)}`);
    console.log(`On one tile ${JSON.stringify(shared.me)}: no plate over the shared head`);
    await amy.screenshot(`${out}/3b-amy-shares-a-tile.png`);
  } else {
    console.log(`Landed apart: AMY ${JSON.stringify(shared.me)}, OLLY ${JSON.stringify(shared.seen.map((f) => f.tile))}`);
  }

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
  // In what he wears, as the room says it.
  const worn = `${FRIEND_LOOK.head}+${FRIEND_LOOK.top}+${FRIEND_LOOK.legs}+${FRIEND_LOOK.body}`;
  await until(amy, 'AMY seeing OLLY in his look', (s) => s.seen.some((f) => f.name === 'OLLY' && f.look === worn));
  console.log(`AMY sees OLLY wearing ${worn}`);
  await sleep(400);
  await amy.screenshot(`${out}/4-amy-sees-olly.png`);
  await bring(olly);
  await sleep(400);
  await olly.screenshot(`${out}/5-olly-sees-amy.png`);

  // OLLY's tab goes: AMY is told, his figure goes, and her raid carries on.
  await olly.close();
  forget();
  await bring(amy);
  const gone = await until(amy, 'AMY told OLLY left', (s) => s.chip.split(' / ')[0] === 'OLLY LEFT THE RAID' && s.seen.length === 0);
  console.log(`OLLY's tab closed; AMY's chip says "${gone.chip}"`);
  await amy.screenshot(`${out}/6-amy-olly-left.png`);
  const after = await until(amy, 'AMY still raiding, alone in the room', (s) => s.chip.split(' / ')[0] === `ROOM ${code}`, 8_000);
  console.log(`AMY raids on: chip "${after.chip}" on ${after.map}`);
} finally {
  await browser.close();
}
