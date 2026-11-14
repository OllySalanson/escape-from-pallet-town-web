import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { HUNTER_RIVALS } from '../world/hunters';
import { KOGA_BOSS_ID, leadersMet, MISTY_BOSS_ID } from '../world/valeQuarters';
import { arenaCollision, isOuterWall } from './arenaHall';
import { RIVAL_TILE } from './arenaBouts';
import { LEADER_TILES, leaderBehindRival, nobodyToSparLine, practiceLeaders, practiceTrainer, rivalTile } from './gymPractice';

describe('practice against a gym leader', () => {
  it('is offered by nobody until the leader has been met in a raid, or beaten', () => {
    expect(practiceLeaders(DEFAULT_RAID_PROGRESS, null)).toEqual([]);
    expect(leadersMet({ ...DEFAULT_RAID_PROGRESS, gymsMet: [MISTY_BOSS_ID] }).map((gym) => gym.leader)).toEqual(['Misty']);
    expect(leadersMet({ ...DEFAULT_RAID_PROGRESS, defeatedBosses: [MISTY_BOSS_ID] }).map((gym) => gym.leader)).toEqual(['Misty']);
  });

  it('stands the leader on the far floor, or lets the rival there offer it when they are the same person', () => {
    const met = { ...DEFAULT_RAID_PROGRESS, gymsMet: [MISTY_BOSS_ID] };
    expect(practiceLeaders(met, 'blue').map((leader) => leader.tile)).toEqual([LEADER_TILES[0]]);
    expect(practiceLeaders(met, 'misty')).toEqual([]);
    expect(leaderBehindRival(met, 'misty')?.bossId).toBe(MISTY_BOSS_ID);
    expect(leaderBehindRival(DEFAULT_RAID_PROGRESS, 'misty')).toBeUndefined();
  });

  it('stands everybody in one place, so a bout that moves the ladder on moves nobody who stays (the owner, 12 Nov 2026)', () => {
    // Beaten in a bout, Misty stepped off the rival's tile onto her own and Lt.
    // Surge, up next, took the one she had stood on: "Misty and the green NPC
    // had swapped places." A leader met is on their own tile every day, the
    // day they are the rival too.
    const met = { ...DEFAULT_RAID_PROGRESS, gymsMet: [MISTY_BOSS_ID, KOGA_BOSS_ID] };
    const farFloor = (rival: string) =>
      new Map<string, GridPosition>([[rival, rivalTile(met, rival)], ...practiceLeaders(met, rival).map((leader) => [leader.gym.rival, leader.tile] as const)]);
    for (const before of HUNTER_RIVALS) {
      const was = farFloor(before.id);
      expect(new Set([...was.values()].map((tile) => `${tile.x},${tile.y}`)).size, `nobody shares a tile with ${before.id} up`).toBe(was.size);
      for (const after of HUNTER_RIVALS) {
        for (const [who, tile] of farFloor(after.id)) {
          if (was.has(who)) {
            expect(tile, `${who}, ${before.id} up and then ${after.id}`).toEqual(was.get(who));
          }
        }
      }
    }
    expect(rivalTile(met, 'misty')).toEqual(LEADER_TILES[0]);
    expect(rivalTile(met, 'lt-surge')).toEqual(RIVAL_TILE);
  });

  it("keeps a leader's tile their own whoever else has been met", () => {
    const kogaAlone = practiceLeaders({ ...DEFAULT_RAID_PROGRESS, gymsMet: [KOGA_BOSS_ID] }, null);
    const both = practiceLeaders({ ...DEFAULT_RAID_PROGRESS, gymsMet: [MISTY_BOSS_ID, KOGA_BOSS_ID] }, null);
    expect(kogaAlone.map((leader) => leader.tile)).toEqual([both.find((leader) => leader.gym.bossId === KOGA_BOSS_ID)!.tile]);
  });

  it('waits where there is room to walk up and face them, clear of the rival and the wall', () => {
    const solid = arenaCollision();
    for (const tile of LEADER_TILES) {
      expect(solid[tile.y][tile.x]).toBe(false);
      expect(solid[tile.y + 1][tile.x]).toBe(false);
      expect(isOuterWall(tile)).toBe(false);
      expect(Math.abs(tile.x - RIVAL_TILE.x)).toBeGreaterThan(2);
    }
  });

  it("is the leader's real gym team: the same Pokémon, levels, moves, two at a time and the gym's AI", () => {
    const misty = bossEncounters(createRunTrainerEncounters()).find((boss) => boss.bossId === MISTY_BOSS_ID)!;
    const practice = practiceTrainer(MISTY_BOSS_ID)!;
    expect(practice.party.map((pokemon) => [pokemon.base.id, pokemon.level, pokemon.moves.map((move) => move.base.name)])).toEqual(
      misty.trainer.party.map((pokemon) => [pokemon.base.id, pokemon.level, pokemon.moves.map((move) => move.base.name)]),
    );
    expect(practice.unitCount).toBe(2);
    expect(practice.ai).toBe('gym');
    // Fresh copies: a practice cannot hurt the team a raid will meet.
    expect(practice.party[0]).not.toBe(misty.trainer.party[0]);
    expect(practice.party.every((pokemon) => pokemon.currentHp === pokemon.stats.hp)).toBe(true);
    // And it hands over no badge: its words are a practice's.
    expect(practice.defeatText).not.toContain('BADGE.');
    expect(practice.id).not.toBe(misty.trainer.id);
  });

  it('is nobody else', () => {
    expect(practiceTrainer('vale-quay-keeper')).toBeUndefined();
  });
});

describe('nobody to spar with', () => {
  // The gyms playtest of 14 Nov 2026: every Pokemon fainted, the partner at the
  // player's heel, and Misty said "Nobody on your bench?".
  it('sends a team that has all fainted to Nurse Joy, and an empty bench to choose one', () => {
    expect(nobodyToSparLine('MISTY', true)).toBe('MISTY: "Your team\'s all fainted! See Nurse Joy, then come back."');
    expect(nobodyToSparLine('MISTY', true)).not.toContain('bench');
    expect(nobodyToSparLine('MISTY', false)).toContain('Nobody on your bench?');
  });
});
