import type { RaidContract } from '../objectives';
import { getSpeciesById } from '../pokemon/species';
import type { WildEncounterTable } from '../pokemon/encounters';
import { isDropInPoint, RUN_INSERTIONS, type RunInsertion, type RunInsertionId } from '../run/runGeneration';
import type { MapRaidRecord } from '../save/SaveManager';
import { districtAt, districtsForMap, type MapDistrict } from '../world/districts';
import { EXTRACTION_POINTS, extractionRequirementText, type ExtractionPoint } from '../world/extractionPoints';
import { FIELD_MOVES } from '../world/fieldMoves';
import { gatesForMap, isGateOpen, openedDoors, type MapGate } from '../world/gates';
import { HUNTER_TIERS } from '../world/hunter';
import { buildMinimap, type Minimap, type MinimapMark } from '../world/minimap';
import { surveyedTiles, type SurveyRecord } from '../world/survey';
import { bossEncounters, createRunTrainerEncounters, withoutDefeatedBosses } from '../world/trainers';
import { exitsOpenForGood, withWorkedExitsOpen, workedLandmarksOn } from '../world/workedLandmarks';
import { WORLD_MAP_NAMES, type WorldMapDefinition, type WorldMapId } from '../worldMap';

/**
 * Everything the drop-in screen says about a place, worked out without Phaser.
 *
 * Choosing where to go is a decision, and it was a list of four names in the
 * corner of the loadout. This is what a player would actually want to know
 * about a place before they commit a party to it, and every line of it is
 * derived from the same data the raid itself is built from - the map in the
 * gate state this save has earned, the trainers still standing on it, the
 * wildlife authored beside each district's name - so a redrawn map, a beaten
 * boss or a retuned encounter table changes this screen with nothing to update
 * here.
 *
 * # How hard a place is, and why it is not typed in
 *
 * There is exactly one difficulty ladder in this game: `HUNTER_TIERS`, whose
 * four rungs are the levels a party crosses to open a harder hunter. A place is
 * put on that same ladder by the highest level of opposition it can still field
 * - the top of its wildlife, and the top of any trainer party still standing on
 * it - so "grade 3" means the same thing here as "hunter tier 3" does on the
 * final check, and beating a boss visibly lowers the grade of the map they held.
 *
 * What is deliberately *not* done here is play the fights out.
 * `world/encounterMeasure.ts` gives the real number - the share of encounters a
 * given partner actually wins over the real engine - and `tools/encounters/`
 * prints it while a table is being tuned, but it is two hundred battles per
 * level of every entry of every table, which is minutes rather than a frame.
 * So the screen states the levels, which are facts, and the mean level of what
 * is met, which is arithmetic over the table's own weights, and leaves the
 * measured win rate to the tool that can afford it.
 */

export interface PlaceGrade {
  /** Where this place sits on the hunter ladder's own rungs, one-based. */
  readonly rung: number;
  readonly rungs: number;
  /** The highest level of anything still standing here. */
  readonly opposition: number;
  /** The level band of the wildlife, and what is met on average. */
  readonly wild: { readonly min: number; readonly max: number; readonly mean: number };
  /** The toughest party a trainer still on this map fields, or 0 for none. */
  readonly trainer: number;
  readonly trainers: number;
  readonly bossesHeld: number;
  readonly bossesBeaten: number;
  /** The strongest Pokemon in the loadout, for the line that compares the two. */
  readonly yourBest: number;
}

export interface DoorLine {
  readonly label: string;
  /** Who or what holds it: a keeper's name, or the move that opens it. */
  readonly bossName: string;
  /** Which of the two that name is, so the row can word it. */
  readonly heldBy: 'boss' | 'move';
  readonly open: boolean;
}

export interface ExitLine {
  readonly label: string;
  /** OPEN, OPENS IN 25s, WORK THE SLUICE WHEEL - the map's own words. */
  readonly opens: string;
  /** Open because a contract finished the landmark that used to seal it. */
  readonly worked?: boolean;
}

