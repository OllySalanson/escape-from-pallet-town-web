import { MoveCategory, type MoveBase } from '../pokemon/MoveBase';
import type { Pokemon } from '../pokemon/Pokemon';
import type { BattleEvent } from '../pokemon/battle/battleEngine';
import type { CryEffectName, SoundEffectName } from './soundEffects';

/**
 * Which effect a battle event sounds, and when.
 *
 * `at: 'impact'` is the moment the attacker's lunge reaches its target rather
 * than the moment the line appears: a hit heard before the sprite has moved is
 * a hit that belongs to nothing on screen. Everything else sounds with its line.
 *
 * Pure for the same reason `eventToMessage` is: which sound goes with which
 * event is a wording decision, and it should be readable and testable without
 * a scene.
 */
export interface BattleSoundCue {
  readonly name: SoundEffectName;
  readonly at: 'line' | 'impact';
}

const withLine = (name: SoundEffectName): BattleSoundCue => ({ name, at: 'line' });

export function battleEventSound(event: BattleEvent): BattleSoundCue | null {
  switch (event.type) {
    case 'used-move':
      // A move that missed carries no category: the miss that follows is its sound.
      if (event.category === undefined) {
        return null;
      }
      // A spread move's line only names it. What it sounded like is each
      // target's own `spread-damage`, so this line is silent rather than
      // sounding a hit that has not happened to anybody yet.
      if (event.spread) {
        return null;
      }
      if (event.category === MoveCategory.Status || !event.damage) {
        return withLine('statusMove');
      }
      return {
        name: event.category === MoveCategory.Special ? 'hitSpecial' : 'hitPhysical',
        at: 'impact',
      };
    // A spread move sounds once, on the line that names it, and then lands on
    // each target: the impact is what the player hears, so it is heard per
    // target - two leaves landing is two hits, not one.
    case 'spread-damage':
      if (!event.damage) {
        return null;
      }
      return {
        name: event.category === MoveCategory.Special ? 'hitSpecial' : 'hitPhysical',
        at: 'impact',
      };
    case 'missed':
      return withLine('miss');
    // A move aimed at nobody is a turn refused, which is what `denied` says.
    case 'no-target':
      return withLine('denied');
    // Splash is not refused, it simply does nothing, and nothing is silent.
    case 'nothing-happened':
      return null;
    case 'critical-hit':
      return withLine('criticalHit');
    case 'effectiveness':
      if (event.multiplier === 0) {
        return withLine('noEffect');
      }
      return withLine(event.multiplier > 1 ? 'superEffective' : 'notVeryEffective');
    // A faint is the Pokemon's own cry, lower (`battleEventCry`); the falling
    // run `faint` is what that cry falls back on when its sample is missing.
    case 'fainted':
      return null;
    case 'status-applied':
      return withLine('statusApplied');
    case 'status-damage':
    case 'confusion-self-hit':
      return withLine('statusDamage');
    // Leech Seed borrows the voices of what it resembles: being seeded is a
    // status landing, the drain at the end of a turn is a status biting, and a
    // seed that does not take is a miss - FireRed's own line for it is one.
    case 'seeded':
      return withLine('statusApplied');
    case 'seed-sapped':
      return withLine('statusDamage');
    case 'seed-evaded':
      return withLine('miss');
    case 'status-cured':
      return withLine('heal');
    case 'stat-stage-changed':
      return withLine(event.stages > 0 ? 'statUp' : 'statDown');
    // Nothing moved, so nothing sounds, as Splash is silent.
    case 'stat-capped':
      return null;
    case 'ball-thrown':
      return withLine('ballThrow');
    case 'catch-shake':
      return withLine('ballShake');
    case 'broke-free':
      return withLine('ballBreak');
    case 'caught':
      return withLine('catchSuccess');
    case 'enemy-sent-out':
      return withLine('sendOut');
    case 'gear-endured':
      return withLine('gearHeld');
    case 'gear-heal':
      return withLine('gearTick');
    case 'gear-first-strike':
      // A claw that fires is the same news as a stat rising: something just went
      // your way before the move that proves it.
      return withLine('statUp');
    case 'gear-recoil':
      return withLine('statusDamage');
    case 'no-pp':
    case 'catch-disabled':
    case 'status-prevented':
    case 'status-already':
      return withLine('denied');
    // What a move does beyond its damage. Each borrows the voice of the thing it
    // most resembles rather than adding an effect nobody would recognise: a
    // flinch is a turn refused, a drain and a heal are both HP arriving, and the
    // extra hits of a multi-hit move are the same blow again.
    case 'flinched':
    case 'recharging':
      return withLine('denied');
    case 'multi-hit':
      return withLine('hitPhysical');
    case 'drained':
    case 'healed':
      return withLine('heal');
    case 'heal-failed':
      return withLine('denied');
    case 'recoil':
      return withLine('statusDamage');
    case 'charging':
      return withLine('statusMove');
    // Weather. Setting it is a status move by any other name; the chip it takes
    // every turn is the same news as a burn, and the one soundless event is the
    // weather stopping, because nothing happens to anybody when it does.
    case 'weather-set':
      return withLine('statusMove');
    case 'weather-damage':
      return withLine('statusDamage');
    case 'weather-ended':
      return null;
    // An ability borrows the voice of what it did, exactly as a move's extra
    // effects do: something refused is a refusal, something gained is a gain.
    case 'ability':
      switch (event.effect) {
        case 'absorbed':
          return withLine(event.amount ? 'heal' : 'noEffect');
        case 'blocked-status':
        case 'blocked-boost':
        case 'blocked-secondaries':
        case 'hardened':
        case 'no-recoil':
          return withLine('denied');
        case 'shed':
        case 'cured-on-switch':
          return withLine('heal');
        case 'contact':
        case 'reflected':
          return withLine('statusApplied');
        case 'sent-out':
          return withLine('statDown');
        case 'powered-up':
        case 'sharpened':
        case 'shrugged-off':
        case 'quickened':
        case 'hidden':
          return withLine('statUp');
        case 'weathered-out':
          return withLine('statusMove');
      }
  }
}

