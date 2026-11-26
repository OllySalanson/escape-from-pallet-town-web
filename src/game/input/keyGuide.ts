import { LIBRARY_CONTROLS } from '../library/controls';
import { FULL_SCREEN_KEYS } from '../display/fullScreen';
import { POKEDEX_KEY } from './keyBindings';

/**
 * Every key the game answers, grouped by where it works, as the HELP screen
 * under the game shows them (`ui/controlsBar.ts`, `scenes/ControlsScene.ts`).
 *
 * Read off the same table THE GREAT LIBRARY's books teach from
 * (`library/controls.ts`), which reads each letter from the table the scene
 * binds it from (`input/keyBindings.ts`), so HELP cannot show a key after the
 * game has moved it.
 */
export interface KeyGuideKey {
  /** The key or keys as a keycap shows them: `B`, `ARROWS`, `Q E`. */
  readonly keys: string;
  /** What it does, in the game's words. */
  readonly does: string;
}

export interface KeyGuideGroup {
  readonly title: string;
  readonly keys: readonly KeyGuideKey[];
}

const key = (keys: string, does: string): KeyGuideKey => ({ keys, does });

export const KEY_GUIDE: readonly KeyGuideGroup[] = [
  {
    title: 'Everywhere',
    keys: [
      key(LIBRARY_CONTROLS.walk, 'Walk, and move the cursor'),
      key(LIBRARY_CONTROLS.wasd, 'Walk, and move the cursor'),
      key(LIBRARY_CONTROLS.interact, 'Talk, read, open, choose'),
      key(LIBRARY_CONTROLS.confirm, 'Choose'),
      key(LIBRARY_CONTROLS.back, 'Close, go back'),
      key(LIBRARY_CONTROLS.mute, 'Sound on and off'),
      key(LIBRARY_CONTROLS.feedback, 'Tell the lab what happened'),
      key(FULL_SCREEN_KEYS, 'Full screen, and back'),
    ],
  },
  {
    title: 'In the harbour',
    keys: [
      key(LIBRARY_CONTROLS.team, 'Your team'),
      key(LIBRARY_CONTROLS.pack, 'Your things'),
      key(POKEDEX_KEY, 'Pokédex'),
      key(LIBRARY_CONTROLS.map, 'The map'),
      key(LIBRARY_CONTROLS.oak, 'Favours'),
      key(LIBRARY_CONTROLS.look, 'Look around'),
      key(LIBRARY_CONTROLS.say, 'Say a phrase'),
      key(LIBRARY_CONTROLS.decorate, 'Decorate your house'),
      key(LIBRARY_CONTROLS.coin, 'Toss a coin into the pit'),
    ],
  },
  {
    title: 'On a raid',
    keys: [
      key(LIBRARY_CONTROLS.team, 'Your team'),
      key(LIBRARY_CONTROLS.pack, 'The pack'),
      key(LIBRARY_CONTROLS.map, 'The map'),
      key(LIBRARY_CONTROLS.oak, 'Oak on the radio'),
      key(LIBRARY_CONTROLS.look, 'Look around'),
      key(LIBRARY_CONTROLS.say, 'Say a phrase, with a friend'),
      key(LIBRARY_CONTROLS.ping, 'Point a friend here'),
    ],
  },
  {
    title: 'In a menu or a fight',
    keys: [
      key('TAB', 'Next part of the screen'),
      key(LIBRARY_CONTROLS.packTurn, 'Turn a thing in the pack'),
      key(LIBRARY_CONTROLS.battleBack, 'Back, in a fight'),
      key(`${LIBRARY_CONTROLS.boxBack} ${LIBRARY_CONTROLS.boxNext}`, 'Walk a box or a list'),
      key(LIBRARY_CONTROLS.putAway, 'Put a piece away, decorating'),
      key(LIBRARY_CONTROLS.telescopeCloser, 'Closer, on the map and the telescope'),
    ],
  },
];
