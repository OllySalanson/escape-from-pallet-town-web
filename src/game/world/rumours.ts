import { secretById, secretSpent, type SecretsKnown } from './secrets';

/**
 * Rumours: half-clues about the vale's secrets (`secrets.ts`), heard in THE
 * HARBOUR.
 *
 * A secret's clue stands beside its nook; a rumour is what sends a player out
 * to find the clue in the first place. Each gives **two of three facts** -
 * where, when, and what to bring - and never the tile, so the third is found on
 * the ground or in another rumour. Each is heard from somebody who would know
 * it: the board pins one up, the angler talks about the water, the S.S. Anne's
 * captain sees it through his glass, the Seagallop's sailor has run people out
 * there, Bill cannot keep quiet about anything old, and THE GAME CORNER's prize
 * clerk knows what the flute they sell is for. THE RUMOUR MILL at THE
 * GAME CORNER's prize window sells them for tickets (`millRumour`): its own
 * slips give the two facts the harbour's rumour about the same secret leaves
 * out, so the two together say all three. A rumour is said only
 * while its secret still holds something, and once heard it is kept
 * (`raidProgress.rumoursHeard`) for the cork board and the telescope to show.
 *
 * Every rumour is true: `secrets.test.ts` holds each one's place to the place
 * its secret is in, and each fact it names to the secret's condition.
 */

export type RumourSource = 'board' | 'angler' | 'spyglass' | 'sailor' | 'bill' | 'mill' | 'clerk';

/** The facts a rumour gives: two of these three. */
export type RumourFact = 'where' | 'when' | 'bring';

export interface Rumour {
  readonly id: string;
  readonly secret: string;
  readonly source: RumourSource;
  readonly gives: readonly [RumourFact, RumourFact];
  /** The district or area the rumour names, as it names it (upper case on screen). */
  readonly names: string;
  /**
   * The vale's district a heard rumour is chalked over on THE RAID ARENA's
   * telescope (`../base/rumourRings.ts`): the plan's whole district its place
   * lies in, or for a cave floor the district whose mouth opens onto it - never
   * the place itself, so the ring says no more than the rumour did.
   */
  readonly ringsOver: string;
  readonly line: string;
}

