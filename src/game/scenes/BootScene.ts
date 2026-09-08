import Phaser from 'phaser';
import type { Direction } from '../movement/gridMovement';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';
import { SPECIES_BY_ID } from '../pokemon/species';
import { isTestLabRequested } from '../dev/testLabAccess';
import { ICON_NAMES, iconTextureKey } from '../ui/icons';
import { awaitGameFont } from '../ui/gameFont';

const DIRECTIONS: readonly Direction[] = ['down', 'left', 'up', 'right'];

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public preload(): void {
    this.load.spritesheet('character', 'assets/character.png', {
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
    });
    this.load.image('classicTiles', 'assets/tileset.png');
    this.load.image('battle-background-grass', 'assets/battle/background-grass.png');

    // The raid's markers are pixel art rather than tinted rectangles. They are
    // all one tile square, so a marker drawn at the centre of a tile lands on
    // whole pixels; `iconAssets.test.ts` enforces both facts.
    for (const name of ICON_NAMES) {
      this.load.image(iconTextureKey(name), `assets/icons/${name}.png`);
    }

    // Every species sprite is a PNG. A per-species file-format exception is how
    // Squirtle shipped as a dimensionless SVG that rasterised to a 150x150
    // block and covered the battle screen, so there is deliberately no escape
    // hatch here: new art must match, and `spriteAssets.test.ts` enforces it.
    for (const species of Object.values(SPECIES_BY_ID)) {
      this.load.image(`pokemon-front-${species.dexId}`, `assets/pokemon/front/${species.dexId}.png`);
      this.load.image(`pokemon-back-${species.dexId}`, `assets/pokemon/back/${species.dexId}.png`);
    }
  }

  public create(): void {
    this.createPlayerAnimations();
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

  private createPlayerAnimations(): void {
    for (const direction of DIRECTIONS) {
      this.anims.create({
        key: getWalkAnimationKey(direction),
        frames: this.anims.generateFrameNumbers('character', {
          frames: getWalkFrames(direction),
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }
}
