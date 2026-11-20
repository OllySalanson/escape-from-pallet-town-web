# The AI-feel sweep

`npm run vale` runs [Vale](https://github.com/vale-cli/vale) over the words the
game says - only the contents of string literals in the TypeScript
(`styles/config/views/Strings.yml`), never code or comments - with the `Tells`
style (`styles/Tells/`): uncontracted speech, stock comfort, the "not X but Y"
shape, stock words and names, the em dash.

- `npm run vale` - every alert, by file. Warnings only: it always exits 0.
- `npm run vale -- --summary` - counts by rule.
- `npm run vale -- --report=docs/ai-feel/uncontracted-lines.md` - every
  uncontracted line, grouped by who says it.
- `npm run vale -- <file.ts> ...` - just these files.
- `--strict` exits 1 on an error-level alert (a stock AI name, an em dash), for
  CI once the captain wants it there.

It sweeps `src/` and the district programs under `tools/mapcraft/worlds/`
(where Greystone Vale's people are written), and skips tests, every
`generated/` folder (canon FireRed text), the vendored console games and the map
names' word banks (`run.mjs`'s `SKIP`). Vale itself is a pinned release fetched
once into `node_modules/.cache/vale` and checked against its published
checksums; `vale sync` fetches the TypeScript grammar into
`styles/config/grammars/` (not committed).

Every alert is a question for a person, never a fix to apply blind: some
characters are formal on purpose. `docs/ai-feel/README.md` is who.
