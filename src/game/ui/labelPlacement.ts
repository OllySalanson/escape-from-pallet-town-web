/**
 * Where a map caption is allowed to sit.
 *
 * A caption belongs to a thing in the world but is read on a screen, and the
 * screen already has tenants: the raid HUD owns the top corners, the view has
 * four edges, the map is full of other things with captions of their own, and
 * people are standing on it. Left to hang wherever its landmark happens to be,
 * a caption ran off the screen, slid under the raid clock, sat on the icon it
 * was naming, stacked flush against its neighbour and started over a trainer's
 * feet.
 *
 * This is that rule, once, as arithmetic, and it is solved for every caption on
 * the screen together because most of those failures are one caption against
 * another. A caption is tried on each side of what it names, slid along that
 * side, and takes the first seat that is entirely clear. One with no clear seat
 * is not drawn: half a caption, or a caption over the thing it explains, says
 * less than none. It is Phaser-free so the rule is testable rather than
 * eyeballed, in the manner of `raidHud.ts` and `battlePresentation.ts`.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The side a caption is authored to prefer. */
export type CaptionSide = 'above' | 'below';

/** The side it ended up on: beside its subject is a seat too, when neither row is clear. */
export type CaptionSeat = CaptionSide | 'left' | 'right';

export interface CaptionRequest {
  /** The thing being named, as the rectangle of map it is drawn on. */
  readonly subject: Rect;
  readonly width: number;
  readonly height: number;
  /**
   * The side the caption is authored to prefer. A trainer watching north is
   * captioned below themselves so the caption never covers the watched lane.
   */
  readonly preferred: CaptionSide;
  /**
   * The seat this caption took last frame. A caption keeps a seat that is still
   * clear: both the view and the HUD move under it while the player walks, and
   * one that re-decided every frame would flicker between two equal answers.
   */
  readonly held?: number;
  /**
   * True for a caption that prices a step rather than naming a place: a
   * trainer's watch, whose third line is that the fight cannot be left. It is
   * seated before every caption that only names something, whatever order they
   * were asked for in. A boss stands at the gate they hold, so their warning
   * and the gate's name want the same ground - and seated in the order they
   * were created, the name took it and the warning went undrawn.
   */
  readonly warns?: boolean;
}

export interface CaptionSurroundings {
  /** The camera view, in the same space as the subjects. */
  readonly bounds: Rect;
  /** Screen furniture - the raid HUD's chips - in the same space. */
  readonly furniture: readonly Rect[];
  /**
   * Map art and people no caption may cover: every captioned subject is already
   * counted, so this is the rest - signs, crates, standing figures, the ground a
   * trainer is watching.
   */
  readonly keepClear: readonly Rect[];
  /**
   * Ground that is drawn *over* captions: a tree's crown, the span of an arch,
   * anything a figure walks under. Writing sits beneath figures so that it never
   * covers a person, and a canopy sits above them so that a wood has an inside -
   * which leaves a caption seated here hidden by the very thing it is beside.
   * The first map with a real canopy showed a shut gate's caption as `SLUICE GA`
   * and `PER DANE` either side of its own gatehouse. So a canopy is ground a
   * caption may not take, exactly as a person is, and the ordinary order of
   * seats does the rest: the other row, slid along it, then beside the subject.
   */
  readonly canopy: readonly Rect[];
}

export interface CaptionPlacement {
  /** Top-left of the caption window. */
  readonly x: number;
  readonly y: number;
  readonly seat: CaptionSeat;
  /** Which candidate this is, to hand back as `held` next frame. */
  readonly candidate: number;
  /** False when the subject is off screen, or when nowhere around it is clear. */
  readonly visible: boolean;
}

/** Kept off the very edge so a slid caption still reads as a window. */
export const VIEW_INSET = 3;
/** Clear ground between a caption and the thing it names. */
export const SUBJECT_GAP = 3;
/** Clear ground between a caption and a neighbour, so two windows never read as one. */
export const NEIGHBOUR_GAP = 2;

const overlap = (a: Rect, b: Rect): number => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
};

const inflate = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

const clamp = (value: number, minimum: number, maximum: number, fallback: number): number =>
  maximum < minimum ? fallback : Math.min(Math.max(value, minimum), maximum);

