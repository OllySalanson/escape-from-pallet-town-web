/**
 * Greystone Vale in quarters: the open middle of the vale, and the parts of it a
 * gym holds shut until its leader is beaten (the captain, 5 Nov 2026: gyms as
 * access levels into different quarters, each with a team that beats it).
 *
 * The gate itself is nothing new. A gym leader is a boss in `trainers.ts`, the
 * two crossings into the quarter are that boss's `boss` doors in the stitched
 * file (`tools/mapcraft/worlds/greystoneVale/plan.ts` marks them `held`), and
 * beating the leader opens both for good, in the raid that won it, exactly as
 * every keeper's doors open. The badge is the same fact read the other way
 * (`base/badgeCase.ts`). What this file adds is the quarter as a *place*: which
 * landings lie inside it, so a save is not offered a way in past the gym
 * (`availableInsertionIds`), which keepers stand inside it, so their doors are
 * only ever asked about once the gym's are open (`gateStatesToVerify`), and the
 * words the game says about it.
 *
 * The plan for all four quarters is firstmate's `eptw-gyms-loadouts-plan`:
 * Misty holds the Coast, and the Coast fights the way her gym does - rain over
 * every place of it, her swimmers in its grass, two trainers who play her
 * combo and a keeper pitched above her (`coastQuarter.test.ts`). Koga holds the
 * Marsh next, standing in his gym only for a holder of Misty's badge
 * (`RunTrainerEncounter.challengedAfter`), and Lt. Surge's Station is the row
 * still to come.
 *
 * Deliberately free of imports: the landing filter, the gates and the badge
 * case all read it, and it must sit at the bottom of the graph they share.
 */

export interface ValeGym {
  /** The leader's boss id (`trainers.ts`), which is what the save keeps. */
  readonly bossId: string;
  /** The leader, as dialogue names them. */
  readonly leader: string;
  /** The badge they give, which is the same fact as their doors being open. */
  readonly badge: string;
  /** The gym building, as the stitched file names it. */
  readonly building: string;
  /** Where the gym stands, as the map names the place. */
  readonly standsIn: string;
  /**
   * Who they are when they are hunting (`world/hunters.ts`): the leaders are
   * the same people as the rivals, so their face in the hall is the hunter's.
   */
  readonly rival: string;
  /**
   * What the Gym Guide at the Raid Arena's door says about them before the
   * badge is won, in FireRed's Gym Guide's manner: the gym, and the types that
   * do well there. Facts, never the answer: the pairs are the player's to find.
   */
  readonly advice: readonly string[];
  /**
   * Their words in THE RAID ARENA, where once met they spar with their real gym
   * team for nothing (`base/gymPractice.ts`): the offer, then how it went.
   */
  readonly practice: {
    readonly offer: string;
    /** Their last Pokémon fainting in a practice: their gym's own words would hand over a badge. */
    readonly beaten: string;
    readonly won: string;
    readonly lost: string;
  };
}

export interface ValeQuarter {
  readonly id: string;
  /** What the quarter is called, in capitals as the map says it. */
  readonly name: string;
  /** Who holds it shut, if anybody: the open vale has no gym. */
  readonly gym?: ValeGym;
  /** Its districts, by the names the stitched file gives them. */
  readonly districts: readonly string[];
  /** The landings inside it, which a save is offered only once its gym is beaten. */
  readonly landings: readonly string[];
  /**
   * Keepers whose doors stand inside the quarter. A door behind the gym's is only
   * ever walked to once the gym's are open, so the maps are asked about it in
   * that state rather than alone (`gates.ts`, `gateStatesToVerify`).
   */
  readonly keepersInside?: readonly string[];
  /** What the quarter throws at a team, said plainly, a line each. */
  readonly threat: readonly string[];
}

/** Misty's boss id: her gym, her two doors and her badge are all this one word. */
export const MISTY_BOSS_ID = 'vale-gym-misty';

/** Koga's: his gym, his doors and the SOUL BADGE, and he stands only for a holder of Misty's. */
export const KOGA_BOSS_ID = 'vale-gym-koga';

