import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 0,
    GameObjects: {
      Container: class {},
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          ENTER: 13,
          SPACE: 32,
        },
      },
    },
    Math: {
      Vector2: class {
        public set(): void {}
      },
    },
    Scale: {
      CENTER_BOTH: 0,
      FIT: 0,
    },
    Scene: class {},
  },
}));

vi.mock('./ui/DialogBox', () => ({
  DialogBox: class {
    public setScrollFactor(): this {
      return this;
    }
  },
}));

import { gameConfig } from './gameConfig';
import { getWalkAnimationKey } from './playerFrames';
import { Bag } from './items';
import { CHARMANDER, Pokemon, PokemonParty } from './pokemon';
import { PrimaryStatus } from './pokemon/battle/status';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { TitleScene } from './scenes/TitleScene';
import { SaveManager } from './save/SaveManager';
import { Stash } from './stash';
import { WorldScene } from './scenes/WorldScene';

describe('game start flow', () => {
  it('auto-starts Boot so World prerequisites are ready before Title can start it', () => {
    const scenes = gameConfig.scene as unknown[];

    expect(scenes).toEqual(expect.arrayContaining([BootScene, TitleScene, HubScene, WorldScene]));
    expect(scenes[0]).toBe(BootScene);

    const textures = new Set<string>();
    const animations = new Set<string>();
    const spritesheet = vi.fn((key: string) => textures.add(key));
    const image = vi.fn((key: string) => textures.add(key));
    const create = vi.fn(({ key }: { key: string }) => animations.add(key));
    const generateFrameNumbers = vi.fn().mockReturnValue([]);
    const start = vi.fn();
    const boot = Object.create(BootScene.prototype) as BootScene;

    Object.assign(boot as unknown as Record<string, unknown>, {
      load: { spritesheet, image },
      anims: { create, generateFrameNumbers },
      scene: { start },
    });

    boot.preload();
    boot.create();

    expect(spritesheet).toHaveBeenCalledWith('character', 'assets/character.png', {
      frameWidth: 16,
      frameHeight: 32,
    });
    expect(image).toHaveBeenCalledWith('classicTiles', 'assets/tileset.png');
    expect(create).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: getWalkAnimationKey('down') }),
    );
    expect(start).toHaveBeenCalledWith('title');

    const sprite = {
      setDepth: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
    };
    const world = new WorldScene();
    Object.assign(world as unknown as Record<string, unknown>, {
      add: {
        rectangle: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          setStrokeStyle: vi.fn().mockReturnThis(),
        })),
        sprite: vi.fn((_: number, __: number, texture: string) => {
          expect(textures).toContain(texture);
          expect(animations).toContain(getWalkAnimationKey('down'));
          return sprite;
        }),
      },
      cameras: {
        main: {
          setBounds: vi.fn(),
          setRoundPixels: vi.fn(),
          setZoom: vi.fn(),
          startFollow: vi.fn(),
        },
      },
      input: {
        keyboard: {
          addCapture: vi.fn(),
          addKey: vi.fn(),
          addKeys: vi.fn(() => ({})),
          createCursorKeys: vi.fn(() => ({})),
        },
      },
      make: {
        tilemap: vi.fn(() => ({
          addTilesetImage: vi.fn((key: string) => {
            expect(textures).toContain(key);
            return {};
          }),
          createBlankLayer: vi.fn(() => ({
            putTilesAt: vi.fn(),
            setDepth: vi.fn(),
          })),
        })),
      },
    });

    const carriedParty = new PokemonParty([new Pokemon(CHARMANDER, 5)]);
    carriedParty.pokemon[0].takeDamage(4);
    carriedParty.pokemon[0].primaryStatus = PrimaryStatus.Poison;
    expect(() => world.create({ party: carriedParty })).not.toThrow();
    expect((world as unknown as { party: PokemonParty }).party).toBe(carriedParty);
    expect(carriedParty.pokemon[0].currentHp).toBe(carriedParty.pokemon[0].maxHp - 4);
    expect(carriedParty.pokemon[0].primaryStatus).toBe(PrimaryStatus.Poison);

    const dialog = {
      visible: false,
      showMessages: vi.fn(() => {
        dialog.visible = true;
      }),
    };
    Object.assign(world as unknown as Record<string, unknown>, {
      currentTile: { x: 6, y: 8 },
      facing: 'left',
      dialogBox: dialog,
      npcSprites: new Map(),
    });

    (world as unknown as { tryInteract(): void }).tryInteract();

    expect(dialog.showMessages).toHaveBeenCalledWith([
      'Pallet Town is small, but every great journey starts somewhere.',
      'The tall grass is waiting just beyond town!',
    ]);
    expect(dialog.visible).toBe(true);
  });

  it('repairs an empty stash when continuing a saved game', () => {
    const values = new Map<string, string>();
    const saves = new SaveManager({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    });
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash: new Stash(),
    });
    const title = Object.create(TitleScene.prototype) as TitleScene;
    Object.assign(title as unknown as Record<string, unknown>, { saveManager: saves });

    const game = (title as unknown as { loadOrCreateGame(): ReturnType<SaveManager['load']> }).loadOrCreateGame();

    expect(game?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    expect(saves.load()?.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });
});
