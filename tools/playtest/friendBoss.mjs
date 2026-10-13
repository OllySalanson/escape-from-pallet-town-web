// Shared discoveries and a boss's doors in a raid room
// (`src/game/raidRoom/roomBosses.ts`, `WorldScene.surveyWithFriends`): two tabs
// of one browser in one room's raid (`friendTabs.mjs`), on the local stand-in.
//
//   node tools/playtest/friendBoss.mjs <url> <out dir> [--window=800x512]
//
// Discoveries: OLLY walks, and the ground round him must join AMY's survey of
// this raid - the one her drop-in map is lit from when it ends.
//
// A boss: a level-5 partner beats no keeper, so the driver puts the keeper's id
// among OLLY's beaten trainers, as a won fight's return does, and asks his raid
// to say its wins - the one step a player could not take. From there it
// is all the game's own: OLLY's raid says the win to the room, and in AMY's
// raid the keeper must step aside, the doors must open on her map, the chip
// must say who opened them, and none of it may be written to her save. It fails
// loudly - a thrown error - when any of that does not happen, and photographs
// AMY's screen on the way.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { WORLD, twoInARoom } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ window: { width, height } });
try {
  const { olly, amy, bring, press } = await twoInARoom(browser, url, out);
  const read = async (tab, expression) => {
    await bring(tab);
    return tab.evaluate(expression);
  };

  // Discoveries.
  const surveyed = `(() => { const w = ${WORLD}; return [...(w.runSession.surveyed ?? [])]; })()`;
  const amyBefore = new Set(await read(amy, surveyed));
  const walk = await read(olly, `(() => { const w = ${WORLD}; const c = w.collisionData, s = w.currentTile;
    const free = (x, y) => y >= 0 && x >= 0 && y < c.length && x < c[0].length && !c[y][x];
    for (const [dx, dy, k] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']]) {
      let n = 0; while (n < 6 && free(s.x + dx * (n + 1), s.y + dy * (n + 1))) n += 1; if (n >= 4) return { k, n }; } return null; })()`);
  if (!walk) throw new Error('OLLY has nowhere to walk four tiles');
  for (let step = 0; step < walk.n; step += 1) await press(olly, walk.k);
  await sleep(800);
  let amyAfter = new Set();
  for (let guard = 0; guard < 30; guard += 1) {
    amyAfter = new Set(await read(amy, surveyed));
    if ([...amyAfter].some((tile) => !amyBefore.has(tile))) break;
    await sleep(300);
  }
  const lit = [...amyAfter].filter((tile) => !amyBefore.has(tile)).length;
  if (lit === 0) throw new Error('none of the ground OLLY walked joined AMY’s survey');
  console.log(`OLLY walked ${walk.n} tiles and ${lit} more tiles of ground joined AMY's survey of this raid`);

  // A boss.
  const boss = await read(olly, `(() => { const w = ${WORLD}; const map = w.currentMap.id;
    const b = w.trainerEncounters.find((t) => t.bossId && t.mapId === map && w.currentMap.gates.some((g) => g.bossId === t.bossId));
    return b ? { bossId: b.bossId, trainerId: b.trainer.id } : null; })()`);
  if (!boss) throw new Error('no keeper with a door on this map');
  const doorState = `(() => { const w = ${WORLD}; const gates = w.currentMap.gates.filter((g) => g.bossId === ${JSON.stringify(boss.bossId)});
    return { open: gates.every((g) => g.tiles.every((t) => !w.collisionData[t.y][t.x])),
      keeper: w.trainersForCurrentMap().some((t) => t.bossId === ${JSON.stringify(boss.bossId)}),
      saved: w.defeatedBosses.includes(${JSON.stringify(boss.bossId)}), chip: (w.friendChip() ?? []).join(' / '),
      gates: gates.map((g) => g.label) }; })()`;
  const shut = await read(amy, doorState);
  if (shut.open || !shut.keeper) throw new Error(`AMY's ${boss.bossId} door is not shut with its keeper at it before the win: ${JSON.stringify(shut)}`);
  console.log(`AMY's ${shut.gates.join(' and ')} stand shut, with ${boss.bossId} at them`);
  await read(olly, `(() => { const w = ${WORLD}; w.defeatedTrainerIds.add(${JSON.stringify(boss.trainerId)}); w.sayRoomWins(); return true; })()`);
  let opened = null;
  for (let guard = 0; guard < 40; guard += 1) {
    opened = await read(amy, doorState);
    if (opened.open && !opened.keeper) break;
    await sleep(250);
  }
  if (!opened.open || opened.keeper || opened.saved) {
    throw new Error(`AMY's door did not open for this raid alone: ${JSON.stringify(opened)}`);
  }
  console.log(`OLLY's win opened ${opened.gates.join(' and ')} in AMY's raid, the keeper stepped aside, and nothing went into her save; her chip: "${opened.chip}"`);
  await amy.screenshot(`${out}/b1-amy-door-opened-by-olly.png`);
} finally {
  await browser.close();
}
