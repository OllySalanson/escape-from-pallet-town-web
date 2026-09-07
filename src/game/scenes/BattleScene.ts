import Phaser from 'phaser';
import {
  Pokemon,
  PokemonParty,
  experienceAwardForDefeat,
  type Pokemon as PokemonInstance,
} from '../pokemon';
import { BULBASAUR, CHARMANDER, getSpeciesById } from '../pokemon/species';
import {
  createBattleState,
  createTrainerBattleState,
  persistCombatantToPokemon,
  replacePlayerPokemon,
  resolveCatchAttempt,
  resolveEnemyTurn,
  resolveTurn,
  getCombatantTypes,
  type BattleCombatant,
  type BattleEvent,
  type BattleState,
  type TrainerBattle,
} from '../pokemon/battle/battleEngine';
import { battleOpeningMessages, teachingBattleMessages } from '../pokemon/battle/battleFlow';
import { statusAbbreviation } from '../pokemon/battle/status';
import { DialogBox } from '../ui/DialogBox';
import type { WildEncounter } from '../world/wildEncounters';
import { audioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { RunPhase } from '../run/RunManager';
import { buildExtractionReport } from '../run/extractionReport';
import type { ActiveRunSession, RaidLocation } from '../run/RunSession';
import {
  HUNTER_SEARCH_MS,
  beginHunterDisengage,
  resolveHunterBattleLoss,
  type HunterState,
} from '../world/hunter';
import { attemptWildEscape, wildEscapeChanceFor } from '../pokemon/battle/escape';
import {
  WILD_ESCAPE_SUCCESS_MESSAGE,
  combatantBanner,
  combatPresentationSteps,
  describeMoveGuidance,
  eventToMessage,
  formatHunterFleeCommand,
  formatMoveCommand,
  formatWildEscapeCommand,
  hunterFleeMessages,
  moveCommandLayout,
  moveGuidanceLayout,
  wildEscapeFailureMessage,
  type MatchupTone,
} from './battlePresentation';

type CommandMode = 'main' | 'moves' | 'party' | 'events' | 'finished';

type BattleAction =
  | { readonly type: 'choose-fight' }
  | { readonly type: 'throw-ball' }
  | { readonly type: 'choose-pokemon' }
  | { readonly type: 'choose-run' }
  | { readonly type: 'use-move'; readonly moveIndex: number }
  | { readonly type: 'switch-pokemon'; readonly partyIndex: number };

const COMMAND_Y = 174;
const BATTLE_FONT = '"Orange Kid", monospace';
const STARTING_POKE_BALLS = 5;
/** Long enough for the wipe flash and shake to read before the result screen. */
const RUN_RESULT_DELAY_MS = 700;
const PARTY_LIMIT = 6;
const BATTLEFIELD_WIDTH = 320;
const GRASS_BACKDROP_WIDTH = 257;
const BANNER_TEXT_STYLE = {
  fontFamily: BATTLE_FONT,
  fontSize: '8px',
  color: '#f8fafc',
  stroke: '#0f172a',
  strokeThickness: 3,
} as const;
const MATCHUP_COLORS: Readonly<Record<MatchupTone, string>> = {
  good: '#86efac',
  bad: '#fca5a5',
  none: '#94a3b8',
  neutral: '#e2e8f0',
};
export interface BattleSceneData {
  wild?: WildEncounter;
  trainer?: TrainerBattle;
  party?: PokemonParty;
  pokeBalls?: number;
  caughtPokemonStash?: PokemonInstance[];
  /** The active raid context, passed through from WorldScene. */
  runSession?: ActiveRunSession;
  defeatedTrainerIds?: readonly string[];
  collectedLootIds?: readonly string[];
  activatedPoiIds?: readonly string[];
  /** The authored opening fight adds one-off narration explaining the screen. */
  teachingBattle?: boolean;
  /** Hunters are trainer battles that can be fled from and resume pursuit. */
  hunterBattle?: boolean;
  hunterState?: HunterState;
  /** Location to restore when this battle returns to the overworld. */
  returnLocation?: RaidLocation;
  /** A development route can return to its launcher after a complete battle. */
  returnScene?: string;
}

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private dialog!: DialogBox;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerHpText!: Phaser.GameObjects.Text;
  private playerStatusText!: Phaser.GameObjects.Text;
  private enemyStatusText!: Phaser.GameObjects.Text;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private playerStatusBox!: Phaser.GameObjects.Container;
  private enemyStatusBox!: Phaser.GameObjects.Container;
  private commandTexts: Phaser.GameObjects.Text[] = [];
  private moveGuidanceTexts: Phaser.GameObjects.Text[] = [];
  private enemyBannerText!: Phaser.GameObjects.Text;
  private playerBannerText!: Phaser.GameObjects.Text;
  private mode: CommandMode = 'main';
  private selectedCommand = 0;
  private commandContainer!: Phaser.GameObjects.Container;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private backKey!: Phaser.Input.Keyboard.Key;
  private launchedFromWorld = false;
  private party!: PokemonParty;
  private forcedReplacement = false;
  private partyMessage = '';
  private readonly participatingPokemon = new Set<PokemonInstance>();
  private victoryRewardsGranted = false;
  // This seam is intentionally plain data until the run-level bag and stash systems own it.
  private pokeBalls = STARTING_POKE_BALLS;
  private caughtPokemonStash: PokemonInstance[] = [];
  private runSession: ActiveRunSession | undefined;
  private pendingHubTransition = false;
  /** Set once a lost raid is on its way to the result screen. */
  private pendingResultScreen = false;
  private trainer: TrainerBattle | undefined;
  private hunterBattle = false;
  private teachingBattle = false;
  private hunterState: HunterState | undefined;
  private readonly defeatedTrainerIds = new Set<string>();
  private readonly collectedLootIds = new Set<string>();
  private readonly activatedPoiIds = new Set<string>();
  private returnLocation: BattleSceneData['returnLocation'];
  private returnScene: BattleSceneData['returnScene'];
  private displayedEnemy: PokemonInstance | undefined;
  private isTransitioning = false;
  private pendingBattleExit = false;
  /** Failed wild escapes so far in this battle; each one improves the next roll. */
  private wildEscapeAttempts = 0;
  private displayedHp = { player: 0, enemy: 0 };
  private pendingCombatMessages: { readonly event?: BattleEvent; readonly message: string }[] = [];
  private isPresentingCombatEvents = false;

  public constructor() {
    super('battle');
  }

  public create(data: BattleSceneData = {}): void {
    void audioManager.startTheme('battle');
    audioManager.playEncounter();
    this.participatingPokemon.clear();
    this.victoryRewardsGranted = false;
    this.party = data.party ?? new PokemonParty([new Pokemon(CHARMANDER, 10)]);
    this.pokeBalls = data.pokeBalls ?? STARTING_POKE_BALLS;
    this.caughtPokemonStash = data.caughtPokemonStash ?? [];
    this.runSession = data.runSession;
    this.trainer = data.trainer;
    this.hunterBattle = data.hunterBattle ?? false;
    this.teachingBattle = data.teachingBattle ?? false;
    this.hunterState = data.hunterState;
    this.returnLocation = data.returnLocation;
    this.returnScene = data.returnScene;
    this.defeatedTrainerIds.clear();
    data.defeatedTrainerIds?.forEach((id) => this.defeatedTrainerIds.add(id));
    this.collectedLootIds.clear();
    data.collectedLootIds?.forEach((id) => this.collectedLootIds.add(id));
    this.activatedPoiIds.clear();
    data.activatedPoiIds?.forEach((id) => this.activatedPoiIds.add(id));
    this.pendingHubTransition = false;
    // Same lifetime and the same teeth as pendingHubTransition: left set, the
    // next battle's first completed line would refuse to hand control back.
    this.pendingResultScreen = false;
    this.pendingBattleExit = false;
    this.wildEscapeAttempts = 0;
    // Phaser reuses this scene instance after it returns to the overworld.
    // A completed first battle must not leave the return guard armed for the
    // next encounter, or its completed escape dialogue cannot hand back control.
    this.isTransitioning = false;
    // A battle that ended mid-narration - a wipe lands there - would otherwise
    // replay the last fight's leftover lines over the opening of this one.
    this.isPresentingCombatEvents = false;
    this.pendingCombatMessages = [];
    const playerPokemon = this.party.getHealthyPokemon() ?? new Pokemon(CHARMANDER, 10);
    const wildBase = data.wild ? getSpeciesById(data.wild.speciesId) : BULBASAUR;
    const wildPokemon = new Pokemon(wildBase ?? BULBASAUR, data.wild?.level ?? 10);
    this.launchedFromWorld = Boolean((data.wild || data.trainer) && data.party);
    this.state = data.trainer
      ? createTrainerBattleState(playerPokemon, data.trainer)
      : createBattleState(playerPokemon, wildPokemon);
    this.participatingPokemon.add(playerPokemon);
    this.cameras.main.setBackgroundColor('#111827');
    this.cameras.main.fadeIn(180, 0, 0, 0);
    this.drawBackdrop();
    this.drawCombatants();
    this.drawStatusBoxes();
    this.displayedHp = {
      player: this.state.player.currentHp,
      enemy: this.state.enemy.currentHp,
    };
    this.commandContainer = this.add.container(0, 0).setDepth(10);
    this.dialog = new DialogBox(this, {
      x: 8,
      y: COMMAND_Y,
      width: 304,
      height: 64,
      padding: 12,
      // The battle-dialog texture is a 32px frame stretched to 304x64, so its
      // painted left and right edges are 19px wide. Text inset by the vertical
      // padding alone lost the first character of every line behind that edge.
      paddingHorizontal: 22,
      cornerRadius: 0,
      charsPerSecond: 55,
      indicatorText: 'SPACE ▼',
      backgroundTexture: 'battle-dialog',
      textStyle: {
        fontFamily: BATTLE_FONT,
        fontSize: '16px',
        color: '#1f2937',
      },
      onComplete: () => this.onMessagesComplete(),
    });

    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input
      .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
      .on('down', () => this.confirm());
    this.leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.goBack());
    this.input.keyboard!.on?.('keydown-M', () => audioManager.toggleMute());
    this.mode = 'events';
    this.dialog.showMessages(
      this.teachingBattle
        ? teachingBattleMessages(
            this.state.player.pokemon.base.name,
            this.state.enemy.pokemon.base.name,
          )
        : battleOpeningMessages(
            data.trainer?.name,
            this.state.player.pokemon.base.name,
            this.state.enemy.pokemon.base.name,
          ),
    );
  }

  public update(_time: number, delta: number): void {
    this.dialog.update(delta);
    if (this.mode === 'events' || this.mode === 'finished') {
      if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
        this.confirm();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
      this.goBack();
    } else if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
      this.moveSelection('left');
    } else if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
      this.moveSelection('right');
    } else if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.moveSelection('up');
    } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.moveSelection('down');
    } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      this.confirm();
    }
  }

  private drawBackdrop(): void {
    this.add
      .image(BATTLEFIELD_WIDTH / 2, 0, 'battle-background-grass')
      .setOrigin(0.5, 0)
      .setScale(BATTLEFIELD_WIDTH / GRASS_BACKDROP_WIDTH);
  }

  private drawCombatants(): void {
    this.enemySprite = this.add
      .image(370, 68, `pokemon-front-${this.state.enemy.pokemon.base.dexId}`)
      .setScale(1.45)
      .setDepth(2);
    this.playerSprite = this.add
      .image(-50, 137, `pokemon-back-${this.state.player.pokemon.base.dexId}`)
      .setScale(1.55)
      .setDepth(2);
    this.tweens.add({ targets: this.enemySprite, x: 245, duration: 650, ease: 'Quad.out' });
    this.tweens.add({
      targets: this.playerSprite,
      x: 75,
      duration: 650,
      ease: 'Quad.out',
      delay: 180,
    });
  }

  private drawStatusBoxes(): void {
    this.enemyStatusBox = this.createStatusBox(16, 16, this.state.enemy, false);
    this.displayedEnemy = this.state.enemy.pokemon;
    this.playerStatusBox = this.createStatusBox(150, 104, this.state.player, true);
    // Typing sits in the banners so incoming damage is readable before it lands.
    // Both banners float over the battlefield art, so they carry a dark outline
    // rather than relying on whatever happens to be behind them.
    this.enemyBannerText = this.add
      .text(16, 4, combatantBanner(this.trainer ? 'RIVAL' : 'WILD', getCombatantTypes(this.state.enemy)), BANNER_TEXT_STYLE)
      .setDepth(7);
    this.playerBannerText = this.add
      .text(150, 96, combatantBanner('YOUR POKéMON', getCombatantTypes(this.state.player)), BANNER_TEXT_STYLE)
      .setDepth(7);
  }

  private createStatusBox(
    x: number,
    y: number,
    combatant: BattleCombatant,
    showNumbers: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const height = showNumbers ? 58 : 47;
    container.add(
      this.add
        .image(x + 72, y + height / 2, 'battle-hud')
        .setDisplaySize(144, height)
        .setDepth(5),
    );
    container.add(
      this.add
        .text(x + 9, y + 7, combatant.pokemon.base.name.toUpperCase(), {
          fontFamily: BATTLE_FONT,
          fontSize: '14px',
          color: '#202020',
        })
        .setDepth(6),
    );
    container.add(
      this.add
        .text(x + 111, y + 8, `:L${combatant.pokemon.level}`, {
          fontFamily: BATTLE_FONT,
          fontSize: '13px',
          color: '#202020',
        })
        .setDepth(6),
    );
    const statusText = this.add
      .text(
        x + 82,
        y + 8,
        statusAbbreviation(combatant.primaryStatus, combatant.confusionTurns) ?? '',
        {
          fontFamily: BATTLE_FONT,
          fontSize: '10px',
          color: '#9b1c1c',
        },
      )
      .setDepth(6);
    container.add(statusText);
    if (showNumbers) {
      this.playerStatusText = statusText;
    } else {
      this.enemyStatusText = statusText;
    }
    container.add(
      this.add
        .text(x + 15, y + 25, 'HP:', {
          fontFamily: BATTLE_FONT,
          fontSize: '12px',
          color: '#202020',
        })
        .setDepth(6),
    );
    const hpBar = this.add.graphics();
    hpBar.setDepth(6);
    container.add(hpBar);
    if (showNumbers) {
      this.playerHpBar = hpBar;
      this.playerHpText = this.add.text(x + 74, y + 43, '', {
        fontFamily: BATTLE_FONT,
        fontSize: '13px',
        color: '#202020',
      });
      container.add(this.playerHpText);
      this.drawHpBar(hpBar, x + 39, y + 26, combatant.currentHp / combatant.pokemon.maxHp);
      this.playerHpText.setText(`${combatant.currentHp}/${combatant.pokemon.maxHp}`);
    } else {
      this.enemyHpBar = hpBar;
      this.drawHpBar(hpBar, x + 39, y + 26, combatant.currentHp / combatant.pokemon.maxHp);
    }
    return container;
  }

  private drawHpBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    ratio: number,
  ): void {
    graphics.clear();
    graphics.fillStyle(0x303030, 1);
    graphics.fillRect(x, y, 88, 8);
    const color = ratio > 0.5 ? 0x40a850 : ratio > 0.2 ? 0xd8b840 : 0xd05040;
    graphics.fillStyle(color, 1);
    graphics.fillRect(x + 2, y + 2, Math.round(84 * Math.max(0, ratio)), 4);
  }

  private showCommands(): void {
    // The dialogue box is a high-depth opaque overlay. Command states own this
    // same screen area, so make the handoff explicit instead of relying on the
    // typewriter's completion callback to have hidden it first.
    this.dialog.setVisible(false);
    this.commandContainer.removeAll(true);
    this.commandContainer.setVisible(true);
    if (this.mode === 'party') {
      this.commandContainer.add(this.createPartyBox());
      return;
    }

    const labels =
      this.mode === 'main'
        ? this.trainer
          ? this.hunterBattle
            ? ['FIGHT', this.hunterFleeLabel(), 'POKéMON']
            : ['FIGHT', 'POKéMON']
          : ['FIGHT', `BALL x${this.pokeBalls}`, 'POKéMON', this.wildEscapeLabel()]
        : this.state.player.moves.map(formatMoveCommand);
    this.createCommandBox(labels);
    this.selectedCommand = Math.min(this.selectedCommand, labels.length - 1);
    this.updateSelection();
  }

  private createCommandBox(labels: readonly string[]): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x111827, 1);
    panel.fillRect(0, COMMAND_Y, BATTLEFIELD_WIDTH, 64);
    panel.lineStyle(2, 0x93c5fd, 1);
    panel.strokeRect(1, COMMAND_Y + 1, BATTLEFIELD_WIDTH - 2, 62);
    this.commandContainer.add(panel);
    this.moveGuidanceTexts =
      this.mode === 'moves'
        ? [0, 1].map((line) => {
            const layout = moveGuidanceLayout(line);
            // No fixed width here: guidance must never be silently truncated.
            const text = this.add.text(layout.x, COMMAND_Y + layout.y, '', {
              fontFamily: BATTLE_FONT,
              fontSize: '10px',
              color: '#e2e8f0',
            });
            this.commandContainer.add(text);
            return text;
          })
        : [];
    this.commandTexts = labels.map((label, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const layout = this.mode === 'moves' ? moveCommandLayout(index) : undefined;
      const text = this.add.text(
        layout?.x ?? 18 + column * 148,
        COMMAND_Y + (layout?.y ?? 11 + row * 25),
        label,
        {
          fontFamily: BATTLE_FONT,
          fontSize: this.mode === 'moves' ? '13px' : '16px',
          color:
            this.mode === 'main' && !this.trainer && index === 1 && this.pokeBalls === 0
              ? '#fca5a5'
              : '#f8fafc',
          ...(layout
            ? {
                fixedWidth: layout.width,
                fixedHeight: layout.height,
                wordWrap: { width: layout.width },
              }
            : {}),
        },
      );
      text
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.selectedCommand = index;
          this.updateSelection();
        })
        .on('pointerdown', () => {
          this.selectedCommand = index;
          this.updateSelection();
          this.confirm();
        });
      this.commandContainer.add(text);
      return text;
    });
  }

  private createPartyBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const panel = this.add.graphics();
    panel.fillStyle(0x111827, 1);
    panel.fillRect(0, 104, BATTLEFIELD_WIDTH, 136);
    panel.lineStyle(2, 0x93c5fd, 1);
    panel.strokeRect(1, 105, BATTLEFIELD_WIDTH - 2, 134);
    container.add(panel);
    container.add(
      this.add.text(
        16,
        108,
        this.forcedReplacement ? 'Choose a POKéMON!' : 'Choose a POKéMON  BACK: cancel',
        {
          fontFamily: BATTLE_FONT,
          fontSize: '12px',
          color: '#f8fafc',
        },
      ),
    );
    this.commandTexts = this.party.pokemon.map((pokemon, index) => {
      const hp = `${pokemon.currentHp}/${pokemon.maxHp}`;
      const label = `${pokemon.base.name.toUpperCase()} :L${pokemon.level} HP ${hp}${pokemon.isFainted ? ' FNT' : ''}`;
      const text = this.add.text(16, 126 + index * 16, label, {
        fontFamily: BATTLE_FONT,
        fontSize: '11px',
        color: pokemon.isFainted ? '#fca5a5' : '#f8fafc',
      });
      text
        .setInteractive({ useHandCursor: !pokemon.isFainted })
        .on('pointerover', () => {
          this.selectedCommand = index;
          this.updateSelection();
        })
        .on('pointerdown', () => {
          this.selectedCommand = index;
          this.updateSelection();
          this.confirm();
        });
      container.add(text);
      return text;
    });
    container.add(
      this.add.text(16, 224, this.partyMessage, {
        fontFamily: BATTLE_FONT,
        fontSize: '11px',
        color: '#fca5a5',
      }),
    );
    this.selectedCommand = Math.min(this.selectedCommand, this.commandTexts.length - 1);
    this.updateSelection();
    return container;
  }

  private moveSelection(direction: 'left' | 'right' | 'up' | 'down'): void {
    const count = this.commandTexts.length;
    if (count === 0) {
      return;
    }

    const columns = this.mode === 'party' ? 1 : 2;
    const row = Math.floor(this.selectedCommand / columns);
    const column = this.selectedCommand % columns;
    const rows = Math.ceil(count / columns);
    const nextRow =
      direction === 'up' ? (row + rows - 1) % rows : direction === 'down' ? (row + 1) % rows : row;
    const nextColumn =
      direction === 'left'
        ? (column + columns - 1) % columns
        : direction === 'right'
          ? (column + 1) % columns
          : column;
    this.selectedCommand = Math.min(nextRow * columns + nextColumn, count - 1);
    this.updateSelection();
    audioManager.playSelect();
  }

  private updateSelection(): void {
    this.refreshMoveGuidance();
    this.commandTexts.forEach((text, index) => {
      text.setText(
        `${index === this.selectedCommand ? '▶ ' : '  '}${text.text.replace(/^[▶ ]{2}/, '')}`,
      );
      text.setBackgroundColor(index === this.selectedCommand ? '#155e75' : '#111827');
      text.setColor(
        index === this.selectedCommand
          ? '#ffffff'
          : text.text.includes('FNT') || text.text.includes('BALL x0')
            ? '#fca5a5'
            : '#f8fafc',
      );
    });
  }

  /** Keeps the guidance lines describing whichever move is highlighted. */
  private refreshMoveGuidance(): void {
    if (this.mode !== 'moves' || this.moveGuidanceTexts.length === 0) {
      return;
    }
    const move = this.state.player.moves[this.selectedCommand];
    if (!move) {
      return;
    }
    const guidance = describeMoveGuidance(move, getCombatantTypes(this.state.player), {
      name: this.state.enemy.pokemon.base.name,
      types: getCombatantTypes(this.state.enemy),
    });
    this.moveGuidanceTexts[0]?.setText(guidance.summary).setColor('#cbd5f5');
    this.moveGuidanceTexts[1]?.setText(guidance.matchup).setColor(MATCHUP_COLORS[guidance.tone]);
  }

  private confirm(): void {
    audioManager.playConfirm();
    if (this.mode === 'events' || this.mode === 'finished') {
      if (!this.dialog.isCurrentMessageComplete) {
        this.dialog.skip();
      } else {
        this.dialog.advance();
        if (this.mode === 'finished') {
          this.returnToWorld();
        }
      }
      return;
    }

    if (this.mode === 'main') {
      this.dispatchAction(this.mainActions()[this.selectedCommand]);
      return;
    }

    if (this.mode === 'moves') {
      this.dispatchAction({ type: 'use-move', moveIndex: this.selectedCommand });
      return;
    }

    if (this.mode === 'party') {
      this.dispatchAction({ type: 'switch-pokemon', partyIndex: this.selectedCommand });
    }
  }

  private dispatchAction(action: BattleAction): void {
    switch (action.type) {
      case 'choose-fight':
        this.mode = 'moves';
        this.selectedCommand = 0;
        this.showCommands();
        return;
      case 'throw-ball':
        this.throwBall();
        return;
      case 'choose-pokemon':
        this.showPartySelection(false);
        return;
      case 'choose-run':
        this.flee();
        return;
      case 'use-move':
        this.useMove(action.moveIndex);
        return;
      case 'switch-pokemon':
        this.switchPokemon(action.partyIndex);
    }
  }

  private mainActions(): readonly BattleAction[] {
    return this.trainer
      ? this.hunterBattle
        ? [{ type: 'choose-fight' }, { type: 'choose-run' }, { type: 'choose-pokemon' }]
        : [{ type: 'choose-fight' }, { type: 'choose-pokemon' }]
      : [
          { type: 'choose-fight' },
          { type: 'throw-ball' },
          { type: 'choose-pokemon' },
          { type: 'choose-run' },
        ];
  }

  private goBack(): void {
    if (this.mode === 'party' && this.forcedReplacement) {
      return;
    }
    if (this.mode !== 'moves' && this.mode !== 'party') {
      return;
    }
    this.mode = 'main';
    this.selectedCommand = 0;
    this.showCommands();
    audioManager.playCancel();
  }

  private hunterFleeLabel(): string {
    return formatHunterFleeCommand(this.runSession?.manager.nextHunterFleePenaltyMs() ?? 0);
  }

  private wildEscapeLabel(): string {
    return formatWildEscapeCommand(
      wildEscapeChanceFor(this.state.player, this.state.enemy, this.wildEscapeAttempts),
    );
  }

  private flee(): void {
    if (this.hunterBattle) {
      this.fleeFromHunter();
      return;
    }
    this.escapeWildEncounter();
  }

  /**
   * Hunter pursuit battles are deliberately escapable, unlike ordinary trainers, and
   * the escape never fails. A failure roll here would drop the player back beside a
   * pursuer they cannot outrun, which is the loop this exit exists to break; the cost
   * is raid time instead, charged up front and stated on the command.
   */
  private fleeFromHunter(): void {
    const penaltyMs = this.runSession?.manager.registerHunterFlee().penaltyMs;
    if (this.hunterState) {
      this.hunterState = beginHunterDisengage(this.hunterState);
    }
    this.pendingBattleExit = true;
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.dialog.showMessages(
      penaltyMs === undefined
        ? [WILD_ESCAPE_SUCCESS_MESSAGE]
        : [...hunterFleeMessages(penaltyMs, HUNTER_SEARCH_MS)],
    );
  }

  /**
   * A wild escape is a roll, because nothing follows the player out of it: failing
   * costs the enemy's turn and the fight continues, and the per-attempt bonus makes
   * the exit certain within a few tries, so a failure can never become a trap.
   */
  private escapeWildEncounter(): void {
    const attempt = attemptWildEscape(
      this.state.player,
      this.state.enemy,
      this.wildEscapeAttempts,
      () => Math.random(),
    );
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    if (attempt.escaped) {
      this.pendingBattleExit = true;
      this.dialog.showMessage(WILD_ESCAPE_SUCCESS_MESSAGE);
      return;
    }

    this.wildEscapeAttempts += 1;
    const enemyResult = resolveEnemyTurn(this.state, () => Math.random());
    this.state = enemyResult.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.showCombatEvents(enemyResult.events, [
      wildEscapeFailureMessage(this.state.enemy.pokemon.base.name),
    ]);
  }

  private useMove(moveIndex: number): void {
    const result = resolveTurn(this.state, moveIndex, () => Math.random());
    if (result.events.length === 0) {
      return;
    }
    const previousState = this.state;
    this.state = result.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    const rewardMessages = this.awardTrainerDefeatExperience(previousState, result.events);
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.showCombatEvents(result.events, [], rewardMessages);
  }

  private throwBall(): void {
    if (this.trainer) {
      this.mode = 'events';
      this.commandContainer.setVisible(false);
      this.dialog.showMessage("You can't catch a trainer's POKéMON!");
      return;
    }
    if (this.pokeBalls === 0) {
      this.mode = 'events';
      this.commandContainer.setVisible(false);
      this.dialog.showMessage('No POKé BALLS left!');
      return;
    }

    this.pokeBalls -= 1;
    const result = resolveCatchAttempt(this.state, () => Math.random());
    this.state = result.state;
    let events = result.events;
    if (this.state.outcome === 'caught') {
      this.storeCaughtPokemon();
    } else {
      const enemyResult = resolveEnemyTurn(this.state, () => Math.random());
      this.state = enemyResult.state;
      events = [...events, ...enemyResult.events];
    }
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.showCombatEvents(events);
  }

  private storeCaughtPokemon(): void {
    const caughtPokemon = this.state.enemy.pokemon;
    caughtPokemon.currentHp = this.state.enemy.currentHp;
    caughtPokemon.primaryStatus = this.state.enemy.primaryStatus;
    this.runSession?.manager.registerCaughtPokemon(caughtPokemon);
    if (this.party.pokemon.length < PARTY_LIMIT) {
      this.party.addPokemon(caughtPokemon);
      return;
    }
    this.caughtPokemonStash.push(caughtPokemon);
  }

  private showPartySelection(forcedReplacement: boolean): void {
    this.mode = 'party';
    this.forcedReplacement = forcedReplacement;
    this.partyMessage = '';
    this.selectedCommand = 0;
    this.showCommands();
  }

  private switchPokemon(partyIndex: number): void {
    const pokemon = this.party.pokemon[partyIndex];
    if (!pokemon) {
      return;
    }
    if (pokemon === this.state.player.pokemon) {
      this.showPartyMessage(`${pokemon.base.name.toUpperCase()} is already out!`);
      return;
    }
    if (pokemon.isFainted) {
      this.showPartyMessage(`${pokemon.base.name.toUpperCase()} has fainted!`);
      return;
    }

    const outgoingName = this.state.player.pokemon.base.name.toUpperCase();
    const wasForcedReplacement = this.forcedReplacement;
    this.persistActivePokemonHp();
    const switchedState = replacePlayerPokemon(this.state, pokemon);
    this.state = switchedState;
    this.participatingPokemon.add(pokemon);
    this.forcedReplacement = false;
    this.refreshPlayerCombatant();
    const result = resolveEnemyTurn(switchedState, () => Math.random());
    this.state = result.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.showCombatEvents(result.events, [
      ...(wasForcedReplacement ? [] : [`Come back, ${outgoingName}!`]),
      `Go, ${pokemon.base.name.toUpperCase()}!`,
    ]);
  }

  private showPartyMessage(message: string): void {
    this.partyMessage = message;
    this.showCommands();
  }

  private persistActivePokemonHp(): void {
    persistCombatantToPokemon(this.state.player);
  }

  private refreshStatusLabels(): void {
    this.playerStatusText.setText(
      statusAbbreviation(this.state.player.primaryStatus, this.state.player.confusionTurns) ?? '',
    );
    this.enemyStatusText.setText(
      statusAbbreviation(this.state.enemy.primaryStatus, this.state.enemy.confusionTurns) ?? '',
    );
  }

  private prepareForcedReplacement(): void {
    if (this.state.player.currentHp !== 0 || this.party.isAllFainted()) {
      return;
    }
    this.state = { ...this.state, outcome: 'active' };
    this.forcedReplacement = true;
  }

  private refreshPlayerCombatant(): void {
    this.playerStatusBox.destroy();
    this.playerStatusBox = this.createStatusBox(150, 104, this.state.player, true);
    this.playerBannerText.setText(
      combatantBanner('YOUR POKéMON', getCombatantTypes(this.state.player)),
    );
    this.refreshStatusLabels();
    this.playerSprite
      .setTexture(`pokemon-back-${this.state.player.pokemon.base.dexId}`)
      .setPosition(75, 137)
      .setAlpha(1);
    this.displayedHp.player = this.state.player.currentHp;
  }

  private refreshEnemyCombatant(): void {
    this.enemyStatusBox.destroy();
    this.enemyStatusBox = this.createStatusBox(16, 16, this.state.enemy, false);
    this.enemyBannerText.setText(
      combatantBanner(this.trainer ? 'RIVAL' : 'WILD', getCombatantTypes(this.state.enemy)),
    );
    this.enemySprite
      .setTexture(`pokemon-front-${this.state.enemy.pokemon.base.dexId}`)
      .setPosition(245, 68)
      .setAlpha(1);
    this.displayedEnemy = this.state.enemy.pokemon;
    this.displayedHp.enemy = this.state.enemy.currentHp;
    this.refreshStatusLabels();
  }

  private animateHpDelta(user: 'player' | 'enemy', damage: number): void {
    if (damage <= 0) {
      return;
    }
    const from = this.displayedHp[user];
    const to = Math.max(0, from - damage);
    this.displayedHp[user] = to;
    const pokemon =
      user === 'player' ? this.state.player.pokemon : (this.displayedEnemy ?? this.state.enemy.pokemon);
    if (user === 'player' && from > pokemon.maxHp * 0.2 && to > 0 && to <= pokemon.maxHp * 0.2) {
      audioManager.playLowHpWarning();
    }
    const bar = user === 'player' ? this.playerHpBar : this.enemyHpBar;
    const showNumbers = user === 'player';
    if (from === to) {
      return;
    }
    this.tweens.addCounter({
      from,
      to,
      duration: 400,
      ease: 'Linear',
      onUpdate: (tween) => {
        const hp = Math.round(tween.getValue() ?? to);
        const ratio = hp / pokemon.maxHp;
        this.drawHpBar(bar, showNumbers ? 189 : 55, showNumbers ? 130 : 42, ratio);
        if (showNumbers) {
          this.playerHpText.setText(`${hp}/${pokemon.maxHp}`);
        }
      },
    });
  }

  private onMessagesComplete(): void {
    if (this.pendingBattleExit) {
      this.pendingBattleExit = false;
      this.mode = 'finished';
      this.returnToWorld();
      return;
    }

    if (this.mode === 'finished') {
      return;
    }

    if (this.isPresentingCombatEvents) {
      if (this.pendingCombatMessages.length > 0) {
        this.showNextCombatMessage();
        return;
      }
      this.isPresentingCombatEvents = false;
    }

    if (this.forcedReplacement) {
      this.showPartySelection(true);
      return;
    }

    if (this.state.outcome === 'caught') {
      this.mode = 'finished';
      this.returnToWorld();
      return;
    }

    if (this.state.outcome === 'active') {
      if (this.displayedEnemy !== this.state.enemy.pokemon) {
        this.refreshEnemyCombatant();
      }
      this.mode = 'main';
      this.selectedCommand = 0;
      this.showCommands();
      return;
    }

    if (this.state.outcome === 'victory' && !this.victoryRewardsGranted) {
      this.victoryRewardsGranted = true;
      this.mode = 'events';
      this.dialog.showMessages(
        this.trainer
          ? [this.trainer.defeatText ?? `${this.trainer.name} was defeated!`]
          : this.awardVictoryExperience(this.state.enemy.pokemon),
      );
      return;
    }

    if (this.party.isAllFainted() && this.runSession?.manager.phase === RunPhase.InRun) {
      this.resolveRunWipe();
      return;
    }

    this.mode = 'finished';
    this.dialog.showMessage(
      this.state.outcome === 'victory' ? 'You won the battle!' : 'You blacked out!',
    );
  }

  private awardVictoryExperience(defeatedPokemon: PokemonInstance): string[] {
    const experience = experienceAwardForDefeat(defeatedPokemon.level);
    const messages: string[] = [];

    for (const pokemon of this.participatingPokemon) {
      const result = pokemon.gainExperience(experience);
      messages.push(`${pokemon.base.name.toUpperCase()} gained ${result.awarded} XP!`);
      messages.push(
        ...result.levelsGained.map(
          (level) => `${pokemon.base.name.toUpperCase()} grew to Lv ${level}!`,
        ),
      );
      messages.push(
        ...result.learnedMoves.map(
          (move) => `${pokemon.base.name.toUpperCase()} learned ${move.name.toUpperCase()}!`,
        ),
      );
    }

    return messages;
  }

  private awardTrainerDefeatExperience(
    previousState: BattleState,
    events: readonly BattleEvent[],
  ): string[] {
    if (
      !this.trainer ||
      !events.some((event) => event.type === 'fainted' && event.user === 'enemy')
    ) {
      return [];
    }
    return this.awardVictoryExperience(previousState.enemy.pokemon);
  }

  private showCombatEvents(
    events: readonly BattleEvent[],
    leadingMessages: readonly string[] = [],
    trailingMessages: readonly string[] = [],
  ): void {
    this.pendingCombatMessages = [
      ...leadingMessages.map((message) => ({ message })),
      ...events.map((event) => ({ event, message: eventToMessage(event) })),
      ...trailingMessages.map((message) => ({ message })),
    ];
    this.isPresentingCombatEvents = true;
    this.showNextCombatMessage();
  }

  private showNextCombatMessage(): void {
    const next = this.pendingCombatMessages.shift();
    if (!next) {
      return;
    }
    if (next.event) {
      this.presentCombatEvent(next.event);
    }
    this.dialog.showMessage(next.message);
  }

  private presentCombatEvent(event: BattleEvent): void {
    const step = combatPresentationSteps([event])[0];
    if (!step) {
      return;
    }
    if (event.type === 'caught') {
      this.cameras.main.flash(180, 255, 255, 255, false);
      this.tweens.add({
        targets: this.enemySprite,
        scaleX: this.enemySprite.scaleX * 0.7,
        scaleY: this.enemySprite.scaleY * 0.7,
        alpha: 0,
        duration: 320,
        ease: 'Quad.in',
      });
      return;
    }

    if (event.type === 'fainted') {
      const sprite = event.user === 'player' ? this.playerSprite : this.enemySprite;
      audioManager.playFaint();
      this.tweens.add({
        targets: sprite,
        y: sprite.y + 34,
        alpha: 0,
        duration: 500,
        ease: 'Quad.in',
      });
      return;
    }

    if (event.type === 'enemy-sent-out') {
      this.refreshEnemyCombatant();
      return;
    }

    if (event.type === 'used-move') {
      const attacker = event.user === 'player' ? this.playerSprite : this.enemySprite;
      const target = event.user === 'player' ? this.enemySprite : this.playerSprite;
      const direction = event.user === 'player' ? 16 : -16;
      this.tweens.add({
        targets: attacker,
        x: attacker.x + direction,
        yoyo: true,
        duration: 140,
        repeat: 1,
        onComplete: () => {
          target.setTintFill(0xffffff);
          this.tweens.add({
            targets: target,
            alpha: 0.35,
            yoyo: true,
            duration: 90,
            repeat: 1,
            onComplete: () => target.clearTint(),
          });
          this.cameras.main.shake(60, 0.003);
          if (step.target) {
            this.animateHpDelta(step.target, step.hpDelta);
          }
        },
      });
      audioManager.playAttackHit();
      return;
    }

    if (event.type === 'critical-hit') {
      audioManager.playStrongHit();
    }

    if (step.target) {
      this.animateHpDelta(step.target, step.hpDelta);
    }
  }

  private returnToWorld(): void {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.completeReturnToWorld());
  }

  private completeReturnToWorld(): void {
    // A lost raid is already on its way to the result screen. The faint
    // narration completing behind it must not race the hub in first and skip it.
    if (this.pendingResultScreen) {
      return;
    }

    if (this.returnScene && this.scene.manager.keys[this.returnScene]) {
      this.scene.start(this.returnScene);
      return;
    }

    if (this.pendingHubTransition) {
      if (this.scene.manager.keys.hub) {
        this.scene.start('hub');
      } else {
        this.scene.start('title');
      }
      return;
    }

    if (this.launchedFromWorld) {
      // HP and primary status live on party Pokemon. Battle-only stages and confusion
      // live exclusively in BattleState and are discarded with this scene.
      if (this.trainer && this.state.outcome === 'victory') {
        this.defeatedTrainerIds.add(this.trainer.id);
        this.runSession?.manager.registerTrainerDefeat();
      }
      this.persistActivePokemonHp();
      this.scene.start('world', {
        party: this.party,
        pokeBalls: this.pokeBalls,
        caughtPokemonStash: this.caughtPokemonStash,
        runSession: this.runSession,
        defeatedTrainerIds: [...this.defeatedTrainerIds],
        collectedLootIds: [...this.collectedLootIds],
        activatedPoiIds: [...this.activatedPoiIds],
        returnLocation: this.returnLocation,
        hunterState:
          this.trainer && this.state.outcome === 'victory' && this.hunterBattle && this.hunterState
            ? { ...this.hunterState, defeated: true }
            : this.hunterState,
      });
    }
  }

  private resolveRunWipe(): void {
    if (!this.runSession || this.pendingHubTransition) {
      return;
    }

    const result = this.hunterBattle
      ? resolveHunterBattleLoss(this.runSession)
      : this.runSession.manager.resolveWipe(this.runSession.secureSlot);
    const snapshot = this.runSession.manager.snapshot();
    // Read the persisted bag before the wipe rewrites the save, and correct the
    // ball count for throws this battle, which never reached storage.
    const saves = new SaveManager();
    const carriedOut = saves.load()?.bag.toJSON();
    const saved = saves.applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      this.runSession.stashSecureSlot,
    );
    this.cameras.main.flash(220, 239, 68, 68, false);
    this.cameras.main.shake(180, 0.009);
    audioManager.playWipe();
    this.pendingHubTransition = true;
    this.pendingResultScreen = true;
    this.mode = 'finished';
    this.commandContainer.setVisible(false);
    // A lost raid is accounted for on the same screen a survived one is, so the
    // secure-slot decision reads the same either way.
    const report = buildExtractionReport({
      outcome: 'WIPED',
      cause: 'defeated',
      snapshot,
      durationMs: snapshot.durationMs,
      lost: { pokemon: result.lostPokemon, items: result.lostItems },
      ...(carriedOut === undefined
        ? {}
        : { carriedOut: { ...carriedOut, 'poke-ball': this.pokeBalls } }),
      saved,
    });
    this.time.delayedCall(RUN_RESULT_DELAY_MS, () => {
      if (this.scene.manager.keys.extraction) {
        this.scene.start('extraction', { report });
        return;
      }
      this.scene.start(this.scene.manager.keys.hub ? 'hub' : 'title');
    });
  }
}
