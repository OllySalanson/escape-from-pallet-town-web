import type { BaseScreen } from '../base/doors';
import { getItemById, type ErrandItemId, type ItemId } from '../items';
import type { ContractPokemon } from '../objectives/contracts';
import { availableInsertionIds, frontDoorFor } from '../run/runGeneration';
import type { CharacterDesignId } from '../world/characterDesigns';
import { districtsForMap } from '../world/districts';
import type { WorldLoot } from '../world/loot';
import { worldMapName, type BuiltInMapId } from '../worldMap';

/**
 * Errands: a favour one of the four people at base asks of you, by name, in
 * their own building.
 *
 * The contract board is work from nobody in particular. An errand is the
 * opposite on purpose - Professor Oak wants his parcel, Brock wants his crate
 * - and what makes it a *raid* decision rather than a fetch quest is that the
 * thing is real: it lies in one place on one map, it takes its squares in the
 * pack like any find, so doing the favour means leaving loot on the ground to
 * carry it, and it is lost with the pack like everything else. A wipe with it
 * on your back is something you then tell them about, because they ask.
 *
 * The shape is the tutorial's quest (`Quests/QuestBase.cs`: a name, words for
 * starting, for being in progress and for completing, the item required and
 * the item rewarded; `Quest.cs`: a status of none, started or completed, saved
 * by name). What is taken is that model, not its code, and two things are
 * added because a raid can lose what a Unity inventory never does: the place
 * the thing lies, and words for when it was found and lost. The save keeps one
 * small record per errand (`ErrandRecord`) - started or done, and how often its
 * thing has been picked up and how many of those losses the giver has already
 * been told of - and everything else is derived: whether there is anything to
 * say on a screen, whether the thing is laid on a raid, what a door says.
 */

/** What an errand pays, once, when its thing is handed over. */
export interface ErrandReward {
  /** Into the vault. Any item, gear included: an errand is done once and never repeats. */
  readonly items: readonly { readonly itemId: ItemId; readonly quantity: number }[];
  /** Into the vault, fit, as a contract's Pokemon arrive. */
  readonly pokemon?: readonly ContractPokemon[];
  /** What is said as it is handed over, in FireRed's own form: "You received ...". */
  readonly received: string;
  /** The reward in a few words, for the drop-in screen and the field guide. */
  readonly summary: string;
}

export interface Errand {
  readonly id: string;
  /** Whose building it is asked in: the keeper's screen, as `base/doors.ts` names it. */
  readonly giver: BaseScreen;
  readonly speaker: CharacterDesignId;
  /** The giver's name, as their first words name them. */
  readonly name: string;
  /** The thing: what lies on the map, what takes the squares, what is handed over. */
  readonly itemId: ErrandItemId;
  readonly mapId: BuiltInMapId;
  /**
   * The district it lies in (`world/districts.ts`). It is laid as a prize is,
   * on a tile of that place that moves every raid, because the giver tells you
   * the place and a place is what a player can walk to.
   */
  readonly district: string;
  /** Said the first time the giver's screen opens once the errand can be done. */
  readonly asks: readonly string[];
  /** Said when the thing is handed over, before the reward. */
  readonly thanks: readonly string[];
  /** Said the first time the giver's screen opens after the thing was found and not brought home. */
  readonly lost: readonly string[];
  readonly reward: ErrandReward;
}

/**
 * The first four, one for each person at base, each in a different country
 * and each a different weight in the pack: Oak's parcel is two squares out of
 * the city, Joy's bag two off a farm, Brock's crate four - the whole base
 * secure container - out of a quarry, and Bill's amber one out of the wood.
 * Every line that names a place or a size is held to the data by
 * `errands.test.ts`, so the words cannot drift from where the thing is.
 */