export const VALE_QUARTERS: readonly ValeQuarter[] = [
  {
    id: 'the-vale',
    name: 'THE VALE',
    districts: [
      'MILLBROOK',
      'HIGH MOOR',
      'REEDMERE',
      'THE CROSSING',
      'GULL STRAND',
      'GREYSTONE PEAKS',
      'PINE HOLLOW',
      'TANGLEWOOD',
      'ORCHARD TERRACES',
    ],
    landings: [
      'greystone-vale',
      'greystone-vale-moor-top',
      'greystone-vale-the-quarry',
      'greystone-vale-stepping-stones',
      'greystone-vale-the-strand',
      'greystone-vale-farmhouse',
    ],
    threat: [],
  },
  {
    id: 'the-coast',
    name: 'THE COAST',
    gym: {
      bossId: MISTY_BOSS_ID,
      leader: 'Misty',
      badge: 'CASCADE BADGE',
      building: 'Cerulean Gym',
      standsIn: 'GULL STRAND',
      rival: 'misty',
      advice: [
        'Next gym: CERULEAN GYM on GULL STRAND. MISTY holds THE COAST.',
        'Her Water types swim fast in her rain. Electric and Grass hit hard!',
      ],
      practice: {
        offer: 'MISTY: "Try my gym team? Same Pokémon, same rain, no stakes."',
        beaten: "Hmph! That's practice. No badge for practice!",
        won: 'MISTY: "Fine, that worked. Now do it where it counts!"',
        lost: 'MISTY: "That\'s what waits at the Cerulean Gym. Think on it!"',
      },
    },
    districts: ['THE SUNKEN QUARTER', "SMUGGLERS' COVE"],
    landings: ['greystone-vale-old-quay', 'greystone-vale-cove-steps'],
    keepersInside: ['vale-quay-keeper'],
    threat: [
      'Misty makes it rain, and in the rain her swimmers move first.',
      'Water hits half as hard again in the rain, and Fire half as hard.',
      'Electric and Grass hit Water twice as hard. A Psyduck stills the weather.',
    ],
  },
  {
    id: 'the-marsh',
    name: 'THE MARSH',
    gym: {
      bossId: KOGA_BOSS_ID,
      leader: 'Koga',
      badge: 'SOUL BADGE',
      building: 'Fuchsia Gym',
      standsIn: 'TANGLEWOOD',
      rival: 'koga',
      advice: [
        'Next gym: FUCHSIA GYM in TANGLEWOOD. KOGA holds THE MARSH.',
        'His Poison types float and wear you down. A Ghost shrugs them off!',
      ],
      practice: {
        offer: 'KOGA: "Spar with my gym team? Same poison. Nothing at stake."',
        beaten: 'Humph! A drill is a drill. No badge for a drill!',
        won: 'KOGA: "Fwahahaha! Good. Now do it in my gym."',
        lost: 'KOGA: "That is what waits in Fuchsia Gym. Poison is patient."',
      },
    },
    districts: ['SAFARI MARSH', 'THE WRECK'],
    landings: ['greystone-vale-rest-house', 'greystone-vale-salvage-camp'],
    threat: [
      'Touch anything here and it poisons you back.',
      "Koga's Koffing floats over Ground moves, and blows itself up.",
      'Normal and Poison do little to a Ghost. Fire and Flying never touch.',
    ],
  },
];

/** The gyms in the order a save must beat them (the captain: Misty, then Koga, then Lt. Surge). */
export function valeGyms(): readonly ValeGym[] {
  return VALE_QUARTERS.flatMap((quarter) => (quarter.gym ? [quarter.gym] : []));
}

/**
 * The gyms a save must have beaten before this one will fight: every gym ahead
 * of it in the order. A save that holds a gym's badge holds all of these too,
 * which is what lets the maps be asked about each gym's doors together with the
 * gyms before it, never alone (`gateStatesToVerify`).
 */
