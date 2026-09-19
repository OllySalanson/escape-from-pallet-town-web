/**
 * The generator's own shape, declared so `speciesImport.test.ts` can import it
 * and hold the committed files to what it would write today. Nothing else in
 * `src/` reads a tool.
 */
export declare const generated: () => { readonly path: string; readonly contents: string }[];
