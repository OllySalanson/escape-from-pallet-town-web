import { DIRECTION_DELTAS, type Direction, type GridPosition } from '../movement/gridMovement';
import type { Pokemon } from '../pokemon/Pokemon';
import type { Stash, StashedPokemon } from '../stash/Stash';
import { FOLLOWER_ART } from './generated/followerArt';

/**
 * The partner at the player's heel, round the harbour: the one Pokemon they
 * picked as their starter (`Stash.partner()`), walking one step behind them in
 * their own footsteps, the way HeartGold and SoulSilver's following Pokemon do.
 *
 * Everything here is the rule and nothing is drawing - `BaseScene` draws - so
 * the promises the feature makes are held by `partner.test.ts` rather than by
 * a playtest. Four of them are the whole of it:
 *
 * - **It walks where the player walked.** Every step the player takes, the
 *   partner takes one onto the tile the player has just left (`followStep`).
 *   That one rule is why it never walks through a wall, into water or over a
 *   counter: it only ever stands where somebody has already stood.
 * - **It never blocks the player.** It is not collision. Walking into it is a
 *   swap - it steps back onto the tile the player came from - so a doorway,
 *   a one-tile lane or a dead end is exactly as passable with a partner as
 *   without one. The only thing it changes is that a *tap* towards it turns
 *   the player to face it rather than walking (`BaseScene`), because a friend
 *   who can never be faced can never be spoken to.
 * - **It is the partner or nobody.** No choosing, no stand-in: a save whose
 *   partner was lost - in a wipe, or by any other road out of the vault -
 *   walks the harbour alone, even after the wipe re-issues a fresh starter of
 *   the same species (`partnerOf`).
 * - **It is only ever here.** The raid maps never read this module.
 */

/** One partner's walking art, as `scripts/cut-hgss-followers.mjs` cut it. */
export type PartnerSpeciesId = keyof typeof FOLLOWER_ART;

/** A frame of a partner sheet is 32 pixels square: two a facing, four facings. */
export const PARTNER_FRAME = 32;

/**
 * The frame row a partner's feet rest on. HeartGold draws every following
 * Pokemon standing on row 29 of its frame (a Bulbasaur's toes reach 30), so
 * one anchor stands all nine on the ground the player stands on.
 */
export const PARTNER_FEET_PIXEL_Y = 29;

/** The order of the rows on a partner sheet. */
const PARTNER_ROWS: readonly Direction[] = ['down', 'up', 'left', 'right'];

export function partnerTextureKey(species: PartnerSpeciesId): string {
  return `partner-${species}`;
}

export function partnerAssetPath(species: PartnerSpeciesId): string {
  return `assets/followers/${species}.png`;
}

export const PARTNER_SPECIES = Object.keys(FOLLOWER_ART) as readonly PartnerSpeciesId[];

export function isPartnerSpecies(speciesId: string): speciesId is PartnerSpeciesId {
  return Object.prototype.hasOwnProperty.call(FOLLOWER_ART, speciesId);
}

/** Which frame of a partner sheet shows it facing `facing`, in pose 0 or 1. */
export function partnerFrame(facing: Direction, pose: 0 | 1): number {
  return PARTNER_ROWS.indexOf(facing) * 2 + pose;
}

/**
 * The partner to walk with this save, or none. It is the stash's partner and
 * nothing else - never the strongest of the line, never whoever is first in a
 * box - and only while there is art to draw it with, which there is for all
 * three starters and both of their evolutions.
 */
export function partnerOf(stash: Stash): (StashedPokemon & { readonly species: PartnerSpeciesId }) | null {
  const partner = stash.partner();
  if (!partner || !isPartnerSpecies(partner.pokemon.base.id)) {
    return null;
  }
  return { ...partner, species: partner.pokemon.base.id };
}

// -- walking ---------------------------------------------------------------

