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
import { MOVE_CATALOGUE } from '../pokemon/moveCatalogue';
import type { PrimaryStatus, StatusName } from '../pokemon/battle/status';
import {
  battleOpeningMessages,
  itemLessonMessage,
  teachingBattleMessages,
} from '../pokemon/battle/battleFlow';
import { TypewriterQueue } from '../ui/TypewriterQueue';
import {
  BATTLE_SCREEN_WIDTH,
  STATUS_TAG_GAP,
  statusTagSeat,
  MAKE_ROOM_PAGE,
  MOVE_COMMAND_HEIGHT,
  formatPackRoomRow,
  packRoomRowForm,
  makeRoomPromptLayout,
  makeRoomRowLayout,
  packRoomPrompt,
  combatantBanner,
  enemyBannerRole,
  captionBySentence,
  combatPresentationSteps,
  describeMoveGuidance,
  eventToMessage,
  foeWordFor,
  formatMoveCommand,
  BATTLE_PANEL,
  formatPartyRow,
  partyRowForm,
  partyRowRoom,
  PARTY_ROW_FORMS,
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
  formatItemRow,
  itemTargetPrompt,
  captionWords,
  CAPTION_WORD_SPACE,
  fitCaption,
  describeBallGuidance,
  catchChanceLabel,
  formatWildEscapeCommand,
  shownStatusLabel,
  statusAfterLine,
  statusBeforeLines,
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
    expect(eventToMessage({ type: 'fainted', user: 'enemy', name: 'Pidgey' })).toBe(
      'Foe PIDGEY fainted!',
    );
    expect(
      eventToMessage({
        type: 'status-applied',
        user: 'player',
        name: 'Squirtle',
        status: 'confusion',
      }),
    ).toBe('Your SQUIRTLE became confused!');
    expect(
      formatPartyRow({ name: 'Squirtle', level: 5, currentHp: 17, maxHp: 17, isFainted: false }),
    ).toBe('SQUIRTLE Lv 5 HP 17/17');
    expect(
      formatPartyRow({ name: 'Squirtle', level: 5, currentHp: 0, maxHp: 17, isFainted: true }),
    ).toBe('SQUIRTLE Lv 5 FNT');
  });

  it('writes the party list in the longest form every row fits, the same form for all', () => {
    const squirtle = { name: 'Squirtle', level: 5, currentHp: 17, maxHp: 17, isFainted: false };
    const butterfree = {
      name: 'Butterfree',
      level: 14,
      currentHp: 32,
      maxHp: 32,
      isFainted: false,
    };
    const fainted = { name: 'Butterfree', level: 14, currentHp: 0, maxHp: 32, isFainted: true };
    expect(formatPartyRow(butterfree, 1)).toBe('BUTTERFREE Lv 14 32/32');
    expect(formatPartyRow(butterfree, 2)).toBe('BUTTERFREE 32/32');
    expect(formatPartyRow(fainted, 2)).toBe('BUTTERFREE FNT');
    const width = (row: string): number => row.length * 5.6;
    expect(partyRowForm([squirtle, squirtle], 11, width)).toBe(0);
    // In the right-hand column the full row is 140 pixels against 131.
    expect(partyRowForm([squirtle, butterfree], 11, width)).toBe(1);
    expect(width(formatPartyRow(butterfree, 1))).toBeLessThanOrEqual(partyRowRoom(1, 11));
    expect(partyRowForm([squirtle, butterfree], 11, () => 999)).toBe(PARTY_ROW_FORMS - 1);
  });

  it("calls a wild Pokemon Wild and a trainer's Foe, as the banner over its plate does", () => {
    const wild = foeWordFor({ trainer: false });
    const trainer = foeWordFor({ trainer: true });
    expect(
      eventToMessage({ type: 'used-move', user: 'enemy', name: 'Rattata', move: 'Tackle' }, wild),
    ).toBe('Wild RATTATA used TACKLE!');
    expect(
      eventToMessage(
        { type: 'stat-stage-changed', user: 'enemy', name: 'Rattata', stat: 'attack', stages: -1 },
        wild,
      ),
    ).toBe("Wild RATTATA's Attack fell!");
    expect(eventToMessage({ type: 'fainted', user: 'enemy', name: 'Pidgey' }, trainer)).toBe(
      'Foe PIDGEY fainted!',
    );
    // The player's own side is Your whoever they are fighting.
    expect(eventToMessage({ type: 'fainted', user: 'player', name: 'Squirtle' }, wild)).toBe(
      'Your SQUIRTLE fainted!',
    );
  });

  it('names the key that cancels, and says a refusal on the prompt line beside the list', () => {
    expect(partyPrompt({ forced: false, refusal: '' })).toEqual(['Choose a POKéMON  ESC: cancel']);
    expect(partyPrompt({ forced: true, refusal: '' })).toEqual(['Choose a POKéMON!']);
    expect(partyPrompt({ item: { displayName: 'Potion' }, forced: false, refusal: '' })).toEqual([
      'Use POTION on whom?  ESC: cancel',
    ]);
    // A refusal keeps the way back, so "already out" with one Pokemon in the
    // party is never a dead end (playtest 47); too long for it, it says the
    // refusal alone. A forced replacement has no way back to name.
    expect(partyPrompt({ forced: false, refusal: 'CHARMANDER is already out!' })).toEqual([
      'CHARMANDER is already out!  ESC: cancel',
      'CHARMANDER is already out!',
    ]);
    expect(partyPrompt({ forced: true, refusal: 'PIDGEY has no energy left to battle!' })).toEqual([
      'PIDGEY has no energy left to battle!',
    ]);
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
      compactSummary: 'FIRE · POWER 40 · PP 25/25 · SAME-TYPE x1.5',
      matchup: 'vs BULBASAUR: SUPER EFFECTIVE x2',
      tone: 'good',
      effectiveness: 2,
    });
  });

  it("warns when the attacker's own signature move is resisted", () => {
    const guidance = describeMoveGuidance(
      { base: VINE_WHIP, pp: 20 },
      [PokemonType.Grass, PokemonType.Poison],
      {
        name: 'Bulbasaur',
        types: [PokemonType.Grass, PokemonType.Poison],
      },
    );

    expect(guidance.matchup).toBe('vs BULBASAUR: RESISTED x0.25');
    expect(guidance.tone).toBe('bad');
  });

  it('reports a neutral matchup rather than staying silent about it', () => {
    const guidance = describeMoveGuidance(
      { base: TACKLE, pp: 18 },
      [PokemonType.Grass, PokemonType.Poison],
      {
        name: 'Pidgey',
        types: [PokemonType.Normal, PokemonType.Flying],
      },
    );

    expect(guidance.summary).toBe('NORMAL · PHYSICAL · POWER 35 · PP 18/35');
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

  it('teaches ITEM only to a Pokemon that is hurt, standing and carrying medicine', () => {
    const hurt = { currentHp: 8, maxHp: 19, fightGoesOn: true, medicine: 'Super Potion' };
    expect(itemLessonMessage(hurt)).toBe('Hurt? ITEM drinks a SUPER POTION. It costs your turn.');
    expect(itemLessonMessage({ ...hurt, medicine: 'Oran Berry' })).toBe(
      'Hurt? ITEM drinks an ORAN BERRY. It costs your turn.',
    );
    expect(itemLessonMessage({ ...hurt, currentHp: 19 })).toBeNull();
    expect(itemLessonMessage({ ...hurt, currentHp: 0 })).toBeNull();
    expect(itemLessonMessage({ ...hurt, fightGoesOn: false })).toBeNull();
    expect(itemLessonMessage({ ...hurt, medicine: undefined })).toBeNull();
    // The battle dialogue frame fits two lines of about 34 characters.
    expect(itemLessonMessage(hurt)!.length).toBeLessThanOrEqual(68);
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
    expect(battleSceneSource).toContain(
      'drawPixelWindow(frame, BATTLE_PANEL, { fill: WINDOW_CREAM });',
    );
    expect(battleSceneSource).toContain('...BATTLE_PANEL,');
    expect(battleSceneSource).toContain('.setInteractive({ useHandCursor: true })');
    expect(battleSceneSource).toContain(".on('pointerdown'");
  });

  it('advances opening narration before presenting the actionable command menu', () => {
    const narration = new TypewriterQueue(
      battleOpeningMessages(undefined, ['Bulbasaur'], ['Pidgey']),
    );
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
      expect(formatHunterFleeCommand(40_000, 40_000 / HUNTER_FLEE_WARNING_SHARE)).toBe(
        'FLEE -40s OF 80s',
      );
      expect(formatHunterFleeCommand(40_000, 40_000 / HUNTER_FLEE_WARNING_SHARE + 1_000)).toBe(
        'FLEE -40s',
      );
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
    expect(applied('sleep')).toBe('Foe PIDGEY fell asleep!');
    expect(applied('freeze')).toBe('Foe PIDGEY was frozen solid!');
    expect(applied('confusion')).toBe('Foe PIDGEY became confused!');
  });

  it('says why a turn was lost in the words of the condition that took it', () => {
    const held = (status: PrimaryStatus): string =>
      eventToMessage({ type: 'status-prevented', user: 'player', name: 'Squirtle', status });
    expect(held('sleep')).toBe('Your SQUIRTLE is fast asleep!');
    expect(held('freeze')).toBe('Your SQUIRTLE is frozen solid!');
  });

  it('says paralysis may stop a Pokemon moving when it lands, and that it did when it does, as FireRed does', () => {
    expect(
      eventToMessage({
        type: 'status-applied',
        user: 'enemy',
        name: 'Pidgey',
        status: 'paralysis',
      }),
    ).toBe('Foe PIDGEY is paralysed! It may be unable to move!');
    expect(
      eventToMessage({
        type: 'status-prevented',
        user: 'player',
        name: 'Squirtle',
        status: 'paralysis',
      }),
    ).toBe("Your SQUIRTLE is paralysed! It can't move!");
  });

  it('says a burn hurts a Pokemon as its own burn, and poison as poison, as FireRed does', () => {
    expect(
      eventToMessage({
        type: 'status-damage',
        user: 'player',
        name: 'Squirtle',
        status: 'burn',
        damage: 4,
      }),
    ).toBe('Your SQUIRTLE is hurt by its burn!');
    expect(
      eventToMessage({
        type: 'status-damage',
        user: 'enemy',
        name: 'Pidgey',
        status: 'poison',
        damage: 2,
      }),
    ).toBe('Foe PIDGEY is hurt by poison!');
  });

  it('says a confused Pokemon is confused, then that it hurt itself in its confusion, as FireRed does', () => {
    expect(eventToMessage({ type: 'confused', user: 'player', name: 'Squirtle' })).toBe(
      'Your SQUIRTLE is confused!',
    );
    expect(eventToMessage({ type: 'confused', user: 'enemy', name: 'Pidgey' }, 'Wild')).toBe(
      'Wild PIDGEY is confused!',
    );
    expect(
      eventToMessage({ type: 'confusion-self-hit', user: 'player', name: 'Squirtle', damage: 3 }),
    ).toBe('It hurt itself in its confusion!');
  });

  it('says a Pokemon that flinched simply flinched, as FireRed does', () => {
    expect(eventToMessage({ type: 'flinched', user: 'player', name: 'Charmander' })).toBe(
      'Your CHARMANDER flinched!',
    );
    expect(eventToMessage({ type: 'flinched', user: 'enemy', name: 'Rattata' }, 'Wild')).toBe(
      'Wild RATTATA flinched!',
    );
  });

  it('says a Pokemon hurt by its own move is hit with recoil, as FireRed does', () => {
    expect(eventToMessage({ type: 'recoil', user: 'player', name: 'Pikachu', damage: 6 })).toBe(
      'Your PIKACHU is hit with recoil!',
    );
    expect(
      eventToMessage({ type: 'recoil', user: 'enemy', name: 'Rattata', damage: 2 }, 'Wild'),
    ).toBe('Wild RATTATA is hit with recoil!');
  });

  it('says what a two-turn move is doing on its first turn, as FireRed does', () => {
    const charging = (move: string, user: 'player' | 'enemy' = 'player') =>
      eventToMessage({ type: 'charging', user, name: 'Bulbasaur', move }, 'Wild');
    expect(charging('Solar Beam')).toBe('Your BULBASAUR took in sunlight!');
    expect(charging('Dig', 'enemy')).toBe('Wild BULBASAUR dug a hole!');
    expect(charging('Skull Bash')).toBe('Your BULBASAUR lowered its head!');
    expect(charging('Sky Attack')).toBe('Your BULBASAUR is glowing!');
    expect(charging('Bounce')).toBe('Your BULBASAUR sprang up!');
  });
});