export interface WildlifeLine {
  readonly place: string;
  /**
   * Whether the player has walked any of it. What lives in a place you have
   * never been is not something base could tell you, and a screen that listed
   * it would hand over the answer the vast maps are built to make you go and
   * find. The count of unknown places is said instead, which is the invitation.
   */
  readonly known: boolean;
  readonly species: readonly { readonly name: string; readonly min: number; readonly max: number }[];
}

export interface PlaceRecord {
  readonly deployed: number;
  readonly extracted: number;
  readonly wiped: number;
  /** Districts with any walked tile in them, and how many the map has. */
  readonly districtsKnown: number;
  readonly districts: number;
  /** Share of the map's walkable ground that has been walked, 0 to 1. */
  readonly surveyed: number;
}

export interface DropInBriefing {
  readonly insertion: RunInsertion;
  readonly mapId: WorldMapId;
  readonly mapName: string;
  /** A second entrance on a map, which does not carry the map's own name. */
  readonly isDropIn: boolean;
  readonly grade: PlaceGrade;
  readonly record: PlaceRecord;
  readonly doors: readonly DoorLine[];
  readonly exits: readonly ExitLine[];
  readonly wildlife: readonly WildlifeLine[];
  readonly contract: RaidContract | undefined;
}

/** What a briefing is worked out against: this save, and this loadout. */
export interface DropInContext {
  readonly map: WorldMapDefinition;
  readonly defeatedBosses: readonly string[];
  /** Contracts banked, which is what keeps a landmark worked (`workedLandmarks`). */
  readonly completedContracts: readonly string[];
  /**
   * The field-move doors this save has worked open. Kept beside the boss list
   * rather than merged into it because the screen names a keeper for one and a
   * move for the other; `openedDoors()` is what turns the two into the one list
   * the gate rules read.
   */
  readonly openedGates: readonly string[];
  readonly raidRecord: Readonly<Record<string, MapRaidRecord>> | undefined;
  readonly surveyed: SurveyRecord | undefined;
  readonly insertionIds: readonly RunInsertionId[];
  readonly partyLevels: readonly number[];
  readonly contract: RaidContract | undefined;
}

/** Every table a raid on this map can roll on, with the place it belongs to. */
function wildlifeOf(mapId: WorldMapId, fallback: WildEncounterTable | undefined): readonly {
  readonly district: MapDistrict | undefined;
  readonly table: WildEncounterTable;
}[] {
  const districts = districtsForMap(mapId);
  if (districts.length === 0) {
    return fallback ? [{ district: undefined, table: fallback }] : [];
  }
  return districts
    .map((district) => ({ district, table: district.encounters ?? fallback }))
    .filter((entry): entry is { district: MapDistrict; table: WildEncounterTable } => entry.table !== undefined);
}

/** The encounter-weighted mean level of one table: arithmetic, not a battle. */
function meanLevelOf(table: WildEncounterTable): number {
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) {
    return 0;
  }
  return table.entries.reduce(
    (sum, entry) => sum + ((entry.minLevel + entry.maxLevel) / 2) * (entry.weight / total),
    0,
  );
}

/**
 * Where a place sits on the hunter's own four rungs.
 *
 * Read exactly as `hunterThreatFor` reads a party: the highest rung whose level
 * the opposition is above. A wood whose wildlife tops out at Lv 10 and whose
 * lookout fields Lv 12 sits a rung above a town whose miller fields Lv 11,
 * because that is the rung the two of them cross.
 */
function gradeFor(opposition: number): number {
  return (
    HUNTER_TIERS.reduce(
      (selected, tier, index) => (opposition > tier.level ? index : selected),
      0,
    ) + 1
  );
}

