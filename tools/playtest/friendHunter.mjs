// One hunter for a raid room (`src/game/raidRoom/groupHunter.ts`): two tabs of
// one browser in one room's raid (`friendTabs.mjs`), on the local stand-in.
//
//   node tools/playtest/friendHunter.mjs <url> <out dir> [--window=800x512]
//
// The hunter is brought in at once (the driver lets the raid's clock skip the
// arrival's wait), and it must be ONE hunter: the keeper's browser runs it and
// the other draws it on the same tile, with no hunter of its own. It must step
// when the player it is chasing steps, and the other screen must see it move.
// Then that player walks into it: the fight is theirs, in their own tab, and
// while it lasts the hunter holds still on the other screen however the other
// player walks. It fails loudly - a thrown error - when any of that does not
// happen, and photographs both screens on the way.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { sceneIs } from './deploy.mjs';
import { WORLD, twoInARoom } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const hunt = `(() => { const w = ${WORLD}; if (!w || !w.sys.isActive()) return { live: false, battle: ${sceneIs('battle')} };
  const h = w.hunterState; const q = w.groupQuarry();
  return { live: true, role: w.huntRoleWas, me: w.currentTile, spawned: h.spawned, defeated: h.defeated,
    hunter: h.position ?? null, quarry: q ? q.id : null, search: h.searchRemainingMs ?? 0,
    held: w.hunterFightingSomebodyElse(), dialog: w.dialogBox.visible, sprite: !!w.npcSprites.get('rival-hunter')?.visible }; })()`;
const myId = `(() => { const s = sessionStorage.getItem('eptw-harbour-local-id'); return s; })()`;
const same = (a, b) => a && b && a.x === b.x && a.y === b.y;

