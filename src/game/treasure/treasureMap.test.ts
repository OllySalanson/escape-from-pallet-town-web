import { describe, expect, it } from 'vitest';
import { getBaseMap } from '../base/baseMap';
import { harbourPlaceAt } from '../base/harbourPlaces';
import { HARBOUR_LIFE } from '../base/harbourLife';
import { LOITER_SPOTS } from '../base/generated/harbourBotSpots';
import { BASE_ROOMS, buildRoom, CHART_ROOM_STAIR, CHART_WALL, LIBRARY_CHART_STAIR, MARLOW_LIBRARY_TILE, roomNamed } from '../base/rooms';
import { baseGame } from '../base/baseGames.testkit';
import { TRADER_BERTH_PRICE } from '../hub/trader';
import { Bag, getItemById, packSquares } from '../items';
import { CHARMANDER, PokemonParty } from '../pokemon';
import { generateRunPlan, frontDoorFor } from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS, deserializeGame, SaveManager, serializeGame, type RaidProgress, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash/Stash';
import { getWorldMap } from '../worldMap';
import { builtInFileMap } from '../world/playerMaps';
import { MOST_TRAIL_MONEY } from '../world/raidStake';
import { stepDistances } from '../world/mapStructure';
import { nextReward, openSecrets, raidConditions, secretById, SECRETS, SPENT_NOOK_BERRIES, type RaidConditions } from '../world/secrets';
import { MISTY_BOSS_ID } from '../world/valeQuarters';
import { createPlaytestStash, playtestStock, withoutKitTreasure } from '../dev/playtestSave';
import { TICKET_PRIZES } from '../minigames/tickets';
import { getSpeciesById } from '../pokemon/species';
import { shareLine } from '../ui/dialogBoxes';
import { POKEMON_GIFTS } from '../world/gifts';
import { chartWallPicture } from './chartWall';
import { treasureCross, treasureMark } from './treasureMark';
import {
  BEACH_BOTTLE,
  bottleOnTheBeach,
  CHART_GRID,
  CHART_PIECES,
  PIN_QUESTION,
  chartWhole,
  CHEST_CONTENTS,
  CHEST_ITEM_ID,
  CHEST_POKEMON,
  chartBoardLines,
  chartBoardNote,
  CHART_ROOM_ARRIVAL_LINES,
  chestOpenedLines,
  COAST_SHUT_LINE,
  huntStage,
  marlowLibraryLines,
  marlowRoomLines,
  NO_TREASURE_HUNT,
  pinnedLines,
  PLAYTEST_PIECES_LINE,
  readTreasureHunt,
  TREASURE_GOAL,
  TREASURE_PLACE,
  TREASURE_SECRET_ID,
  treasureGoalLines,
  wholeChartLines,
  type HuntStage,
  type TreasureHunt,
} from './treasureMap';

/**
 * THE TREASURE MAP (`treasureMap.ts`), held to the brief it was built to: every
 * piece can be found, every piece has a slot on the wall and can be pinned in
 * it, the whole chart opens a hidden prize somewhere a raid can walk to, the
 * prize is held to the game's own economy, and saves keep all of it - old ones
 * included.
 */

const VALE = 'greystone-vale';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

function freshSave(progress: Partial<RaidProgress> = {}, items: Readonly<Record<string, number>> = {}) {
  const storage = new MemoryStorage();
  const stash = createStartingStash(CHARMANDER);
  for (const [itemId, quantity] of Object.entries(items)) stash.addItem(itemId, quantity);
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 0, y: 0 },
    bag: new Bag(),
    stash,
    raidProgress: { ...DEFAULT_RAID_PROGRESS, ...progress },
  });
  return new SaveManager(storage);
}

const none = (): number => 0;