export function buildDropInBriefing(
  insertionId: RunInsertionId,
  context: DropInContext,
): DropInBriefing {
  const insertion = RUN_INSERTIONS[insertionId];
  const mapId = insertion.mapId;
  const gates = gatesForMap(mapId);
  const opened = openedDoors(context);
  const standing = withoutDefeatedBosses(createRunTrainerEncounters(), context.defeatedBosses).filter(
    (trainer) => trainer.mapId === mapId,
  );
  const trainerCeiling = standing.reduce(
    (best, encounter) =>
      Math.max(best, ...encounter.trainer.party.map((pokemon) => pokemon.level)),
    0,
  );

  const tables = wildlifeOf(mapId, context.map.encounters);
  const levels = tables.flatMap(({ table }) => table.entries.flatMap((entry) => [entry.minLevel, entry.maxLevel]));
  const wild = {
    min: levels.length === 0 ? 0 : Math.min(...levels),
    max: levels.length === 0 ? 0 : Math.max(...levels),
    mean:
      tables.length === 0
        ? 0
        : tables.reduce((sum, { table }) => sum + meanLevelOf(table), 0) / tables.length,
  };
  const opposition = Math.max(wild.max, trainerCeiling);
  const bosses = bossEncounters(createRunTrainerEncounters()).filter((boss) => boss.mapId === mapId);
  const beaten = bosses.filter((boss) => context.defeatedBosses.includes(boss.bossId));

  const openedByWork = exitsOpenForGood(mapId, context.completedContracts);
  const districts = districtsForMap(mapId);
  const walked = surveyedTiles(context.surveyed?.[mapId], context.map.width);
  // Asked through `districtAt`, not off the rectangles: districts overlap and
  // the first listed wins, so a tile inside two of them has been walked in
  // exactly one place - the one whose name the plate raised when you stood on
  // it. Reading the rectangles instead credited the player with finding a
  // district they had only walked past the corner of.
  const reachedIds = new Set<string>();
  for (const index of walked) {
    const district = districtAt(mapId, {
      x: index % context.map.width,
      y: Math.floor(index / context.map.width),
    });
    if (district) {
      reachedIds.add(district.id);
    }
  }
  const reached = (district: MapDistrict): boolean => reachedIds.has(district.id);
  const districtsKnown = districts.filter(reached).length;
  let walkable = 0;
  let knownWalkable = 0;
  for (let y = 0; y < context.map.height; y += 1) {
    for (let x = 0; x < context.map.width; x += 1) {
      if (context.map.collision[y][x]) {
        continue;
      }
      walkable += 1;
      if (walked.has(y * context.map.width + x)) {
        knownWalkable += 1;
      }
    }
  }
  const held = context.raidRecord?.[mapId] ?? { deployed: 0, extracted: 0, wiped: 0 };

  return {
    insertion,
    mapId,
    mapName: WORLD_MAP_NAMES[mapId],
    isDropIn: isDropInPoint(insertion),
    grade: {
      rung: gradeFor(opposition),
      rungs: HUNTER_TIERS.length,
      opposition,
      wild,
      trainer: trainerCeiling,
      trainers: standing.length,
      bossesHeld: bosses.length - beaten.length,
      bossesBeaten: beaten.length,
      yourBest: context.partyLevels.reduce((best, level) => Math.max(best, level), 0),
    },
    record: {
      ...held,
      districtsKnown,
      districts: districts.length,
      surveyed: walkable === 0 ? 0 : knownWalkable / walkable,
    },
    doors: gates.map((gate) => ({
      label: gate.label,
      // A field-move door has no keeper: what it wants is a move, and the row
      // says so in the same place a boss's name would have gone.
      bossName:
        gate.fieldMove !== undefined
          ? FIELD_MOVES[gate.fieldMove].label
          : (bosses.find((boss) => boss.bossId === gate.bossId)?.trainer.name ?? 'SOMEBODY'),
      heldBy: gate.fieldMove !== undefined ? ('move' as const) : ('boss' as const),
      open: isGateOpen(gate, opened),
    })),
    exits: withWorkedExitsOpen(
      EXTRACTION_POINTS.filter((point) => point.mapId === mapId),
      context.completedContracts,
    ).map((point) => ({
      label: point.label,
      opens: extractionRequirementText(point, 0),
      // Named apart from an exit that was always open, because this one is the
      // player's own work and this screen is where they come to see it.
      ...(openedByWork.includes(point.label) ? { worked: true } : {}),
    })),
    wildlife: tables.map(({ district, table }) => ({
      place: district?.name ?? WORLD_MAP_NAMES[mapId].toUpperCase(),
      known: district === undefined || reached(district),
      species: [
        ...new Map(
          table.entries.map((entry) => [
            entry.speciesId,
            {
              name: getSpeciesById(entry.speciesId)?.name ?? entry.speciesId,
              min: entry.minLevel,
              max: entry.maxLevel,
            },
          ]),
        ).values(),
      ],
    })),
    contract: context.contract,
  };
}

