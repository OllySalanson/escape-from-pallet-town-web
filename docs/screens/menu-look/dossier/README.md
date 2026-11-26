# A Pokémon's stats as bars

The pane under a list of Pokémon (`ui/pokemonDossier.ts`: Bill's PC, the raid's party) listed its five stats as words in pairs. They are bars now, one a row - the name, a bar against the same top for all five, the number - the shared part YOUR TEAM's card draws (`pixelStatBar`, `.px-stat`), so which stat is strongest is seen, not read.

`before-bills-pc.png` is after the foundation re-skin; `after-bills-pc.png` is this change. Made with `tools/playtest/menusAudit.mjs <build> <out> --only=pokemon-centre-stash` at 1280x800.