export function gymsBefore(bossId: string): readonly string[] {
  const order = valeGyms().map((gym) => gym.bossId);
  const at = order.indexOf(bossId);
  return at < 0 ? [] : order.slice(0, at);
}

/** The first gym in the order whose leader this save has not beaten, if any. */
export function nextGym(defeatedBosses: readonly string[]): ValeGym | undefined {
  return valeGyms().find((gym) => !defeatedBosses.includes(gym.bossId));
}

/** A gym by its leader's boss id. */
export function gymOf(bossId: string): ValeGym | undefined {
  return valeGyms().find((gym) => gym.bossId === bossId);
}

/**
 * The leaders this save has met in a raid - fought, won or lost
 * (`raidProgress.gymsMet`) - or beaten, in the order the gyms are met: who will
 * spar in THE RAID ARENA with their real team (the captain's pick: free practice,
 * once you have met that leader in a raid, so the first meeting stays a fright).
 */
export function leadersMet(progress: { readonly defeatedBosses: readonly string[]; readonly gymsMet?: readonly string[] }): readonly ValeGym[] {
  const met = new Set([...progress.defeatedBosses, ...(progress.gymsMet ?? [])]);
  return valeGyms().filter((gym) => met.has(gym.bossId));
}

/** A named place as the map holds it: its name and the rectangles it covers. */
export interface QuarterPlace {
  readonly name: string;
  readonly areas: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
}

/**
 * The quarter a named place lies in, out of every place on the map: the one
 * whose districts (the plan's, as the stitched file names them) hold it. A
 * district's own smaller places - THE OLD QUAY inside THE SUNKEN QUARTER - lie
 * in its quarter; a room, laid beside the outdoors, lies in none.
 */
export function quarterOfPlace(place: QuarterPlace, places: readonly QuarterPlace[]): ValeQuarter | undefined {
  const inside = (inner: QuarterPlace['areas'][number], outer: QuarterPlace['areas'][number]): boolean =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  return VALE_QUARTERS.find((quarter) =>
    places.some(
      (district) =>
        quarter.districts.includes(district.name) &&
        place.areas.length > 0 &&
        place.areas.every((area) => district.areas.some((outer) => inside(area, outer))),
    ),
  );
}

/** The quarter a landing lies in, if it lies in one. */
export function quarterOfLanding(insertionId: string): ValeQuarter | undefined {
  return VALE_QUARTERS.find((quarter) => quarter.landings.includes(insertionId));
}

/**
 * Whether a save that has opened these doors (`openedDoors` in `gates.ts`: the
 * bosses it beat, and the explorer run's every door) may land here: anywhere
 * outside a gym's quarter, and inside one once its leader's doors are open. A
 * landing held back stays in the save's `reachedInsertions`, so it comes back by
 * itself with the badge.
 */
export function isLandingOpen(insertionId: string, opened: readonly string[]): boolean {
  const gym = quarterOfLanding(insertionId)?.gym;
  return gym === undefined || opened.includes(gym.bossId);
}

/** The gym whose doors this keeper stands behind, if any (`keepersInside`). */
export function gymInFrontOf(bossId: string): string | undefined {
  return VALE_QUARTERS.find((quarter) => quarter.keepersInside?.includes(bossId))?.gym?.bossId;
}

/** The quarter a gym leader holds. */
export function quarterHeldBy(bossId: string): ValeQuarter | undefined {
  return VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === bossId);
}

/**
 * Landings a save has reached that its badges do not open yet, for the one line
 * of news at the harbour (`hub/firstWords.ts`): an old save that walked to the
 * Old Quay before Misty held it.
 */
export function landingsHeldBack(progress: {
  readonly reachedInsertions: readonly string[];
  readonly unlockedInsertions?: readonly string[];
  readonly defeatedBosses: readonly string[];
  readonly openedGates?: readonly string[];
}): readonly string[] {
  const opened = [...progress.defeatedBosses, ...(progress.openedGates ?? [])];
  return [...new Set([...progress.reachedInsertions, ...(progress.unlockedInsertions ?? [])])].filter(
    (id) => !isLandingOpen(id, opened),
  );
}
