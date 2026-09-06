import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { BagScene } from './scenes/BagScene';
import { BootScene } from './scenes/BootScene';
import { PartyScene } from './scenes/PartyScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';

const GAME_WIDTH = 320;
const GAME_HEIGHT = 240;
const GAME_ZOOM = 3;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  render: {
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: GAME_ZOOM,
  },
  scene: [BootScene, TitleScene, WorldScene, BattleScene, PartyScene, BagScene],
};
