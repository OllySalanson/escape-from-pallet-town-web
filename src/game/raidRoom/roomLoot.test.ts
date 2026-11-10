import { describe, expect, it } from 'vitest';
import { generateRoomLoot, generateRunPlan, withRoomLoot } from '../run/runGeneration';
import { isStake, isStakeTrail } from '../world/loot';
import type { RaidConditions } from '../world/secrets';
import { LootLedger, encodeTook, readTook } from './roomLoot';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('the ground a raid room shares', () => {
  it('is the same for everybody given the room’s seed, and another seed lays it otherwise', () => {
    const first = generateRoomLoot('floodplain-relay', 1234);
    expect(first.length).toBeGreaterThan(0);
    expect(generateRoomLoot('floodplain-relay', 1234)).toEqual(first);
    expect(generateRoomLoot('floodplain-relay', 99)).not.toEqual(first);
    expect(new Set(first.map((loot) => loot.id)).size).toBe(first.length);
  });

  it('replaces a raid’s own ground on the room’s map, keeps what is its own, and never lands under something', () => {
    const plan = generateRunPlan(7, undefined, 'floodplain-relay', undefined);
    const room = generateRoomLoot('floodplain-relay', 1234);
    const own = plan.loot['floodplain-relay'][0];
    const shared = withRoomLoot(plan, room, (loot) => loot.id === own.id);
    const laid = shared.loot['floodplain-relay'];
    expect(laid).toContainEqual(own);
    expect(shared.roomLootIds).not.toContain(own.id);
    expect(shared.roomLootIds!.length).toBeGreaterThan(0);
    const occupied = new Set([
      ...plan.trainers.filter((trainer) => trainer.mapId === 'floodplain-relay').map((trainer) => `${trainer.position.x},${trainer.position.y}`),
      ...plan.extractionPoints.filter((point) => point.mapId === 'floodplain-relay').map((point) => `${point.position.x},${point.position.y}`),
    ]);
    for (const loot of laid.filter((piece) => shared.roomLootIds!.includes(piece.id))) {
      expect(occupied.has(`${loot.position.x},${loot.position.y}`)).toBe(false);
    }
    // Nothing else about the raid moves.
    expect(shared.trainers).toEqual(plan.trainers);
    expect(shared.extractionPoints).toEqual(plan.extractionPoints);
  });
});

describe('what a room raid keeps as the player’s own', () => {
  // The hunt for bugs in raiding with a friend (9 Nov): the room's ground took
  // the whole map's loot, so a friend raid had no stake and no secret - no
  // prize, no chart piece, and no sea chest at the end of the treasure hunt.
  const VALE = 'greystone-vale';
  const dusk: RaidConditions = { hour: 'dusk', weekday: 3, month: 5, leadTypes: ['Normal'], fieldMoves: [], carried: [], chartWhole: false };
  const solo = generateRunPlan(7, undefined, 'greystone-vale-moor-top', undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, { conditions: dusk, known: { secretsFound: [], giftsReceived: [] } });
  const inARoom = withRoomLoot(solo, generateRoomLoot(VALE, 1234), () => false);
  const laid = inARoom.loot[VALE];

  it('keeps the stake and the money on the way to it, where this raid laid them', () => {
    const trail = solo.loot[VALE].filter(isStakeTrail);
    expect(trail.some(isStake)).toBe(true);
    for (const piece of trail) {
      expect(laid).toContainEqual(piece);
      expect(inARoom.roomLootIds).not.toContain(piece.id);
    }
  });

  it('keeps what an open secret’s nook holds, and the room lays nothing on a nook', () => {
    const secret = solo.loot[VALE].filter((piece) => piece.secret !== undefined);
    expect(secret.map((piece) => piece.itemId)).toEqual(['chart-piece-1']);
    expect(laid).toContainEqual(secret[0]);
    const nooks = new Set(solo.loot[VALE].filter((piece) => piece.secret !== undefined).map((piece) => `${piece.position.x},${piece.position.y}`));
    for (const piece of generateRoomLoot(VALE, 1234)) {
      expect(piece.secret).toBeUndefined();
      expect(nooks.has(`${piece.position.x},${piece.position.y}`)).toBe(false);
    }
  });

  it('shares everything else on the map, one piece to a tile', () => {
    const own = laid.filter((piece) => !inARoom.roomLootIds!.includes(piece.id));
    expect(own.every((piece) => isStakeTrail(piece) || piece.secret !== undefined)).toBe(true);
    const tiles = laid.map((piece) => `${piece.position.x},${piece.position.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });
});

describe('who holds which piece', () => {
  it('reads back what a winner says, and nothing else', () => {
    expect(readTook(encodeTook({ from: A, lootId: 'floodplain-potion' }))).toEqual({ from: A, lootId: 'floodplain-potion' });
    for (const bad of [null, { k: 't', u: 'ASH', l: 'x' }, { k: 't', u: A, l: '<b>' }, { k: 'h', u: A, l: 'x' }]) {
      expect(readTook(bad)).toBeNull();
    }
  });

  it('claims a piece once, and says when somebody else was first', () => {
    const ledger = new LootLedger();
    expect(ledger.claim('potion')).toBe(true);
    expect(ledger.claim('potion')).toBe(false);
    ledger.answered('potion', B, A);
    expect(ledger.holder('potion')).toBe(B);
    expect(ledger.claim('potion')).toBe(false);
    expect(ledger.lostTheRace('potion')).toBe(true);
    expect(ledger.lostTheRace('potion')).toBe(false);
  });

  it('may claim again after no answer, and collects a won piece once', () => {
    const ledger = new LootLedger();
    ledger.claim('ball');
    ledger.answered('ball', null, A);
    expect(ledger.claim('ball')).toBe(true);
    ledger.answered('ball', A, A);
    expect(ledger.lostTheRace('ball')).toBe(false);
    expect(ledger.firstTry('ball')).toBe(true);
    expect(ledger.firstTry('ball')).toBe(false);
  });

  it('takes the first word heard on a piece and keeps it', () => {
    const ledger = new LootLedger();
    ledger.heard('kit', A);
    ledger.heard('kit', B);
    expect(ledger.holder('kit')).toBe(A);
  });
});