describe('the treasure map', () => {
  it('is one chart: a slot on the wall for every piece, and a piece for every slot', () => {
    const slots = CHART_PIECES.map((piece) => `${piece.slot.column},${piece.slot.row}`);
    expect(new Set(slots).size).toBe(CHART_PIECES.length);
    expect(CHART_PIECES.length).toBe(CHART_GRID.columns * CHART_GRID.rows);
    for (const piece of CHART_PIECES) {
      expect(piece.slot.column, piece.id).toBeLessThan(CHART_GRID.columns);
      expect(piece.slot.row, piece.id).toBeLessThan(CHART_GRID.rows);
      expect(new Set(CHART_PIECES.map((each) => each.itemId)).size).toBe(CHART_PIECES.length);
      const item = getItemById(piece.itemId);
      expect(item?.effect, piece.itemId).toEqual({ type: 'relic', to: 'library' });
      expect(piece.pinnedLines.length, piece.id).toBeGreaterThan(0);
    }
    expect(CHART_PIECES.filter((piece) => piece.from.kind === 'beach')).toHaveLength(1);
  });

  describe('every piece can be found', () => {
    it('the first lies on THE BEACH, on open sand nobody stands on, until it is picked up', () => {
      const yard = getBaseMap([]);
      expect(yard.collision[BEACH_BOTTLE.y][BEACH_BOTTLE.x]).toBe(false);
      expect(harbourPlaceAt(BEACH_BOTTLE)?.name).toBe('THE BEACH');
      const occupied = HARBOUR_LIFE.flatMap((figure) => [
        figure.position,
        ...(figure.idle.roam ?? []),
        ...(figure.night ? [figure.night.position, ...(figure.night.idle.roam ?? [])] : []),
      ]);
      expect(occupied.some((tile) => tile.x === BEACH_BOTTLE.x && tile.y === BEACH_BOTTLE.y)).toBe(false);
      expect(LOITER_SPOTS.some(([x, y]) => x === BEACH_BOTTLE.x && y === BEACH_BOTTLE.y)).toBe(false);
      // From the boat the regulars come off, the corner of the beach is walked to.
      const steps = stepDistances(yard.collision, { x: 12, y: 19 }, new Set());
      expect(steps[BEACH_BOTTLE.y][BEACH_BOTTLE.x]).toBeGreaterThan(0);
      expect(bottleOnTheBeach(NO_TREASURE_HUNT, none)).toBe(true);
      expect(bottleOnTheBeach(NO_TREASURE_HUNT, (itemId) => (itemId === 'bottled-chart' ? 1 : 0))).toBe(false);
      expect(bottleOnTheBeach({ ...NO_TREASURE_HUNT, roomOpen: true, pinned: ['shore'] }, none)).toBe(false);
    });

    it.each(CHART_PIECES.filter((piece) => piece.from.kind === 'secret').map((piece) => [piece.id, piece] as const))(
      'the %s piece is a vale secret’s reward',
      (_id, piece) => {
        const secret = piece.from.kind === 'secret' ? secretById(piece.from.secretId) : undefined;
        expect(secret, piece.id).toBeDefined();
        expect(secret!.rewards).toContainEqual({ kind: 'item', itemId: piece.itemId });
      },
    );
  });

  describe('every piece can be placed', () => {
    it('the bottle comes up off the sand once, MARLOW opens the room, and each piece is pinned in one write', () => {
      const saves = freshSave({}, { 'chart-piece-1': 1, 'chart-piece-2': 1, 'chart-piece-3': 1 });
      // Nothing is pinned before MARLOW has opened the room.
      expect(saves.pinChartPiece('moor')).toBeUndefined();
      expect(saves.takeBottledChart()).toBe(true);
      expect(saves.takeBottledChart()).toBe(false);
      const held = (itemId: string): number => saves.load()!.stash.itemCount(itemId);
      expect(held('bottled-chart')).toBe(1);
      expect(huntStage(saves.load()!.raidProgress.treasureHunt ?? NO_TREASURE_HUNT, held)).toBe('first-chart');
      expect(saves.openChartRoom()).toBe(true);
      let hunt: TreasureHunt | undefined;
      for (const piece of CHART_PIECES) {
        hunt = saves.pinChartPiece(piece.id);
        expect(hunt?.pinned, piece.id).toContain(piece.id);
        expect(held(piece.itemId), piece.id).toBe(0);
        // A piece is pinned once.
        expect(saves.pinChartPiece(piece.id)).toBeUndefined();
      }
      expect(chartWhole(hunt!)).toBe(true);
      // Pinned is found: no nook gives a piece on the wall again.
      const found = saves.load()!.raidProgress.secretsFound ?? [];
      for (const piece of CHART_PIECES.filter((each) => each.from.kind === 'secret')) {
        expect(found, piece.itemId).toContain(piece.itemId);
      }
      // And the bottle is not back on the beach.
      expect(bottleOnTheBeach(hunt!, held)).toBe(false);
    });

    it('MARLOW decides the first piece is the player’s, and the last turns the chart into directions', () => {
      const first = pinnedLines(CHART_PIECES[0], { ...NO_TREASURE_HUNT, roomOpen: true, pinned: ['shore'] }, 'Bottled chart', 'CHARMANDER').join(' ');
      expect(first).toContain('you and CHARMANDER');
      expect(first.toLowerCase()).toContain('mighty');
      expect(first).toContain('It is yours');
      const last = pinnedLines(CHART_PIECES[3], { ...NO_TREASURE_HUNT, roomOpen: true, pinned: CHART_PIECES.map((piece) => piece.id) }, 'Torn chart (fold)').join(' ');
      expect(last).toContain(TREASURE_PLACE);
      expect(marlowLibraryLines('no-chart').join(' ')).toContain('THE BEACH');
    });

    it('the board shows a piece where it is pinned and gilds its frame once the chart is whole', () => {
      const area = CHART_WALL;
      const empty = chartWallPicture(undefined, area);
      const one = chartWallPicture({ ...NO_TREASURE_HUNT, roomOpen: true, pinned: ['shore'] }, area);
      const whole = chartWallPicture({ ...NO_TREASURE_HUNT, roomOpen: true, pinned: CHART_PIECES.map((piece) => piece.id) }, area);
      expect([empty.width, empty.height]).toEqual([area.width * 16, area.height * 16]);
      expect(Buffer.from(one.data).equals(Buffer.from(empty.data))).toBe(false);
      // The top-left of the board's trim is plain wood until the chart is whole.
      const at = (picture: typeof empty, x: number, y: number) => [...picture.data.slice((y * picture.width + x) * 4, (y * picture.width + x) * 4 + 3)];
      expect(at(one, 20, 2)).not.toEqual(at(whole, 20, 2));
    });
  });

  describe('the finished map leads to a reachable prize', () => {
    const file = builtInFileMap(VALE)!;
    const nook = file.loot.find((piece) => piece.secret === TREASURE_SECRET_ID)!;

    it('is the vale secret the whole chart opens, and nothing else does', () => {
      const secret = secretById(TREASURE_SECRET_ID)!;
      expect(secret.place).toBe(TREASURE_PLACE);
      expect(secret.rewards).toEqual([{ kind: 'item', itemId: CHEST_ITEM_ID }]);
      const ordinary: RaidConditions = raidConditions(new Date(2026, 10, 7, 12), [], [], false, []);
      expect(openSecrets(ordinary)).not.toContain(TREASURE_SECRET_ID);
      expect(openSecrets({ ...ordinary, chartWhole: true })).toContain(TREASURE_SECRET_ID);
      expect(chartWhole({ ...NO_TREASURE_HUNT, pinned: CHART_PIECES.slice(1).map((piece) => piece.id) })).toBe(false);
    });

    it('lies in SMUGGLERS’ COVE and is walked to from the front door once MISTY is beaten', () => {
      expect(nook).toBeDefined();
      const door = frontDoorFor(VALE)!;
      const shut = getWorldMap(VALE);
      const open = getWorldMap(VALE, [MISTY_BOSS_ID]);
      const steps = (map: typeof open) => stepDistances(map.collision, door.position, new Set(), map.links)[nook.position.y][nook.position.x];
      expect(steps(open)).toBeGreaterThan(0);
      // Behind her sandbags until then: the chart's end is the coast's.
      expect(steps(shut)).toBe(-1);
    });

    it('is laid by a raid that sets out with the whole chart past MISTY, as the chest, and as a berry once the chest is home', () => {
      const whole: RaidConditions = { ...raidConditions(new Date(2026, 10, 7, 12), [], [], true, []) };
      const plan = (found: readonly string[]) =>
        generateRunPlan(7, undefined, 'greystone-vale-moor-top', undefined, undefined, [MISTY_BOSS_ID], undefined, undefined, undefined, undefined, undefined, undefined, {
          conditions: whole,
          known: { secretsFound: found, giftsReceived: [] },
        });
      const laid = (found: readonly string[]) => (plan(found).loot[VALE] ?? []).filter((piece) => piece.secret === TREASURE_SECRET_ID);
      expect(laid([]).map((piece) => piece.itemId)).toEqual([CHEST_ITEM_ID]);
      expect(laid([]).map((piece) => piece.position)).toEqual([nook.position]);
      expect(nextReward(secretById(TREASURE_SECRET_ID)!, { secretsFound: [CHEST_ITEM_ID], giftsReceived: [] })).toBeUndefined();
      expect(SPENT_NOOK_BERRIES).toContain(laid([CHEST_ITEM_ID])[0].itemId);
    });

    it('opens in THE CHART ROOM once, into the vault, and stands there empty after', () => {
      const pinned = CHART_PIECES.map((piece) => piece.id);
      const saves = freshSave({ treasureHunt: { roomOpen: true, pinned, chestOpened: false } }, { [CHEST_ITEM_ID]: 1 });
      const before = saves.load()!.stash;
      const had = Object.fromEntries(CHEST_CONTENTS.map(({ itemId }) => [itemId, before.itemCount(itemId)]));
      expect(huntStage(saves.load()!.raidProgress.treasureHunt!, (itemId) => before.itemCount(itemId))).toBe('chest');
      expect(saves.openSeaChest()).toBe(true);
      expect(saves.openSeaChest()).toBe(false);
      const after = saves.load()!;
      expect(after.stash.itemCount(CHEST_ITEM_ID)).toBe(0);
      for (const { itemId, quantity } of CHEST_CONTENTS) {
        expect(after.stash.itemCount(itemId), itemId).toBe(had[itemId] + quantity);
      }
      expect(after.raidProgress.treasureHunt?.chestOpened).toBe(true);
      expect(after.raidProgress.secretsFound).toContain(CHEST_ITEM_ID);
      expect(huntStage(after.raidProgress.treasureHunt!, (itemId) => after.stash.itemCount(itemId))).toBe('done');
      const room = buildRoom(roomNamed('chart-room')!, after, new Date(2026, 10, 7));
      expect(room.things.map((thing) => thing.name)).toContain('THE SEA CHEST');
      expect(chestOpenedLines((itemId) => getItemById(itemId)?.displayName ?? itemId).join(' ')).toContain('₽600');
    });
  });

  describe('is held to the game', () => {
    /**
     * Measured against what the vale already pays. A raid's trail pays at most
     * `MOST_TRAIL_MONEY` (₽145) and a berth costs ₽250: the chest is a hunt's
     * worth of raids and then some - more than two berths, never more than
     * five raids' most - so it is a reward, never a faucet (it opens once).
     */
    it('pays a few raids’ worth of money, once', () => {
      const money = CHEST_CONTENTS.find((stack) => stack.itemId === 'money')!.quantity;
      expect(money).toBeGreaterThanOrEqual(2 * TRADER_BERTH_PRICE);
      expect(money).toBeLessThanOrEqual(5 * MOST_TRAIL_MONEY);
    });

    /**
     * The Hauler frame is the biggest pack there is, and the one the vale's
     * raids never lay: its best find is a Ranger pack in THE DROWNED TOWN. It
     * is the hunt's prize for that reason, and a pack is lost with everything
     * in it on a wipe, so it is a fortune to carry and a fortune to lose.
     */
    it('gives the one pack the vale never lays, and nothing a contract or shelf may hand out', () => {
      const packs = CHEST_CONTENTS.filter((stack) => getItemById(stack.itemId)?.effect.type === 'pack');
      expect(packs.map((stack) => stack.itemId)).toEqual(['hauler-frame']);
      expect(packSquares('hauler-frame')).toBeGreaterThan(packSquares('ranger-pack'));
      for (const { itemId } of CHEST_CONTENTS) {
        expect(['currency', 'pack', 'capture-modifier'].includes(getItemById(itemId)?.effect.type ?? ''), itemId).toBe(true);
      }
    });

    it('is a chest to carry home: four squares, found-only and lost with the pack', () => {
      const chest = getItemById(CHEST_ITEM_ID)!;
      expect(chest.footprint).toEqual({ width: 2, height: 2 });
      expect(chest.effect.type).toBe('relic');
      expect(SECRETS.find((secret) => secret.id === TREASURE_SECRET_ID)?.wave).toBe(2);
    });
  });

  describe('saves', () => {
    it('keep the hunt, and read an old save that never heard of it as a hunt not begun', () => {
      const game = baseGame({ progress: { treasureHunt: { roomOpen: true, pinned: ['shore', 'moor'], chestOpened: false } } });
      const back = deserializeGame(JSON.parse(JSON.stringify(serializeGame(game))));
      expect(back?.raidProgress.treasureHunt).toEqual({ roomOpen: true, pinned: ['shore', 'moor'], chestOpened: false });
      const old = baseGame();
      const oldBack = deserializeGame(JSON.parse(JSON.stringify(serializeGame(old))));
      expect(oldBack?.raidProgress.treasureHunt).toBeUndefined();
      expect(huntStage(oldBack!.raidProgress.treasureHunt ?? NO_TREASURE_HUNT, none)).toBe('no-chart');
    });

    it('believe nothing in a saved hunt they do not recognise', () => {
      expect(readTreasureHunt(null)).toBeUndefined();
      expect(readTreasureHunt([])).toBeUndefined();
      expect(readTreasureHunt({ pinned: ['shore', 'shore', 'atlantis', 3], chestOpened: true })).toEqual({
        roomOpen: true,
        pinned: ['shore'],
        // A chest is never open on a chart that is not whole.
        chestOpened: false,
      });
    });
  });

  describe('the rooms', () => {
    it('the library’s end bookcase is shut until MARLOW opens it, then is the way through', () => {
      const library = roomNamed('great-library')!;
      const shut = buildRoom(library, baseGame(), new Date(2026, 10, 7));
      expect(shut.collision[LIBRARY_CHART_STAIR.y][LIBRARY_CHART_STAIR.x]).toBe(true);
      expect(shut.things.some((thing) => thing.does === 'chart-keeper' && thing.tiles.some((tile) => tile.x === MARLOW_LIBRARY_TILE.x))).toBe(true);
      const open = buildRoom(library, baseGame({ progress: { treasureHunt: { roomOpen: true, pinned: [], chestOpened: false } } }), new Date(2026, 10, 7));
      expect(open.collision[LIBRARY_CHART_STAIR.y][LIBRARY_CHART_STAIR.x]).toBe(false);
      // An arch, gone through by a push up into the wall it is cut in, and the chart room's back the same way (playtest 51, finding 10).
      expect(library.stairs).toEqual([{ tile: LIBRARY_CHART_STAIR, to: 'chart-room', push: { key: 'up', says: 'THE CHART ROOM' } }]);
      expect(roomNamed('chart-room')!.stairs.map((stair) => stair.push)).toEqual([{ key: 'up', says: 'OUT' }]);
      // From the runner, the arch is walked to.
      const steps = stepDistances(open.collision, library.mat!, new Set());
      expect(steps[LIBRARY_CHART_STAIR.y][LIBRARY_CHART_STAIR.x]).toBeGreaterThan(0);
    });

    it('THE CHART ROOM is walked about from its arch to the board and to MARLOW', () => {
      const room = roomNamed('chart-room')!;
      expect(BASE_ROOMS).toContain(room);
      const built = buildRoom(room, baseGame({ progress: { treasureHunt: { roomOpen: true, pinned: [], chestOpened: true } } }), new Date(2026, 10, 7));
      expect(built.collision[CHART_ROOM_STAIR.y][CHART_ROOM_STAIR.x]).toBe(false);
      const steps = stepDistances(built.collision, CHART_ROOM_STAIR, new Set());
      for (const name of ['THE CHART', 'MARLOW']) {
        const thing = built.things.find((each) => each.name === name)!;
        const faced = thing.tiles.flatMap((tile) => [
          { x: tile.x, y: tile.y + 1 },
          { x: tile.x - 1, y: tile.y },
          { x: tile.x + 1, y: tile.y },
        ]);
        expect(faced.some((tile) => (steps[tile.y]?.[tile.x] ?? -1) > 0), name).toBe(true);
      }
    });
  });
});

