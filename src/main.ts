import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';
import { mountGame, unmountGame } from './game/gameLifecycle';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

mountGame(() => new Phaser.Game(createGameConfig(developmentScenes)));

if (import.meta.hot) {
  import.meta.hot.dispose(() => unmountGame());
}
