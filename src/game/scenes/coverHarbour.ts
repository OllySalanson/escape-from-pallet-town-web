import Phaser from 'phaser';

/**
 * Takes THE HARBOUR off the screen while a scene that covers all of it is up.
 *
 * A paused Phaser scene stops updating but is still drawn every frame, so a
 * game opened over the paused harbour paid for the whole yard - its tile
 * layers, the night's wash, every figure - under a picture of its own that
 * hid every pixel of it. Measured on THE PROMENADE DERBY, that was half the
 * race's frame rate (playtest 51, finding 3: 21.6 fps against 54.6 with the
 * harbour hidden, `tools/playtest/derbyFrames.mjs`). Only a scene that paints
 * the whole screen may ask: anything showing the harbour round its edges
 * would lose it. The harbour is drawn again the moment the scene stops.
 */
export function hideHarbourUnder(scene: Phaser.Scene): void {
  scene.scene.setVisible(false, 'base');
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scene.setVisible(true, 'base'));
}