/** The harbour's dialogue box: two rows of about 38 characters, wrapped a word at a time (`ui/dialogBoxes.test.ts`). */
function boxesOf(line: string): number {
  const wrap = (text: string): string[] => {
    const rows: string[] = [];
    for (const word of text.split(' ')) {
      const last = rows[rows.length - 1];
      if (last !== undefined && `${last} ${word}`.length <= 38) rows[rows.length - 1] = `${last} ${word}`;
      else rows.push(word);
    }
    return rows;
  };
  return shareLine(line, 2, wrap).length;
}

describe('the hunt is said in few words', () => {
  const every = CHART_PIECES.map((piece) => piece.id);
  const name = (itemId: string): string => getItemById(itemId)?.displayName ?? itemId;
  const after = (count: number): TreasureHunt => ({ ...NO_TREASURE_HUNT, roomOpen: true, pinned: every.slice(0, count) });
  const pinning = CHART_PIECES.map((piece, index) => pinnedLines(piece, after(index + 1), name(piece.itemId), 'CHARMANDER'));
  const stages: readonly HuntStage[] = ['no-chart', 'first-chart', 'pinning', 'whole', 'chest', 'done'];
  const said: readonly string[] = [
    ...pinning.flat(),
    ...pinnedLines(CHART_PIECES[3], after(4), name(CHART_PIECES[3].itemId), 'CHARMANDER', false),
    ...wholeChartLines(false),
    ...treasureGoalLines(),
    ...CHART_ROOM_ARRIVAL_LINES,
    ...stages.flatMap((stage) => [...marlowRoomLines(stage, after(1)), ...marlowRoomLines(stage, after(4), false)]),
    ...[0, 1, 4].flatMap((count) => chartBoardLines(after(count), false)),
    ...chartBoardLines({ ...after(4), chestOpened: true }),
    ...chestOpenedLines(name),
    PLAYTEST_PIECES_LINE,
  ];

  it.each([...new Set(said)])('one box holds: %s', (line) => {
    // The owner's playtest of 12 Nov 2026: pinning the first piece took fifteen boxes.
    expect(boxesOf(line)).toBe(1);
  });

  it('pins a piece in a handful of boxes: five for the first and the last, three for the rest', () => {
    expect(pinning.map((lines) => lines.length)).toEqual([5, 3, 3, 5]);
    expect(pinnedLines(CHART_PIECES[3], after(4), name(CHART_PIECES[3].itemId), undefined, false)).toHaveLength(6);
  });

  it('says where to go and what you get the moment the chart is whole, and everywhere after', () => {
    for (const lines of [pinning[3], marlowRoomLines('whole', after(4)), chartBoardLines(after(4)), treasureGoalLines()]) {
      const words = lines.join(' ');
      expect(words).toContain(TREASURE_PLACE);
      expect(words).toContain(TREASURE_GOAL.spot);
      expect(words).toContain(TREASURE_GOAL.prize);
      expect(words).not.toContain('MISTY');
    }
    // A save that cannot walk into the cove yet is told who is in the way.
    expect(treasureGoalLines(false)).toContain(COAST_SHUT_LINE);
    expect(COAST_SHUT_LINE).toContain('MISTY');
    expect(chartBoardNote(after(4))).toBe('Whole. Dig at the X');
    expect(chartBoardNote(after(2))).toBe('2 of 4 pieces pinned');
    // Before it is whole, nothing names the place the chart has not shown yet.
    expect(chartBoardLines(after(1)).join(' ')).not.toContain(TREASURE_PLACE);
  });
});