/**
 * How a place's grade reads in one sentence, against the party in the loadout.
 *
 * It names the two levels rather than a word like "hard", because the levels
 * are the fact and a word would be an opinion about a party this screen already
 * knows the strength of.
 */
export function gradeLine(grade: PlaceGrade): string {
  // The wildlife, because every step in tall grass rolls on it and a trainer is
  // a toll on one route. Stated as levels rather than as a word like "hard":
  // the levels are facts, and a word would be an opinion about a party this
  // screen already knows the strength of. What the trainers field is a fact of
  // the place and is listed beside the picture rather than said again here.
  if (grade.wild.max === 0) {
    return 'Nothing wild lives here';
  }
  const band = `Wild Lv ${grade.wild.min}-${grade.wild.max}`;
  if (grade.yourBest === 0) {
    return `${band} - pick a party to compare`;
  }
  const gap = grade.yourBest - grade.wild.max;
  return gap >= 2
    ? `${band}, under your Lv ${grade.yourBest}`
    : gap >= -1
      ? `${band}, an even match for your Lv ${grade.yourBest}`
      : `${band}, over your Lv ${grade.yourBest} by ${-gap}`;
}

/**
 * The picture of a place: the map drawn one pixel to the tile, dark everywhere
 * nobody has walked, with your own doors and the ones you have opened lit.
 *
 * A front door and a drop-in point you have reached are lit whether or not the
 * survey has reached them, because they are yours - which is also what stops a
 * fresh save opening on a black square. A door a boss was holding lights when
 * it opens, so beating one changes this picture at base: that is the payoff the
 * whole screen is built around.
 */
export function placePicture(
  insertionId: RunInsertionId,
  context: DropInContext,
): Minimap {
  const insertion = RUN_INSERTIONS[insertionId];
  const mapId = insertion.mapId;
  const ours = context.insertionIds
    .map((id) => RUN_INSERTIONS[id])
    .filter((entry) => entry.mapId === mapId);
  const open = openedDoors(context);
  const opened = gatesForMap(mapId).filter((gate) => isGateOpen(gate, open));
  // A landmark this save finished with. It is lit and glyphed whether or not
  // the survey has reached it, for the same reason a door you opened is: it is
  // yours, and watching the map carry your own work is what this screen is for.
  const worked = workedLandmarksOn(mapId, context.completedContracts)
    .map((work) => context.map.pois.find((poi) => poi.id === work.poiId))
    .filter((poi): poi is (typeof context.map.pois)[number] => poi !== undefined);
  const marks: MinimapMark[] = [
    ...ours.map((entry) => ({
      position: entry.position,
      char: entry.id === insertionId ? 'i' : 'I',
      always: true,
    })),
    ...gatesForMap(mapId).flatMap((gate) =>
      gate.tiles.map((tile) => ({
        position: tile,
        char: isGateOpen(gate, open) ? 'O' : 'H',
        always: isGateOpen(gate, open),
      })),
    ),
    ...EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map((point) => ({
      position: point.position,
      char: 'X',
    })),
    ...worked.map((poi) => ({ position: poi.position, char: 'K', always: true })),
  ];
  return buildMinimap({
    map: context.map,
    surveyed: surveyedTiles(context.surveyed?.[mapId], context.map.width),
    lit: [
      ...ours.map((entry) => entry.position),
      ...opened.flatMap((gate) => gate.tiles),
      ...worked.map((poi) => poi.position),
    ],
    marks,
  });
}

/** Re-exported so the screen can name the pieces it is drawing. */
export type { ExtractionPoint, MapGate, Minimap };
