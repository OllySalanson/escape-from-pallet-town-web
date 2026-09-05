import Phaser from 'phaser';
import type { Direction } from '../movement/gridMovement';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';

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
  }

  public create(): void {
    this.createPlayerAnimations();
    this.scene.start('world');
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
