import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { Bag, HELD_ITEM_DEFINITIONS, getHeldItem, type ItemDefinition } from '../items';
import type { Pokemon, PokemonParty } from '../pokemon';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { conditionLine } from '../ui/condition';
import { pokemonDossier } from '../ui/pokemonDossier';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelHpBar,
  pixelScreen,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';

interface PartySceneData {
  party: PokemonParty;
  /**
   * The raid's own pack. Gear is given and taken here rather than only at base,
   * because a piece found halfway through a raid is no use to the fight it was
   * found for if it has to be carried home first - and because taking it back
   * off a Pokemon before the run for an exit is the other half of the same
   * decision.
   */
  bag?: Bag;
}

/**
 * The raid party, in the game's own visual language.
 *
 * The same shape as the stash it will be settled back into: the list fills the
 * width it has, a row is the two lines that tell one Pokemon from another, and
 * everything else about the one under the cursor - portrait, types, condition,
 * experience, stats, moves and what can be done to it - is the dossier under
 * the list (`ui/pokemonDossier.ts`, shared with the lobby so the two cannot
 * drift). What used to be a fixed detail column half the screen wide, with a
 * Gear list of its own inside it, is the one pane every other list here uses.
 *
 * The order of the party is the order Pokemon are sent out in, so it is a
 * decision this screen has to be able to make: Enter picks one up and the next
 * Enter puts it in the slot the cursor is on.
 */
export class PartyScene extends Phaser.Scene {
  private party!: PokemonParty;
  private bag = new Bag();
  /** The member picked up for a swap, by its position when it was picked up. */
  private movingIndex?: number;
  private status?: string;
  private menuOverlay?: MenuOverlay;

  public constructor() {
    super('party');
  }

  public init(data: PartySceneData): void {
    this.party = data.party;
    // Phaser reuses this scene, so a pack from an earlier raid would otherwise
    // still be the one this screen gives out of.
    this.bag = data.bag ?? new Bag();
    this.movingIndex = undefined;
    this.status = undefined;
  }

  public create(): void {
    this.menuOverlay = new MenuOverlay(this, 'party-menu pixel-ui', (event) => this.handleKey(event));
    this.menuOverlay.root.setAttribute('aria-label', 'Raid party');
    this.render();
  }

  private handleKey(event: KeyboardEvent): void {
    // P is what opened this, so P is what the player will press to leave it.
    if (isOverlayDismissKey(event, 'p', 'Backspace')) {
      event.preventDefault();
      if (this.movingIndex !== undefined) {
        audioManager.play('cancel');
        this.movingIndex = undefined;
        this.render();
      } else {
        this.close();
      }
      return;
    }
    if (this.menuOverlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private render(prefer: readonly string[] = []): void {
    const root = this.menuOverlay!.root;
    const status = this.status;
    this.status = undefined;
    root.innerHTML = pixelScreen({
      title: 'Party',
      back: { label: 'Raid', attribute: 'data-close' },
      // No aside: the window's own lid says how many are standing, and saying
      // it twice on one screen is one of the two going stale.
      body: this.body(),
      hints:
        this.movingIndex === undefined
          ? 'ARROWS move · ENTER pick up · ESC back to the raid'
          : 'ARROWS move · ENTER put it here · ESC leave it where it was',
      status,
    });
    const on = (selector: string, handler: (button: HTMLButtonElement) => void): void => {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = () => handler(button);
      });
    };
    on('[data-close]', () => this.close());
    on('[data-member]', (button) => this.pressMember(Number(button.dataset.member)));
    on('[data-gear-give]', (button) =>
      this.giveGear(button.dataset.gearGive!, Number(button.dataset.gearMember)),
    );
    on('[data-gear-take]', (button) => this.takeGear(Number(button.dataset.gearTake)));
    this.menuOverlay!.refocus(...prefer, '[data-member]', '[data-close]');
  }