describe('the X on the telescope', () => {
  const every = CHART_PIECES.map((piece) => piece.id);
  const nook = builtInFileMap(VALE)!.loot.find((piece) => piece.secret === TREASURE_SECRET_ID)!;
  const game = (hunt: TreasureHunt | undefined, items: Readonly<Record<string, number>> = {}, defeatedBosses: readonly string[] = []) =>
    freshSave({ ...(hunt ? { treasureHunt: hunt } : {}), defeatedBosses }, items).load()!;
  const whole: TreasureHunt = { roomOpen: true, pinned: every, chestOpened: false };

  it('is not there until the chart is whole', () => {
    expect(treasureMark(VALE, game(undefined))).toBeUndefined();
    expect(treasureMark(VALE, game({ ...whole, pinned: every.slice(1) }))).toBeUndefined();
  });

  it('stands on the very tile the chest is under, and says the goal', () => {
    const mark = treasureMark(VALE, game(whole, {}, [MISTY_BOSS_ID]))!;
    expect(mark.tile).toEqual(nook.position);
    expect(mark.title).toBe(TREASURE_GOAL.title);
    expect(mark.lines.join(' ')).toContain(TREASURE_PLACE);
    expect(mark.lines.join(' ')).toContain(TREASURE_GOAL.prize);
    expect(mark.lines.join(' ')).not.toContain('MISTY');
    // Until MISTY is beaten, it says who holds the way in.
    expect(treasureMark(VALE, game(whole))!.lines).toContain(COAST_SHUT_LINE);
    expect(treasureCross().some((square) => square.ink === 'cross' && square.x === 0 && square.y === 0)).toBe(true);
  });

  it('comes off once the chest is home, and stays off once it is opened', () => {
    expect(treasureMark(VALE, game(whole, { [CHEST_ITEM_ID]: 1 }))).toBeUndefined();
    expect(treasureMark(VALE, game({ ...whole, chestOpened: true }))).toBeUndefined();
  });
});

