import { buildContractBoard } from './contractBoard';
import type { ErrandProgress } from './errands';
import { isFirstRaid } from './firstRaid';
import { NEAR_JOBS, type StandingBoardProgress } from '../objectives/standingBoard';
import { availableInsertionIds, frontDoorFor, RUN_INSERTIONS, type RunInsertion } from '../run/runGeneration';
import { isMapOffered } from '../world/mapRoster';
import { isLandingOpen, nextGym } from '../world/valeQuarters';
import { CHART_PIECES, huntStage, MARLOW, NO_TREASURE_HUNT, TREASURE_GOAL, TREASURE_PLACE, type TreasureHunt } from '../treasure/treasureMap';

/**
 * The one next thing, as the screen a raid that got out opens on names it.
 *
 * The overnight critic came home from a first raid to four keepers each asking
 * a favour, a job on the rim, a cash stake, a gym arrow, two rumours and a
 * shop's loyalty points, and Oak read the whole of his cork board aloud after
 * every word (problems 8 and 9, 25 Nov 2026). Nothing said which of it came
 * first. This does: one thing at a time, in the order a newcomer meets the
 * game - a job, then a second, then the wider vale and a landing to walk to,
 * then the next gym. Oak used to say it from his mat as well; he greets and
 * asks after the Pokédex now, as FireRed's Oak does (`hub/keeperGreetings.ts`),
 * and the board beside him is read off the wall.
 *
 * Read off the save, so nothing is stored; Phaser-free, so `nextStep.test.ts`
 * holds the order.
 */
export type NextStepProgress = StandingBoardProgress & ErrandProgress & {
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
  readonly defeatedBosses: readonly string[];
  readonly reachedInsertions: readonly string[];
  readonly unlockedInsertions: readonly string[];
  readonly openedGates?: readonly string[];
  readonly treasureHunt?: TreasureHunt;
  readonly pokedexOwned?: readonly number[];
};

/**
 * The vale's five legends, in the order Oak names them once the gyms are
 * done: the three birds, then Mew, then Mewtwo at the bottom of the Bunker,
 * the highest of them. Where each stands is the stitched map's own (`pokemon`
 * marked `legendary` in `world/maps/greystoneVale.json`), said in the words its
 * districts use; `nextStep.test.ts` holds that every one is on the map, at
 * the level given here.
 */
export const VALE_LEGENDS: readonly {
  readonly name: string;
  readonly dexId: number;
  readonly speciesId: string;
  readonly level: number;
  readonly where: string;
}[] = [
  { name: 'ZAPDOS', dexId: 145, speciesId: 'zapdos', level: 50, where: 'sleeps in the TURBINE HALL under the POWER STATION' },
  { name: 'ARTICUNO', dexId: 144, speciesId: 'articuno', level: 50, where: 'roosts on THE FROZEN LAGOON, out on FROSTREEF' },
  { name: 'MOLTRES', dexId: 146, speciesId: 'moltres', level: 50, where: 'nests in THE CRATER on EMBER ISLE' },
  { name: 'MEW', dexId: 151, speciesId: 'mew', level: 50, where: 'has been seen at THE CAIRN on top of STORMCROWN' },
  { name: 'MEWTWO', dexId: 150, speciesId: 'mewtwo', level: 70, where: 'waits four floors down THE BUNKER' },
];

/**
 * How far below a legend a team can stand and still be told to go for it.
 * Further than this and Oak says the gap instead: a two-badge team stalls
 * near Lv 18, and sending it at a Lv 50 bird with "Beat it" was a wall with a
 * signpost on it (the fresh critic, 25 Nov 2026).
 */
export const LEGEND_REACH_LEVELS = 10;

/** What Oak reads off the vault, besides the save's progress. */
export interface NextStepVault {
  /** What the vault holds of an item, which the treasure map's stage reads. */
  readonly held?: (itemId: string) => number;
  /** The highest level of any Pokémon the player keeps. */
  readonly bestLevel?: number;
}

/** The vault as `nextStepCard` reads it, from a stash. */
export function vaultOf(stash: {
  itemCount(itemId: string): number;
  listPokemon(): readonly { readonly pokemon: { readonly level: number } }[];
}): NextStepVault {
  return {
    held: (itemId) => stash.itemCount(itemId),
    bestLevel: Math.max(0, ...stash.listPokemon().map((stored) => stored.pokemon.level)),
  };
}

/**
 * The named thing to chase once both gyms are beaten (the overnight critic's
 * problem 17, 25 Nov 2026: "After both badges the game has nothing to say", and
 * the arrow turned round to point at ₽75). First the treasure map, which a
 * two-badge team can finish in an evening; then the legends not yet caught,
 * a different one each raid, which it has to grow into. Undefined once there is nothing left to name.
 */
