import { PokemonType } from '../PokemonType';

/**
 * Weather, as rules rather than as a method.
 *
 * Ported from the tutorial's `WeatherConditionsDB`/`BattleField`, and kept in
 * the same shape the move data model is kept in: a condition is a row that says
 * what it does, and `battleEngine.ts` reads the row. Nothing in the engine knows
 * a weather's name, exactly as nothing in it knows a move's any more.
 *
 * Four conditions, and they do two different things. Sandstorm and hail take a
 * share of everyone's health at the end of every turn, except of the types that
 * live in them; rain and harsh sunlight bend Fire and Water damage in opposite
 * directions. That is the whole of generation III weather that is not an ability
 * or a per-move exception - the exceptions are listed at the foot of this file.
 *
 * Two things are ours rather than the tutorial's, both because this game has
 * what the tutorial did not. Sandstorm spares **Steel** as well as Rock and
 * Ground, which is generation III's own rule and which the tutorial could not
 * write because its type chart is fifteen wide; ours is seventeen. And the chip
 * is `floor(maxHp / 16)` with a floor of 1, which is generation III's rounding
 * and the same rounding poison and burn already use in `applyEndOfAction` - the
 * tutorial rounds up, which on a 17 HP starter is the difference between 1 and 2
 * a turn.
 */
export const WeatherId = {
  Sandstorm: 'sandstorm',
  Hail: 'hail',
  Rain: 'rain',
  HarshSunlight: 'harsh-sunlight',
} as const;

export type WeatherId = (typeof WeatherId)[keyof typeof WeatherId];

export interface WeatherCondition {
  readonly id: WeatherId;
  /** What the HUD chip and the battle log call it. */
  readonly label: string;
  /**
   * The fraction of maximum HP taken at the end of every turn, or 0 for a
   * weather that only bends damage. Generation III's share is a sixteenth.
   */
  readonly chipFraction: number;
  /** Types the chip does not touch. Empty where nothing is chipped. */
  readonly sheltered: readonly PokemonType[];
  /** What this weather multiplies a move of each named type by. */
  readonly damage: Readonly<Partial<Record<PokemonType, number>>>;
}

/** A sixteenth, which is generation III's share for both chipping weathers. */
const CHIP_FRACTION = 1 / 16;

export const WEATHER_CONDITIONS: Readonly<Record<WeatherId, WeatherCondition>> = {
  [WeatherId.Sandstorm]: {
    id: WeatherId.Sandstorm,
    label: 'SANDSTORM',
    chipFraction: CHIP_FRACTION,
    // Generation III's three, Steel included.
    sheltered: [PokemonType.Rock, PokemonType.Ground, PokemonType.Steel],
    damage: {},
  },
  [WeatherId.Hail]: {
    id: WeatherId.Hail,
    label: 'HAIL',
    chipFraction: CHIP_FRACTION,
    sheltered: [PokemonType.Ice],
    damage: {},
  },
  [WeatherId.Rain]: {
    id: WeatherId.Rain,
    label: 'RAIN',
    chipFraction: 0,
    sheltered: [],
    damage: { [PokemonType.Water]: 1.5, [PokemonType.Fire]: 0.5 },
  },
  [WeatherId.HarshSunlight]: {
    id: WeatherId.HarshSunlight,
    label: 'HARSH SUN',
    chipFraction: 0,
    sheltered: [],
    damage: { [PokemonType.Fire]: 1.5, [PokemonType.Water]: 0.5 },
  },
};

/**
 * How long weather a move brings on lasts. Generation III's five turns, counted
 * down at the end of every turn including the one it was set on.
 *
 * Weather a *place* has is not on this clock at all: it carries no duration, so
 * it is the field for as long as the fight lasts. A move played in such a place
 * covers it for five turns and then hands it back - see `BattleState.ambientWeather`.
 */
export const WEATHER_MOVE_TURNS = 5;

export const weatherCondition = (weather: WeatherId): WeatherCondition =>
  WEATHER_CONDITIONS[weather];

export const weatherLabel = (weather: WeatherId): string => WEATHER_CONDITIONS[weather].label;

/** What this weather does to a move of `moveType`. 1 where it does nothing. */
export function weatherDamageMultiplier(weather: WeatherId | null, moveType: PokemonType): number {
  return weather === null ? 1 : (WEATHER_CONDITIONS[weather].damage[moveType] ?? 1);
}

/**
 * What the end of a turn in this weather costs a Pokemon of `types`, or 0.
 *
 * The floor of 1 is what stops a weather being free for anything with fewer
 * than sixteen HP, which at the levels this game is played at is most of the
 * roster - a level-5 starter has seventeen.
 */
export function weatherChipDamage(
  weather: WeatherId | null,
  types: readonly PokemonType[],
  maxHp: number,
): number {
  if (weather === null) {
    return 0;
  }
  const condition = WEATHER_CONDITIONS[weather];
  if (condition.chipFraction === 0 || types.some((type) => condition.sheltered.includes(type))) {
    return 0;
  }
  return Math.max(1, Math.floor(maxHp * condition.chipFraction));
}

/**
 * Generation III weather rules deliberately **not** modelled, so they are not
 * rediscovered as bugs. Each is a per-move exception rather than a property of
 * the weather, which is why none of them fits the row above:
 *
 *  - Solar Beam skips its charge turn in harsh sunlight, and its power is
 *    halved in rain, sandstorm and hail. Solar Beam ships (Bulbasaur, level 46).
 *  - Synthesis, Morning Sun and Moonlight heal 2/3 in harsh sunlight and 1/4 in
 *    any other weather, against 1/2 in clear. Synthesis ships (level 39).
 *  - Thunder never misses in rain and drops to 50% accuracy in harsh sunlight;
 *    Weather Ball changes type. Neither ships.
 *  - Abilities that *set* weather (Drought, Drizzle, Sand Stream) and the two
 *    that feed on it (Rain Dish, Ice Body) are not modelled; none of the three
 *    setters is on the 151, and both feeders are generation IV. The four the
 *    151 do carry - Chlorophyll, Swift Swim, Sand Veil, Cloud Nine - read this
 *    table through `abilityHooks.ts` rather than restating any of it, and the
 *    weather every rule here is asked about is the one the engine has already
 *    put to Cloud Nine (`effectiveWeather` in `battleEngine.ts`).
 *
 * The first two are reachable by a player who levels a Bulbasaur past 39, and
 * are the natural next thing to add once a move can carry a weather clause of
 * its own.
 */