export const ERRANDS: readonly Errand[] = [
  {
    id: 'oaks-parcel',
    giver: 'raid',
    speaker: 'prof-oak',
    name: 'Professor Oak',
    itemId: 'oaks-parcel',
    mapId: 'viridian-city',
    // FireRed's errand, in FireRed's place: the Poké Mart stands on the square.
    district: 'viridian-center-square',
    asks: [
      'Oh, before you go! I have a parcel on order from the Poké Mart in Viridian City, and nobody has brought it out to me.',
      'It will be somewhere about CENTER SQUARE, by the Mart. It takes 2 squares of your pack, mind.',
      'Bring it here and I will make it worth your while.',
    ],
    // The first two lines are FireRed's own, when the parcel is delivered.
    thanks: [
      'Ah! It’s the custom Poké Ball! I had it on order. Thank you!',
      'Now, these are for you. Throw one at a weakened wild Pokémon and it comes home with you.',
    ],
    lost: [
      'You found my parcel, and it was lost with your pack? Well. You came home, and that matters more.',
      'The Mart will send another. It will be about CENTER SQUARE again.',
    ],
    // FireRed pays the parcel with the Pokédex and five Poké Balls. The
    // Pokédex is already in hand; the five are its own.
    reward: {
      items: [{ itemId: 'poke-ball', quantity: 5 }],
      received: 'You received five Poké Balls.',
      summary: 'Five Poké Balls',
    },
  },
  {
    id: 'medicine-bag',
    giver: 'stash',
    speaker: 'nurse-joy',
    name: 'Nurse Joy',
    itemId: 'medicine-bag',
    mapId: 'route-1',
    district: 'route-1-steading',
    asks: [
      'Could I ask a favour? We lent our spare medicine bag to THE STEADING on Route 1 when their Pokémon were poorly.',
      'It never came back. It is only 2 squares of your pack, but we do need it.',
    ],
    thanks: [
      'Our medicine bag! Thank you so much - and everything is still in it.',
      'Please take these Leftovers. Give them to a Pokémon to hold, and it will recover a little HP at the end of every turn.',
    ],
    lost: [
      'Oh dear. You had the bag, and it was lost with your pack?',
      'As long as you came back safe. The steading keeps a spare, so there will be another at THE STEADING.',
    ],
    // Not FireRed's - no Joy there gives anything - but it is the one piece of
    // gear that does her job: it heals, a little, every turn.
    reward: {
      items: [{ itemId: 'leftovers', quantity: 1 }],
      received: 'You received Leftovers.',
      summary: 'Leftovers, to hold',
    },
  },
  {
    id: 'brocks-crate',
    giver: 'workshop',
    speaker: 'brock',
    name: 'Brock',
    itemId: 'brocks-crate',
    mapId: 'pallet-town',
    district: 'pallet-quarry',
    asks: [
      'Before you go - I left a crate of my tools at THE QUARRY in Pallet Town, and I could use them back.',
      'It is heavy. 4 squares of your pack, which is 4 squares of loot you leave on the ground.',
      'I know it is a lot to ask. I will make it worth your while.',
    ],
    // The second line is what FireRed's Brock says as he hands TM39 over.
    thanks: [
      'My crate! And not a bolt missing. I owe you one.',
      'Wait! Take this with you. TM39 contains Rock Tomb. It hurls boulders at the foe and lowers its Speed.',
    ],
    lost: [
      'You had my crate, and the raid went down with it? ... You came back. That is what counts.',
      'There is another crate of mine at THE QUARRY. Have another go when you are ready.',
    ],
    // FireRed's own: Brock hands TM39 to whoever beats him.
    reward: {
      items: [{ itemId: 'tm39-rock-tomb', quantity: 1 }],
      received: 'You received TM39 from Brock.',
      summary: 'TM39 Rock Tomb',
    },
  },
  {
    id: 'old-amber',
    giver: 'trader',
    speaker: 'bill',
    name: 'Bill',
    itemId: 'old-amber',
    mapId: 'viridian-forest',
    // Amber is old tree resin, and this is the wood's sap pool.
    district: 'forest-sap-pool',
    asks: [
      'Say, you are going out there anyway, right? There is a lump of OLD AMBER in Viridian Forest, down by the SAP POOL.',
      'It is only 1 square of your pack, but it would be the best thing in my cabinet. Bring it back and you get something good for it.',
    ],
    thanks: [
      'That is it! Look - there is something inside it! It is going right on the shelf.',
      'And a deal is a deal. This Eevee has been with me for years. It will do better out there with you.',
    ],
    lost: [
      'Gone? You had it, and your pack went down with it? Aw, man...',
      'Well, where there is one bit of amber there is another. The SAP POOL still drips.',
    ],
    // Not FireRed's, but Bill's all the same: in HeartGold and SoulSilver he
    // hands the player an Eevee, at level 5.
    reward: {
      items: [],
      pokemon: [{ speciesId: 'eevee', level: 5 }],
      received: 'You received an Eevee.',
      summary: 'An Eevee',
    },
  },
];

