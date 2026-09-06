import Phaser from 'phaser';
import { Pokemon, PokemonParty, type Pokemon as PokemonInstance } from '../pokemon';
import { BULBASAUR, CHARMANDER, getSpeciesById } from '../pokemon/species';
import {
  createBattleState,
  replacePlayerPokemon,
  resolveEnemyTurn,
  resolveTurn,
  type BattleCombatant,
  type BattleEvent,
  type BattleState,
} from '../pokemon/battle/battleEngine';
import { statusAbbreviation } from '../pokemon/battle/status';
import { DialogBox } from '../ui/DialogBox';
import type { WildEncounter } from '../world/wildEncounters';

type CommandMode = 'main' | 'moves' | 'placeholder' | 'party' | 'events' | 'finished';

type BattleAction =
  | { readonly type: 'choose-fight' }
  | { readonly type: 'choose-bag' }
  | { readonly type: 'choose-pokemon' }
  | { readonly type: 'choose-run' }
  | { readonly type: 'use-move'; readonly moveIndex: number }
  | { readonly type: 'switch-pokemon'; readonly partyIndex: number };

type PlaceholderCommand = Extract<BattleAction, { type: 'choose-bag' | 'choose-pokemon' }>;

const COMMAND_Y = 174;
const BATTLE_FONT = '"Orange Kid", monospace';
const MAIN_COMMAND_ACTIONS = [
  { type: 'choose-fight' },
  { type: 'choose-bag' },
  { type: 'choose-pokemon' },
  { type: 'choose-run' },
] as const satisfies readonly BattleAction[];

export interface BattleSceneData {
  wild?: WildEncounter;
  party?: PokemonParty;
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

  public constructor() {
    super('battle');
  }

