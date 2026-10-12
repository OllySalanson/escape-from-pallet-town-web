import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn() }),
}));

// The question and the naming screen are drawn things; what is under test is
// that the hand-over asks, and that the answer names the Pokemon handed over.
const asked: { lines: readonly string[]; options: readonly string[]; selected?: number; onChoose: (index: number) => void }[] = [];
vi.mock('../ui/ChoicePrompt', () => ({
  ChoicePrompt: class {
    public constructor(_scene: unknown, options: (typeof asked)[number]) {
      asked.push(options);
    }
    public destroy(): void {}
  },
}));
const naming: { pokemon: { readonly base: { readonly name: string } }; onDone: (typed: string | null) => void }[] = [];
vi.mock('../ui/NamingScreenOverlay', () => ({
  openNamingScreen: (_scene: unknown, view: { pokemon: { base: { name: string } } }, onDone: (typed: string | null) => void) => {
    naming.push({ pokemon: view.pokemon, onDone });
  },
}));

import { Bag } from '../items';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { REEDBEDS_PIKACHU } from '../world/gifts';
import { WorldScene } from './WorldScene';

interface Driven {
  speakForGift(gift: typeof REEDBEDS_PIKACHU, after: readonly string[]): readonly string[];
  handleRunResolutionComplete(): void;
}

/** The world scene with a raid on, beside the giver, and nothing yet carried. */
function besideTheGiver() {
  asked.length = 0;
  naming.length = 0;
  const gifted: Pokemon[] = [];
  const scenePlugin = { pause: vi.fn(), resume: vi.fn() };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    bag: new Bag(),
    party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
    caughtPokemonStash: [],
    packReseated: false,
    pendingResultScreen: false,
    pendingHubTransition: false,
    scale: { width: 400, height: 256 },
    scene: scenePlugin,
    runSession: {
      manager: {
        snapshot: () => ({ giftIds: [], caughtPokemon: gifted }),
        registerGiftedPokemon: (_id: string, pokemon: Pokemon) => gifted.push(pokemon),
      },
    },
  });
  return { scene, driven: scene as unknown as Driven, scenePlugin, gifted };
}

describe('a gift handed over in a raid', () => {
  it('asks for a nickname once the hand-over is read, as a catch does, and names the gift', () => {
    const { driven, scenePlugin, gifted } = besideTheGiver();

    expect(driven.speakForGift(REEDBEDS_PIKACHU, [])).toEqual(REEDBEDS_PIKACHU.offer);
    expect(asked).toHaveLength(0);

    // The last line of the hand-over is read.
    driven.handleRunResolutionComplete();
    expect(asked).toHaveLength(1);
    expect(asked[0].lines.join(' ')).toBe('Give a nickname to PIKACHU?');
    expect(asked[0].options[asked[0].selected ?? 0]).toBe('NO');

    asked[0].onChoose(asked[0].options.indexOf('YES'));
    expect(scenePlugin.pause).toHaveBeenCalled();
    expect(naming).toHaveLength(1);
    expect(naming[0].pokemon).toBe(gifted[0]);

    naming[0].onDone('Sparky');
    expect(gifted[0].name).toBe('Sparky');
    expect(scenePlugin.resume).toHaveBeenCalled();

    // Asked once: the next line read in the raid asks nothing.
    driven.handleRunResolutionComplete();
    expect(asked).toHaveLength(1);
  });

  it('keeps the species name when the answer is NO', () => {
    const { driven, gifted } = besideTheGiver();
    driven.speakForGift(REEDBEDS_PIKACHU, []);
    driven.handleRunResolutionComplete();

    asked[0].onChoose(asked[0].options.indexOf('NO'));
    expect(naming).toHaveLength(0);
    expect(gifted[0].name).toBe('Pikachu');
  });
});
