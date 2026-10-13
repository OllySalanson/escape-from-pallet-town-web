// Loot to whoever steps on it first, in a raid room (`src/game/raidRoom/roomLoot.ts`):
// two tabs of one browser in one room's raid (`friendTabs.mjs`), on the local stand-in.
//
//   node tools/playtest/friendLoot.mjs <url> <out dir> [--window=800x512]
//
// Both raids must lay the room's ground on the same tiles. OLLY walks to the
// nearest shared piece and picks it up - it goes into his pack - and on AMY's
// screen it must go too. It fails loudly - a thrown error - when any of that does not
// happen, and photographs both screens on the way.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { WORLD, leaveFight, stepToward, twoInARoom } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const ground = `(() => { const w = ${WORLD}; if (!w || !w.sys.isActive()) return null; const ids = w.runSession.plan.roomLootIds ?? [];
  return { me: w.currentTile, shared: w.lootForCurrentMap().filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, itemId: l.itemId, x: l.position.x, y: l.position.y })),
    gone: [...w.collectedLootIds], drawn: [...w.lootSprites.keys()], dialog: w.dialogBox.visible, bag: { ...w.bag.contents } }; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const { olly, amy, bring, press, readOn } = await twoInARoom(browser, url, out);
  const look = async (tab) => {
    await bring(tab);
    return tab.evaluate(ground);
  };
  const ollyGround = await look(olly);
  const amyGround = await look(amy);
  const key = (pieces) => JSON.stringify([...pieces].sort((a, b) => a.id.localeCompare(b.id)));
  if (ollyGround.shared.length === 0 || key(ollyGround.shared) !== key(amyGround.shared)) {
    throw new Error(`the room's ground differs: ${key(ollyGround.shared)} against ${key(amyGround.shared)}`);
  }
  console.log(`both raids lay the same ${ollyGround.shared.length} shared pieces on the same tiles`);

  // OLLY walks to the nearest piece he can reach.
  const pathLength = (from, piece) => Math.abs(from.x - piece.x) + Math.abs(from.y - piece.y);
  const pieces = [...ollyGround.shared].sort((a, b) => pathLength(ollyGround.me, a) - pathLength(ollyGround.me, b));
  let piece = null;
  for (const candidate of pieces) {
    if ((await olly.evaluate(stepToward({ x: candidate.x, y: candidate.y }))) !== null) {
      piece = candidate;
      break;
    }
  }
  if (!piece) throw new Error('OLLY can reach no shared piece');
  console.log(`OLLY goes for ${piece.itemId} (${piece.id}) at ${piece.x},${piece.y}`);
  const before = ollyGround.bag[piece.itemId] ?? 0;
  for (let guard = 0; guard < 400; guard += 1) {
    await bring(olly);
    const now = await olly.evaluate(ground);
    if (now?.gone.includes(piece.id)) break;
    if (!now) {
      await leaveFight(olly, press);
      continue;
    }
    if (now.dialog) {
      await press(olly, 'Space');
      continue;
    }
    const step = await olly.evaluate(stepToward({ x: piece.x, y: piece.y }));
    if (step === 'here') {
      await sleep(300);
      continue;
    }
    if (step && step !== 'away') await press(olly, step);
    else await sleep(200);
  }
  await sleep(500);
  const took = await look(olly);
  if (!took.gone.includes(piece.id) || (took.bag[piece.itemId] ?? 0) <= before) {
    throw new Error(`OLLY did not pick up ${piece.id}: ${JSON.stringify({ gone: took.gone, bag: took.bag })}`);
  }
  console.log(`OLLY picked it up: ${piece.itemId} ${before} -> ${took.bag[piece.itemId]}`);
  await olly.screenshot(`${out}/l1-olly-picks-it-up.png`);
  await readOn(olly);

  // On AMY's screen it is gone too.
  let amyNow = null;
  for (let guard = 0; guard < 50; guard += 1) {
    amyNow = await look(amy);
    if (amyNow && amyNow.gone.includes(piece.id) && !amyNow.drawn.includes(piece.id)) break;
    await sleep(200);
  }
  if (!amyNow?.gone.includes(piece.id) || amyNow.drawn.includes(piece.id)) {
    throw new Error(`AMY still sees ${piece.id}: ${JSON.stringify(amyNow)}`);
  }
  console.log(`on AMY's screen ${piece.id} is gone`);
  await amy.screenshot(`${out}/l2-amy-sees-it-gone.png`);
} finally {
  await browser.close();
}
