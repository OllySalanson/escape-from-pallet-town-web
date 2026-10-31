import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { WorldLabel, type WorldLabelTone } from './WorldLabel';

const OPEN: WorldLabelTone = { fill: 0, border: 0, ink: '#fff' };
const SHUT: WorldLabelTone = { fill: 1, border: 1, ink: '#000' };

/** A scene whose one text counts what Phaser would repaint and upload it for. */
function captionWithPaintCount() {
  const counts = { painted: 0, framed: 0 };
  const label = {
    text: 'WESTWARD ROAD',
    width: 40,
    height: 12,
    setOrigin: () => label,
    setDepth: () => label,
    setPosition: () => label,
    setVisible: () => label,
    setAlpha: () => label,
    setText: (text: string) => {
      label.text = text;
      counts.painted += 1;
      return label;
    },
    setColor: () => {
      counts.painted += 1;
      return label;
    },
  };
  const frame = {
    setDepth: () => frame,
    setVisible: () => frame,
    setAlpha: () => frame,
    clear: () => {
      counts.framed += 1;
      return frame;
    },
    fillStyle: () => frame,
    fillRect: () => frame,
    lineStyle: () => frame,
    strokeRect: () => frame,
  };
  const scene = { add: { graphics: () => frame, text: () => label } } as unknown as Phaser.Scene;
  const caption = new WorldLabel(scene, {
    subject: { x: 0, y: 0, width: 16, height: 16 },
    text: 'WESTWARD ROAD',
    tone: OPEN,
    depth: 0,
    speech: { voice: 'name', tiles: [{ x: 0, y: 0 }] },
  });
  counts.painted = 0;
  counts.framed = 0;
  return { caption, counts };
}

describe('a caption told what it already says', () => {
  it('paints nothing, because a raid tells every exit on the map every frame', () => {
    const { caption, counts } = captionWithPaintCount();
    for (let frame = 0; frame < 60; frame += 1) {
      caption.setText('WESTWARD ROAD', OPEN);
    }
    expect(counts).toEqual({ painted: 0, framed: 0 });
  });

  it('paints a change of words', () => {
    const { caption, counts } = captionWithPaintCount();
    caption.setText('WESTWARD ROAD\nEXTRACT OPEN', OPEN);
    expect(counts.painted).toBeGreaterThan(0);
  });

  it('paints a change of tone alone: an exit opening', () => {
    const { caption, counts } = captionWithPaintCount();
    caption.setText('WESTWARD ROAD', SHUT);
    expect(counts.painted).toBeGreaterThan(0);
  });
});