/**
 * Whose cry a battle event carries, by where that Pokemon stands: FireRed gives
 * every Pokemon its own cry as it comes out of a ball, as it faints and as it
 * is caught, and nothing else in a fight cries. The scene turns the slot into a
 * species, because the event names the Pokemon only by its name on screen.
 */
export interface BattleCryCue {
  readonly name: CryEffectName;
  readonly side: 'player' | 'enemy';
  readonly slot: number;
}

export function battleEventCry(event: BattleEvent): BattleCryCue | null {
  switch (event.type) {
    case 'enemy-sent-out':
      return { name: 'cry', side: 'enemy', slot: event.slot ?? 0 };
    case 'fainted':
      return { name: 'faintCry', side: event.user, slot: event.slot ?? 0 };
    // The fanfare says it held; the cry follows it, because `AudioManager`
    // starts a cry only once a fanfare is over - FireRed's order, where the
    // newly caught Pokemon cries as its entry is added.
    case 'caught':
      return { name: 'cry', side: 'enemy', slot: 0 };
    default:
      return null;
  }
}

/** One Pokemon's cry, by National Dex number, as a line carries it. */
export interface CrySound {
  readonly name: CryEffectName;
  readonly species: number;
}

/** What one line of the battle's opening sounds, beside the line itself. */
export interface OpeningLineSound {
  readonly sound?: SoundEffectName;
  readonly cries: readonly CrySound[];
}

const cries = (species: readonly number[]): CrySound[] => species.map((id) => ({ name: 'cry', species: id }));

/**
 * The sounds that go with `battleOpeningMessages`' lines, one entry a line in
 * the same order. A wild Pokemon cries as it appears. A trainer's single
 * battle names nobody it sent out, so its Pokemon cries on the challenge line,
 * after the sting that opens the fight; a double names them, and both cry on
 * that line with the ball's pop. Every "Go, X!" is the pop and then the cry -
 * which is the opening send-out the playtest found silent (playtest 28, S2).
 * The teaching fight's opening is the wild opening with three lines after it,
 * and anything the scene reads after these lines (the weather, an ability)
 * sounds nothing here.
 */
export function openingLineSounds(
  trainerName: string | undefined,
  playerSpecies: readonly number[],
  enemySpecies: readonly number[],
): OpeningLineSound[] {
  if (!trainerName) {
    return [{ cries: cries(enemySpecies) }];
  }
  const goLine: OpeningLineSound = { sound: 'sendOut', cries: cries(playerSpecies) };
  if (enemySpecies.length > 1) {
    return [{ cries: [] }, { sound: 'sendOut', cries: cries(enemySpecies) }, goLine];
  }
  return [{ cries: cries(enemySpecies) }, goLine];
}

/**
 * A line of battle narration that is not an engine event - experience, a
 * switch, a failed escape - with the sound that belongs to it, if it has one.
 * The sound rides on the line so it is heard when the line is read, however
 * long the player took over the ones before it.
 */
export type BattleNote =
  | string
  | {
      readonly message: string;
      readonly sound?: SoundEffectName;
      /** Cries heard with the line, after its sound - the Pokemon a "Go, X!" lets out. */
      readonly cries?: readonly CrySound[];
      /** Once this line has been read, the player is asked which move to forget. */
      readonly offerMove?: { readonly pokemon: Pokemon; readonly move: MoveBase };
    };

export function battleNote(note: BattleNote): {
  readonly message: string;
  readonly sound?: SoundEffectName;
  readonly cries?: readonly CrySound[];
  readonly offerMove?: { readonly pokemon: Pokemon; readonly move: MoveBase };
} {
  return typeof note === 'string' ? { message: note } : note;
}
