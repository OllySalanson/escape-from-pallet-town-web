import { outfitterMaterialKinds } from '../hub/outfitter';
import { ITEMS, type ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { createSeededRng, type SeededRng } from '../run/rng';
import { RUN_INSERTIONS, availableInsertionIds, frontDoorFor } from '../run/runGeneration';
import { EXTRACTION_POINTS, type ExtractionPoint } from '../world/extractionPoints';
import { gateBossIds, gateStateKey, gatesForMap, isGateOpen, type MapGate } from '../world/gates';
import { HUNTER_TIERS } from '../world/hunter';
import { stepDistances } from '../world/mapStructure';
import { createRunTrainerEncounters, withoutDefeatedBosses } from '../world/trainers';
import { trainerSightTiles } from '../world/trainerSight';
import { WORLD_MAP_NAMES, getWorldMap, type WorldMapDefinition, type WorldMapId } from '../worldMap';
import {
  availableContracts,
  type ContractMarker,
  type ContractPokemon,
  type ContractReward,
  type ContractStack,
  type RaidContract,
} from './contracts';
import { formatStacks } from './RunObjectives';

/**
 * The standing board: what the contract board offers once the authored chain is
 * banked, so that raid six has a reason.
 *
 * Nothing here is stored. The save keeps one number - how many standing
 * contracts have been banked - and the whole board is derived from that and
 * from the rest of `raidProgress`: which maps the player can deploy to, which
 * bosses still hold their gates, which Outfitter rungs are still unbuilt. The
 * same progress always offers the same board, so the lobby that lists a
 * contract, the raid that carries it and the save that pays it can never
 * disagree, and a board cannot be re-rolled by reloading. It turns over when
 * something on it is banked, which is also what an authored contract does.
 *
 * A standing contract is still a contract. Every one is built from a template
 * that changes the shape of the raid through one of the three mechanisms
 * `contracts.ts` already has - several `markers`, a `requiredExitLabel`, or a
 * marker's `carriedIn` - and the tiles are measured off the map as this player
 * has it, in walking steps, rather than authored: far from the landing, spread
 * apart, and never on a tile that already belongs to something else.
 *
 * Two things rise with the count. The board's top contract opens the hunter one
 * tier higher for every `STANDING_BANKS_PER_PRESSURE` banked - spent through
 * `hunterThreatFor`, so it is the same ladder the loadout is priced on and not a
 * second difficulty system - and the pay rises with it. The rest of the board
 * steps down from the top to nothing, so the safe raid is still on offer: it
 * just pays what a safe raid is worth.
 *
 * It pays in Outfitter materials - the radio valves, cable and the like the unbuilt rungs still cost,
 * and Pokemon, which are the ladder's real price - because the Outfitter is the
 * only thing in the game that gives a banked reward somewhere to go.
 */

/** The part of `raidProgress` the board is derived from. `RaidProgress` satisfies it. */
export interface StandingBoardProgress {
  readonly completedContracts: readonly string[];
  readonly standingContractsBanked: number;
  readonly defeatedBosses: readonly string[];
  readonly outfitterUpgrades: readonly string[];
  readonly unlockedInsertions: readonly string[];
  readonly reachedInsertions: readonly string[];
}

/** How many standing contracts are banked before the board's top offer rises a hunter tier. */
export const STANDING_BANKS_PER_PRESSURE = 2;

const STANDING_ID_PREFIX = 'standing';

export type StandingTemplate = 'survey' | 'dispatch' | 'resupply' | 'sealed';

export function isStandingContractId(id: string): boolean {
  return id.startsWith(`${STANDING_ID_PREFIX}-`);
}

/** Whether the authored chain is finished, which is when the standing board opens. */
export function isStandingBoardOpen(completedContractIds: readonly string[]): boolean {
  return availableContracts(completedContractIds).length === 0;
}

/**
 * The most hunter tiers any contract on this board adds. It climbs the hunter's
 * own ladder and stops at the top of it, so the last escalation is the enraged
 * hunter's team arriving with the veteran's lead - never something new.
 */
export function standingTopPressure(standingContractsBanked: number): number {
  return Math.min(
    HUNTER_TIERS.length - 1,
    Math.floor(Math.max(0, standingContractsBanked) / STANDING_BANKS_PER_PRESSURE),
  );
}

/**
 * The seed a board is drawn from: a function of how many have been banked and
 * of nothing else, so it is the same board until one of its contracts is paid.
 */
export function standingBoardSeed(progress: Pick<StandingBoardProgress, 'standingContractsBanked'>): number {
  return Math.imul(Math.max(0, Math.floor(progress.standingContractsBanked)) + 1, 0x9e3779b1) >>> 0;
}

/** Every map the player can deploy to, once each, in authored order. */
export function deployableMapIds(progress: StandingBoardProgress): readonly WorldMapId[] {
  return [...new Set(availableInsertionIds(progress).map((id) => RUN_INSERTIONS[id].mapId))];
}

const boards = new Map<string, readonly RaidContract[]>();

/** Drops every remembered board, so a test can prove one is redrawn the same rather than recalled. */
export function forgetStandingBoards(): void {
  boards.clear();
}

/**
 * The standing contracts on offer: one for every map the player can deploy to,
 * and none while an authored contract is still outstanding.
 *
 * It takes the seed rather than reading it so the generator can be held to its
 * rules across many seeds; the game always passes `standingBoardSeed(progress)`
 * - see `standingBoard()`.
 */
export function standingOffers(seed: number, progress: StandingBoardProgress): readonly RaidContract[] {
  if (!isStandingBoardOpen(progress.completedContracts)) {
    return [];
  }
  const round = Math.max(0, Math.floor(progress.standingContractsBanked));
  const mapIds = deployableMapIds(progress);
  const key = JSON.stringify([
    seed >>> 0,
    round,
    mapIds,
    [...progress.defeatedBosses].sort(),
    outfitterMaterialKinds(progress.outfitterUpgrades),
  ]);
  const remembered = boards.get(key);
  if (remembered) {
    return remembered;
  }

  // Which map carries the top contract is the seed's choice; every map after it
  // in that order steps down a tier until the board is back to no pressure.
  const top = standingTopPressure(round);
  const boardRng = createSeededRng(seed);
  const pressureOrder = boardRng.shuffle(mapIds);
  // One order of templates for the whole board, and each map starts one further
  // along it: a board of four dispatches is one contract offered four times.
  const templateOrder = boardRng.shuffle(OPEN_GROUND_TEMPLATES);
  const offers = mapIds.flatMap((mapId, index) => {
    const pressure = Math.max(0, top - pressureOrder.indexOf(mapId));
    const templates = templateOrder.map(
      (_, step) => templateOrder[(index + step) % templateOrder.length],
    );
    // A map's contract is drawn from its own stream, so what another map is
    // offered never changes what this one asks.
    const rng = createSeededRng((seed ^ hashText(mapId)) >>> 0);
    const contract = draftContract(rng, mapId, round, pressure, templates, progress);
    return contract ? [contract] : [];
  });
  boards.set(key, offers);
  return offers;
}

/** The board as the game sees it for this save. */
export function standingBoard(progress: StandingBoardProgress): readonly RaidContract[] {
  return standingOffers(standingBoardSeed(progress), progress);
}

/**
 * The round a standing contract was drawn in, read back off its id. It is what
 * makes banking one idempotent without a list of banked ids: paying a contract
 * moves the save to the next round, and an id from any other round is refused.
 *
 * The contract itself is never looked up again at banking time, on purpose. A
 * board is a function of progress, and a raid can change progress before it
 * extracts - the sealed-district contract is finished by beating the boss whose
 * gate it was drawn behind - so the contract that pays is the one the raid
 * deployed with, not whatever that map would be offered now.
 */
export function standingRoundOf(id: string): number | undefined {
  const round = new RegExp(`^${STANDING_ID_PREFIX}-(\\d+)-`).exec(id)?.[1];
  return round === undefined ? undefined : Number(round);
}

/**
 * Everything the contract board lists: the authored chain until it is banked,
 * and the standing board from then on.
 */
export function boardContracts(progress: StandingBoardProgress): readonly RaidContract[] {
  const authored = availableContracts(progress.completedContracts);
  return authored.length > 0 ? authored : standingBoard(progress);
}

/**
 * The contract a raid inserting on this map would carry. It is the one rule
 * the lobby, the final check and the deploy all ask, so a standing contract is
 * taken the way an authored one is - by choosing where to drop in.
 */
export function boardContractForMap(
  mapId: WorldMapId,
  progress: StandingBoardProgress,
): RaidContract | undefined {
  return boardContracts(progress).find((contract) => contract.mapId === mapId);
}

/** The Pokemon a reward pays in, as the vault receives them. */
export function rewardPokemon(reward: ContractReward): readonly Pokemon[] {
  return (reward.pokemon ?? []).flatMap(({ speciesId, level }) => {
    const species = getSpeciesById(speciesId);
    return species ? [new Pokemon(species, level)] : [];
  });
}

// ---------------------------------------------------------------------------
// The ground a contract is drawn on
// ---------------------------------------------------------------------------

interface SealedDistrict {
  readonly gate: MapGate;
  readonly bossName: string;
  /** Walking steps from the landing with this door open - the only map its distances mean anything on. */
  readonly steps: number[][];
  readonly tiles: readonly GridPosition[];
  readonly exits: readonly ExtractionPoint[];
}

interface Ground {
  readonly map: WorldMapDefinition;
  readonly landing: { readonly label: string; readonly position: GridPosition };
  /** Walking steps from the landing, as the gates stand for this player. */
  readonly steps: number[][];
  readonly longestWalk: number;
  /** Tiles a stop may stand on that the player can walk to today. */
  readonly open: readonly GridPosition[];
  readonly exits: readonly ExtractionPoint[];
  readonly districts: readonly SealedDistrict[];
}

const grounds = new Map<string, Ground | undefined>();

/** The ground is the map's and the gates', never the seed's, so it is measured once per gate state. */
function surveyGround(mapId: WorldMapId, defeatedBosses: readonly string[]): Ground | undefined {
  const key = `${mapId}|${gateStateKey(gatesForMap(mapId), defeatedBosses)}`;
  if (!grounds.has(key)) {
    grounds.set(key, measureGround(mapId, defeatedBosses));
  }
  return grounds.get(key);
}

function measureGround(mapId: WorldMapId, defeatedBosses: readonly string[]): Ground | undefined {
  const frontDoor = frontDoorFor(mapId);
  if (!frontDoor) {
    return undefined;
  }
  const map = getWorldMap(mapId, defeatedBosses);
  const steps = stepDistances(map.collision, frontDoor.position);
  const taken = takenTiles(map, defeatedBosses);
  const free = (tile: GridPosition): boolean => !taken.has(tileKey(tile));
  const reached = (grid: number[][], tile: GridPosition): boolean => (grid[tile.y]?.[tile.x] ?? -1) >= 0;
  const mapExits = EXTRACTION_POINTS.filter((point) => point.mapId === mapId);

  // A district is what one more boss would add to the walk from the front door.
  // Asked boss by boss, so a door behind another door is not offered before the
  // one in front of it: the board only ever points one gate ahead.
  //
  // "Adds ground" is not enough to say that on its own. One fight may open two
  // doors, and the second can let onto ground the player already walks - the
  // Floodplain's sluice keeper stands behind the toll bridge, but the causeway
  // he also holds runs back to the Landing. Beaten alone he would add the keep
  // to the walk, and the board would point a fresh save at a door whose keeper
  // it cannot reach. So the keeper has to be someone you can walk up to today.
  const gates = gatesForMap(mapId);
  const trainers = createRunTrainerEncounters();
  const canBeChallengedToday = (bossId: string): boolean => {
    const boss = trainers.find((trainer) => trainer.bossId === bossId);
    return (
      boss !== undefined &&
      [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) =>
        reached(steps, { x: boss.position.x + dx, y: boss.position.y + dy }),
      )
    );
  };
  const districts = gateBossIds(gates)
    .filter((bossId) => !defeatedBosses.includes(bossId) && canBeChallengedToday(bossId))
    .flatMap((bossId): SealedDistrict[] => {
      const beyond = stepDistances(
        getWorldMap(mapId, [...defeatedBosses, bossId]).collision,
        frontDoor.position,
      );
      const newlyWalkable = (tile: GridPosition): boolean => reached(beyond, tile) && !reached(steps, tile);
      const gate = gates.find(
        (candidate) => candidate.bossId === bossId && !isGateOpen(candidate, defeatedBosses),
      );
      const boss = trainers.find((trainer) => trainer.bossId === bossId);
      const tiles = allTiles(map).filter((tile) => newlyWalkable(tile) && free(tile));
      return gate && boss && tiles.length > 0
        ? [
            {
              gate,
              bossName: boss.trainer.name,
              steps: beyond,
              tiles,
              exits: mapExits.filter((exit) => newlyWalkable(exit.position)),
            },
          ]
        : [];
    });

  const open = allTiles(map).filter((tile) => reached(steps, tile) && free(tile));
  return {
    map,
    landing: { label: frontDoor.label, position: frontDoor.position },
    steps,
    longestWalk: Math.max(0, ...open.map((tile) => steps[tile.y][tile.x])),
    open,
    exits: mapExits.filter((exit) => reached(steps, exit.position)),
    districts,
  };
}