/**
 * Where the partner is. `out` is false while it is tucked away - on the
 * player's own tile and not drawn, because there was nowhere beside them to
 * stand - and it comes out onto the first tile the player leaves.
 */
export interface PartnerPlace {
  readonly tile: GridPosition;
  readonly facing: Direction;
  readonly out: boolean;
}

/** What the partner does when the player begins a step. */
export type PartnerMove =
  /** Walks from where it stood onto the tile the player is leaving. */
  | { readonly kind: 'step'; readonly from: GridPosition; readonly to: GridPosition; readonly facing: Direction }
  /** Comes out onto the tile the player is leaving: it was tucked away there. */
  | { readonly kind: 'appear'; readonly at: GridPosition; readonly facing: Direction };

export const sameTile = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

export function isNeighbour(a: GridPosition, b: GridPosition): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** The way from one tile to a neighbouring one. Undefined for anything else. */
export function directionBetween(from: GridPosition, to: GridPosition): Direction | undefined {
  return (Object.keys(DIRECTION_DELTAS) as Direction[]).find(
    (direction) =>
      from.x + DIRECTION_DELTAS[direction].x === to.x && from.y + DIRECTION_DELTAS[direction].y === to.y,
  );
}

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * The player begins a step from `playerFrom` to `playerTo`: the partner's
 * answer, and where it will be once both steps are done.
 *
 * It always ends on `playerFrom`. Walking from a neighbour of it, that is one
 * step, taken in the same time as the player's, which is the footsteps rule;
 * walking back into the partner is the same rule, and the two pass each other.
 * Anywhere else - tucked away on the player's tile, or (which no walk can
 * cause) further off - it comes out onto `playerFrom` rather than cross ground
 * nobody has walked.
 */
export function followStep(
  place: PartnerPlace,
  playerFrom: GridPosition,
  playerTo: GridPosition,
): { readonly move: PartnerMove; readonly place: PartnerPlace } {
  const onward = directionBetween(playerFrom, playerTo) ?? place.facing;
  const facing = directionBetween(place.tile, playerFrom);
  if (place.out && facing !== undefined) {
    return {
      move: { kind: 'step', from: place.tile, to: { ...playerFrom }, facing },
      place: { tile: { ...playerFrom }, facing, out: true },
    };
  }
  return {
    move: { kind: 'appear', at: { ...playerFrom }, facing: onward },
    place: { tile: { ...playerFrom }, facing: onward, out: true },
  };
}

/**
 * Where the partner stands when the player arrives somewhere: behind them if
 * there is ground there, else at their side, else in front of them, else
 * nowhere - tucked away until they take a step.
 *
 * Behind is first because that is where it would be had it walked in with
 * them. `canStand` is the scene's word on the ground, on who is standing there
 * and on whether a figure there can be seen, so a partner never arrives in a
 * wall, on the water, on a keeper or in a doorway the building is drawn over.
 */
export function arrivalPlace(
  player: GridPosition,
  facing: Direction,
  canStand: (tile: GridPosition) => boolean,
): PartnerPlace {
  const sides: Record<Direction, readonly Direction[]> = {
    up: ['left', 'right'],
    down: ['right', 'left'],
    left: ['down', 'up'],
    right: ['down', 'up'],
  };
  for (const from of [OPPOSITE[facing], ...sides[facing], facing]) {
    const tile = { x: player.x + DIRECTION_DELTAS[from].x, y: player.y + DIRECTION_DELTAS[from].y };
    if (canStand(tile)) {
      // It faces the way the player does, as a Pokemon that had been walking
      // after them would; from in front it turns round to face them instead.
      return { tile, facing: from === facing ? OPPOSITE[facing] : facing, out: true };
    }
  }
  return { tile: { ...player }, facing, out: false };
}

/**
 * The way the partner turns to look at the player from a neighbouring tile,
 * or undefined when they are not neighbours (tucked away, or mid-swap).
 */
