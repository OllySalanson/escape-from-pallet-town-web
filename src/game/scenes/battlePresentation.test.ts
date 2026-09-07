import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { POISON_POWDER, SUPER_SONIC, THUNDER_WAVE } from '../pokemon/moves';
import { battleOpeningMessages } from '../pokemon/battle/battleFlow';
import { TypewriterQueue } from '../ui/TypewriterQueue';
import {
  BATTLE_SCREEN_WIDTH,
  MOVE_COMMAND_HEIGHT,
  combatPresentationSteps,
  formatMoveCommand,
  moveCommandLayout,
} from './battlePresentation';

const battleSceneSource = await readFile(new URL('./BattleScene.ts', import.meta.url), 'utf8');

describe('battle presentation', () => {
  it('keeps every move field inside the two-column command grid', () => {
    for (const [index, move] of [POISON_POWDER, SUPER_SONIC, THUNDER_WAVE].entries()) {
      const layout = moveCommandLayout(index);
      expect(formatMoveCommand({ base: move, pp: move.pp })).toBe(
        `${move.name.toUpperCase()}\n${move.type.toUpperCase()} ${move.pp}/${move.pp}`,
      );
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.width).toBeLessThanOrEqual(BATTLE_SCREEN_WIDTH);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.y + layout.height).toBeLessThanOrEqual(MOVE_COMMAND_HEIGHT);
    }
  });

  it('uses an opaque high-contrast command panel with mouse and keyboard selection', () => {
    expect(battleSceneSource).toContain('panel.fillStyle(0x111827, 1);');
    expect(battleSceneSource).toContain("text.setBackgroundColor(index === this.selectedCommand ? '#155e75' : '#111827');");
    expect(battleSceneSource).toContain(".setInteractive({ useHandCursor: true })");
    expect(battleSceneSource).toContain(".on('pointerdown'");
  });

  it('advances opening narration before presenting the actionable command menu', () => {
    const narration = new TypewriterQueue(battleOpeningMessages(undefined, 'Bulbasaur', 'Pidgey'));
    narration.skip();

    expect(narration.advance()).toBe(false);
    expect(narration.isDone).toBe(true);
    expect(battleSceneSource).toMatch(
      /if \(this\.state\.outcome === 'active'\) \{[\s\S]*this\.mode = 'main';[\s\S]*this\.showCommands\(\);/,
    );
    expect(battleSceneSource).toContain("case 'choose-fight':");
    expect(battleSceneSource).toContain("this.mode = 'moves';");
  });

  it('keeps same-species two-sided damage events in actor and target order', () => {
    const steps = combatPresentationSteps([
      {
        type: 'used-move',
        user: 'player',
        target: 'enemy',
        name: 'Bulbasaur',
        move: 'Tackle',
        damage: 7,
      },
      {
        type: 'used-move',
        user: 'enemy',
        target: 'player',
        name: 'Bulbasaur',
        move: 'Tackle',
        damage: 5,
      },
    ]);

    expect(steps.map(({ actor, target, hpDelta }) => ({ actor, target, hpDelta }))).toEqual([
      { actor: 'player', target: 'enemy', hpDelta: 7 },
      { actor: 'enemy', target: 'player', hpDelta: 5 },
    ]);
  });

  it('attributes confusion self-damage only to the acting combatant', () => {
    expect(
      combatPresentationSteps([
        { type: 'confusion-self-hit', user: 'enemy', name: 'Bulbasaur', damage: 3 },
      ]),
    ).toMatchObject([{ actor: 'enemy', target: 'enemy', hpDelta: 3 }]);
  });
});