describe('making room for a catch from inside the fight', () => {
  it('prices a row in squares and answers it above the list', () => {
    expect(formatPackRoomRow({ displayName: 'Super Potion', carried: 2, squares: 2 })).toBe(
      'SUPER POTION x2 · 2sq',
    );
    // What one costs, and whether it is the end of it: the player cannot see
    // the packing, so the panel has to say whether one more drop is coming.
    expect(packRoomPrompt({ squares: 1, freesEnough: false })).toBe(
      'Frees 1 square - not enough yet.',
    );
    expect(packRoomPrompt({ squares: 4, freesEnough: true })).toBe(
      'Frees 4 squares - the ball follows.',
    );
    // Money stacks on a square, so a press puts down a square's worth and the
    // row counts it as the sum it is (playtest 29 B6, T5).
    expect(
      formatPackRoomRow({ itemId: 'money', displayName: 'Pokédollars', carried: 300, squares: 1 }),
    ).toBe('POKéDOLLARS \u20bd300 · 1sq');
    expect(packRoomPrompt({ itemId: 'money', drops: 50, squares: 1, freesEnough: false })).toBe(
      '\u20bd50 frees 1 square - not enough yet.',
    );
    // The row that changes nothing says so in the same place.
    expect(packRoomPrompt()).toBe('Keep everything. The catch is off.');
  });

  it('writes a page in the longest form every row on it fits', () => {
    const disc = { displayName: 'TM09 Bullet Seed', carried: 1, squares: 1 };
    const potion = { displayName: 'Super Potion', carried: 2, squares: 2 };
    expect(formatPackRoomRow(disc, 1)).toBe('TM09 BULLET SEED x1');
    expect(formatPackRoomRow(disc, 2)).toBe('TM09 BULLET SEED');
    const width = (row: string): number => row.length * 5.6;
    // Short names keep their squares; one disc on the page drops them all.
    expect(packRoomRowForm([potion, potion, undefined], 10, width)).toBe(0);
    expect(packRoomRowForm([potion, disc, undefined], 10, width)).toBe(1);
    // KEEP THE PACK is never shortened, so it never decides the form.
    expect(packRoomRowForm([undefined], 10, () => 1_000)).toBe(0);
  });

  it('seats its prompt and every row inside the one battle panel', () => {
    const seats = [
      makeRoomPromptLayout,
      ...Array.from({ length: MAKE_ROOM_PAGE }, (_, index) => makeRoomRowLayout(index)),
    ];
    expect(seats.every(({ y }) => y >= 0 && y + 12 <= BATTLE_PANEL.height)).toBe(true);
    expect(
      seats.every(({ x }) => x >= BATTLE_PANEL.x && x < BATTLE_PANEL.x + BATTLE_PANEL.width),
    ).toBe(true);
  });
});