export function facingTowards(partner: GridPosition, player: GridPosition): Direction | undefined {
  return directionBetween(partner, player);
}

/**
 * How long a direction pressed towards the partner, from standing, turns the
 * player to face it before it walks them through it. A tap is a turn and a
 * hold is a walk - FireRed's own rule for turning, kept here only for the one
 * tile that is not a wall but is worth stopping to face.
 */
export const TURN_TO_PARTNER_MS = 110;

/**
 * Whether this frame's step, aimed at `target`, only turns the player to face
 * the partner standing there - and the turn's countdown for the next frame.
 *
 * From standing and not already facing it, a press turns the player, and only
 * one still held once `TURN_TO_PARTNER_MS` has run walks them on through it.
 * Mid-walk, or already facing it, the walk is never held up at all: the
 * partner is a friend to face, not a wall to stop at.
 */
export function turnToPartner(options: {
  /** The countdown left from the last frame, or null when no turn is under way. */
  readonly holdMs: number | null;
  readonly target: GridPosition | null;
  readonly partner: GridPosition | null;
  readonly stepFacing: Direction;
  readonly facing: Direction;
  readonly fromStanding: boolean;
  readonly deltaMs: number;
}): { readonly turn: boolean; readonly holdMs: number | null } {
  const { holdMs, target, partner } = options;
  if (!target || !partner || !sameTile(target, partner)) {
    return { turn: false, holdMs: null };
  }
  if (holdMs === null) {
    return !options.fromStanding || options.stepFacing === options.facing
      ? { turn: false, holdMs: null }
      : { turn: true, holdMs: TURN_TO_PARTNER_MS };
  }
  const left = holdMs - options.deltaMs;
  return left > 0 ? { turn: true, holdMs: left } : { turn: false, holdMs: null };
}

// -- life ------------------------------------------------------------------

/** The pose a partner stands in: the first of each facing's pair, the other is mid-stride. */
export const STANDING_POSE = 0;

/**
 * Which of its two poses the partner is drawn in. Walking, it takes both in
 * every step, swapped halfway, each step starting on the other one - the
 * stride the art was drawn for. Standing, it stands: the moment its step is
 * over it is in `STANDING_POSE` and stays there.
 *
 * HeartGold's following Pokemon tread in place while they wait, and this one
 * used to; the owner, playing it, read that as "Bulbasaur keeps on walking even
 * when I've stopped". A partner at rest is now at rest, and its life while
 * the player stands about is in what it does - turning to look at them,
 * glancing round, hopping - never in its feet.
 */
export function partnerPose(walk: {
  readonly moving: boolean;
  /** How far through the step, 0 to 1. */
  readonly progress: number;
  /** The pose this step started on, alternating step to step. */
  readonly walkPose: 0 | 1;
}): 0 | 1 {
  if (!walk.moving) {
    return STANDING_POSE;
  }
  return walk.progress < 0.5 ? walk.walkPose : walk.walkPose === 0 ? 1 : 0;
}

/** The little things a partner does while the player stands about. */
export type PartnerBeat = 'look-at-player' | 'glance' | 'hop' | 'hop-and-chirp';

/** How long the player has to stand still before the partner turns to look at them. */
export const LOOK_AT_PLAYER_AFTER_MS = 700;
/** The shortest and longest wait between two idle beats. */
export const IDLE_BEAT_MIN_MS = 3500;
export const IDLE_BEAT_SPREAD_MS = 5000;

/**
 * The next idle beat, chosen from a roll in [0, 1). A worn-out partner does
 * not bounce about, and a fainted one only ever looks up at the player.
 */
export function idleBeat(
  roll: number,
  pokemon: Pick<Pokemon, 'isFainted' | 'currentHp' | 'maxHp'>,
): Exclude<PartnerBeat, 'look-at-player'> | null {
  if (pokemon.isFainted) {
    return null;
  }
  const tired = pokemon.currentHp * 4 <= pokemon.maxHp;
  if (roll < 0.45) {
    return 'glance';
  }
  if (tired) {
    return null;
  }
  return roll < 0.85 ? 'hop' : 'hop-and-chirp';
}

