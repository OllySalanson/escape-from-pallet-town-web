import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const sceneSource = await readFile(new URL('./BattleScene.ts', import.meta.url), 'utf8');

describe('BattleScene return flow', () => {
  it('returns Test Lab battles to their launcher after persisting active PP and HP', () => {
    expect(sceneSource).toMatch(
      /if \(this\.returnScene && this\.scene\.manager\.keys\[this\.returnScene\]\) \{\s*this\.persistActivePokemonHp\(\);\s*this\.scene\.start\(this\.returnScene\);/,
    );
  });

  it('shows the actionable command menu after an active battle opening completes', () => {
    expect(sceneSource).toMatch(
      /if \(this\.state\.outcome === 'active'\) \{[\s\S]*?this\.mode = 'main';[\s\S]*?this\.showCommands\(\);/,
    );
  });
});
