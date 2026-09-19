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
import type { PrimaryStatus, StatusName } from '../pokemon/battle/status';
import { battleOpeningMessages, teachingBattleMessages } from '../pokemon/battle/battleFlow';
import { TypewriterQueue } from '../ui/TypewriterQueue';
import {
  BATTLE_SCREEN_WIDTH,
  MOVE_COMMAND_HEIGHT,
  combatantBanner,
  enemyBannerRole,
  combatPresentationSteps,
  describeMoveGuidance,
  eventToMessage,
  formatMoveCommand,
  BATTLE_PANEL,
  formatPartyRow,
  levelLabel,
  mainCommandColumns,
  mainCommandLayout,
  partyPrompt,
  partyPromptLayout,
  partyRowLayout,
  moveCommandLayout,
  moveGuidanceLayout,
  HUNTER_FLEE_WARNING_SHARE,
  formatHunterFleeCommand,
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

  it('keeps the main commands and a full party inside the panel, clear of its border', () => {
    const inside = ({ x, y }: { x: number; y: number }, height: number): void => {
      expect(x).toBeGreaterThanOrEqual(BATTLE_PANEL.x + 8);
      expect(x).toBeLessThan(BATTLE_PANEL.x + BATTLE_PANEL.width);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y + height).toBeLessThanOrEqual(BATTLE_PANEL.height - 4);
    };
    for (const count of [3, 4, 5]) {
      expect(Math.ceil(count / mainCommandColumns(count))).toBeLessThanOrEqual(2);
      for (let index = 0; index < count; index += 1) {
        inside(mainCommandLayout(index, count), 16);
      }
    }
    expect(partyPromptLayout.y + 11).toBeLessThanOrEqual(partyRowLayout(0).y);
    for (let index = 0; index < 6; index += 1) {
      inside(partyRowLayout(index), 11);
    }
    // The player's own HP plate ends at 162: the list that picks a Potion's
    // target may not reach up over the number it is being chosen by.
    expect(BATTLE_PANEL.y).toBeGreaterThan(162);
  });

  it('writes a level so it cannot be read as a digit, and names every combatant one way', () => {
    expect(levelLabel(6)).toBe('Lv 6');
    expect(eventToMessage({ type: 'fainted', user: 'enemy', name: 'Pidgey' })).toBe('Foe PIDGEY fainted!');
    expect(
      eventToMessage({ type: 'status-applied', user: 'player', name: 'Squirtle', status: 'confusion' }),
    ).toBe('Your SQUIRTLE became confused!');
    expect(formatPartyRow({ base: { name: 'Squirtle' }, level: 5, currentHp: 17, maxHp: 17, isFainted: false }))
      .toBe('SQUIRTLE Lv 5 HP 17/17');
    expect(formatPartyRow({ base: { name: 'Squirtle' }, level: 5, currentHp: 0, maxHp: 17, isFainted: true }))
      .toBe('SQUIRTLE Lv 5 FNT');
  });

  it('names the key that cancels, and says a refusal on the prompt line beside the list', () => {
    expect(partyPrompt({ forced: false, refusal: '' })).toBe('Choose a POKéMON  ESC: cancel');
    expect(partyPrompt({ forced: true, refusal: '' })).toBe('Choose a POKéMON!');
    expect(partyPrompt({ item: { displayName: 'Potion' }, forced: false, refusal: '' })).toBe(
      'Use POTION on whom?  ESC: cancel',
    );
    expect(partyPrompt({ forced: false, refusal: 'SQUIRTLE is already at full HP!' })).toBe(
      'SQUIRTLE is already at full HP!',
    );
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
    expect(combatantBanner('YOURS', [PokemonType.Fire])).toBe('YOURS  FIRE');
    // RIVAL is the hunter's word; a toll keeper's Pidgey fought under it.
    expect(enemyBannerRole({ trainer: true, hunter: true })).toBe('RIVAL');
    expect(enemyBannerRole({ trainer: true, hunter: false })).toBe('FOE');
    expect(enemyBannerRole({ trainer: false, hunter: false })).toBe('WILD');
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

  it('draws every state of the bottom panel in the one frame, with mouse and keyboard selection', () => {
    // The menu used to be its own navy, blue-bordered box, wider than the
    // dialogue it replaced, so the panel changed colour and size every turn.
    expect(battleSceneSource).not.toContain('0x111827');
    expect(battleSceneSource).not.toContain('0x93c5fd');
    expect(battleSceneSource).not.toContain('text.setBackgroundColor');
    expect(battleSceneSource).toContain('drawPixelWindow(frame, BATTLE_PANEL, { fill: WINDOW_CREAM });');
    expect(battleSceneSource).toContain('...BATTLE_PANEL,');
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

  describe('the price of fleeing the hunter', () => {
    it('is the bare price while the clock can easily afford it', () => {
      expect(formatHunterFleeCommand(40_000, 240_000)).toBe('FLEE -40s');
      expect(formatHunterFleeCommand(40_000)).toBe('FLEE -40s');
    });

    it('carries the time left once the price is a large share of it', () => {
      expect(formatHunterFleeCommand(60_000, 84_000)).toBe('FLEE -60s OF 84s');
      expect(formatHunterFleeCommand(40_000, 40_000 / HUNTER_FLEE_WARNING_SHARE)).toBe('FLEE -40s OF 80s');
      expect(formatHunterFleeCommand(40_000, 40_000 / HUNTER_FLEE_WARNING_SHARE + 1_000)).toBe('FLEE -40s');
    });

    it('says what the escape does when it costs everything that is left', () => {
      expect(formatHunterFleeCommand(60_000, 60_000)).toBe('FLEE: CLOCK OUT');
      expect(formatHunterFleeCommand(60_000, 24_000)).toBe('FLEE: CLOCK OUT');
    });
  });
});

describe('what a status condition reads like', () => {
  // One noun cannot do all three jobs. These used to share a single label, which
  // gave "is poison!" and "is paralysis and can't move!" - fine for sleep and
  // wrong English for the other two. A burn or a paralysis now arrives on almost
  // any Fire or Electric move rather than only on the two that spelled it out,
  // so these lines are read far more often than they were.
  it('says what happened, not what the condition is called', () => {
    const applied = (status: StatusName): string =>
      eventToMessage({ type: 'status-applied', user: 'enemy', name: 'Pidgey', status });
    expect(applied('poison')).toBe('Foe PIDGEY was poisoned!');
    expect(applied('burn')).toBe('Foe PIDGEY was burned!');
    expect(applied('paralysis')).toBe('Foe PIDGEY was paralysed!');
    expect(applied('sleep')).toBe('Foe PIDGEY fell asleep!');
    expect(applied('freeze')).toBe('Foe PIDGEY was frozen solid!');
    expect(applied('confusion')).toBe('Foe PIDGEY became confused!');
  });

  it('says why a turn was lost in the words of the condition that took it', () => {
    const held = (status: PrimaryStatus): string =>
      eventToMessage({ type: 'status-prevented', user: 'player', name: 'Squirtle', status });
    expect(held('paralysis')).toBe("Your SQUIRTLE is fully paralysed and can't move!");
    expect(held('sleep')).toBe('Your SQUIRTLE is fast asleep!');
    expect(held('freeze')).toBe('Your SQUIRTLE is frozen solid!');
  });

  it('keeps the adjectival phrasing where the line names the condition in passing', () => {
    expect(
      eventToMessage({ type: 'status-damage', user: 'player', name: 'Squirtle', status: 'burn', damage: 4 }),
    ).toBe('Your SQUIRTLE is hurt by a burn!');
  });
});
