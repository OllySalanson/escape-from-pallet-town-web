import { describe, expect, it } from 'vitest';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { leadersMet, MISTY_BOSS_ID } from '../world/valeQuarters';
import { arenaCollision, isOuterWall } from './arenaHall';
import { RIVAL_TILE } from './arenaBouts';
import { LEADER_TILES, leaderBehindRival, practiceLeaders, practiceTrainer } from './gymPractice';

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
