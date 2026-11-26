/**
 * The window's size, as the game is laid out in it.
 *
 * Not `innerWidth` and `innerHeight`: on a phone those are the layout
 * viewport, which a mobile browser widens to take in whatever overflows the
 * page. Turned from its side to upright, a phone still holds the landscape
 * layout when the resize arrives - the pad's right-hand column standing 900
 * pixels across a 412-wide screen - so `innerWidth` read 641 and `innerHeight`
 * 1424, the game was laid out for that, wider than the phone, and the pad was
 * placed below the bottom of the screen with nothing left to bring it back.
 * The root element's client box is the window itself whatever the page holds.
 * `inner*` stands in where it reads nothing (no layout yet).
 */
export interface ViewportHost {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly document: { readonly documentElement: { readonly clientWidth: number; readonly clientHeight: number } | null };
}

export function viewportSize(host: ViewportHost = window): { readonly width: number; readonly height: number } {
  const root = host.document.documentElement;
  return {
    width: root && root.clientWidth > 0 ? root.clientWidth : host.innerWidth,
    height: root && root.clientHeight > 0 ? root.clientHeight : host.innerHeight,
  };
}
