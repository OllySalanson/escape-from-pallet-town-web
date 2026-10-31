import { describe, expect, it } from 'vitest';
import { CHARMANDER, Pokemon } from '../pokemon';
import { createStartingStash } from '../stash';
import { HUNTER_RIVALS, rivalForRaid } from '../world/hunters';
import { arenaCollision, isOuterWall } from './arenaHall';
import { RIVAL_TILE, boutBag, boutParty, boutTrainer, ladderLine, paintPlayerBanner, rivalGreeting, rivalUp } from './arenaBouts';
import { afterBout, readBouts } from './boutLadder';

describe('who stands on the far floor', () => {
  it('is whoever hunts the next raid', () => {
    for (let raids = 0; raids < 10; raids += 1) {
      expect(rivalUp(undefined, raids).id).toBe(rivalForRaid(raids));
    }
  });

  it('is the next along once they have been beaten this run, and goes through all five', () => {
    const met = new Set<string>();
    let record = readBouts({ beaten: [] });
    for (let round = 0; round < HUNTER_RIVALS.length; round += 1) {
      const rival = rivalUp(record, 3);
      met.add(rival.id);
      record = afterBout(record, rival.id, true).record;
    }
    expect(met.size).toBe(HUNTER_RIVALS.length);
  });

  it('stands on open floor, with room to walk round them and face them', () => {
    const solid = arenaCollision();
    expect(solid[RIVAL_TILE.y][RIVAL_TILE.x]).toBe(false);
    expect(solid[RIVAL_TILE.y + 1][RIVAL_TILE.x]).toBe(false);
    expect(solid[RIVAL_TILE.y][RIVAL_TILE.x - 1]).toBe(false);
    expect(solid[RIVAL_TILE.y][RIVAL_TILE.x + 1]).toBe(false);
    expect(isOuterWall(RIVAL_TILE)).toBe(false);
  });

  it('leaves the far wall to be waved from, beside them', () => {
    const solid = arenaCollision();
    expect(solid[RIVAL_TILE.y - 1][RIVAL_TILE.x - 1]).toBe(false);
    expect(isOuterWall({ x: RIVAL_TILE.x - 1, y: RIVAL_TILE.y - 2 })).toBe(true);
  });
});

describe('the ladder', () => {
  it('counts wins in a row, a loss starts it again, and all five goes on the record', () => {
    let record = afterBout(undefined, 'blue', true).record;
    expect(record.beaten).toEqual(['blue']);
    // The same rival twice is not two.
    record = afterBout(record, 'blue', true).record;
    expect(record.beaten).toEqual(['blue']);
    record = afterBout(record, 'misty', false).record;
    expect(record).toEqual({ beaten: [], ladders: 0 });
    let done = false;
    for (const rival of HUNTER_RIVALS) {
      const went = afterBout(record, rival.id, true);
      record = went.record;
      done = went.ladderDone;
    }
    expect(done).toBe(true);
    expect(record).toEqual({ beaten: [], ladders: 1 });
    // A lost bout never takes a banner back.
    expect(afterBout(record, 'blue', false).record.ladders).toBe(1);
  });

  it('reads back only what is one', () => {
    expect(readBouts(undefined)).toBeUndefined();
    expect(readBouts({ beaten: ['blue', 'blue', 'giovanni', 3], ladders: -1 })).toEqual({ beaten: ['blue'], ladders: 0 });
  });

  it('says where the run has got to', () => {
    expect(ladderLine({ beaten: ['blue', 'misty'], ladders: 0 }, false, true)).toBe('2 OF 5 IN A ROW');
    expect(ladderLine({ beaten: [], ladders: 0 }, false, false)).toBe('BACK TO THE START');
    expect(ladderLine({ beaten: [], ladders: 1 }, true, true)).toMatch(/BANNER/);
  });
});

describe('what a bout is fought with', () => {
  it('is copies: nothing done to one reaches what the vault holds', () => {
    const stash = createStartingStash(CHARMANDER);
    const stored = stash.listPokemon()[0].pokemon;
    stored.takeDamage(3);
    const hpBefore = stored.currentHp;
    const xpBefore = stored.experience;
    const movesBefore = stored.moves.length;
    const [copy] = boutParty([stored]);
    expect(copy).not.toBe(stored);
    expect(copy.moves[0]).not.toBe(stored.moves[0]);
    copy.takeDamage(copy.maxHp);
    copy.gainExperience(100000, { evolve: false });
    copy.heldItemId = 'leftovers';
    copy.primaryStatus = 'burn';
    expect(stored.currentHp).toBe(hpBefore);
    expect(stored.experience).toBe(xpBefore);
    expect(stored.moves.length).toBe(movesBefore);
    expect(stored.heldItemId).toBeNull();
    expect(stored.primaryStatus).toBeNull();
  });

  it('is whole and rested, whatever the vault has them at', () => {
    const hurt = new Pokemon(CHARMANDER, 20);
    hurt.takeDamage(hurt.maxHp);
    hurt.primaryStatus = 'burn';
    const [copy] = boutParty([hurt]);
    expect(copy.isFainted).toBe(false);
    expect(copy.currentHp).toBe(copy.maxHp);
    expect(copy.primaryStatus).toBeNull();
    expect(hurt.isFainted).toBe(true);
  });

  it('carries the rack in a bag of its own', () => {
    const packed = { potion: 3 };
    const bag = boutBag(packed);
    bag.remove('potion', 1);
    expect(packed.potion).toBe(3);
  });

  it('is against the rival\'s own team, a rung below the bench, for every rival', () => {
    const party = [new Pokemon(CHARMANDER, 30), new Pokemon(CHARMANDER, 20)];
    for (const rival of HUNTER_RIVALS) {
      const trainer = boutTrainer(rival, party);
      expect(trainer.party.map((pokemon) => pokemon.level)).toEqual([29, 19]);
      expect(trainer.name).toBe(rival.name);
      // No getaway: there is nobody to get away from.
      expect(trainer.getawayText).toBeUndefined();
    }
  });
});

describe('what a rival says', () => {
  it('fits the box, in their own name, and goes by how the last raid went', () => {
    for (const rival of HUNTER_RIVALS) {
      for (const line of Object.values(rival.hall)) {
        expect(line.length, line).toBeLessThanOrEqual(80);
      }
      for (const line of [rival.hall.first, rival.hall.afterLoss, rival.hall.afterOut, rival.hall.offer, rival.hall.later, rival.hall.gloat, rival.hall.sulk]) {
        expect(line.startsWith(`${rival.name}: "`), line).toBe(true);
      }
      expect(rivalGreeting(rival, 'fell')).toBe(rival.hall.afterLoss);
      expect(rivalGreeting(rival, 'out')).toBe(rival.hall.afterOut);
      expect(rivalGreeting(rival, undefined)).toBe(rival.hall.first);
    }
  });
});

describe('the banner', () => {
  it('is painted, opaque where it is cloth, and swallow-tailed', () => {
    const banner = paintPlayerBanner(1);
    const opaque = (x: number, y: number): boolean => banner.data[(y * banner.width + x) * 4 + 3] > 0;
    expect(opaque(7, 10)).toBe(true);
    expect(opaque(7, banner.height - 1)).toBe(false);
    expect(opaque(0, banner.height - 1)).toBe(true);
  });
});