describe('the small wording faults the battles playtest found', () => {
  it('names the ball that was thrown (B5)', () => {
    expect(eventToMessage({ type: 'ball-thrown', name: 'Pikachu', ball: 'Great Ball' })).toBe(
      'Threw a GREAT BALL at PIKACHU!',
    );
    expect(eventToMessage({ type: 'ball-thrown', name: 'Pikachu', ball: 'Poké Ball' })).toBe(
      'Threw a POKé BALL at PIKACHU!',
    );
    expect(eventToMessage({ type: 'ball-thrown', name: 'Pikachu' })).toBe(
      'Threw a POKé BALL at PIKACHU!',
    );
  });

  it('writes POKé with a small accent in every list, as the command grid does', () => {
    expect(formatItemRow({ displayName: 'Poké Ball' }, 3)).toBe('POKé BALL x3');
    expect(itemTargetPrompt({ displayName: 'Poké Ball' })).toBe('Use POKé BALL on whom?');
  });

  it('has a trainer send their next Pokemon out in their own name, not the player\'s "Go"', () => {
    expect(eventToMessage({ type: 'enemy-sent-out', trainer: 'MAYA', name: 'Pikachu' })).toBe(
      'MAYA sent out PIKACHU!',
    );
  });

  it('says that Splash did nothing, as FireRed does', () => {
    expect(eventToMessage({ type: 'nothing-happened', user: 'enemy' })).toBe(
      'But nothing happened!',
    );
  });

  it("says a Shed Skin cured its problem, in FireRed's own words", () => {
    const line = (status: string) =>
      eventToMessage(
        {
          type: 'ability',
          user: 'enemy',
          name: 'Ekans',
          ability: 'SHED SKIN',
          effect: 'shed',
          status,
        } as never,
        'Wild',
      );
    expect(line('poison')).toBe("Wild EKANS's SHED SKIN cured its poison problem!");
    expect(line('burn')).toBe("Wild EKANS's SHED SKIN cured its burn problem!");
    expect(line('paralysis')).toBe("Wild EKANS's SHED SKIN cured its paralysis problem!");
    expect(line('sleep')).toBe("Wild EKANS's SHED SKIN cured its sleep problem!");
    expect(line('freeze')).toBe("Wild EKANS's SHED SKIN cured its ice problem!");
  });

  it('names a status an ability kept off, shed or cleared as a thing, never an adjective (playtest 38 #81)', () => {
    const line = (effect: string, status: string, ability = 'INSOMNIA') =>
      eventToMessage({
        type: 'ability',
        user: 'player',
        name: 'Drowzee',
        ability,
        effect,
        status,
      } as never);
    expect(line('blocked-status', 'sleep')).toBe("Your DROWZEE's INSOMNIA kept sleep off it!");
    expect(line('blocked-status', 'freeze', 'MAGMA ARMOR')).toBe(
      "Your DROWZEE's MAGMA ARMOR kept freezing off it!",
    );
    expect(line('blocked-status', 'confusion', 'OWN TEMPO')).toBe(
      "Your DROWZEE's OWN TEMPO kept confusion off it!",
    );
    expect(line('blocked-status', 'burn', 'WATER VEIL')).toBe(
      "Your DROWZEE's WATER VEIL kept a burn off it!",
    );
  });

  it("names the Pokemon a move did not affect, as FireRed's line does", () => {
    expect(
      eventToMessage({ type: 'effectiveness', multiplier: 0, user: 'enemy', name: 'Geodude' }),
    ).toBe("It doesn't affect Foe GEODUDE...");
  });
});