/** What the save keeps about one errand: the tutorial's status, and the raid's losses. */
export interface ErrandRecord {
  readonly id: string;
  readonly status: 'started' | 'completed';
  /** How many times its thing has been picked up in a raid. Written at the moment it is. */
  readonly found: number;
  /** How many of those the giver has already said something about. */
  readonly lossesHeard: number;
}

export function getErrand(id: string): Errand | undefined {
  return ERRANDS.find((errand) => errand.id === id);
}

/** The errand an item belongs to, if it is somebody's. */
export function errandForItem(itemId: string): Errand | undefined {
  return ERRANDS.find((errand) => errand.itemId === itemId);
}

/** The errand a keeper gives. One each, so far. */
export function errandOf(giver: BaseScreen): Errand | undefined {
  return ERRANDS.find((errand) => errand.giver === giver);
}

export function errandRecord(
  records: readonly ErrandRecord[] | undefined,
  id: string,
): ErrandRecord | undefined {
  return records?.find((record) => record.id === id);
}

/** The place an errand's thing lies, as a district plate names it. */
export function errandPlace(errand: Errand): string {
  return districtsForMap(errand.mapId).find((district) => district.id === errand.district)?.name ?? '';
}

/** "THE QUARRY, Pallet Town". */
export function errandWhere(errand: Errand): string {
  return `${errandPlace(errand)}, ${worldMapName(errand.mapId)}`;
}

/** How many squares the thing takes. */
export function errandSquares(errand: Errand): number {
  const footprint = getItemById(errand.itemId)?.footprint;
  return footprint ? footprint.width * footprint.height : 1;
}

/** The thing's own name. */
export function errandThing(errand: Errand): string {
  return getItemById(errand.itemId)?.displayName ?? errand.itemId;
}

/** The part of the save an errand reads. */
export interface ErrandProgress {
  readonly unlockedInsertions: readonly string[];
  readonly reachedInsertions: readonly string[];
  readonly completedContracts: readonly string[];
  readonly errands?: readonly ErrandRecord[];
}

/**
 * Whether an errand can be done from where the player stands: its map has to
 * be one they can deploy to, by its front door. Asking for a crate on a map
 * nobody can drop into would be the one kind of request this game refuses to
 * make (`errands.test.ts` holds the other half - that the place is reachable
 * from that door with every gate still shut).
 */
export function errandOpen(errand: Errand, progress: ErrandProgress): boolean {
  const door = frontDoorFor(errand.mapId);
  return door !== undefined && availableInsertionIds(progress).includes(door.id);
}

/** What a giver has to say as their screen opens, if anything. */
export type ErrandBeat =
  | { readonly kind: 'ask'; readonly errand: Errand }
  | { readonly kind: 'thanks'; readonly errand: Errand }
  | { readonly kind: 'lost'; readonly errand: Errand };

/**
 * The one thing a giver says as their screen opens, in the order it matters:
 * the thing is home, so they take it and pay; it was found and lost, so they
 * ask about it; or they have not asked yet and the errand can be done, so they
 * ask. An errand in hand and in progress says nothing - the drop-in screen and
 * the field guide carry it from there, and a giver who repeated the request
 * every visit would be a nag rather than a person.
 */
