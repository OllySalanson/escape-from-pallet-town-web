import type { SoundEffectName } from './soundEffects';

/**
 * What a click on a menu button sounds like before the scene has said anything.
 *
 * Every DOM screen is built from the same buttons, so the baseline is decided
 * once, from the button's own `data-` attributes, rather than at each of the
 * sixty places a screen binds a handler. A screen that knows more - the loadout
 * was refused, the medicine worked - plays its own effect from that handler in
 * the same tick, and `AudioManager.play()` lets it replace this one rather than
 * stack on it. `data-sfx` overrides the guess; `data-sfx="none"` silences it.
 */
const LEAVING = ['back', 'backStep', 'close', 'swapCancel'] as const;

/**
 * Buttons whose screen always answers them with a sound of its own - a refusal
 * or the thing they did - so the baseline stays out of the way rather than
 * being asked for and cut in the same tick.
 */
const ANSWERED = [
  'advance',
  'start',
  'swapConfirm',
  'continue',
  'recover',
  'recoverAll',
  'treatItem',
  'pokemon',
  'secureItem',
  'target',
  'sound',
] as const;

export function menuClickSound(dataset: Readonly<Record<string, string | undefined>>): SoundEffectName | null {
  const authored = dataset.sfx;
  if (authored === 'none') {
    return null;
  }
  if (authored === 'confirm' || authored === 'cancel' || authored === 'select') {
    return authored;
  }
  if (ANSWERED.some((key) => dataset[key] !== undefined)) {
    return null;
  }
  return LEAVING.some((key) => dataset[key] !== undefined) ? 'cancel' : 'select';
}