describe('the caption lines under and over a list', () => {
  it('space their words wider than their letters (playtest section 3, item 5)', () => {
    expect(captionWords('Standard catch rate.')).toBe('Standard catch rate.');
    expect(CAPTION_WORD_SPACE).toBe(' ');
  });
});

describe('a caption line too long for the panel', () => {
  // Characters stand in for pixels: a line "fits" when it is no longer than this.
  const within = (limit: number) => (line: string) => line.length <= limit;
  const summary = 'PIDGEY · NORMAL · PHYSICAL · POWER 40';

  it('keeps the wide word space while it fits', () => {
    expect(fitCaption(summary, within(80))).toBe(captionWords(summary));
  });

  it('closes the dot separators up before it would run off the panel', () => {
    expect(fitCaption(summary, (line) => !line.includes(' · ') && !line.includes('\u2004·'))).toBe(
      captionWords('PIDGEY·NORMAL·PHYSICAL·POWER 40'),
    );
    expect(fitCaption(summary, within(31))).toBe(captionWords('PIDGEY·NORMAL·PHYSICAL·POWER 40'));
  });
});

describe("a double battle's move line, which carries the chooser's name too", () => {
  it('falls back to the line without the category before running off the panel', () => {
    const lines = [
      'PIDGEY · NORMAL · PHYSICAL · POWER 40 · PP 20/20 · SAME-TYPE x1.5',
      'PIDGEY · NORMAL · POWER 40 · PP 20/20 · SAME-TYPE x1.5',
    ];
    // Only the short one fits, closed up or not.
    const fits = (line: string) => !line.includes('PHYSICAL');
    expect(fitCaption(lines, fits)).toBe(captionWords(lines[1]));
  });

  it('offers the summary without the category, which a generation III type already implies', () => {
    const guidance = describeMoveGuidance({ base: EMBER, pp: 25 }, [PokemonType.Fire], {
      name: 'Bulbasaur',
      types: [PokemonType.Grass],
    });
    expect(guidance.compactSummary).toBe('FIRE · POWER 40 · PP 25/25 · SAME-TYPE x1.5');
  });
});

