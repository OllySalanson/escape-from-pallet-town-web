import { PUNT_PATH, PUNT_TEXTURE } from '../world/sailing';
import Phaser from 'phaser';
import { SHINY_SPARKLE_TEXTURE } from '../ui/shinySparkle';
import type { Direction } from '../movement/gridMovement';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';
import { SPECIES_BY_ID } from '../pokemon/species';
import {
  CHARACTER_DESIGN_IDS,
  CHARACTER_DESIGN_SHEET_COLUMNS,
  characterDesignAssetPath,
  characterDesignTextureKey,
} from '../world/characterDesigns';
import { PARTNER_FRAME, PARTNER_SPECIES, partnerAssetPath, partnerTextureKey } from '../base/partner';
import { HARBOUR_SPECIES, harbourPokemonAssetPath, harbourPokemonTextureKey } from '../base/harbourLife';
import { HARBOUR_BIRD_PATH, HARBOUR_BIRD_TEXTURE } from '../base/harbourBird';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';
import {
  POKEMON_ICON_PATH,
  POKEMON_ICON_SIZE,
  POKEMON_ICON_TEXTURE,
} from '../world/pokemonFigures';
import {
  BERRY_TREE_FRAME_HEIGHT,
  BERRY_TREE_FRAME_WIDTH,
  BERRY_TREE_PATH,
  BERRY_TREE_TEXTURE,
} from '../world/berries';
import { FURNITURE_PATH, FURNITURE_TEXTURE } from '../base/furnitureArt';
import { isTestLabRequested } from '../dev/testLabAccess';
import { ICON_NAMES, iconTextureKey } from '../ui/icons';
import { awaitGameFont } from '../ui/gameFont';
import { publicAssetUrl } from '../publicAssetUrl';
import { drawPixelWindow } from '../ui/pixelWindow';
import { TILE_SOURCES } from '../world/tileset/sheets';
import {
  BIKE_ASSET_PATH,
  BIKE_FRAME_RATE,
  BIKE_FRAME_SIZE,
  BIKE_SHEET_COLUMNS,
  BIKE_TEXTURE,
} from '../world/bicycle';

import { WEARABLES_ASSET_PATH, WEARABLES_TEXTURE } from '../look/lookTexture';

