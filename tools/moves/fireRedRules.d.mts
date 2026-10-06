/**
 * The rules' own shape, declared so `moveFireRed.test.ts` can hold the
 * catalogue to the same derivation the generator uses. Nothing else in `src/`
 * reads a tool.
 */
export declare const statEffectOf: (effect: string) => {
  readonly self: boolean;
  readonly changes: readonly { readonly stat: string; readonly change: number }[];
} | null;
