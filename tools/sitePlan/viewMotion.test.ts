import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LONGEST_CLICK_MS,
  MOST_ZOOM_PER_EVENT,
  clickFlight,
  easeToward,
  fadeIn,
  isClick,
  levelFor,
  pictureOpacity,
  wheelIntent,
  zoomedAbout,
} from './viewMotion.mjs';
import { assemblePage, motionScript } from './page';

describe('the site plan wheel', () => {
  it('eases a mouse wheel notch in a step of about a fifth', () => {
    const notch = wheelIntent({ deltaY: -100 });
    expect(notch.eased).toBe(true);
    expect(Math.exp(notch.zoom)).toBeGreaterThan(1.15);
    expect(Math.exp(notch.zoom)).toBeLessThan(1.3);
    // Firefox counts lines, not pixels; the same notch either way.
    expect(wheelIntent({ deltaY: 3, deltaMode: 1 }).eased).toBe(true);
  });

  it('applies a trackpad scroll and a pinch as they come', () => {
    expect(wheelIntent({ deltaY: 12 }).eased).toBe(false);
    expect(wheelIntent({ deltaY: -4, ctrlKey: true }).eased).toBe(false);
    expect(wheelIntent({ deltaY: -4, ctrlKey: true }).zoom).toBeGreaterThan(0);
  });

  it('never lets one event zoom more than twice', () => {
    expect(wheelIntent({ deltaY: -5000 }).zoom).toBe(MOST_ZOOM_PER_EVENT);
    expect(wheelIntent({ deltaY: 3, deltaMode: 2 }).zoom).toBe(-MOST_ZOOM_PER_EVENT);
  });
});

describe('the site plan zoom', () => {
  it('keeps the point under the pointer where it is', () => {
    const view = { x: 100, y: 50, s: 4 };
    const pointer = [900, 120];
    const under = (v: { x: number; y: number; s: number }) => [
      (pointer[0] - 640) / v.s + v.x,
      (pointer[1] - 400) / v.s + v.y,
    ];
    const next = zoomedAbout(view, 1280, 800, pointer[0], pointer[1], 11);
    expect(next.s).toBe(11);
    expect(under(next)[0]).toBeCloseTo(under(view)[0], 10);
    expect(under(next)[1]).toBeCloseTo(under(view)[1], 10);
  });

  it('eases the same distance whatever the frame rate', () => {
    let sixty = 0;
    for (let i = 0; i < 12; i += 1) sixty = easeToward(sixty, 1, 1000 / 60);
    let thirty = 0;
    for (let i = 0; i < 6; i += 1) thirty = easeToward(thirty, 1, 1000 / 30);
    expect(sixty).toBeCloseTo(thirty, 10);
  });

  it('closes a notch in small steps, never in one jump', () => {
    const first = easeToward(0, Math.log(1.22), 1000 / 60);
    expect(Math.exp(first)).toBeLessThan(1.05);
    // A stalled frame is not leapt over either.
    expect(Math.exp(easeToward(0, Math.log(3), 2000))).toBeLessThan(1.8);
  });

  it('draws from the level whose pictures are as sharp as the screen', () => {
    expect(levelFor(16, 16, 6)).toBe(0);
    expect(levelFor(40, 16, 6)).toBe(0);
    expect(levelFor(8, 16, 6)).toBe(1);
    expect(levelFor(7.9, 16, 6)).toBe(1);
    expect(levelFor(0.01, 16, 6)).toBe(6);
  });

  it('fades markers and pictures in rather than popping them', () => {
    expect(fadeIn(1, 2)).toBe(0);
    expect(fadeIn(2.3, 2)).toBeGreaterThan(0);
    expect(fadeIn(2.3, 2)).toBeLessThan(1);
    expect(fadeIn(3, 2)).toBe(1);
    expect(fadeIn(0.1, 0)).toBe(1);
    expect(pictureOpacity(1000, 1000)).toBe(0);
    expect(pictureOpacity(1000, 1090)).toBeCloseTo(0.5, 5);
    expect(pictureOpacity(1000, 5000)).toBe(1);
  });
});

describe('the site plan click', () => {
  it('is a press that hardly moved and came straight up', () => {
    expect(isClick({ farthest: 0, heldMs: 120, pointerType: 'mouse' })).toBe(true);
    expect(isClick({ farthest: 4, heldMs: 120, pointerType: 'mouse' })).toBe(true);
    expect(isClick({ farthest: 9, heldMs: 120, pointerType: 'touch' })).toBe(true);
  });

  it('is never a drag, even one that came back to where it began, nor a long press', () => {
    expect(isClick({ farthest: 80, heldMs: 200, pointerType: 'mouse' })).toBe(false);
    expect(isClick({ farthest: 0, heldMs: LONGEST_CLICK_MS + 1, pointerType: 'mouse' })).toBe(
      false,
    );
  });

  it('only ever zooms in', () => {
    expect(clickFlight(2, 9)).toBe(9);
    expect(clickFlight(40, 17)).toBeNull();
    expect(clickFlight(9, 9.2)).toBeNull();
  });
});

describe('the site plan page', () => {
  const viewer = readFileSync(new URL('./viewer.html', import.meta.url), 'utf8');
  const motion = readFileSync(new URL('./viewMotion.mjs', import.meta.url), 'utf8');

  it('carries the motion as plain script and the plan in its slot', () => {
    const page = assemblePage(viewer, motion, { title: 'A</script>' });
    expect(page).not.toContain('/*__MOTION__*/');
    expect(page).not.toContain('/*__PLAN__*/');
    expect(page).toContain('function wheelIntent(');
    expect(page).not.toMatch(/^export /m);
    expect(page).toContain('"A\\u003c/script>"');
  });

  it('runs the motion script as the page will, with nothing left out', () => {
    const run = new Function(
      `${motionScript(motion)}; return { wheelIntent, zoomedAbout, isClick, clickFlight, fadeIn, levelFor };`,
    ) as () => Record<string, unknown>;
    for (const value of Object.values(run())) expect(typeof value).toBe('function');
  });

  it('refuses a viewer that has lost a slot', () => {
    expect(() => assemblePage('<script></script>', motion, {})).toThrow(/slot/);
  });
});
