// The way from the title screen into a raid, for every driver here.
//
// A fresh save is offered one insertion, the Floodplain's front door. Anywhere
// else is reached the way a player reaches it: the game writes its own save, its
// `raidProgress` (and nothing else but HP) is edited to what that player's would
// say, the page is reloaded and the raid is deployed from the lobby that save
// opens on - so a gate is open because the raid was built with it open, and an
// insertion is dropped into because its row in the loadout was clicked, not
// because a scene's private state was poked.
import { sleep } from './browser.mjs';

export const SAVE_KEY = 'escape-from-pallet-town.save.v1';
export const GAME = 'window.__escapeFromPalletTownGame__';
export const sceneIs = (key) => `${GAME}?.scene.getScenes(true).some((s) => s.scene.key === '${key}')`;
/** True from the moment a jump over the fence has begun until the raid is under way. */
const GOING_OVER = `(() => { const scenes = ${GAME}.scene.getScenes(true).map((s) => s.scene.key); return scenes.includes('world') || Boolean(${GAME}.scene.getScene('base')?.jump); })()`;

/**
 * An expression that puts a Pokemon in the raid party on the loadout and is
 * true once it is there - the named one, or with no name whichever row comes
 * first. A row is only clicked when it is not already in the party: a vault's
 * only Pokemon is packed by default (`DeploymentFlow.packLonePokemon`), and
 * clicking its row again would take it back out.
 */
export const takePokemon = (name = null) =>
  `(() => { const rows = [...document.querySelectorAll('button[data-pokemon]')].filter((b) => ${JSON.stringify(name?.toLowerCase() ?? null)} === null || b.innerText.toLowerCase().includes(${JSON.stringify(name?.toLowerCase() ?? '')})); if (rows.length === 0) return false; if (rows.some((b) => b.classList.contains('is-selected'))) return true; const row = rows.find((b) => b.getAttribute('aria-disabled') !== 'true'); if (!row) return false; row.click(); return true; })()`;

/**
 * Walks the base to one of its keepers' doors, goes in, and speaks to the keeper.
 *
 * The lobby used to be a screen with four cards on it, so every driver here
 * reached a base screen by clicking `button[data-view=...]`. It is a map now
 * (`src/game/scenes/BaseScene.ts`), and every building on it is a room with its
 * keeper inside (`src/game/base/rooms.ts`): the screens are unchanged and what
 * changed is that you walk to them. The route is worked out over the scene's
 * own collision and the scene's own door list rather than typed here, so a
 * redrawn base moves the walk with it.
 *
 * `door` is a `BASE_DOORS` id: `raid-arena`, `oaks-lab`, `pokemon-centre`,
 * `brocks-workshop` or `bills-cottage`. Inside most, the interact key on the door mat is the keeper's
 * screen - the one-key way in a player re-kitting takes - so that is what this
 * presses. A driver already in the right room (backed out of its screen) just
 * presses it again; one in another room walks back out first. THE RAID ARENA has
 * no keeper's screen: everything is on its floor, so a walk into it goes on to
 * the bench and opens that (`openHallPanel`). Nor have the others, whose keepers
 * talk rather than open anything (`BaseScene.speakToKeeper`): in `pokemon-centre`
 * this walks on to BILL'S PC, which is the boxes, in `brocks-workshop` to the tally
 * on his wall, which is the whole ladder, in `bills-cottage` to his PC, which is the
 * whole list, and in `oaks-lab` it stops on the mat with nothing said, for the
 * driver to speak to Oak or walk up to the board.
 *
 * A keeper with a favour says it first, in the dialogue box, and asks YES or
 * NOT NOW: the presses read it, and the question is
 * answered NOT NOW - a driver on its way to a screen takes nothing on - unless
 * `acceptFavours` is set.
 *
 * `wait` is how it lets the scene catch up between moves, and a driver that
 * steps a paused loop must hand over its own: a real-time sleep advances a
 * paused game by nothing, so the room a door opens onto never finished coming
 * in and every stepped driver stood on Oak's Lab's doorstep until it gave up.
 */
