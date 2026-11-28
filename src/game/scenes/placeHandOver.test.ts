import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractionReport } from '../run/extractionReport';
import { WorldScene } from './WorldScene';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

/**
 * A raid that got out hands the world's last frame to its result, so the stage
 * it opens on stands in the place it got out of rather than in a black room
 * (the captain, 26 Nov 2026: "We still need to improve on the overall
 * screen"). The hand-over must never wait on a picture for ever: a render loop
 * that is stopped never answers.
 */
class FakeImage {}

interface Harness {
  readonly scene: WorldScene;
  readonly start: ReturnType<typeof vi.fn>;
  readonly ignore: ReturnType<typeof vi.fn>;
  /** Answers the snapshot the world asked for, as the renderer does after its next frame. */
  readonly answer: (image: unknown) => void;
  /** Lets the world's own clock run on. */
  readonly advance: (ms: number) => void;
}

function world(snapshot?: (callback: (image: unknown) => void) => void): Harness {
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  const start = vi.fn();
  const ignore = vi.fn();
  const timers: { at: number; callback: () => void }[] = [];
  let asked: ((image: unknown) => void) | undefined;
  let now = 0;
  Object.assign(scene as unknown as Record<string, unknown>, {
    scene: { start },
    cameras: { main: { ignore } },
    children: { list: [{ scrollFactorX: 0, name: 'dialogue' }, { scrollFactorX: 1, name: 'tree' }] },
    game: {
      renderer: {
        snapshot:
          snapshot ??
          ((callback: (image: unknown) => void) => {
            asked = callback;
          }),
      },
    },
    time: { delayedCall: (delayMs: number, callback: () => void) => timers.push({ at: now + delayMs, callback }) },
  });
  return {
    scene,
    start,
    ignore,
    answer: (image) => asked?.(image),
    advance: (ms) => {
      now += ms;
      for (const due of timers.filter((timer) => timer.at <= now)) {
        timers.splice(timers.indexOf(due), 1);
        due.callback();
      }
    },
  };
}

const REPORT = { outcome: 'ESCAPED' } as unknown as ExtractionReport;
const handOver = (scene: WorldScene): void => (scene as unknown as { handOverWithThePlace(report: ExtractionReport): void }).handOverWithThePlace(REPORT);

describe('the hand-over from a raid that got out to its result', () => {
  beforeEach(() => {
    vi.stubGlobal('HTMLImageElement', FakeImage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes the world's next frame with it, without what is pinned to the screen", () => {
    const { scene, start, ignore, answer } = world();
    handOver(scene);

    // The clock, a chip, a line of dialogue: none of it is the place.
    expect(ignore).toHaveBeenCalledWith([{ scrollFactorX: 0, name: 'dialogue' }]);
    expect(start).not.toHaveBeenCalled();
    const place = new FakeImage();
    answer(place);
    expect(start).toHaveBeenCalledExactlyOnceWith('extraction', { report: REPORT, place });
  });

  it('goes without the place once it has waited, and only once', () => {
    const { scene, start, answer, advance } = world();
    handOver(scene);

    advance(200);
    expect(start).not.toHaveBeenCalled();
    advance(200);
    expect(start).toHaveBeenCalledExactlyOnceWith('extraction', { report: REPORT });
    // The picture that turns up late changes nothing: the result is already up.
    answer(new FakeImage());
    advance(1000);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('goes without the place when the renderer cannot take a picture, or hands back something that is not one', () => {
    const broken = world(() => {
      throw new Error('no renderer');
    });
    handOver(broken.scene);
    expect(broken.start).toHaveBeenCalledExactlyOnceWith('extraction', { report: REPORT });

    const odd = world();
    handOver(odd.scene);
    odd.answer({ not: 'an image' });
    expect(odd.start).toHaveBeenCalledExactlyOnceWith('extraction', { report: REPORT });
  });
});