describe("the ball list's help line", () => {
  const ball = { effect: { type: 'capture-modifier', multiplier: 1 } };
  it('says what the throw would catch it with now, as RUN says its odds', () => {
    expect(describeBallGuidance(ball, 0.34)).toBe('Standard catch rate. 34% to catch it now.');
    expect(
      describeBallGuidance({ effect: { type: 'capture-modifier', multiplier: 1.5 } }, 0.5),
    ).toBe('1.5x catch rate. 50% to catch it now.');
  });

  it('never calls a small chance nothing', () => {
    expect(catchChanceLabel(0.002)).toBe('under 1%');
    expect(catchChanceLabel(0)).toBe('0%');
  });
});

describe('formatWildEscapeCommand', () => {
  it('says 100% only of a certain escape and 0% only of an impossible one', () => {
    expect(formatWildEscapeCommand(1)).toBe('RUN 100%');
    expect(formatWildEscapeCommand(255 / 256)).toBe('RUN 99%');
    expect(formatWildEscapeCommand(96 / 256)).toBe('RUN 38%');
    expect(formatWildEscapeCommand(1 / 256)).toBe('RUN 1%');
    expect(formatWildEscapeCommand(0)).toBe('RUN 0%');
  });
});

describe('a status tag moved line by line', () => {
  it('reads SLP until the line that wakes the Pokemon, then CNF until it snaps out', () => {
    const woke = { type: 'status-cured', user: 'enemy', name: 'PIDGEY', status: 'sleep' } as const;
    const snapped = {
      type: 'status-cured',
      user: 'enemy',
      name: 'PIDGEY',
      status: 'confusion',
    } as const;
    const confused = {
      type: 'status-applied',
      user: 'enemy',
      name: 'PIDGEY',
      status: 'confusion',
    } as const;
    // Asleep going in; confused, woken and snapped out of it by the turn's end.
    const before = statusBeforeLines({ primary: null, confused: false }, [confused, woke, snapped]);
    expect(shownStatusLabel(before)).toBe('SLP');
    const afterConfused = statusAfterLine(before, confused);
    expect(shownStatusLabel(afterConfused)).toBe('SLP');
    const afterWoke = statusAfterLine(afterConfused, woke);
    expect(shownStatusLabel(afterWoke)).toBe('CNF');
    expect(shownStatusLabel(statusAfterLine(afterWoke, snapped))).toBe('');
  });
});