/** How a hop lifts the partner, a pixel at a time - two small bounces, FireRed's jump in miniature. */
export const HOP_PIXELS: readonly number[] = [1, 2, 3, 3, 2, 1, 0, 1, 2, 2, 1, 0];
/** How long each entry of `HOP_PIXELS` is held. */
export const HOP_STEP_MS = 30;

/** The height of a hop `elapsedMs` in, and zero once it has landed. */
export function hopLift(elapsedMs: number): number {
  const index = Math.floor(elapsedMs / HOP_STEP_MS);
  return HOP_PIXELS[index] ?? 0;
}

export const HOP_MS = HOP_PIXELS.length * HOP_STEP_MS;

// -- talking to it ---------------------------------------------------------

/** What shows in the bubble over the partner's head. */
export type PartnerEmote = 'heart' | 'note' | 'happy' | 'ellipsis' | 'sleepy' | 'exclaim';

export interface PartnerReaction {
  readonly line: string;
  readonly emote: PartnerEmote;
  /** Whether it hops while it says so: a tired or fainted partner does not. */
  readonly hops: boolean;
}

/** Where in the harbour the player is: the yard, or the room behind a door. */
export type PartnerPlaceName = 'yard' | 'oaks-lab' | 'pokemon-centre' | 'brocks-workshop' | 'bills-cottage';

/**
 * What the partner does when the player faces it and presses the interact
 * key: a line, as FireRed and HeartGold write one about a Pokemon - its name in
 * capitals, what it is doing - and the bubble over its head.
 *
 * Its condition speaks first, because a partner limping round the yard that
 * says it is happy would be a lie told by the one character in the game the
 * player is meant to trust. Otherwise the place and a roll in [0, 1) choose.
 */
export function partnerReaction(
  pokemon: Pick<Pokemon, 'isFainted' | 'currentHp' | 'maxHp' | 'primaryStatus'> & {
    readonly base: { readonly name: string };
  },
  place: PartnerPlaceName,
  roll: number,
): PartnerReaction {
  const name = pokemon.base.name.toUpperCase();
  if (pokemon.isFainted) {
    return {
      line: `${name} is too worn out to stand up properly... NURSE JOY could help it.`,
      emote: 'sleepy',
      hops: false,
    };
  }
  const status = pokemon.primaryStatus === null ? undefined : STATUS_LINES[pokemon.primaryStatus];
  if (status) {
    return { line: status(name), emote: 'ellipsis', hops: false };
  }
  if (pokemon.currentHp * 4 <= pokemon.maxHp) {
    return {
      line: `${name} is tired out, but it's putting on a brave face for you.`,
      emote: 'ellipsis',
      hops: false,
    };
  }
  const lines = [...PLACE_LINES[place], ...HAPPY_LINES];
  const pick = lines[Math.min(lines.length - 1, Math.floor(roll * lines.length))];
  return { line: pick.line(name), emote: pick.emote, hops: pick.emote !== 'ellipsis' };
}

const STATUS_LINES: Record<NonNullable<Pokemon['primaryStatus']>, (name: string) => string> = {
  poison: (name) => `${name} is shivering. The poison is still in it.`,
  burn: (name) => `${name} keeps licking at its burn.`,
  paralysis: (name) => `${name} is twitching. It can't quite shake the paralysis.`,
  sleep: (name) => `${name} is dozing on its feet...`,
  freeze: (name) => `${name} is still shivering from the frost.`,
};

interface Said {
  readonly line: (name: string) => string;
  readonly emote: PartnerEmote;
}