  public create(data: BattleSceneData = {}): void {
    this.party = data.party ?? new PokemonParty([new Pokemon(CHARMANDER, 10)]);
    const playerPokemon = this.party.getHealthyPokemon() ?? new Pokemon(CHARMANDER, 10);
    const wildBase = data.wild ? getSpeciesById(data.wild.speciesId) : BULBASAUR;
    const wildPokemon = new Pokemon(wildBase ?? BULBASAUR, data.wild?.level ?? 10);
    this.launchedFromWorld = Boolean(data.wild && data.party);
    this.state = createBattleState(playerPokemon, wildPokemon);
    this.cameras.main.setBackgroundColor('#111827');
    this.drawBackdrop();
    this.drawCombatants();
    this.drawStatusBoxes();
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => this.confirm());
    this.leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.goBack());
    this.mode = 'events';
    this.dialog.showMessage(`A wild ${wildPokemon.base.name.toUpperCase()} appeared!`);
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
    this.add.image(160, 87, 'battle-background').setDisplaySize(320, 241);
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
    this.tweens.add({ targets: this.playerSprite, x: 75, duration: 650, ease: 'Quad.out', delay: 180 });
  }

  private drawStatusBoxes(): void {
    this.createStatusBox(16, 16, this.state.enemy, false);
    this.playerStatusBox = this.createStatusBox(150, 104, this.state.player, true);
  }

  private createStatusBox(
    x: number,
    y: number,
    combatant: BattleCombatant,
    showNumbers: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const height = showNumbers ? 58 : 47;
    container.add(this.add.image(x + 72, y + height / 2, 'battle-hud').setDisplaySize(144, height).setDepth(5));
    container.add(this.add.text(x + 9, y + 7, combatant.pokemon.base.name.toUpperCase(), {
      fontFamily: BATTLE_FONT,
      fontSize: '14px',
      color: '#202020',
    }).setDepth(6));
    container.add(this.add.text(x + 111, y + 8, `:L${combatant.pokemon.level}`, {
      fontFamily: BATTLE_FONT,
      fontSize: '13px',
      color: '#202020',
    }).setDepth(6));
    const statusText = this.add.text(x + 82, y + 8, statusAbbreviation(combatant.primaryStatus, combatant.confusionTurns) ?? '', {
      fontFamily: BATTLE_FONT,
      fontSize: '10px',
      color: '#9b1c1c',
    }).setDepth(6);
    container.add(statusText);
    if (showNumbers) {
      this.playerStatusText = statusText;
    } else {
      this.enemyStatusText = statusText;
    }
    container.add(this.add.text(x + 15, y + 25, 'HP:', {
      fontFamily: BATTLE_FONT,
      fontSize: '12px',
      color: '#202020',
    }).setDepth(6));
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

  private drawHpBar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number): void {
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
    if (this.mode === 'placeholder') {
      this.commandTexts = [];
      this.commandContainer.add(this.createPlaceholderBox());
      return;
    }
    if (this.mode === 'party') {
      this.commandContainer.add(this.createPartyBox());
      return;
    }

    const labels =
      this.mode === 'main'
        ? ['FIGHT', 'BAG', 'POKéMON', 'RUN']
        : this.state.player.moves.map(
            (move) => `${move.base.name.toUpperCase()} ${move.base.type.toUpperCase()} ${move.pp}/${move.base.pp}`,
          );
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
      const text = this.add.text(18 + column * 148, 11 + row * 25, label, {
        fontFamily: BATTLE_FONT,
        fontSize: this.mode === 'moves' ? '13px' : '16px',
        color: '#202020',
      });
      container.add(text);
      return text;
    });
    return container;
  }

  private createPlaceholderBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, COMMAND_Y);
    container.add(this.add.image(160, 32, 'battle-dialog').setDisplaySize(320, 64));
    const command = this.selectedCommand === 1 ? 'BAG' : 'POKéMON';
    container.add(
      this.add.text(18, 10, `${command}\nComing soon!  BACK: return`, {
        fontFamily: BATTLE_FONT,
        fontSize: '16px',
        color: '#202020',
        lineSpacing: 7,
      }),
    );
    return container;
  }

  private createPartyBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.add(this.add.image(160, 172, 'battle-dialog').setDisplaySize(320, 136));
    container.add(
      this.add.text(16, 108, this.forcedReplacement ? 'Choose a POKéMON!' : 'Choose a POKéMON  BACK: cancel', {
        fontFamily: BATTLE_FONT,
        fontSize: '12px',
        color: '#202020',
      }),
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
  }

  private updateSelection(): void {
    this.commandTexts.forEach((text, index) => {
      text.setText(`${index === this.selectedCommand ? '▶ ' : '  '}${text.text.replace(/^[▶ ]{2}/, '')}`);
    });
  }

  private confirm(): void {
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
      this.dispatchAction(MAIN_COMMAND_ACTIONS[this.selectedCommand]);
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
      case 'choose-bag':
        this.showPlaceholder(action);
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

  private showPlaceholder(action: PlaceholderCommand): void {
    this.mode = 'placeholder';
    this.selectedCommand = action.type === 'choose-bag' ? 1 : 2;
    this.showCommands();
  }

  private goBack(): void {
    if (this.mode === 'party' && this.forcedReplacement) {
      return;
    }
    if (this.mode !== 'moves' && this.mode !== 'placeholder' && this.mode !== 'party') {
      return;
    }
    this.mode = 'main';
    this.selectedCommand = 0;
    this.showCommands();
  }

  private flee(): void {
    // Battles currently only support wild encounters, so fleeing always succeeds.
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
    this.prepareForcedReplacement();
    this.animateHp(previousState);
    this.animateCombatEvents(result.events);
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.dialog.showMessages(result.events.map(eventToMessage));
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
    this.forcedReplacement = false;
    this.refreshPlayerCombatant();
    const result = resolveEnemyTurn(switchedState, () => Math.random());
    this.state = result.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.animateHp(switchedState);
    this.animateCombatEvents(result.events);
    this.dialog.showMessages([
      ...(wasForcedReplacement ? [] : [`Come back, ${outgoingName}!`]),
      `Go, ${pokemon.base.name.toUpperCase()}!`,
      ...result.events.map(eventToMessage),
    ]);
  }

  private showPartyMessage(message: string): void {
    this.partyMessage = message;
    this.showCommands();
  }

  private persistActivePokemonHp(): void {
    this.state.player.pokemon.currentHp = this.state.player.currentHp;
    this.state.player.pokemon.primaryStatus = this.state.player.primaryStatus;
  }

  private refreshStatusLabels(): void {
    this.playerStatusText.setText(statusAbbreviation(this.state.player.primaryStatus, this.state.player.confusionTurns) ?? '');
    this.enemyStatusText.setText(statusAbbreviation(this.state.enemy.primaryStatus, this.state.enemy.confusionTurns) ?? '');
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
  }

  private animateHp(previousState: BattleState): void {
    this.animateHpBar(
      this.playerHpBar,
      previousState.player.currentHp,
      this.state.player.currentHp,
      this.state.player.pokemon,
      true,
    );
    this.animateHpBar(
      this.enemyHpBar,
      previousState.enemy.currentHp,
      this.state.enemy.currentHp,
      this.state.enemy.pokemon,
      false,
    );
  }

  private animateHpBar(
    bar: Phaser.GameObjects.Graphics,
    from: number,
    to: number,
    pokemon: PokemonInstance,
    showNumbers: boolean,
  ): void {
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

    if (this.forcedReplacement) {
      this.showPartySelection(true);
      return;
    }

    if (this.state.outcome === 'active') {
      this.mode = 'main';
      this.selectedCommand = 0;
      this.showCommands();
      return;
    }

    this.mode = 'finished';
    this.dialog.showMessage(this.state.outcome === 'victory' ? 'You won the battle!' : 'You blacked out!');
  }

  private animateCombatEvents(events: readonly BattleEvent[]): void {
    const fainted = events.find((event) => event.type === 'fainted');
    if (fainted?.type === 'fainted') {
      const sprite = fainted.user === 'player' ? this.playerSprite : this.enemySprite;
      this.tweens.add({ targets: sprite, y: sprite.y + 34, alpha: 0, duration: 500, ease: 'Quad.in' });
      return;
    }

    const attack = events.find((event) => event.type === 'used-move');
    if (attack?.type === 'used-move') {
      const attacker = attack.user === 'player' ? this.playerSprite : this.enemySprite;
      const target = attack.user === 'player' ? this.enemySprite : this.playerSprite;
      const direction = attack.user === 'player' ? 16 : -16;
      this.tweens.add({
        targets: attacker,
        x: attacker.x + direction,
        yoyo: true,
        duration: 140,
        repeat: 1,
        onComplete: () => this.tweens.add({ targets: target, alpha: 0.35, yoyo: true, duration: 90, repeat: 1 }),
      });
    }
  }

  private returnToWorld(): void {
    if (this.launchedFromWorld) {
      this.scene.start('world');
    }
  }
}

const eventToMessage = (event: BattleEvent): string => {
  switch (event.type) {
    case 'used-move':
      return `${event.name} used ${event.move}!`;
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
      return event.status === 'sleep' ? `${event.name} woke up!` : event.status === 'freeze' ? `${event.name} thawed out!` : `${event.name} snapped out of confusion!`;
    case 'confusion-self-hit':
      return `${event.name} hurt itself in its confusion!`;
    case 'stat-stage-changed':
      return `${event.name}'s ${statLabel(event.stat)} ${event.stages > 0 ? 'rose' : 'fell'}!`;
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
