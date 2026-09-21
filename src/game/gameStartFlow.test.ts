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
      NONE: 0,
      Events: { RESIZE: 'resize' },
    },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
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
import { StarterScene } from './scenes/StarterScene';
import { TitleScene } from './scenes/TitleScene';
import { SaveManager } from './save/SaveManager';
import { createStartingStash, Stash } from './stash';
import { WorldScene } from './scenes/WorldScene';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from './display/stage';
import { WORLD_MAPS } from './worldMap';
import {
  CHARACTER_DESIGN_IDS,
  characterDesignAssetPath,
  characterDesignTextureKey,
} from './world/characterDesigns';

describe('game start flow', () => {
  it('auto-starts Boot so World prerequisites are ready before Title can start it', async () => {
    const scenes = gameConfig.scene as unknown[];

    expect(scenes).toEqual(expect.arrayContaining([BootScene, TitleScene, StarterScene, HubScene, WorldScene]));
    expect(scenes[0]).toBe(BootScene);

    const textures = new Set<string>();
    const animations = new Set<string>();
    const spritesheet = vi.fn((key: string) => textures.add(key));
    const image = vi.fn((key: string) => textures.add(key));
    const create = vi.fn(({ key }: { key: string }) => animations.add(key));
    const generateFrameNumbers = vi.fn().mockReturnValue([]);
    const start = vi.fn<(scene: string, data?: { savedGame?: unknown }) => void>();
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
    // Every sheet a shipped map draws from is fetched before the world can ask
    // for it. All four maps are on the town catalogue now - FireRed ground,
    // CC0 buildings - so these are the two sheets a raid cannot start without.
    for (const map of Object.values(WORLD_MAPS)) {
      for (const source of map.tileset.sources) {
        expect(image).toHaveBeenCalledWith(source.textureKey, source.imagePath);
      }
    }
    // No shipped map draws from the classic sheet any more, but it is still the
    // catalogue `worldMap.ts` gives a map that names none, so it is still loaded.
    expect(image).toHaveBeenCalledWith('classicTiles', 'assets/tileset.png');
    // Every registered character design is loaded on the same frame grid and
    // given the same four-facing walk cycle as the shared sheet.
    for (const design of CHARACTER_DESIGN_IDS) {
      const textureKey = characterDesignTextureKey(design);
      expect(spritesheet).toHaveBeenCalledWith(textureKey, characterDesignAssetPath(design), {
        frameWidth: 16,
        frameHeight: 32,
      });
      expect(animations).toContain(getWalkAnimationKey('left', textureKey));
    }
    expect(create).toHaveBeenCalledTimes(4 * (1 + CHARACTER_DESIGN_IDS.length));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: getWalkAnimationKey('down') }),
    );
    // Boot waits for the game font before it starts a scene, so the first
    // battle of a session cannot be drawn in the browser's fallback face.
    expect(start).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(start).toHaveBeenCalledWith('title'));

    const sprite = {
      setDepth: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
    };
    const graphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
    };
    const key = (): { isDown: boolean; on: () => void } => ({ isDown: false, on: vi.fn() });
    const world = new WorldScene();
    Object.assign(world as unknown as Record<string, unknown>, {
      add: {
        rectangle: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          setStrokeStyle: vi.fn().mockReturnThis(),
          // The veil that darkens an interior's floor is drawn from its
          // top-left corner (`interiors.ts`).
          setOrigin: vi.fn().mockReturnThis(),
        })),
        // Every marker the raid draws is a preloaded icon texture, so a marker
        // added without a matching `load.image` in BootScene fails here rather
        // than rendering as Phaser's missing-texture block in a live raid.
        image: vi.fn((_: number, __: number, texture: string) => {
          expect(textures).toContain(texture);
          return {
            setDepth: vi.fn().mockReturnThis(),
            setTexture: vi.fn().mockReturnThis(),
          };
        }),
        graphics: vi.fn(() => graphics),
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
      scale: {
        width: BASE_STAGE_WIDTH,
        height: BASE_STAGE_HEIGHT,
        on: vi.fn(),
        off: vi.fn(),
      },
      input: {
        keyboard: {
          addCapture: vi.fn(),
          addKey: vi.fn(key),
          addKeys: vi.fn(() => ({ W: key(), A: key(), S: key(), D: key() })),
          createCursorKeys: vi.fn(() => ({ up: key(), down: key(), left: key(), right: key() })),
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
            forEachTile: vi.fn(),
            // An interior's lid is a layer the scene hides and shows
            // (`interiors.ts`), so a stubbed layer has to answer that too.
            setAlpha: vi.fn(),
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
      // On the market square's paving, facing the guide who stands on it.
      currentTile: { x: 8, y: 10 },
      facing: 'right',
      dialogBox: dialog,
      npcSprites: new Map(),
    });

    (world as unknown as { tryInteract(): void }).tryInteract();

    expect(dialog.showMessages).toHaveBeenCalledWith([
      'Two houses, one square, and the water between us and everywhere else.',
      'East for the field and the mill. South for the sheds and the allotments.',
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
    // The kit, and the pack every save is issued so it has something to carry it in.
    expect(saves.load()?.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3, 'raid-pack': 1 });
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'] as const)(
    'commits the selected %s starter to a fresh profile before opening the hub',
    (starterSpeciesId) => {
      const values = new Map<string, string>();
      const saves = new SaveManager({
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      });
      const start = vi.fn();
      const starter = Object.create(StarterScene.prototype) as StarterScene;
      Object.assign(starter as unknown as Record<string, unknown>, {
        saveManager: saves,
        selectedStarterId: starterSpeciesId,
        scene: { start },
      });

      (starter as unknown as { confirmStarter(): void }).confirmStarter();

      expect(saves.load()?.starterSpeciesId).toBe(starterSpeciesId);
      expect(saves.load()?.stash.listPokemon()).toMatchObject([
        { pokemon: { base: { id: starterSpeciesId }, level: 5 } },
      ]);
      expect(start).toHaveBeenCalledTimes(1);
    },
  );

  it('returns a browser reload to the hub instead of resuming an active raid location', () => {
    const values = new Map<string, string>();
    const saves = new SaveManager({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    });
    saves.save({
      party: new PokemonParty([]),
      mapId: 'viridian-forest',
      position: { x: 23, y: 32 },
      bag: new Bag(),
      stash: createStartingStash(),
    });
    const start = vi.fn();
    const title = Object.create(TitleScene.prototype) as TitleScene;
    Object.assign(title as unknown as Record<string, unknown>, {
      saveManager: saves,
      prompt: { setText: vi.fn() },
      scene: { start },
      time: { delayedCall: (_delay: number, callback: () => void) => callback() },
      playStartAudio: vi.fn(),
    });

    (title as unknown as { startGame(): void }).startGame();

    expect(start.mock.calls).toHaveLength(1);
    expect(start.mock.calls[0]?.[0]).toBe('hub');
  });
});