/**
 * A subject is on screen while its centre is. A caption whose subject has
 * scrolled off goes with it rather than being dragged back to the edge, which
 * would pin a row of captions along the view naming landmarks the player cannot
 * see; and it goes whole, because the alternative was `EXTRACT OPENS IN 27s`
 * with its bottom half under the edge of the screen.
 */
function isOnScreen(subject: Rect, bounds: Rect): boolean {
  const x = subject.x + subject.width / 2;
  const y = subject.y + subject.height / 2;
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}

interface Candidate {
  readonly x: number;
  readonly y: number;
  readonly seat: CaptionSeat;
}

/**
 * Every seat a caption may take, best first: the authored side, then the other
 * row, then beside the subject. Each is offered centred and then slid to either
 * end of the subject, and every one is pulled inside the view along its own
 * axis - so a caption near an edge slides along its row rather than leaving it.
 */
function candidatesFor(request: CaptionRequest, bounds: Rect): Candidate[] {
  const { subject, width, height, preferred } = request;
  const minimumX = bounds.x + VIEW_INSET;
  const maximumX = bounds.x + bounds.width - VIEW_INSET - width;
  const minimumY = bounds.y + VIEW_INSET;
  const maximumY = bounds.y + bounds.height - VIEW_INSET - height;
  const middleX = Math.round(bounds.x + (bounds.width - width) / 2);
  const middleY = Math.round(bounds.y + (bounds.height - height) / 2);
  const slideX = (x: number): number => clamp(Math.round(x), minimumX, maximumX, middleX);
  const slideY = (y: number): number => clamp(Math.round(y), minimumY, maximumY, middleY);

  const centredX = subject.x + subject.width / 2 - width / 2;
  const centredY = subject.y + subject.height / 2 - height / 2;
  const columns = [centredX, subject.x, subject.x + subject.width - width];
  const rows = [centredY, subject.y, subject.y + subject.height - height];

  const row = (seat: CaptionSide): Candidate[] => {
    const y = seat === 'above' ? subject.y - SUBJECT_GAP - height : subject.y + subject.height + SUBJECT_GAP;
    return columns.map((x) => ({ x: slideX(x), y: Math.round(y), seat }));
  };
  const column = (seat: 'left' | 'right'): Candidate[] => {
    const x = seat === 'left' ? subject.x - SUBJECT_GAP - width : subject.x + subject.width + SUBJECT_GAP;
    return rows.map((y) => ({ x: Math.round(x), y: slideY(y), seat }));
  };

  return [
    ...row(preferred),
    ...row(preferred === 'above' ? 'below' : 'above'),
    ...column('right'),
    ...column('left'),
  ];
}

/**
 * How much of a seat is somewhere a caption may not be, in pixels of its own
 * area: outside the view, under the HUD, over map art or a person, under a
 * canopy, or against a caption already seated.
 */
function intrusion(rect: Rect, surroundings: CaptionSurroundings, seated: readonly Rect[]): number {
  const view = inflate(surroundings.bounds, -VIEW_INSET);
  const outside = rect.width * rect.height - overlap(rect, view);
  const against = (others: readonly Rect[], gap: number): number =>
    others.reduce((total, one) => total + overlap(rect, inflate(one, gap)), 0);
  return (
    outside +
    against(surroundings.furniture, NEIGHBOUR_GAP) +
    against(surroundings.keepClear, 0) +
    against(surroundings.canopy, 0) +
    against(seated, NEIGHBOUR_GAP)
  );
}

/** Why one seat was refused, as the pixels of it that each kind of obstacle took. */
export interface SeatRefusal {
  readonly seat: CaptionSeat;
  readonly x: number;
  readonly y: number;
  readonly outsideView: number;
  readonly underHud: number;
  readonly overMapArt: number;
  readonly underCanopy: number;
  readonly againstCaption: number;
}

/**
 * Every seat a caption was offered and what was wrong with each, in the order
 * they are tried. For the question a screenshot cannot answer: a caption is
 * missing, so which of five things is in every one of its twelve seats? Guessed
 * at, the answer was three trees, and felling them changed nothing.
 */
