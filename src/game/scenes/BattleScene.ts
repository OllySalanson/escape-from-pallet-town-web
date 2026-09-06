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
  type BattleCombatant,
  type BattleEvent,
  type BattleState,
  type TrainerBattle,
} from '../pokemon/battle/battleEngine';
import { battleOpeningMessages } from '../pokemon/battle/battleFlow';
import { statusAbbreviation } from '../pokemon/battle/status';
import { DialogBox } from '../ui/DialogBox';
import type { WildEncounter } from '../world/wildEncounters';
import { audioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { RunPhase } from '../run/RunManager';
import type { ActiveRunSession, RaidLocation } from '../run/RunSession';
import { resolveHunterBattleLoss, type HunterState } from '../world/hunter';
import {
  combatantLabel,
  combatPresentationSteps,
  formatMoveCommand,
  moveCommandLayout,
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
const PARTY_LIMIT = 6;
const BATTLEFIELD_WIDTH = 320;
const GRASS_BACKDROP_WIDTH = 257;
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
  private trainer: TrainerBattle | undefined;
  private hunterBattle = false;
  private hunterState: HunterState | undefined;
  private readonly defeatedTrainerIds = new Set<string>();
  private readonly collectedLootIds = new Set<string>();
  private readonly activatedPoiIds = new Set<string>();
  private returnLocation: BattleSceneData['returnLocation'];
  private returnScene: BattleSceneData['returnScene'];
  private displayedEnemy: PokemonInstance | undefined;
  private isTransitioning = false;
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
      cornerRadius: 0,
      charsPerSecond: 55,
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
      battleOpeningMessages(
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
    this.add
      .text(16, 4, this.trainer ? 'RIVAL' : 'WILD', {
        fontFamily: BATTLE_FONT,
        fontSize: '8px',
        color: '#f8fafc',
      })
      .setDepth(7);
    this.add
      .text(150, 96, 'YOUR POKéMON', {
        fontFamily: BATTLE_FONT,
        fontSize: '8px',
        color: '#f8fafc',
      })
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
            ? ['FIGHT', 'FLEE', 'POKéMON']
            : ['FIGHT', 'POKéMON']
          : ['FIGHT', `BALL x${this.pokeBalls}`, 'POKéMON', 'RUN']
        : this.state.player.moves.map(formatMoveCommand);
    this.commandContainer.add(this.createCommandBox(labels));
    this.selectedCommand = Math.min(this.selectedCommand, labels.length - 1);
    this.updateSelection();
  }

  private createCommandBox(labels: readonly string[]): Phaser.GameObjects.Container {
    const container = this.add.container(0, COMMAND_Y);
    const frame = this.add.image(160, 32, 'battle-dialog').setDisplaySize(320, 64);
    container.add(frame);
    this.commandTexts = labels.map((label, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const layout = this.mode === 'moves' ? moveCommandLayout(index) : undefined;
      const text = this.add.text(layout?.x ?? 18 + column * 148, layout?.y ?? 11 + row * 25, label, {
        fontFamily: BATTLE_FONT,
        fontSize: this.mode === 'moves' ? '11px' : '16px',
        color:
          this.mode === 'main' && !this.trainer && index === 1 && this.pokeBalls === 0
            ? '#7a3c3c'
            : '#202020',
        fixedWidth: layout?.width,
        fixedHeight: layout?.height,
        wordWrap: layout ? { width: layout.width } : undefined,
      });
      container.add(text);
      return text;
    });
    return container;
  }

  private createPartyBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.add(this.add.image(160, 172, 'battle-dialog').setDisplaySize(320, 136));
    container.add(
      this.add.text(
        16,
        108,
        this.forcedReplacement ? 'Choose a POKéMON!' : 'Choose a POKéMON  BACK: cancel',
        {
          fontFamily: BATTLE_FONT,
          fontSize: '12px',
          color: '#202020',
        },
      ),
    );
    this.commandTexts = this.party.pokemon.map((pokemon, index) => {
      const hp = `${pokemon.currentHp}/${pokemon.maxHp}`;
      const label = `${pokemon.base.name.toUpperCase()} :L${pokemon.level} HP ${hp}${pokemon.isFainted ? ' FNT' : ''}`;
      const text = this.add.text(16, 126 + index * 16, label, {
        fontFamily: BATTLE_FONT,
        fontSize: '11px',
        color: pokemon.isFainted ? '#7a3c3c' : '#202020',
      });
      container.add(text);
      return text;
    });
    container.add(
      this.add.text(16, 224, this.partyMessage, {
        fontFamily: BATTLE_FONT,
        fontSize: '11px',
        color: '#7a3c3c',
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
    this.commandTexts.forEach((text, index) => {
      text.setText(
        `${index === this.selectedCommand ? '▶ ' : '  '}${text.text.replace(/^[▶ ]{2}/, '')}`,
      );
    });
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

  private flee(): void {
    // Hunter pursuit battles are deliberately escapable, unlike ordinary trainers.
    this.mode = 'finished';
    this.commandContainer.setVisible(false);
    this.dialog.showMessage('Got away safely!');
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
    if (this.returnScene && this.scene.manager.keys[this.returnScene]) {
      this.persistActivePokemonHp();
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
    const saved = new SaveManager().applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      this.runSession.stashSecureSlot,
    );
    this.cameras.main.flash(220, 239, 68, 68, false);
    this.cameras.main.shake(180, 0.009);
    audioManager.playWipe();
    this.pendingHubTransition = true;
    this.mode = 'finished';
    this.commandContainer.setVisible(false);
    this.dialog.showMessages([
      'YOU WERE WIPED.',
      formatWipeSummary(result.lostPokemon, result.lostItems),
      saved
        ? 'Secure slot preserved. Returning to hub.'
        : 'Stash save unavailable. Returning to hub.',
    ]);
  }
}

function formatWipeSummary(
  pokemon: readonly PokemonInstance[],
  items: readonly { readonly itemId: string; readonly quantity: number }[],
): string {
  const pokemonSummary = pokemon.length === 0 ? 'no Pokemon' : `${pokemon.length} Pokemon`;
  const itemSummary =
    items.length === 0
      ? 'no items'
      : items.map((item) => `${item.quantity} ${item.itemId}`).join(', ');
  return `Lost: ${pokemonSummary}; ${itemSummary}.`;
}

const eventToMessage = (event: BattleEvent): string => {
  switch (event.type) {
    case 'used-move':
      return `${combatantLabel(event.user)} ${event.name.toUpperCase()} used ${event.move.toUpperCase()}!`;
    case 'missed':
      return 'The attack missed!';
    case 'critical-hit':
      return 'A critical hit!';
    case 'effectiveness':
      if (event.multiplier === 0) {
        return 'It does not affect the target...';
      }
      return event.multiplier > 1 ? "It's super effective!" : "It's not very effective...";
    case 'fainted':
      return `${event.name} fainted!`;
    case 'no-pp':
      return `No PP left for ${event.move}!`;
    case 'status-applied':
      return `${event.name} is ${statusLabel(event.status)}!`;
    case 'status-already':
      return `${event.name} already has a status condition!`;
    case 'status-prevented':
      return `${event.name} is ${statusLabel(event.status)} and can't move!`;
    case 'status-damage':
      return `${event.name} is hurt by ${statusLabel(event.status)}!`;
    case 'status-cured':
      return event.status === 'sleep'
        ? `${event.name} woke up!`
        : event.status === 'freeze'
          ? `${event.name} thawed out!`
          : `${event.name} snapped out of confusion!`;
    case 'confusion-self-hit':
      return `${combatantLabel(event.user)} ${event.name.toUpperCase()} hurt itself in confusion!`;
    case 'stat-stage-changed':
      return `${event.name}'s ${statLabel(event.stat)} ${event.stages > 0 ? 'rose' : 'fell'}!`;
    case 'ball-thrown':
      return `Threw a POKé BALL at ${event.name.toUpperCase()}!`;
    case 'catch-shake':
      return `${event.count}...`;
    case 'caught':
      return `Gotcha! ${event.name.toUpperCase()} was caught!`;
    case 'broke-free':
      return `${event.name.toUpperCase()} broke free!`;
    case 'catch-disabled':
      return "You can't catch a trainer's POKéMON!";
    case 'enemy-sent-out':
      return `Go, ${event.name.toUpperCase()}!`;
  }
};

const statusLabel = (status: string): string =>
  ({
    poison: 'poison',
    burn: 'a burn',
    paralysis: 'paralysis',
    sleep: 'asleep',
    freeze: 'frozen',
    confusion: 'confused',
  })[status] ?? status;

const statLabel = (stat: string): string =>
  ({
    attack: 'Attack',
    defense: 'Defense',
    spAttack: 'Sp. Attack',
    spDefense: 'Sp. Defense',
    speed: 'Speed',
  })[stat] ?? stat;
