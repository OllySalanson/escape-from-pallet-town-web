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
 * there, and Bill cannot keep quiet about anything old. A rumour is said only
 * while its secret still holds something, and once heard it is kept
 * (`raidProgress.rumoursHeard`) for the cork board and the telescope to show.
 *
 * Every rumour is true: `secrets.test.ts` holds each one's place to the place
 * its secret is in, and each fact it names to the secret's condition.
 */

export type RumourSource = 'board' | 'angler' | 'spyglass' | 'sailor' | 'bill';

/** The facts a rumour gives: two of these three. */
export type RumourFact = 'where' | 'when' | 'bring';

export interface Rumour {
  readonly id: string;
  readonly secret: string;
  readonly source: RumourSource;
  readonly gives: readonly [RumourFact, RumourFact];
  /** The district or area the rumour names, as it names it (upper case on screen). */
  readonly names: string;
  readonly line: string;
}

export const RUMOURS: readonly Rumour[] = [
  {
    id: 'board-long-shadow',
    secret: 'the-long-shadow',
    source: 'board',
    gives: ['where', 'when'],
    names: 'THE GREY STONES',
    line: 'RUMOUR: At dusk the tall stone at THE GREY STONES on HIGH MOOR throws its shadow on something. Nobody agrees what.',
  },
  {
    id: 'angler-red-one',
    secret: 'the-red-one',
    source: 'angler',
    gives: ['where', 'bring'],
    names: 'THE TARN',
    line: 'There\'s a red one in THE TARN up in GREYSTONE PEAKS. Took my rod, my hat and my nerve. You\'d want a rod of your own.',
  },
  {
    id: 'sailor-tappers-sunday',
    secret: 'the-tappers-sunday',
    source: 'sailor',
    gives: ['where', 'when'],
    names: 'THE TAPPERS’ CAMP',
    line: 'Ran a tapper out to PINE HOLLOW once. Said they never work a Sunday - leave something for whoever comes by THE TAPPERS\' CAMP.',
  },
  {
    id: 'spyglass-lost-fold',
    secret: 'the-lost-fold',
    source: 'spyglass',
    gives: ['where', 'when'],
    names: 'THE LOST FOLD',
    line: 'A light on HIGH MOOR where no house stands: over THE LOST FOLD. It is only there after dark.',
  },
  {
    id: 'bill-old-shells',
    secret: 'the-old-shells',
    source: 'bill',
    gives: ['where', 'bring'],
    names: 'Greystone Caves B1F',
    line: 'BILL: Old shells are my weakness! Somebody saw some in the sand on B1F of the GREYSTONE CAVES. You would need to dig: lead with a GROUND type, or pack a PICKAXE.',
  },
  {
    id: 'board-cracked-crag',
    secret: 'the-cracked-crag',
    source: 'board',
    gives: ['where', 'when'],
    names: 'THE GOAT TRACK',
    line: 'RUMOUR: A boulder on THE GOAT TRACK in GREYSTONE PEAKS glows red along its crack at dusk.',
  },
  {
    id: 'board-navvies-wager',
    secret: 'the-navvies-wager',
    source: 'board',
    gives: ['where', 'bring'],
    names: 'THE NAVVIES’ CAMP',
    line: 'RUMOUR: The foreman at THE NAVVIES\' CAMP will wager anything against a Pokémon that leads with its fists.',
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

/** A day count by the player's own clock: the same number all day, a new one at midnight. */
export function dayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / (24 * 60 * 60 * 1000));
}
