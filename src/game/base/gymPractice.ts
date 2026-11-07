import type { GridPosition } from '../movement/gridMovement';
import { Move, Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { gymOf, leadersMet, type ValeGym } from '../world/valeQuarters';
import { RIVAL_TILE } from './arenaBouts';

/**
 * Practice against a gym leader's real team, in THE RAID ARENA, for nothing
 * (firstmate's `eptw-gyms-loadouts-plan`, step 2: learn before you risk it; the
 * captain's pick 5, once that leader has been met in a raid).
 *
 * Losing a gym fight in a raid is a wipe, and a gym is a puzzle - setter and
 * payoff - that a team either answers or does not. So once a leader has been
 * fought out there, won or lost (`leadersMet`), they stand on the hall's far
 * floor beside the rival and spar with exactly the team their gym fields: the
 * same Pokémon, the same moves, the same levels, two at a time, and the same
 * trainer AI playing their combo (`ai: 'gym'`). The first meeting stays a fright;
 * every one after it can be rehearsed.
 *
 * A practice is a bout for show in every way that matters to the save
 * (`arenaBouts.ts`): the real battle scene, on copies of the bench, with no run
 * session, so it **writes nothing at all** - not even the bout ladder, which is
 * the rivals' and not the leaders'. What comes home is which way it went, for the
 * leader to say something about, and, lost, the line that says what beat you
 * (`pokemon/battle/whatBeatYou.ts`). Phaser-free.
 */

/** Where the leaders who will spar wait: along the far floor west of the rival, in gym order. */
export const LEADER_TILES: readonly GridPosition[] = [
  { x: RIVAL_TILE.x - 5, y: RIVAL_TILE.y },
  { x: RIVAL_TILE.x - 9, y: RIVAL_TILE.y + 1 },
  { x: RIVAL_TILE.x + 5, y: RIVAL_TILE.y },
];

/** The box's question to a leader, short enough to leave its answers a line of their own. */
export const PRACTICE_QUESTION = 'PRACTISE FOR FREE?';

/** Asked of the rival on the far floor when they are a leader the player has met, after the bout for show is turned down. */
export const PRACTICE_AFTER_BOUT_QUESTION = 'MY GYM TEAM, THEN?';

/** A leader waiting to spar, and where. */
export interface PracticeLeader {
  readonly gym: ValeGym;
  readonly tile: GridPosition;
}

/**
 * Who waits to spar, and where: every leader this save has met, except one who
 * is the rival on the far floor today - they offer it there instead, so nobody
 * stands in the hall twice.
 */
export function practiceLeaders(
  progress: { readonly defeatedBosses: readonly string[]; readonly gymsMet?: readonly string[] },
  rivalOnTheFloor: string | null,
): readonly PracticeLeader[] {
  return leadersMet(progress)
    .slice(0, LEADER_TILES.length)
    .map((gym, index) => ({ gym, tile: LEADER_TILES[index] }))
    .filter((leader) => leader.gym.rival !== rivalOnTheFloor);
}

/** The leader a rival on the far floor is, if the player has met them at their gym. */
export function leaderBehindRival(
  progress: { readonly defeatedBosses: readonly string[]; readonly gymsMet?: readonly string[] },
  rival: string,
): ValeGym | undefined {
  return leadersMet(progress).find((gym) => gym.rival === rival);
}

/**
 * The leader's real gym team, fresh: what `trainers.ts` authors for their fight,
 * each Pokémon at full health and full PP knowing the moves its leader taught
 * it, two on two, on the gym's trainer AI. Undefined for anybody who is not a
 * gym leader.
 */
export function practiceTrainer(bossId: string): TrainerBattle | undefined {
  const gym = gymOf(bossId);
  const leader = gym && bossEncounters(createRunTrainerEncounters()).find((boss) => boss.bossId === bossId);
  if (!gym || !leader) {
    return undefined;
  }
  const { trainer } = leader;
  return {
    ...trainer,
    id: `practice-${bossId}`,
    party: trainer.party.map((pokemon) => {
      const fresh = new Pokemon(pokemon.base, pokemon.level);
      fresh.moves = pokemon.moves.map((move) => new Move(move.base));
      return fresh;
    }),
    // Their gym's defeat words name the badge and open the doors; a practice does neither.
    defeatText: gym.practice.beaten,
  };
}