export const RUMOURS: readonly Rumour[] = [
  {
    id: 'board-long-shadow',
    secret: 'the-long-shadow',
    source: 'board',
    gives: ['where', 'when'],
    names: 'THE GREY STONES',
    ringsOver: 'HIGH MOOR',
    line: 'RUMOUR: At dusk the tall stone at THE GREY STONES on HIGH MOOR throws its shadow on something. Nobody agrees what.',
  },
  {
    id: 'angler-red-one',
    secret: 'the-red-one',
    source: 'angler',
    gives: ['where', 'bring'],
    names: 'THE TARN',
    ringsOver: 'GREYSTONE PEAKS',
    line: 'There\'s a red one in THE TARN up in GREYSTONE PEAKS. Took my rod, my hat and my nerve. You\'d want a rod of your own.',
  },
  {
    id: 'sailor-tappers-sunday',
    secret: 'the-tappers-sunday',
    source: 'sailor',
    gives: ['where', 'when'],
    names: 'THE TAPPERS’ CAMP',
    ringsOver: 'PINE HOLLOW',
    line: 'Ran a tapper out to PINE HOLLOW once. Said they never work a Sunday - leave something for whoever comes by THE TAPPERS\' CAMP.',
  },
  {
    id: 'spyglass-lost-fold',
    secret: 'the-lost-fold',
    source: 'spyglass',
    gives: ['where', 'when'],
    names: 'THE LOST FOLD',
    ringsOver: 'HIGH MOOR',
    line: 'A light on HIGH MOOR where no house stands: over THE LOST FOLD. It is only there after dark.',
  },
  {
    id: 'bill-old-shells',
    secret: 'the-old-shells',
    source: 'bill',
    gives: ['where', 'bring'],
    names: 'Greystone Caves B1F',
    ringsOver: 'TANGLEWOOD',
    line: 'BILL: Old shells are my weakness! Somebody saw some in the sand on B1F of the GREYSTONE CAVES. You would need to dig: lead with a GROUND type, or pack a PICKAXE.',
  },
  {
    id: 'board-cracked-crag',
    secret: 'the-cracked-crag',
    source: 'board',
    gives: ['where', 'when'],
    names: 'THE GOAT TRACK',
    ringsOver: 'GREYSTONE PEAKS',
    line: 'RUMOUR: A boulder on THE GOAT TRACK in GREYSTONE PEAKS glows red along its crack at dusk.',
  },
  {
    id: 'sailor-x-marks-the-spot',
    secret: 'x-marks-the-spot',
    source: 'sailor',
    gives: ['where', 'bring'],
    names: "SMUGGLERS' COVE",
    ringsOver: "SMUGGLERS' COVE",
    line: "Old Rook in SMUGGLERS' COVE swears there's a chest under the sand there. Only ever found with the whole CHART, he says - torn in four, it was.",
  },
  {
    id: 'board-navvies-wager',
    secret: 'the-navvies-wager',
    source: 'board',
    gives: ['where', 'bring'],
    names: 'THE NAVVIES’ CAMP',
    ringsOver: 'GREYSTONE PEAKS',
    line: 'RUMOUR: The foreman at THE NAVVIES\' CAMP will wager anything against a Pokémon that leads with its fists.',
  },
  {
    id: 'clerk-sleeper',
    secret: 'the-sleeper-in-the-pines',
    source: 'clerk',
    gives: ['where', 'bring'],
    names: 'THE BEE WOOD',
    ringsOver: 'PINE HOLLOW',
    line: "PRIZE CLERK: That POKé FLUTE? A woodsman swapped for one last year. Something huge sleeps in THE BEE WOOD in PINE HOLLOW, he said.",
  },
  {
    id: 'sailor-drowned-bell',
    secret: 'the-drowned-bell',
    source: 'sailor',
    gives: ['where', 'when'],
    names: 'THE DROWNED TOWN',
    ringsOver: 'THE SUNKEN QUARTER',
    line: "Ran a diver out to THE DROWNED TOWN once. Swore the old church bell answers a pull at LOW WATER - a minute in, and gone by two.",
  },
  // The third wave: the Pokemon the vale has nowhere else (`secrets.ts`).
  {
    id: 'board-lost-picnic',
    secret: 'the-lost-picnic',
    source: 'board',
    gives: ['where', 'when'],
    names: 'THE LOST PICNIC',
    ringsOver: 'TANGLEWOOD',
    line: 'RUMOUR: Nobody who stops at THE LOST PICNIC in TANGLEWOOD after dark gets home the same day. They are found asleep on their feet.',
  },
  {
    id: 'sailor-sticky-tongue',
    secret: 'the-sticky-tongue',
    source: 'sailor',
    gives: ['where', 'bring'],
    names: 'THE CIDER PRESS',
    ringsOver: 'ORCHARD TERRACES',
    line: 'Took on cider at THE CIDER PRESS in ORCHARD TERRACES. Every barrel licked clean round the bung! Whatever does it comes out for a BERRY in your pack.',
  },
  {
    id: 'spyglass-silent-picket',
    secret: 'the-silent-picket',
    source: 'spyglass',
    gives: ['where', 'bring'],
    names: 'THE POWER STATION',
    ringsOver: 'THE POWER STATION',
    line: 'One picket outside THE POWER STATION has not shifted a foot in nine years. I have watched. They say he only stirs for a PSYCHIC type walking in front.',
  },
  {
    id: 'bill-shadow-in-the-crypt',
    secret: 'the-shadow-in-the-crypt',
    source: 'bill',
    gives: ['where', 'bring'],
    names: 'The Crypt',
    ringsOver: 'THE MOOR CHAPEL',
    line: 'BILL: THE CRYPT under THE MOOR CHAPEL is the oldest room in the vale! A shadow on its floor belongs to nobody. Old books say it only follows a GHOST type.',
  },
  // THE RUMOUR MILL's own slips: when and what to bring, where the harbour's
  // rumour about the same secret gives where and one of them. Two rumours from
  // two sources complete each other (the harbour arenas plan, section 4.3).
  {
    id: 'mill-red-one',
    secret: 'the-red-one',
    source: 'mill',
    gives: ['when', 'bring'],
    names: 'THE TARN',
    ringsOver: 'GREYSTONE PEAKS',
    line: 'SLIP: Bring a ROD after DARK, and cast where the water is cold and black. Something red takes the line.',
  },
  {
    id: 'mill-cracked-crag',
    secret: 'the-cracked-crag',
    source: 'mill',
    gives: ['when', 'bring'],
    names: 'THE GOAT TRACK',
    ringsOver: 'GREYSTONE PEAKS',
    line: 'SLIP: At DUSK a red crack glows in a boulder up in the peaks. Bring a POKéMON that knows ROCK SMASH.',
  },
  {
    id: 'mill-drowned-bell',
    secret: 'the-drowned-bell',
    source: 'mill',
    gives: ['when', 'bring'],
    names: 'THE DROWNED TOWN',
    ringsOver: 'THE SUNKEN QUARTER',
    line: "SLIP: A bell rope stands up out of the sea. Pull it at LOW WATER, a minute into a raid - and only once MISTY's CASCADE BADGE is yours.",
  },
];

export function isRumourId(id: string): boolean {
  return RUMOURS.some((rumour) => rumour.id === id);
}

/** Whether a rumour is still worth saying: its secret has something left to find. */
function stillTrue(rumour: Rumour, known: SecretsKnown): boolean {
  const secret = secretById(rumour.secret);
  return secret !== undefined && !secretSpent(secret, known);
}

/**
 * The rumour a source has to tell today, if any: one of its rumours whose
 * secret still holds something, chosen by the day (`day` is a day count by the
 * player's clock), so the board's changes overnight and a source with one
 * rumour says it every time.
 */
export function rumourFrom(source: RumourSource, known: SecretsKnown, day: number): Rumour | undefined {
  const live = RUMOURS.filter((rumour) => rumour.source === source && stillTrue(rumour, known));
  return live.length === 0 ? undefined : live[((day % live.length) + live.length) % live.length];
}

/**
 * What THE RUMOUR MILL has to sell a save: a rumour it has not heard whose
 * secret still holds something - the mill's own slips first, then whatever the
 * harbour would have told it in time. Undefined once there is nothing new.
 */
export function millRumour(known: SecretsKnown, heard: readonly string[]): Rumour | undefined {
  const fresh = RUMOURS.filter((rumour) => stillTrue(rumour, known) && !heard.includes(rumour.id));
  return fresh.find((rumour) => rumour.source === 'mill') ?? fresh[0];
}

/** A day count by the player's own clock: the same number all day, a new one at midnight. */
export function dayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / (24 * 60 * 60 * 1000));
}
