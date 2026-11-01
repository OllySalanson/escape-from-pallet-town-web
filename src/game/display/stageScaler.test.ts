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

  it('tells Phaser the zoom after the size, or a window staying at 1x keeps the canvas as it was', () => {
    // Phaser's `resize` writes the canvas's CSS size only at a zoom other than 1;
    // `setZoom` always has it written, so it has to come second.
    const calls: string[] = [];
    const scale = {
      setZoom: () => calls.push('zoom'),
      resize: () => calls.push('resize'),
    };
    applyStage({ scale }, fakeParent() as unknown as HTMLElement, 320, 240);
    expect(calls).toEqual(['resize', 'zoom']);
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

    applyStage(game(), parent as unknown as HTMLElement, 300, 200);

    expect(parent.style.left).toBe('0px');
    expect(parent.style.top).toBe('0px');
  });

  it('gives a phone the box the canvas really draws, so the page has nothing to squash or scroll', () => {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const parent = fakeParent();
      const scaled = game();

      const stage = applyStage(scaled, parent as unknown as HTMLElement, width, height);

      expect(scaled.scale.setZoom).toHaveBeenCalledWith(1);
      expect(parent.style.width).toBe(`${stage.width}px`);
      expect(parent.style.height).toBe(`${stage.height}px`);
      expect(stage.width, `${width}x${height}`).toBeLessThanOrEqual(width);
      expect(stage.height, `${width}x${height}`).toBeLessThanOrEqual(height);
    }
  });
});
