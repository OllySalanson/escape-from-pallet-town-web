import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const stylesheet = await readFile(new URL('./style.css', import.meta.url), 'utf8');

describe('objective card layout', () => {
  it('allows objective text to shrink and wrap inside each grid card', () => {
    expect(stylesheet).toMatch(
      /\.objective-copy\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;[^}]*\}/,
    );
  });
});
