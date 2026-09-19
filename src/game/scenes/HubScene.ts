import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { SoundEffectName } from '../audio/soundEffects';
import {
  applyRecovery,
  beaconUnlockAtMs,
  builtUpgrades,
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
  raidClockAfterRecovery,
  recoveryCostMs,
  recoveryPriceShare,
  spendableSupply,
  treatmentOptions,
  treatWithItem,
  wardBedIds,
  wardTreatmentsPerRaid,
  type Deployment,
  type OutfitterOffer,
  type OutfitterUpgrade,
  type OutfitterVault,
  type RecoveryTerms,
  type TreatmentOption,
} from '../hub';
import { Bag, ITEM_DEFINITIONS, type ItemDefinition, type ItemId } from '../items';
import { PokemonParty, type PokemonBase } from '../pokemon';
import { activeRunManager } from '../run';
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
  availableContracts,
  contractCarryIn,
  contractForMap,
  formatStacks,
  missingCarryIn,
  objectivesForContract,
  secureItemStackLimit,
  securePokemonLimit,
  type RaidContract,
} from '../objectives';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import {
  getStarterSpecies,
  starterInConditionOf,
  type StarterSpeciesId,
  type Stash,
  type StashedPokemon,
} from '../stash';
import { iconMarkup, itemIcon, objectiveIcon } from '../ui/icons';
import { hunterThreatFor, hunterThreatLine } from '../world/hunterThreat';
import { WORLD_MAP_NAMES } from '../worldMap';
import { MenuOverlay } from '../ui/MenuOverlay';
import { conditionLine } from '../ui/condition';
import {
  escapeAttribute,
  pixelCommitBar,
  pixelHpBar,
  pixelPortrait,
  pixelRail,
  pixelScreen,
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
type HubView = 'home' | 'stash' | 'deploy' | 'reselect' | 'outfitter';

export class HubScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private stash!: Stash;
  private savedGame!: RestoredGame;
  private flow!: DeploymentFlow;
  private overlay!: MenuOverlay;
  private view: HubView = 'home';
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
      itemStacks: secureItemStackLimit(
        loaded.raidProgress.completedContracts,
        loaded.raidProgress.outfitterUpgrades,
      ),
    });
    this.view = 'home';
    this.reselectStarterId = this.startingStarterId();
    this.swapArmed = false;
    this.outfitterUpgradeId = undefined;
    this.outfitterPayment = [];
    this.outfitterArmed = false;
    this.deploying = false;
    this.status = '';
    // The clock that owned it died with the last hub, so only the pointer is left.
    this.statusTimer = undefined;
  }

  public create(): void {
    this.cameras.main.fadeIn?.(180, 0, 0, 0);
    this.overlay = new MenuOverlay(this, 'hub-menu pixel-ui', (event) => this.handleKey(event));
    this.render();
  }

  private get stashPokemon(): readonly StashedPokemon[] {
    return this.stash.listPokemon();
  }

  private get stashItems(): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter((item) => this.stash.itemCount(item.id) > 0);
  }

  private get firstContractActive(): boolean {
    return !this.savedGame.raidProgress.firstContractExtracted;
  }

  /** Every contract the board is offering, in the order they unlock. */
  private get openContracts(): readonly RaidContract[] {
    return availableContracts(this.savedGame.raidProgress.completedContracts);
  }

  /**
   * The contract a raid inserting here would carry. A contract belongs to its
   * map, so the insertion list *is* the contract board: choosing where to drop
   * in is choosing which contract to take, and no separate acceptance step can
   * fall out of step with it.
   */
  private contractFor(insertionId: RunInsertionId): RaidContract | undefined {
    return contractForMap(
      RUN_INSERTIONS[insertionId].mapId,
      this.savedGame.raidProgress.completedContracts,
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
    this.view = view;
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
    const items = deployment.items;
    activeRunManager.startRun(
      { party: deployment.party.map((stored) => stored.pokemon), items },
      // The base clock, less whatever recovery has already been booked against it.
      {
        mapId: RUN_INSERTIONS[deployment.insertionId].mapId,
        durationMs: this.raidClockMs,
        secureItemStackLimit: this.flow.secureItemStacks,
        securePokemonLimit: this.flow.securePokemonSlots,
      },
      deployment.secureSlot,
    );
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const plan = generateRunPlan(
      seed,
      undefined,
      deployment.insertionId,
      this.contractFor(deployment.insertionId),
      // The same derivation the final check printed, from the same party.
      hunterThreatFor(deployment.party.map((stored) => stored.pokemon)),
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
        bag: new Bag(Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity]))),
        runSession,
      });
    });
  }

  private goBack(): void {
    if (this.view === 'deploy' && this.flow.retreat()) {
      this.render();
      return;
    }
    // The swap is reached from the stash, so backing out of it returns there
    // rather than dropping the player two screens out to the base.
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
    if (this.view === 'reselect') return 'Swap your partner';
    if (this.view === 'outfitter') return this.payingFor ? `Build ${this.payingFor.name}` : 'The Outfitter';
    if (this.flow.step === 'loadout') return 'Build your loadout';
    return this.flow.step === 'secure' ? 'Secure slot' : 'Final check';
  }

  private get backLabel(): string {
    if (this.view === 'reselect') return 'Stash';
    if (this.view === 'outfitter' && this.payingFor) return 'Outfitter';
    if (this.view !== 'deploy') return 'Base';
    if (this.flow.step === 'confirm') return 'Loadout';
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
      // The route's rail needs the room on a preparation step, and says where you are.
      place: this.view === 'deploy' ? undefined : 'Pallet Town',
      title: this.heading,
      back: this.view === 'home' ? undefined : { label: this.backLabel, attribute: 'data-back' },
      aside:
        this.view === 'deploy'
          ? this.progressRail()
          : this.view === 'reselect'
            ? undefined
            : `${this.stashPokemon.length} Pokémon · ${this.stashItems.length} item types`,
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
    on('[data-deploy-flow]', () => this.openDeployment());
    on('[data-contract]', (button) => this.openDeployment(button.dataset.contract as RunInsertionId));
    on('[data-recover]', (button) => this.recover([button.dataset.recover!]));
    on('[data-recover-all]', () => this.recover(this.injuredPokemon.map((stored) => stored.id)));
    on('[data-fit]', (button) => {
      const name = this.stashPokemon.find((stored) => stored.id === button.dataset.fit)?.pokemon.base.name;
      this.setStatus(`${name ?? 'That Pokémon'} is fit. There is nothing to recover.`);
    });
    on('[data-pokemon]', (button) => this.answer(this.flow.togglePokemon(button.dataset.pokemon!), 'select'));
    on('[data-treat-item]', (button) => this.treat(button.dataset.treatPokemon!, button.dataset.treatItem!));
    on('[data-item]', (button) =>
      rerender(() => this.flow.adjustItem(button.dataset.item as ItemId, Number(button.dataset.amount))),
    );
    on('[data-secure-pokemon]', (button) =>
      rerender(() => this.flow.toggleSecurePokemon(button.dataset.securePokemon!)),
    );
    on('[data-secure-item]', (button) =>
      this.answer(this.flow.toggleSecureItem(button.dataset.secureItem as ItemId), 'select'),
    );
    on('[data-insertion]', (button) =>
      rerender(() => this.flow.chooseInsertion(button.dataset.insertion as RunInsertionId)),
    );
    on('[data-secure-slot]', () => rerender(() => this.flow.openSecureSlot()));
    on('[data-advance]', () => this.answer(this.flow.advance(), 'confirm'));
    on('[data-start]', () => this.startRun());
    // The cursor starts on what the screen is for, never on the way out of it.
    this.overlay.refocus('[data-cursor-start]', '.px-body button:not([disabled])', 'button');
  }

  /** Shows preparation as a route with a raid at the end of it. */
  private progressRail(): string {
    return pixelRail(['Loadout', 'Final check', 'Raid'], this.flow.step === 'confirm' ? 2 : 1);
  }

  private content(): string {
    if (this.view === 'home') return this.homeView();
    if (this.view === 'stash') return this.stashView();
    if (this.view === 'reselect') return this.reselectView();
    if (this.view === 'outfitter') return this.payingFor ? this.paymentView(this.payingFor) : this.outfitterView();
    if (this.flow.step === 'loadout') return this.loadoutView();
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
    const swap = this.sparePartner ? ' Your last partner can be swapped here.' : '';
    const stashLead = hurt
      ? `<p class="px-warning">${hurt === 1 ? '1 Pokémon' : `${hurt} Pokémon`} came home hurt. Treat them here.${swap}</p>`
      : `<p>What is secured at base.${swap}</p>`;
    const stash = `<button class="px-window px-card" data-view="stash" data-help="Everything secured at base, and the recovery bay."><strong>Stash</strong>${stashLead}</button>`;
    return `<main class="px-body hub-home"><section class="hub-actions">${deploy}${stash}${this.outfitterCard()}</section>${this.contractBoard()}</main>`;
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
    const contracts = this.openContracts;
    if (contracts.length === 0) {
      return pixelWindow(
        '<p class="px-empty">Raids from here are for supplies, Pokémon and whatever the maps still hold.</p>',
        { className: 'objectives-panel', heading: 'Contract board', note: 'Every contract is banked' },
      );
    }
    const asksOf = (contract: RaidContract): string => {
      const carryIn = contractCarryIn(contract);
      return [
        ...(contract.requiredExitLabel ? [`Banks only through ${contract.requiredExitLabel}`] : []),
        ...(carryIn.length ? [`Pack ${formatStacks(carryIn)}`] : []),
      ].join(' · ');
    };
    const rows = contracts
      .map((contract) => {
        const insertion = this.insertionFor(contract);
        const place = insertion?.[1].label ?? WORLD_MAP_NAMES[contract.mapId];
        const wiring = insertion
          ? `data-contract="${insertion[0]}" data-shows="${contract.id}" data-help="Prepare a raid that drops in at ${escapeAttribute(place)}."`
          : 'disabled';
        return `<button class="px-row has-icon px-tall px-contract" ${wiring}>${objectiveIcon('Contract')}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${contract.name}</strong><small>${place}</small></span><span class="px-wrap">${contract.description}.</span></span></button>`;
      })
      .join('');
    const details = contracts
      .map((contract, index) => {
        const asks = asksOf(contract);
        return `<div class="px-detail" data-shown-by="${contract.id}"${index === 0 ? '' : ' hidden'}>${asks ? `<span class="px-wrap px-warning">${asks}.</span>` : ''}<span class="px-wrap"><small>Reward</small> ${contract.reward.summary}</span></div>`;
      })
      .join('');
    return pixelWindow(`<div class="px-list px-scroll">${rows}</div>${details}`, {
      className: 'objectives-panel',
      heading: 'Contract board',
      note: `${contracts.length} open · rewards require extraction`,
    });
  }

  /** The unlocked insertion a contract is taken from, if the player can reach it yet. */
  private insertionFor(
    contract: RaidContract,
  ): readonly [RunInsertionId, (typeof RUN_INSERTIONS)[RunInsertionId]] | undefined {
    return this.unlockedInsertions.find(([, insertion]) => insertion.mapId === contract.mapId);
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
    const clock = `Next raid clock ${formatRecoveryClock(this.raidClockMs)} · ${
      pending === 0
        ? `full ${formatRecoveryClock(RAID_DURATION_MS)}, nothing booked`
        : `${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(pending)} recovery booked`
    }`;
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
      lines: [`<small class="px-wrap">${clock}</small>`, cap],
      actions: action,
    });
  }

  /** One line of condition, so "fainted" is never hidden behind an HP number. */
  private conditionLine(stored: StashedPokemon): string {
    return conditionLine(stored.pokemon);
  }

  /** Name, health bar and state on one line; the condition in words under it. */
  private pokemonRowBody(stored: StashedPokemon, tag: string): string {
    const { pokemon } = stored;
    return `<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${pokemon.base.name}</strong>${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}</span><small>${this.conditionLine(stored)}</small></span>${tag}`;
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

  private stashView(): string {
    const pokemon = this.stashPokemon;
    const rows = pokemon
      .map((stored) => {
        const hurt = needsRecovery(stored.pokemon);
        const wiring = hurt
          ? `data-recover="${stored.id}" data-help="${this.recoveryHelp(stored)}"`
          : `data-fit="${stored.id}" data-help="${escapeAttribute(stored.pokemon.base.name)} is fit to raid."`;
        const tag = hurt
          ? pixelTag(this.recoveryPriceLabel(stored), 'risk')
          : pixelTag('Fit', 'good', true);
        return `<button class="px-row" ${wiring} data-shows="${stored.id}">${this.pokemonRowBody(stored, tag)}</button>`;
      })
      .join('');
    const portraits = pokemon
      .map(
        (stored, index) =>
          `<div class="stash-portrait" data-shown-by="${stored.id}"${index === 0 ? '' : ' hidden'}>${pixelPortrait(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div><strong class="px-name">${stored.pokemon.base.name}</strong><span>Level ${stored.pokemon.level}</span><span>${pixelTypeBadge(stored.pokemon.base.primaryType)}${stored.pokemon.base.secondaryType ? pixelTypeBadge(stored.pokemon.base.secondaryType) : ''}</span></div></div>`,
      )
      .join('');
    const supplies = this.stashItems
      .map(
        (item) =>
          `<div class="px-row has-icon">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong>${item.displayName}</strong><small class="px-wrap">${item.description}</small></span><span class="px-tag">×${this.stash.itemCount(item.id)}</span></div>`,
      )
      .join('');
    return `<main class="px-body stash-layout">${pixelWindow(
      `<div class="px-list px-scroll">${rows || '<p class="px-empty">No Pokémon in storage.</p>'}${this.swapPanel()}</div>`,
      {
        heading: 'Pokémon',
        note: `Next raid clock ${formatRecoveryClock(this.raidClockMs)}`,
      },
    )}<div class="stash-side">${portraits ? pixelWindow(portraits, { tag: 'div' }) : ''}${pixelWindow(
      `<div class="px-list px-scroll">${supplies || '<p class="px-empty">No supplies in storage.</p>'}</div>`,
      { heading: 'Supplies' },
    )}</div>${this.recoveryPanel()}</main>`;
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
    const securedCount = this.flow.securedPokemon.length + this.flow.securedItems.length;
    const single = this.stashPokemon.length === 1;
    const supplies = this.flow.items.reduce((total, item) => total + item.quantity, 0);
    const allFainted = party.length > 0 && !this.flow.isDeployable;
    const hurtCount = this.injuredPokemon.length;
    // The bar is where the loadout is read back, so it names what is in it
    // rather than counting it; the final check screen is where the full at-risk
    // breakdown belongs.
    const summary = party.length === 0
      ? 'Nothing selected yet. Add a Pokémon from your stash.'
      : `${party.map((stored) => stored.pokemon.base.name).join(', ')} · ${supplies} ${supplies === 1 ? 'supply' : 'supplies'} packed · ${securedCount} protected`;
    const pokemonRows = this.stashPokemon
      .map((stored) => {
        const added = this.flow.includesPokemon(stored.id);
        const name = escapeAttribute(stored.pokemon.base.name);
        return `<div class="loadout-entry"><button class="px-row${added ? ' is-selected' : ''}" data-pokemon="${stored.id}" data-help="${added ? `Take ${name} back out of the raid.` : `Add ${name}${single ? ', your only Pokémon,' : ''} to the raid. Lost on a wipe unless secured.`}">${this.pokemonRowBody(
          stored,
          added ? pixelTag('Added', 'good', true) : pixelTag('Add'),
        )}</button>${this.careStrip(stored)}</div>`;
      })
      .join('');
    const supplyRows = this.stashItems
      .map((item) => {
        const packed = this.flow.itemQuantity(item.id as ItemId);
        const held = this.stash.itemCount(item.id);
        const help = escapeAttribute(`${item.displayName}: ${item.description} ${held} at base.`);
        return `<div class="px-row has-icon${packed ? ' is-selected' : ''}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong>${item.displayName}</strong><small>${held} at base</small></span><span class="px-stepper"><button class="px-window px-step" data-item="${item.id}" data-amount="-1" data-help="${help}" aria-label="Remove ${item.displayName}"${packed ? '' : ' disabled'}>−</button><b>${packed}</b><button class="px-window px-step" data-item="${item.id}" data-amount="1" data-help="${help}" aria-label="Add ${item.displayName}"${packed < held ? '' : ' disabled'}>+</button></span></div>`;
      })
      .join('');
    const insertions = this.unlockedInsertions
      .map(([id, insertion]) => {
        const contract = this.contractFor(id);
        const chosen = this.flow.insertionId === id;
        return `<button class="px-row${chosen ? ' is-selected' : ''}" data-insertion="${id}" data-help="${escapeAttribute(insertion.description)}"><span class="px-row-main"><strong class="px-name">${insertion.label}</strong><small class="insertion-contract">${
          // A drop-in point says which map it is on, because unlike a front door
          // its name is not the map's.
          isDropInPoint(insertion) ? `DROP-IN · ${WORLD_MAP_NAMES[insertion.mapId]} · ` : ''
        }${contract ? contract.name : 'No contract'}</small></span>${chosen ? pixelTag('', 'good', true) : ''}</button>`;
      })
      .join('');
    return `<main class="px-body loadout-layout">${pixelWindow(
      `<div class="px-list px-scroll">${pokemonRows}<h3 class="px-subheading">Supplies</h3>${supplyRows || '<p class="px-empty">No supplies at base.</p>'}</div>`,
      { heading: 'Stash', note: hurtCount ? `${hurtCount} hurt · treat them first` : '' },
    )}${pixelWindow(
      `<div class="px-list">${insertions}</div>${this.firstContractActive ? '<p class="px-note px-wrap">Three more insertions unlock when you extract this contract.</p>' : ''}${this.carryInNote()}`,
      { className: 'run-loadout px-scroll', heading: this.firstContractActive ? 'Contract area' : 'Drop in at' },
    )}${pixelCommitBar({
      title: `${party.length}/6 Pokémon packed`,
      lines: [
        `<span class="px-wrap">${summary}</span>`,
        `<small class="px-wrap${allFainted ? ' px-warning' : ''}">${allFainted ? 'Every Pokémon here has fainted. Recover one at base before you deploy.' : 'Everything here is lost on a wipe unless it is in the secure slot.'}</small>`,
      ],
      actions: `<button class="px-window px-button" data-secure-slot data-help="Choose the ${this.flow.securePokemonSlots === 1 ? 'one Pokémon' : `${this.flow.securePokemonSlots} Pokémon`} and ${this.flow.secureItemStacks} item stacks that survive a wipe.">Secure slot${securedCount ? ` · ${securedCount}` : ''}</button><button class="px-window px-button is-primary" data-advance data-help="Read back what this raid risks before you commit to it." ${this.flow.isDeployable ? '' : 'disabled'}>Review &amp; deploy</button>`,
    })}</main>`;
  }

  private secureView(): string {
    const party = this.flow.party;
    const returnLabel = this.flow.secureReturnStep === 'confirm' ? 'final check' : 'loadout';
    const securedCount = this.flow.securedPokemon.length + this.flow.securedItems.length;
    const slots = this.flow.securePokemonSlots;
    const pokemonRows = party
      .map((stored) => {
        const secured = this.flow.securesPokemon(stored.id);
        return `<button class="px-row${secured ? ' is-secured' : ''}" data-secure-pokemon="${stored.id}" data-help="${secured ? 'Secured: it comes home even if you wipe.' : 'Secure this Pokémon so a wipe cannot take it.'}">${this.pokemonRowBody(stored, secured ? pixelTag('', 'secure', true) : '')}</button>`;
      })
      .join('');
    const itemRows = this.flow.items
      .map((item) => {
        const secured = this.flow.securesItem(item.itemId);
        return `<button class="px-row has-icon${secured ? ' is-secured' : ''}" data-secure-item="${item.itemId}" data-help="${secured ? 'Secured: this whole stack comes home even if you wipe.' : 'Secure this whole stack so a wipe cannot take it.'}">${itemIcon(item.itemId, this.itemName(item.itemId))}<span class="px-row-main"><strong>${this.itemName(item.itemId)} ×${item.quantity}</strong></span>${secured ? pixelTag('', 'secure', true) : ''}</button>`;
      })
      .join('');
    return `<main class="px-body secure-layout">${pixelWindow(
      `<div class="px-list px-scroll">${pokemonRows || '<p class="px-empty">Add a Pokémon to your loadout first.</p>'}</div>`,
      { className: 'secure-group', heading: 'Pokémon', note: `${this.flow.securedPokemon.length}/${slots} ${slots === 1 ? 'slot' : 'slots'}` },
    )}${pixelWindow(
      `<div class="px-list px-scroll">${itemRows || '<p class="px-empty">Add supplies to your loadout first.</p>'}</div>`,
      {
        className: 'secure-group',
        heading: 'Item stacks',
        note: `${this.flow.securedItems.length}/${this.flow.secureItemStacks} slots`,
      },
    )}${pixelCommitBar({
      className: 'px-tone-secure secure-intro',
      title: `Protected on a wipe · ${securedCount}/${slots + this.flow.secureItemStacks}`,
      lines: [
        `<span class="px-wrap">${slots === 1 ? 'One Pokémon' : `${slots} Pokémon`} and ${this.flow.secureItemStacks} item stacks survive. Everything else in your loadout is at risk.</span>`,
      ],
      actions: `<button class="px-window px-button is-primary" data-advance data-help="Keep these choices and go back to the ${returnLabel}.">Back to ${returnLabel}</button>`,
    })}</main>`;
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
    const protectedCount = securedPokemon.length + securedItems.length;
    const riskedCount = riskedPokemon.length + riskedItems.length;
    // The price of the party, on screen before the player commits to it - the
    // rule the trainer watch and the flee cost already follow. It sits in the
    // full-width bar beside the button that pays it.
    const threat = hunterThreatFor(this.flow.party.map((stored) => stored.pokemon));
    const hunter = hunterThreatLine(threat);
    // The window a row stands in is what says whether it is lost or comes home,
    // so the rows do not each say it again.
    const itemRow = (item: { readonly itemId: ItemId; readonly quantity: number }, secured: boolean): string =>
      `<div class="px-row has-icon${secured ? ' is-secured' : ''}">${itemIcon(item.itemId, this.itemName(item.itemId))}<span class="px-row-main"><strong>${this.itemName(item.itemId)} ×${item.quantity}</strong></span></div>`;
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
        note: `${protectedCount}/${this.flow.securePokemonSlots + this.flow.secureItemStacks} secured`,
      },
    )}${pixelCommitBar({
      title: `Deploy to ${insertion.label}`,
      lines: [
        `<span class="px-wrap">${contract ? `Contract: ${contract.name}` : 'No contract on this raid'} · raid clock ${formatRecoveryClock(this.raidClockMs)}${this.pendingRecoveryMs === 0 ? '' : ` (${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(this.pendingRecoveryMs)} recovery)`}</span>`,
        `<small class="px-wrap">${this.flow.party.length} Pokémon · ${supplies} supplies packed · ${protectedCount} protected</small>`,
        `<small class="px-wrap hunter-price${threat.tierOffset > 0 ? ' raised px-warning' : ''}" data-hunter-tier="${threat.tierOffset + 1}"><b>${hunter.heading}</b> · ${hunter.detail}</small>`,
      ],
      actions: `<button class="px-window px-button" data-secure-slot data-help="Change what survives a wipe.">Secure slot</button><button class="px-window px-button is-primary" data-start data-help="There is no way back from here: the raid starts.">Enter the raid</button>`,
    })}</main>`;
  }

  /**
   * The third card on the base screen. It is a next step rather than a recovery
   * route - it is what extraction is *for* - so it sits with the other two, and
   * it says how far along the base is so the card is a standing goal rather
   * than a door the player has to open to find out.
   */
  private outfitterCard(): string {
    const built = builtUpgrades(this.builtUpgradeIds).length;
    const ready = this.outfitterLadder.filter((offer) => offer.affordable).length;
    return `<button class="px-window px-card" data-view="outfitter" data-help="Spend banked Pokémon and spare supplies on permanent base upgrades."><strong>Outfitter</strong><p>${built}/${OUTFITTER_UPGRADES.length} built${ready ? `<span class="px-ready"> · ${ready} ready</span>` : ''}</p></button>`;
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
    const rows = candidates
      .map(({ stored, refusal }) => {
        const picked = this.outfitterPayment.includes(stored.id);
        const name = escapeAttribute(stored.pokemon.base.name);
        // A Pokemon that is never payment can still be pointed at to be told why.
        const wiring =
          refusal !== undefined
            ? `aria-disabled="true" data-help="${escapeAttribute(refusal)}."`
            : `data-help="${picked ? `Keep ${name} after all.` : `Release ${name} for good as payment.`}"`;
        const tag =
          refusal !== undefined
            ? pixelTag('Kept')
            : picked
              ? pixelTag('Releasing', 'risk', true)
              : pixelTag('Release');
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
      `<div class="px-list px-scroll">${rows}</div>`,
      {
        className: 'px-tone-risk',
        heading: 'Pokémon to release',
        note: `${chosen.length}/${upgrade.cost.pokemon} chosen`,
      },
    )}${pixelWindow(
      `<div class="px-list">${supplies}</div><p class="px-note px-wrap carry-note">Only spare supplies are taken. The kit a wipe restocks is never payment.</p>`,
      { className: 'run-loadout px-scroll', heading: 'Supplies spent' },
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
          `<small class="px-wrap">${chosen.length ? `So far: ${named}.` : 'Nothing is spent until you confirm.'}</small>`,
        ],
        actions: `<button class="px-window px-button is-primary" disabled>Build</button>`,
      });
    }
    if (!this.outfitterArmed) {
      return pixelCommitBar({
        title: `Costs ${this.priceLine(upgrade)}`,
        lines: [
          `<span class="px-wrap">Release ${named} and spend ${supplies}</span>`,
          '<small class="px-wrap">Nothing is spent until you confirm.</small>',
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

  private itemName(itemId: ItemId): string {
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
