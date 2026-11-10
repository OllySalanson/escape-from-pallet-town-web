// Loot to whoever steps on it first, in a raid room (`src/game/raidRoom/roomLoot.ts`):
// two tabs of one browser in one room's raid (`friendTabs.mjs`), on the local stand-in.
//
//   node tools/playtest/friendLoot.mjs <url> <out dir> [--window=800x512]
//
// Both raids must lay the room's ground on the same tiles, and each must still
// lay what is its own player's - the stake and whatever an open secret holds -
// beside it (`isRaidsOwnLoot`). OLLY walks to the nearest shared piece and picks
// it up - it goes into his pack - and on AMY's screen it must go too. Then the
// room closes under AMY, as one does when its hour runs out or she joins another
// room from another tab: the next piece she steps on must still be hers, and her
// chip must say why (`FriendRoom.claimLoot`). It fails loudly - a thrown error -
// when any of that does not happen, and photographs both screens on the way,
// each before the check it shows.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { WORLD, leaveFight, stepToward, twoInARoom } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const ground = `(() => { const w = ${WORLD}; if (!w || !w.sys.isActive()) return null; const ids = w.runSession.plan.roomLootIds ?? [];
  const piece = (l) => ({ id: l.id, itemId: l.itemId, x: l.position.x, y: l.position.y });
  return { me: w.currentTile, shared: w.lootForCurrentMap().filter((l) => ids.includes(l.id)).map(piece),
    own: w.lootForCurrentMap().filter((l) => !ids.includes(l.id)).map((l) => ({ ...piece(l), stake: /\/stake(-money-|$)/.test(l.id), secret: l.secret ?? null })),
    openSecrets: (w.runSession.plan.secrets ?? []).map((secret) => secret.id),
    gone: [...w.collectedLootIds], drawn: [...w.lootSprites.keys()], dialog: w.dialogBox.visible, bag: { ...w.bag.contents },
    chip: (w.friendChip() ?? []).join(' / ') }; })()`;

/** A tab's place in the local stand-in's rooms, as `localRoomService` keeps them. */
const ROOMS_KEY = 'eptw-raid-rooms-local';

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

  // Each raid keeps its own player's stake and secrets beside the room's ground.
  await olly.screenshot(`${out}/l0-olly-lands-with-his-stake.png`);
  for (const [who, mine] of [['OLLY', ollyGround], ['AMY', amyGround]]) {
    const stake = mine.own.filter((piece) => piece.stake);
    if (!stake.some((piece) => /\/stake$/.test(piece.id))) {
      throw new Error(`${who}'s raid in a room has no stake: ${JSON.stringify(mine.own)}`);
    }
    const unlaid = mine.openSecrets.filter((id) => !mine.own.some((piece) => piece.secret === id));
    if (unlaid.length > 0) throw new Error(`${who}'s raid in a room lays nothing for its open secrets ${unlaid.join(', ')}`);
    console.log(`${who}'s raid keeps its own stake (${stake.map((piece) => piece.itemId).join(', ')}) and ${mine.openSecrets.length} open secret(s) ${mine.own.filter((piece) => piece.secret).map((piece) => `${piece.secret}:${piece.itemId}`).join(', ')}`);
  }

  /** The nearest shared piece a tab can walk to that nobody has taken yet. */
  const nearestPiece = async (tab, now) => {
    const pathLength = (from, piece) => Math.abs(from.x - piece.x) + Math.abs(from.y - piece.y);
    const pieces = now.shared.filter((candidate) => !now.gone.includes(candidate.id)).sort((a, b) => pathLength(now.me, a) - pathLength(now.me, b));
    for (const candidate of pieces) {
      if ((await tab.evaluate(stepToward({ x: candidate.x, y: candidate.y }))) !== null) return candidate;
    }
    return null;
  };
  /**
   * Walks a tab onto a piece and stands there until it is taken, or the guard
   * runs out - the bug this checks was a piece that never went. Standing on it
   * and stepping off and on again is what a player would try.
   */
  const walkOnto = async (tab, piece) => {
    let stood = 0;
    for (let guard = 0; guard < 400; guard += 1) {
      await bring(tab);
      const now = await tab.evaluate(ground);
      if (now?.gone.includes(piece.id)) return true;
      if (!now) {
        await leaveFight(tab, press);
        continue;
      }
      if (now.dialog) {
        await press(tab, 'Space');
        continue;
      }
      const step = await tab.evaluate(stepToward({ x: piece.x, y: piece.y }));
      if (step === 'here') {
        stood += 1;
        if (stood > 12) return false;
        await sleep(300);
        continue;
      }
      if (step && step !== 'away') await press(tab, step);
      else await sleep(200);
    }
    return false;
  };

  // OLLY walks to the nearest piece he can reach.
  const piece = await nearestPiece(olly, ollyGround);
  if (!piece) throw new Error('OLLY can reach no shared piece');
  console.log(`OLLY goes for ${piece.itemId} (${piece.id}) at ${piece.x},${piece.y}`);
  const before = ollyGround.bag[piece.itemId] ?? 0;
  await walkOnto(olly, piece);
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

  // The room closes under AMY: the stand-in takes her out of it, as the
  // database does when its hour runs out or she joins another room elsewhere.
  await bring(amy);
  // A tab's id on the stand-in (`harbour.ts` `localIdentity`).
  const me = await amy.evaluate(`sessionStorage.getItem('eptw-harbour-local-id')`);
  if (!me) throw new Error('could not tell which member of the room AMY is');
  await amy.evaluate(`(() => { const rooms = JSON.parse(localStorage.getItem('${ROOMS_KEY}')); for (const room of Object.values(rooms)) room.members = room.members.filter((id) => id !== ${JSON.stringify(me)}); localStorage.setItem('${ROOMS_KEY}', JSON.stringify(rooms)); return true; })()`);
  await readOn(amy);
  const amyLeft = await look(amy);
  const next = await nearestPiece(amy, amyLeft);
  if (!next) throw new Error('AMY can reach no shared piece');
  console.log(`the room closes under AMY; she goes for ${next.itemId} (${next.id}) at ${next.x},${next.y}`);
  const hers = amyLeft.bag[next.itemId] ?? 0;
  const pickedUp = await walkOnto(amy, next);
  const closed = await look(amy);
  await amy.screenshot(`${out}/l3-amy-room-closed-picks-it-up.png`);
  if (!pickedUp || (closed.bag[next.itemId] ?? 0) <= hers) {
    throw new Error(`AMY, her room closed, could not pick up ${next.id}: ${JSON.stringify({ gone: closed.gone.includes(next.id), bag: closed.bag, chip: closed.chip })}`);
  }
  if (!closed.chip.includes('ROOM CLOSED')) throw new Error(`AMY's chip never said the room closed: "${closed.chip}"`);
  console.log(`AMY picked it up all the same: ${next.itemId} ${hers} -> ${closed.bag[next.itemId]}, chip "${closed.chip}"`);
} finally {
  await browser.close();
}