export function explainSeats(
  request: CaptionRequest,
  surroundings: CaptionSurroundings,
  seated: readonly Rect[] = [],
): SeatRefusal[] {
  const view = inflate(surroundings.bounds, -VIEW_INSET);
  const against = (rect: Rect, others: readonly Rect[], gap: number): number =>
    others.reduce((total, one) => total + overlap(rect, inflate(one, gap)), 0);
  return candidatesFor(request, surroundings.bounds).map((candidate) => {
    const rect: Rect = { x: candidate.x, y: candidate.y, width: request.width, height: request.height };
    return {
      seat: candidate.seat,
      x: candidate.x,
      y: candidate.y,
      outsideView: rect.width * rect.height - overlap(rect, view),
      underHud: against(rect, surroundings.furniture, NEIGHBOUR_GAP),
      overMapArt: against(rect, surroundings.keepClear, 0),
      underCanopy: against(rect, surroundings.canopy, 0),
      againstCaption: against(rect, seated, NEIGHBOUR_GAP),
    };
  });
}

/**
 * The order captions are seated in, as indices into the requests: warnings
 * first, then names, each in the order they were asked for. Exported so a tool
 * explaining a missing caption can name what was seated before it.
 */
export function seatingOrder(requests: readonly CaptionRequest[]): number[] {
  const asked = requests.map((_, index) => index);
  return [
    ...asked.filter((index) => requests[index].warns === true),
    ...asked.filter((index) => requests[index].warns !== true),
  ];
}

/**
 * Seats every caption on the screen. Order is priority: an earlier request is
 * seated first and a later one has to fit around it - and a warning is earlier
 * than any name (`seatingOrder`). The placements come back in the order the
 * requests were made.
 */
export function placeCaptions(
  requests: readonly CaptionRequest[],
  surroundings: CaptionSurroundings,
): CaptionPlacement[] {
  // No caption may cover any subject, its own included, so they are all
  // obstacles before the first caption is seated.
  const everySubject = requests.map((request) => request.subject);
  const around: CaptionSurroundings = {
    ...surroundings,
    keepClear: [...surroundings.keepClear, ...everySubject],
  };
  const seated: Rect[] = [];
  const placements: CaptionPlacement[] = [];

  const place = (request: CaptionRequest): CaptionPlacement => {
    const candidates = candidatesFor(request, surroundings.bounds);
    const rectOf = (candidate: Candidate): Rect => ({
      x: candidate.x,
      y: candidate.y,
      width: request.width,
      height: request.height,
    });
    const hidden = (index: number): CaptionPlacement => ({
      ...candidates[index],
      candidate: index,
      visible: false,
    });

    if (!isOnScreen(request.subject, surroundings.bounds)) {
      return hidden(0);
    }

    const isClear = (index: number): boolean =>
      intrusion(rectOf(candidates[index]), around, seated) === 0;
    const held =
      request.held !== undefined && request.held < candidates.length && isClear(request.held)
        ? request.held
        : -1;
    const index = held >= 0 ? held : candidates.findIndex((_, at) => isClear(at));
    if (index < 0) {
      return hidden(0);
    }

    seated.push(rectOf(candidates[index]));
    return { ...candidates[index], candidate: index, visible: true };
  };

  for (const index of seatingOrder(requests)) {
    placements[index] = place(requests[index]);
  }
  return placements;
}

/**
 * Where the dialogue box sits when it speaks about someone.
 *
 * It belongs at the bottom of the screen. But a line the world raises by itself
 * is about a person - the hunter arriving, a trainer who saw you - and when that
 * person stood south of the player the box announcing them was drawn over them.
 * The box goes to the top when the bottom would cover anyone it is about and
 * the top would cover fewer of them; a tie stays at the bottom, because a box
 * that moved for no gain is one more thing to find.
 */
export function placeDialog(request: {
  /** The screen, and the box on it, in screen pixels. */
  readonly viewHeight: number;
  readonly box: { readonly x: number; readonly width: number; readonly height: number };
  readonly margin: number;
  /** Who the line is about, in screen pixels. */
  readonly about: readonly Rect[];
}): { readonly y: number; readonly edge: 'top' | 'bottom' } {
  const { viewHeight, box, margin, about } = request;
  const at = (y: number): Rect => ({ x: box.x, y, width: box.width, height: box.height });
  const covered = (y: number): number => about.filter((one) => overlap(at(y), one) > 0).length;
  const bottom = viewHeight - box.height - margin;
  return covered(margin) < covered(bottom) ? { y: margin, edge: 'top' } : { y: bottom, edge: 'bottom' };
}
