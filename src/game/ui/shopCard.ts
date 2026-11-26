import { escapeAttribute } from './pixelUi';
import { SHORT_MARK } from './shopDetail';

/**
 * The card on the right of Bill's Cottage and Brock's Workshop, in the round-3
 * look: it answers for whichever card the cursor is on, in pictures and
 * numbers rather than sentences (the captain, 25 Nov 2026; Olly's rule: no
 * advice lines). A coloured head strip with the thing's name, a big picture,
 * what it comes to - the count and the money it leaves, the parts it takes as
 * tags - one short line of what it does, and the key that does it.
 *
 * It is a `px-detail` pane with `data-shown-by`, so the screen's own detail
 * swap (`MenuOverlay.showDetailFor`) shows the one the cursor's card names.
 */
export interface ShopCardOptions {
  /** The id its card carries as `data-shows`. */
  readonly id: string;
  readonly shown: boolean;
  /** The head strip: the name, a note on its right, and its colour. */
  readonly head: { readonly title: string; readonly note?: string; readonly tone: 'gold' | 'green' | 'ink' };
  /** A big picture of the thing. */
  readonly art?: string;
  /** Beside the picture: the count and the money line, or what a build does in a raid. */
  readonly show?: string;
  /** Under it: the parts it takes, or anything else in pictures. */
  readonly parts?: string;
  /** One short line of what it does. */
  readonly line?: string;
  /** What is shutting it, in one short line. */
  readonly blocked?: string;
  /** What the key does here, drawn as the key and its words (`ENTER` BUY ONE). */
  readonly go?: { readonly key: string; readonly label: string };
  /** Anything at the card's foot: who builds it and how many are built. */
  readonly foot?: string;
}

export function shopCardPane(options: ShopCardOptions): string {
  const head = `<div class="shop-head is-${options.head.tone}"><span>${options.head.title}</span>${options.head.note ? `<span>${options.head.note}</span>` : ''}</div>`;
  const top = options.art || options.show
    ? `<div class="shop-show">${options.art ? `<div class="shop-art">${options.art}</div>` : ''}${options.show ?? ''}</div>`
    : '';
  const line = options.line ? `<p class="shop-line px-wrap">${options.line}</p>` : '';
  const blocked = options.blocked ? `<span class="px-wrap px-warning">${options.blocked}</span>` : '';
  const go = options.go
    ? `<p class="shop-go"><span class="shop-key">${options.go.key}</span><span>${options.go.label}</span></p>`
    : '';
  return `<div class="px-detail shop-card" data-shown-by="${escapeAttribute(options.id)}"${options.shown ? '' : ' hidden'}>${head}${top}${line}${options.parts ?? ''}${blocked}${go}${options.foot ?? ''}</div>`;
}

/** One part a deal or a build takes: its picture and how many, green when there is enough, grey and crossed when not. */
export function partTag(icon: string, quantity: number, held: number): string {
  const short = held < quantity;
  return `<span class="part-tag${short ? ' is-short' : ''}">${short ? SHORT_MARK : ''}${icon}<small>×${quantity}</small></span>`;
}

/**
 * A row of part tags, with ALL HERE and a drawn tick when every one is covered
 * - or, for a deal held back for something other than parts, what holds it
 * back (`lock`: the padlock and the standing it needs) in that place, never
 * both: ALL HERE beside a lock read as "go" and "no" at once.
 */
export function partTags(
  tags: readonly { readonly icon: string; readonly quantity: number; readonly held: number }[],
  label?: string,
  lock?: string,
): string {
  const all = tags.every((tag) => tag.held >= tag.quantity);
  const end = lock ?? (all ? '<span class="px-tag px-tag-good has-tick">All here</span>' : '');
  return `<div class="shop-parts">${label ? `<small class="px-label">${label}</small>` : ''}<span class="part-tags">${tags
    .map((tag) => partTag(tag.icon, tag.quantity, tag.held))
    .join('')}${end}</span></div>`;
}
