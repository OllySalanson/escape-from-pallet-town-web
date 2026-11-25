import { describe, expect, it } from 'vitest';
import { checkCutscene, CutscenePlayer, cutsceneTimedMs, CUTSCENE_TIMED_CAP_MS, PLAYER_ACTOR } from '../cutscene/cutscene';
import type { GridPosition } from '../movement/gridMovement';
import {
  chargingGuard,
  facingToward,
  guardChargeCutscene,
  guardChargeLines,
  guardBeatenLine,
  guardedCaptionLine,
  guardFightHint,
  guardHint,
  guardHopLift,
  hoardTaken,
  rewardThisRaid,
  GUARD_WATCH_HOP_MS,
  guardReach,
  guardReaches,
  watchingGuard,
  type Guard,
} from './guards';

const open = () => false;
const GASTLY: Guard = { id: 'vale/pokemon-1', position: { x: 10, y: 10 }, species: 'gastly', level: 12, guards: { poiId: 'vale/landmark-1', key: 'vale/sailors-rest', name: 'Sailors’ Rest' } };

describe('a guard’s reach', () => {
  it('is the eight tiles round it, diagonals included, and never its own', () => {
    expect(guardReach(GASTLY.position, open)).toHaveLength(8);
    expect(guardReaches(GASTLY.position, GASTLY.position, open)).toBe(false);
    expect(guardReaches(GASTLY.position, { x: 11, y: 11 }, open)).toBe(true);
    expect(guardReaches(GASTLY.position, { x: 12, y: 10 }, open)).toBe(false);
  });

  it('does not reach round the corner of a wall', () => {
    // Both tiles between it and the diagonal are solid: that tile is on the other side of something.
    const walls = new Set(['11,10', '10,11']);
    const isBlocked = (tile: GridPosition) => walls.has(`${tile.x},${tile.y}`);
    expect(guardReaches(GASTLY.position, { x: 11, y: 11 }, isBlocked)).toBe(false);
    // One of them open is a way round, and it reaches.
    const one = (tile: GridPosition) => tile.x === 11 && tile.y === 10;
    expect(guardReaches(GASTLY.position, { x: 11, y: 11 }, one)).toBe(true);
  });

  it('charges a player who steps beside it, and watches one three steps from its reach', () => {
    expect(chargingGuard([GASTLY], { x: 9, y: 9 }, open)?.id).toBe(GASTLY.id);
    expect(chargingGuard([GASTLY], { x: 8, y: 10 }, open)).toBeUndefined();
    expect(watchingGuard([GASTLY], { x: 7, y: 12 }, open)?.id).toBe(GASTLY.id);
    expect(watchingGuard([GASTLY], { x: 5, y: 10 }, open)).toBeUndefined();
  });

  it('watches only a player who could walk up to it', () => {
    // A wall between them all the way along: three tiles off as the crow flies, a long way round.
    const wall = (tile: GridPosition) => tile.y === 12 && tile.x > -20 && tile.x < 40;
    expect(watchingGuard([GASTLY], { x: 10, y: 13 }, open)?.id).toBe(GASTLY.id);
    expect(watchingGuard([GASTLY], { x: 10, y: 13 }, wall)).toBeUndefined();
  });
});