const DIRECTIONS: readonly Direction[] = ['down', 'left', 'up', 'right'];

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public preload(): void {
    this.drawLoading();
    this.load.spritesheet(SHARED_CHARACTER_TEXTURE, publicAssetUrl('assets/character.png'), {
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
    });
    // Every registered design, at the same frame size as the shared sheet, so a
    // figure that names one is a change of texture key and nothing else.
    for (const design of CHARACTER_DESIGN_IDS) {
      this.load.spritesheet(
        characterDesignTextureKey(design),
        publicAssetUrl(characterDesignAssetPath(design)),
        {
          frameWidth: CHARACTER_FRAME_WIDTH,
          frameHeight: CHARACTER_FRAME_HEIGHT,
        },
      );
    }
    // FireRed's Bicycle, ridden: the figure the player becomes on it.
    this.load.spritesheet(BIKE_TEXTURE, publicAssetUrl(BIKE_ASSET_PATH), {
      frameWidth: BIKE_FRAME_SIZE,
      frameHeight: BIKE_FRAME_SIZE,
    });
    // The partner's walking art, for each Pokemon a partner can be. Nine small
    // sheets, so all of them rather than only this save's: a partner evolves
    // in a raid and comes home a different sheet.
    for (const species of PARTNER_SPECIES) {
      this.load.spritesheet(partnerTextureKey(species), publicAssetUrl(partnerAssetPath(species)), {
        frameWidth: PARTNER_FRAME,
        frameHeight: PARTNER_FRAME,
      });
    }
    // The bird that glides over the harbour (`base/harbourBird.ts`).
    this.load.image(HARBOUR_BIRD_TEXTURE, publicAssetUrl(HARBOUR_BIRD_PATH));
    this.load.image(PUNT_TEXTURE, publicAssetUrl(PUNT_PATH));
    // The harbour's own Pokemon (`base/harbourLife.ts`), cut the same way.
    for (const species of HARBOUR_SPECIES) {
      this.load.spritesheet(harbourPokemonTextureKey(species), publicAssetUrl(harbourPokemonAssetPath(species)), {
        frameWidth: PARTNER_FRAME,
        frameHeight: PARTNER_FRAME,
      });
    }
    // FireRed's party icons, for the Pokemon a map maker stands in the world.
    this.load.spritesheet(POKEMON_ICON_TEXTURE, publicAssetUrl(POKEMON_ICON_PATH), {
      frameWidth: POKEMON_ICON_SIZE,
      frameHeight: POKEMON_ICON_SIZE,
    });
    // Emerald's berry trees, for the ones a map maker plants.
    this.load.spritesheet(BERRY_TREE_TEXTURE, publicAssetUrl(BERRY_TREE_PATH), {
      frameWidth: BERRY_TREE_FRAME_WIDTH,
      frameHeight: BERRY_TREE_FRAME_HEIGHT,
    });
    // The furniture a player arranges in their house: Emerald's Secret Base
    // decorations and the house's own plants and table (`home/furniture.ts`).
    this.load.image(FURNITURE_TEXTURE, publicAssetUrl(FURNITURE_PATH));
    // Every piece the boutique sells, cut from FireRed's people
    // (`look/generated/wearablePieces.ts`): a look is composed from it.
    this.load.image(WEARABLES_TEXTURE, publicAssetUrl(WEARABLES_ASSET_PATH));
    // Every sheet a map might be drawn from. A catalogue is chosen per map and
    // may draw from more than one sheet at a time, so the loader takes the list
    // rather than naming any of them: `frlg-tiles.png` for the ground, and
    // ArMM1998's CC0 `Overworld.png` for the objects standing on it.
    for (const source of TILE_SOURCES) {
      this.load.image(source.textureKey, publicAssetUrl(source.imagePath));
    }
    this.load.image(
      'battle-background-grass',
      publicAssetUrl('assets/battle/background-grass.png'),
    );

    // The raid's markers are pixel art rather than tinted rectangles. They are
    // all one tile square, so a marker drawn at the centre of a tile lands on
    // whole pixels; `iconAssets.test.ts` enforces both facts.
    for (const name of ICON_NAMES) {
      this.load.image(iconTextureKey(name), publicAssetUrl(`assets/icons/${name}.png`));
    }

    // Every species sprite is a PNG. A per-species file-format exception is how
    // Squirtle shipped as a dimensionless SVG that rasterised to a 150x150
    // block and covered the battle screen, so there is deliberately no escape
    // hatch here: new art must match, and `spriteAssets.test.ts` enforces it.
    for (const species of Object.values(SPECIES_BY_ID)) {
      this.load.image(
        `pokemon-front-${species.dexId}`,
        publicAssetUrl(`assets/pokemon/front/${species.dexId}.png`),
      );
      this.load.image(
        `pokemon-back-${species.dexId}`,
        publicAssetUrl(`assets/pokemon/back/${species.dexId}.png`),
      );
    }
    // FireRed's gold stars, for the sparkle a shiny lands with. A shiny's own
    // colours are fetched by the fight that meets one (`BattleScene.preload`).
    this.load.image(SHINY_SPARKLE_TEXTURE, publicAssetUrl('assets/battle/shiny-sparkle.png'));
  }

  public create(): void {
    this.createPlayerAnimations();
    this.createDesignAnimations();
    // The game font is an asset like any other, so it is waited for here rather
    // than hoped for later: Phaser paints canvas text with whatever face is
    // ready at that instant and never repaints it, so a battle drawn before the
    // face arrives keeps the browser's monospace for the life of that screen.
    // `awaitGameFont` resolves either way, so a missing file delays boot by at
    // most `GAME_FONT_TIMEOUT_MS` instead of wedging it.
    void awaitGameFont().then(() => {
      this.scene.start(isTestLabRequested() ? 'test-lab' : 'title');
    });
  }

  /**
   * What shows while the game's art arrives: the title's own dusk, and a bar
   * filling in its mint, so the first thing on screen is the colour of the
   * title it is about to become rather than a black box. No words - the
   * typeface is one of the things still on its way.
   */
  private drawLoading(): void {
    const { width, height } = this.scale;
    const dusk = this.add.graphics();
    dusk.fillStyle(0x0a1428, 1);
    dusk.fillRect(0, 0, width, height);
    const barWidth = Math.min(120, width - 64);
    const bar = { x: Math.floor((width - barWidth) / 2), y: Math.floor(height * 0.62), width: barWidth, height: 7 };
    drawPixelWindow(dusk, bar, { fill: 0x0f1f33 });
    const fill = this.add.graphics();
    this.load.on('progress', (progress: number) => {
      fill.clear();
      fill.fillStyle(0x8ed4c2, 1);
      fill.fillRect(bar.x + 2, bar.y + 2, Math.round((bar.width - 4) * progress), bar.height - 4);
    });
  }

  private createPlayerAnimations(): void {
    this.createWalkAnimations(SHARED_CHARACTER_TEXTURE, (direction) => ({
      key: getWalkAnimationKey(direction),
      frames: getWalkFrames(direction),
    }));
    // The pedalling cycle, at twice the pace because the ride is twice as fast.
    this.createWalkAnimations(
      BIKE_TEXTURE,
      (direction) => ({
        key: getWalkAnimationKey(direction, BIKE_TEXTURE),
        frames: getWalkFrames(direction, BIKE_SHEET_COLUMNS),
      }),
      BIKE_FRAME_RATE,
    );
  }

  /**
   * The designs carry the same walk cycle as the shared sheet, so it is
   * registered for each of them here even though nothing placed today walks:
   * whoever first moves an NPC plays `getWalkAnimationKey(direction, textureKey)`
   * and finds it there.
   */
  private createDesignAnimations(): void {
    for (const design of CHARACTER_DESIGN_IDS) {
      const textureKey = characterDesignTextureKey(design);
      this.createWalkAnimations(textureKey, (direction) => ({
        key: getWalkAnimationKey(direction, textureKey),
        frames: getWalkFrames(direction, CHARACTER_DESIGN_SHEET_COLUMNS),
      }));
    }
  }

  private createWalkAnimations(
    textureKey: string,
    cycle: (direction: Direction) => { key: string; frames: number[] },
    frameRate = 10,
  ): void {
    for (const direction of DIRECTIONS) {
      const { key, frames } = cycle(direction);
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(textureKey, { frames }),
        frameRate,
        repeat: -1,
      });
    }
  }
}