export async function walkIntoBase(page, door, options = {}) {
  const press = options.press ?? ((code) => page.tap(code, 60));
  const until = options.until ?? ((expression, what) => page.waitFor(expression, { what }));
  const settleMs = options.settleMs ?? 180;
  const settle = options.wait ?? sleep;
  if (!options.wait && (await page.evaluate(`${GAME}?.loopPaused === true`))) {
    throw new Error(`walkIntoBase: the game loop is paused, so it only moves when stepped - hand over the driver's own \`wait\``);
  }
  await until(sceneIs('base'), 'the base');
  // A keeper's screen is the hub; THE HARBOUR BOUTIQUE's is a screen of its own over the harbour.
  const opened = `${sceneIs('hub')} || ${sceneIs('boutique')}`;
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && b.room?.id === 'raid-arena'; })()`;
  for (let guard = 0; guard < 120; guard += 1) {
    if (await page.evaluate(opened)) {
      return;
    }
    if (door === 'raid-arena' && (await page.evaluate(inHall))) {
      await openHallPanel(page, 'bench', { ...options, press, until, wait: settle });
      return;
    }
    // The first time through the Raid Arena's door its trailer plays, and any key skips
    // it to the hall (`scenes/ArenaIntroScene.ts`). It ignores keys for
    // its first half-second, so the press is made again until it takes.
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await press('Escape');
      await settle(settleMs);
      continue;
    }
    if (await page.evaluate(`Boolean(${GAME}.scene.getScene('base')?.boxQuestion)`)) {
      if (!options.acceptFavours) {
        await press('ArrowRight');
        await settle(settleMs);
      }
      await press('Space');
      await settle(settleMs);
      continue;
    }
    const move = await page.evaluate(
      `(() => { const b = ${GAME}.scene.getScene('base'); if (!b || !b.sys.isActive() || !b.ready || b.leaving) return { wait: true };
        const room = b.room;
        if (room) {
          if (room.id !== ${JSON.stringify(door)}) {
            const on = room.mat && b.currentTile.x === room.mat.x && b.currentTile.y === room.mat.y;
            if (on) return { key: 'ArrowDown' };
          } else if (room.id === 'pokemon-centre' || room.id === 'brocks-workshop' || room.id === 'bills-cottage') {
            const opens = { 'pokemon-centre': 'boxes', 'brocks-workshop': 'ladder', 'bills-cottage': 'list' }[room.id];
            const tiles = b.place.room.things.find((thing) => thing.opens === opens).tiles;
            const pc = tiles.reduce((low, tile) => (tile.y > low.y ? tile : low));
            var goals = [{ x: pc.x, y: pc.y + 1 }];
            if (b.currentTile.x === pc.x && b.currentTile.y === pc.y + 1) return { key: b.facing === 'up' ? 'Space' : 'ArrowUp' };
          } else {
            const on = b.currentTile.x === room.mat.x && b.currentTile.y === room.mat.y;
            if (on && room.id === 'oaks-lab') return { arrived: true };
            if (on) return { key: 'Space' };
          }
        } else {
          const d = b.doors.find((each) => each.id === ${JSON.stringify(door)});
          if (!d) throw new Error('no base door ' + ${JSON.stringify(door)});
          var goals = d.tiles;
        }
        // A floor with no door mat (upstairs in the player's house) is left by its stairs.
        if (room && !goals) var goals = room.mat ? [room.mat] : room.stairs.map((stair) => stair.tile);
        const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift();
          if (at(x, y)) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
            if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null;
        for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`,
    );
    if (move?.unreachable) throw new Error(`nothing walks to the ${door}`);
    if (move?.arrived) return;
    if (move?.key) {
      await press(move.key);
    }
    await settle(settleMs);
  }
  await until(opened, `the ${door}`);
}

/**
 * In THE RAID ARENA's hall, a walk to one of its panels and the key that opens
 * it: `bench`, `rack` or `locker` from the floor in front of it, `rim` from the
 * nearest tile with the fence beside it. Everything it reads off the scene, so a
 * refurnished hall moves the walk with it. A panel already up is closed first.
 */
export async function openHallPanel(page, panel, options = {}) {
  const press = options.press ?? ((code) => page.tap(code, 60));
  const until = options.until ?? ((expression, what) => page.waitFor(expression, { what }));
  const settle = options.wait ?? sleep;
  const settleMs = options.settleMs ?? 180;
  const showing = `${sceneIs('hub')} && ${GAME}.scene.getScene('hub').view === ${JSON.stringify(panel)}`;
  for (let guard = 0; guard < 160; guard += 1) {
    if (await page.evaluate(showing)) {
      return;
    }
    // A first raid goes over at the rail with no card (\`hub/firstRaid.ts\`).
    if (panel === 'rim' && (await page.evaluate(GOING_OVER))) {
      return;
    }
    if (await page.evaluate(sceneIs('hub'))) {
      await press('Escape');
      await settle(settleMs);
      continue;
    }
    const move = await page.evaluate(
      `(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return { wait: true };
        if (b.dialogBox.visible) return { key: 'Space' };
        const panel = ${JSON.stringify(panel)};
        const station = b.arenaStations.find((each) => each.id === panel);
        const goals = station ? station.tiles.map((tile) => ({ x: tile.x, y: tile.y + 1 })) : b.arenaRim;
        const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        if (at(s.x, s.y)) { if (station && b.facing !== 'up') return { key: 'ArrowUp' }; return { key: 'Space' }; }
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift();
          if (at(x, y)) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null;
        for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`,
    );
    if (move?.unreachable) throw new Error(`nothing walks to the ${panel}`);
    if (move?.key) {
      await press(move.key);
    }
    await settle(settleMs);
  }
  await until(showing, `the ${panel}`);
}

/**
 * From the hall into a raid: to the rim, the way in `insertion` chosen if it is
 * named (the row is only there when there is more than one to choose from), and
 * over the fence. Waits for the raid.
 */
export async function jumpIn(page, { insertion, press, until, wait } = {}) {
  await openHallPanel(page, 'rim', { press, until, wait });
  if (await page.evaluate(GOING_OVER)) {
    await until(sceneIs('world'), 'the raid');
    await until(`!${GAME}.scene.getScene('world').arrival`, 'the landing');
    return;
  }
  if (insertion) {
    await until(
      `(() => { const hub = ${GAME}.scene.getScene('hub'); const id = ${JSON.stringify(insertion)}; if (hub.flow.insertionId === id) return true; if (!hub.offeredWays.some(([way]) => way === id)) return false; hub.pointAtLanding(id); return true; })()`,
      `the rim to offer "${insertion}"`,
    );
  }
  await until(
    `(() => { const b = document.querySelector('button[data-start]'); if (!b) return false; b.click(); return true; })()`,
    'the button that jumps',
  );
  await until(sceneIs('world'), 'the raid');
  // The raid opens with the player falling out of the cloud, and nothing can be
  // pressed or read until they land (`world/raidArrival.ts`).
  await until(`!${GAME}.scene.getScene('world').arrival`, 'the landing');
}

/**
 * From the lab's mat, on to the friend's room: Oak reads the board, and the last
 * thing he asks is whether there is a friend coming (`BaseScene.readTheBoard`).
 * ESC is past what he has to say, and YES is where the cursor starts.
 */
export async function openFriendRoom(page, { press, settle = sleep, settleMs = 180 }) {
  await press('Space');
  for (let guard = 0; guard < 40 && !(await page.evaluate(sceneIs('hub'))); guard += 1) {
    const asking = await page.evaluate(`Boolean(${GAME}.scene.getScene('base')?.boxQuestion)`);
    await press(asking ? 'Space' : 'Escape');
    await settle(settleMs);
  }
  await page.waitFor(sceneIs('hub'), { what: "the friend's room" });
}

/** `--insertion=id [--offered] --beaten=bossId,.. --opened=gateId,.. --completed=contractId,.. --hp=N --level=N --starter=name --team=species,.. --stash=itemId[:n],.. --pack=itemId[:n],.. --secure=itemId[:n],.. --errands=id,..`, out of a driver's arguments. */
export function deployOptions(args) {
  const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const list = (name) => (option(name) ?? '').split(',').filter(Boolean);
  return {
    insertion: option('insertion'),
    // --offered picks the insertion only if the lobby offers it on its own,
    // rather than writing it into the save as walked to: the check that a
    // contract, the chain or a map's opening offers a landing.
    offered: args.includes('--offered'),
    explorer: args.includes('--explorer'),
    beaten: list('beaten'),
    opened: list('opened'),
    stash: list('stash'),
    completed: list('completed'),
    banked: option('banked'),
    debt: option('debt'),
    hp: option('hp'),
    level: option('level'),
    starter: option('starter'),
    team: list('team'),
    stash: list('stash'),
    pack: list('pack'),
    secure: list('secure'),
    errands: list('errands'),
  };
}

/**
 * PLAYTEST on the title, into the harbour of a fresh explorer run. A browser
 * that already holds an explorer save is asked first - CARRY ON or START A
 * FRESH ONE (`playtestMenu`) - and the driver that pressed PLAYTEST once waited
 * on the harbour behind that question until it gave up, so every explorer
 * driver failed the second time it ran in the same browser. A fresh run is what
 * the first time gives, so that is the answer.
 */
export async function startExplorerRun(page, { press, until }) {
  const asked = `${GAME}?.scene.getScene('title')?.menu?.question === 'PLAYTEST RUN'`;
  await press('ArrowDown'); await press('ArrowRight'); await press('Space');
  await until(`${sceneIs('base')} || ${asked}`, "the harbour, or the explorer run's question");
  if (await page.evaluate(asked)) {
    await press('ArrowDown'); await press('Space');
  }
  await until(sceneIs('base'));
}

/**
 * Title, starter, harbour, the Raid Arena's hall, raid. `press`, `click`, `until`
 * and `wait` are the driver's own, because only it knows whether the game is
 * being stepped; `paused` puts the loop to sleep on every load, for a driver
 * that steps it, and so needs the `wait` that steps it (`walkIntoBase` refuses
 * a paused loop without one).
 */
export async function deploy(page, url, { press, click, until, wait, paused = false, insertion, offered = false, explorer = false, beaten = [], opened = [], completed = [], banked, debt, hp, level, starter = 'Bulbasaur', team = [], stash = [], pack = [], secure = [], errands = [] }) {
  const title = async () => { await page.waitFor(sceneIs('title')); if (paused) await page.evaluate(`${GAME}.pauseLoop()`); };
  await title();
  // --explorer is the explorer run (PLAYTEST on the title, beside MAKE A MAP):
  // its own save, every map's landings offered - the one way to a map not yet
  // offered to saves (`MAPS_IN_PROGRESS`) - and its partner a level-99 Charizard.
  if (explorer) {
    await startExplorerRun(page, { press, until });
    // --pack works here too: the explorer's vault holds everything, so a
    // driver can carry a disc in (`--pack=hm04-strength --read=hm04-strength`
    // is Strength: a disc's id is its number and its move, `machines.ts`).
    return enterRaid(page, { press, click, until, wait, insertion, starter: 'Charizard', team: [], pack, secure: [] });
  }
  await press('Space'); await until(sceneIs('base'));
  // Oak's table holds the three starters, and which one is taken is a real
  // variable for anything measured per starter: the Floodplain checkpoint costs
  // a Charmander and a Bulbasaur different numbers of Potions. A driver takes it
  // straight off the table and out into the yard; `starterBalls.mjs` plays the walk.
  await until(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.(${JSON.stringify(starter.toLowerCase())}) === true`,
    `the picker to offer ${starter}`,
  );
  if (insertion || beaten.length > 0 || opened.length > 0 || completed.length > 0 || banked !== undefined || debt !== undefined || hp !== undefined || level !== undefined || team.length > 0 || stash.length > 0 || errands.length > 0) {
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the game to write its save');
    // Every other map's front door is what banking the first contract pays, and a
    // drop-in point is offered to whoever has stood on it. The tool cannot tell
    // which an id is, so the save says both; `availableInsertionIds` reads either.
    // HP is the condition the team came home in, which is a thing a save holds.
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
      p.defeatedBosses = [...new Set([...p.defeatedBosses, ...${JSON.stringify(beaten)}])];
      // The other half of the door state: field-move gates already worked open
      // (\`world/gates.ts\`), so a driver can check that a cut wood is still cut
      // on a raid deployed with nothing that could have cut it.
      p.openedGates = [...new Set([...(p.openedGates ?? []), ...${JSON.stringify(opened)}])];
      p.completedContracts = [...new Set([...p.completedContracts, ...${JSON.stringify(completed)}])];
      // --banked=N is a save N contracts down the standing board, which deals on that count alone.
      if (${banked !== undefined}) p.standingContractsBanked = ${Number(banked)};
      // --debt=ms is a save that has healed on the next raid's clock.
      if (${debt !== undefined}) save.pendingRecoveryMs = ${Number(debt)};
      // --errands=id,.. - those errands asked (\`hub/errands.ts\`), so the raid
      // lays their things: \`--errands=brocks-crate --grab=brocks-crate\`.
      for (const id of ${JSON.stringify(errands)}) { p.errands = [...(p.errands ?? []).filter((e) => e.id !== id), { id, status: 'started', found: 0, lossesHeard: 0 }]; }
      if (${JSON.stringify(offered ? null : (insertion ?? null))}) { p.firstContractExtracted = true; p.reachedInsertions = [...new Set([...p.reachedInsertions, ${JSON.stringify(insertion ?? '')}])]; }
      if (${hp !== undefined}) for (const stored of save.stash.pokemon) stored.pokemon.currentHp = Math.min(stored.pokemon.currentHp, ${Number(hp)});
      // --stash=itemId[:n],.. is a player who has banked supplies. The loadout
      // stepper cannot pack more than the vault holds, so a check that needs a
      // pack filled to its last square has to start from a vault that could
      // fill it - which is how the pack-full refusals are reached at all, and
      // the only way to pack anything a fresh save does not own: an HM off the
      // Bill's table, say, which is the key to a field-move door.
      for (const entry of ${JSON.stringify(stash)}) { const [itemId, count = '1'] = entry.split(':'); save.stash.items[itemId] = Number(count); }
      // A boss is a fight a level-5 starter cannot win, so a driver that has to
      // reach what is behind one deploys a team that could have got there. The
      // saved move list goes with the level: kept, it would be a level-20
      // partner still fighting with its level-1 kit, because the loader only
      // falls back to the learnset when a save names no moves.
      if (${level !== undefined}) for (const stored of save.stash.pokemon) {
        stored.pokemon.level = ${Number(level)};
        stored.pokemon.moves = [];
        stored.pokemon.experience = 0;
        // --hp still holds: a raid lost at a level is --level with --hp=1.
        stored.pokemon.currentHp = ${hp !== undefined ? Number(hp) : 9999};
      }
      // --team=speciesId:level,.. puts more Pokemon in the vault beside the
      // starter, and every one of them is then added to the raid party below.
      // Nothing else here can deploy with two, and a double battle needs two:
      // the engine refuses the second slot when the player has nobody for it,
      // so a driver with one Pokemon plays Holt as a single battle and never
      // sees the thing it was sent to look at. They are appended after the
      // level pass so each keeps the level it was asked for.
      ${JSON.stringify(team)}.forEach((entry, index) => {
        const [speciesId, memberLevel = '10'] = entry.split(':');
        const id = 'playtest-team-' + index;
        save.stash.pokemon.push({ id, pokemon: { speciesId, level: Number(memberLevel), currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } });
        if (Array.isArray(save.stash.boxes) && save.stash.boxes[0]) { save.stash.boxes[0].pokemonIds.push(id); }
      });
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url });
    await title();
    await press('Space'); await until(sceneIs('base'));
    console.log(`continuing from a save with: ${JSON.stringify(await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress`))}`);
  }
  return enterRaid(page, { press, click, until, wait, insertion, starter, team, pack, secure });
}

/** From the harbour into a raid: the Raid Arena, the bench, the rack, the locker, the rim. */
async function enterRaid(page, { press, click, until, wait, insertion, starter, team, pack, secure }) {
  // The lobby is a town now, and everything before a raid is on the floor of
  // the Raid Arena: this walks through its door and up to the bench.
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  await until(takePokemon(starter), `${starter} in the raid party`);
  // Everybody else the vault holds, so a `--team` deploys as a team. The rows
  // carry the stash id they are for, and one already in the raid is
  // `is-selected` - clicking it again would take it back out.
  for (let guard = 0; guard < 6 && team.length > 0; guard += 1) {
    const added = await page.evaluate(
      `(() => { const b = document.querySelector('button[data-pokemon]:not(.is-selected)'); if (!b || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`,
    );
    if (!added) {
      break;
    }
    await sleep(150);
  }
  await openHallPanel(page, 'rack', { press, until, wait });
  // --pack=itemId[:n],.. packs exactly n of a supply by the rack row's own
  // count selector - the minus down to none, then the plus once per unit, so
  // the driver is stopped by exactly what stops a player (`ui/countSelector.ts`).
  // The stash's medicine is packed by default (`DeploymentFlow.packMedicine`),
  // so a driver that clicks straight through deploys with the vault's Potions,
  // and `--pack=potion:0` is how a raid is sent out with none.
  for (const entry of pack) {
    const [itemId, count = '1'] = entry.split(':');
    for (let guard = 0; guard < 99; guard += 1) {
      const removed = await page.evaluate(
        `(() => { const b = document.querySelector('button[data-count-kind="item"][data-count-id=${JSON.stringify(itemId)}][data-count-dir="-1"]'); if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`,
      );
      if (!removed) {
        break;
      }
      await sleep(150);
    }
    for (let i = 0; i < Number(count); i += 1) {
      await until(
        `(() => { const b = document.querySelector('button[data-count-kind="item"][data-count-id=${JSON.stringify(itemId)}][data-count-dir="1"]'); if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`,
        `the pack to take one more ${itemId}`,
      );
      await sleep(150);
    }
  }
  // --secure=itemId[:n],.. takes the secure-slot detour and puts that many
  // squares of each kind into the container, by the row's own stepper rather
  // than by a word on it. It is the only way anything the container protects is
  // checked end to end - and the only way at all for a kind that is *found*
  // rather than packed, whose row is room reserved for something not held yet.
  for (const entry of secure) {
    const [itemId, count = '1'] = entry.split(':');
    if (entry === secure[0]) {
      await openHallPanel(page, 'locker', { press, until, wait });
      // The container fills itself with the party's best Pokemon, and a
      // first-stage one is four squares of the four a save starts with - so a
      // driver asking for gear has to take the Pokemon out first, exactly as a
      // player choosing gear over protection would.
      for (let guard = 0; guard < 6; guard += 1) {
        const removed = await page.evaluate(
          `(() => { const b = document.querySelector('button[data-secure-pokemon].is-secured'); if (!b) return false; b.click(); return true; })()`,
        );
        if (!removed) {
          break;
        }
        await sleep(250);
      }
    }
    for (let i = 0; i < Number(count); i += 1) {
      await until(
        `(() => { const b = document.querySelector('button[data-count-kind="secure"][data-count-id=${JSON.stringify(itemId)}][data-count-dir="1"]'); if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`,
        `the container to take one more ${itemId}`,
      );
      await sleep(250);
    }
  }
  // Where to drop in is chosen at the rim, by the id a row carries, because two
  // rows can share a map's name - and from there it is over the fence.
  await jumpIn(page, { insertion, press, until, wait });
}