/** Said anywhere in the harbour when the partner is well. */
const HAPPY_LINES: readonly Said[] = [
  { line: (name) => `${name} is happy to be walking with you!`, emote: 'heart' },
  { line: (name) => `${name} is looking up at you. It seems to want to go somewhere!`, emote: 'exclaim' },
  { line: (name) => `${name} is humming to itself.`, emote: 'note' },
  { line: (name) => `${name} gave you a big grin!`, emote: 'happy' },
  { line: (name) => `${name} nuzzled up against you.`, emote: 'heart' },
  { line: (name) => `${name} is bouncing on its feet, raring to go.`, emote: 'happy' },
];

/** Said only where the player is standing, so the harbour reads as places the partner knows. */
const PLACE_LINES: Record<PartnerPlaceName, readonly Said[]> = {
  yard: [
    { line: (name) => `${name} is sniffing the sea air.`, emote: 'note' },
    { line: (name) => `${name} is watching the boats bob at the quay.`, emote: 'ellipsis' },
  ],
  'oaks-lab': [
    { line: (name) => `${name} is peering at PROF. OAK's machines with great interest.`, emote: 'exclaim' },
  ],
  'pokemon-centre': [{ line: (name) => `${name} looks very relaxed in here.`, emote: 'happy' }],
  'brocks-workshop': [{ line: (name) => `${name} is poking its nose into BROCK's toolbox.`, emote: 'exclaim' }],
  'bills-cottage': [{ line: (name) => `${name} is staring at BILL's shelves of oddities.`, emote: 'exclaim' }],
};

// -- the bubble ------------------------------------------------------------

/**
 * The bubble over the partner's head, drawn as a FireRed emotion bubble is:
 * a cream window with an ink rim and a tail, and one small picture in it. It
 * is the same frame the raid draws over a trainer who has spotted the player
 * (`WorldScene.paintSpottedMark`), eleven by thirteen with a three-pixel tail,
 * so a partner's heart and a trainer's "!" are one family of mark.
 *
 * Each picture is a grid of characters over the bubble's nine by eleven
 * inside: `.` is the cream, and every other letter is a colour in
 * `EMOTE_INKS`.
 */
export const EMOTE_ART: Record<PartnerEmote, readonly string[]> = {
  heart: [
    '.........',
    '.........',
    '.##...##.',
    '#####.###',
    '#########',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '.........',
  ],
  note: [
    '.........',
    '....bb...',
    '....bbb..',
    '....b.bb.',
    '....b..b.',
    '....b....',
    '....b....',
    '.bbbb....',
    'bbbbb....',
    '.bbb.....',
    '.........',
  ],
  happy: [
    '.........',
    '.........',
    '.........',
    '.k.....k.',
    'k.k...k.k',
    '.........',
    '.........',
    '.k.....k.',
    '..kkkkk..',
    '.........',
    '.........',
  ],
  ellipsis: [
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    'kk.kk.kk.',
    'kk.kk.kk.',
    '.........',
    '.........',
    '.........',
    '.........',
  ],
  sleepy: [
    '.........',
    '....zzzz.',
    '......z..',
    '.....z...',
    '....zzzz.',
    '.........',
    'zzz......',
    '..z......',
    '.z.......',
    'zzz......',
    '.........',
  ],
  exclaim: [
    '.........',
    '...rrr...',
    '...rrr...',
    '...rrr...',
    '...rrr...',
    '...rrr...',
    '.........',
    '...rrr...',
    '...rrr...',
    '.........',
    '.........',
  ],
};

export const EMOTE_INKS: Record<string, number> = {
  '#': 0xe8384f,
  b: 0x3868d0,
  k: 0x202020,
  z: 0x5870a8,
  r: 0xdc2626,
};

export const EMOTE_BUBBLE_INK = 0x171717;
export const EMOTE_BUBBLE_CREAM = 0xfdf6e3;
/** How long a bubble stays up when nothing is being read under it. */
export const EMOTE_MS = 1400;
