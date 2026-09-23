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

/**
 * Walks the base to one of its four doors and goes in.
 *
 * The lobby used to be a screen with four cards on it, so every driver here
 * reached a base screen by clicking `button[data-view=...]`. It is a map now
 * (`src/game/scenes/BaseScene.ts`): the screens are unchanged and what changed
 * is that you walk to them. The route is worked out over the scene's own
 * collision and the scene's own door list rather than typed here, so a redrawn
 * base moves the walk with it.
 *
 * `door` is a `BASE_DOORS` id: `oaks-lab`, `pokemon-centre`, `brocks-workshop`
 * or `the-quay`. The quay has no door - Bill is the way in - so the walk ends
 * beside him and presses the interact key.
 */
export async function walkIntoBase(page, door, options = {}) {
  const press = options.press ?? ((code) => page.tap(code, 60));
  const until = options.until ?? ((expression, what) => page.waitFor(expression, { what }));
  const settleMs = options.settleMs ?? 180;
  await until(sceneIs('base'), 'the base');
  const target = await page.evaluate(
    `(() => { const b = ${GAME}.scene.getScene('base');
      const d = b.doors.find((door) => door.id === ${JSON.stringify(door)});
      if (!d) throw new Error('no base door ' + ${JSON.stringify(door)});
      return { tiles: d.tiles, keeper: d.keeper.position }; })()`,
  );
  if (!target) throw new Error(`no base door ${door}`);
  // A door is walked onto; a keeper is walked up to and spoken to.
  const goals = target.tiles.length > 0 ? target.tiles : [target.keeper];
  const speakTo = target.tiles.length === 0 ? target.keeper : null;
  for (let guard = 0; guard < 80; guard += 1) {
    if (await page.evaluate(sceneIs('hub'))) {
      return;
    }
    const move = await page.evaluate(
      `(() => { const b = ${GAME}.scene.getScene('base'); if (!b) return { gone: true };
        const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
        const goals = ${JSON.stringify(goals)};
        const speak = ${JSON.stringify(speakTo)};
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        if (speak && Math.abs(s.x - speak.x) + Math.abs(s.y - speak.y) === 1) {
          return { face: speak.x > s.x ? 'ArrowRight' : speak.x < s.x ? 'ArrowLeft' : speak.y > s.y ? 'ArrowDown' : 'ArrowUp' };
        }
        const blocked = (x, y) => b.isBlocked({ x, y });
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        // Standing beside the keeper counts as arriving, because that is where
        // a player stops to speak to somebody.
        const done = (x, y) => (speak ? Math.abs(x - speak.x) + Math.abs(y - speak.y) === 1 : at(x, y));
        if (done(s.x, s.y)) return { arrived: true };
        while (queue.length) { const [x, y] = queue.shift();
          if (done(x, y)) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
            if (!done(nx, ny) && blocked(nx, ny)) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true };
        let cur = found, key = null;
        for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`,
    );
    if (move?.gone) return;
    if (move?.unreachable) throw new Error(`nothing walks to the ${door} from the base spawn`);
    if (move?.face) {
      await press(move.face);
      await sleep(settleMs);
      await press('Space');
      await sleep(settleMs);
      continue;
    }
    if (move?.arrived) {
      await press('Space');
      await sleep(settleMs);
      continue;
    }
    await press(move.key);
    await sleep(settleMs);
  }
  await until(sceneIs('hub'), `the ${door}`);
}

/** `--insertion=id --beaten=bossId,.. --opened=gateId,.. --completed=contractId,.. --hp=N --level=N --starter=name --team=species,.. --stash=itemId[:n],.. --pack=itemId[:n],.. --secure=itemId[:n],..`, out of a driver's arguments. */
export function deployOptions(args) {
  const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const list = (name) => (option(name) ?? '').split(',').filter(Boolean);
  return {
    insertion: option('insertion'),
    beaten: list('beaten'),
    opened: list('opened'),
    stash: list('stash'),
    completed: list('completed'),
    hp: option('hp'),
    level: option('level'),
    starter: option('starter'),
    team: list('team'),
    stash: list('stash'),
    pack: list('pack'),
    secure: list('secure'),
  };
}

/**
 * Title, starter, lobby, loadout, final check, raid. `press`, `click` and `until`
 * are the driver's own, because only it knows whether the game is being stepped;
 * `paused` puts the loop to sleep on every load, for a driver that steps it.
 */
export async function deploy(page, url, { press, click, until, paused = false, insertion, beaten = [], opened = [], completed = [], hp, level, starter = 'Bulbasaur', team = [], stash = [], pack = [], secure = [] }) {
  const title = async () => { await page.waitFor(sceneIs('title')); if (paused) await page.evaluate(`${GAME}.pauseLoop()`); };
  await title();
  await press('Space'); await until(sceneIs('starter'));
  // The picker's three cards are the three starters, and which one is taken is
  // a real variable for anything measured per starter: the Floodplain
  // checkpoint costs a Charmander and a Bulbasaur different numbers of Potions.
  // The card is chosen by its own `data-starter`, because the confirm button is
  // lettered with whichever one is selected and so cannot be found by name
  // before it is.
  await until(
    `(() => { const b = document.querySelector('button[data-starter=${JSON.stringify(starter.toLowerCase())}]'); if (!b) return false; b.click(); return true; })()`,
    `the picker to offer ${starter}`,
  );
  await click(`Confirm ${starter}`);
  if (insertion || beaten.length > 0 || opened.length > 0 || completed.length > 0 || hp !== undefined || level !== undefined || team.length > 0 || stash.length > 0) {
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
      if (${JSON.stringify(insertion ?? null)}) { p.firstContractExtracted = true; p.reachedInsertions = [...new Set([...p.reachedInsertions, ${JSON.stringify(insertion ?? '')}])]; }
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
        stored.pokemon.currentHp = 9999;
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
  // The lobby is a town now, and preparation is done inside Oak's Lab.
  await walkIntoBase(page, 'oaks-lab', { press, until });
  await click('Start a raid');
  await click(starter);
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
  // --pack=itemId[:n],.. packs exactly n of a supply by the loadout row's own
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
      await click('Secure slot');
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
  if (secure.length > 0) {
    await click('Back to loadout');
  }
  // Where to drop in is its own step, after the loadout: the row is clicked on
  // that screen, by the id it carries, because two rows can share a map's name.
  await click('Choose drop-in');
  if (insertion) {
    await until(`(() => { const b = document.querySelector('button[data-insertion=${JSON.stringify(insertion)}]'); if (!b) return false; b.click(); return true; })()`, `the lobby to offer insertion "${insertion}"`);
  }
  for (const label of ['Review & deploy', 'Enter the raid']) await click(label);
  await until(sceneIs('world'));
}