describe('the X leads to a rare find', () => {
  it('hands over the one EEVEE there is, in the same write as the chest’s kit', () => {
    const pinned = CHART_PIECES.map((piece) => piece.id);
    const saves = freshSave({ treasureHunt: { roomOpen: true, pinned, chestOpened: false } }, { [CHEST_ITEM_ID]: 1 });
    const kinds = () => saves.load()!.stash.listPokemon().map((stored) => stored.pokemon.base.id);
    expect(kinds()).not.toContain(CHEST_POKEMON.speciesId);
    expect(saves.openSeaChest()).toBe(true);
    const found = saves.load()!.stash.listPokemon().find((stored) => stored.pokemon.base.id === CHEST_POKEMON.speciesId)!;
    expect(found.pokemon.level).toBe(CHEST_POKEMON.level);
    // Once: a second try gives nothing.
    expect(saves.openSeaChest()).toBe(false);
    expect(kinds().filter((kind) => kind === CHEST_POKEMON.speciesId)).toHaveLength(1);
    const name = getSpeciesById(CHEST_POKEMON.speciesId)!.name.toUpperCase();
    expect(chestOpenedLines((itemId) => getItemById(itemId)?.displayName ?? itemId, name).join(' ')).toContain(`${name} came out!`);
  });

  it('is a kind the vale lays nowhere and nobody else gives', () => {
    const species = getSpeciesById(CHEST_POKEMON.speciesId);
    expect(species).toBeDefined();
    // No grass, water, floor, standing Pokemon or trainer of the vale has one.
    expect(JSON.stringify(builtInFileMap(VALE)!.file)).not.toContain(`"${CHEST_POKEMON.speciesId}"`);
    expect(POKEMON_GIFTS.map((gift) => gift.speciesId)).not.toContain(CHEST_POKEMON.speciesId);
    expect(TICKET_PRIZES.flatMap((prize) => (prize.gives.kind === 'pokemon' ? [prize.gives.speciesId] : []))).not.toContain(CHEST_POKEMON.speciesId);
    expect(SECRETS.flatMap((secret) => secret.rewards.flatMap((reward) => (reward.kind === 'meet' ? [reward.speciesId] : reward.kind === 'gift' ? [reward.gift.speciesId] : [])))).not.toContain(CHEST_POKEMON.speciesId);
  });
});

