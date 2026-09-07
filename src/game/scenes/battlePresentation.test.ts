import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  EMBER,
  GROWL,
  POISON_POWDER,
  SUPER_SONIC,
  TACKLE,
  THUNDER_WAVE,
  VINE_WHIP,
} from '../pokemon/moves';
import { PokemonType } from '../pokemon/PokemonType';
import { battleOpeningMessages, teachingBattleMessages } from '../pokemon/battle/battleFlow';
import { TypewriterQueue } from '../ui/TypewriterQueue';
import {
  BATTLE_SCREEN_WIDTH,
  MOVE_COMMAND_HEIGHT,
  combatantBanner,
  combatPresentationSteps,
  describeMoveGuidance,
  eventToMessage,
  formatMoveCommand,
  moveCommandLayout,
  moveGuidanceLayout,
} from './battlePresentation';

const battleSceneSource = await readFile(new URL('./BattleScene.ts', import.meta.url), 'utf8');

describe('battle presentation', () => {
  it('keeps every move row and both guidance lines inside the command panel', () => {
    for (const [index, move] of [POISON_POWDER, SUPER_SONIC, THUNDER_WAVE, GROWL].entries()) {
      const layout = moveCommandLayout(index);
      expect(formatMoveCommand({ base: move, pp: move.pp })).toBe(move.name.toUpperCase());
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.width).toBeLessThanOrEqual(BATTLE_SCREEN_WIDTH);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.y + layout.height).toBeLessThanOrEqual(MOVE_COMMAND_HEIGHT);
    }

    const lastMoveRow = moveCommandLayout(3);
    for (const line of [0, 1]) {
      const layout = moveGuidanceLayout(line);
      expect(layout.y).toBeGreaterThanOrEqual(lastMoveRow.y + lastMoveRow.height);
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.width).toBeLessThanOrEqual(BATTLE_SCREEN_WIDTH);
      expect(layout.y + layout.height).toBeLessThanOrEqual(MOVE_COMMAND_HEIGHT);
    }
  });

  it('marks a move with no PP left as unusable in its own label', () => {
    expect(formatMoveCommand({ base: TACKLE, pp: 0 })).toBe('TACKLE --');
  });

  it('states power, category and the matchup for a damaging move', () => {
    expect(
      describeMoveGuidance({ base: EMBER, pp: 25 }, [PokemonType.Fire], {
        name: 'Bulbasaur',
        types: [PokemonType.Grass, PokemonType.Poison],
      }),
    ).toEqual({
      summary: 'FIRE · SPECIAL · POWER 40 · PP 25/25 · SAME-TYPE x1.5',
      matchup: 'vs BULBASAUR: SUPER EFFECTIVE x2',
      tone: 'good',
      effectiveness: 2,
    });
  });

  it('warns when the attacker\'s own signature move is resisted', () => {
    const guidance = describeMoveGuidance({ base: VINE_WHIP, pp: 20 }, [PokemonType.Grass, PokemonType.Poison], {
      name: 'Bulbasaur',
      types: [PokemonType.Grass, PokemonType.Poison],
    });

    expect(guidance.matchup).toBe('vs BULBASAUR: RESISTED x0.25');
    expect(guidance.tone).toBe('bad');
  });

  it('reports a neutral matchup rather than staying silent about it', () => {
    const guidance = describeMoveGuidance({ base: TACKLE, pp: 18 }, [PokemonType.Grass, PokemonType.Poison], {
      name: 'Pidgey',
      types: [PokemonType.Normal, PokemonType.Flying],
    });

    expect(guidance.summary).toBe('NORMAL · PHYSICAL · POWER 40 · PP 18/20');
    expect(guidance.matchup).toBe('vs PIDGEY: NORMAL DAMAGE x1');
    expect(guidance.tone).toBe('neutral');
  });

  it('describes what a status move does instead of a damage matchup', () => {
    const guidance = describeMoveGuidance({ base: SUPER_SONIC, pp: 20 }, [PokemonType.Grass], {
      name: 'Pidgey',
      types: [PokemonType.Normal, PokemonType.Flying],
    });

    expect(guidance.summary).toBe('NORMAL · STATUS · PP 20/20');
    expect(guidance.matchup).toBe(SUPER_SONIC.description);
    expect(SUPER_SONIC.description).not.toBe('');
  });

  it('names the typing of both sides in the HUD banners', () => {
    expect(combatantBanner('WILD', [PokemonType.Grass, PokemonType.Poison])).toBe(
      'WILD  GRASS/POISON',
    );
    expect(combatantBanner('YOUR POKéMON', [PokemonType.Fire])).toBe('YOUR POKéMON  FIRE');
  });

  it('opens the teaching fight by explaining the guidance surfaces', () => {
    const messages = teachingBattleMessages('Squirtle', 'Pidgey');

    expect(messages[0]).toBe('A wild PIDGEY appeared!');
    expect(messages.join(' ')).toContain('SQUIRTLE is stronger');
    expect(messages.some((message) => message.includes('POWER'))).toBe(true);
    expect(messages.some((message) => message.includes('HP it cost you'))).toBe(true);
    // The battle dialogue frame fits two lines of about 34 characters.
    expect(Math.max(...messages.map((message) => message.length))).toBeLessThanOrEqual(68);
  });

  it('reports the HP a hit took, so a defeat can be read back from the log', () => {
    expect(
      eventToMessage({
        type: 'used-move',
        user: 'enemy',
        target: 'player',
        name: 'Bulbasaur',
        move: 'Vine Whip',
        damage: 18,
        isStab: true,
      }),
    ).toBe('Foe BULBASAUR used VINE WHIP! -18 HP · SAME-TYPE x1.5');
    expect(
      eventToMessage({
        type: 'used-move',
        user: 'player',
        target: 'enemy',
        name: 'Squirtle',
        move: 'Tackle',
        damage: 4,
      }),
    ).toBe('Your SQUIRTLE used TACKLE! -4 HP');
    expect(eventToMessage({ type: 'effectiveness', multiplier: 2 })).toBe("It's super effective!");
  });

  it('leaves a move that dealt no damage without a misleading HP figure', () => {
    expect(
      eventToMessage({ type: 'used-move', user: 'player', name: 'Bulbasaur', move: 'Growl' }),
    ).toBe('Your BULBASAUR used GROWL!');
    expect(
      eventToMessage({
        type: 'used-move',
        user: 'player',
        target: 'enemy',
        name: 'Bulbasaur',
        move: 'Tackle',
        damage: 0,
      }),
    ).toBe('Your BULBASAUR used TACKLE!');
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
