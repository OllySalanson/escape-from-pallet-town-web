import Phaser from 'phaser';
import type { Direction } from '../movement/gridMovement';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';
import { SPECIES_BY_ID } from '../pokemon/species';

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
    this.load.image('battle-hud', 'assets/battle/hud-box.png');
    this.load.image('battle-dialog', 'assets/battle/dialog-plain.png');

    for (const species of Object.values(SPECIES_BY_ID)) {
      this.load.image(`pokemon-front-${species.dexId}`, `assets/pokemon/front/${species.dexId}.png`);
      this.load.image(`pokemon-back-${species.dexId}`, `assets/pokemon/back/${species.dexId}.png`);
    }
  }

  public create(): void {
    this.createPlayerAnimations();
    this.scene.start('title');
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
