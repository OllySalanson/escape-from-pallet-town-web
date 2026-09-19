import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { SoundEffectName } from '../audio/soundEffects';
import {
  applyRecovery,
  beaconUnlockAtMs,
  builtUpgrades,
  checkBerth,
  checkPayment,
  DeploymentFlow,
  FAINTED_TREATMENT_NOTE,
  formatRecoveryClock,
  getOutfitterUpgrade,
  hasBeacon,
  needsRecovery,
  OUTFITTER_UPGRADES,
  outfitterOffers,
  paymentCandidates,
  pokemonNeedingRecovery,
  quoteRecovery,
  raidBagGridFor,
  raidClockAfterRecovery,
  recoveryCostMs,
  recoveryPriceShare,
  spendableSupply,
  buildDropInBriefing,
  gradeLine,
  placePicture,
  type DropInBriefing,
  type DropInContext,
  TRADER_BERTH_PRICE,
  traderBarterOffers,
  traderStanding,
  traderStandingPoints,
  traderStockOffers,
  treatmentOptions,
  treatWithItem,
  formatTraderStacks,
  nextTraderStanding,
  rationLeft,
  scripHeld,
  STANDING_PER_BOSS,
  STANDING_PER_CONTRACT,
  STANDING_PER_SCRIP,
  wardBedIds,
  wardTreatmentsPerRaid,
  berthSquares,
  type Deployment,
  type TraderCounter,
  type OutfitterOffer,
  type OutfitterUpgrade,
  type OutfitterVault,
  type RecoveryTerms,
  type TreatmentOption,
} from '../hub';
import {
  Bag,
  HELD_ITEM_DEFINITIONS,
  ITEM_DEFINITIONS,
  FOUND_ONLY_IDS,
  blocksFor,
  cargoCells,
  footprintOf,
  getHeldItem,
  gridCells,
  isFoundOnly,
  type ItemDefinition,
  type ItemId,
} from '../items';
import { DEFAULT_SECURE_PREFERENCE } from '../hub/secureAutofill';
import { cargoSquaresLabel, pokemonCargo } from '../pokemon/pokemonCargo';
import { PokemonParty, type PokemonBase } from '../pokemon';
import { activeRunManager } from '../run';
import { buildContractBoard } from '../hub/contractBoard';
import { RAID_DURATION_MS } from '../run/raidClock';
import { createActiveRunSession } from '../run/RunSession';
import {
  availableInsertionIds,
  FIRST_CONTRACT,
  generateRunPlan,
  isDropInPoint,
  RUN_INSERTIONS,
  type RunInsertionId,
} from '../run/runGeneration';
import {
  boardContractForMap,
  contractCarryIn,
  formatStacks,
  missingCarryIn,
  objectivesForContract,
  secureGrid,
  securePokemonLimit,
  type RaidContract,
} from '../objectives';
import { SaveManager, traderProgressOf, type RestoredGame } from '../save/SaveManager';
import {
  searchPokemon,
  sortPokemon,
  nextStashSort,
  STASH_SORT_HELP,
  STASH_SORT_LABELS,
  type StashSort,
} from '../hub/stashBrowser';
import {
  BOX_CAPACITY,
  MAX_BOX_NAME_LENGTH,
  getStarterSpecies,
  starterInConditionOf,
  type StarterSpeciesId,
  type Stash,
  type StashedPokemon,
} from '../stash';
import { iconMarkup, itemIcon, objectiveIcon } from '../ui/icons';
import { hunterThreatFor, hunterThreatLine, type HunterThreat } from '../world/hunterThreat';
import { getWorldMap, WORLD_MAP_NAMES, type WorldMapId } from '../worldMap';
import { MINIMAP_PALETTE, MINIMAP_TILE, type Minimap } from '../world/minimap';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { moveChoiceMessage } from '../ui/moveChooser';
import { MenuOverlay } from '../ui/MenuOverlay';
import { conditionLine } from '../ui/condition';
import {
  experienceBarFill,
  experienceLine,
  experienceProgress,
  formatExperience,
  moveSlotNote,
  moveSummary,
} from '../ui/pokemonSummary';
import {
  escapeAttribute,
  pixelCommitBar,
  pixelHpBar,
  pixelPortrait,
  pixelXpBar,
  pixelRail,
  pixelScreen,
  pixelGrid,
  pixelTag,
  pixelTypeBadge,
  pixelWindow,
  takeDownPixelStatus,
} from '../ui/pixelUi';
import { starterCards } from '../ui/starterPicker';

export interface HubSceneData {
  readonly savedGame?: RestoredGame;
}

/** Base screens outside preparation; the deploy route is owned by DeploymentFlow. */
type HubView = 'home' | 'stash' | 'summary' | 'deploy' | 'reselect' | 'outfitter' | 'trader';

