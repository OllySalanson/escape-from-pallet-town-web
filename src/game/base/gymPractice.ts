import type { GridPosition } from '../movement/gridMovement';
import { Move, Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { gymOf, leadersMet, valeGyms, type ValeGym } from '../world/valeQuarters';
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

/**
 * Where the leaders who will spar wait: along the far floor west and east of the
 * rival, one tile each in gym order (`valeGyms`), so a leader's tile is theirs
 * whoever else has been met.
 */
export const LEADER_TILES: readonly GridPosition[] = [
  { x: RIVAL_TILE.x - 5, y: RIVAL_TILE.y },
  { x: RIVAL_TILE.x - 9, y: RIVAL_TILE.y + 1 },
  { x: RIVAL_TILE.x + 5, y: RIVAL_TILE.y },
];

/** The box's question to a leader, short enough to leave its answers a line of their own. */
export const PRACTICE_QUESTION = 'PRACTISE FOR FREE?';

/**
 * What somebody on the hall's far floor says when there is nobody to fight
 * them with. With every Pokemon fainted the team is right there - the partner
 * walks at your heel - so "nobody on your bench" was untrue: it sends you to
 * Nurse Joy, as the rim card does (the gyms playtest of 14 Nov 2026).
 */
export function nobodyToSparLine(speaker: string, everyoneFainted: boolean): string {
  return everyoneFainted
    ? `${speaker}: "Your team's all fainted! See Nurse Joy, then come back."`
    : `${speaker}: "Nobody on your bench? Come back with a team."`;
}

/** Asked of the rival on the far floor when they are a leader the player has met, after the bout for show is turned down. */
export const PRACTICE_AFTER_BOUT_QUESTION = 'MY GYM TEAM, THEN?';

/** A leader waiting to spar, and where. */
export interface PracticeLeader {
  readonly gym: ValeGym;
  readonly tile: GridPosition;
}

type LeadersProgress = { readonly defeatedBosses: readonly string[]; readonly gymsMet?: readonly string[] };

/**
 * Every leader this save has met, each on their own tile, whoever is the rival
 * today. One place each, every day: a leader who stood on the rival's tile the
 * day they were the rival stepped off it onto their own the moment a bout moved
 * the ladder on, and whoever was up next took the tile they had stood on (the
 * owner, 12 Nov 2026: "Misty and the green NPC had swapped places").
 */
function leadersAtHome(progress: LeadersProgress): readonly PracticeLeader[] {
  const gyms = valeGyms();
  return leadersMet(progress).flatMap((gym) => {
    const tile = LEADER_TILES[gyms.findIndex((each) => each.bossId === gym.bossId)];
    return tile ? [{ gym, tile }] : [];
  });
}

/**
 * Who waits to spar, and where: every leader this save has met, except one who
 * is the rival on the far floor today - they offer it as the rival instead, from
 * their own tile (`rivalTile`), so nobody stands in the hall twice.
 */
export function practiceLeaders(progress: LeadersProgress, rivalOnTheFloor: string | null): readonly PracticeLeader[] {
  return leadersAtHome(progress).filter((leader) => leader.gym.rival !== rivalOnTheFloor);
}

/**
 * Where today's rival waits: on their own tile when they are a leader the player
 * has met, so they never change places with anybody, and otherwise under the
 * hall's own banner (`RIVAL_TILE`).
 */
export function rivalTile(progress: LeadersProgress, rival: string): GridPosition {
  return leadersAtHome(progress).find((leader) => leader.gym.rival === rival)?.tile ?? RIVAL_TILE;
}

/** The leader a rival on the far floor is, if the player has met them at their gym. */
export function leaderBehindRival(progress: LeadersProgress, rival: string): ValeGym | undefined {
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