describe('a status move caption', () => {
  it('drops the opening sentence the summary line already says, and loses sentences from the end to fit', () => {
    const guidance = describeMoveGuidance(
      { base: MOVE_CATALOGUE['leech-seed'], pp: 10 },
      [PokemonType.Grass],
      { name: 'Pidgey', types: [PokemonType.Normal, PokemonType.Flying] },
    );
    expect(guidance.summary).toBe('GRASS · STATUS · PP 10/10');
    expect(guidance.matchup).toBe(
      'Seeds the target, sapping 1/8 of its HP each turn. Grass types are immune.',
    );
    expect(captionBySentence(guidance.matchup)).toEqual([
      'Seeds the target, sapping 1/8 of its HP each turn. Grass types are immune.',
      'Seeds the target, sapping 1/8 of its HP each turn.',
    ]);
    expect(captionBySentence('vs PIDGEY: NORMAL DAMAGE x1')).toEqual([
      'vs PIDGEY: NORMAL DAMAGE x1',
    ]);
  });
});

describe('statusTagSeat', () => {
  const plate = { home: 82, hpLabelX: 15, levelLeft: 112 };

  it('stands where it always stood when the name leaves room', () => {
    expect(statusTagSeat({ ...plate, nameRight: 50, tagWidth: 18 })).toEqual({
      row: 'name',
      x: 82,
    });
  });

  it('follows a longer name rather than running into it', () => {
    expect(statusTagSeat({ ...plate, nameRight: 80, tagWidth: 18 })).toEqual({
      row: 'name',
      x: 80 + STATUS_TAG_GAP,
    });
  });

  it('takes the "HP:" label\'s place when the name row has no room left (playtest 47)', () => {
    // CHARMANDER at the plate's name size ran from 9 to past 82.
    expect(statusTagSeat({ ...plate, nameRight: 90, tagWidth: 18 })).toEqual({ row: 'bar', x: 15 });
  });
});

describe('a status move on a Pokemon that already has one', () => {
  it("says FireRed's line for the status it already has (playtest 47)", () => {
    // Sing on a sleeping Charmander said "already has a status condition!".
    expect(
      eventToMessage({
        type: 'status-already',
        user: 'player',
        name: 'Charmander',
        status: 'sleep',
      }),
    ).toBe('Your CHARMANDER is already asleep!');
    expect(
      eventToMessage({
        type: 'status-already',
        user: 'enemy',
        name: 'Pidgey',
        status: 'confusion',
      }),
    ).toBe('Foe PIDGEY is already confused!');
    expect(
      eventToMessage({ type: 'status-already', user: 'enemy', name: 'Pidgey', status: 'burn' }),
    ).toBe('Foe PIDGEY already has a burn.');
  });

  it('fails a move for a different status, as FireRed does', () => {
    expect(
      eventToMessage({
        type: 'status-already',
        user: 'player',
        name: 'Charmander',
        status: 'sleep',
        held: 'poison',
      }),
    ).toBe('But it failed!');
  });
});
