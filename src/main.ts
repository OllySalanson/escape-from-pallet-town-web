import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

new Phaser.Game(createGameConfig(developmentScenes));
