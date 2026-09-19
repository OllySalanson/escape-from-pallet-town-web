import { MoveCategory, type MoveBase } from '../pokemon/MoveBase';
import type { Pokemon } from '../pokemon/Pokemon';
import type { BattleEvent } from '../pokemon/battle/battleEngine';
import type { SoundEffectName } from './soundEffects';

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
    case 'critical-hit':
      return withLine('criticalHit');
    case 'effectiveness':
      if (event.multiplier === 0) {
        return withLine('noEffect');
      }
      return withLine(event.multiplier > 1 ? 'superEffective' : 'notVeryEffective');
    case 'fainted':
      return withLine('faint');
    case 'status-applied':
      return withLine('statusApplied');
    case 'status-damage':
    case 'confusion-self-hit':
      return withLine('statusDamage');
    case 'status-cured':
      return withLine('heal');
    case 'stat-stage-changed':
      return withLine(event.stages > 0 ? 'statUp' : 'statDown');
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
      /** Once this line has been read, the player is asked which move to forget. */
      readonly offerMove?: { readonly pokemon: Pokemon; readonly move: MoveBase };
    };

export function battleNote(note: BattleNote): {
  readonly message: string;
  readonly sound?: SoundEffectName;
  readonly offerMove?: { readonly pokemon: Pokemon; readonly move: MoveBase };
} {
  return typeof note === 'string' ? { message: note } : note;
}
