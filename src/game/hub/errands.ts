import type { BaseScreen } from '../base/doors';
import { getItemById, type ErrandItemId, type ItemId } from '../items';
import type { ContractPokemon } from '../objectives/contracts';
import { availableInsertionIds, frontDoorFor } from '../run/runGeneration';
import type { CharacterDesignId } from '../world/characterDesigns';
import { districtsForMap, type MapDistrict } from '../world/districts';
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
  /**
   * What the door caption calls them, when the name is too long for the yard.
   * Oak's Lab sits a row lower than its neighbours, so a caption over it has
   * the 176 pixels between the Pokémon Center's roof and THE BOLTHOLE's, and
   * at the spawn the player stands under it: "Professor Oak has a favour to
   * ask" fitted neither, and the lab two steps away went unnamed. FireRed's
   * own short form is PROF. OAK.
   */
  readonly called?: string;
  /** The thing: what lies on the map, what takes the squares, what is handed over. */
  readonly itemId: ErrandItemId;
  readonly mapId: BuiltInMapId;
  /**
   * The place it lies in, as its district's plate names it (`errandDistrict`).
   * It is laid as a prize is, on a tile of that place that moves every raid,
   * because the giver tells you the place and a place is what a player can walk
   * to. Named rather than given by id because Greystone Vale is a stitched file
   * whose district ids are only their order in it (`filePrizes.ts` names its
   * places the same way).
   */
  readonly place: string;
  /**
   * Said in the dialogue box when the giver is spoken to and the errand can be
   * done: the scene, then what to fetch, where and how big it is - a box each,
   * which is all a favour gets before it is answered (`errandLines`).
   */
  readonly asks: readonly string[];
  /** The question the favour ends on, asked with YES and NOT NOW beneath it. */
  readonly question: string;
  /** Said to a YES. */
  readonly accepted: string;
  /** Said to a NOT NOW: it will be asked again after the next raid. */
  readonly declined: string;
  /** Said when the thing is handed over, before the reward. */
  readonly thanks: readonly string[];
  /**
   * Said the first time the giver is spoken to after the thing was found and
   * not brought home. Never that the pack went down: the same words follow a
   * raid that walked out after dropping the thing for room.
   */
  readonly lost: readonly string[];
  readonly reward: ErrandReward;
}

/**
 * The first four, one for each person at base, each in a different country
 * and each a different weight in the pack: Oak's parcel is two squares out of
 * the village, Joy's bag two off a farm, Brock's crate four - the whole base
 * secure container - out of a quarry, and Bill's amber one out of the wood.
 * They lie on Greystone Vale, the map in play: they were first laid on the
 * maps retired on 22 Oct, which left every one closed to a new save and a
 * favour already taken with nowhere to be finished. Every line that names a
 * place or a size is held to the data by `errands.test.ts`, so the words
 * cannot drift from where the thing is.
 */