  private body(): string {
    const rows = this.party.pokemon.map((pokemon, index) => this.memberRow(pokemon, index)).join('');
    const details = this.party.pokemon
      .map((pokemon, index) => this.memberDossier(pokemon, index))
      .join('');
    return `<main class="px-body raid-party-layout">${pixelWindow(
      // No ceiling on the columns, as the stash has none: a party of six is a
      // collection like any other and fills the width it is given. Which one
      // leads is said by the row's own tag rather than by where it sits, so
      // the order survives being read across columns.
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${
        rows || '<p class="px-empty">Nobody is deployed.</p>'
      }</div>${details}`,
      { className: 'raid-roster', heading: 'Deployed', note: this.partyLabel() },
    )}</main>`;
  }

  /** Name, health and the order it is in; everything else is the pane below. */
  private memberRow(pokemon: Pokemon, index: number): string {
    const moving = this.movingIndex === index;
    const held = getHeldItem(pokemon.heldItemId);
    const name = escapeAttribute(pokemon.base.name);
    const help =
      this.movingIndex === undefined
        ? `Pick ${name} up to move it. The first in the list is the one sent out first.`
        : moving
          ? `Put ${name} back down where it was.`
          : `Put the Pokémon you are holding here, and ${name} where it was.`;
    const tag = moving ? pixelTag('Holding', 'risk') : index === 0 ? pixelTag('Leads', 'good', true) : '';
    return `<button class="px-row${moving ? ' is-selected' : ''}" data-member="${index}" data-shows="member-${index}" data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${pokemon.base.name}</strong>${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}</span><small>${conditionLine(pokemon)}${held ? ` · holding ${held.displayName}` : ''}</small></span>${tag}</button>`;
  }

  private memberDossier(pokemon: Pokemon, index: number): string {
    const held = getHeldItem(pokemon.heldItemId);
    return pokemonDossier({
      pokemon,
      id: `member-${index}`,
      first: index === 0,
      holding: held ? `Holding ${held.displayName}` : 'Holding nothing',
      deeds: { label: 'Gear', chips: (shows) => this.gearChips(pokemon, index, shows) },
    });
  }

  /**
   * The gear pocket for one Pokemon: what it is carrying, and what the pack
   * could give it instead.
   *
   * One slot, so a give is always a swap - the piece already held goes back into
   * the pack in the same action, and there is never a moment where the player
   * owns two of something or none of it.
   */
  private gearChips(pokemon: Pokemon, index: number, shows: string): string {
    const held = getHeldItem(pokemon.heldItemId);
    const offers = HELD_ITEM_DEFINITIONS.filter(
      (item) => this.bag.count(item.id) > 0 && item.id !== pokemon.heldItemId,
    );
    const take = held
      ? `<button class="px-window px-chip" data-gear-take="${index}" ${shows} data-help="${escapeAttribute(
          `${held.displayName}: ${held.description} Press to take it back into the pack.`,
        )}">Take ${held.displayName}</button>`
      : '';
    const give = offers
      .map(
        (item: ItemDefinition) =>
          `<button class="px-window px-chip" data-gear-give="${item.id}" data-gear-member="${index}" ${shows} data-help="${escapeAttribute(
            `${item.displayName}: ${item.description} Lost with ${pokemon.base.name} on a wipe.`,
          )}">Give ${item.displayName} ×${this.bag.count(item.id)}</button>`,
      )
      .join('');
    return `${take}${give}${
      take || give
        ? ''
        : '<span class="px-note">Nothing held, and no gear in the pack. Gear is carried by the trainers holding the gates.</span>'
    }`;
  }

  /** Picks a member up, or puts the one being held into this slot. */
  private pressMember(index: number): void {
    if (this.movingIndex === undefined) {
      if (this.party.pokemon.length < 2) {
        audioManager.play('denied');
        this.status = 'There is nobody to swap with.';
        this.render();
        return;
      }
      this.movingIndex = index;
      audioManager.play('select');
      this.render();
      return;
    }
    const from = this.movingIndex;
    const led = this.party.pokemon[0];
    this.movingIndex = undefined;
    if (from === index || !this.party.movePokemon(from, index)) {
      audioManager.play('cancel');
      this.render([`[data-member="${from}"]`]);
      return;
    }
    audioManager.play('confirm');
    // Only the lead is worth a line: it is the one thing the order decides that
    // the list does not already show, and it is decided by a move made three
    // rows away from the row that changed.
    const leads = this.party.pokemon[0];
    this.status = leads && leads !== led ? `${leads.base.name} is sent out first now.` : undefined;
    this.render([`[data-member="${index}"]`]);
  }

  private giveGear(itemId: string, index: number): void {
    const pokemon = this.party.pokemon[index];
    if (!pokemon || this.bag.count(itemId) <= 0 || !this.bag.remove(itemId, 1)) {
      return;
    }
    const displaced = pokemon.giveHeldItem(itemId);
    if (displaced) {
      this.bag.add(displaced, 1);
    }
    audioManager.play('select');
    this.render();
  }

  private takeGear(index: number): void {
    const taken = this.party.pokemon[index]?.takeHeldItem();
    if (!taken) {
      return;
    }
    this.bag.add(taken, 1);
    audioManager.play('cancel');
    this.render();
  }

  private partyLabel(): string {
    const standing = this.party.pokemon.filter((pokemon) => !pokemon.isFainted).length;
    return `${standing} of ${this.party.pokemon.length} standing`;
  }

  private close(): void {
    audioManager.play('menuClose');
    this.scene.stop();
    this.scene.resume('world');
  }
}