const browser = await launchBrowser({ window: { width, height } });
try {
  const { olly, amy, bring, press, readOn } = await twoInARoom(browser, url, out);
  const tabs = { OLLY: olly, AMY: amy };
  const read = async (tab) => {
    await bring(tab);
    return tab.evaluate(hunt);
  };
  const wait = async (tab, what, test, timeoutMs = 15_000) => {
    const started = Date.now();
    for (;;) {
      const now = await read(tab);
      if (test(now)) return now;
      if (Date.now() - started > timeoutMs) throw new Error(`${what}: ${JSON.stringify(now)}`);
      await sleep(200);
    }
  };

  // The arrival is due at once in both raids: whichever is keeper brings it in.
  for (const tab of [olly, amy]) {
    await bring(tab);
    await tab.evaluate(`(() => { const w = ${WORLD}; w.runSession.plan.hunter.spawnDelayMs = 0; w.runSession.stepsTaken = 99; })()`);
  }
  const roles = {};
  for (const [name, tab] of Object.entries(tabs)) roles[name] = (await wait(tab, `${name} in the room's hunt`, (s) => s.live && s.role !== 'solo')).role;
  const keeperName = Object.keys(roles).find((name) => roles[name] === 'keeper');
  const followerName = Object.keys(roles).find((name) => roles[name] === 'follower');
  if (!keeperName || !followerName) throw new Error(`one keeper and one follower, not ${JSON.stringify(roles)}`);
  const keeper = tabs[keeperName];
  const follower = tabs[followerName];
  console.log(`${keeperName} keeps the hunter, ${followerName} draws it`);

  const kept = await wait(keeper, `${keeperName}'s hunter arriving`, (s) => s.live && s.spawned && s.hunter);
  await readOn(keeper);
  const drawn = await wait(follower, `${followerName} drawing the same hunter`, (s) => s.live && s.sprite && same(s.hunter, kept.hunter));
  console.log(`one hunter: ${keeperName} has it at ${JSON.stringify(kept.hunter)}, ${followerName} draws it there`);
  await readOn(follower);
  await keeper.screenshot(`${out}/h1-${keeperName.toLowerCase()}-keeps-the-hunter.png`);
  await bring(follower);
  await follower.screenshot(`${out}/h2-${followerName.toLowerCase()}-sees-the-same-hunter.png`);

  // Whoever it chases steps, and it steps after them, on both screens.
  const ids = { [keeperName]: await keeper.evaluate(myId), [followerName]: await follower.evaluate(myId) };
  const before = await read(keeper);
  const chasedName = Object.keys(ids).find((name) => ids[name] === before.quarry);
  if (!chasedName) throw new Error(`the hunter chases nobody in the room: ${JSON.stringify(before)}`);
  const chased = tabs[chasedName];
  const open = await chased.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, s = w.currentTile;
    const free = (x, y) => y >= 0 && x >= 0 && y < c.length && x < c[0].length && !c[y][x];
    for (const [dx, dy, k] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']]) if (free(s.x + dx, s.y + dy)) return k; return null; })()`);
  await press(chased, open);
  await sleep(600);
  const moved = await wait(keeper, `the hunter stepping after ${chasedName}`, (s) => s.live && s.hunter && !same(s.hunter, before.hunter), 10_000);
  await wait(follower, `${followerName} seeing the hunter step`, (s) => s.live && same(s.hunter, moved.hunter));
  console.log(`${chasedName} stepped; the hunter stepped from ${JSON.stringify(before.hunter)} to ${JSON.stringify(moved.hunter)} on both screens`);

  // The follower - the one whose browser does not run the hunter - walks into
  // it: the fight is theirs alone, and its end is what the room is told.
  const fighterName = followerName;
  const fighter = follower;
  const toward = `(() => { const w = ${WORLD}; if (!w.sys.isActive()) return 'fight'; const h = w.hunterState.position; const c = w.collisionData, s = w.currentTile;
    if (!h) return null; const W = c[0].length, H = c.length, id = (x, y) => y * W + x;
    const prev = new Map([[id(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
    while (q.length) { const [x, y] = q.shift(); if (Math.abs(x - h.x) + Math.abs(y - h.y) === 0) { found = [x, y]; break; }
      for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
        if (!(nx === h.x && ny === h.y) && c[ny][nx]) continue; prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
    if (!found) return null; let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;
  for (let guard = 0; guard < 120; guard += 1) {
    await readOn(fighter);
    const key = await fighter.evaluate(toward);
    if (key === 'fight' || (await fighter.evaluate(sceneIs('battle')))) break;
    if (key) await press(fighter, key);
    else await sleep(200);
  }
  await fighter.waitFor(sceneIs('battle'), { what: `${fighterName}'s fight with the hunter` });
  console.log(`${fighterName} was caught, and the fight is in ${fighterName}'s own tab`);
  await sleep(800);
  await fighter.screenshot(`${out}/h3-${fighterName.toLowerCase()}-fights-the-hunter.png`);

  const otherName = keeperName;
  const other = keeper;
  const holding = await wait(other, `${otherName} seeing the hunter held`, (s) => s.live && s.held);
  await readOn(other);
  const otherOpen = await other.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, s = w.currentTile;
    const free = (x, y) => y >= 0 && x >= 0 && y < c.length && x < c[0].length && !c[y][x];
    for (const [dx, dy, k] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']]) if (free(s.x + dx, s.y + dy)) return k; return null; })()`);
  for (let step = 0; step < 3; step += 1) await press(other, otherOpen);
  await sleep(800);
  const still = await read(other);
  if (!same(still.hunter, holding.hunter) || (await other.evaluate(sceneIs('battle')))) {
    throw new Error(`the hunter moved or caught ${otherName} while ${fighterName} was fighting it: ${JSON.stringify({ holding, still })}`);
  }
  console.log(`while ${fighterName} fights it, the hunter holds at ${JSON.stringify(still.hunter)} for ${otherName}, who walked three tiles`);
  await other.screenshot(`${out}/h4-${otherName.toLowerCase()}-hunter-held.png`);

  // The fighter runs: the hunter falls back and searches, and the keeper takes
  // that from the fighter's word rather than keeping the hunter it had.
  const battle = `(() => { const b = window.__escapeFromPalletTownGame__.scene.getScene('battle'); if (!b || !b.sys.isActive()) return null;
    return { mode: b.mode, commands: b.commandTexts.map((t, i) => (i === b.selectedCommand ? '>' : '') + t.text) }; })()`;
  const seen = new Set();
  for (let guard = 0; guard < 200; guard += 1) {
    if (await fighter.evaluate(`${WORLD}.sys.isActive()`)) break;
    const b = await fighter.evaluate(battle);
    if (b && b.mode === 'main') {
      const selected = b.commands.find((command) => command.startsWith('>')) ?? '';
      if (!selected.includes('FLEE')) {
        const key = seen.has(selected) ? 'ArrowDown' : 'ArrowRight';
        seen.add(selected);
        await press(fighter, key);
        continue;
      }
      console.log(`${fighterName} chooses ${selected.slice(1)}`);
    }
    await press(fighter, 'Space');
  }
  await wait(fighter, `${fighterName} back in the raid after running`, (s) => s.live && s.hunter);
  await readOn(fighter);
  // Settled, rather than whatever the first frame back shows.
  await sleep(2_500);
  const back = await read(fighter);
  const adopted = await wait(keeper, `${keeperName} taking the hunter where ${fighterName}'s escape left it`, (s) => s.live && !s.held && same(s.hunter, back.hunter));
  if (back.defeated || back.search <= 0 || same(back.hunter, holding.hunter)) {
    throw new Error(`an escape leaves the hunter searching somewhere else: ${JSON.stringify({ holding, back, adopted })}`);
  }
  console.log(`${fighterName} ran: the hunter fell back to ${JSON.stringify(back.hunter)} on ${fighterName}'s screen, and ${keeperName}'s hunter is there too (${JSON.stringify(adopted.hunter)})`);
  await keeper.screenshot(`${out}/h5-${keeperName.toLowerCase()}-after-the-escape.png`);
} finally {
  await browser.close();
}
