import type Phaser from 'phaser';

/**
 * A fishing float, centred on its own origin: red over white in the shared
 * outline, sitting on two flecks of ripple - or, taken under by a bite, only
 * its red tip showing in a wider ring of them.
 */
export function paintFloat(float: Phaser.GameObjects.Graphics, sunk: boolean): Phaser.GameObjects.Graphics {
  const ripple = 0xa8d0f0;
  if (sunk) {
    float.fillStyle(0x241f2e, 1).fillRect(-2, 0, 4, 3);
    float.fillStyle(0xe04848, 1).fillRect(-1, 1, 2, 2);
    return float.fillStyle(ripple, 1).fillRect(-6, 3, 3, 1).fillRect(3, 3, 3, 1).fillRect(-4, 5, 8, 1);
  }
  float.fillStyle(0x241f2e, 1).fillRect(-3, -4, 6, 7);
  float.fillStyle(0xe04848, 1).fillRect(-2, -3, 4, 3);
  float.fillStyle(0xf8f8f0, 1).fillRect(-2, 0, 4, 2);
  return float.fillStyle(ripple, 1).fillRect(-5, 3, 2, 1).fillRect(3, 3, 2, 1);
}