export const ERRANDS: readonly Errand[] = [
  {
    id: 'oaks-parcel',
    giver: 'lab',
    speaker: 'prof-oak',
    name: 'Professor Oak',
    called: 'Prof. Oak',
    itemId: 'oaks-parcel',
    mapId: 'greystone-vale',
    // FireRed's errand, in the vale's FireRed place for it: the village every
    // road starts from, with a Poké Mart on its forecourt.
    place: 'MILLBROOK',
    asks: [
      'Before you go! I have a parcel waiting at the Millbrook Poké Mart.',
      'It is somewhere in MILLBROOK. It takes 2 squares of your pack.',
    ],
    question: 'Will you bring it to me?',
    accepted: 'Splendid! Walk out with it, and I will make it worth your while.',
    declined: 'Not to worry. I will ask again after your next raid.',
    // The first line is FireRed's own, when the parcel is delivered.
    thanks: ['Ah! It’s the custom Poké Ball! I had it on order. Thank you!', 'Now, these are for you.'],
    lost: [
      'My parcel never made it home? Well, you did, and that matters more.',
      'The Mart will send another. It will be in MILLBROOK again.',
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
    mapId: 'greystone-vale',
    // The vale's farm, down the terraces in the south-east.
    place: 'ORCHARD TERRACES',
    asks: [
      'Could I ask a favour? We lent our medicine bag to the farm.',
      'It is at ORCHARD TERRACES, and it takes 2 squares of your pack.',
    ],
    question: 'Will you bring it home for us?',
    accepted: 'Thank you so much! Do come back safe.',
    declined: 'Of course. I will ask again after your next raid.',
    thanks: [
      'Our medicine bag! Thank you so much - everything is still in it.',
      'Take these Leftovers. A Pokémon holding them heals every turn.',
    ],
    lost: [
      'Oh dear. You had the bag, and it never made it back?',
      'As long as you are safe. The farm has a spare at ORCHARD TERRACES.',
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
    mapId: 'greystone-vale',
    // The pass climbs past quarry benches to the caves: Brock's kind of rock.
    place: 'GREYSTONE PEAKS',
    asks: [
      'I left a crate of my tools at the quarry up in GREYSTONE PEAKS.',
      'It is heavy: 4 squares of your pack, and loot you leave behind.',
    ],
    question: 'Will you bring it back for me?',
    accepted: 'Thanks. I will make it worth your while.',
    declined: 'Fair enough. I will ask again after your next raid.',
    // The second line is what FireRed's Brock says as he hands TM39 over.
    thanks: [
      'My crate! And not a bolt missing. I owe you one.',
      'Take this. TM39 is Rock Tomb: it hurls boulders and slows the foe.',
    ],
    lost: [
      'My crate never made it home? You came back. That is what counts.',
      'There is another crate of mine up in GREYSTONE PEAKS.',
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
    mapId: 'greystone-vale',
    // Amber is old tree resin, and this is the vale's pine wood.
    place: 'PINE HOLLOW',
    asks: [
      'There is a lump of OLD AMBER under the pines in PINE HOLLOW.',
      'It takes 1 square of your pack. It would make my cabinet!',
    ],
    question: 'Will you fetch it for me?',
    accepted: 'Great! Bring it back, and you get something good for it.',
    declined: 'No problem. I will ask again after your next raid.',
    thanks: [
      'That is it! There is something inside! It is going right on my desk.',
      'A deal is a deal. This Eevee has been with me for years. Take it.',
    ],
    lost: [
      'Gone? You had it, and it never made it back? Aw, man...',
      'There is more amber where that came from. PINE HOLLOW still weeps.',
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

/** The district an errand's thing lies in, found on its map by name. */
export function errandDistrict(errand: Errand): MapDistrict | undefined {
  return districtsForMap(errand.mapId).find((district) => district.name === errand.place);
}

/** The place an errand's thing lies, as a district plate names it, or nothing if its map has no such place. */
export function errandPlace(errand: Errand): string {
  return errandDistrict(errand)?.name ?? '';
}

/** "GREYSTONE PEAKS, Greystone Vale". */
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

/** What a giver has to say when spoken to, if anything. */
export type ErrandBeat =
  | { readonly kind: 'ask'; readonly errand: Errand }
  | { readonly kind: 'thanks'; readonly errand: Errand }
  | { readonly kind: 'lost'; readonly errand: Errand };

/**
 * The one thing a giver says when spoken to, in the order it matters: the
 * thing is home, so they take it and pay; it was found and lost, so they ask
 * about it; or they have not asked yet and the errand can be done, so they
 * ask. An errand in hand and in progress says nothing - Oak's board, the
 * drop-in screen and the field guide carry it from there, and a giver who
 * repeated the request every visit would be a nag rather than a person.
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

/**
 * A favour turned down is asked again after the next raid, and not before:
 * the giver was just told no, and asking again from the same counter on the
 * way back out of their screen would be a nag. Nothing is stored, in the
 * manner of `pendingMoves.ts`'s "decide later": a turn-down is keyed by the
 * raid count the save already keeps (`raidsDeployed`), so it lapses by itself
 * once the save has deployed again, and a reload asks once more - the honest
 * reading of a question nobody wrote down an answer to.
 */
const declinedAt = new Map<string, number>();

/** NOT NOW to a favour: asked again once the save has deployed again. */
export function declineErrand(id: string, raidsDeployed: number): void {
  declinedAt.set(id, raidsDeployed);
}

/** Forgets every turn-down, as a reload does. For the suite. */
export function forgetDeclinedErrands(): void {
  declinedAt.clear();
}

/**
 * What a giver says when spoken to (`errandBeat`), less a favour turned down
 * since the last raid - which is the whole of what saying NOT NOW does.
 */
export function errandToSay(
  giver: BaseScreen,
  progress: ErrandProgress,
  held: (itemId: ItemId) => number,
  raidsDeployed: number,
): ErrandBeat | undefined {
  const beat = errandBeat(giver, progress, held);
  return beat?.kind === 'ask' && declinedAt.get(beat.errand.id) === raidsDeployed ? undefined : beat;
}

/** The two answers to a favour, the one that takes it first, as FireRed's YES/NO box has. */
export const FAVOUR_ANSWERS = ['YES', 'NOT NOW'] as const;

/**
 * A beat as it is said in the dialogue box, a box a line: the favour (its
 * question follows with the answers under it), the hand-over with what came
 * back for it, or the loss.
 */
export function errandLines(beat: ErrandBeat): readonly string[] {
  const { errand } = beat;
  switch (beat.kind) {
    case 'ask':
      return errand.asks;
    case 'thanks':
      return [`You handed over ${errandThing(errand)}.`, ...errand.thanks, errand.reward.received];
    case 'lost':
      return errand.lost;
  }
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
    district: errandDistrict(errand)?.id ?? errand.place,
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
