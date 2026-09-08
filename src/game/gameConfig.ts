import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { BagScene } from './scenes/BagScene';
import { BootScene } from './scenes/BootScene';
import { ExtractionScene } from './scenes/ExtractionScene';
import { HubScene } from './scenes/HubScene';
import { ObjectivesScene } from './scenes/ObjectivesScene';
import { PartyScene } from './scenes/PartyScene';
import { StarterScene } from './scenes/StarterScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH, computeStage } from './display/stage';

const BASE_SCENES = [
  BootScene,
  TitleScene,
  StarterScene,
  HubScene,
  WorldScene,
  BattleScene,
  PartyScene,
  BagScene,
  ObjectivesScene,
  ExtractionScene,
];

export function createGameConfig(
  developmentScenes: Phaser.Types.Scenes.SceneType[] = [],
): Phaser.Types.Core.GameConfig {
  // Sized once here so the first frame is already correct; `watchViewport` owns
  // it from then on. FIT is deliberately not used: it keeps one backing-store
  // size and resamples it, which is what blurred the art in a short window and
  // pinned the game to 960x720 in a tall one.
  const stage =
    typeof window === 'undefined'
      ? { width: BASE_STAGE_WIDTH, height: BASE_STAGE_HEIGHT, zoom: 3 }
      : computeStage(window.innerWidth, window.innerHeight);

  return {
    type: Phaser.AUTO,
    parent: 'app',
    width: stage.width,
    height: stage.height,
    backgroundColor: '#000000',
    pixelArt: true,
    render: {
      antialias: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: stage.zoom,
    },
    scene: [...BASE_SCENES, ...developmentScenes],
  };
}

export const gameConfig = createGameConfig();
