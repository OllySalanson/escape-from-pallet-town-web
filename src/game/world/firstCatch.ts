import { pokemonCargoCells } from '../pokemon/pokemonCargo';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldEntity } from './npcs';

/**
 * A new save's first raid teaches a catch.
 *
 * The overnight critic's first raid was "a walk": 130 tiles of empty road, a
 * level 2 hunter, out at 1:10 with ₽110, and no decision of any kind. It took
 * him five raids to get the game on the box - a catch carried home against
 * the clock. His verdict: "I would send it the week somebody deletes the first
 * raid and replaces it with the fifth" (problems 4 and 6, 25 Nov 2026). And a
 * one-Pokemon team was wiped by the first wild Pokemon it met: one faint is
 * the whole raid.
 *
 * So the first raid starts with a catch. Mill Square already has Pidgey
 * walking about the landing - scenery, which say their cry and nothing else.
 * On a first raid the nearest of them is wild. The objective chip and the gold
 * arrow go to it first, Oak says to walk up and press SPACE, and the fight
 * teaches the one rule a catch needs, at the moment it is true: "It's weak!
 * Throw a BALL now" (`catchLessonMessage`). Nothing is rigged. A Pidgey
 * knocked out is gone, and the square's other Pidgey is the retry, once.
 *
 * Once it is caught, the pack, the risk and the choice are each said once,
 * while they matter: it rides in the pack, it is the player's only once they
 * are out, and the hunter who has heard it comes from the far side of the
 * player from the way out, between them and the stake (`HunterPack.comeFor`).
 * From then on it is an ordinary first raid with something to lose. And from
 * raid two the team is two, so one faint is no longer the raid.
 *
 * Level 2 is the teaching fight's measured level (`teachingEncounter.ts`): Tackle
 * only, and every starter wins it 99 times in 100.
 */
export const FIRST_CATCH_SPECIES = 'pidgey';
export const FIRST_CATCH_LEVEL = 2;

/** How far from the landing a Pidgey may stand and still be the square's. */
export const FIRST_CATCH_REACH = 16;

/** The square's Pidgey, nearest the landing first: the one to catch, then the one to try again on. */
export function firstCatchFigures(entities: readonly WorldEntity[], landing: GridPosition): readonly WorldEntity[] {
  const away = (entity: WorldEntity): number =>
    Math.abs(entity.position.x - landing.x) + Math.abs(entity.position.y - landing.y);
  return entities
    .filter(
      (entity) =>
        entity.pokemon === FIRST_CATCH_SPECIES &&
        entity.wildLevel === undefined &&
        entity.secret === undefined &&
        away(entity) <= FIRST_CATCH_REACH,
    )
    .sort((one, other) => away(one) - away(other))
    .slice(0, 2);
}

/** What the objective chip reads while the catch is the next thing. */
export const FIRST_CATCH_CUE = 'CATCH THE PIDGEY';

/**
 * What Oak says as the first raid lands, in place of the two dense boxes it
 * opened with ("Faint, or run out of time, and the pack is lost. And keep
 * moving: a hunter is coming." - words before meanings, problem 7). One box:
 * the one thing to do. The rest is said when it is true.
 */
export const FIRST_CATCH_LANDING_LINES: readonly string[] = [
  "OAK: You're in! See the PIDGEY the gold arrow is pointing at? Walk up to it and press SPACE.",
];

/** Steps walked after Oak's last word about the catch before the hunter who heard it comes. */
export const FIRST_CATCH_HUNTER_STEPS = 6;

/**
 * Said on the way back from the fight that caught it: the pack, the Potion when
 * somebody is hurt (before anything else, because the hunter is next), then the
 * risk and the choice.
 */
export function firstCatchCaughtLines(
  name: string,
  exitLabel: string | undefined,
  packSquares: number | undefined,
  heal: string | null = null,
): readonly string[] {
  const squares = pokemonCargoCells(FIRST_CATCH_SPECIES);
  const exit = exitLabel ? exitLabel.toUpperCase() : 'the nearest exit';
  const room = packSquares ? `It takes ${squares} of the ${packSquares} squares.` : `It takes ${squares} squares.`;
  return [
    `OAK: Got it! ${name.toUpperCase()} is in your pack. ${room} Get out of the vale and it's yours.`,
    ...(heal ? [heal] : []),
    `Faint before you're out, and it's lost. And a hunter will have heard that fight...`,
    `The quickest way out is ${exit}. Or go on for the money, with a hunter about. Your call!`,
  ];
}

/** Said when the first Pidgey was knocked out or left, and the square's other one is still there. */
export const FIRST_CATCH_AGAIN_LINE = "OAK: Knocked out, it's gone. There's another PIDGEY on the square. Gentler this time!";