export class HubScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private stash!: Stash;
  private savedGame!: RestoredGame;
  private flow!: DeploymentFlow;
  private overlay!: MenuOverlay;
  private view: HubView = 'home';
  /** Whose summary is on screen, while the summary view is the one showing. */
  private summaryPokemonId: string | undefined;
  private reselectStarterId: StarterSpeciesId = 'bulbasaur';
  /** A swap only runs from an explicit second click, so a misclick cannot delete a survivor. */
  private swapArmed = false;
  /** The upgrade being paid for, or undefined while the ladder is showing. */
  private outfitterUpgradeId: string | undefined;
  /** The Pokemon the player has named as payment, by stash id. */
  private outfitterPayment: string[] = [];
  /** A payment only runs from an explicit second click, exactly as a swap does. */
  private outfitterArmed = false;
  /**
   * Set once a raid has been committed to. The screen stays up and keeps its
   * cursor on `Enter the raid` for the length of the fade, so a second press of
   * the key that started the raid used to start it again and throw.
   */
  private deploying = false;
  /**
   * How the player is looking at their Pokemon: which box, in what order, and
   * for whom. It is not saved - it is where the cursor is, not what is owned.
   */
  private boxScope: number | 'all' = 0;
  private stashSort: StashSort = 'kept';
  private stashSearch = '';
  /** The one text field on screen, if any: naming a box or searching. */
  private boxEditing: 'rename' | 'find' | undefined;
  /** The Pokemon picked up to be put in another box, by stash id. */
  private boxMoving: string | undefined;
  private status = '';
  /** The one pending removal of the status line; see `setStatus()`. */
  private statusTimer: Phaser.Time.TimerEvent | undefined;

  public constructor() {
    super('hub');
  }

  /**
   * The stored save wins over any handed-in snapshot. Phaser reuses a scene's
   * previous start payload when a later `scene.start('hub')` passes none, so a
   * raid that banked a contract used to return to a hub still rendering the
   * snapshot captured at game start. Storage is written before every hand-off,
   * so the passed game is only a fallback for storage-less browsers.
   */
  public init(data: HubSceneData = {}): void {
    const loaded = this.saveManager.load() ?? data.savedGame;
    if (!loaded) {
      throw new Error('HubScene requires a saved game.');
    }

    this.applyLoadedGame(loaded);
  }

  private applyLoadedGame(loaded: RestoredGame): void {
    this.savedGame = loaded;
    this.stash = loaded.stash;
    // Nothing is pre-selected: the raid party is always something the player picked.
    this.flow = new DeploymentFlow(this.stash, this.unlockedInsertions[0]?.[0], {
      pokemon: securePokemonLimit(loaded.raidProgress.outfitterUpgrades),
      secureGrid: secureGrid(
        loaded.raidProgress.completedContracts,
        loaded.raidProgress.outfitterUpgrades,
        loaded.traderBerthPaid,
      ),
      bagGrid: raidBagGridFor(loaded.raidProgress.outfitterUpgrades),
    },
    // The container fills itself from what it held last raid, so a player
    // deploying again and again is not re-picking from scratch.
    loaded.raidProgress.securePreference ?? DEFAULT_SECURE_PREFERENCE);
    this.view = 'home';
    this.reselectStarterId = this.startingStarterId();
    this.swapArmed = false;
    this.outfitterUpgradeId = undefined;
    this.outfitterPayment = [];
    this.outfitterArmed = false;
    this.deploying = false;
    // A fresh look at a freshly loaded vault: nothing narrowed, nothing picked up.
    this.boxScope = 0;
    this.stashSort = 'kept';
    this.stashSearch = '';
    this.boxEditing = undefined;
    this.boxMoving = undefined;
    this.status = '';
    // The clock that owned it died with the last hub, so only the pointer is left.
    this.statusTimer = undefined;
  }

  public create(): void {
    this.cameras.main.fadeIn?.(180, 0, 0, 0);
    this.overlay = new MenuOverlay(this, 'hub-menu pixel-ui', (event) => this.handleKey(event));
    this.render();
    this.offerPendingMoves();
  }

  /**
   * A level-up that found four moves already known queues the new one on the
   * Pokemon instead of forgetting anything, and base is where the player is
   * around to answer - a raid that settles has nobody watching. Asked one at a
   * time; "decide later" leaves the rest until the next visit.
   */
  private offerPendingMoves(): void {
    const waiting = this.stashPokemon.find(({ pokemon }) => pokemon.pendingMoves.length > 0);
    if (!waiting) {
      return;
    }
    const move = waiting.pokemon.pendingMoves[0];
    openMoveChooser(this, { pokemon: waiting.pokemon, incoming: move, canDefer: true }, (choice) => {
      if (choice.kind === 'later') {
        return;
      }
      const result = waiting.pokemon.resolvePendingMove(
        move,
        choice.kind === 'forget' ? choice.index : null,
      );
      const said = moveChoiceMessage(waiting.pokemon.base.name, move, result?.forgotten ?? null);
      this.setStatus(
        this.saveManager.save({ ...this.savedGame, stash: this.stash })
          ? said
          : `${said} It could not be saved.`,
      );
      this.offerPendingMoves();
    });
  }

  private get stashPokemon(): readonly StashedPokemon[] {
    return this.stash.listPokemon();
  }

  /**
   * Every Pokemon at base in the order the player asked for and answering their
   * search - across all boxes, which is what the loadout and the Outfitter's
   * payment are drawn from. A Pokemon about to be spent or deployed is never
   * hidden by the box it is kept in.
   */
  private get findablePokemon(): readonly StashedPokemon[] {
    return sortPokemon(searchPokemon(this.stash.listPokemon(), this.stashSearch), this.stashSort);
  }

  /** The Pokemon the stash window lists: this box, or all of them while looking for one. */
  private get shownPokemon(): readonly StashedPokemon[] {
    const scope = this.boxScope === 'all' || this.stashSearch.trim() !== '' ? undefined : this.boxScope;
    const list = scope === undefined ? this.stash.listPokemon() : this.stash.listBoxPokemon(scope);
    return sortPokemon(searchPokemon(list, this.stashSearch), this.stashSort);
  }

  /** Where the stash window is looking, always a box that exists. */
  private get scopeBox(): number | 'all' {
    return this.boxScope === 'all' ? 'all' : Math.min(this.boxScope, this.stash.listBoxes().length - 1);
  }

  private get stashItems(): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter((item) => this.stash.itemCount(item.id) > 0);
  }

  private get firstContractActive(): boolean {
    return !this.savedGame.raidProgress.firstContractExtracted;
  }

  /**
   * The contract a raid inserting here would carry. A contract belongs to its
   * map, so the insertion list *is* the contract board: choosing where to drop
   * in is choosing which contract to take, and no separate acceptance step can
   * fall out of step with it.
   */
  private contractFor(insertionId: RunInsertionId): RaidContract | undefined {
    return boardContractForMap(RUN_INSERTIONS[insertionId].mapId, this.savedGame.raidProgress);
  }

  /**
   * What the party costs in hunter on the raid this insertion would start: the
   * loadout's own tier plus whatever the contract carried there adds. The final
   * check prints it and the deploy spends it, so both ask here.
   */
  private hunterThreatAt(insertionId: RunInsertionId, party: readonly StashedPokemon[]): HunterThreat {
    return hunterThreatFor(
      party.map((stored) => stored.pokemon),
      this.contractFor(insertionId)?.hunterPressure,
    );
  }

  /**
   * What the chosen contract asks you to pack, checked against what is actually
   * in the loadout. A delivery is decided here or not at all: the drop refuses
   * a player who arrives without the supplies, and the raid is spent by then.
   */
  private carryInNote(): string {
    const contract = this.contractFor(this.flow.insertionId);
    const required = contract ? contractCarryIn(contract) : [];
    if (required.length === 0) {
      return '';
    }
    const short = missingCarryIn(required, (itemId) => this.flow.itemQuantity(itemId));
    return short.length === 0
      ? `<p class="px-note px-wrap carry-note">${contract!.name}: ${formatStacks(required)} packed for the drop. They are spent when you hand them over.</p>`
      : `<p class="px-warning px-wrap carry-note">${contract!.name} needs ${formatStacks(required)} in your pack. Still short: ${formatStacks(short)}.</p>`;
  }

  /**
   * Unlocked entries, narrowed to the active contract's own area while one is
   * running, so a first raid can never be deployed somewhere its objective is
   * unreachable. Every unlocked insertion returns the moment it is banked.
   */
  private get unlockedInsertions(): readonly [RunInsertionId, (typeof RUN_INSERTIONS)[RunInsertionId]][] {
    const entries = Object.entries(RUN_INSERTIONS) as [
      RunInsertionId,
      (typeof RUN_INSERTIONS)[RunInsertionId],
    ][];
    // Unlocked by a contract or reached on foot: `availableInsertionIds` is the
    // one rule, so a drop-in point the player has stood on is offered here the
    // moment they are back at base.
    const available = availableInsertionIds(this.savedGame.raidProgress);
    return entries.filter(
      ([id, insertion]) =>
        available.includes(id) &&
        (!this.firstContractActive || insertion.mapId === FIRST_CONTRACT.mapId),
    );
  }

  /** Everyone at base who a recovery would actually change. */
  private get injuredPokemon(): readonly StashedPokemon[] {
    return pokemonNeedingRecovery(this.stash);
  }

  private get pendingRecoveryMs(): number {
    return this.savedGame.pendingRecoveryMs;
  }

  /** The clock the next raid starts with, once recovery is taken out of it. */
  private get raidClockMs(): number {
    return raidClockAfterRecovery(RAID_DURATION_MS, this.pendingRecoveryMs);
  }

  /** Every Outfitter upgrade standing at base, by id. */
  private get builtUpgradeIds(): readonly string[] {
    return this.savedGame.raidProgress.outfitterUpgrades;
  }

  /**
   * What this base charges for recovery: the bay's discount, and however many of
   * the ward's beds are still unused before the coming raid. Both are derived
   * from the upgrade list on every read, so the lobby cannot quote a price the
   * treatment does not charge.
   */
  private get recoveryTerms(): RecoveryTerms {
    return {
      priceShare: recoveryPriceShare(this.builtUpgradeIds),
      wardTreatments: Math.max(
        0,
        wardTreatmentsPerRaid(this.builtUpgradeIds) - this.savedGame.wardTreatmentsUsed,
      ),
    };
  }

  /** Whether the ward's free bed would go to this Pokemon if it were treated now. */
  private inWardBed(stored: StashedPokemon): boolean {
    return wardBedIds(this.injuredPokemon, this.recoveryTerms).has(stored.id);
  }

  /** What treating this one Pokemon at the bay costs right now. */
  private recoveryPriceMs(stored: StashedPokemon): number {
    return recoveryCostMs(stored.pokemon, this.recoveryTerms, this.inWardBed(stored));
  }

  /**
   * A recovery price as a tag says it - `Bay −0:30`, or `Ward free` when the
   * ward's bed would take this one. Short, because it shares a row with a name
   * and a health bar; the help bar below is where it is spelt out.
   */
  private recoveryPriceLabel(stored: StashedPokemon): string {
    const priceMs = this.recoveryPriceMs(stored);
    return `${this.inWardBed(stored) ? 'Ward' : 'Bay'} ${priceMs === 0 ? 'free' : `−${formatRecoveryClock(priceMs)}`}`;
  }

  /**
   * The price alone, for a stash row: beside a ten-letter name and its health
   * bar there is room for `−0:45` and not for the word in front of it.
   */
  private recoveryPriceTag(stored: StashedPokemon): string {
    const priceMs = this.recoveryPriceMs(stored);
    return priceMs === 0 ? 'Free' : `−${formatRecoveryClock(priceMs)}`;
  }

  /** The same price in a sentence, for the help bar of the control that pays it. */
  private recoveryHelp(stored: StashedPokemon): string {
    const priceMs = this.recoveryPriceMs(stored);
    const place = this.inWardBed(stored) ? 'Ward bed' : 'Recovery bay';
    return priceMs === 0
      ? `${place}: full restore, and it costs this raid nothing.`
      : `${place}: full restore for −${formatRecoveryClock(priceMs)} of raid time.`;
  }

  /**
   * Restores Pokemon at base and books the time to the next raid clock. The
   * scene's own stash is the one treated, so a half-built loadout keeps pointing
   * at the same Pokemon it did before, now healed.
   */
  private recover(ids: readonly string[]): void {
    const outcome = applyRecovery(this.stash, this.pendingRecoveryMs, ids, this.recoveryTerms);
    if (outcome.recoveredIds.length === 0) {
      this.refuse('Everyone there is already fit.');
      return;
    }

    audioManager.play('heal');
    this.savedGame = { ...this.savedGame, pendingRecoveryMs: outcome.pendingRecoveryMs };
    this.savedGame = {
      ...this.savedGame,
      pendingRecoveryMs: outcome.pendingRecoveryMs,
      wardTreatmentsUsed: this.savedGame.wardTreatmentsUsed + outcome.wardTreatmentsUsed,
    };
    const treated =
      outcome.recoveredIds.length === 1
        ? (this.stash.listPokemon().find((stored) => stored.id === outcome.recoveredIds[0])?.pokemon
            .base.name ?? 'Your Pokémon')
        : `${outcome.recoveredIds.length} Pokémon`;
    const cost =
      outcome.chargedMs === 0
        ? 'no extra raid time'
        : `${formatRecoveryClock(outcome.chargedMs)} of raid time`;
    this.setStatus(
      this.saveManager.save({ ...this.savedGame, stash: this.stash })
        ? `${treated} recovered for ${cost}. Next raid clock: ${formatRecoveryClock(this.raidClockMs)}.`
        : `${treated} recovered, but the recovery could not be saved.`,
    );
  }

  /**
   * Spends one medicine out of the stash on a Pokemon at base.
   *
   * The stash is the same vault the half-built loadout draws from, so the
   * loadout's own supply counts shrink with it and a deployed stack can never
   * outgrow what is actually held - see `DeploymentFlow.items`.
   */
  private treat(pokemonId: string, itemId: string): void {
    const result = treatWithItem(this.stash, pokemonId, itemId);
    if (!result.used) {
      this.refuse(result.message);
      return;
    }

    audioManager.play('heal');

    this.setStatus(
      this.saveManager.save({ ...this.savedGame, stash: this.stash })
        ? result.message
        : `${result.message} The treatment could not be saved.`,
    );
  }

  /**
   * Gives one piece of gear out of the stash to a stashed Pokemon.
   *
   * The stash owns the move in both directions (`Stash.giveHeldItem`), so the
   * piece is either in the supplies or on a Pokemon and never in both, and the
   * loadout's own supply counts shrink with it exactly as a treatment's do.
   */
  private giveGear(pokemonId: string, itemId: string): void {
    if (!this.stash.giveHeldItem(pokemonId, itemId)) {
      this.refuse('That gear is not at base any more.');
      return;
    }
    audioManager.play('select');
    const name = this.stashPokemon.find((stored) => stored.id === pokemonId)?.pokemon.base.name;
    const gear = this.itemName(itemId);
    this.setStatus(
      this.saveManager.save({ ...this.savedGame, stash: this.stash })
        ? `${name ?? 'Your Pokémon'} is holding the ${gear}. It rides into the raid, and a wipe takes it unless ${name ?? 'it'} is secured.`
        : `${name ?? 'Your Pokémon'} is holding the ${gear}, but it could not be saved.`,
    );
  }

  /** Takes a stashed Pokemon's gear back into the stash's supplies. */
  private takeGear(pokemonId: string): void {
    const name = this.stashPokemon.find((stored) => stored.id === pokemonId)?.pokemon.base.name;
    if (!this.stash.takeHeldItem(pokemonId)) {
      this.refuse('There is nothing to take.');
      return;
    }
    audioManager.play('cancel');
    this.setStatus(
      this.saveManager.save({ ...this.savedGame, stash: this.stash })
        ? `Took the gear back off ${name ?? 'your Pokémon'}. It stays at base.`
        : `Took the gear back off ${name ?? 'your Pokémon'}, but it could not be saved.`,
    );
  }

  /**
   * The gear strip: what this Pokemon carries, and what the stash could give it
   * instead.
   *
   * It sits under the Pokemon it acts on, as the care strip does, because gear
   * is a fact about that Pokemon rather than a pocket of its own - and because
   * what the player is really choosing is which Pokemon takes the piece into the
   * raid. Nothing is `disabled`: the cursor is how this screen explains itself.
   */
  private gearStrip(stored: StashedPokemon): string {
    const held = getHeldItem(stored.pokemon.heldItemId);
    const offers = HELD_ITEM_DEFINITIONS.filter(
      (item) => this.stash.itemCount(item.id) > 0 && item.id !== stored.pokemon.heldItemId,
    );
    const take = held
      // The chip says the action, because the row above it already says what is
      // held: two lines for one fact is one of them going stale. No glyph on it
      // either - the game's typeface has no cross, and a character it lacks is
      // drawn in whatever face the browser falls back to.
      ? `<button class="px-window px-chip" data-gear-take="${stored.id}" data-help="${escapeAttribute(`${held.displayName}: ${held.description} Press to take it back into storage.`)}">Take ${held.displayName}</button>`
      : '';
    const give = offers
      .map(
        (item) =>
          // The verb, for the same reason the take chip carries one: a chip that
          // is only a name reads as a label rather than something to press.
          `<button class="px-window px-chip" data-gear-give="${item.id}" data-gear-pokemon="${stored.id}" data-help="${escapeAttribute(`${item.displayName}: ${item.description} Lost with ${stored.pokemon.base.name} on a wipe.`)}">Give ${item.displayName} ×${this.stash.itemCount(item.id)}</button>`,
      )
      .join('');
    // The summary chip is always there, gear or no gear: it is the only way to
    // a Pokemon's experience and its moves, and a row whose actions came and
    // went with what it happened to be holding would hide that. Built by
    // `chip()`, as the boxes' own Move chip beside it is.
    const summary = this.chip(
      `data-summary="${stored.id}" data-shows="${stored.id}"`,
      `Read ${stored.pokemon.base.name}'s experience, stats and moves.`,
      'Summary',
    );
    return `<div class="care-strip"><div class="care-options">${summary}${take}${give}</div></div>`;
  }

  /** The lone Pokemon a swap would trade away, or undefined while a team remains. */
  private get sparePartner(): StashedPokemon | undefined {
    return this.stash.canSwapStarter() ? this.stashPokemon[0] : undefined;
  }

  /** Preselects the species already held so a swap is never armed by default. */
  private startingStarterId(): StarterSpeciesId {
    const heldId = this.stash.listPokemon()[0]?.pokemon.base.id;
    return heldId === 'charmander' || heldId === 'squirtle' ? heldId : 'bulbasaur';
  }

  private setView(view: HubView): void {
    // A status line answers something done on the screen it was raised on, so
    // it does not follow the player to another: the recovery bay's "recovered
    // for 0:50 of raid time" was still in the Outfitter's help bar. A caller
    // that changes screen *and* has something to say sets its status after.
    if (view !== this.view) {
      this.statusTimer?.remove();
      this.statusTimer = undefined;
      this.status = '';
    }
    this.view = view;
    if (view !== 'summary') {
      this.summaryPokemonId = undefined;
    }
    this.swapArmed = false;
    this.outfitterUpgradeId = undefined;
    this.outfitterPayment = [];
    this.outfitterArmed = false;
    if (view === 'reselect') {
      this.reselectStarterId = this.startingStarterId();
    }
  }

  private confirmSwap(): void {
    if (!this.sparePartner) {
      this.setView('stash');
      this.refuse('Swapping is only offered while one Pokemon remains at base.');
      return;
    }
    if (!this.saveManager.reselectStarter(this.reselectStarterId)) {
      this.setView('home');
      this.refuse('That swap could not be saved.');
      return;
    }

    const reloaded = this.saveManager.load();
    if (reloaded) {
      // Reloading rebuilds the deployment flow, so a swapped-away Pokemon can
      // never linger in a half-built loadout.
      this.applyLoadedGame(reloaded);
    }
    this.setView('stash');
    audioManager.play('confirm');
    this.setStatus(`${getStarterSpecies(this.reselectStarterId).name} is your new partner.`);
  }

  /** What a payment may touch in this save. The rules live in `../hub/outfitter`. */
  private get outfitterVault(): OutfitterVault {
    return {
      stash: this.stash,
      starterSpeciesId: this.savedGame.starterSpeciesId,
    };
  }

  private get payingFor(): OutfitterUpgrade | undefined {
    return this.outfitterUpgradeId === undefined
      ? undefined
      : getOutfitterUpgrade(this.outfitterUpgradeId);
  }

  /**
   * Opens the payment for a rung. A rung that cannot be paid for is still a
   * control - the cursor has to be able to reach it to read what it does - so
   * choosing one is answered with what it is waiting on rather than ignored.
   */
  private choosePayment(upgradeId: string): void {
    const offer = this.outfitterLadder.find((candidate) => candidate.upgrade.id === upgradeId);
    if (!offer || offer.state === 'built') {
      return;
    }
    if (!offer.affordable) {
      this.refuse(this.shortfallLine(offer));
      return;
    }
    this.outfitterUpgradeId = upgradeId;
    this.outfitterPayment = [];
    this.outfitterArmed = false;
    this.render();
  }

  /**
   * Names or un-names one Pokemon as payment. Nothing is ever chosen for the
   * player - not even when only one combination could pay - because what this
   * screen spends is not interchangeable, and any change disarms the
   * confirmation so the question asked is always about the Pokemon on screen.
   */
  private togglePayment(pokemonId: string): void {
    const upgrade = this.payingFor;
    if (!upgrade) {
      return;
    }
    const refusal = paymentCandidates(this.outfitterVault).find(
      ({ stored }) => stored.id === pokemonId,
    )?.refusal;
    if (refusal !== undefined) {
      this.refuse(`${refusal}.`);
      return;
    }
    this.outfitterArmed = false;
    if (this.outfitterPayment.includes(pokemonId)) {
      this.outfitterPayment = this.outfitterPayment.filter((id) => id !== pokemonId);
      this.render();
      return;
    }
    if (this.outfitterPayment.length >= upgrade.cost.pokemon) {
      this.refuse(`${upgrade.name} takes ${upgrade.cost.pokemon} Pokémon. Un-pick one first.`);
      return;
    }
    this.outfitterPayment = [...this.outfitterPayment, pokemonId];
    this.render();
  }

  private confirmPayment(): void {
    const upgrade = this.payingFor;
    if (!upgrade || !this.outfitterArmed) {
      return;
    }
    const released = this.stashPokemon
      .filter((stored) => this.outfitterPayment.includes(stored.id))
      .map((stored) => stored.pokemon.base.name);
    const result = this.saveManager.buildOutfitterUpgrade(upgrade.id, this.outfitterPayment);
    if (!result.ok) {
      this.outfitterArmed = false;
      this.refuse(result.message);
      return;
    }
    if (!result.saved) {
      this.outfitterArmed = false;
      this.refuse(`${upgrade.name} could not be saved, so nothing was spent.`);
      return;
    }

    const reloaded = this.saveManager.load();
    if (reloaded) {
      // Reloading rebuilds the deployment flow against the new vault and the new
      // secure slot, so a released Pokemon can never linger in a half-built loadout.
      this.applyLoadedGame(reloaded);
    }
    this.setView('outfitter');
    audioManager.play('confirm');
    this.setStatus(`${upgrade.name} built. ${formatNames(released)} released.`);
  }

  /**
   * Opens preparation. Coming from a contract row it is already pointed at that
   * contract's insertion - where you drop in is which contract you take, so the
   * board is allowed to make that one choice. It never picks a party.
   */
  private openDeployment(insertionId?: RunInsertionId): void {
    this.flow.restart();
    if (insertionId !== undefined && this.unlockedInsertions.some(([id]) => id === insertionId)) {
      this.flow.chooseInsertion(insertionId);
    }
    this.setView('deploy');
    this.render();
  }

  private leaveDeployment(): void {
    this.flow.restart();
    this.setView('home');
    this.render();
  }

  /** The only way into a raid: a plan the player walked through and confirmed. */
  private startRun(): void {
    if (this.deploying) {
      return;
    }
    let deployment: Deployment;
    try {
      deployment = this.flow.deploy();
    } catch {
      this.refuse('Confirm your loadout before deploying.');
      return;
    }

    this.deploying = true;
    audioManager.play('deploy');
    // Counted where it is committed to rather than where it ends: a raid
    // nobody came back from is still a raid you went on, and the difference
    // between the two numbers is what the drop-in screen reads back.
    this.saveManager.recordDeployment(RUN_INSERTIONS[deployment.insertionId].mapId);
    const items = deployment.items;
    activeRunManager.startRun(
      { party: deployment.party.map((stored) => stored.pokemon), items },
      // The base clock, less whatever recovery has already been booked against it.
      {
        mapId: RUN_INSERTIONS[deployment.insertionId].mapId,
        durationMs: this.raidClockMs,
        secureGrid: this.flow.secureGrid,
        securePokemonLimit: this.flow.securePokemonSlots,
      },
      deployment.secureSlot,
    );
    // Remembered on the way out rather than on the way home, because it is what
    // the player chose and a raid that goes badly chose it too.
    new SaveManager().recordSecurePreference(deployment.securePreference);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const plan = generateRunPlan(
      seed,
      undefined,
      deployment.insertionId,
      this.contractFor(deployment.insertionId),
      // The same derivation the final check printed, from the same party.
      this.hunterThreatAt(deployment.insertionId, deployment.party),
      // Which gates stand open and which bosses are gone are both this list.
      this.savedGame.raidProgress.defeatedBosses,
      // The beacon opens against the clock this raid actually deploys with, so
      // booked recovery shortens the wait for it along with everything else.
      hasBeacon(this.builtUpgradeIds)
        ? { beaconUnlockAtMs: beaconUnlockAtMs(this.raidClockMs) }
        : {},
    );
    const runSession = createActiveRunSession(
      activeRunManager,
      deployment.secureSlot,
      deployment.stashSecureSlot,
      deployment.party.map((stored) => stored.id),
      items,
      plan.contract ? objectivesForContract(plan.contract) : [],
      plan,
      this.builtUpgradeIds,
    );
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('world', {
        party: new PokemonParty(deployment.party.map((stored) => stored.pokemon)),
        // The pack goes into the raid at the size the loadout was packed
        // against, so what the grid refused at base it refuses in the field.
        bag: new Bag(
          Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity])),
          this.flow.bagGrid,
        ),
        runSession,
      });
    });
  }

  private goBack(): void {
    if (this.view === 'deploy' && this.flow.retreat()) {
      this.render();
      return;
    }
    // The summary and the swap are both reached from the stash, so backing out
    // of either returns there rather than dropping the player two screens out
    // to the base.
    if (this.view === 'summary') {
      this.setView('stash');
      this.render();
      return;
    }
    if (this.view === 'reselect') {
      this.setView('stash');
      this.render();
      return;
    }
    // Backing out of a payment returns to the ladder it was chosen from.
    if (this.view === 'outfitter' && this.outfitterUpgradeId !== undefined) {
      this.setView('outfitter');
      this.render();
      return;
    }
    this.leaveDeployment();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && (this.boxMoving || this.boxEditing)) {
      event.preventDefault();
      audioManager.play('cancel');
      this.boxMoving = undefined;
      this.boxEditing = undefined;
      this.render();
      return;
    }
    if (event.key === 'Escape' && this.view !== 'home') {
      event.preventDefault(); audioManager.play('cancel'); this.goBack(); return;
    }
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private get heading(): string {
    if (this.view === 'home') return 'Base';
    if (this.view === 'stash') return 'Your stash';
    if (this.view === 'summary') return 'Summary';
    if (this.view === 'reselect') return 'Swap your partner';
    if (this.view === 'outfitter') return this.payingFor ? `Build ${this.payingFor.name}` : 'The Outfitter';
    if (this.view === 'trader') return 'The Ferryman';
    if (this.flow.step === 'loadout') return 'Build your loadout';
    if (this.flow.step === 'dropin') return 'Choose your drop-in';
    return this.flow.step === 'secure' ? 'Secure slot' : 'Final check';
  }

  private get backLabel(): string {
    if (this.view === 'reselect') return 'Stash';
    if (this.view === 'summary') return 'Stash';
    if (this.view === 'outfitter' && this.payingFor) return 'Outfitter';
    if (this.view !== 'deploy') return 'Base';
    if (this.flow.step === 'confirm') return 'Drop-in';
    if (this.flow.step === 'dropin') return 'Loadout';
    if (this.flow.step === 'secure') {
      return this.flow.secureReturnStep === 'confirm' ? 'Final check' : 'Loadout';
    }
    return 'Base';
  }

  /** What the keys do, said once along the bottom of every screen. */
  private get hints(): string {
    return this.view === 'home'
      ? 'ARROWS move · ENTER choose'
      : 'ARROWS move · ENTER choose · ESC back';
  }

  private render(): void {
    const root = this.overlay.root;
    root.innerHTML = pixelScreen({
      // Said once, on the screen the player arrives at. Every other view is
      // reached from it and carries its own way back, so repeating the town on
      // all five of them only spent the one line of the screen that is short of
      // room - at the smallest stage the Outfitter's payment screen had a back
      // label, a place, a title and a count on 320 pixels.
      place: this.view === 'home' ? 'Pallet Town' : undefined,
      title: this.heading,
      back: this.view === 'home' ? undefined : { label: this.backLabel, attribute: 'data-back' },
      aside:
        this.view === 'deploy'
          ? this.progressRail()
          : this.view === 'reselect'
            ? undefined
            : // On the stash the counts are the two lists on screen, so the
              // aside carries the one fact the screen turns on instead - the
              // clock the recovery bay is spending. It was said by the Pokémon
              // window's own note and again by the bay's line under it.
              this.view === 'stash'
              ? `Next raid clock ${formatRecoveryClock(this.raidClockMs)}`
              // On the boat the one fact every deal turns on is the money, so
              // it is the title bar's aside rather than a line inside a pane
              // that scrolls away from the row being priced.
              : this.view === 'trader'
                ? `${scripHeld(this.stash)} scrip`
                // The summary is about one Pokemon, and its window heading
                // already names that Pokemon and its level. A count of the
                // whole stash beside it would be about something else.
                : this.view === 'summary'
                  ? undefined
                  : `${this.stashPokemon.length} Pokémon · ${this.stashItems.length} items`,
      body: this.content(),
      hints: this.hints,
      status: this.status || undefined,
    });
    const on = (selector: string, handler: (button: HTMLButtonElement) => void): void => {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = () => handler(button);
      });
    };
    const rerender = (change: () => void): void => {
      change();
      this.render();
    };
    on('[data-back]', () => this.goBack());
    on('[data-view]', (button) => rerender(() => this.setView(button.dataset.view as HubView)));
    on('[data-starter]', (button) =>
      rerender(() => {
        this.reselectStarterId = button.dataset.starter as StarterSpeciesId;
        this.swapArmed = false;
      }),
    );
    on('[data-box-step]', (button) => this.stepBox(Number(button.dataset.boxStep)));
    on('[data-box-sort]', () => rerender(() => { this.stashSort = nextStashSort(this.stashSort); }));
    on('[data-box-find]', () => rerender(() => { this.boxEditing = 'find'; }));
    on('[data-box-clear]', () => rerender(() => { this.stashSearch = ''; }));
    on('[data-box-rename]', () => rerender(() => { this.boxEditing = 'rename'; }));
    on('[data-box-new]', () => this.addBoxAndShow());
    on('[data-box-delete]', () => this.deleteBox());
    on('[data-box-move]', (button) =>
      this.boxMoving === button.dataset.boxMove
        ? rerender(() => { this.boxMoving = undefined; })
        : this.pickUp(button.dataset.boxMove!),
    );
    on('[data-box-drop]', (button) => this.putDown(button.dataset.boxDrop!));
    on('[data-box-cancel]', () => rerender(() => { this.boxEditing = undefined; this.boxMoving = undefined; }));
    this.wireBoxForm(root);
    on('[data-swap-arm]', () => rerender(() => { this.swapArmed = true; }));
    on('[data-swap-cancel]', () => rerender(() => { this.swapArmed = false; }));
    on('[data-swap-confirm]', () => this.confirmSwap());
    on('[data-outfit]', (button) => this.choosePayment(button.dataset.outfit!));
    on('[data-built]', (button) =>
      this.setStatus(`${getOutfitterUpgrade(button.dataset.built!)?.name ?? 'That upgrade'} already stands at base.`),
    );
    on('[data-pay-pokemon]', (button) => this.togglePayment(button.dataset.payPokemon!));
    on('[data-pay-arm]', () => rerender(() => { this.outfitterArmed = true; }));
    on('[data-pay-cancel]', () => rerender(() => { this.outfitterArmed = false; }));
    on('[data-pay-confirm]', () => this.confirmPayment());
    on('[data-buy]', (button) => this.dealAtCounter(() => this.saveManager.buyTraderStock(button.dataset.buy!)));
    on('[data-barter]', (button) => this.dealAtCounter(() => this.saveManager.takeTraderBarter(button.dataset.barter!)));
    on('[data-berth]', () => this.dealAtCounter(() => this.saveManager.buyTraderBerth()));
    on('[data-refused]', (button) => this.setStatus(button.dataset.refused));
    on('[data-deploy-flow]', () => this.openDeployment());
    on('[data-contract]', (button) => this.openDeployment(button.dataset.contract as RunInsertionId));
    on('[data-recover]', (button) => this.recover([button.dataset.recover!]));
    on('[data-recover-all]', () => this.recover(this.injuredPokemon.map((stored) => stored.id)));
    on('[data-supply]', (button) => this.setStatus(button.dataset.help));
    on('[data-summary]', (button) =>
      rerender(() => {
        this.setView('summary');
        this.summaryPokemonId = button.dataset.summary;
      }),
    );
    on('[data-fit]', (button) => {
      const name = this.stashPokemon.find((stored) => stored.id === button.dataset.fit)?.pokemon.base.name;
      this.setStatus(`${name ?? 'That Pokémon'} is fit. There is nothing to recover.`);
    });
    on('[data-pokemon]', (button) => this.answer(this.flow.togglePokemon(button.dataset.pokemon!), 'select'));
    on('[data-treat-item]', (button) => this.treat(button.dataset.treatPokemon!, button.dataset.treatItem!));
    on('[data-gear-give]', (button) => this.giveGear(button.dataset.gearPokemon!, button.dataset.gearGive!));
    on('[data-gear-take]', (button) => this.takeGear(button.dataset.gearTake!));
    on('[data-item]', (button) => {
      const refusal = this.flow.adjustItem(button.dataset.item as ItemId, Number(button.dataset.amount));
      if (refusal) {
        this.answer(refusal, 'select');
        return;
      }
      rerender(() => undefined);
    });
    on('[data-secure-pokemon]', (button) => {
      // It refuses by the squares now, so the message is the whole point of the
      // press: an Ivysaur that will not go into a 2x2 container says why, on
      // the same status line every other refusal on this screen uses.
      const refusal = this.flow.toggleSecurePokemon(button.dataset.securePokemon!);
      if (refusal) {
        this.answer(refusal, 'select');
        return;
      }
      rerender(() => undefined);
    });
    on('[data-secure-item]', (button) => {
      const refusal = this.flow.adjustSecureItem(
        button.dataset.secureItem as ItemId,
        Number(button.dataset.secureAmount),
      );
      if (refusal) {
        this.answer(refusal, 'select');
        return;
      }
      rerender(() => undefined);
    });
    on('[data-insertion]', (button) =>
      rerender(() => this.flow.chooseInsertion(button.dataset.insertion as RunInsertionId)),
    );
    on('[data-secure-slot]', () => rerender(() => this.flow.openSecureSlot()));
    on('[data-advance]', () => this.answer(this.flow.advance(), 'confirm'));
    on('[data-start]', () => this.startRun());
    this.paintMinimaps(root);
    // The cursor starts on what the screen is for, never on the way out of it.
    this.overlay.refocus('.px-field', '[data-cursor-start]', '.loadout-entry .px-row', '.px-body button:not([disabled])', 'button');
  }

  /**
   * Inks every bird's-eye map on the screen, after the markup is in the DOM.
   *
   * The picture is a grid of characters (`world/minimap.ts`) and the palette
   * says what ink each one is, so this is the only part of it that touches a
   * browser: one source pixel a tile, written straight into an ImageData. It is
   * done here rather than in the markup because four thousand `<i>` elements is
   * not a thumbnail, and as a canvas the whole map is one element the stylesheet
   * scales by a whole number with `image-rendering: pixelated`.
   */
  private paintMinimaps(root: HTMLElement): void {
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-minimap]').forEach((canvas) => {
      const insertionId = canvas.dataset.minimap as RunInsertionId;
      if (!(insertionId in RUN_INSERTIONS)) {
        return;
      }
      const picture = placePicture(insertionId, this.dropInContext(insertionId));
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      const image = context.createImageData(picture.width, picture.height);
      for (let y = 0; y < picture.height; y += 1) {
        for (let x = 0; x < picture.width; x += 1) {
          const ink = MINIMAP_PALETTE[picture.rows[y][x]] ?? '#000000';
          const at = (y * picture.width + x) * 4;
          image.data[at] = Number.parseInt(ink.slice(1, 3), 16);
          image.data[at + 1] = Number.parseInt(ink.slice(3, 5), 16);
          image.data[at + 2] = Number.parseInt(ink.slice(5, 7), 16);
          image.data[at + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
    });
  }

  /**
   * Shows preparation as a route with a raid at the end of it. The secure slot
   * is a detour rather than a step, so it keeps the rail on the step it was
   * opened from.
   */
  private progressRail(): string {
    const at = this.flow.step === 'secure' ? this.flow.secureReturnStep : this.flow.step;
    return pixelRail(
      ['Kit', 'Drop-in', 'Check', 'Raid'],
      at === 'confirm' ? 3 : at === 'dropin' ? 2 : 1,
    );
  }

  private content(): string {
    if (this.view === 'home') return this.homeView();
    if (this.view === 'stash') return this.stashView();
    if (this.view === 'summary') return this.summaryView();
    if (this.view === 'reselect') return this.reselectView();
    if (this.view === 'outfitter') return this.payingFor ? this.paymentView(this.payingFor) : this.outfitterView();
    if (this.view === 'trader') return this.traderView();
    if (this.flow.step === 'loadout') return this.loadoutView();
    if (this.flow.step === 'dropin') return this.dropInView();
    return this.flow.step === 'secure' ? this.secureView() : this.confirmView();
  }

  /**
   * The base screen leads with the raid it is sending you on: what to do next,
   * then what is outstanding. Nothing here is a consolation prize - the swap
   * offer lives in the stash, beside the Pokemon it would trade away, because
   * on a fresh save it is the loudest panel on the screen three seconds after
   * the player chose that partner, and it is what pushed the lobby past the
   * frame and put a browser scrollbar down the side of the game.
   */
  private homeView(): string {
    const hurt = this.injuredPokemon.length;
    const deploy = `<button class="px-window px-card px-tone-primary" data-deploy-flow data-cursor-start data-help="Build a loadout, check what it risks, then drop in."><strong>Start a raid</strong><p>Choose who and what you risk, and where you drop in.</p></button>`;
    // Anyone hurt is said here and fixed in the stash, beside the Pokemon it is
    // about: the bill used to be a panel of its own on this screen, and with two
    // contracts open it left the board it sat above a single line tall.
    // Short, because three cards share the row: the help bar has the sentence.
    // The swap offer is one, and on a card a third of the screen wide it was a
    // fifth red line - the loudest thing on the base screen, for its
    // second-most important panel. The stash puts the offer under the Pokemon
    // it is about; this card only has to say there is something to do.
    const swap = this.sparePartner ? ' Your last partner can be swapped here.' : '';
    const stashLead = hurt
      ? `<p class="px-warning">${hurt === 1 ? '1 Pokémon' : `${hurt} Pokémon`} came home hurt. Treat them here.</p>`
      : '<p>What is secured at base.</p>';
    const stash = `<button class="px-window px-card" data-view="stash" data-help="Everything secured at base, and the recovery bay.${swap}"><strong>Stash</strong>${stashLead}</button>`;
    return `<main class="px-body hub-home"><section class="hub-actions">${deploy}${stash}${this.outfitterCard()}${this.traderCard()}</section>${this.contractBoard()}</main>`;
  }

  /**
   * The contract board: every contract on offer, what it asks and what it pays.
   *
   * Each row names its insertion because taking a contract is choosing where to
   * drop in - so the row is that choice: it opens preparation already pointed at
   * its own insertion. It also names what has to be packed, because a delivery
   * decided at the loadout screen is decided too late once the raid has started.
   */
  private contractBoard(): string {
    // Worded in `contractBoard.ts`, so the authored chain and the standing board
    // that follows it are one list in one voice, testable without the lobby.
    const board = buildContractBoard(this.savedGame.raidProgress);
    if (board.rows.length === 0) {
      return pixelWindow(
        '<p class="px-empty">Raids from here are for supplies, Pokémon and whatever the maps still hold.</p>',
        { className: 'objectives-panel', heading: 'Contract board', note: 'Every contract is banked' },
      );
    }
    const rows = board.rows
      .map((row) => {
        const insertion = this.insertionFor(row.mapId);
        const place = insertion?.[1].label ?? WORLD_MAP_NAMES[row.mapId];
        const wiring = insertion
          ? `data-contract="${insertion[0]}" data-shows="${row.contractId}" data-help="Prepare a raid that drops in at ${escapeAttribute(place)}."`
          : 'disabled';
        // A raised contract says so on the row itself: the detail under the list
        // only shows the row in hand, and the hunter is what is being chosen between.
        const raised = row.hunterPressure > 0 ? pixelTag(`Hunter +${row.hunterPressure}`, 'risk') : '';
        return `<button class="px-row has-icon px-tall px-contract" ${wiring}${row.hunterPressure > 0 ? ` data-hunter-pressure="${row.hunterPressure}"` : ''}>${objectiveIcon('Contract')}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${row.name}</strong><small>${place}</small></span><span class="px-wrap">${row.description}.</span></span>${raised}</button>`;
      })
      .join('');
    const details = board.rows
      .map(
        (row, index) =>
          `<div class="px-detail" data-shown-by="${row.contractId}"${index === 0 ? '' : ' hidden'}>${row.asks ? `<span class="px-wrap px-warning">${row.asks}.</span>` : ''}<span class="px-wrap"><small>Reward</small> ${row.reward}</span></div>`,
      )
      .join('');
    return pixelWindow(`<div class="px-list px-scroll">${rows}</div>${details}`, {
      className: 'objectives-panel',
      heading: board.heading,
      note: board.note,
    });
  }

  /** The unlocked insertion a contract is taken from, if the player can reach it yet. */
  private insertionFor(
    mapId: WorldMapId,
  ): readonly [RunInsertionId, (typeof RUN_INSERTIONS)[RunInsertionId]] | undefined {
    return this.unlockedInsertions.find(([, insertion]) => insertion.mapId === mapId);
  }

  /**
   * The recovery bay's bill, along the bottom of the stash. It only appears when
   * there is something to say - somebody hurt, or time already booked - so a fit
   * player's stash is exactly the stash they had before. It carries the clock
   * the next raid will start with and the one action that settles everyone at
   * once; treating one Pokemon is that Pokemon's own row, above it.
   */
  private recoveryPanel(): string {
    const injured = this.injuredPokemon;
    const pending = this.pendingRecoveryMs;
    if (injured.length === 0 && pending === 0) {
      return '';
    }
    const quotedMs = quoteRecovery(this.stash, pending, injured.map((stored) => stored.id), this.recoveryTerms);
    // The cap can make treating everyone cheaper than the rows add up to, so say so.
    const listedMs = injured.reduce((total, stored) => total + this.recoveryPriceMs(stored), 0);
    const lead = injured.length === 0 ? 'everyone is fit' : `${injured.length} hurt`;
    // The title bar carries the clock the next raid starts with. This line is
    // only for what that number does not show - the time already booked out of
    // it - so a fit, unbooked stash repeats nothing.
    const clock =
      pending === 0
        ? ''
        : `${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(pending)} already booked`;
    const cap =
      listedMs > quotedMs
        ? `<small class="px-wrap">Capped: everyone for ${formatRecoveryClock(quotedMs)}, not the ${formatRecoveryClock(listedMs)} they list for one by one.</small>`
        : '';
    const action =
      injured.length === 0
        ? ''
        : `<button class="px-window px-button is-primary" data-recover-all data-help="Full HP, status cleared. Paid in raid time, never supplies.">Recover ${injured.length === 1 ? 'them' : `all ${injured.length}`} · ${quotedMs === 0 ? 'free' : `−${formatRecoveryClock(quotedMs)}`}</button>`;
    return pixelCommitBar({
      className: 'px-tone-care recovery-panel',
      title: `Recovery bay · ${lead}`,
      lines: [clock ? `<small class="px-wrap">${clock}</small>` : '', cap],
      actions: action,
    });
  }

  /** One line of condition, so "fainted" is never hidden behind an HP number. */
  private conditionLine(stored: StashedPokemon): string {
    return conditionLine(stored.pokemon);
  }

  /**
   * Name, health bar and state on one line; the condition in words under it,
   * and the gear it is carrying on the end of that.
   *
   * The gear is said here rather than only in the stash, because this one line
   * is every list a Pokemon appears in at base - the stash, the loadout, the
   * secure slot and the final check - and what a Pokemon takes into the raid is
   * exactly the thing the last two of those are asking about.
   */
  private pokemonRowBody(stored: StashedPokemon, tag: string, boxName?: string): string {
    const { pokemon } = stored;
    const held = getHeldItem(pokemon.heldItemId);
    return `<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${pokemon.base.name}</strong>${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}</span><small>${this.conditionLine(stored)}${held ? ` \u00b7 holding ${held.displayName}` : ''}${boxName ? ` \u00b7 ${escapeAttribute(boxName)}` : ''}</small></span>${tag}`;
  }

  /**
   * The treatment surface. It only appears on a Pokemon a raid actually hurt,
   * and it offers both prices side by side before either is paid: one medicine
   * out of the stash, or a full restore at the recovery bay for raid time. What
   * each would do is in the help bar the moment the cursor is on it, and a
   * medicine that would do nothing can still be pointed at to be told why - a
   * player should never have to spend a Potion to find out what it does.
   */
  private careStrip(stored: StashedPokemon): string {
    const { pokemon } = stored;
    if (!needsRecovery(pokemon)) {
      return '';
    }

    const options = treatmentOptions(this.stash, pokemon);
    const medicine = options.length
      ? options.map((option) => this.careOption(stored.id, option)).join('')
      : '<span class="px-note">No medicine at base.</span>';
    const bay = `<button class="px-window px-chip" data-recover="${stored.id}" data-help="${this.recoveryHelp(stored)}">${this.recoveryPriceLabel(stored)}</button>`;
    return `<div class="care-strip">${pokemon.isFainted ? `<p class="px-warning">${FAINTED_TREATMENT_NOTE}</p>` : ''}<div class="care-options">${medicine}${bay}</div></div>`;
  }

  private careOption(pokemonId: string, option: TreatmentOption): string {
    // Not `disabled`: a disabled control cannot take the cursor, and the cursor
    // is how this screen says why a medicine would do nothing.
    return `<button class="px-window px-chip" data-treat-pokemon="${pokemonId}" data-treat-item="${option.itemId}" data-help="${escapeAttribute(`${option.displayName}: ${option.effect}.`)}"${option.usable ? '' : ' aria-disabled="true"'}>${option.displayName} ×${option.held}</button>`;
  }

  private saveStash(said: string, failed: string): void {
    this.setStatus(this.saveManager.save({ ...this.savedGame, stash: this.stash }) ? said : failed);
  }

  private chip(attributes: string, help: string, label: string, disabled = false): string {
    return `<button class="px-window px-chip" ${attributes} data-help="${escapeAttribute(help)}"${disabled ? ' aria-disabled="true"' : ''}>${label}</button>`;
  }

  /**
   * The strip that leads every list of Pokemon at base: where you are looking
   * (the stash only), the order, and a search. It is sticky at the top of its
   * own scroll pane, so however long the list is the way to narrow it is on
   * screen. A field replaces it while one is being typed into, and picking a
   * Pokemon up replaces it with the boxes it could go to.
   */
  private browseBar(inStash: boolean): string {
    const boxes = this.stash.listBoxes();
    if (this.boxEditing) {
      const renaming = this.boxEditing === 'rename';
      const scope = this.scopeBox;
      const value = renaming && scope !== 'all' ? boxes[scope].name : this.stashSearch;
      return `<form class="box-bar box-form" data-box-form="${this.boxEditing}"><input class="px-window px-field" name="text" value="${escapeAttribute(value)}" maxlength="${renaming ? MAX_BOX_NAME_LENGTH : 16}" autocomplete="off" spellcheck="false" aria-label="${renaming ? 'Box name' : 'Find a Pokémon'}" placeholder="${renaming ? 'Box name' : 'A name, e.g. pika'}" /><button type="submit" class="px-window px-chip" data-help="${renaming ? 'Keep this name.' : 'Show only Pokémon whose name begins with this. Empty shows everyone.'}">${renaming ? 'Save' : 'Find'}</button><button type="button" class="px-window px-chip" data-box-cancel data-help="Leave it as it was.">Cancel</button></form>`;
    }
    const moving = this.boxMoving ? this.stash.listPokemon().find((entry) => entry.id === this.boxMoving) : undefined;
    if (inStash && moving) {
      const from = this.stash.boxIndexOf(moving.id);
      const destinations = boxes
        .map((box, index) => {
          const here = index === from;
          const full = !this.stash.boxHasRoom(index);
          return this.chip(
            `data-box-drop="${index}"`,
            here
              ? `${moving.pokemon.base.name} is already in ${box.name}.`
              : full
                ? `${box.name} is full (${BOX_CAPACITY}).`
                : `Put ${moving.pokemon.base.name} in ${box.name}, which holds ${box.pokemonIds.length} of ${BOX_CAPACITY}.`,
            box.name,
            here || full,
          );
        })
        .join('');
      return `<div class="box-bar"><div class="box-line"><span class="box-title">Put ${moving.pokemon.base.name} in</span>${this.chip('data-box-cancel', 'Leave it where it is.', 'Cancel')}</div><div class="box-line">${destinations}${this.chip('data-box-drop="new"', `A new empty box, and ${moving.pokemon.base.name} goes in it.`, 'New box')}</div></div>`;
    }
    const sort = this.chip(
      'data-box-sort',
      `Ordered: ${STASH_SORT_LABELS[this.stashSort]}. ${STASH_SORT_HELP[this.stashSort]} Press for the next order.`,
      `Sort: ${STASH_SORT_LABELS[this.stashSort]}`,
    );
    const searching = this.stashSearch.trim() !== '';
    const find = this.chip(
      'data-box-find',
      searching ? 'Change what you are looking for.' : 'Find a Pokémon by name, in every box.',
      searching ? `Find: ${escapeAttribute(this.stashSearch.trim())}` : 'Find',
    );
    const clear = searching ? this.chip('data-box-clear', 'Show everyone again.', 'Clear') : '';
    if (!inStash) {
      return `<div class="box-bar"><div class="box-line">${sort}${find}${clear}</div></div>`;
    }
    const scope = this.scopeBox;
    const box = scope === 'all' ? undefined : boxes[scope];
    const label = searching
      ? `Found \u00b7 ${this.shownPokemon.length}`
      : box
        ? `${box.name} \u00b7 ${box.pokemonIds.length}/${BOX_CAPACITY}`
        : `All boxes \u00b7 ${this.stashPokemon.length}`;
    if (searching) {
      // Looking for one across every box: the boxes themselves are not the
      // question, so their controls give way to the ones that narrow it.
      return `<div class="box-bar"><div class="box-line"><span class="box-title">${escapeAttribute(label)}</span></div><div class="box-line">${sort}${find}${clear}</div></div>`;
    }
    return `<div class="box-bar"><div class="box-line">${this.chip('data-box-step="-1"', 'The box before this one.', 'Prev')}<span class="box-title">${escapeAttribute(label)}</span>${this.chip('data-box-step="1"', 'The next box. After the last is every box at once.', 'Next')}</div><div class="box-line">${sort}${find}</div></div>`;
  }

  /**
   * Naming, adding and taking away boxes. Rare next to finding and moving, so it
   * scrolls with the list instead of holding a place on the strip that does not
   * scroll - at the smallest stage that strip is what the list is short of.
   */
  private boxManage(): string {
    const scope = this.scopeBox;
    if (this.boxMoving || this.boxEditing || this.stashSearch.trim() !== '') {
      return '';
    }
    const boxes = this.stash.listBoxes();
    const box = scope === 'all' ? undefined : boxes[scope];
    const rename = box ? this.chip('data-box-rename', `Give ${box.name} another name.`, 'Rename') : '';
    const remove =
      box && box.pokemonIds.length === 0 && boxes.length > 1
        ? this.chip('data-box-delete', `${box.name} is empty. Take it away.`, 'Delete')
        : '';
    return `<div class="box-line box-manage">${rename}${this.chip('data-box-new', 'Add an empty box on the end.', 'New box')}${remove}</div>`;
  }

  /** Prev and Next walk the boxes and then a last stop that is all of them. */
  private stepBox(direction: number): void {
    const stops = this.stash.listBoxes().length + 1;
    const at = this.scopeBox === 'all' ? stops - 1 : this.scopeBox;
    const next = (at + direction + stops) % stops;
    this.boxScope = next === stops - 1 ? 'all' : next;
    this.render();
  }

  private pickUp(pokemonId: string): void {
    this.boxMoving = pokemonId;
    this.boxEditing = undefined;
    audioManager.play('select');
    this.render();
  }

  private putDown(destination: string): void {
    const id = this.boxMoving;
    const stored = this.stash.listPokemon().find((entry) => entry.id === id);
    if (!id || !stored) {
      return;
    }
    const index = destination === 'new' ? this.stash.addBox() : Number(destination);
    if (!this.stash.movePokemon(id, index)) {
      this.refuse(`${this.stash.listBoxes()[index]?.name ?? 'That box'} cannot take ${stored.pokemon.base.name}.`);
      return;
    }
    this.boxMoving = undefined;
    audioManager.play('confirm');
    const name = this.stash.listBoxes()[index].name;
    this.saveStash(
      `${stored.pokemon.base.name} is in ${name}.`,
      `${stored.pokemon.base.name} is in ${name}, but it could not be saved.`,
    );
  }

  private addBoxAndShow(): void {
    this.boxScope = this.stash.addBox();
    audioManager.play('confirm');
    this.saveStash(
      `${this.stash.listBoxes()[this.boxScope].name} added.`,
      'A box was added, but it could not be saved.',
    );
  }

  private deleteBox(): void {
    const scope = this.scopeBox;
    if (scope === 'all') {
      return;
    }
    const name = this.stash.listBoxes()[scope]?.name ?? 'That box';
    if (!this.stash.removeBox(scope)) {
      this.refuse(`${name} is not empty, or is the last box.`);
      return;
    }
    this.boxScope = Math.max(0, scope - 1);
    audioManager.play('cancel');
    this.saveStash(`${name} taken away.`, `${name} was taken away, but it could not be saved.`);
  }

  private submitBoxForm(text: string): void {
    const editing = this.boxEditing;
    this.boxEditing = undefined;
    if (editing === 'find') {
      this.stashSearch = text.trim();
      audioManager.play('select');
      this.render();
      return;
    }
    const scope = this.scopeBox;
    if (scope === 'all') {
      this.render();
      return;
    }
    if (!this.stash.renameBox(scope, text)) {
      this.refuse('That name is empty or another box already has it.');
      return;
    }
    audioManager.play('confirm');
    this.saveStash(
      `Renamed to ${this.stash.listBoxes()[scope].name}.`,
      'Renamed, but it could not be saved.',
    );
  }

  /** Puts a text field's own keys back where the keyboard owner left them. */
  private wireBoxForm(root: HTMLElement): void {
    const form = root.querySelector<HTMLFormElement>('[data-box-form]');
    const field = form?.querySelector<HTMLInputElement>('.px-field');
    if (!form || !field) {
      return;
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      this.submitBoxForm(field.value);
    };
    // Key *up* is the one thing the overlay keyboard lets through to a field, so
    // this is where a field hands the cursor back: Escape leaves it, and the
    // arrows step off it to the controls around it.
    field.onkeyup = (event) => {
      if (event.key === 'Escape') {
        this.boxEditing = undefined;
        this.render();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.overlay.moveCursor(event.key);
      }
    };
  }

  private stashView(): string {
    const pokemon = this.stashPokemon;
    const shown = this.shownPokemon;
    const inBoxes = this.scopeBox === 'all' || this.stashSearch.trim() !== '';
    const boxNames = this.stash.listBoxes().map((box) => box.name);
    const rows = shown
      .map((stored) => {
        const hurt = needsRecovery(stored.pokemon);
        const wiring = hurt
          ? `data-recover="${stored.id}" data-help="${this.recoveryHelp(stored)}"`
          : `data-fit="${stored.id}" data-help="${escapeAttribute(stored.pokemon.base.name)} is fit to raid."`;
        const tag = hurt
          ? pixelTag(this.recoveryPriceTag(stored), 'risk')
          : pixelTag('Fit', 'good', true);
        const boxed = boxNames[this.stash.boxIndexOf(stored.id)];
        const moving = this.boxMoving === stored.id;
        return `<div class="loadout-entry stash-entry"><button class="px-row${moving ? ' is-selected' : ''}" ${wiring} data-shows="${stored.id}">${this.pokemonRowBody(stored, tag, inBoxes ? boxed : undefined)}</button>${this.chip(`data-box-move="${stored.id}" data-shows="${stored.id}"`, moving ? `Put ${escapeAttribute(stored.pokemon.base.name)} down again.` : `Move ${escapeAttribute(stored.pokemon.base.name)} to another box. It is in ${escapeAttribute(boxed ?? 'no box')}.`, 'Move')}${this.gearStrip(stored)}</div>`;
      })
      .join('');
    const portraits = shown
      .map(
        (stored, index) =>
          // The sprite and its types only: the name, level and condition are the
          // row the cursor is on, and a ten-letter name does not fit beside a
          // 64-pixel portrait in this column.
          `<div class="stash-portrait" data-shown-by="${stored.id}"${index === 0 ? '' : ' hidden'}>${pixelPortrait(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div>${pixelTypeBadge(stored.pokemon.base.primaryType)}${stored.pokemon.base.secondaryType ? pixelTypeBadge(stored.pokemon.base.secondaryType) : ''}</div></div>`,
      )
      .join('');
    const supplyRow = (item: ItemDefinition): string =>
      // One line a supply, as a bag lists them: what it does is said by the
      // help bar when it is pointed at, which is why the row is a control.
      `<button class="px-row has-icon" data-supply="${item.id}" data-help="${escapeAttribute(`${item.displayName}: ${item.description}`)}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong>${item.displayName}</strong></span><span class="px-tag">×${this.stash.itemCount(item.id)}</span></button>`;
    const materialRows = this.stashItems.filter((item) => isFoundOnly(item.id)).map(supplyRow).join('');
    const supplies = `${this.stashItems.filter((item) => !isFoundOnly(item.id)).map(supplyRow).join('')}${
      // Found goods are their own list: nothing in it can be packed or used,
      // and the Outfitter and the Ferryman are where all of it goes.
      materialRows ? `<h3 class="px-subheading">Found goods</h3>${materialRows}` : ''
    }`;
    return `<main class="px-body stash-layout">${pixelWindow(
      `<div class="px-list px-scroll">${this.browseBar(true)}${this.boxManage()}${rows || `<p class="px-empty">${this.stashSearch.trim() ? 'No Pokémon answers that.' : pokemon.length === 0 ? 'No Pokémon in storage.' : 'This box is empty.'}</p>`}${this.swapPanel()}</div>`,
      { heading: 'Pokémon', note: `${pokemon.length} stored` },
    )}<div class="stash-side">${portraits ? pixelWindow(portraits, { tag: 'div' }) : ''}${pixelWindow(
      `<div class="px-list px-scroll">${supplies || '<p class="px-empty">No supplies in storage.</p>'}</div>`,
      { heading: 'Supplies', note: `${this.stashItems.length} kinds` },
    )}</div>${this.recoveryPanel()}</main>`;
  }

  /** Whose summary the screen is showing, if that Pokemon is still at base. */
  private get summaryPokemon(): StashedPokemon | undefined {
    return this.stashPokemon.find((stored) => stored.id === this.summaryPokemonId);
  }

  /**
   * The summary screen: how far a Pokemon is from its next level, and what each
   * of its moves actually does.
   *
   * Both were unanswerable anywhere in the game. A level was a number with
   * nothing behind it, and a move was a name and a PP count - the move menu in
   * a fight describes the highlighted one, but only once the fight has started
   * and only against the Pokemon standing opposite.
   *
   * Two windows, in the ranks PR #115 set: the window heading says what the
   * panel is, a `px-subheading` bands each part of it, and a move's numbers and
   * its sentence live in the list's one detail pane, which the cursor swaps as
   * it walks the rows. Nothing here is a control except the move rows, so the
   * screen can be read without changing anything.
   */
  private summaryView(): string {
    const stored = this.summaryPokemon;
    if (!stored) {
      return `<main class="px-body summary-layout">${pixelWindow(
        '<p class="px-empty">That Pokémon is no longer at base.</p>',
        { heading: 'Summary' },
      )}</main>`;
    }
    const { pokemon } = stored;
    const progress = experienceProgress(pokemon);
    const held = getHeldItem(pokemon.heldItemId);
    const stats: readonly (readonly [string, number])[] = [
      ['Attack', pokemon.stats.attack],
      ['Defense', pokemon.stats.defense],
      ['Sp. Atk', pokemon.stats.spAttack],
      ['Sp. Def', pokemon.stats.spDefense],
      ['Speed', pokemon.stats.speed],
    ];
    const profile = pixelWindow(
      `<div class="px-scroll summary-profile"><div class="summary-hero">${pixelPortrait(pokemon.base.dexId, pokemon.base.name)}<div class="summary-state"><div class="summary-types">${pixelTypeBadge(pokemon.base.primaryType)}${pokemon.base.secondaryType ? pixelTypeBadge(pokemon.base.secondaryType) : ''}</div>${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}<small class="px-wrap">${this.conditionLine(stored)}</small><small class="px-wrap">${held ? `Holding ${held.displayName}` : 'Holding nothing'}</small></div></div><h3 class="px-subheading">Experience</h3><div class="summary-state">${pixelXpBar(experienceBarFill(progress), `Experience ${formatExperience(progress.intoLevel)} of ${formatExperience(progress.levelSpan)}`)}<small class="px-wrap">${experienceLine(progress)}</small></div><h3 class="px-subheading">Stats</h3><dl class="summary-stats">${stats
        .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
        .join('')}</dl></div>`,
      { heading: pokemon.base.name, note: `Lv ${pokemon.level}` },
    );
    const summaries = pokemon.moves.map((move) => moveSummary(move));
    const rows = summaries
      .map(
        (move, index) =>
          `<button class="px-row" data-shows="move-${index}"${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(move.description)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${move.name}</strong>${pixelTypeBadge(move.type)}</span></span><span class="px-tag">${move.pp}/${move.maxPp} PP</span></button>`,
      )
      .join('');
    const details = summaries
      .map(
        (move, index) =>
          `<div class="px-detail" data-shown-by="move-${index}"${index === 0 ? '' : ' hidden'}><span class="px-wrap">${move.detail}</span></div>`,
      )
      .join('');
    const moves = pixelWindow(
      `<div class="px-list px-scroll">${rows || '<p class="px-empty">No moves known.</p>'}</div>${details}`,
      { heading: 'Moves', note: moveSlotNote(pokemon.moves.length) },
    );
    return `<main class="px-body summary-layout">${profile}${moves}</main>`;
  }

  /**
   * Two windows and a bar. The two columns are what you choose from - the stash
   * on the left, where you are dropping in on the right - and everything that
   * commits you sits in a full-width bar that stays on screen, because the
   * three-panel column layout this replaced ran the right column past the fold
   * at 1280x800 and put `Review & deploy` somewhere a new player never saw it,
   * with an empty half-column beside it. The bar is the same one the final
   * check screen already ends on, so the route reads as one route.
   */
  private loadoutView(): string {
    const party = this.flow.party;
    // Things, not kinds: four Potions in the container is four protected, and
    // "1 protected" beside a full container was a number nobody could place.
    const securedCount =
      this.flow.securedPokemon.length +
      this.flow.securedItems.reduce((total, item) => total + item.quantity, 0);
    const single = this.stashPokemon.length === 1;
    const supplies = this.flow.items.reduce((total, item) => total + item.quantity, 0);
    const allFainted = party.length > 0 && !this.flow.isDeployable;
    const hurtCount = this.injuredPokemon.length;
    // The bar is where the loadout is read back, so it names what is in it
    // rather than counting it; the final check screen is where the full at-risk
    // breakdown belongs.
    const summary = party.length === 0
      ? 'Nothing selected yet. Add a Pokémon from your stash.'
      : `${party.map((stored) => stored.pokemon.base.name).join(', ')} · ${supplies} ${supplies === 1 ? 'supply' : 'supplies'} · ${securedCount} protected`;
    const pokemonRows = this.findablePokemon
      .map((stored) => {
        const added = this.flow.includesPokemon(stored.id);
        const name = escapeAttribute(stored.pokemon.base.name);
        return `<div class="loadout-entry"><button class="px-row${added ? ' is-selected' : ''}" data-pokemon="${stored.id}" data-help="${added ? `Take ${name} back out of the raid.` : `Add ${name}${single ? ', your only Pokémon,' : ''} to the raid. Lost on a wipe unless secured.`}">${this.pokemonRowBody(
          stored,
          // A tick, as every chosen row on these screens is marked: a ten-letter
          // name and its health bar leave no room for a word beside them.
          added ? pixelTag('', 'good', true) : pixelTag('Add'),
        )}</button>${this.careStrip(stored)}</div>`;
      })
      .join('');
    const supplyRows = this.stashItems
      .filter((item) => !isFoundOnly(item.id))
      .map((item) => {
        const packed = this.flow.itemQuantity(item.id as ItemId);
        const held = this.stash.itemCount(item.id);
        const footprint = footprintOf(item.id);
        const size = footprint.width === 1 && footprint.height === 1
          ? '1 square'
          : `${footprint.width * footprint.height} squares`;
        const room = this.flow.packHasRoomFor(item.id as ItemId);
        const help = escapeAttribute(
          `${item.displayName}: ${item.description} ${size} each, ${held} at base.`,
        );
        // The pack is the second cap after the vault, so a row says both: what
        // it costs in squares, and how many of it the base still holds. A plus
        // that would not fit is left reachable and refuses out loud, because a
        // control the cursor cannot land on can never say why.
        return `<div class="px-row has-icon${packed ? ' is-selected' : ''}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong>${item.displayName}</strong><small>${size} · ${held} at base</small></span><span class="px-stepper"><button class="px-window px-step" data-item="${item.id}" data-amount="-1" data-help="${help}" aria-label="Remove ${item.displayName}"${packed ? '' : ' disabled'}>−</button><b>${packed}</b><button class="px-window px-step" data-item="${item.id}" data-amount="1" data-help="${help}" aria-label="Add ${item.displayName}"${packed < held ? '' : ' aria-disabled="true"'}${room ? '' : ' aria-disabled="true"'}>+</button></span></div>`;
      })
      .join('');
    const cells = this.flow.bagCells;
    // The stash list is the tall one - it holds every Pokemon and every supply
    // at base - so it keeps the first column whole, and the pack stands beside
    // it, where its own lid counts the squares. Where to drop in used to be the
    // second window of this column; it is its own step now, because a place
    // deserves more than a name in a list a third of a screen wide.
    return `<main class="px-body loadout-layout">${pixelWindow(
      `<div class="px-list px-scroll">${this.browseBar(false)}${pokemonRows || '<p class="px-empty">No Pokémon answers that.</p>'}<h3 class="px-subheading">Supplies</h3>${supplyRows || '<p class="px-empty">No supplies at base.</p>'}</div>`,
      { heading: 'Stash', note: hurtCount ? `${hurtCount} hurt · treat them first` : '' },
    )}<div class="loadout-side">${pixelWindow(
      pixelGrid(this.flow.bagLayout(), (itemId) => itemIcon(itemId, this.itemName(itemId)), {
        label: `Pack, ${cells.used} of ${cells.total} squares full`,
      }),
      {
        className: 'pack-window',
        heading: 'Pack',
        note: `${cells.used}/${cells.total} squares`,
      },
    )}</div>${pixelCommitBar({
      title: `${party.length}/6 Pokémon packed`,
      lines: [
        `<span class="px-wrap">${summary}</span>`,
        `<small class="px-wrap${allFainted ? ' px-warning' : ''}">${allFainted ? 'Every Pokémon here has fainted. Recover one at base before you deploy.' : 'Everything here is lost on a wipe unless it is in the secure slot.'}</small>`,
      ],
      actions: `<button class="px-window px-button" data-secure-slot data-help="${escapeAttribute(`The ${gridCells(this.flow.secureGrid)} squares that survive a wipe. It fills itself with your highest-level Pokémon first - a Pokémon costs 4, 6 or 9 squares by its stage - and you can change it.`)}">Secure slot${securedCount ? ` · ${securedCount}` : ''}</button><button class="px-window px-button is-primary" data-advance data-help="Choose where this raid drops in." ${this.flow.isDeployable ? '' : 'disabled'}>Choose drop-in</button>`,
    })}</main>`;
  }

  /**
   * What the drop-in screen is looking at: the map in the gate state this save
   * has earned, its record, and the ground it has walked. Asked once per render
   * and handed to every part of the screen, so the picture, the grade and the
   * lists cannot describe two different saves.
   */
  private dropInContext(insertionId: RunInsertionId): DropInContext {
    const progress = this.savedGame.raidProgress;
    return {
      // The map as this raid would actually find it: a door the player has
      // opened is open here, which is what makes a beaten boss visible at base.
      map: getWorldMap(RUN_INSERTIONS[insertionId].mapId, progress.defeatedBosses),
      defeatedBosses: progress.defeatedBosses,
      raidRecord: progress.raidRecord,
      surveyed: progress.surveyed,
      insertionIds: this.unlockedInsertions.map(([id]) => id),
      partyLevels: this.flow.party.map((stored) => stored.pokemon.level),
      contract: this.contractFor(insertionId),
    };
  }

  /**
   * Choosing where to drop in, as its own step.
   *
   * The left window is the choice; the right is the place, and it leads with a
   * picture of the map drawn one game pixel to the tile with everything nobody
   * has walked still dark. That dark is the point: the vast maps are built so
   * you drop in, see a piece and leave wondering, and a full bird's-eye view
   * would hand that answer over for nothing. What fills in is what you walked,
   * plus your own landings and the doors you have opened - so opening a gate
   * changes something you can come back to base and look at.
   *
   * The picture is pinned and only the words under it scroll, because it is
   * what the screen is for.
   */
  private dropInView(): string {
    const chosen = this.flow.insertionId;
    const context = this.dropInContext(chosen);
    const briefing = buildDropInBriefing(chosen, context);
    const picture = placePicture(chosen, context);
    const rows = this.unlockedInsertions
      .map(([id, insertion]) => {
        const contract = this.contractFor(id);
        const isChosen = chosen === id;
        // One line unless the row has something to add, so the pane shows five
        // ways in rather than two: a drop-in point says which map it is on,
        // because unlike a front door its name is not the map's, and a place
        // with a contract on it names the contract. "No contract" is not news.
        const note = isDropInPoint(insertion)
          ? `DROP-IN · ${WORLD_MAP_NAMES[insertion.mapId]}${contract ? ` · ${contract.name}` : ''}`
          : contract
            ? `${contract.name}${contract.hunterPressure ? ` · hunter +${contract.hunterPressure}` : ''}`
            : '';
        return `<button class="px-row${isChosen ? ' is-selected' : ''}" data-insertion="${id}" data-help="${escapeAttribute(insertion.description)}"><span class="px-row-main"><strong class="px-name">${insertion.label}</strong>${note ? `<small class="insertion-note">${note}</small>` : ''}</span>${isChosen ? pixelTag('', 'good', true) : ''}</button>`;
      })
      .join('');

    return `<main class="px-body dropin-layout">${pixelWindow(
      this.placeHead(briefing, picture),
      {
        className: 'dropin-place',
        heading: briefing.insertion.label,
        note: `Grade ${briefing.grade.rung}/${briefing.grade.rungs}`,
      },
    )}${pixelWindow(
      `<div class="px-list px-scroll">${rows}${this.firstContractActive ? '<p class="px-note px-wrap">Three more insertions unlock when you extract this contract.</p>' : ''}</div>`,
      {
        className: 'dropin-list',
        heading: this.firstContractActive ? 'Contract area' : 'Drop in at',
        note: this.firstContractActive ? '' : `${this.unlockedInsertions.length} known`,
      },
    )}${pixelWindow(
      `<div class="px-list px-scroll dropin-brief">${this.placeBrief(briefing)}</div>`,
      { className: 'dropin-about', heading: 'What is in there' },
    )}${pixelCommitBar({
      title: `Drop in at ${briefing.insertion.label}`,
      // One line, because the banner above already states the place's levels,
      // its doors and what it has cost you. A second row of the bar is 12
      // pixels off what the place holds, at the stage every screen is authored
      // against.
      lines: [
        `<span class="px-wrap">${briefing.contract ? `${briefing.contract.name}${briefing.contract.hunterPressure ? ` · hunter +${briefing.contract.hunterPressure}` : ''}` : 'No contract on this raid'}</span>`,
        this.carryInNote(),
      ].filter((line) => line !== ''),
      actions: `<button class="px-window px-button" data-secure-slot data-help="Change what survives a wipe.">Secure slot</button><button class="px-window px-button is-primary" data-advance data-cursor-start data-help="Read back what this raid risks before you commit to it.">Review &amp; deploy</button>`,
    })}</main>`;
  }

  /**
   * The picture of the place, with the short facts beside it.
   *
   * The canvas carries the map's own tile dimensions, so one source pixel is
   * one tile and one game pixel; `paintMinimaps()` fills it after the render,
   * because the ink is data rather than markup and a few thousand `<i>`s would
   * be. `--cols` is what the stylesheet measures its width in, exactly as
   * the pack grid is measured.
   */
  private placeHead(briefing: DropInBriefing, picture: Minimap): string {
    const { grade, record } = briefing;
    const walked = Math.round(record.surveyed * 100);
    return `<div class="dropin-head"><canvas class="px-minimap" data-minimap="${briefing.insertion.id}" width="${picture.width}" height="${picture.height}" style="--cols:${picture.width * MINIMAP_TILE}" role="img" aria-label="${escapeAttribute(`${briefing.mapName}, ${walked}% walked`)}"></canvas><dl class="dropin-facts">${
      // A second entrance does not carry its map's name, so it says which map
      // it is on. A front door is the map.
      briefing.isDropIn ? `<div><dt>Map</dt><dd>${briefing.mapName}</dd></div>` : ''
    }<div><dt>Wild</dt><dd>${grade.wild.max === 0 ? 'none' : `Lv ${grade.wild.min}-${grade.wild.max}`}</dd></div><div><dt>Fights</dt><dd>${grade.trainers === 0 ? 'none' : `${grade.trainers} · Lv ${grade.trainer}`}</dd></div><div><dt>Doors</dt><dd>${grade.bossesHeld === 0 ? (grade.bossesBeaten === 0 ? 'none' : 'all yours') : `${grade.bossesHeld} held`}</dd></div><div><dt>Raids</dt><dd>${record.deployed === 0 ? 'none yet' : `${record.deployed} · ${record.extracted} out`}</dd></div><div><dt>Known</dt><dd>${record.districts === 0 ? `${walked}%` : `${record.districtsKnown}/${record.districts} · ${walked}%`}</dd></div></dl></div>`;
  }

  /** A swatch in the same ink the map draws that thing in, so the list is the legend. */
  private pip(char: string): string {
    return `<i class="px-pip" style="--pip:${MINIMAP_PALETTE[char]}" aria-hidden="true"></i>`;
  }

  /**
   * What is in there, under the picture: the contract, the ways out, the doors
   * and who holds them, and what lives in each place you have walked.
   *
   * Wildlife is listed only for places the survey has reached. What lives
   * somewhere you have never been is not something base could tell you, and
   * printing it would hand over the answer the dark is there to ask. The count
   * of places still unknown is said instead, which is the invitation.
   */
  private placeBrief(briefing: DropInBriefing): string {
    const { grade } = briefing;
    // Every row of this pane is a control the cursor can land on, even though
    // none of them does anything: a pane with no controls in it cannot be
    // scrolled with the arrow keys, and what a place holds would have been
    // mouse-only on a keyboard-first screen. `aria-disabled` rather than
    // `disabled` for the same reason it is everywhere else here - the cursor
    // has to be able to reach a row for the help bar to speak for it.
    const told = (body: string, help: string, className = ''): string =>
      `<button class="px-row${className}" aria-disabled="true" data-help="${escapeAttribute(help)}">${body}</button>`;
    const contract = briefing.contract
      ? `<h3 class="px-subheading">Contract</h3>${told(
          `<span class="px-row-main"><strong>${briefing.contract.name}</strong><small class="px-wrap">${briefing.contract.description}</small></span>`,
          `${briefing.contract.name}: ${briefing.contract.description}`,
          ' px-tall',
        )}`
      : '';
    const exits = `<h3 class="px-subheading">Ways out</h3>${briefing.exits
      .map((exit) =>
        told(
          `${this.pip('X')}<span class="px-row-main"><strong>${exit.label}</strong><small>${exit.opens === 'OPEN' ? 'open from the first second' : exit.opens.toLowerCase()}</small></span>`,
          `${exit.label}: ${exit.opens === 'OPEN' ? 'open from the first second of the raid' : exit.opens.toLowerCase()}. Stepping on any open exit ends the raid.`,
          ' has-pip',
        ),
      )
      .join('')}`;
    const doors = briefing.doors.length === 0
      ? ''
      : `<h3 class="px-subheading">Doors</h3>${briefing.doors
          .map((door) =>
            told(
              `${this.pip(door.open ? 'O' : 'H')}<span class="px-row-main"><strong>${door.label}</strong><small>${door.open ? 'you opened this' : `held by ${door.bossName}`}</small></span>`,
              door.open
                ? `${door.label} stands open on every raid from now on, because you beat the keeper who held it.`
                : `${door.label} is held by ${door.bossName}. Beat them once and it stays open for good.`,
              ' has-pip' + (door.open ? ' is-selected' : ''),
            ),
          )
          .join('')}`;
    const seen = briefing.wildlife.filter((place) => place.known);
    const unseen = briefing.wildlife.length - seen.length;
    const wildlife = briefing.wildlife.length === 0
      ? ''
      : `<h3 class="px-subheading">Wildlife</h3>${seen
          .map((place) => {
            const living = place.species
              .map((entry) => `${entry.name} ${entry.min}-${entry.max}`)
              .join(' · ');
            return told(
              `<span class="px-row-main"><strong>${place.place}</strong><small class="px-wrap">${living}</small></span>`,
              `${place.place}: ${living}. Rolled for on every step through that place's tall grass.`,
              ' px-tall',
            );
          })
          .join('')}${
          seen.length === 0
            ? '<p class="px-empty px-wrap">You have walked none of this map. Whatever lives here, nobody at base can tell you.</p>'
            : unseen === 0
              ? ''
              : `<p class="px-note px-wrap">${unseen} more place${unseen === 1 ? '' : 's'} on this map nobody here has walked.</p>`
        }`;
    // How the place compares to the party is the one fact the banner beside the
    // picture cannot state, because it is about the loadout rather than about
    // the place. Everything else the banner already counts, and a screen this
    // size cannot afford to say a number twice.
    return `<p class="px-wrap dropin-blurb">${briefing.insertion.description}</p><p class="px-note px-wrap">${gradeLine(grade)}.</p>${contract}${exits}${doors}${wildlife}`;
  }

  private secureView(): string {
    const party = this.flow.party;
    const returnLabel = this.flow.secureReturnStep === 'confirm' ? 'final check' : 'loadout';
    const slots = this.flow.securePokemonSlots;
    // A Pokemon costs squares of the same container its supplies do, four, six
    // or nine by how far along its line it is, so the row says the price before
    // the press and the help bar says what it would buy or cost.
    const pokemonRows = party
      .map((stored) => {
        const secured = this.flow.securesPokemon(stored.id);
        const squares = cargoSquaresLabel(cargoCells(pokemonCargo(stored.id, stored.pokemon)));
        const help = secured
          ? `Secured: it comes home even if you wipe. It is taking ${squares} of the container.`
          : `Secure this Pokémon so a wipe cannot take it. It needs ${squares} of the container.`;
        // The price is on the row whether or not it is paid: a secured Pokemon
        // still says what it is taking, because the next question the screen is
        // asked is what would fit if it came out.
        return `<button class="px-row${secured ? ' is-secured' : ''}" data-secure-pokemon="${stored.id}" data-shows="${stored.id}" data-help="${escapeAttribute(help)}">${this.pokemonRowBody(stored, `${pixelTag(squares.toUpperCase(), 'plain')}${secured ? pixelTag('', 'secure', true) : ''}`)}</button>`;
      })
      .join('');
    // One stepper a kind, exactly as the loadout packs: the container is squares
    // now, so "how much of this comes home" is a number rather than a tick, and
    // the same two keys answer it on both screens.
    // The pane is narrow: the row says how many squares one costs and nothing
    // else, because a second clause wrapped every row onto three lines and a
    // list of three-line rows is a list nobody scrolls. What is packed, and
    // what a material's room is for, are in the help bar the cursor fills.
    const secureRow = (itemId: ItemId, help: string): string => {
      // Squares, not units. They are the same number for everything a square
      // holds one of, and for the scrip - a bundle to a square - the stepper
      // would otherwise count in hundreds in a box four characters wide.
      const held = blocksFor(itemId, this.flow.secureQuantity(itemId));
      const footprint = footprintOf(itemId);
      const size = footprint.width * footprint.height;
      const room = this.flow.secureHasRoomFor(itemId);
      const label = escapeAttribute(this.itemName(itemId));
      return `<div class="px-row has-icon${held ? ' is-secured' : ''}">${itemIcon(itemId, this.itemName(itemId))}<span class="px-row-main"><strong>${this.itemName(itemId)}</strong><small>${size === 1 ? '1 square' : `${size} squares`}</small></span><span class="px-stepper"><button class="px-window px-step" data-secure-item="${itemId}" data-secure-amount="-1" data-help="${escapeAttribute(help)}" aria-label="Take ${label} out of the container"${held ? '' : ' disabled'}>−</button><b>${held}</b><button class="px-window px-step" data-secure-item="${itemId}" data-secure-amount="1" data-help="${escapeAttribute(help)}" aria-label="Put ${label} in the container"${room ? '' : ' aria-disabled="true"'}>+</button></span></div>`;
    };
    const itemRows = this.flow.items
      .map((item) =>
        secureRow(
          item.itemId,
          `${this.itemName(item.itemId)}: ${item.quantity} packed. What you put in the container comes home even if you wipe.`,
        ),
      )
      .join('');
    // A material, and the scrip beside it, are found rather than packed, so the
    // container holds room for them: whatever of that kind is still in the pack
    // when the raid is lost comes home, up to the squares set aside here. Money
    // no room was kept for is money a wipe takes.
    const materialRows = FOUND_ONLY_IDS.map((itemId) =>
      secureRow(
        itemId,
        `${this.itemName(itemId)}: room kept for what you find. It is never packed, so this is squares held open for it.`,
      ),
    ).join('');
    const cells = this.flow.secureCells;
    return `<main class="px-body secure-layout">${pixelWindow(
      `<div class="px-list px-scroll">${pokemonRows || '<p class="px-empty">Add a Pokémon to your loadout first.</p>'}</div>${this.secureRoomNote()}`,
      { className: 'secure-group', heading: 'Pokémon', note: `${this.flow.securedPokemon.length}/${slots} ${slots === 1 ? 'slot' : 'slots'}` },
    )}${pixelWindow(
      // The squares and the list are one child of the window, or the window's
      // second row takes both and the container scrolls away with the list.
      `<div class="secure-body">${pixelGrid(this.flow.secureLayout(), (itemId) => itemIcon(itemId, this.itemName(itemId)), {
        className: 'is-secure',
        label: `Secure container, ${cells.used} of ${cells.total} squares full${this.flow.securedCargo.length ? `, holding ${this.flow.securedCargo.map((piece) => piece.name).join(' and ')}` : ''}`,
      })}<div class="px-list px-scroll">${itemRows ? `${itemRows}<h3 class="px-subheading">Found goods</h3>` : ''}${materialRows}</div></div>`,
      {
        className: 'secure-group',
        heading: 'Container',
        note: `${cells.used}/${cells.total} squares`,
      },
    )}${pixelCommitBar({
      className: 'px-tone-secure secure-intro',
      title: 'Protected on a wipe',
      lines: [
        // The two lids above already count the squares and what fills them, so
        // this line says only what the counting does not: the rest is gone.
        '<span class="px-wrap">Everything else in your loadout is lost on a wipe.</span>',
      ],
      actions: `<button class="px-window px-button is-primary" data-advance data-help="Keep these choices and go back to the ${returnLabel}.">Back to ${returnLabel}</button>`,
    })}</main>`;
  }

  /**
   * Why the container holds what it holds, said rather than left to be deduced.
   *
   * The base container is four squares and a first-stage Pokemon is four
   * squares, so filling itself with your best Pokemon fills it completely -
   * that is the design, but a player who finds the plus buttons dead deserves
   * the sentence rather than the silence. The same line says what would change
   * it: a bigger container, or letting the Pokemon go.
   */
  private secureRoomNote(): string {
    const cargo = this.flow.securedCargo;
    const free = gridCells(this.flow.secureGrid) - this.flow.secureCells.used;
    if (cargo.length === 0) {
      // Nothing is protected. That is only worth a line when it is because
      // nothing *can* be - an all-evolved party against a container that has
      // not grown - because otherwise the player put the Pokemon out on purpose.
      const smallest = this.flow.party
        .map((stored) => cargoCells(pokemonCargo(stored.id, stored.pokemon)))
        .sort((a, b) => a - b)[0];
      return smallest !== undefined && smallest > free
        ? `<p class="px-note px-wrap">Nothing in this party fits: the container is ${this.flow.secureGrid.width}x${this.flow.secureGrid.height} and the smallest here needs ${cargoSquaresLabel(smallest)}. Grow it at the Outfitter, or bank a cordon ledger.</p>`
        : '';
    }
    const names = cargo.map((piece) => piece.name.toUpperCase()).join(' and ');
    return free === 0
      ? `<p class="px-note px-wrap">${names} ${cargo.length === 1 ? 'fills' : 'fill'} the container - there is no room left for supplies. Let ${cargo.length === 1 ? 'it' : 'them'} go to carry gear instead, or grow the container.</p>`
      : `<p class="px-note px-wrap">${names} ${cargo.length === 1 ? 'leaves' : 'leave'} ${cargoSquaresLabel(free)} for supplies.</p>`;
  }

  private confirmView(): string {
    const insertion = RUN_INSERTIONS[this.flow.insertionId];
    const contract = this.contractFor(this.flow.insertionId);
    const securedPokemon = this.flow.securedPokemon;
    const securedItems = this.flow.securedItems;
    const riskedPokemon = this.flow.party.filter((stored) => !securedPokemon.includes(stored));
    const riskedItems = this.flow.items
      .map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity - (securedItems.find((secured) => secured.itemId === item.itemId)?.quantity ?? 0),
      }))
      .filter((item) => item.quantity > 0);
    const supplies = this.flow.items.reduce((total, item) => total + item.quantity, 0);
    const protectedCount =
      securedPokemon.length + securedItems.reduce((total, item) => total + item.quantity, 0);
    const riskedCount =
      riskedPokemon.length + riskedItems.reduce((total, item) => total + item.quantity, 0);
    // The price of the party, on screen before the player commits to it - the
    // rule the trainer watch and the flee cost already follow. It sits in the
    // full-width bar beside the button that pays it.
    const threat = this.hunterThreatAt(this.flow.insertionId, this.flow.party);
    const hunter = hunterThreatLine(threat);
    // The window a row stands in is what says whether it is lost or comes home,
    // so the rows do not each say it again.
    const itemRow = (item: { readonly itemId: ItemId; readonly quantity: number }, secured: boolean): string =>
      `<div class="px-row has-icon${secured ? ' is-secured' : ''}">${itemIcon(item.itemId, this.itemName(item.itemId))}<span class="px-row-main"><strong>${this.itemName(item.itemId)} ×${item.quantity}</strong>${isFoundOnly(item.itemId) ? '<small>room kept for what you find</small>' : ''}</span></div>`;
    const risked = `${riskedPokemon
      .map((stored) => `<div class="px-row">${this.pokemonRowBody(stored, '')}</div>`)
      .join('')}${riskedItems.map((item) => itemRow(item, false)).join('')}`;
    const secured = `${securedPokemon
      .map((stored) => `<div class="px-row is-secured">${this.pokemonRowBody(stored, '')}</div>`)
      .join('')}${securedItems.map((item) => itemRow(item, true)).join('')}`;
    return `<main class="px-body confirm-layout">${pixelWindow(
      `<div class="px-list px-scroll">${risked || '<p class="px-empty">Nothing extra is at risk. Your whole loadout is protected.</p>'}</div>`,
      {
        className: 'confirm-risk px-tone-risk',
        heading: 'Lost if you wipe',
        note: `${riskedCount} ${riskedCount === 1 ? 'entry' : 'entries'}`,
      },
    )}${pixelWindow(
      `<div class="px-list px-scroll">${secured || '<p class="px-empty px-warning">Nothing is protected. A wipe costs you your whole loadout.</p>'}</div>`,
      {
        className: 'confirm-secure px-tone-secure',
        heading: 'Comes home',
        note: `${protectedCount} secured · ${this.flow.secureCells.used}/${this.flow.secureCells.total} squares`,
      },
    )}${pixelCommitBar({
      title: `Deploy to ${insertion.label}`,
      lines: [
        `<span class="px-wrap">${contract ? `Contract: ${contract.name}` : 'No contract on this raid'} · raid clock ${formatRecoveryClock(this.raidClockMs)}${this.pendingRecoveryMs === 0 ? '' : ` (${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(this.pendingRecoveryMs)} recovery)`}</span>`,
        `<small class="px-wrap">${this.flow.party.length} Pokémon · ${supplies} supplies · pack ${this.flow.bagCells.used}/${this.flow.bagCells.total} squares</small>`,
        `<small class="px-wrap hunter-price${threat.tierOffset > 0 ? ' raised px-warning' : ''}" data-hunter-tier="${threat.tierOffset + 1}"><b>${hunter.heading}</b> · ${hunter.detail}</small>`,
      ],
      actions: `<button class="px-window px-button" data-secure-slot data-help="Change what survives a wipe.">Secure slot</button><button class="px-window px-button is-primary" data-start data-cursor-start data-help="There is no way back from here: the raid starts.">Enter the raid</button>`,
    })}</main>`;
  }

  /**
   * The third card on the base screen. It is a next step rather than a recovery
   * route - it is what extraction is *for* - so it sits with the other two, and
   * it says how far along the base is so the card is a standing goal rather
   * than a door the player has to open to find out.
   */
  /** What the Ferryman is looking at: this save's vault, record and trip. */
  private get traderCounter(): TraderCounter {
    return {
      stash: this.stash,
      progress: traderProgressOf(this.savedGame.raidProgress),
      rationUsed: this.savedGame.traderRationUsed,
      berthPaid: this.savedGame.traderBerthPaid,
    };
  }

  /**
   * The Ferryman's card, beside the Outfitter's, because the pair of them is
   * how a player tells the two apart: one builds the base, one deals off a
   * boat. The card leads with the money, since that is the fact the screen
   * behind it turns on and the only number in the game that is found rather
   * than earned.
   */
  private traderCard(): string {
    const counter = this.traderCounter;
    const standing = traderStanding(counter.progress);
    const scrip = scripHeld(this.stash);
    const ready =
      traderStockOffers(counter).filter((offer) => offer.refusal === undefined).length +
      traderBarterOffers(counter).filter((offer) => offer.refusal === undefined).length;
    return `<button class="px-window px-card" data-view="trader" data-help="Spend found scrip on his rationed shelf, and barter found goods for the gear money cannot buy."><strong>Ferryman</strong><p>${standing.name} · ${scrip} scrip</p><p>${ready ? `<span class="px-ready">${ready} deal${ready === 1 ? '' : 's'} ready</span>` : 'Nothing you can take today'}</p></button>`;
  }

  /**
   * The boat: standing at the top, then the two halves of what he does.
   *
   * They are two windows and never one list, because the whole design rests on
   * the difference - the shelf is money and supplies and is rationed, the
   * barter table is found goods for the things money may not buy. A player who
   * cannot see which is which will read the screen as a shop.
   */
  private traderView(): string {
    const counter = this.traderCounter;
    const standing = traderStanding(counter.progress);
    const next = nextTraderStanding(counter.progress);
    const left = rationLeft(counter);
    const stock = traderStockOffers(counter);
    const barters = traderBarterOffers(counter);
    const first =
      stock.find((offer) => offer.refusal === undefined) ??
      barters.find((offer) => offer.refusal === undefined);

    const standingNote = next
      ? `${traderStandingPoints(counter.progress)} with him · ${next.pointsShort} more for ${next.tier.name}`
      : `${traderStandingPoints(counter.progress)} with him · nothing held back`;
    // Two lines at most. What raises standing is said only while there is a
    // tier left to raise it to, and said as the three prices rather than as a
    // sentence about them: the paragraph that was here took a third of the
    // screen off the two lists the screen is actually for.
    const standingPane = pixelWindow(
      `<p class="px-wrap">${standing.note}</p>${
        next
          ? `<p class="px-wrap px-note">Bank a contract +${STANDING_PER_CONTRACT}, beat a boss +${STANDING_PER_BOSS}, spend ${STANDING_PER_SCRIP} scrip +1.</p>`
          : ''
      }`,
      { className: 'trader-standing', heading: `Standing · ${standing.name}`, note: standingNote },
    );

    const shelf = stock
      .map((offer) => {
        const name = this.itemName(offer.item.itemId);
        const tag =
          offer.refusal === undefined
            ? pixelTag('Buy', 'good')
            : pixelTag(offer.refusal === 'scrip-short' ? 'Short' : offer.refusal === 'ration-spent' ? 'Spent' : 'Locked');
        // Never `disabled`: the cursor has to reach a row to say why it is shut.
        const wiring =
          offer.refusal === undefined
            ? `data-buy="${offer.item.itemId}" data-help="${escapeAttribute(`Buy one ${name} for ${offer.item.price} scrip. One of this trip's ${standing.ration}.`)}"`
            : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
        return `<button class="px-row has-icon" ${wiring}${offer === first ? ' data-cursor-start' : ''}>${itemIcon(offer.item.itemId, name)}<span class="px-row-main"><strong class="px-name">${name}</strong><small>${offer.item.price} scrip</small></span>${tag}</button>`;
      })
      .join('');
    const shelfPane = pixelWindow(
      `<div class="px-list px-scroll">${shelf}</div>${this.berthRow(counter)}`,
      {
        className: 'objectives-panel trader-shelf',
        heading: 'Off the deck',
        // A heading bar's note clips at about the width of the longest one that
        // has to fit, and this pane is the narrow half of the screen: "He sells
        // a stranger nothing" came out as "HE SELLS A STRANGER NOTHIN". Why he
        // is selling nothing is the standing pane's line, right above it.
        note: standing.ration === 0 ? 'Nothing for you yet' : `${left} of ${standing.ration} left this trip`,
      },
    );

    const table = barters
      .map((offer) => {
        const { barter } = offer;
        const taken = offer.refusal === 'already-taken';
        const tag = taken
          ? pixelTag('Traded', 'secure', true)
          : offer.refusal === undefined
            ? pixelTag('Trade', 'good')
            : pixelTag(offer.refusal === 'goods-short' ? 'Short' : 'Locked');
        const wiring =
          offer.refusal === undefined
            ? `data-barter="${barter.id}" data-help="${escapeAttribute(`Hand over ${formatTraderStacks(barter.takes)} for a ${barter.name}. No scrip changes hands.`)}"`
            : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
        return `<button class="px-row has-icon px-tall${taken ? ' is-secured' : ''}" ${wiring} data-shows="${barter.id}"${offer === first ? ' data-cursor-start' : ''}>${iconMarkup(barter.icon, barter.name)}<span class="px-row-main"><strong class="px-name">${barter.name}</strong><small class="px-wrap">${formatTraderStacks(barter.takes)}</small></span>${tag}</button>`;
      })
      .join('');
    const shown = barters.find((offer) => offer.refusal === undefined) ?? barters[0];
    const details = barters
      .map(
        (offer) =>
          `<div class="px-detail" data-shown-by="${offer.barter.id}"${offer === shown ? '' : ' hidden'}><span class="px-wrap">${offer.barter.detail}</span></div>`,
      )
      .join('');
    const tablePane = pixelWindow(`<div class="px-list px-scroll">${table}</div>${details}`, {
      className: 'objectives-panel trader-table',
      heading: 'Out of the hold',
      // Short, because a heading bar's note clips: "Found goods only · no scrip
      // buys these" came out as "FOUND GOODS ONLY · NO SI" on the real stage.
      note: 'No scrip buys these',
    });

    return `<main class="px-body trader-layout">${standingPane}${shelfPane}${tablePane}</main>`;
  }

  /**
   * The berth, along the bottom of his shelf: one more column of the secure
   * container, this raid only.
   *
   * It stands in the shelf's own window rather than in a third pane because it
   * is the other thing scrip buys, and it says "this raid only" in the row
   * itself - the words that keep it distinct from the Outfitter's locker, which
   * is the same stack for good. That comparison is the help bar's, not the
   * row's: spelled out on the row it wrapped to three lines and took the shelf
   * above it down to two and a half.
   */
  private berthRow(counter: TraderCounter): string {
    const offer = checkBerth(counter);
    const paid = offer.refusal === 'already-paid';
    const squares = berthSquares(this.flow.secureGrid);
    const wiring = paid
      ? `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`
      : offer.refusal === undefined
        ? `data-berth data-help="${escapeAttribute(`Pay ${TRADER_BERTH_PRICE} scrip for one more protected stack on the next raid, used or not. The Outfitter builds one for good.`)}"`
        : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
    const tag = paid
      ? pixelTag('Paid', 'secure', true)
      : offer.refusal === undefined
        ? pixelTag('Rent', 'good')
        : pixelTag(offer.refusal === 'scrip-short' ? 'Short' : 'Locked');
    return `<div class="px-list"><h3 class="px-subheading">A berth in the hold</h3><button class="px-row has-icon px-tall${paid ? ' is-secured' : ''}" ${wiring}>${iconMarkup('supply-crate', 'Berth')}<span class="px-row-main"><strong class="px-name">Berth · ${TRADER_BERTH_PRICE} scrip</strong><small class="px-wrap">+${squares} protected squares, this raid.</small></span>${tag}</button></div>`;
  }

  /**
   * One deal across the counter. Every path through it reloads the save the
   * deal was struck against, because the vault it spends is the stored one and
   * the screen is only a picture of it.
   */
  private dealAtCounter(deal: () => { readonly ok: boolean; readonly message: string }): void {
    const result = deal();
    if (result.ok) {
      audioManager.play('confirm');
      const reloaded = this.saveManager.load();
      if (reloaded) {
        const view = this.view;
        this.applyLoadedGame(reloaded);
        this.view = view;
      }
    } else {
      audioManager.play('cancel');
    }
    this.setStatus(result.message);
  }

  private outfitterCard(): string {
    const built = builtUpgrades(this.builtUpgradeIds).length;
    const ready = this.outfitterLadder.filter((offer) => offer.affordable).length;
    return `<button class="px-window px-card" data-view="outfitter" data-help="Spend banked Pokémon and spare supplies on permanent base upgrades."><strong>Outfitter</strong><p>Permanent base upgrades.</p><p>${built}/${OUTFITTER_UPGRADES.length} built${ready ? `<span class="px-ready"> · ${ready} ready</span>` : ''}</p></button>`;
  }

  private get outfitterLadder(): readonly OutfitterOffer[] {
    return outfitterOffers(this.outfitterVault, this.builtUpgradeIds);
  }

  /** "2 Pokémon + 2× Poké Ball, 1× Potion", the way every price here is said. */
  private priceLine(upgrade: OutfitterUpgrade): string {
    return `${upgrade.cost.pokemon} Pokémon + ${formatStacks(upgrade.cost.supplies)}`;
  }

  /**
   * A rung's price with the parts this vault cannot yet pay picked out, so one
   * line says both what it costs and what is still missing. A second "short"
   * line per rung is what ran the ladder past the frame on the smallest stage.
   */
  private pricedAgainstVault(offer: OutfitterOffer): string {
    const { cost } = offer.upgrade;
    const mark = (text: string, short: boolean): string =>
      short ? `<span class="cost-short" title="Not enough spare at base yet">${text}</span>` : text;
    return [
      mark(`${cost.pokemon} Pokémon`, offer.pokemonShort > 0),
      ...cost.supplies.map((stack) =>
        mark(
          formatStacks([stack]),
          offer.suppliesShort.some((short) => short.itemId === stack.itemId),
        ),
      ),
    ].join(' + ');
  }

  /** Why a rung cannot be built yet, as the status line says it when one is chosen. */
  private shortfallLine(offer: OutfitterOffer): string {
    if (offer.state === 'locked') {
      return `${offer.upgrade.name} is built after ${offer.requires?.name ?? 'an earlier upgrade'}.`;
    }
    const short = [
      ...(offer.pokemonShort > 0 ? [`${offer.pokemonShort} more Pokémon you can spare`] : []),
      ...(offer.suppliesShort.length ? [formatStacks(offer.suppliesShort)] : []),
    ];
    return `${offer.upgrade.name} still needs ${short.join(' and ')}.`;
  }

  /**
   * The ladder. Every rung is listed whether or not it can be afforded, with
   * what it still needs, because a goal the player cannot see is not a goal. A
   * rung is a name and a price, the way a shop shelf is; what the pointed-at
   * rung does is one pane under the list, so seven rungs stay two lines each.
   */
  private outfitterView(): string {
    const ladder = this.outfitterLadder;
    const first = ladder.find((offer) => offer.affordable) ?? ladder.find((offer) => offer.state !== 'built');
    const rows = ladder
      .map((offer) => {
        const { upgrade } = offer;
        const built = offer.state === 'built';
        const tag = built
          ? pixelTag('Built', 'secure', true)
          : offer.affordable
            ? pixelTag('Build', 'good')
            : pixelTag(offer.state === 'locked' ? 'Locked' : 'Short');
        const line = built
          ? upgrade.effect
          : `${offer.state === 'locked' ? `After ${offer.requires?.name ?? 'an earlier upgrade'}: ` : 'Costs '}${this.pricedAgainstVault(offer)}`;
        // Not `disabled`: the cursor has to reach a rung to say what it does.
        const wiring = built
          ? `data-built="${upgrade.id}"`
          : `data-outfit="${upgrade.id}"${offer.affordable ? '' : ' aria-disabled="true"'}`;
        return `<button class="px-row has-icon px-tall${built ? ' is-secured' : ''}" ${wiring}${offer === first ? ' data-cursor-start' : ''} data-shows="${upgrade.id}" data-help="${escapeAttribute(upgrade.effect)}">${iconMarkup(upgrade.icon, upgrade.name)}<span class="px-row-main"><strong class="px-name">${upgrade.name}</strong><small class="px-wrap">${line}</small></span>${tag}</button>`;
      })
      .join('');
    const shown = first ?? ladder[0];
    const details = ladder
      .map(
        ({ upgrade }) =>
          `<div class="px-detail" data-shown-by="${upgrade.id}"${upgrade === shown?.upgrade ? '' : ' hidden'}><span class="px-wrap">${upgrade.detail}</span></div>`,
      )
      .join('');
    return `<main class="px-body outfitter-layout">${pixelWindow(
      `<div class="px-list px-scroll">${rows}</div>${details}`,
      {
        className: 'objectives-panel',
        heading: 'What extraction buys',
        note: 'Red is not yet spare at base',
      },
    )}</main>`;
  }

  /**
   * The payment. It names every Pokemon it would release and every supply it
   * would take before anything is armed, and the Pokemon are picked by the
   * player one at a time - this game's contract with its player is that a
   * Pokemon is not a coin, so the screen never reaches into the vault for them.
   */
  private paymentView(upgrade: OutfitterUpgrade): string {
    const candidates = paymentCandidates(this.outfitterVault);
    const chosen = this.stashPokemon.filter((stored) => this.outfitterPayment.includes(stored.id));
    const ordered = sortPokemon(searchPokemon(candidates.map(({ stored }) => stored), this.stashSearch), this.stashSort);
    const rows = ordered
      .map((stored) => candidates.find((candidate) => candidate.stored === stored)!)
      .map(({ stored, refusal }) => {
        const picked = this.outfitterPayment.includes(stored.id);
        const name = escapeAttribute(stored.pokemon.base.name);
        // A Pokemon that is never payment can still be pointed at to be told why.
        const wiring =
          refusal !== undefined
            ? `aria-disabled="true" data-help="${escapeAttribute(refusal)}."`
            : `data-help="${picked ? `Keep ${name} after all.` : `Release ${name} for good as payment.`}"`;
        // The window is headed "to release", so a picked row needs only the tick:
        // a ten-letter name and its health bar leave room for nothing longer.
        const tag = refusal !== undefined ? pixelTag('Kept') : picked ? pixelTag('', 'risk', true) : '';
        return `<button class="px-row${picked ? ' is-selected' : ''}" data-pay-pokemon="${stored.id}" ${wiring}>${this.pokemonRowBody(stored, tag)}</button>`;
      })
      .join('');
    const supplies = upgrade.cost.supplies
      .map(
        ({ itemId, quantity }) =>
          `<div class="px-row has-icon">${itemIcon(itemId, this.itemName(itemId))}<span class="px-row-main"><strong>${this.itemName(itemId)} ×${quantity}</strong><small>${spendableSupply(this.outfitterVault, itemId)} spare of ${this.stash.itemCount(itemId)}</small></span></div>`,
      )
      .join('');
    return `<main class="px-body loadout-layout">${pixelWindow(
      `<div class="px-list px-scroll">${this.browseBar(false)}${rows || '<p class="px-empty">No Pokémon answers that.</p>'}</div>`,
      {
        className: 'px-tone-risk',
        heading: 'Pokémon to release',
        note: `${chosen.length}/${upgrade.cost.pokemon} chosen`,
      },
    )}${pixelWindow(
      `<div class="px-list">${supplies}</div><p class="px-note px-wrap carry-note">Materials are spent here and nowhere else.</p>`,
      { className: 'run-loadout px-scroll', heading: 'Materials spent' },
    )}${this.paymentFooter(upgrade, chosen)}</main>`;
  }

  private paymentFooter(upgrade: OutfitterUpgrade, chosen: readonly StashedPokemon[]): string {
    const named = formatNames(chosen.map((stored) => `${stored.pokemon.base.name} (Level ${stored.pokemon.level})`));
    const supplies = formatStacks(upgrade.cost.supplies);
    const check = checkPayment(
      this.outfitterVault,
      this.builtUpgradeIds,
      upgrade.id,
      this.outfitterPayment,
    );
    if (!check.ok) {
      const remaining = upgrade.cost.pokemon - chosen.length;
      const prompt =
        check.refusal === 'wrong-pokemon-count' && remaining > 0
          ? `Choose ${remaining} more Pokémon to release.`
          : check.message;
      return pixelCommitBar({
        title: `Costs ${this.priceLine(upgrade)}`,
        lines: [
          `<span class="px-wrap">${prompt}</span>`,
          ...(chosen.length ? [`<small class="px-wrap">So far: ${named}.</small>`] : []),
        ],
        actions: `<button class="px-window px-button is-primary" disabled>Build</button>`,
      });
    }
    if (!this.outfitterArmed) {
      return pixelCommitBar({
        title: `Costs ${this.priceLine(upgrade)}`,
        lines: [
          `<span class="px-wrap">Release ${named} and spend ${supplies}</span>`,
        ],
        actions: `<button class="px-window px-button is-primary" data-pay-arm data-help="You will be asked once more before anything is released.">Build</button>`,
      });
    }
    return pixelCommitBar({
      className: 'is-arming',
      title: 'This cannot be undone',
      lines: [
        `<span class="px-wrap px-warning">Release ${named} and spend ${supplies}?</span>`,
        `<small class="px-wrap">${chosen.length === 1 ? 'It is' : 'They are'} gone for good, and ${upgrade.name} stands at base permanently.</small>`,
      ],
      actions: `<button class="px-window px-button" data-pay-cancel data-cursor-start data-help="Nothing changes.">Keep ${chosen.length === 1 ? 'it' : 'them'}</button><button class="px-window px-button is-danger" data-pay-confirm data-help="Releases ${escapeAttribute(formatNames(chosen.map((stored) => stored.pokemon.base.name)))} for good.">Release and build</button>`,
    });
  }

  private swapPanel(): string {
    const spare = this.sparePartner;
    if (!spare) return '';
    return `<section class="swap-panel"><h3 class="px-subheading">Down to one Pokémon</h3><p class="px-note px-wrap">${spare.pokemon.base.name} is all you have left. You can trade it for a level 5 starter, which arrives in the condition ${spare.pokemon.base.name} is in now - the species you settle on is the one you are re-issued after a wipe.</p><button class="px-window px-button" data-view="reselect" data-help="Only offered while one Pokémon is left at base.">Choose a new partner</button></section>`;
  }

  private reselectView(): string {
    const spare = this.sparePartner;
    if (!spare) return '<main class="px-body"><p class="px-window px-empty">You have more than one Pokémon, so there is nothing to swap.</p></main>';
    const chosen = getStarterSpecies(this.reselectStarterId);
    const held = `${spare.pokemon.base.name} (Level ${spare.pokemon.level})`;
    return `<main class="px-body starter-shell reselect-shell"><p class="starter-brief">${held} is your last Pokémon. Swapping releases it for good for a level 5 starter as hurt as it is now, with no supplies: a change of direction, never an upgrade or a heal.</p><div class="starter-grid">${starterCards(this.reselectStarterId, { heldSpeciesId: spare.pokemon.base.id, selectHelp: 'Swap to this starter.' })}</div>${this.swapFooter(spare, chosen)}</main>`;
  }

  private swapFooter(spare: StashedPokemon, chosen: PokemonBase): string {
    if (spare.pokemon.base.id === chosen.id) {
      return pixelCommitBar({
        title: chosen.name,
        lines: ['<span class="px-wrap">Already yours. Pick a different starter to swap.</span>'],
        actions: `<button class="px-window px-button is-primary" disabled>Swap for ${chosen.name}</button>`,
      });
    }
    if (!this.swapArmed) {
      return pixelCommitBar({
        title: chosen.name,
        lines: [`<span class="px-wrap" data-swap-condition>Arrives as: ${this.swapArrival(spare, chosen)}</span>`],
        actions: `<button class="px-window px-button is-primary" data-swap-arm data-help="You will be asked once more before anything is released.">Swap for ${chosen.name}</button>`,
      });
    }
    return pixelCommitBar({
      className: 'is-arming',
      title: `Release ${spare.pokemon.base.name} (Level ${spare.pokemon.level})?`,
      lines: [`<span class="px-wrap px-warning" data-swap-condition>This cannot be undone. It is gone for good. ${chosen.name} arrives as ${conditionLine(starterInConditionOf(spare.pokemon, chosen))}.</span>`],
      actions: `<button class="px-window px-button" data-swap-cancel data-cursor-start data-help="Nothing changes.">Keep ${spare.pokemon.base.name}</button><button class="px-window px-button is-danger" data-swap-confirm data-help="Releases ${escapeAttribute(spare.pokemon.base.name)} for good.">Release and take ${chosen.name}</button>`,
    });
  }

  /**
   * What the swap hands over, worded the way the stash will word it a click
   * later: the old partner's condition on the new species, then its moves.
   */
  private swapArrival(spare: StashedPokemon, chosen: PokemonBase): string {
    const incoming = starterInConditionOf(spare.pokemon, chosen);
    return `${conditionLine(incoming)} · ${incoming.moves.map((move) => move.base.name).join(', ')}`;
  }

  private itemName(itemId: string): string {
    return ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ?? itemId;
  }

  /** A status line that is the game saying no. */
  private refuse(message: string): void {
    audioManager.play('denied');
    this.setStatus(message);
  }

  /**
   * The deployment flow answers a request with a message only when it refuses
   * it, so the message's presence is what decides the sound.
   */
  private answer(refusal: string | undefined, accepted?: SoundEffectName): void {
    if (refusal !== undefined) {
      this.refuse(refusal);
      return;
    }
    if (accepted) {
      audioManager.play(accepted);
    }
    this.setStatus(undefined);
  }

  /**
   * Shows a status line, and takes it down again without touching the screen.
   *
   * Taking it down used to be a whole `render()` on a 2.2s timer, and a render
   * replaces every button on the screen. One that fired between a mousedown and
   * its mouseup left the press on a button that no longer existed, so the click
   * never happened: "Enter the raid" took focus and did nothing, and the second
   * click worked. It also threw the keyboard back to the first button on the
   * screen under a player who was mid-way down a list. Timers stacked as well,
   * so an old message's timer cut a newer message short. There is now at most
   * one, and all it removes is the line it was started for.
   */
  private setStatus(message: string | undefined): void {
    this.statusTimer?.remove();
    this.statusTimer = undefined;
    this.status = message ?? '';
    this.render();
    if (message !== undefined) {
      this.statusTimer = this.time.delayedCall(2200, () => this.clearStatus());
    }
  }

  private clearStatus(): void {
    this.statusTimer = undefined;
    this.status = '';
    takeDownPixelStatus(this.overlay.root);
  }
}

/** "Pidgey", "Pidgey and Rattata", "Pidgey, Rattata and Caterpie". */
function formatNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? 'Nothing';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
