import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { placeCaptions, type Rect } from '../ui/labelPlacement';
import { BaseScene } from './BaseScene';

const VIEW = { left: 700, top: 400, right: 1100, bottom: 656, width: 400, height: 256 };
const BOX = { x: 84, y: 192, width: 232, height: 56 };

/** The real talk hint on a stand-in of a scene with more of a keeper's words to come. */
function talking(): { hintRect: () => Rect; chip: () => Rect } {
  const anything: unknown = new Proxy(() => anything, { get: () => anything });
  const text = { width: 46, height: 12, text: '', setText: () => text, setVisible: () => text, setPosition: () => text };
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    dialogBox: { boxesLeft: 3, x: BOX.x, y: BOX.y },
    afterSaid: null,
    hintText: text,
    hintFrame: anything,
    hintShown: '',
    hintSeat: undefined,
    scale: { width: VIEW.width, height: VIEW.height },
    cameras: { main: { scrollY: VIEW.top } },
    currentTile: { x: 50, y: 30 },
  });
  const methods = scene as unknown as { showTalkHint(): void; hintRect(view: unknown): Rect };
  methods.showTalkHint();
  return {
    hintRect: () => methods.hintRect(VIEW),
    // Where the chip is drawn: the right of the box, just above it.
    chip: () => ({ x: VIEW.left + BOX.x + BOX.width - 56, y: VIEW.top + BOX.y - 22, width: 56, height: 16 }),
  };
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the [ESC] SKIP chip on a box', () => {
  it('takes the ground it stands on from a caption, so no name is cut off under it', () => {
    const { hintRect, chip } = talking();
    const width = 138;
    const height = 32;
    // A thing just above the box, wanting its name underneath it: the telescope
    // beside the rail while the marshal speaks, as played.
    const [seat] = placeCaptions(
      [{ subject: { x: VIEW.left + 220, y: VIEW.top + 102, width: 32, height: 48 }, width, height, preferred: 'below' }],
      {
        bounds: { x: VIEW.left, y: VIEW.top, width: VIEW.width, height: VIEW.height },
        furniture: [hintRect(), { x: VIEW.left + BOX.x, y: VIEW.top + BOX.y, width: BOX.width, height: BOX.height }],
        keepClear: [],
        canopy: [],
      },
    );

    expect(seat.visible).toBe(true);
    expect(overlaps({ x: seat.x, y: seat.y, width, height }, chip())).toBe(false);
  });

  it('leaves the foot of the screen free, which a chip on a box is not standing on', () => {
    const rect = talking().hintRect();

    expect(rect.y + rect.height).toBeLessThanOrEqual(VIEW.top + BOX.y);
    expect(rect.width).toBeLessThan(VIEW.width);
  });
});
