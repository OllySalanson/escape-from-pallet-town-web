import { describe, expect, it, vi } from 'vitest';
import { applyStage } from './stageScaler';

function fakeParent(): { style: Record<string, string> & { setProperty(name: string, value: string): void } } {
  const style = {
    setProperty(name: string, value: string) {
      (style as unknown as Record<string, string>)[name] = value;
    },
  } as Record<string, string> & { setProperty(name: string, value: string): void };
  return { style };
}

const game = () => ({ scale: { setZoom: vi.fn(), resize: vi.fn() } });

describe('applyStage', () => {
  it('sizes the canvas box and nothing else: the DOM screens have their own', () => {
    // `applyMenuStage` is what lays a screen out now (`menuStage.ts`), so this
    // one must go on describing the canvas exactly as it always did - anything
    // anchored to a tile or a sprite is drawn in it.
    const parent = fakeParent();

    const stage = applyStage(game(), parent as unknown as HTMLElement, 1920, 950);

    expect([stage.width, stage.height, stage.zoom]).toEqual([400, 256, 3]);
    expect(parent.style.width).toBe('1200px');
    expect(parent.style.height).toBe('768px');
  });

  it('hands the canvas box one game pixel, as a length and as a bare number', () => {
    const parent = fakeParent();

    const stage = applyStage(game(), parent as unknown as HTMLElement, 1440, 897);

    expect(stage.zoom).toBe(3);
    expect(parent.style['--px']).toBe('3px');
    expect(parent.style['--zoom']).toBe('3');
  });

  it('never stands the screen on half a pixel, however odd the room left over is', () => {
    // 897 - 256 * 3 leaves 129 pixels, and centring that put the canvas and every
    // menu at y = 64.5 - which the browser resolves by blurring the whole game.
    const parent = fakeParent();

    applyStage(game(), parent as unknown as HTMLElement, 1441, 897);

    expect(parent.style.position).toBe('absolute');
    expect(parent.style.top).toBe('64px');
    expect(parent.style.left).toBe('120px');
  });

  it('pins a window too small for the game to its corner rather than off the screen', () => {
    const parent = fakeParent();

    applyStage(game(), parent as unknown as HTMLElement, 500, 300);

    expect(parent.style.left).toBe('0px');
    expect(parent.style.top).toBe('0px');
  });
});