export function chaseLine(progress: NextStepProgress, vault: NextStepVault = {}): string | undefined {
  const hunt = progress.treasureHunt ?? NO_TREASURE_HUNT;
  switch (huntStage(hunt, vault.held ?? (() => 0))) {
    case 'no-chart':
      return 'Next, a treasure: a bottle has washed up on THE BEACH past the pier, with a chart in it. Nobody has looked.';
    case 'first-chart':
      return `Next, a treasure: take that bottled chart to ${MARLOW.name} at THE GREAT LIBRARY.`;
    case 'pinning': {
      const left = CHART_PIECES.length - hunt.pinned.length;
      return `Next, the treasure: ${MARLOW.name}'s chart still wants ${left} more piece${left === 1 ? '' : 's'}. Ask him where.`;
    }
    case 'whole':
      return `Next, the treasure: the X is in ${TREASURE_PLACE}. Dig up the ${TREASURE_GOAL.prize}!`;
    case 'chest':
      return `Next, the treasure: carry the ${TREASURE_GOAL.prize} to ${MARLOW.name}.`;
    case 'done':
      break;
  }
  const owned = new Set(progress.pokedexOwned ?? []);
  const left = VALE_LEGENDS.filter((each) => !owned.has(each.dexId));
  // One a raid, in turn: a legend's one throw is about 1 in 80 in a Poké Ball,
  // and the same name raid after raid while it kept missing read as a wall with
  // a signpost on it (the fresh critic, 25 Nov 2026).
  const raids = Object.values(progress.raidRecord ?? {}).reduce((total, record) => total + record.deployed, 0);
  const legend = left[raids % Math.max(1, left.length)];
  if (!legend) {
    return undefined;
  }
  const best = vault.bestLevel;
  return best !== undefined && best > 0 && best < legend.level - LEGEND_REACH_LEVELS
    ? `Next, a legend: ${legend.name} ${legend.where}, at Lv ${legend.level}. Your best is Lv ${best}. Grow into it - it isn't going anywhere.`
    : `Next, a legend: ${legend.name} ${legend.where}, at Lv ${legend.level}. Beat it, and you get one throw.`;
}

/** Jobs banked, of either kind: the authored chain's and the standing board's. */
export function jobsBanked(progress: Pick<StandingBoardProgress, 'completedContracts' | 'standingContractsBanked'>): number {
  return (progress.completedContracts?.length ?? 0) + (progress.standingContractsBanked ?? 0);
}

/**
 * A landing this save has not yet walked to and could, for Oak to name once
 * the near jobs are done: the critic started fourteen raids on the same square
 * because nothing said a landing is a place you walk onto (problem 13).
 */
export function landingToWalkTo(progress: NextStepProgress): RunInsertion | undefined {
  const offered = new Set(availableInsertionIds(progress));
  const opened = [...progress.defeatedBosses, ...(progress.openedGates ?? [])];
  return (Object.values(RUN_INSERTIONS) as RunInsertion[]).find(
    (landing) =>
      isMapOffered(landing.mapId) &&
      !offered.has(landing.id) &&
      // Not one behind a gym's doors this save has not opened.
      isLandingOpen(landing.id, opened) &&
      frontDoorFor(landing.mapId)?.id !== landing.id,
  );
}

/**
 * Oak's next thing as a card, for the screen a raid that got out opens on: a
 * heading saying what kind of thing it is, its name, and where it is. The
 * captain, 26 Nov 2026, of that screen's sentence "Next, a job: SEALED
 * DISPATCH. Pick it at the RAID ARENA, before you jump.": "Next job is okay,
 * but this is just terribly formatted, and it should be way more exciting."
 */
export interface NextStepCard {
  /** What kind of thing is next, as the card's heading: NEXT JOB, NEXT GYM. */
  readonly heading: string;
  /** Its name, the card's one big line; empty when the kind is all there is to name. */
  readonly name: string;
  /** Where it is, or what to do about it. */
  readonly where: string;
}

/** The one next thing as a card, or undefined when there is nothing next to name. */
export function nextStepCard(progress: NextStepProgress, vault: NextStepVault = {}): NextStepCard | undefined {
  if (isFirstRaid(progress)) {
    return { heading: 'NEXT', name: 'YOUR FIRST RAID', where: 'At the RAID ARENA, west across the yard' };
  }
  const banked = jobsBanked(progress);
  const [job] = buildContractBoard(progress).rows;
  if (banked < NEAR_JOBS) {
    if (!job) {
      return banked === 0 ? { heading: 'NEXT', name: 'ANOTHER RAID', where: 'Every raid starts at the RAID ARENA' } : undefined;
    }
    return {
      heading: banked === 0 ? 'NEXT JOB' : `YOUR ${(['FIRST', 'SECOND', 'THIRD', 'FOURTH'][banked] ?? 'NEXT')} JOB`,
      name: job.name.toUpperCase(),
      where: banked === 0 ? 'Pick it at the RAID ARENA before you jump' : 'On the rail at the RAID ARENA',
    };
  }
  const landing = landingToWalkTo(progress);
  if (landing) {
    return { heading: 'NEW LANDING', name: landing.label.toUpperCase(), where: 'Walk to it on a raid, and you can land there next time' };
  }
  const gym = nextGym(progress.defeatedBosses);
  if (gym) {
    return { heading: 'NEXT GYM', name: gym.leader.toUpperCase(), where: `At ${gym.building.toUpperCase()} in ${gym.standsIn.toUpperCase()}` };
  }
  // "Next, a treasure: ..." and "Next, a legend: ...": the kind is the heading.
  const chase = chaseLine(progress, vault);
  const said = chase ? /^Next, (?:an? |the )?([^:]+): (.+)$/.exec(chase) : null;
  return said ? { heading: `NEXT ${said[1].toUpperCase()}`, name: '', where: said[2] } : undefined;
}
