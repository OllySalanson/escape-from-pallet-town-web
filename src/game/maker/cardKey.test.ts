import { afterEach, describe, expect, it } from 'vitest';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { ITEMS } from '../items/items';
import {
  buildPlayerMap,
  CARD_KEY_CHANCE,
  itemSpotContents,
  MAP_FILE_EXIT_KEY,
  readMapFile,
  type MapFile,
} from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { registerPlayerMap, unregisterPlayerMap } from '../world/playerMaps';
import { extractionCaption, isBarredExit, isExtractionAvailable, itemThatOpens } from '../world/extractionPoints';
import { blankMap, placeSpot, setExitOpens, setItemHidden, setItemHoldsKey } from './draft';

/** A front door, a way out, a second exit to lock, and three item spots. */
function lockedMap(): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Card Key'), maker: 'Tester' };
  for (const [kind, at] of [
    ['drop-in', { x: 4, y: 4 }],
    ['exit', { x: 25, y: 15 }],
    ['exit', { x: 20, y: 4 }],
    ['item', { x: 8, y: 8 }],
    ['item', { x: 10, y: 12 }],
    ['item', { x: 14, y: 6 }],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    if (!outcome.placed) {
      throw new Error(outcome.reason);
    }
    file = outcome.file;
  }
  return setItemHoldsKey(setExitOpens(file, 1, { when: 'key' }), 1, true);
}

const problemsOf = (file: MapFile, id: string): readonly string[] =>
  checkMapFile(file).find((check) => check.id === id)!.problems;

const registered: string[] = [];
afterEach(() => {
  for (const id of registered.splice(0)) {
    unregisterPlayerMap(id as never);
  }
});

describe('an exit locked to the Card Key', () => {
  it('is written to the file, and opens only to the Card Key, as a shipped map key exit does', () => {
    const file = lockedMap();
    expect(file.exits[1].opens).toEqual({ when: 'key' });
    expect(file.itemSpots[1]).toEqual({ x: 10, y: 12, key: true });
    expect(readMapFile(file).ok).toBe(true);
    const locked = buildPlayerMap(file).exits[1];
    expect(locked.requirement).toEqual({ kind: 'key', keyId: MAP_FILE_EXIT_KEY });
    expect(isBarredExit(locked)).toBe(true);
    expect(itemThatOpens(locked)).toBe('card-key');
    expect(isExtractionAvailable(locked, 999_000, new Set())).toBe(false);
    expect(isExtractionAvailable(locked, 0, new Set(), new Set([locked.label]))).toBe(true);
    expect(extractionCaption(locked, false, 0)).toBe(`${locked.label}\nLOCKED: CARD KEY`);
    expect(ITEMS['card-key'].effect).toEqual({ type: 'key' });
  });

  it('is never the way out, because nobody has to find the card either', () => {
    const file = lockedMap();
    expect(problemsOf(file, 'way-out')).toEqual([]);
    const onlyLocked = setExitOpens(file, 0, { when: 'key' });
    expect(problemsOf(onlyLocked, 'way-out')).toEqual([
      'Drop-in 1 cannot walk to any exit without the Card Key.',
    ]);
  });

  it('comes with somewhere its card lies, and a card comes with a lock', () => {
    expect(problemsOf(lockedMap(), 'reachable')).toEqual([]);
    expect(problemsOf(setItemHoldsKey(lockedMap(), 1, false), 'reachable')).toEqual([
      'Exit 2 at 20,4 is locked to the Card Key, and no item spot holds one.',
    ]);
    expect(problemsOf(setExitOpens(lockedMap(), 1, { when: 'always' }), 'reachable')).toEqual([
      'Item spot 2 at 10,12 holds a Card Key no exit or door is locked to.',
    ]);
  });

  it('lays its card as a prize on its own spot, and every other spot holds what it always did', () => {
    const file = lockedMap();
    const loot = buildPlayerMap(file).loot;
    expect(loot[1]).toMatchObject({ itemId: 'card-key', quantity: 1, chance: CARD_KEY_CHANCE });
    // The spots either side keep the rotation's first two turns.
    expect([loot[0], loot[2]].map((piece) => piece.itemId)).toEqual([
      itemSpotContents(0).itemId,
      itemSpotContents(1).itemId,
    ]);
    // A spot inside a district is seated in it, as a shipped key is.
    const districted = buildPlayerMap({
      ...file,
      districts: [{ name: 'Yard', x: 8, y: 10, width: 6, height: 6 }],
    });
    expect(districted.loot[1].district).toBe(`${districted.id}/district-1`);
  });

  it('lies on its own spot in the raids whose odds come up, and nowhere in the rest', () => {
    const map = buildPlayerMap(lockedMap());
    registerPlayerMap(map);
    registered.push(map.id);
    const insertion = frontDoorFor(map.id)!.id;
    const raids = Array.from({ length: 60 }, (_, seed) => generateRunPlan(seed + 1, undefined, insertion));
    const cards = raids.flatMap((plan) => plan.loot[map.id].filter((piece) => piece.itemId === 'card-key'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(raids.length);
    expect(cards.every((piece) => piece.position.x === 10 && piece.position.y === 12)).toBe(true);
  });

  it('keeps the card when the spot is hidden, and the hiding when the card is taken off', () => {
    const hidden = setItemHidden(lockedMap(), 1, true);
    expect(hidden.itemSpots[1]).toEqual({ x: 10, y: 12, hidden: true, key: true });
    expect(setItemHoldsKey(hidden, 1, false).itemSpots[1]).toEqual({ x: 10, y: 12, hidden: true });
  });
});
