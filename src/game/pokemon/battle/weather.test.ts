import { describe, expect, it } from 'vitest';
import { Move } from '../Move';
import { MoveCategory, MoveTarget, type MoveBase } from '../MoveBase';
import { Pokemon } from '../Pokemon';
import { PokemonType } from '../PokemonType';
import { RAIN_DANCE, EMBER, TACKLE, TAIL_WHIP } from '../moves';
import { BULBASAUR, CHARMANDER, PIDGEY, SQUIRTLE } from '../species';
import {
  createBattleState,
  createTrainerBattleState,
  resolveEnemyTurn,
  resolveTurn,
  type BattleEvent,
  type BattleState,
} from './battleEngine';
import {
  WEATHER_MOVE_TURNS,
  WeatherId,
  weatherChipDamage,
  weatherDamageMultiplier,
} from './weather';

/**
 * Weather, in the same shape the rest of the engine is tested in: no Phaser, no
 * scene, and nothing in the engine that knows a weather's name.
 */

const at = (overrides: Readonly<Record<number, number>>, fallback = 0.5): (() => number) => {
  let index = 0;
  return () => overrides[index++] ?? fallback;
};
const middling = (): number => 0.5;

const types = (events: readonly BattleEvent[]): string[] => events.map((event) => event.type);
const find = <T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }> | undefined =>
  events.find((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

const armed = (species: typeof BULBASAUR, level: number, ...moves: readonly MoveBase[]): Pokemon => {
  const pokemon = new Pokemon(species, level);
  pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
  return pokemon;
};

describe('the weather table', () => {
  it('chips a sixteenth of maximum HP, and never less than one', () => {
    expect(weatherChipDamage(WeatherId.Sandstorm, [PokemonType.Normal], 64)).toBe(4);
    // The floor is what binds at the levels this game is played at: nothing on
    // either side reaches sixteen times its own chip, so weather is a flat one
    // HP a turn to everybody. `districts.ts` explains what that does to a rung.
    expect(weatherChipDamage(WeatherId.Sandstorm, [PokemonType.Normal], 17)).toBe(1);
  });

  it('spares the types generation III spares, Steel included', () => {
    for (const sheltered of [PokemonType.Rock, PokemonType.Ground, PokemonType.Steel]) {
      expect(weatherChipDamage(WeatherId.Sandstorm, [sheltered], 64)).toBe(0);
    }
    // A dual type is spared by either half of it.
    expect(weatherChipDamage(WeatherId.Sandstorm, [PokemonType.Electric, PokemonType.Steel], 64)).toBe(0);
    expect(weatherChipDamage(WeatherId.Hail, [PokemonType.Ice], 64)).toBe(0);
    expect(weatherChipDamage(WeatherId.Hail, [PokemonType.Rock], 64)).toBe(4);
  });

  it('bends Fire and Water in opposite directions, and nothing else', () => {
    expect(weatherDamageMultiplier(WeatherId.Rain, PokemonType.Water)).toBe(1.5);
    expect(weatherDamageMultiplier(WeatherId.Rain, PokemonType.Fire)).toBe(0.5);
    expect(weatherDamageMultiplier(WeatherId.HarshSunlight, PokemonType.Fire)).toBe(1.5);
    expect(weatherDamageMultiplier(WeatherId.HarshSunlight, PokemonType.Water)).toBe(0.5);
    expect(weatherDamageMultiplier(WeatherId.Rain, PokemonType.Grass)).toBe(1);
    expect(weatherDamageMultiplier(WeatherId.Sandstorm, PokemonType.Water)).toBe(1);
    expect(weatherDamageMultiplier(null, PokemonType.Fire)).toBe(1);
  });
});

describe('weather over a fight', () => {
  it('is the field a fight starts in, with no clock on it', () => {
    const state = createBattleState(
      armed(BULBASAUR, 10, TACKLE),
      armed(PIDGEY, 10, TACKLE),
      WeatherId.Sandstorm,
    );
    expect(state.weather).toEqual({ id: WeatherId.Sandstorm, turnsRemaining: null });
    expect(state.ambientWeather).toBe(WeatherId.Sandstorm);
  });

  it('is nothing at all in a fight that was given none', () => {
    const state = createBattleState(armed(BULBASAUR, 10, TACKLE), armed(PIDGEY, 10, TACKLE));
    expect(state.weather).toBeNull();
    const { events } = resolveTurn(state, 0, middling);
    expect(types(events)).not.toContain('weather-damage');
  });

  it('takes HP off both sides once a turn, after both have acted', () => {
    const player = armed(BULBASAUR, 10, TACKLE);
    const enemy = armed(PIDGEY, 10, TACKLE);
    const state = createBattleState(player, enemy, WeatherId.Hail);
    const { state: after, events } = resolveTurn(state, 0, middling);

    const chips = events.filter((event) => event.type === 'weather-damage');
    expect(chips).toHaveLength(2);
    // The field's turn comes last: every chip is after every move.
    expect(types(events).lastIndexOf('used-move')).toBeLessThan(types(events).indexOf('weather-damage'));
    expect(after.player.currentHp).toBeLessThan(player.maxHp);
    expect(after.enemy.currentHp).toBeLessThan(enemy.maxHp);
  });

  it('charges a turn the player spent on something other than a move', () => {
    // An item, a switch or a ball still ends in `resolveEnemyTurn`, and a turn
    // is a turn: the weather is charged there too, and exactly once.
    const state = createBattleState(
      armed(BULBASAUR, 10, TACKLE),
      armed(PIDGEY, 10, TACKLE),
      WeatherId.Sandstorm,
    );
    const { events } = resolveEnemyTurn(state, middling);
    expect(events.filter((event) => event.type === 'weather-damage')).toHaveLength(2);
  });

  it('can knock a Pokemon out, and ends the fight when it does', () => {
    const player = armed(BULBASAUR, 10, TACKLE);
    const enemy = armed(PIDGEY, 10, TACKLE);
    const weakened: BattleState = {
      ...createBattleState(player, enemy, WeatherId.Sandstorm),
      enemy: { ...createBattleState(player, enemy, WeatherId.Sandstorm).enemy, currentHp: 1 },
    };
    // Nothing lands this turn: the accuracy roll is failed by both sides, so
    // the only thing that touches the enemy is the sandstorm.
    const { state: after, events } = resolveTurn(weakened, 0, at({}, 0.999999));
    expect(after.enemy.currentHp).toBe(0);
    expect(after.outcome).toBe('victory');
    expect(find(events, 'fainted')?.user).toBe('enemy');
  });
});

describe('weather from a move', () => {
  it('is set by the move saying so, and by nothing in the engine', () => {
    expect(RAIN_DANCE.effects.weather).toBe(WeatherId.Rain);
    expect(RAIN_DANCE.category).toBe(MoveCategory.Status);
    expect(RAIN_DANCE.target).toBe(MoveTarget.Self);
    expect(RAIN_DANCE.hasEffects).toBe(true);
  });

  it('brings on five turns of it and then stops', () => {
    // The foe is armed with nothing, so `chooseEnemyMove` gives it no turn and
    // five turns really do pass - a fight that ends is a fight whose weather
    // stops being counted.
    let state = createBattleState(armed(SQUIRTLE, 40, RAIN_DANCE, TAIL_WHIP), armed(PIDGEY, 40));
    const first = resolveTurn(state, 0, middling);
    state = first.state;
    expect(find(first.events, 'weather-set')).toMatchObject({ weather: WeatherId.Rain, byMove: true });
    expect(state.weather).toEqual({ id: WeatherId.Rain, turnsRemaining: WEATHER_MOVE_TURNS - 1 });

    // Four more turns of rain, and the fifth end-of-turn is the one that stops
    // it. The dance is not repeated - a second one would be five fresh turns.
    for (let turn = 0; turn < WEATHER_MOVE_TURNS - 2; turn += 1) {
      state = resolveTurn(state, 1, middling).state;
      expect(state.weather).not.toBeNull();
    }
    const last = resolveTurn(state, 1, middling);
    expect(find(last.events, 'weather-ended')).toMatchObject({ weather: WeatherId.Rain });
    expect(last.state.weather).toBeNull();
  });

  it('covers the weather of the place and hands it back when it lapses', () => {
    let state = createBattleState(
      armed(SQUIRTLE, 40, RAIN_DANCE, TAIL_WHIP),
      armed(PIDGEY, 40),
      WeatherId.Sandstorm,
    );
    state = resolveTurn(state, 0, middling).state;
    expect(state.weather?.id).toBe(WeatherId.Rain);

    for (let turn = 0; turn < WEATHER_MOVE_TURNS - 2; turn += 1) {
      state = resolveTurn(state, 1, middling).state;
    }
    const lapse = resolveTurn(state, 1, middling);
    expect(types(lapse.events)).toContain('weather-ended');
    expect(find(lapse.events, 'weather-set')).toMatchObject({
      weather: WeatherId.Sandstorm,
      byMove: false,
    });
    // The fight is still outdoors in a sandstorm, which is where it started.
    expect(lapse.state.weather).toEqual({ id: WeatherId.Sandstorm, turnsRemaining: null });
  });

  it('bends the damage of the swing that follows it', () => {
    const fire = (weather: WeatherId | null): number => {
      const state = createBattleState(
        armed(CHARMANDER, 20, EMBER),
        armed(PIDGEY, 20, TACKLE),
        weather,
      );
      const { events } = resolveTurn(state, 0, middling);
      const hit = events.find(
        (event): event is Extract<BattleEvent, { type: 'used-move' }> =>
          event.type === 'used-move' && event.user === 'player',
      );
      return hit?.damage ?? 0;
    };
    const clear = fire(null);
    expect(fire(WeatherId.Rain)).toBeLessThan(clear);
    expect(fire(WeatherId.HarshSunlight)).toBeGreaterThan(clear);
    // Sandstorm bends nothing: it only chips.
    expect(fire(WeatherId.Sandstorm)).toBe(clear);
  });

  it('follows a trainer battle from the place it started in', () => {
    const state = createTrainerBattleState(
      armed(BULBASAUR, 10, TACKLE),
      { id: 'foe', name: 'FOE', party: [armed(PIDGEY, 10, TACKLE)] },
      WeatherId.Rain,
    );
    expect(state.weather?.id).toBe(WeatherId.Rain);
    expect(state.ambientWeather).toBe(WeatherId.Rain);
  });
});