describe('a guard’s charge', () => {
  it('says who it is and what it guards', () => {
    expect(guardChargeLines(GASTLY)).toEqual([
      'GASTLY: Gast gast!',
      'The wild GASTLY is guarding SAILORS’ REST. It will not let you near!',
    ]);
    expect(guardChargeLines(GASTLY, true)).toEqual(['The GASTLY will not let you near SAILORS’ REST!']);
    expect(guardHint(GASTLY)).toBe('GASTLY Lv 12 GUARDS SAILORS’ REST');
    expect(guardedCaptionLine(GASTLY, 'Water Stone')).toBe('GASTLY Lv 12 HAS A WATER STONE');
    // Once this save has carried the stone home, the caption names only the guard.
    expect(guardedCaptionLine(GASTLY, undefined)).toBe('GUARDED BY GASTLY Lv 12');
    expect(guardFightHint(GASTLY)).toBe('[SPACE] FIGHT GASTLY Lv 12');
    expect(guardBeatenLine('gastly', 'Sailors’ Rest', 'Water Stone')).toBe(
      'The GASTLY has given up SAILORS’ REST, and the WATER STONE it was sitting on!',
    );
    expect(guardBeatenLine('gastly', 'Sailors’ Rest', undefined)).toBe('The GASTLY has given up SAILORS’ REST.');
  });

  it('is a beat that turns the player, lunges and lands back on its own tile, under the cap', () => {
    const player = { x: 9, y: 10 };
    const cutscene = guardChargeCutscene(GASTLY, player, guardChargeLines(GASTLY));
    expect(checkCutscene(cutscene)).toEqual([]);
    expect(cutsceneTimedMs(cutscene)).toBeLessThan(CUTSCENE_TIMED_CAP_MS);
    const playing = new CutscenePlayer(cutscene);
    const first = playing.advance(0);
    expect(first.actors.get(PLAYER_ACTOR)?.facing).toBe('right');
    expect(first.actors.get(GASTLY.id)?.emote?.kind).toBe('spotted');
    // Mid-lunge it is off the ground and part of the way to the player.
    const mid = playing.advance(450 + 120);
    expect(mid.actors.get(GASTLY.id)?.lift).toBeGreaterThan(0);
    expect(mid.actors.get(GASTLY.id)?.x).toBeLessThan(10);
    const said = playing.advance(1000);
    expect(said.speech?.lines[1]).toContain('guarding');
    expect(said.actors.get(GASTLY.id)).toMatchObject({ x: 10, y: 10 });
    expect(said.actors.get(GASTLY.id)?.lift).toBeUndefined();
  });

  it('comes at a player who ran from it with only its lunge and a line', () => {
    const cutscene = guardChargeCutscene(GASTLY, { x: 9, y: 10 }, guardChargeLines(GASTLY, true), true);
    expect(checkCutscene(cutscene)).toEqual([]);
    expect(cutscene.actions.map((action) => action.kind)).toEqual(['turn', 'lunge', 'wait', 'say']);
  });

  it('hops while it watches, and lands between hops', () => {
    expect(guardHopLift(90)).toBeGreaterThan(0);
    expect(guardHopLift(0)).toBe(0);
    expect(guardHopLift(GUARD_WATCH_HOP_MS - 1)).toBe(0);
  });

  it('goes without the mark when it would sit on the player’s own head', () => {
    const cutscene = guardChargeCutscene(GASTLY, { x: 10, y: 9 }, ['x']);
    expect(cutscene.actions.some((action) => action.kind === 'emote')).toBe(false);
  });

  it('turns along the longer gap, sideways on a tie', () => {
    expect(facingToward({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe('right');
    expect(facingToward({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe('up');
    expect(facingToward({ x: 0, y: 0 }, { x: -2, y: 1 })).toBe('left');
  });
});

describe('a guard’s hoard, had once a save', () => {
  const REST_PAYS = [
    { itemId: 'lamp-oil', quantity: 1 },
    { itemId: 'linen-roll', quantity: 1 },
    { itemId: 'water-stone', quantity: 1 },
  ];

  it('is in the cache until this save has banked it, and the rest of the cache stays', () => {
    expect(rewardThisRaid(REST_PAYS, 'water-stone', false)).toEqual(REST_PAYS);
    expect(rewardThisRaid(REST_PAYS, 'water-stone', true)).toEqual(REST_PAYS.slice(0, 2));
    expect(rewardThisRaid(REST_PAYS, undefined, true)).toEqual(REST_PAYS);
  });

  it('is had once its piece is taken, whatever becomes of it on the way home', () => {
    const pieces = REST_PAYS.map(({ itemId }) => ({ itemId }));
    expect(hoardTaken(pieces, [], 'water-stone')).toBe(false);
    expect(hoardTaken(pieces, [0, 1], 'water-stone')).toBe(false);
    // Taken and then used on an evolution, or dropped to make room: still had.
    expect(hoardTaken(pieces, [2], 'water-stone')).toBe(true);
  });
});

