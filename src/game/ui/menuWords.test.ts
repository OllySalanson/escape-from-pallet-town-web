import { describe, expect, it } from 'vitest';
import { helpLineKeys } from '../input/touchWords';
import { pixelScreen } from './pixelUi';
import { screenKeyLines } from './menuWords';

/** A stand-in for the menu layer: the elements each selector would find, with their `data-` attributes. */
function layer(found: Record<string, readonly Record<string, string>[]>): ParentNode {
  return {
    querySelectorAll: (selector: string) => (found[selector] ?? []).map((dataset) => ({ dataset })),
  } as unknown as ParentNode;
}

describe('the keys a screen names, for the touch pad', () => {
  it('reads the keys line that never goes, so the pack offers DROP on a phone', () => {
    // Since the keys moved to a line of their own (#893) the help line's
    // default is empty on most screens, and the pad read its keys from that
    // alone: no DROP in the raid's pack, no FULL REPORT on the result, no OUT
    // or LOCK in YOUR THINGS.
    const markup = pixelScreen({ title: 'Pack', body: '', hints: 'ARROWS move · ENTER use · X drop · ESC back' });
    const keys = /data-keys="([^"]*)"/.exec(markup)?.[1];
    expect(keys).toBe('ARROWS move · ENTER use · X drop · ESC back');
    expect(/data-help-default="([^"]*)"/.exec(markup)?.[1]).toBe('');

    const lines = screenKeyLines(layer({ '[data-keys]': [{ keys: keys! }], '[data-help-default]': [{ helpDefault: '' }] }));
    expect(helpLineKeys(lines.join(' · '))).toEqual([{ code: 'KeyX', label: 'DROP' }]);
  });

  it('still reads a help line that carries the keys itself, as YOUR TEAM\'s LEAD does', () => {
    const lines = screenKeyLines(
      layer({
        '[data-keys]': [{ keys: 'ARROWS move · ESC back' }],
        '[data-help-default]': [{ helpDefault: 'ARROWS move · ENTER take or leave · L lead · ESC back' }],
      }),
    );
    expect(helpLineKeys(lines.join(' · '))).toEqual([{ code: 'KeyL', label: 'LEAD' }]);
  });

  it('reads only the screen on top', () => {
    const lines = screenKeyLines(layer({ '[data-keys]': [{ keys: 'X drop' }, { keys: 'L full report' }] }));
    expect(helpLineKeys(lines.join(' · '))).toEqual([{ code: 'KeyL', label: 'FULL REPORT' }]);
  });
});
