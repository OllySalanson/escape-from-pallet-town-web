import Phaser from 'phaser';
import {
  Pokemon,
  PARTY_LIMIT,
  PokemonParty,
  experienceAwardForDefeat,
  type Pokemon as PokemonInstance,
} from '../pokemon';
import { BULBASAUR, CHARMANDER, getSpeciesById } from '../pokemon/species';
import {
  createBattleState,
  createTrainerBattleState,
  persistCombatantToPokemon,
  refreshPlayerAfterLevelUp,
  replacePlayerPokemon,
  resolveCatchAttempt,
  lockedMove,
  openingAbilityEvents,
  resolveEnemyTurn,
  resolveTurn,
  getCombatantTypes,
  engagedSlots,
  playerCombatants,
  slotRef,
  playerSlotOf,
  slotsOf,
  unitAt,
  type BattleCombatant,
  type BattleEvent,
  type BattleSide,
  type BattleState,
  type PlayerMoveChoice,
  type SlotRef,
  type TrainerBattle,
} from '../pokemon/battle/battleEngine';
import { battleOpeningMessages, teachingBattleMessages } from '../pokemon/battle/battleFlow';
import type { WeatherId } from '../pokemon/battle/weather';
import { statusAbbreviation } from '../pokemon/battle/status';
import { DialogBox } from '../ui/DialogBox';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { moveChoiceMessage } from '../ui/moveChooser';
import { MoveTarget, type MoveBase } from '../pokemon/MoveBase';
import type { WildEncounter } from '../world/wildEncounters';
import { audioManager } from '../audio/AudioManager';
import { battleEventSound, battleNote, type BattleNote } from '../audio/battleSounds';
import type { SoundEffectName } from '../audio/soundEffects';
import { WORLD_MAPS } from '../worldMap';
import { SaveManager } from '../save/SaveManager';
import { RunPhase } from '../run/RunManager';
import { buildExtractionReport } from '../run/extractionReport';
import { buildWipeSettlement, deployedRaidCondition } from '../run/raidSettlement';
import {
  packFullForPokemonLine,
  clearPackRoomForPokemon,
  packHasRoomForPokemon,
  packRoomChoices,
  syncPackCargo,
  type PackRoomChoice,
} from '../run/raidCargo';
import type { ActiveRunSession } from '../run/RunSession';
import type { RaidCarriage } from '../run/raidCarriage';
import {
  HUNTER_SEARCH_MS,
  beginHunterDisengage,
  resolveHunterBattleLoss,
  type HunterState,
} from '../world/hunter';
import { attemptWildEscape, wildEscapeChanceFor } from '../pokemon/battle/escape';
import {
  applyBattleItem,
  ballCount,
  ballModifierOf,
  battleItemCount,
  carriedBalls,
  usableBattleItems,
} from '../pokemon/battle/battleItems';
import { Bag, heldItemName, type ItemDefinition } from '../items';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH, baseCompositionOffset } from '../display/stage';
import { WINDOW_BORDER, WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { GAME_FONT } from '../ui/gameFont';
import { CAPTION_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { KeyPresses } from '../input/KeyPresses';
import {
  BATTLE_PANEL,
  NO_BATTLE_ITEMS_MESSAGE,
  PARTY_COLUMNS,
  formatPartyRow,
  levelLabel,
  mainCommandColumns,
  mainCommandLayout,
  partyPrompt,
  partyRowLayout,
  partyPromptLayout,
  WILD_ESCAPE_SUCCESS_MESSAGE,
  ABOUT_TO_USE_DECLINE,
  ABOUT_TO_USE_OPTIONS,
  ABOUT_TO_USE_QUESTION,
  aboutToUseLine,
  aboutToUseOptionLayout,
  aboutToUsePromptLayout,
  combatantBanner,
  combatPresentationSteps,
  describeItemGuidance,
  describeMoveGuidance,
  escapeAbilityMessage,
  eventToMessage,
  enemyBannerRole,
  type BannerRole,
  formatHunterFleeCommand,
  formatItemCommand,
  formatItemRow,
  describeBallGuidance,
  formatBallCommand,
  formatMoveCommand,
  formatPackRoomRow,
  formatWildEscapeCommand,
  heldGearLabel,
  hunterFleeMessages,
  moveCommandLayout,
  moveGuidanceLayout,
  moveGuidanceFor,
  combatantSpot,
  combatantEntryX,
  statusPlateLayout,
  formatTargetRow,
  targetRowLayout,
  targetPromptLayout,
  TARGET_PROMPT,
  formatTypeList,
  packRoomPrompt,
  KEEP_PACK_ROW,
  MAKE_ROOM_COLUMNS,
  MAKE_ROOM_INVITE,
  MAKE_ROOM_PAGE,
  makeRoomPromptLayout,
  makeRoomRowLayout,
  NOTHING_TO_DROP_MESSAGE,
  weatherSetMessage,
  wildEscapeFailureMessage,
  type MatchupTone,
} from './battlePresentation';

type CommandMode =
  | 'main'
  | 'moves'
  | 'target'
  | 'items'
  | 'balls'
  | 'party'
  | 'make-room'
  | 'about-to-use'
  | 'events'
  | 'finished';

type BattleAction =
  | { readonly type: 'choose-fight' }
  | { readonly type: 'choose-ball' }
  | { readonly type: 'throw-ball'; readonly ballIndex: number }
  | { readonly type: 'choose-pokemon' }
  | { readonly type: 'choose-item' }
  | { readonly type: 'choose-run' }
  | { readonly type: 'use-move'; readonly moveIndex: number }
  | { readonly type: 'aim-at'; readonly targetIndex: number }
  | { readonly type: 'select-item'; readonly itemIndex: number }
  | { readonly type: 'use-item'; readonly partyIndex: number }
  | { readonly type: 'switch-pokemon'; readonly partyIndex: number }
  | { readonly type: 'answer-about-to-use'; readonly switching: boolean }
  | { readonly type: 'drop-for-room'; readonly choiceIndex: number };

const COMMAND_Y = BATTLE_PANEL.y;
/** Ink for a row that cannot be chosen: a fainted Pokemon, an empty stack, a refusal. */
const PANEL_REFUSAL_INK = '#9b1c1c';
/** Guidance under a list: quieter than the rows it describes. */
const PANEL_GUIDANCE_INK = '#475569';
/** One name for the face, so nothing can drift from what BootScene waits on. */
const BATTLE_FONT = GAME_FONT;
/** What a battle launched outside a raid stocks its stand-in pack with. */
const STARTING_POKE_BALLS = 5;
/** Long enough for the wipe flash and shake to read before the result screen. */
const RUN_RESULT_DELAY_MS = 700;
const BATTLEFIELD_WIDTH = BASE_STAGE_WIDTH;
const BATTLEFIELD_HEIGHT = BASE_STAGE_HEIGHT;
const GRASS_BACKDROP_WIDTH = 257;
const BANNER_TEXT_STYLE = {
  fontFamily: BATTLE_FONT,
  // The smallest size the face survives as hard-edged pixels: at 8px its stems
  // are under two thirds of a pixel and `WILD NORMAL` came out `WILC NCRMAL`.
  fontSize: CAPTION_FONT_SIZE,
  color: '#f8fafc',
  stroke: '#0f172a',
  strokeThickness: 3,
} as const;
const MATCHUP_COLORS: Readonly<Record<MatchupTone, string>> = {
  // Read on the panel's cream, so these are the dark end of each hue.
  good: '#166534',
  bad: PANEL_REFUSAL_INK,
  none: '#64748b',
  neutral: PANEL_GUIDANCE_INK,
};
/**
 * The fight, plus the raid's carriage: everything the world needs handed back
 * to go on being the same raid. See `RaidCarriage` for why it is one type.
 */
export interface BattleSceneData extends Partial<RaidCarriage> {
  wild?: WildEncounter;
  trainer?: TrainerBattle;
  /** The authored opening fight adds one-off narration explaining the screen. */
  teachingBattle?: boolean;
  /** Hunters are trainer battles that can be fled from and resume pursuit. */
  hunterBattle?: boolean;
  /** A development route can return to its launcher after a complete battle. */
  returnScene?: string;
  /**
   * The weather of the place the fight started in - the district the player was
   * standing in when it began. It is not part of `RaidCarriage` because it is
   * not the raid's state to carry: the world reads it off the tile every time.
   */
  weather?: WeatherId | null;
}

/**
 * A command whose stack has run out - BALL x0, ITEM x0. It is still shown and
 * still pressable, in red, because a command that disappears when it is empty
 * takes the reason it is empty with it.
 */
const isEmptyStackLabel = (label: string): boolean => / x0$/.test(label);

/**
 * A narration line the scene may hang one visual change on - the only such
 * change today being an evolution, which has to land with its own line rather
 * than at whatever moment the experience happened to be awarded.
 *
 * `BattleNote` stays pure data in `battleSounds.ts`: a callback is a scene's
 * business, so it is added here and nowhere else.
 */
type StagedNote =
  | BattleNote
  | { readonly message: string; readonly sound?: SoundEffectName; readonly onShow: () => void };

const stagedNote = (
  note: StagedNote,
): ReturnType<typeof battleNote> & { readonly onShow?: () => void } =>
  typeof note === 'string' ? battleNote(note) : note;

/**
 * One Pokemon's plate on screen: everything about it that can change without
 * the Pokemon itself changing.
 *
 * There is one of these per slot, and in a single battle there are two of them
 * - which is why the scene holds them in a map keyed by slot rather than in the
 * eight separate fields it used to hold for its two. A double battle is four
 * plates, and four times two fields is how a screen ends up out of step with
 * the fight it is drawing.
 */
interface CombatantPlate {
  readonly container: Phaser.GameObjects.Container;
  readonly hpBar: Phaser.GameObjects.Graphics;
  readonly barX: number;
  readonly barY: number;
  readonly barWidth: number;
  readonly hpText?: Phaser.GameObjects.Text;
  readonly statusText: Phaser.GameObjects.Text;
  readonly levelText: Phaser.GameObjects.Text;
  readonly typeText?: Phaser.GameObjects.Text;
  readonly banner?: Phaser.GameObjects.Text;
}

/** How a slot is keyed on screen, which is the only thing the map needs. */
const plateKey = (side: BattleSide, slot: number): string => `${side}${slot}`;

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private dialog!: DialogBox;
  private plates = new Map<string, CombatantPlate>();
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private fieldMask?: Phaser.Display.Masks.GeometryMask;
  /**
   * The moves chosen so far this turn, one per slot. A double battle asks each
   * slot in turn and only resolves once both have answered, so this is what is
   * being built up while the second one is being asked.
   */
  private pendingChoices: PlayerMoveChoice[] = [];
  /** Which of the player's slots is being asked, and what it has picked. */
  private choosingSlot = 0;
  private aimingMoveIndex = 0;
  /** Which slot a forced replacement is going into. */
  private replacementSlot = 0;
  /**
   * The player's level plate. It is held rather than painted once because a
   * level reached mid-battle has to appear on it - see
   * `applyMidBattleLevelUp`.
   */
  private commandTexts: Phaser.GameObjects.Text[] = [];
  private moveGuidanceTexts: Phaser.GameObjects.Text[] = [];
  private mode: CommandMode = 'main';
  private selectedCommand = 0;
  private commandContainer!: Phaser.GameObjects.Container;
  /** Every `JustDown` this scene would ask goes through here - see `KeyPresses`. */
  private readonly keyPresses = new KeyPresses(() => this.game.loop.frame);
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
  /**
   * The bag the raid is carrying, not the persisted overworld bag. They are
   * different inventories, and reading the wrong one is how a wipe report came
   * to describe supplies the raid never had.
   *
   * Poke Balls are counted here like every other supply. A separate ball
   * counter beside this was the last of the raid's inventory kept somewhere the
   * settlement could not see, which is why the wipe report had to overwrite the
   * ball line by hand after reading the bag for everything else.
   */
  private bag = new Bag({ 'poke-ball': STARTING_POKE_BALLS });
  /** The medicine chosen from the ITEM list, waiting on a Pokemon to use it on. */
  private pendingItem: ItemDefinition | undefined;
  /**
   * The ball the player chose and the pack had no room to throw, held while
   * they decide what to put down. Set is what makes the refusal a doorway
   * rather than a wall: the throw is finished the moment the room exists.
   *
   * By id, not by position: putting down the last of another kind of ball
   * renumbers the list, and an index would then throw a different ball than
   * the one the player chose - or none at all.
   */
  private heldBallId: string | undefined;
  /** Set while the refusal is being read, so the panel opens behind the line. */
  private pendingMakeRoom = false;
  /** Which page of the pack's kinds the make-room panel is showing. */
  private makeRoomPage = 0;
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
  /** A beaten boss's gear the pack had no room for, carried back to the world. */
  private unclaimedBossGear: RaidCarriage['unclaimedBossGear'] = [];
  private readonly collectedLootIds = new Set<string>();
  private readonly activatedPoiIds = new Set<string>();
  private returnLocation: BattleSceneData['returnLocation'];
  private returnScene: BattleSceneData['returnScene'];
  /** Which Pokemon each slot's plate is currently drawn for. */
  private displayed = new Map<string, PokemonInstance>();
  private isTransitioning = false;
  private pendingBattleExit = false;
  /** Failed wild escapes so far in this battle; each one improves the next roll. */
  private wildEscapeAttempts = 0;
  /** The HP each plate's bar is currently showing, which the tweens walk. */
  private displayedHp = new Map<string, number>();
  private pendingCombatMessages: {
    readonly event?: BattleEvent;
    readonly message: string;
    readonly sound?: SoundEffectName;
    /** Run as the line is put up, for a line that is also a change on screen. */
    readonly onShow?: () => void;
    readonly offerMove?: { readonly pokemon: PokemonInstance; readonly move: MoveBase };
  }[] = [];
  /** The move the last line announced, waiting on the chooser before the next is read. */
  private moveOffer: { readonly pokemon: PokemonInstance; readonly move: MoveBase } | null = null;
  private isPresentingCombatEvents = false;
  /**
   * The trainer Pokemon whose send-out is being held back while the player is
   * asked whether to switch. The send-out line itself is still at the head of
   * `pendingCombatMessages`, so answering either way simply carries on reading.
   */
  private aboutToUse: string | null = null;
  /**
   * Which of the trainer's party the question has already been asked for. A
   * fight can pause and resume on this panel - a party list opened from it, a
   * refusal read and backed out of - and the offer is one per Pokemon, not one
   * per time the queue is picked up again.
   */
  private aboutToUseOffered = new Set<number>();
  /** Set while the party list is answering the prompt rather than a main command. */
  private aboutToUseSwitching = false;

  public constructor() {
    super('battle');
  }

  public create(data: BattleSceneData = {}): void {
    void audioManager.startTheme('battle');
    // A wild fight was announced by the grass that produced it, one fade ago;
    // announcing it again here put two jingles on top of each other. A trainer's
    // challenge was read through dialogue first, so that fight opens on its own.
    if (data.trainer) {
      audioManager.play('battleStart');
    }
    this.participatingPokemon.clear();
    this.victoryRewardsGranted = false;
    this.party = data.party ?? new PokemonParty([new Pokemon(CHARMANDER, 10)]);
    this.bag = data.bag ?? new Bag({ 'poke-ball': STARTING_POKE_BALLS });
    // Phaser reuses this scene, so a medicine chosen in the last fight and never
    // handed to anyone would still be waiting for a target in this one - and a
    // ball held over a pack that had no room would be thrown at the next one.
    this.pendingItem = undefined;
    this.heldBallId = undefined;
    this.pendingMakeRoom = false;
    this.makeRoomPage = 0;
    this.caughtPokemonStash = data.caughtPokemonStash ?? [];
    this.runSession = data.runSession;
    // The pack is told what the raid is already carrying home before its first
    // question is asked of it, because the first question is "is there room for
    // one more" and the world it came from packed the answer.
    if (this.runSession) {
      syncPackCargo(this.bag, this.runSession.manager.snapshot());
    }
    this.trainer = data.trainer;
    this.hunterBattle = data.hunterBattle ?? false;
    this.teachingBattle = data.teachingBattle ?? false;
    this.hunterState = data.hunterState;
    this.returnLocation = data.returnLocation;
    this.returnScene = data.returnScene;
    this.defeatedTrainerIds.clear();
    data.defeatedTrainerIds?.forEach((id) => this.defeatedTrainerIds.add(id));
    this.unclaimedBossGear = data.unclaimedBossGear ?? [];
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
    this.moveOffer = null;
    // Phaser reuses this scene: an unanswered question from the last fight
    // would otherwise hold this one's first send-out back, and a party index
    // already offered for would silence the question in the fight after it.
    this.aboutToUse = null;
    this.aboutToUseOffered = new Set();
    this.aboutToUseSwitching = false;
    const playerPokemon = this.party.getHealthyPokemon() ?? new Pokemon(CHARMANDER, 10);
    // The second Pokemon this party can field, which is what decides whether a
    // trainer who asks for a double battle gets one. It is offered to the
    // engine whatever the trainer asked for, and the engine is what refuses it.
    const playerPartner =
      this.party.pokemon.find((pokemon) => pokemon !== playerPokemon && !pokemon.isFainted) ?? null;
    const wildBase = data.wild ? getSpeciesById(data.wild.speciesId) : BULBASAUR;
    const wildPokemon = new Pokemon(wildBase ?? BULBASAUR, data.wild?.level ?? 10);
    this.launchedFromWorld = Boolean((data.wild || data.trainer) && data.party);
    this.state = data.trainer
      ? createTrainerBattleState(playerPokemon, data.trainer, data.weather ?? null, playerPartner)
      : createBattleState(playerPokemon, wildPokemon, data.weather ?? null);
    playerCombatants(this.state).forEach((combatant) =>
      this.participatingPokemon.add(combatant.pokemon),
    );
    this.cameras.main.setBackgroundColor('#0b1220');
    this.centreComposition();
    this.cameras.main.fadeIn(180, 0, 0, 0);
    this.drawBackdrop();
    const recentre = () => this.centreComposition();
    this.scale.on?.(Phaser.Scale.Events.RESIZE, recentre);
    this.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off?.(Phaser.Scale.Events.RESIZE, recentre),
    );
    this.plates.clear();
    this.sprites.clear();
    this.displayed.clear();
    this.displayedHp.clear();
    this.pendingChoices = [];
    this.choosingSlot = 0;
    this.replacementSlot = 0;
    this.drawCombatants();
    this.drawStatusBoxes();
    this.commandContainer = this.add.container(0, 0).setDepth(10);
    this.dialog = new DialogBox(this, {
      ...BATTLE_PANEL,
      padding: 12,
      charsPerSecond: 55,
      indicatorText: 'SPACE ▼',
      // The last panel in the game still stretching a 32x32 texture. At 304x64
      // that frame's rounded corners smeared into a grey band down the right
      // and along the bottom, left no border at all on the left, clipped the
      // continue indicator, and filled the interior stark white against cream
      // everywhere else - all of it under the player's eyes for every fight.
      // Drawn instead, it is the one-pixel window the HUD, the map captions and
      // the overworld dialogue already use, and the 22px text inset that used to
      // clear the smear goes with it.
      pixelWindow: true,
      backgroundColor: WINDOW_CREAM,
      borderColor: WINDOW_BORDER,
      textStyle: {
        fontFamily: BATTLE_FONT,
        fontSize: DIALOG_FONT_SIZE,
        color: WINDOW_INK,
      },
      indicatorStyle: {
        fontFamily: BATTLE_FONT,
        fontSize: CAPTION_FONT_SIZE,
        color: WINDOW_INK,
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
    this.keyPresses.watch([
      this.confirmKey,
      this.leftKey,
      this.rightKey,
      this.upKey,
      this.downKey,
      this.backKey,
    ]);
    this.input.keyboard!.on?.('keydown-M', () => audioManager.toggleMute());
    this.mode = 'events';
    // An ability that acts the moment its Pokemon lands has already acted -
    // `createBattleState` applied it - so these are the words for what is
    // already true, read after the opening lines that named both sides.
    this.dialog.showMessages([
      ...(this.teachingBattle
        ? teachingBattleMessages(
            this.state.player.pokemon.base.name,
            this.state.enemy.pokemon.base.name,
          )
        : battleOpeningMessages(
            data.trainer?.name,
            slotsOf(this.state, 'player').flatMap((ref) => {
              const combatant = unitAt(this.state, ref);
              return combatant ? [combatant.pokemon.base.name] : [];
            }),
            slotsOf(this.state, 'enemy').flatMap((ref) => {
              const combatant = unitAt(this.state, ref);
              return combatant ? [combatant.pokemon.base.name] : [];
            }),
          )),
      // The weather the fight is already in is said once, on the way in, in the
      // same words a move that brought it on would use. Nothing else announces
      // it: after this it speaks only when it takes HP off somebody.
      ...(this.state.weather ? [weatherSetMessage(this.state.weather.id, false)] : []),
      ...openingAbilityEvents(this.state).map((event) => eventToMessage(event)),
    ]);
  }

  public update(_time: number, delta: number): void {
    this.dialog.update(delta);
    if (this.mode === 'events' || this.mode === 'finished') {
      if (this.keyPresses.justPressed(this.confirmKey)) {
        this.confirm();
      }
      return;
    }

    if (this.keyPresses.justPressed(this.backKey)) {
      this.goBack();
    } else if (this.keyPresses.justPressed(this.leftKey)) {
      this.moveSelection('left');
    } else if (this.keyPresses.justPressed(this.rightKey)) {
      this.moveSelection('right');
    } else if (this.keyPresses.justPressed(this.upKey)) {
      this.moveSelection('up');
    } else if (this.keyPresses.justPressed(this.downKey)) {
      this.moveSelection('down');
    } else if (this.keyPresses.justPressed(this.confirmKey)) {
      this.confirm();
    }
  }

  /**
   * Keeps the authored 320x240 battle screen the shape it was tuned to.
   *
   * The overworld spends a larger browser window on more map; a battle has a
   * composition rather than a viewport, so it stays exactly as laid out and is
   * centred by scrolling the camera. Every coordinate in this scene is still
   * read as a position on the battle screen, which is why nothing else here
   * knows the window size.
   */
  private centreComposition(): void {
    const offset = baseCompositionOffset({
      width: this.scale.width,
      height: this.scale.height,
      zoom: 1,
    });
    this.cameras.main.setScroll(-offset.x, -offset.y);
  }

  /**
   * The battlefield, and the bezel it sits in on a screen wider than itself.
   *
   * Widening the backdrop was tried and rejected: its horizon is bands but its
   * platform is an ellipse, so stretching it put a second, flatter platform in
   * the margin. The margin is the camera's own colour instead, with the frame
   * the rest of the game's windows are drawn with around the battle, which is
   * what makes it read as a screen rather than as art that stopped short.
   */
  private drawBackdrop(): void {
    this.add
      .image(BATTLEFIELD_WIDTH / 2, 0, 'battle-background-grass')
      .setOrigin(0.5, 0)
      .setScale(BATTLEFIELD_WIDTH / GRASS_BACKDROP_WIDTH);
    const bezel = this.add.graphics().setDepth(20);
    bezel.fillStyle(WINDOW_CREAM, 1);
    bezel.fillRect(-1, -1, BATTLEFIELD_WIDTH + 2, 1);
    bezel.fillRect(-1, BATTLEFIELD_HEIGHT, BATTLEFIELD_WIDTH + 2, 1);
    bezel.fillRect(-1, 0, 1, BATTLEFIELD_HEIGHT);
    bezel.fillRect(BATTLEFIELD_WIDTH, 0, 1, BATTLEFIELD_HEIGHT);
    this.centreComposition();
  }

  /**
   * Every Pokemon on the field, each in its own spot.
   *
   * A single battle is one a side and the coordinates are the ones this screen
   * was authored with; a double is two a side, smaller and inside the band
   * between the two plate rows - see `combatantSpot`.
   */
  private drawCombatants(): void {
    // Both sides slide in from outside the battlefield, and on a stage wider
    // than the battle that is the letterbox: for the length of the entrance
    // they were drawn on the margin, outside the bezel. They are clipped to the
    // field, so they come in from behind its frame. The shape is never drawn.
    const field = this.add.graphics().setVisible(false);
    field.fillStyle(0xffffff, 1);
    field.fillRect(0, 0, BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT);
    this.fieldMask = field.createGeometryMask();

    let delay = 0;
    for (const side of ['enemy', 'player'] as const) {
      for (const ref of slotsOf(this.state, side)) {
        const combatant = unitAt(this.state, ref);
        if (!combatant) {
          continue;
        }
        const sprite = this.createCombatantSprite(ref, combatant);
        const spot = combatantSpot(side, ref.slot, this.state.unitCount);
        this.tweens.add({
          targets: sprite,
          x: spot.x,
          duration: 650,
          ease: 'Quad.out',
          delay,
        });
        delay += 180;
      }
    }
  }

  /** One sprite, placed off the field and masked to it, ready to slide in. */
  private createCombatantSprite(ref: SlotRef, combatant: BattleCombatant): Phaser.GameObjects.Image {
    const spot = combatantSpot(ref.side, ref.slot, this.state.unitCount);
    const facing = ref.side === 'player' ? 'back' : 'front';
    const sprite = this.add
      .image(combatantEntryX(ref.side), spot.y, `pokemon-${facing}-${combatant.pokemon.base.dexId}`)
      .setScale(spot.scale)
      // The pair nearer the front of the field is drawn over the pair behind
      // it, exactly as the plates are ordered: a slot is a place on the ground.
      .setDepth(2 + ref.slot * 0.001);
    if (this.fieldMask) {
      sprite.setMask(this.fieldMask);
    }
    this.sprites.set(plateKey(ref.side, ref.slot), sprite);
    return sprite;
  }

  private drawStatusBoxes(): void {
    for (const side of ['enemy', 'player'] as const) {
      for (const ref of slotsOf(this.state, side)) {
        const combatant = unitAt(this.state, ref);
        if (combatant) {
          this.createStatusBox(ref, combatant);
        }
      }
    }
  }

  /**
   * One plate, drawn for one slot.
   *
   * Depth 6, between the combatants at 2 and the type banner at 7. The
   * container's own depth is what decides this - a child's `setDepth` only
   * orders it against its siblings inside the container - so without it the
   * plate sat at depth 0, under both sprites: a Pokemon fainting slides its
   * sprite 34 pixels down as it fades, and on the way it crossed the other
   * side's name and level. Spotted on an evolution, but it happened on every
   * won battle.
   */
  private createStatusBox(ref: SlotRef, combatant: BattleCombatant): CombatantPlate {
    const showNumbers = ref.side === 'player';
    const layout = statusPlateLayout(ref.side, ref.slot, this.state.unitCount);
    const { x, y } = layout;
    const container = this.add.container(0, 0).setDepth(6);
    // Drawn, not stretched. `hud-box.png` is 32x32 with a one-pixel border, so
    // at 144 wide that border came out four pixels down the left and eight
    // along the bottom - the same smear the dialogue panel below had, on the
    // panel directly above it.
    const frame = this.add.graphics().setDepth(5);
    drawPixelWindow(frame, { x, y, width: layout.width, height: layout.height }, { fill: WINDOW_CREAM });
    container.add(frame);
    const nameSize = layout.showsTyping ? CAPTION_FONT_SIZE : '14px';
    container.add(
      this.add
        .text(x + 9, y + layout.nameY, combatant.pokemon.base.name.toUpperCase(), {
          fontFamily: BATTLE_FONT,
          fontSize: nameSize,
          color: '#202020',
        })
        .setDepth(6),
    );
    const levelText = this.add
      // Set from the plate's right edge, so a level of any length ends where
      // the HP bar under it ends instead of starting at a guessed column.
      .text(x + layout.width - 9, y + layout.nameY + 1, levelLabel(combatant.pokemon.level), {
        fontFamily: BATTLE_FONT,
        fontSize: layout.showsTyping ? CAPTION_FONT_SIZE : '13px',
        color: '#202020',
      })
      .setOrigin(1, 0)
      .setDepth(6);
    container.add(levelText);
    const statusText = this.add
      .text(
        x + (layout.showsTyping ? 82 : 82),
        y + layout.nameY + 1,
        statusAbbreviation(combatant.primaryStatus, combatant.confusionTurns) ?? '',
        {
          fontFamily: BATTLE_FONT,
          fontSize: CAPTION_FONT_SIZE,
          color: '#9b1c1c',
        },
      )
      .setDepth(6);
    container.add(statusText);
    container.add(
      this.add
        .text(x + 15, y + layout.barY - 1, 'HP:', {
          fontFamily: BATTLE_FONT,
          fontSize: '12px',
          color: '#202020',
        })
        .setDepth(6),
    );
    const hpBar = this.add.graphics();
    hpBar.setDepth(6);
    container.add(hpBar);
    const barX = x + layout.barX;
    const barY = y + layout.barY;
    this.drawHpBar(hpBar, barX, barY, combatant.currentHp / combatant.pokemon.maxHp, layout.barWidth);

    let hpText: Phaser.GameObjects.Text | undefined;
    if (showNumbers) {
      // On the compact plate the numbers share the bar's row, off the plate's
      // right edge, because the row below is carrying the typing and the gear.
      hpText = this.add
        .text(
          x + (layout.showsTyping ? layout.width - 9 : 74),
          y + (layout.showsTyping ? layout.barY - 1 : layout.detailY - 1),
          `${combatant.currentHp}/${combatant.pokemon.maxHp}`,
          {
            fontFamily: BATTLE_FONT,
            fontSize: layout.showsTyping ? CAPTION_FONT_SIZE : '13px',
            color: '#202020',
          },
        )
        .setOrigin(layout.showsTyping ? 1 : 0, 0);
      container.add(hpText);
      // The gear shares the bottom row - with the HP numbers on the full plate
      // and with the typing on the compact one - in the guidance ink the panel
      // below uses for anything that is not itself a number.
      container.add(
        this.add
          .text(
            x + (layout.showsTyping ? layout.width - 9 : 9),
            y + layout.detailY,
            heldGearLabel(heldItemName(combatant.pokemon.heldItemId)),
            {
              fontFamily: BATTLE_FONT,
              fontSize: CAPTION_FONT_SIZE,
              color: PANEL_GUIDANCE_INK,
            },
          )
          .setOrigin(layout.showsTyping ? 1 : 0, 0)
          .setDepth(6),
      );
    }

    // A double battle has no room for a floating banner over four plates, so
    // the typing that banner carried is on the plate itself; a single battle
    // keeps the banner it was authored with.
    let typeText: Phaser.GameObjects.Text | undefined;
    let banner: Phaser.GameObjects.Text | undefined;
    if (layout.showsTyping) {
      typeText = this.add
        .text(x + 9, y + layout.detailY, formatTypeList(getCombatantTypes(combatant)), {
          fontFamily: BATTLE_FONT,
          fontSize: CAPTION_FONT_SIZE,
          color: PANEL_GUIDANCE_INK,
        })
        .setDepth(6);
      container.add(typeText);
    } else {
      // Typing sits in the banner so incoming damage is readable before it
      // lands. It floats over the battlefield art, so it carries a dark outline
      // rather than relying on whatever happens to be behind it.
      banner = this.add
        .text(
          x,
          y - 15,
          combatantBanner(
            showNumbers ? 'YOURS' : this.enemyRole(),
            getCombatantTypes(combatant),
          ),
          BANNER_TEXT_STYLE,
        )
        .setDepth(7);
    }

    const plate: CombatantPlate = {
      container,
      hpBar,
      barX,
      barY,
      barWidth: layout.barWidth,
      hpText,
      statusText,
      levelText,
      typeText,
      banner,
    };
    this.plates.set(plateKey(ref.side, ref.slot), plate);
    this.displayed.set(plateKey(ref.side, ref.slot), combatant.pokemon);
    this.displayedHp.set(plateKey(ref.side, ref.slot), combatant.currentHp);
    return plate;
  }

  /** The plate a slot is drawn on, if it has one. */
  private plateFor(ref: SlotRef): CombatantPlate | undefined {
    return this.plates.get(plateKey(ref.side, ref.slot));
  }

  private spriteFor(ref: SlotRef): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(plateKey(ref.side, ref.slot));
  }

  private drawHpBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    ratio: number,
    width = 88,
  ): void {
    graphics.clear();
    graphics.fillStyle(0x303030, 1);
    graphics.fillRect(x, y, width, 8);
    const color = ratio > 0.5 ? 0x40a850 : ratio > 0.2 ? 0xd8b840 : 0xd05040;
    graphics.fillStyle(color, 1);
    graphics.fillRect(x + 2, y + 2, Math.round((width - 4) * Math.max(0, ratio)), 4);
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

    if (this.mode === 'about-to-use') {
      this.commandContainer.add(this.createAboutToUseBox());
      return;
    }

    if (this.mode === 'target') {
      this.commandContainer.add(this.createTargetBox());
      return;
    }

    if (this.mode === 'make-room') {
      this.commandContainer.add(this.createMakeRoomBox());
      return;
    }

    const labels =
      this.mode === 'main'
        ? this.mainCommandLabels()
        : this.mode === 'items'
          ? this.itemCommandLabels()
          : this.mode === 'balls'
            ? this.ballCommandLabels()
          : (this.chooser()?.moves ?? []).map(formatMoveCommand);
    this.createCommandBox(labels);
    this.selectedCommand = Math.min(this.selectedCommand, labels.length - 1);
    this.updateSelection();
  }

  /**
   * The main command set, one entry per action in `mainActions()`. ITEM is on
   * every one of them: the bag is what the loadout step asked the player to
   * commit to, so it has to be reachable from inside the fight it was packed
   * for - most of all in an authored trainer battle, which is the fight the
   * player cannot walk out of to reach the overworld bag.
   */
  private mainCommandLabels(): readonly string[] {
    const item = formatItemCommand(battleItemCount(this.bag));
    return this.trainer
      ? this.hunterBattle
        ? ['FIGHT', this.hunterFleeLabel(), 'POKéMON', item]
        : ['FIGHT', 'POKéMON', item]
      : [
        'FIGHT',
        formatBallCommand(ballCount(this.bag)),
        'POKéMON',
        item,
        this.wildEscapeLabel(),
      ];
  }

  private itemCommandLabels(): readonly string[] {
    return usableBattleItems(this.bag).map((item) => formatItemRow(item, this.bag.count(item.id)));
  }

  private ballCommandLabels(): readonly string[] {
    return carriedBalls(this.bag).map((ball) => formatItemRow(ball, this.bag.count(ball.id)));
  }

  /** The submenus that list rows with a guidance line under them. */
  private get isRowListMode(): boolean {
    return this.mode === 'moves' || this.mode === 'items' || this.mode === 'balls';
  }

  private createCommandBox(labels: readonly string[]): void {
    this.commandContainer.add(this.createPanelFrame());
    this.moveGuidanceTexts = this.isRowListMode
      ? [0, 1].map((line) => {
          const layout = moveGuidanceLayout(line);
          // No fixed width here: guidance must never be silently truncated.
          const text = this.add.text(layout.x, COMMAND_Y + layout.y, '', {
            fontFamily: BATTLE_FONT,
            fontSize: CAPTION_FONT_SIZE,
            color: PANEL_GUIDANCE_INK,
          });
          this.commandContainer.add(text);
          return text;
        })
      : [];
    this.commandTexts = labels.map((label, index) => {
      const layout = this.isRowListMode ? moveCommandLayout(index) : undefined;
      const position = layout ?? mainCommandLayout(index, labels.length);
      const text = this.add.text(
        position.x,
        COMMAND_Y + position.y,
        label,
        {
          fontFamily: BATTLE_FONT,
          fontSize: this.isRowListMode ? '13px' : DIALOG_FONT_SIZE,
          color: isEmptyStackLabel(label) ? PANEL_REFUSAL_INK : WINDOW_INK,
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

  /** The frame every state of the bottom panel is drawn in: the dialogue's own. */
  private createPanelFrame(): Phaser.GameObjects.Graphics {
    const frame = this.add.graphics();
    drawPixelWindow(frame, BATTLE_PANEL, { fill: WINDOW_CREAM });
    return frame;
  }

  private createPartyBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.add(this.createPanelFrame());
    container.add(
      this.add.text(
        partyPromptLayout.x,
        COMMAND_Y + partyPromptLayout.y,
        partyPrompt({
          item: this.pendingItem,
          forced: this.forcedReplacement,
          refusal: this.partyMessage,
        }),
        {
          fontFamily: BATTLE_FONT,
          fontSize: CAPTION_FONT_SIZE,
          color: this.partyMessage ? PANEL_REFUSAL_INK : PANEL_GUIDANCE_INK,
        },
      ),
    );
    this.commandTexts = this.party.pokemon.map((pokemon, index) => {
      const layout = partyRowLayout(index);
      const text = this.add.text(layout.x, COMMAND_Y + layout.y, formatPartyRow(pokemon), {
        fontFamily: BATTLE_FONT,
        fontSize: CAPTION_FONT_SIZE,
        color: pokemon.isFainted ? PANEL_REFUSAL_INK : WINDOW_INK,
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
    this.selectedCommand = Math.min(this.selectedCommand, this.commandTexts.length - 1);
    this.updateSelection();
    return container;
  }

  /**
   * The question itself: who is coming, and the free switch offered against it.
   * Drawn in the panel's own frame beside the dialogue it interrupts, because
   * the bottom of the battle screen is one surface.
   */
  /**
   * Who this move is being aimed at.
   *
   * It is only ever asked in a double battle, and only for a move that lands on
   * one foe: a move that hits both of them has nothing to ask, and a field with
   * one Pokemon standing on it has nothing to choose between. The cursor starts
   * on the foe opposite the chooser, which is the answer a player who does not
   * care would want, and ESC goes back to the move list rather than losing the
   * choice of move with it.
   */
  private createTargetBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.add(this.createPanelFrame());
    container.add(
      this.add.text(targetPromptLayout.x, COMMAND_Y + targetPromptLayout.y, TARGET_PROMPT, {
        fontFamily: BATTLE_FONT,
        fontSize: CAPTION_FONT_SIZE,
        color: PANEL_GUIDANCE_INK,
      }),
    );
    this.commandTexts = this.aimableTargets().map((ref, index) => {
      const combatant = unitAt(this.state, ref)!;
      const layout = targetRowLayout(index);
      const text = this.add.text(
        layout.x,
        COMMAND_Y + layout.y,
        formatTargetRow({ name: combatant.pokemon.base.name, level: combatant.pokemon.level }),
        { fontFamily: BATTLE_FONT, fontSize: DIALOG_FONT_SIZE, color: WINDOW_INK },
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
      container.add(text);
      return text;
    });
    this.selectedCommand = Math.min(this.selectedCommand, this.commandTexts.length - 1);
    this.updateSelection();
    return container;
  }

  /** The foes a single-target move could be aimed at, in slot order. */
  private aimableTargets(): readonly SlotRef[] {
    return engagedSlots(this.state, 'enemy');
  }

  /** The slot whose move is being chosen right now. */
  private chooserRef(): SlotRef {
    return slotRef('player', this.choosingSlot);
  }

  private chooser(): BattleCombatant | null {
    return unitAt(this.state, this.chooserRef());
  }

  /** The slots the player still has to answer for this turn, in order. */
  private choosingSlots(): readonly SlotRef[] {
    return engagedSlots(this.state, 'player');
  }

  /** The slots whose move this turn is not theirs to pick - a charge or a recharge. */
  private lockedChoices(): PlayerMoveChoice[] {
    return this.choosingSlots().flatMap((ref) => {
      const moveIndex = lockedMove(this.state, 'player', ref.slot);
      return moveIndex === null ? [] : [{ slot: ref.slot, moveIndex }];
    });
  }

  private createAboutToUseBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.add(this.createPanelFrame());
    [aboutToUseLine(this.trainer?.name ?? '', this.aboutToUse ?? ''), ABOUT_TO_USE_QUESTION].forEach(
      (line, index) => {
        const layout = aboutToUsePromptLayout(index);
        container.add(
          // The trainer's own words, in the ink the dialogue that shares this
          // panel is written in: the party list's prompt is a hint about a list,
          // and this is a question. 12px rather than the dialogue's 14, because
          // the longest of these lines is a trainer's name, five words and a
          // ten-letter Pokemon, and at 14 it would run off the panel.
          this.add.text(layout.x, COMMAND_Y + layout.y, line, {
            fontFamily: BATTLE_FONT,
            fontSize: CAPTION_FONT_SIZE,
            color: WINDOW_INK,
          }),
        );
      },
    );
    this.commandTexts = ABOUT_TO_USE_OPTIONS.map((label, index) => {
      const layout = aboutToUseOptionLayout(index);
      const text = this.add.text(layout.x, COMMAND_Y + layout.y, label, {
        fontFamily: BATTLE_FONT,
        fontSize: DIALOG_FONT_SIZE,
        color: WINDOW_INK,
      });
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
      container.add(text);
      return text;
    });
    this.updateSelection();
    return container;
  }

  /**
   * What is in the pack and what each piece stands on, so the player can buy
   * the squares a catch needs without leaving the fight.
   *
   * The last row is always KEEP THE PACK: declining has to be as visible as
   * dropping, because it is the right answer for anyone who would rather keep
   * the Potion. Only the page the cursor is on is drawn - six kinds fit the
   * panel and a pack can hold more - and the prompt above answers the row the
   * cursor is on, the way the party list's own prompt does.
   */
  private createMakeRoomBox(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.add(this.createPanelFrame());
    const rows = this.makeRoomRows();
    this.selectedCommand = Math.max(0, Math.min(this.selectedCommand, rows.length - 1));
    this.makeRoomPage = Math.floor(this.selectedCommand / MAKE_ROOM_PAGE);
    const start = this.makeRoomPage * MAKE_ROOM_PAGE;
    container.add(
      this.add.text(
        makeRoomPromptLayout.x,
        COMMAND_Y + makeRoomPromptLayout.y,
        packRoomPrompt(rows[this.selectedCommand]),
        {
          fontFamily: BATTLE_FONT,
          fontSize: CAPTION_FONT_SIZE,
          color: PANEL_GUIDANCE_INK,
        },
      ),
    );
    this.commandTexts = rows.slice(start, start + MAKE_ROOM_PAGE).map((choice, offset) => {
      const layout = makeRoomRowLayout(offset);
      const text = this.add.text(
        layout.x,
        COMMAND_Y + layout.y,
        choice ? formatPackRoomRow(choice) : KEEP_PACK_ROW,
        {
          fontFamily: BATTLE_FONT,
          fontSize: CAPTION_FONT_SIZE,
          color: WINDOW_INK,
        },
      );
      text
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.selectedCommand = start + offset;
          this.showCommands();
        })
        .on('pointerdown', () => {
          this.selectedCommand = start + offset;
          this.confirm();
        });
      container.add(text);
      return text;
    });
    this.updateSelection();
    return container;
  }

  /**
   * The pack's kinds, then the way out. Undefined is KEEP THE PACK, which is a
   * row rather than a hint so that a mouse can reach it and the cursor can
   * explain it.
   */
  private makeRoomRows(): readonly (PackRoomChoice | undefined)[] {
    return [...this.makeRoomChoices(this.heldBallId), undefined];
  }

  /** What the pack could put down, keeping the ball the throw is waiting on. */
  private makeRoomChoices(keepOne: string | undefined): readonly PackRoomChoice[] {
    return packRoomChoices(this.bag, this.state.enemy.pokemon, keepOne);
  }

  /**
   * Puts one piece of the pack down and finishes the throw it was blocking.
   *
   * Nothing is ever dropped that was not chosen, and one drop may not be
   * enough - four free squares scattered around a Potion are not a seat for a
   * Pidgey - so the panel stays open on the pack as it now stands until there
   * is room, and the ball is thrown the moment there is. The drop costs no turn
   * of its own: the throw that follows is the turn, which is the one the player
   * meant to spend.
   */
  private dropForRoom(choiceIndex: number): void {
    const choice = this.makeRoomRows()[choiceIndex];
    if (!choice) {
      this.keepThePack();
      return;
    }
    if (!this.bag.remove(choice.itemId, 1)) {
      return;
    }
    audioManager.play('menuClose');
    if (packHasRoomForPokemon(this.bag, this.state.enemy.pokemon)) {
      const ballIndex = Math.max(
        0,
        carriedBalls(this.bag).findIndex((ball) => ball.id === this.heldBallId),
      );
      this.heldBallId = undefined;
      this.throwBall(ballIndex);
      return;
    }
    this.selectedCommand = Math.min(this.selectedCommand, this.makeRoomRows().length - 1);
    this.showCommands();
  }

  /** Declining: nothing is put down, no ball is spent, and the fight goes on. */
  private keepThePack(): void {
    this.heldBallId = undefined;
    this.pendingMakeRoom = false;
    this.mode = 'main';
    this.selectedCommand = 0;
    this.showCommands();
    audioManager.play('cancel');
  }

  private moveSelection(direction: 'left' | 'right' | 'up' | 'down'): void {
    // The make-room panel draws one page of a longer list, so what the cursor
    // walks is the list rather than the rows on screen.
    const count = this.mode === 'make-room' ? this.makeRoomRows().length : this.commandTexts.length;
    if (count === 0) {
      return;
    }

    const columns =
      this.mode === 'party'
        ? PARTY_COLUMNS
        : this.mode === 'main'
          ? mainCommandColumns(count)
          : this.mode === 'make-room'
            ? MAKE_ROOM_COLUMNS
            : 2;
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
    if (this.mode === 'make-room') {
      // The prompt answers the row the cursor is on and the page follows it, so
      // the panel is redrawn rather than re-inked.
      this.showCommands();
    } else {
      this.updateSelection();
    }
    audioManager.play('select');
  }

  private updateSelection(): void {
    this.refreshMoveGuidance();
    // Which of the rows on screen the cursor is on. They are the whole list
    // everywhere but the make-room panel, which draws one page of a longer one.
    const cursor =
      this.mode === 'make-room'
        ? this.selectedCommand - this.makeRoomPage * MAKE_ROOM_PAGE
        : this.selectedCommand;
    this.commandTexts.forEach((text, index) => {
      text.setText(
        `${index === cursor ? '▶ ' : '  '}${text.text.replace(/^[▶ ]{2}/, '')}`,
      );
      // The cursor is the whole of the selection, as it is in the dialogue this
      // panel shares a frame with: no row is boxed in a second colour.
      text.setColor(
        text.text.includes('FNT') || isEmptyStackLabel(text.text) ? PANEL_REFUSAL_INK : WINDOW_INK,
      );
    });
  }

  /** Keeps the guidance lines describing whichever row is highlighted. */
  private refreshMoveGuidance(): void {
    if (this.moveGuidanceTexts.length === 0) {
      return;
    }
    if (this.mode === 'items') {
      const item = usableBattleItems(this.bag)[this.selectedCommand];
      this.moveGuidanceTexts[0]?.setText(item ? describeItemGuidance(item) : '').setColor(PANEL_GUIDANCE_INK);
      this.moveGuidanceTexts[1]?.setText('').setColor(PANEL_GUIDANCE_INK);
      return;
    }
    if (this.mode === 'balls') {
      const ball = carriedBalls(this.bag)[this.selectedCommand];
      this.moveGuidanceTexts[0]?.setText(ball ? describeBallGuidance(ball) : '').setColor(PANEL_GUIDANCE_INK);
      this.moveGuidanceTexts[1]?.setText('').setColor(PANEL_GUIDANCE_INK);
      return;
    }
    if (this.mode !== 'moves') {
      return;
    }
    const chooser = this.chooser();
    const move = chooser?.moves[this.selectedCommand];
    if (!chooser || !move) {
      return;
    }
    // The matchup is read against whoever this move would land on first, which
    // in a double battle is the foe opposite the chooser until they say
    // otherwise. A move that hits both is read against the nearer of the two:
    // the other one's line is on its own plate.
    const aim = this.aimableTargets();
    const against = unitAt(this.state, aim[Math.min(this.choosingSlot, aim.length - 1)] ?? aim[0]);
    const guidance = describeMoveGuidance(move, getCombatantTypes(chooser), {
      name: against?.pokemon.base.name ?? '',
      types: against ? getCombatantTypes(against) : [],
    });
    this.moveGuidanceTexts[0]
      ?.setText(
        moveGuidanceFor(
          guidance.summary,
          { name: chooser.pokemon.base.name },
          this.state.unitCount,
        ),
      )
      .setColor(PANEL_GUIDANCE_INK);
    this.moveGuidanceTexts[1]?.setText(guidance.matchup).setColor(MATCHUP_COLORS[guidance.tone]);
  }

  private confirm(): void {
    audioManager.play('confirm');
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

    if (this.mode === 'target') {
      this.dispatchAction({ type: 'aim-at', targetIndex: this.selectedCommand });
      return;
    }

    if (this.mode === 'items') {
      this.dispatchAction({ type: 'select-item', itemIndex: this.selectedCommand });
      return;
    }

    if (this.mode === 'balls') {
      this.dispatchAction({ type: 'throw-ball', ballIndex: this.selectedCommand });
      return;
    }

    if (this.mode === 'make-room') {
      this.dispatchAction({ type: 'drop-for-room', choiceIndex: this.selectedCommand });
      return;
    }

    if (this.mode === 'about-to-use') {
      this.dispatchAction({
        type: 'answer-about-to-use',
        switching: this.selectedCommand !== ABOUT_TO_USE_DECLINE,
      });
      return;
    }

    if (this.mode === 'party') {
      // The party screen is the target picker as well as the switch menu, so
      // which one it is answering is the item waiting to be handed over.
      this.dispatchAction(
        this.pendingItem
          ? { type: 'use-item', partyIndex: this.selectedCommand }
          : { type: 'switch-pokemon', partyIndex: this.selectedCommand },
      );
    }
  }

  private dispatchAction(action: BattleAction): void {
    switch (action.type) {
      case 'choose-fight':
        // A slot already locked into a two-turn move has nothing to be asked.
        this.pendingChoices = this.lockedChoices();
        this.choosingSlot =
          this.choosingSlots().find(
            (ref) => !this.pendingChoices.some((choice) => (choice.slot ?? 0) === ref.slot),
          )?.slot ?? 0;
        this.mode = 'moves';
        this.selectedCommand = 0;
        this.showCommands();
        return;
      case 'choose-ball':
        this.showBallSelection();
        return;
      case 'throw-ball':
        this.throwBall(action.ballIndex);
        return;
      case 'choose-pokemon':
        this.showPartySelection(false);
        return;
      case 'choose-item':
        this.showItemSelection();
        return;
      case 'choose-run':
        this.flee();
        return;
      case 'use-move':
        this.chooseMove(action.moveIndex);
        return;
      case 'aim-at':
        this.aimAt(action.targetIndex);
        return;
      case 'select-item':
        this.selectItem(action.itemIndex);
        return;
      case 'use-item':
        this.useItem(action.partyIndex);
        return;
      case 'switch-pokemon':
        this.switchPokemon(action.partyIndex);
        return;
      case 'answer-about-to-use':
        this.answerAboutToUse(action.switching);
        return;
      case 'drop-for-room':
        this.dropForRoom(action.choiceIndex);
    }
  }

  private mainActions(): readonly BattleAction[] {
    return this.trainer
      ? this.hunterBattle
        ? [
            { type: 'choose-fight' },
            { type: 'choose-run' },
            { type: 'choose-pokemon' },
            { type: 'choose-item' },
          ]
        : [{ type: 'choose-fight' }, { type: 'choose-pokemon' }, { type: 'choose-item' }]
      : [
          { type: 'choose-fight' },
          { type: 'choose-ball' },
          { type: 'choose-pokemon' },
          { type: 'choose-item' },
          { type: 'choose-run' },
        ];
  }

  private goBack(): void {
    // Backing out of the list the question opened returns to the question, not
    // to the main commands: the trainer's Pokemon has still not landed, and
    // there is no turn to take until it has.
    if (this.mode === 'party' && this.aboutToUseSwitching) {
      this.aboutToUseSwitching = false;
      this.mode = 'about-to-use';
      this.selectedCommand = ABOUT_TO_USE_DECLINE;
      this.showCommands();
      audioManager.play('cancel');
      return;
    }
    if (this.mode === 'party' && this.forcedReplacement) {
      return;
    }
    // Escape out of the make-room panel is the KEEP THE PACK row by another
    // name: nothing is put down and the fight is handed back whole.
    if (this.mode === 'make-room') {
      this.keepThePack();
      return;
    }
    // Backing out of the aim returns to the move list: the player is changing
    // who it lands on, not whether to fight.
    if (this.mode === 'target') {
      this.mode = 'moves';
      this.selectedCommand = this.aimingMoveIndex;
      this.showCommands();
      audioManager.play('cancel');
      return;
    }
    // In a double battle, backing out of the second Pokemon's move list goes to
    // the first one's, not to the main commands: the turn is one decision made
    // twice, and undoing half of it is what B is for.
    if (this.mode === 'moves' && this.pendingChoices.length > 0) {
      const previous = this.pendingChoices.pop()!;
      this.choosingSlot = previous.slot ?? 0;
      this.selectedCommand = previous.moveIndex;
      this.showCommands();
      audioManager.play('cancel');
      return;
    }
    if (this.mode !== 'moves' && this.mode !== 'items' && this.mode !== 'balls' && this.mode !== 'party') {
      return;
    }
    // Backing out of the target picker returns to the item list, not to the
    // main commands: the player is cancelling the recipient, not the decision
    // to spend something.
    const returningToItems = this.mode === 'party' && this.pendingItem !== undefined;
    this.pendingItem = undefined;
    this.mode = returningToItems ? 'items' : 'main';
    this.selectedCommand = 0;
    this.showCommands();
    audioManager.play('cancel');
  }

  private enemyRole(): BannerRole {
    return enemyBannerRole({ trainer: this.trainer !== undefined, hunter: this.hunterBattle });
  }

  private hunterFleeLabel(): string {
    const manager = this.runSession?.manager;
    const snapshot = manager?.snapshot();
    return formatHunterFleeCommand(
      manager?.nextHunterFleePenaltyMs() ?? 0,
      snapshot ? snapshot.durationMs - snapshot.elapsedMs : undefined,
    );
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
    audioManager.play('flee');
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
    // An ability that settled it says so, because the player was shown 100% or
    // 0% on the command and is owed the reason for the number they committed to.
    const abilityLine = attempt.ability
      ? escapeAbilityMessage(
          {
            user: attempt.ability.holder,
            name: (attempt.ability.holder === 'player' ? this.state.player : this.state.enemy)
              .pokemon.base.name,
          },
          attempt.ability.label,
          attempt.escaped,
        )
      : null;
    if (attempt.escaped) {
      this.pendingBattleExit = true;
      audioManager.play('flee');
      if (abilityLine) {
        this.dialog.showMessages([abilityLine, WILD_ESCAPE_SUCCESS_MESSAGE]);
      } else {
        this.dialog.showMessage(WILD_ESCAPE_SUCCESS_MESSAGE);
      }
      return;
    }
    if (abilityLine) {
      audioManager.play('denied');
      this.dialog.showMessage(abilityLine);
      return;
    }

    this.wildEscapeAttempts += 1;
    const enemyResult = resolveEnemyTurn(this.state, () => Math.random());
    this.state = enemyResult.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.showCombatEvents(enemyResult.events, [
      {
        message: wildEscapeFailureMessage(this.state.enemy.pokemon.base.name),
        sound: 'denied',
      },
    ]);
  }

  /**
   * One of the player's Pokemon has picked a move.
   *
   * In a single battle this is the whole turn and it resolves at once. In a
   * double it is half of one: the move may need an aim, and the other slot has
   * still to be asked, so the choice is put on `pendingChoices` and the turn
   * only runs once every slot has answered.
   */
  private chooseMove(moveIndex: number): void {
    const chooser = this.chooser();
    const move = chooser?.moves[moveIndex];
    if (!chooser || !move) {
      return;
    }
    // A move that lands on one foe, with two foes standing, is the one case
    // there is anything to ask.
    if (move.base.target === MoveTarget.Foe && this.aimableTargets().length > 1) {
      this.aimingMoveIndex = moveIndex;
      this.mode = 'target';
      this.selectedCommand = Math.min(this.choosingSlot, this.aimableTargets().length - 1);
      this.showCommands();
      return;
    }
    this.recordChoice({ slot: this.choosingSlot, moveIndex });
  }

  /** The answer to the aim question, which completes this slot's choice. */
  private aimAt(targetIndex: number): void {
    const target = this.aimableTargets()[targetIndex];
    if (!target) {
      return;
    }
    this.recordChoice({ slot: this.choosingSlot, moveIndex: this.aimingMoveIndex, target });
  }

  /**
   * Books one slot's action and either asks the next slot or takes the turn.
   */
  private recordChoice(choice: PlayerMoveChoice): void {
    this.pendingChoices = [
      ...this.pendingChoices.filter((existing) => (existing.slot ?? 0) !== (choice.slot ?? 0)),
      choice,
    ];
    const answered = new Set(this.pendingChoices.map((existing) => existing.slot ?? 0));
    const next = this.choosingSlots().find((ref) => !answered.has(ref.slot));
    if (next) {
      this.choosingSlot = next.slot;
      this.mode = 'moves';
      this.selectedCommand = 0;
      this.showCommands();
      return;
    }
    this.useMove(this.pendingChoices);
  }

  private useMove(choice: number | readonly PlayerMoveChoice[]): void {
    const result = resolveTurn(this.state, choice, () => Math.random());
    if (result.events.length === 0) {
      return;
    }
    const previousState = this.state;
    this.state = result.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    const rewardMessages = this.awardTrainerDefeatExperience(previousState, result.events);
    this.pendingChoices = [];
    this.choosingSlot = 0;
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.showCombatEvents(result.events, [], rewardMessages);
  }

  /**
   * BALL with one kind carried throws it - there is nothing to choose, and no
   * best ball to spend unasked. With two or more it opens the list, because the
   * ball thrown is the player's decision: a Great Ball is worth saving for a
   * Pokemon that matters.
   */
  private showBallSelection(): void {
    const balls = carriedBalls(this.bag);
    if (this.trainer || balls.length <= 1) {
      this.throwBall(0);
      return;
    }
    this.mode = 'balls';
    this.selectedCommand = 0;
    this.showCommands();
  }

  private throwBall(ballIndex: number): void {
    if (this.trainer) {
      this.mode = 'events';
      this.commandContainer.setVisible(false);
      audioManager.play('denied');
      this.dialog.showMessage("You can't catch a trainer's POKéMON!");
      return;
    }
    // Asked before the ball is spent, and before the roll: a Pokemon that will
    // not fit in the pack must be refused out loud rather than caught and then
    // quietly dropped, and finding out should not cost a ball - whichever ball
    // was chosen.
    //
    // The refusal is also the doorway. It used to say "drop something from your
    // BAG first", which a battle has no door to: the only obedient move was to
    // flee, and fleeing loses the Pokemon the refusal was about. Now the ball is
    // held and the panel asks what to put down, so the answer is here.
    // Only the arrangement in the way is not "no room": the pack re-packs
    // itself and the ball is thrown, because a refusal a player cannot act on
    // from inside a fight is the whole fault this screen exists to answer.
    if (!clearPackRoomForPokemon(this.bag, this.state.enemy.pokemon).fits) {
      const choices = this.makeRoomChoices(carriedBalls(this.bag)[ballIndex]?.id);
      this.mode = 'events';
      this.commandContainer.setVisible(false);
      audioManager.play('denied');
      this.heldBallId = choices.length > 0 ? carriedBalls(this.bag)[ballIndex]?.id : undefined;
      this.pendingMakeRoom = choices.length > 0;
      this.makeRoomPage = 0;
      this.dialog.showMessage(
        `${packFullForPokemonLine(this.state.enemy.pokemon)} ${
          choices.length > 0 ? MAKE_ROOM_INVITE : NOTHING_TO_DROP_MESSAGE
        }`,
      );
      return;
    }
    const ball = carriedBalls(this.bag)[ballIndex];
    if (!ball || !this.bag.remove(ball.id, 1)) {
      this.mode = 'events';
      this.commandContainer.setVisible(false);
      audioManager.play('denied');
      this.dialog.showMessage('No POKé BALLS left!');
      return;
    }

    const result = resolveCatchAttempt(this.state, () => Math.random(), ballModifierOf(ball));
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
    // A catch is cargo whether it walks in the party or rides in the raid's
    // stash - neither was deployed - so the squares are charged either way.
    if (this.runSession) {
      syncPackCargo(this.bag, this.runSession.manager.snapshot());
    }
    if (this.party.pokemon.length < PARTY_LIMIT) {
      this.party.addPokemon(caughtPokemon);
      return;
    }
    this.caughtPokemonStash.push(caughtPokemon);
  }

  private showPartySelection(forcedReplacement: boolean): void {
    this.mode = 'party';
    this.forcedReplacement = forcedReplacement;
    this.pendingItem = undefined;
    this.partyMessage = '';
    this.selectedCommand = 0;
    this.showCommands();
  }

  /**
   * Opens the medicine pocket of the raid bag. An empty pocket says so rather
   * than opening on nothing, and costs no turn - nothing has been spent.
   */
  private showItemSelection(): void {
    if (battleItemCount(this.bag) === 0) {
      this.mode = 'events';
      this.commandContainer.setVisible(false);
      audioManager.play('denied');
      this.dialog.showMessage(NO_BATTLE_ITEMS_MESSAGE);
      return;
    }
    this.mode = 'items';
    this.pendingItem = undefined;
    this.selectedCommand = 0;
    this.showCommands();
  }

  private selectItem(itemIndex: number): void {
    const item = usableBattleItems(this.bag)[itemIndex];
    if (!item) {
      return;
    }
    this.pendingItem = item;
    this.mode = 'party';
    this.forcedReplacement = false;
    this.partyMessage = '';
    this.selectedCommand = 0;
    this.showCommands();
  }

  /**
   * Spends one medicine out of the raid bag on one party Pokemon.
   *
   * The turn is the price, so the enemy moves straight afterwards - but only
   * when the item actually did something. A refused use (full HP, nothing to
   * cure, a fainted Pokemon medicine cannot revive) says why and leaves the
   * player still choosing, because charging a turn for a message would make
   * reading the pocket more dangerous than not carrying one.
   */
  private useItem(partyIndex: number): void {
    const item = this.pendingItem;
    const target = this.party.pokemon[partyIndex];
    if (!item || !target) {
      return;
    }
    if (this.bag.count(item.id) <= 0) {
      this.showPartyMessage(`No ${item.displayName.toUpperCase()} left!`);
      return;
    }

    const use = applyBattleItem(this.state, item, target);
    if (!use.used) {
      this.showPartyMessage(use.message);
      return;
    }

    this.bag.remove(item.id, 1);
    this.pendingItem = undefined;
    this.state = use.state;
    this.persistActivePokemonHp();
    // Whichever slot the medicine was drunk in - the plate that has to move is
    // the one the Pokemon is standing on.
    const healedSlot = playerSlotOf(this.state, target);
    if (healedSlot) {
      this.refreshPlayerHpDisplay(healedSlot);
    }
    this.refreshStatusLabels();
    const enemyResult = resolveEnemyTurn(this.state, () => Math.random());
    this.state = enemyResult.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.showCombatEvents(enemyResult.events, [{ message: use.message, sound: 'heal' }]);
  }

  /**
   * Puts a plate's HP bar back in step with the battle state after it moved
   * upwards. `animateHpDelta` only ever counts down, so healing needs this.
   */
  private refreshPlayerHpDisplay(ref: SlotRef = slotRef('player', 0)): void {
    const combatant = unitAt(this.state, ref);
    const plate = this.plateFor(ref);
    if (!combatant || !plate) {
      return;
    }
    this.displayedHp.set(plateKey(ref.side, ref.slot), combatant.currentHp);
    this.drawHpBar(
      plate.hpBar,
      plate.barX,
      plate.barY,
      combatant.currentHp / combatant.pokemon.maxHp,
      plate.barWidth,
    );
    plate.hpText?.setText(`${combatant.currentHp}/${combatant.pokemon.maxHp}`);
  }

  private switchPokemon(partyIndex: number): void {
    const pokemon = this.party.pokemon[partyIndex];
    if (!pokemon) {
      return;
    }
    // Already out means out in *either* slot: a double battle can otherwise be
    // asked to put the same Pokemon on the field twice.
    if (playerCombatants(this.state).some((combatant) => combatant.pokemon === pokemon)) {
      this.showPartyMessage(`${pokemon.base.name.toUpperCase()} is already out!`);
      return;
    }
    if (pokemon.isFainted) {
      this.showPartyMessage(`${pokemon.base.name.toUpperCase()} has fainted!`);
      return;
    }

    if (this.aboutToUseSwitching) {
      this.completeAboutToUseSwitch(pokemon);
      return;
    }

    // A forced replacement goes into the slot that emptied; a switch the player
    // chose is the lead's, because the main commands are the lead's.
    const into = slotRef('player', this.forcedReplacement ? this.replacementSlot : 0);
    const outgoingName = unitAt(this.state, into)?.pokemon.base.name.toUpperCase() ?? '';
    const wasForcedReplacement = this.forcedReplacement;
    this.persistActivePokemonHp();
    const switchIn = replacePlayerPokemon(this.state, pokemon, into.slot);
    const switchedState = switchIn.state;
    this.state = switchedState;
    this.participatingPokemon.add(pokemon);
    this.forcedReplacement = false;
    this.refreshPlayerCombatant(into);
    const result = resolveEnemyTurn(switchedState, () => Math.random());
    this.state = result.state;
    this.persistActivePokemonHp();
    this.refreshStatusLabels();
    this.prepareForcedReplacement();
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.showCombatEvents([...switchIn.events, ...result.events], [
      ...(wasForcedReplacement ? [] : [`Come back, ${outgoingName}!`]),
      { message: `Go, ${pokemon.base.name.toUpperCase()}!`, sound: 'sendOut' },
    ]);
  }

  /**
   * Holds a trainer's next Pokemon at the door while the player is asked
   * whether to switch.
   *
   * The engine has already swapped the combatant in - that is what the
   * `enemy-sent-out` line at the head of the queue is about to announce - so
   * this is a pause in the reading rather than a change to the fight. Answering
   * either way puts the same line back up. Nothing is offered where there is
   * nothing to decide: a bench with nobody standing on it, a replacement the
   * player is already being forced to make, or a Pokemon this fight has already
   * asked about.
   */
  private offerAboutToUseSwitch(enemyName: string): boolean {
    if (!this.trainer || this.forcedReplacement || this.aboutToUseSwitching) {
      return false;
    }
    // Never in a double battle: the question is about a field with nothing on
    // it, and in a double the other slot is still standing there. There is also
    // no free turn to spend - the Pokemon the swap would be made against has
    // landed beside somebody who is already swinging.
    if (this.state.unitCount > 1) {
      return false;
    }
    if (this.state.player.currentHp === 0) {
      return false;
    }
    if (this.aboutToUseOffered.has(this.state.enemyPartyIndex)) {
      return false;
    }
    const hasBench = this.party.pokemon.some(
      (pokemon) => pokemon !== this.state.player.pokemon && !pokemon.isFainted,
    );
    if (!hasBench) {
      return false;
    }
    this.aboutToUseOffered.add(this.state.enemyPartyIndex);
    this.aboutToUse = enemyName;
    this.mode = 'about-to-use';
    this.selectedCommand = ABOUT_TO_USE_DECLINE;
    this.showCommands();
    return true;
  }

  /** YES opens the bench; NO simply carries on reading. */
  private answerAboutToUse(switching: boolean): void {
    if (switching) {
      this.aboutToUseSwitching = true;
      this.showPartySelection(false);
      return;
    }
    this.aboutToUse = null;
    this.resumeCombatMessages();
  }

  /**
   * The free switch. `switchPokemon` spends the enemy's turn on a swap, which
   * is the price of changing your mind in the middle of a fight; there is no
   * turn to spend here, because the Pokemon the swap is being made against has
   * not been sent out yet.
   */
  private completeAboutToUseSwitch(pokemon: PokemonInstance): void {
    const outgoingName = this.state.player.pokemon.base.name.toUpperCase();
    this.aboutToUseSwitching = false;
    this.aboutToUse = null;
    this.persistActivePokemonHp();
    const switchIn = replacePlayerPokemon(this.state, pokemon);
    this.state = switchIn.state;
    this.participatingPokemon.add(pokemon);
    this.refreshPlayerCombatant();
    this.refreshStatusLabels();
    this.pendingCombatMessages.unshift(
      stagedNote(`Come back, ${outgoingName}!`),
      stagedNote({ message: `Go, ${pokemon.base.name.toUpperCase()}!`, sound: 'sendOut' }),
      // Whatever the arrival did - a status shed on the way out, an Intimidate
      // on the way in - is read after the two lines that name the swap.
      ...switchIn.events.map((event) => stagedNote(eventToMessage(event))),
    );
    this.resumeCombatMessages();
  }

  /** Puts the panel back on the queue the question interrupted. */
  private resumeCombatMessages(): void {
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    if (this.pendingCombatMessages.length === 0) {
      this.isPresentingCombatEvents = false;
      this.dialog.showMessages([]);
      return;
    }
    this.isPresentingCombatEvents = true;
    this.showNextCombatMessage();
  }

  /** Every line shown here is a refusal: already out, fainted, nothing to heal. */
  private showPartyMessage(message: string): void {
    audioManager.play('denied');
    this.partyMessage = message;
    this.showCommands();
  }

  private persistActivePokemonHp(): void {
    // Everything the player has on the field, because a double battle has two
    // of them and the one that was not acting still took the weather.
    playerCombatants(this.state).forEach(persistCombatantToPokemon);
  }

  private refreshStatusLabels(): void {
    for (const side of ['player', 'enemy'] as const) {
      for (const ref of slotsOf(this.state, side)) {
        const combatant = unitAt(this.state, ref);
        this.plateFor(ref)?.statusText.setText(
          combatant
            ? (statusAbbreviation(combatant.primaryStatus, combatant.confusionTurns) ?? '')
            : '',
        );
      }
    }
  }

  /**
   * Whether anybody has to be sent in before the fight can go on, and into
   * which slot.
   *
   * In a single battle this is the whole party's last stand; in a double it is
   * one slot of two, and the other goes on fighting while it is answered - so
   * the battle is only lost when nothing is left to send into either.
   */
  private prepareForcedReplacement(): void {
    if (this.party.isAllFainted()) {
      return;
    }
    const empty = slotsOf(this.state, 'player').find((ref) => {
      const combatant = unitAt(this.state, ref);
      return combatant !== null && combatant.currentHp === 0;
    });
    if (!empty) {
      return;
    }
    const bench = this.party.pokemon.some(
      (pokemon) =>
        !pokemon.isFainted &&
        !playerCombatants(this.state).some((combatant) => combatant.pokemon === pokemon),
    );
    if (!bench) {
      return;
    }
    this.replacementSlot = empty.slot;
    this.state = { ...this.state, outcome: 'active' };
    this.forcedReplacement = true;
  }

  /** Redraws one slot's plate and sprite for whoever is standing in it now. */
  private refreshCombatant(ref: SlotRef): void {
    const combatant = unitAt(this.state, ref);
    if (!combatant) {
      return;
    }
    const plate = this.plateFor(ref);
    plate?.container.destroy();
    plate?.banner?.destroy();
    this.createStatusBox(ref, combatant);
    const spot = combatantSpot(ref.side, ref.slot, this.state.unitCount);
    const facing = ref.side === 'player' ? 'back' : 'front';
    this.spriteFor(ref)
      ?.setTexture(`pokemon-${facing}-${combatant.pokemon.base.dexId}`)
      .setPosition(spot.x, spot.y)
      .setAlpha(1);
    this.refreshStatusLabels();
  }

  private refreshPlayerCombatant(ref: SlotRef = slotRef('player', 0)): void {
    this.refreshCombatant(ref);
  }

  private refreshEnemyCombatant(ref: SlotRef = slotRef('enemy', 0)): void {
    this.refreshCombatant(ref);
  }

  /** Every enemy slot whose plate is drawn for somebody who has been replaced. */
  private refreshReplacedEnemies(): void {
    for (const ref of slotsOf(this.state, 'enemy')) {
      const combatant = unitAt(this.state, ref);
      if (combatant && this.displayed.get(plateKey(ref.side, ref.slot)) !== combatant.pokemon) {
        this.refreshEnemyCombatant(ref);
      }
    }
  }

  /**
   * Walks one plate's health bar to where the step says it should be.
   *
   * `damage` is signed: gear that pays HP back at the end of a turn is negative
   * damage, and it walks the same bar the other way rather than needing a second
   * animation. The critical-HP alarm only ever fires on a loss, and only for
   * one of the player's own.
   */
  private animateHpDelta(ref: SlotRef, damage: number): void {
    if (damage === 0) {
      return;
    }
    const key = plateKey(ref.side, ref.slot);
    const plate = this.plateFor(ref);
    const pokemon = this.displayed.get(key) ?? unitAt(this.state, ref)?.pokemon;
    if (!plate || !pokemon) {
      return;
    }
    const from = this.displayedHp.get(key) ?? pokemon.currentHp;
    const to = Math.min(pokemon.maxHp, Math.max(0, from - damage));
    this.displayedHp.set(key, to);
    if (
      damage > 0 &&
      ref.side === 'player' &&
      from > pokemon.maxHp * 0.2 &&
      to > 0 &&
      to <= pokemon.maxHp * 0.2
    ) {
      audioManager.play('lowHp');
    }
    if (from === to) {
      return;
    }
    this.tweens.addCounter({
      from,
      to,
      duration: 400,
      ease: 'Linear',
      onUpdate: (tween) => {
        // The bar walks on wall-clock time, and the plate under it can be torn
        // down and rebuilt while it is walking - a Pokemon that fell, and the
        // next one sent into the same slot. The new plate is drawn correct the
        // moment it is made, so a tween that outlived its own plate has nothing
        // left to say: without this it went on writing to a destroyed Text, and
        // a boss fight died on `drawImage of null` the first time anything was
        // knocked out.
        if (this.plateFor(ref) !== plate) {
          return;
        }
        const hp = Math.round(tween.getValue() ?? to);
        this.drawHpBar(plate.hpBar, plate.barX, plate.barY, hp / pokemon.maxHp, plate.barWidth);
        plate.hpText?.setText(`${hp}/${pokemon.maxHp}`);
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

    // The panel is holding a question about the Pokemon that is about to land.
    // Nothing advances until it is answered, exactly as nothing advances while
    // the move chooser is open.
    if (this.mode === 'about-to-use') {
      return;
    }

    // The refusal has been read; the question it raises is the panel's.
    if (this.pendingMakeRoom) {
      this.pendingMakeRoom = false;
      this.mode = 'make-room';
      this.selectedCommand = 0;
      this.makeRoomPage = 0;
      this.showCommands();
      return;
    }

    if (this.moveOffer) {
      this.openMoveOffer(this.moveOffer);
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
      this.refreshReplacedEnemies();
      // A two-turn move takes the next turn with it. Opening the command menu
      // here would offer a choice the engine is going to overrule, so the turn
      // is resolved straight away and narrated as what it is. In a double
      // battle that only holds while *every* slot is locked: one Pokemon
      // halfway through a Solar Beam does not take the other one's turn away.
      const locked = this.lockedChoices();
      if (locked.length > 0 && locked.length === this.choosingSlots().length) {
        this.useMove(locked);
        return;
      }
      this.mode = 'main';
      this.selectedCommand = 0;
      this.showCommands();
      return;
    }

    if (this.state.outcome === 'victory' && !this.victoryRewardsGranted) {
      this.victoryRewardsGranted = true;
      this.mode = 'events';
      this.showCombatEvents(
        [],
        this.trainer
          ? [
              {
                message: this.trainer.defeatText ?? `${this.trainer.name} was defeated!`,
                sound: 'victory',
              },
            ]
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

  /**
   * Asks which move to forget, then says what happened and carries on reading.
   * The fight is paused on the chooser: nothing else moves until it answers, and
   * it has no answer that loses a move the player did not pick.
   */
  private openMoveOffer(offer: { readonly pokemon: PokemonInstance; readonly move: MoveBase }): void {
    this.moveOffer = null;
    openMoveChooser(
      this,
      { pokemon: offer.pokemon, incoming: offer.move, canDefer: false },
      (choice) => {
        const forgetIndex = choice.kind === 'forget' ? choice.index : null;
        const result = offer.pokemon.resolvePendingMove(offer.move, forgetIndex);
        if (result?.forgotten) {
          audioManager.play('moveLearned');
        }
        const slot = playerSlotOf(this.state, offer.pokemon);
        if (slot) {
          // The moves menu reads the combatant's snapshot, so the new move has to
          // reach it or "learned" is followed by a menu that does not offer it.
          this.state = refreshPlayerAfterLevelUp(this.state, offer.pokemon.maxHp, slot.slot);
        }
        this.pendingCombatMessages.unshift({
          message: moveChoiceMessage(
            offer.pokemon.base.name,
            offer.move,
            result?.forgotten ?? null,
          ),
        });
        this.showNextCombatMessage();
      },
    );
  }

  private awardVictoryExperience(defeatedPokemon: PokemonInstance): StagedNote[] {
    const experience = experienceAwardForDefeat(defeatedPokemon.level);
    const messages: StagedNote[] = [];
    // Everyone the player has on the field, not just the lead: in a double
    // battle both of them are looking at a plate that has to keep up.
    const onField = slotsOf(this.state, 'player').flatMap((ref) => {
      const combatant = unitAt(this.state, ref);
      return combatant ? [{ ref, pokemon: combatant.pokemon, maxHpBefore: combatant.pokemon.maxHp }] : [];
    });
    const levelled: typeof onField = [];

    for (const pokemon of this.participatingPokemon) {
      const result = pokemon.gainExperience(experience);
      const standing = onField.find((entry) => entry.pokemon === pokemon);
      if (standing && result.levelsGained.length > 0) {
        levelled.push(standing);
      }
      // The species may already have changed under it, so the name every line
      // below is written with is read once, before any of them are said. A
      // Bulbasaur that levelled into an Ivysaur grew as a Bulbasaur and learns
      // its next move as an Ivysaur, and the evolution line in between is what
      // makes the change of name make sense.
      const grewAs = result.evolutions[0]?.from.name ?? pokemon.base.name;
      messages.push({
        message: `${grewAs.toUpperCase()} gained ${result.awarded} XP!`,
        sound: 'xpGain',
      });
      messages.push(
        ...result.levelsGained.map((level) => ({
          message: `${grewAs.toUpperCase()} grew to ${levelLabel(level)}!`,
          sound: 'levelUp' as const,
        })),
      );
      messages.push(
        ...result.evolutions.map((evolution) => ({
          message: `${evolution.from.name.toUpperCase()} evolved into ${evolution.to.name.toUpperCase()}!`,
          sound: 'evolved' as const,
          // The sprite, the name plate and the level plate are all rebuilt from
          // the combatant, and the combatant reads its species live - so the
          // one call is the whole change, and it is deliberately tied to this
          // line rather than to the moment the experience was awarded.
          onShow: () => {
            const slot = playerSlotOf(this.state, pokemon);
            if (slot) {
              this.refreshPlayerCombatant(slot);
            }
          },
        })),
      );
      messages.push(
        ...result.learnedMoves.map((move) => ({
          message: `${pokemon.base.name.toUpperCase()} learned ${move.name.toUpperCase()}!`,
          sound: 'moveLearned' as const,
        })),
      );
      // A full moveset never loses a move silently: the line announces it, and
      // the chooser opens when the line has been read (`resolveMoveOffer`).
      messages.push(
        ...result.movesToChoose.map((move) => ({
          message: `${pokemon.base.name.toUpperCase()} wants to learn ${move.name.toUpperCase()}, but already knows four moves.`,
          offerMove: { pokemon, move },
        })),
      );
    }

    for (const entry of levelled) {
      this.applyMidBattleLevelUp(entry.ref, entry.maxHpBefore);
    }

    return messages;
  }

  /**
   * Carries a level reached mid-battle into the battle the player is looking at.
   *
   * `BattleCombatant` is a snapshot taken when its Pokemon was sent out, so
   * without this the plate keeps the level it was painted with, the move menu
   * keeps the moves the Pokemon walked in with - so "SQUIRTLE learned WATER
   * GUN!" is followed by a menu that does not offer it - and the HP the raised
   * maximum grants is thrown away when the combatant's own count is written
   * back on the way out. A party member that levels on the bench needs none of
   * this: `replacePlayerPokemon` reads it live when it is sent out.
   *
   * Only a trainer battle with a second Pokemon reaches here with the fight
   * still running, which is why this went unseen: a wild battle ends on the
   * knockout that awarded the experience.
   */
  private applyMidBattleLevelUp(ref: SlotRef, previousMaxHp: number): void {
    const before = unitAt(this.state, ref);
    if (!before) {
      return;
    }
    const gainedHp = Math.max(0, before.pokemon.maxHp - previousMaxHp);
    this.state = refreshPlayerAfterLevelUp(this.state, previousMaxHp, ref.slot);
    const combatant = unitAt(this.state, ref);
    const plate = this.plateFor(ref);
    if (!combatant || !plate) {
      return;
    }
    const key = plateKey(ref.side, ref.slot);
    const { currentHp, pokemon } = combatant;
    // This turn's HP events have not been drawn yet and each one animates down
    // from `displayedHp`, so the gain has to move that starting point too or
    // the bar would settle a couple of points below the state it is showing.
    if (currentHp > 0) {
      this.displayedHp.set(key, Math.min(pokemon.maxHp, (this.displayedHp.get(key) ?? 0) + gainedHp));
    }
    const shown = this.displayedHp.get(key) ?? currentHp;
    plate.levelText.setText(levelLabel(pokemon.level));
    this.drawHpBar(plate.hpBar, plate.barX, plate.barY, shown / pokemon.maxHp, plate.barWidth);
    plate.hpText?.setText(`${shown}/${pokemon.maxHp}`);
  }

  private awardTrainerDefeatExperience(
    previousState: BattleState,
    events: readonly BattleEvent[],
  ): StagedNote[] {
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
    leadingMessages: readonly StagedNote[] = [],
    trailingMessages: readonly StagedNote[] = [],
  ): void {
    this.pendingCombatMessages = [
      ...leadingMessages.map(stagedNote),
      ...events.map((event) => ({ event, message: eventToMessage(event) })),
      ...trailingMessages.map(stagedNote),
    ];
    if (this.pendingCombatMessages.length === 0) {
      // Nothing to say still has to complete, or the fight waits on a line
      // that was never shown.
      this.dialog.showMessages([]);
      return;
    }
    this.isPresentingCombatEvents = true;
    this.showNextCombatMessage();
  }

  private showNextCombatMessage(): void {
    const upcoming = this.pendingCombatMessages[0];
    if (
      upcoming?.event?.type === 'enemy-sent-out' &&
      this.offerAboutToUseSwitch(upcoming.event.name)
    ) {
      return;
    }
    const next = this.pendingCombatMessages.shift();
    if (!next) {
      return;
    }
    if (next.event) {
      this.presentCombatEvent(next.event);
    }
    // Before the line, not after it: the player should be reading "IVYSAUR"
    // while looking at an Ivysaur, never at the Bulbasaur it stopped being.
    next.onShow?.();
    if (next.sound) {
      audioManager.play(next.sound);
    }
    this.moveOffer = next.offerMove ?? null;
    this.dialog.showMessage(next.message);
  }

  private presentCombatEvent(event: BattleEvent): void {
    const step = combatPresentationSteps([event])[0];
    if (!step) {
      return;
    }
    const cue = battleEventSound(event);
    if (cue?.at === 'line') {
      audioManager.play(cue.name);
    }
    if (event.type === 'caught') {
      const caught = this.spriteFor(slotRef('enemy', 0));
      this.cameras.main.flash(180, 255, 255, 255, false);
      if (caught) {
        this.tweens.add({
          targets: caught,
          scaleX: caught.scaleX * 0.7,
          scaleY: caught.scaleY * 0.7,
          alpha: 0,
          duration: 320,
          ease: 'Quad.in',
        });
      }
      return;
    }

    if (event.type === 'fainted') {
      const sprite = this.spriteFor(slotRef(event.user, event.slot ?? 0));
      if (sprite) {
        this.tweens.add({
          targets: sprite,
          y: sprite.y + 34,
          alpha: 0,
          duration: 500,
          ease: 'Quad.in',
        });
      }
      return;
    }

    if (event.type === 'enemy-sent-out') {
      this.refreshEnemyCombatant(slotRef('enemy', event.slot ?? 0));
      return;
    }

    // A move that names itself and nothing else - a spread move's opening line -
    // has no target to lunge at yet: each target's own `spread-damage` carries
    // the lunge, so the naming line is left to be read.
    if (event.type === 'used-move' && event.spread) {
      return;
    }

    if (event.type === 'used-move' || event.type === 'spread-damage') {
      const attacker = this.spriteFor(slotRef(step.actor ?? 'player', step.actorSlot));
      const target = step.target ? this.spriteFor(slotRef(step.target, step.targetSlot)) : undefined;
      if (!attacker) {
        return;
      }
      const direction = event.user === 'player' ? 16 : -16;
      this.tweens.add({
        targets: attacker,
        x: attacker.x + direction,
        yoyo: true,
        duration: 140,
        repeat: 1,
        onComplete: () => {
          if (cue?.at === 'impact') {
            audioManager.play(cue.name);
          }
          if (target) {
            target.setTintFill(0xffffff);
            this.tweens.add({
              targets: target,
              alpha: 0.35,
              yoyo: true,
              duration: 90,
              repeat: 1,
              onComplete: () => target.clearTint(),
            });
          }
          this.cameras.main.shake(60, 0.003);
          if (step.target) {
            this.animateHpDelta(slotRef(step.target, step.targetSlot), step.hpDelta);
          }
        },
      });
      return;
    }

    if (step.target) {
      this.animateHpDelta(slotRef(step.target, step.targetSlot), step.hpDelta);
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
      if (this.scene.manager.keys.base) {
        this.scene.start('base', { arrival: 'raid' });
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
      // Typed as the whole carriage, so a field the world packed and this
      // scene forgot to hand back is a compile error rather than a raid that
      // quietly loses its hunter.
      const carriage: RaidCarriage = {
        party: this.party,
        // The same bag object the raid walked in with, handed back explicitly:
        // an item drunk in this fight is gone from the supplies the overworld,
        // the extraction settlement and the stash all read.
        bag: this.bag,
        caughtPokemonStash: this.caughtPokemonStash,
        runSession: this.runSession,
        defeatedTrainerIds: [...this.defeatedTrainerIds],
        unclaimedBossGear: this.unclaimedBossGear,
        collectedLootIds: [...this.collectedLootIds],
        activatedPoiIds: [...this.activatedPoiIds],
        returnLocation: this.returnLocation,
        hunterState:
          this.trainer && this.state.outcome === 'victory' && this.hunterBattle && this.hunterState
            ? { ...this.hunterState, defeated: true }
            : this.hunterState,
      };
      this.scene.start('world', carriage);
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
    // What the raid was still carrying when it ended - the bag it deployed
    // with, spent down by this fight. The persisted save's bag was read here
    // once; that is the free-roam inventory and has nothing to do with the
    // raid, so a wipe report priced supplies the raid never carried.
    const carriedOut = this.bag.toJSON();
    // The pack is also what divides the loss: only a secured supply still in it
    // comes home, and only what is still in it was destroyed with the raid.
    const wipe = buildWipeSettlement(this.runSession.secureSlot.items ?? [], carriedOut);
    // A raid lost in a fight walked exactly as much ground as one that got
    // home, so its survey is written here too - and the map the record is
    // against is the raid's own, which the plan names.
    const raidMapId = this.runSession.plan?.insertion.mapId;
    if (raidMapId) {
      new SaveManager().recordRaidEnded(raidMapId, 'wiped', {
        width: WORLD_MAPS[raidMapId].width,
        walked: this.runSession.surveyed ?? [],
      });
    }
    // And how the pack was laid out, for the same reason and in the same
    // breath: a raid lost in a fight arranged its pack exactly as much as one
    // that got home, and a layout that came back only from the endings that
    // happen in the overworld would be a promise kept three times in four.
    new SaveManager().recordContainerArrangements(this.bag.arrangement);
    const saved = new SaveManager().applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      { ...this.runSession.stashSecureSlot, items: wipe.securedItems },
      // A secured Pokemon comes home in the state this battle left it in, which
      // after a lost raid is almost always fainted.
      deployedRaidCondition(this.runSession.broughtPokemonIds, snapshot),
      // The pack the party ran out in goes with the raid. It was never in the bag -
      // it is the bag - so nothing in the accounting above can name it, and the
      // secure container cannot protect it either.
      this.runSession.packItemId,
    );
    this.cameras.main.flash(220, 239, 68, 68, false);
    this.cameras.main.shake(180, 0.009);
    audioManager.play('wipe');
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
      lost: { pokemon: result.lostPokemon, items: wipe.destroyedItems },
      carriedOut,
      // The one that was out when the party ran out. The result screen's defeat
      // sequence names it, and it cannot be recovered afterwards: by then every
      // member of the party is at 0 HP and indistinguishable from every other.
      lastStand: this.state.player.pokemon,
      saved,
    });
    this.time.delayedCall(RUN_RESULT_DELAY_MS, () => {
      if (this.scene.manager.keys.extraction) {
        this.scene.start('extraction', { report });
        return;
      }
      this.scene.start(
        this.scene.manager.keys.base ? 'base' : 'title',
        this.scene.manager.keys.base ? { arrival: 'raid' } : undefined,
      );
    });
  }
}