describe('the explorer run and the treasure map', () => {
  const every = CHART_PIECES.map((piece) => piece.id);

  it('is dealt one of each piece and no chest, so the whole chart still sends it to the X', () => {
    const stash = createPlaytestStash();
    for (const piece of CHART_PIECES) {
      expect(stash.itemCount(piece.itemId), piece.itemId).toBe(1);
      expect(playtestStock(piece.itemId)).toBe(1);
    }
    expect(stash.itemCount(CHEST_ITEM_ID)).toBe(0);
    // Everything else is still stocked.
    expect(stash.itemCount('potion')).toBe(playtestStock('potion'));
    expect(playtestStock('potion')).toBeGreaterThan(1);
    // Every piece pinned: the hunt is at "go and dig", not at a chest nobody dug up.
    const held = (itemId: string): number => (every.some((id) => CHART_PIECES.find((piece) => piece.id === id)!.itemId === itemId) ? 0 : stash.itemCount(itemId));
    expect(huntStage({ roomOpen: true, pinned: every, chestOpened: false }, held)).toBe('whole');
    expect(PLAYTEST_PIECES_LINE).toContain('PLAYTEST');
  });

  it('takes the old kit’s twenty of everything back out of a run kept from before', () => {
    const stash = createPlaytestStash();
    for (const piece of CHART_PIECES) stash.addItem(piece.itemId, 19);
    stash.addItem(CHEST_ITEM_ID, 20);
    // Two pieces already on the board: those are out of the vault for good.
    expect(withoutKitTreasure(stash, ['shore', 'moor'])).toBe(true);
    expect(CHART_PIECES.map((piece) => stash.itemCount(piece.itemId))).toEqual([0, 0, 1, 1]);
    expect(stash.itemCount(CHEST_ITEM_ID)).toBe(0);
    // And a run that is already right is left alone.
    expect(withoutKitTreasure(stash, ['shore', 'moor'])).toBe(false);
  });

  it('keeps a chest the run dug up itself', () => {
    const dug = createPlaytestStash();
    dug.addItem(CHEST_ITEM_ID, 1);
    expect(withoutKitTreasure(dug, every)).toBe(true);
    expect(dug.itemCount(CHEST_ITEM_ID)).toBe(1);
    // One more than the kit dealt is the kit's twenty and the run's own.
    const both = createPlaytestStash();
    both.addItem(CHEST_ITEM_ID, 21);
    withoutKitTreasure(both, every);
    expect(both.itemCount(CHEST_ITEM_ID)).toBe(1);
  });
});

describe("THE CHART ROOM board's question", () => {
  it('fits one line of the box, so it never lies over its own answers', () => {
    // The box's line holds a little over thirty capitals; the piece is named on the line before.
    expect(PIN_QUESTION.length).toBeLessThanOrEqual(24);
    for (const piece of CHART_PIECES) {
      expect(PIN_QUESTION).not.toContain(piece.itemId.toUpperCase());
    }
  });
});