/**
 * Tiles a stop may never stand on, because something else already does: a way
 * in, a way out, a landmark, a person, a door, or ground a trainer is watching
 * - a stop there would be a fight the board never priced.
 */
function takenTiles(map: WorldMapDefinition, defeatedBosses: readonly string[]): ReadonlySet<string> {
  const isBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] ?? true;
  const fixedTrainers = withoutDefeatedBosses(createRunTrainerEncounters(), defeatedBosses).filter(
    (trainer) => trainer.mapId === map.id && trainer.fixedPosition,
  );
  return new Set(
    [
      ...map.warps.map((warp) => warp.source),
      ...map.entities.map((entity) => entity.position),
      ...map.pois.map((poi) => poi.position),
      ...map.gates.flatMap((gate) => gate.tiles),
      ...EXTRACTION_POINTS.filter((point) => point.mapId === map.id).map((point) => point.position),
      ...Object.values(RUN_INSERTIONS)
        .filter((insertion) => insertion.mapId === map.id)
        .map((insertion) => insertion.position),
      ...fixedTrainers.flatMap((trainer) => [trainer.position, ...trainerSightTiles(trainer, isBlocked)]),
    ].map(tileKey),
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** A stop is "far" when it is at least this share of the map's longest walk from the landing. */
const FAR_SHARE = 0.45;
/** Survey stakes start this share of the longest walk apart, relaxed only if the map cannot hold it. */
const SPREAD_SHARE = 0.3;
const SURVEY_STAKES = 3;
/** The share of boards on which a map with a shut gate offers what is behind it. */
const SEALED_SHARE = 0.5;
/** Every template that is played on ground the player can already walk. */
const OPEN_GROUND_TEMPLATES: readonly StandingTemplate[] = ['survey', 'dispatch', 'resupply'];

/** What a delivery asks for, and the grade up it is paid back in. */
const DELIVERIES: readonly { readonly asks: ContractStack; readonly paysIn: ItemId }[] = [
  { asks: { itemId: 'potion', quantity: 2 }, paysIn: 'super-potion' },
  { asks: { itemId: 'poke-ball', quantity: 3 }, paysIn: 'great-ball' },
];

/**
 * How many of each supply is one share of pay. Every item is priced, so a new
 * one cannot be paid out at a quantity nobody chose.
 */
const MATERIAL_SHARE: Readonly<Record<ItemId, number>> = {
  potion: 2,
  'poke-ball': 2,
  antidote: 2,
  'super-potion': 1,
  'great-ball': 1,
  'radio-valve': 1,
  'cable-coil': 1,
  'parts-crate': 1,
  'lamp-oil': 1,
  'mooring-rope': 1,
  'linen-roll': 1,
};

/** "on Route 1", "in Pallet Town" - typed by map id, so a new map has to say which it is. */
const MAP_PHRASE: Readonly<Record<WorldMapId, string>> = {
  'floodplain-relay': `at the ${WORLD_MAP_NAMES['floodplain-relay']}`,
  'pallet-town': `in ${WORLD_MAP_NAMES['pallet-town']}`,
  'route-1': `on ${WORLD_MAP_NAMES['route-1']}`,
  'viridian-forest': `in ${WORLD_MAP_NAMES['viridian-forest']}`,
};

function draftContract(
  rng: SeededRng,
  mapId: WorldMapId,
  round: number,
  pressure: number,
  templates: readonly StandingTemplate[],
  progress: StandingBoardProgress,
): RaidContract | undefined {
  const ground = surveyGround(mapId, progress.defeatedBosses);
  if (!ground) {
    return undefined;
  }
  // The first template the ground can hold is taken, so a map too small for one
  // still gets a contract. A map with a door still shut leads with what is
  // behind it on a share of boards rather than all of them: the tease must not
  // be the only contract that map ever offers a player who cannot beat the boss.
  const preferred: readonly StandingTemplate[] =
    ground.districts.length > 0 && rng.chance(SEALED_SHARE) ? ['sealed', ...templates] : templates;
  for (const template of preferred) {
    const draft = DRAFTERS[template](rng, ground);
    if (!draft) {
      continue;
    }
    const id = `${STANDING_ID_PREFIX}-${round}-${mapId}`;
    return {
      id,
      mapId,
      name: draft.name,
      description: draft.description,
      markers: draft.markers.map((marker, index) => ({ ...marker, id: `${id}-${index + 1}` })),
      ...(draft.requiredExitLabel ? { requiredExitLabel: draft.requiredExitLabel } : {}),
      ...(pressure > 0 ? { hunterPressure: pressure } : {}),
      ...(draft.sealedBehind ? { sealedBehind: draft.sealedBehind } : {}),
      reward: draftReward(rng, ground.map, pressure, draft, progress.outfitterUpgrades),
      briefing: draft.briefing,
      deploymentBriefing: `${draft.deploymentBriefing} Press O for the FIELD GUIDE.`,
    };
  }
  return undefined;
}

interface Draft {
  readonly template: StandingTemplate;
  readonly name: string;
  readonly description: string;
  readonly markers: readonly Omit<ContractMarker, 'id'>[];
  readonly requiredExitLabel?: string;
  readonly sealedBehind?: RaidContract['sealedBehind'];
  /** The supply this contract is paid back in, when the template decides it. */
  readonly paysIn?: ItemId;
  readonly briefing: readonly string[];
  readonly deploymentBriefing: string;
}

const DRAFTERS: Readonly<Record<StandingTemplate, (rng: SeededRng, ground: Ground) => Draft | undefined>> = {
  /** Three stakes, far from the landing and far from each other: the raid is a circuit. */
  survey(rng, ground) {
    const stakes = spreadTiles(rng, ground, farTiles(ground), SURVEY_STAKES);
    if (stakes.length < SURVEY_STAKES) {
      return undefined;
    }
    const where = MAP_PHRASE[ground.map.id];
    return {
      template: 'survey',
      name: 'Line survey',
      description: `Read all ${SURVEY_STAKES} survey stakes ${where}`,
      markers: stakes.map((position, index) => ({
        position,
        label: `SURVEY STAKE ${index + 1}\n${compass(ground.map, position).toUpperCase()}`,
        cue: `STAKE ${index + 1}`,
        icon: 'field-kit',
        collectedMessage:
          index === SURVEY_STAKES - 1
            ? `Stake ${index + 1} logged.`
            : `Stake ${index + 1} logged. The board wants all ${SURVEY_STAKES}.`,
      })),
      briefing: [
        `${SURVEY_STAKES} stakes, in any order: ${regions(ground.map, stakes)}.`,
        `The nearest is ${walk(ground, stakes)} steps from ${ground.landing.label} and no two are close, so the raid is a circuit rather than an errand.`,
        'Any exit banks it, once all of them are read.',
      ],
      deploymentBriefing: `${SURVEY_STAKES} survey stakes ${where}: ${regions(ground.map, stakes)}.`,
    };
  },

  /** One case, and one exit that will take it - never the exit nearest the case. */
  dispatch(rng, ground) {
    const [position] = spreadTiles(rng, ground, farTiles(ground), 1);
    if (!position || ground.exits.length < 2) {
      return undefined;
    }
    const fromCase = stepDistances(ground.map.collision, position);
    const byWalk = [...ground.exits].sort(
      (a, b) => fromCase[a.position.y][a.position.x] - fromCase[b.position.y][b.position.x],
    );
    const [nearest, ...others] = byWalk;
    const exit = rng.pick(others);
    const exitWalk = fromCase[exit.position.y][exit.position.x];
    const nearestWalk = fromCase[nearest.position.y][nearest.position.x];
    const where = MAP_PHRASE[ground.map.id];
    return {
      template: 'dispatch',
      name: 'Sealed dispatch',
      description: `Carry the dispatch case ${where} out through ${titleCase(exit.label)}`,
      requiredExitLabel: exit.label,
      markers: [
        {
          position,
          label: `DISPATCH CASE\n${compass(ground.map, position).toUpperCase()}`,
          cue: 'DISPATCH',
          icon: 'field-kit',
          collectedMessage: `Dispatch case in hand. Only ${exit.label} will take it.`,
        },
      ],
      briefing: [
        `The case is in ${regions(ground.map, [position])}, ${walk(ground, [position])} steps from ${ground.landing.label}.`,
        `Only ${exit.label} banks it, and that is ${exitWalk} steps from the case. ${nearest.label} is ${nearestWalk}.`,
        `${nearest.label} will still take you home. It will not take the case.`,
      ],
      deploymentBriefing: `Dispatch case in ${regions(ground.map, [position])}, then out through ${exit.label} and nowhere else.`,
    };
  },

  /** A delivery: decided at the loadout screen, and paid back a grade up. */
  resupply(rng, ground) {
    const [position] = spreadTiles(rng, ground, farTiles(ground), 1);
    if (!position) {
      return undefined;
    }
    const delivery = rng.pick(DELIVERIES);
    const asked = `${delivery.asks.quantity} ${ITEMS[delivery.asks.itemId].displayName}s`;
    const where = MAP_PHRASE[ground.map.id];
    return {
      template: 'resupply',
      name: 'Outpost resupply',
      description: `Deliver ${asked} to the outpost cache ${where}`,
      paysIn: delivery.paysIn,
      markers: [
        {
          position,
          label: `OUTPOST CACHE\nNEEDS ${asked.toUpperCase()}`,
          cue: 'CACHE DROP',
          icon: 'supply-cache',
          carriedIn: [delivery.asks],
          collectedMessage: `${asked} into the outpost cache. Now get out.`,
          shortMessage: `The outpost cache is empty. It needs ${asked} out of your own pack.`,
        },
      ],
      briefing: [
        `Pack ${asked} at base. They are handed over at the cache and do not come back.`,
        `The cache is in ${regions(ground.map, [position])}, ${walk(ground, [position])} steps from ${ground.landing.label} - and whatever you spend getting there, you cannot spend those.`,
        'Any exit banks it, once the drop is made.',
      ],
      deploymentBriefing: `${asked} to the outpost cache, in ${regions(ground.map, [position])}.`,
    };
  },

  /**
   * A stop behind a door the player has not opened. The boss is the contract:
   * nothing else on the board can be finished only by winning a fight, and
   * nothing else shows the player a part of the map they have never stood in.
   * Where the district has its own way out, that is the exit that banks it.
   */
  sealed(rng, ground) {
    const district = rng.pick(ground.districts);
    const exit = district.exits.length > 0 ? rng.pick(district.exits) : undefined;
    const beyond = district.steps;
    const deepest = [...district.tiles].sort((a, b) => beyond[b.y][b.x] - beyond[a.y][a.x]);
    // The far half of the district, so the stop is never the tile behind the door.
    const deep = deepest.slice(0, Math.max(1, Math.ceil(deepest.length / 2)));
    const stops = exit ? [rng.pick(deep)] : rng.shuffle(deep).slice(0, 2);
    if (!exit && stops.length < 2) {
      return undefined;
    }
    const where = MAP_PHRASE[ground.map.id];
    const gate = district.gate.label;
    return {
      template: 'sealed',
      name: `Past the ${titleCase(gate)}`,
      description: `Recover what is cached behind the ${titleCase(gate)} ${where}`,
      sealedBehind: { gateLabel: gate, bossName: district.bossName },
      ...(exit ? { requiredExitLabel: exit.label } : {}),
      markers: stops.map((position, index) => ({
        position,
        label: `SEALED CACHE${stops.length > 1 ? ` ${index + 1}` : ''}\nPAST ${gate}`,
        cue: stops.length > 1 ? `SEALED ${index + 1}` : 'SEALED CACHE',
        icon: 'supply-cache',
        collectedMessage: exit
          ? `Sealed cache recovered. Only ${exit.label} will take it.`
          : 'Sealed cache recovered.',
      })),
      briefing: [
        `The cache is behind the ${gate}, and ${district.bossName} holds it shut. Nobody walks round: beat them and the gate opens, in this raid and every one after.`,
        `It is ${beyond[stops[0].y][stops[0].x]} steps from ${ground.landing.label} once the door is open.`,
        exit
          ? `Only ${exit.label} banks it - the way out on the far side of the gate.`
          : 'Both caches are past the gate. Any exit banks it, once both are recovered.',
      ],
      deploymentBriefing: `The cache is past the ${gate}. ${district.bossName} holds it - beat them and it opens.`,
    };
  },
};

function farTiles(ground: Ground): readonly GridPosition[] {
  const far = ground.open.filter(
    (tile) => ground.steps[tile.y][tile.x] >= ground.longestWalk * FAR_SHARE,
  );
  return far.length > 0 ? far : ground.open;
}

/**
 * Up to `count` tiles, each at least a share of the map's longest walk from
 * every other in walking steps. The share is relaxed only when the ground
 * cannot hold it, so a cramped map gets closer stakes rather than fewer.
 */
function spreadTiles(
  rng: SeededRng,
  ground: Ground,
  candidates: readonly GridPosition[],
  count: number,
): readonly GridPosition[] {
  const shuffled = rng.shuffle(candidates);
  for (let spread = ground.longestWalk * SPREAD_SHARE; ; spread *= 0.75) {
    const chosen: { readonly tile: GridPosition; readonly from: number[][] }[] = [];
    for (const tile of shuffled) {
      if (chosen.length === count) {
        break;
      }
      if (chosen.every(({ from }) => (from[tile.y]?.[tile.x] ?? -1) >= spread)) {
        chosen.push({ tile, from: stepDistances(ground.map.collision, tile) });
      }
    }
    if (chosen.length === count || spread < 1) {
      return chosen.map(({ tile }) => tile);
    }
  }
}

// ---------------------------------------------------------------------------
// Pay
// ---------------------------------------------------------------------------

/**
 * What a contract pays. The supply is one the Outfitter's unbuilt rungs still
 * cost (a delivery is instead paid back a grade up on what it took), a share
 * larger for every tier of hunter the contract adds. A Pokemon is paid on top
 * wherever the contract cost a fight the player could not decline - a boss, or
 * a raised hunter - because Pokemon are the ladder's real price and a safe
 * contract should not hand one out.
 */
function draftReward(
  rng: SeededRng,
  map: WorldMapDefinition,
  pressure: number,
  draft: Draft,
  builtUpgradeIds: readonly string[],
): ContractReward {
  const kind = draft.paysIn ?? rng.pick(outfitterMaterialKinds(builtUpgradeIds));
  // A delivery pays one share more than any other contract: it has to clear
  // what was handed over before it is pay at all.
  const items: ContractStack[] = [
    { itemId: kind, quantity: MATERIAL_SHARE[kind] + pressure + (draft.paysIn ? 1 : 0) },
  ];
  const entries = map.encounters?.entries ?? [];
  const pokemon: ContractPokemon[] =
    (pressure > 0 || draft.template === 'sealed') && entries.length > 0
      ? [rng.pick(entries)].map((entry) => ({ speciesId: entry.speciesId, level: entry.minLevel }))
      : [];
  return {
    summary: `${rewardLine({ items, pokemon })}, waiting at base for the Outfitter.`,
    items,
    ...(pokemon.length > 0 ? { pokemon } : {}),
  };
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** What a reward hands over, as a list: "3× Poke Ball and a Lv 4 Bulbasaur". */
export function rewardLine(reward: Pick<ContractReward, 'items' | 'pokemon'>): string {
  return [
    ...(reward.items.length > 0 ? [formatStacks(reward.items)] : []),
    ...(reward.pokemon ?? []).map(
      ({ speciesId, level }) => `a Lv ${level} ${getSpeciesById(speciesId)?.name ?? speciesId}`,
    ),
  ].join(' and ');
}

/** Where on the map a tile is, in the eight points and "centre". */
function compass(map: WorldMapDefinition, tile: GridPosition): string {
  const band = (value: number, size: number, low: string, high: string): string =>
    value < size / 3 ? low : value >= (2 * size) / 3 ? high : '';
  const point = [band(tile.y, map.height, 'north', 'south'), band(tile.x, map.width, 'west', 'east')]
    .filter(Boolean)
    .join('-');
  return point || 'centre';
}

/**
 * Where these tiles are, as parts of the map: "the north-west of the map". A
 * part of the map and never a heading - the field guide prints the heading from
 * where the player is standing on the line above, and "to the north-west"
 * beside its "to the south-west" read as the guide contradicting itself.
 */
function regions(map: WorldMapDefinition, tiles: readonly GridPosition[]): string {
  const parts = [...new Set(tiles.map((tile) => `the ${compass(map, tile)}`))];
  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${listed} of the map`;
}

/** Walking steps from the landing to the nearest of these tiles. */
function walk(ground: Ground, tiles: readonly GridPosition[]): number {
  return Math.min(...tiles.map((tile) => ground.steps[tile.y][tile.x]));
}

function titleCase(label: string): string {
  return label.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, gap: string, letter: string) => `${gap}${letter.toUpperCase()}`);
}

function allTiles(map: WorldMapDefinition): GridPosition[] {
  return Array.from({ length: map.width * map.height }, (_, index) => ({
    x: index % map.width,
    y: Math.floor(index / map.width),
  }));
}

function tileKey(tile: GridPosition): string {
  return `${tile.x},${tile.y}`;
}

function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  }
  return hash >>> 0;
}