export function errandBeat(
  giver: BaseScreen,
  progress: ErrandProgress,
  held: (itemId: ItemId) => number,
): ErrandBeat | undefined {
  const errand = errandOf(giver);
  if (!errand) {
    return undefined;
  }
  const record = errandRecord(progress.errands, errand.id);
  if (record?.status === 'completed') {
    return undefined;
  }
  if (record === undefined) {
    return errandOpen(errand, progress) ? { kind: 'ask', errand } : undefined;
  }
  if (held(errand.itemId) > 0) {
    return { kind: 'thanks', errand };
  }
  return record.found > record.lossesHeard ? { kind: 'lost', errand } : undefined;
}

/** Errands asked and not yet done, in catalogue order. */
export function errandsInHand(progress: Pick<ErrandProgress, 'errands'>): readonly Errand[] {
  return ERRANDS.filter((errand) => errandRecord(progress.errands, errand.id)?.status === 'started');
}

/**
 * The errands whose thing goes on the ground this raid: asked, not done, and
 * not already sitting in the vault waiting to be handed over - there is one
 * parcel, not a parcel a raid.
 */
export function errandsToLay(
  progress: Pick<ErrandProgress, 'errands'>,
  held: (itemId: ItemId) => number,
): readonly Errand[] {
  return errandsInHand(progress).filter((errand) => held(errand.itemId) === 0);
}

/** The loot row an errand's thing is laid as: a prize, seated in its place. */
export function errandLoot(errand: Errand): WorldLoot {
  return {
    id: `errand-${errand.id}`,
    // Only a fallback, as every authored loot position is; `generateRunPlan`
    // seats it on a tile of its district.
    position: { x: 0, y: 0 },
    itemId: errand.itemId,
    quantity: 1,
    // A prize (`world/loot.ts`): drawn with a light on it, named from across a
    // clearing and on the HUD once seen. It is always laid, so the odds are one.
    chance: 1,
    district: errand.district,
  };
}

/** Records an errand as asked. Asking twice changes nothing. */
export function withErrandAsked(records: readonly ErrandRecord[] | undefined, id: string): readonly ErrandRecord[] {
  const list = records ?? [];
  return errandRecord(list, id) ? list : [...list, { id, status: 'started', found: 0, lossesHeard: 0 }];
}

/** Records an errand's thing as picked up in a raid. Only an errand in hand counts. */
export function withErrandFound(records: readonly ErrandRecord[] | undefined, id: string): readonly ErrandRecord[] {
  return (records ?? []).map((record) =>
    record.id === id && record.status === 'started' ? { ...record, found: record.found + 1 } : record,
  );
}

/** Records that the giver has said their piece about every loss so far. */
export function withErrandLossesHeard(
  records: readonly ErrandRecord[] | undefined,
  id: string,
): readonly ErrandRecord[] {
  return (records ?? []).map((record) => (record.id === id ? { ...record, lossesHeard: record.found } : record));
}

/** Records an errand as done. */
export function withErrandCompleted(
  records: readonly ErrandRecord[] | undefined,
  id: string,
): readonly ErrandRecord[] {
  return (records ?? []).map((record) =>
    record.id === id ? { ...record, status: 'completed' as const, lossesHeard: record.found } : record,
  );
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;

/** The errand records read back out of a save: errands that still exist, once each. */
export function clampErrandRecords(value: unknown): readonly ErrandRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const records: ErrandRecord[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const { id, status, found, lossesHeard } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !getErrand(id) || seen.has(id)) {
      continue;
    }
    if (status !== 'started' && status !== 'completed') {
      continue;
    }
    seen.add(id);
    const times = count(found);
    records.push({ id, status, found: times, lossesHeard: Math.min(times, count(lossesHeard)) });
  }
  return records;
}
