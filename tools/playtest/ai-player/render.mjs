// `describe()` as a few short lines, which is what the AI reads after every
// action: the whole JSON is there with `look --json`, but a line per thing is
// a tenth of the tokens and reads the way a player takes in a screen.

const tile = (t) => (t ? `${t.x},${t.y}` : '?');
const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const list = (items, limit = 12) =>
  items.length > limit ? `${items.slice(0, limit).join('; ')}; ... ${items.length - limit} more` : items.join('; ');

function renderField(key, field) {
  const lines = [];
  const where = key === 'world'
    ? [field.mapName, field.place, field.inside].filter(Boolean).join(' / ')
    : [field.place, field.room ? `room ${field.room}` : null].filter(Boolean).join(' / ');
  lines.push(`HERE: ${key === 'world' ? 'raid' : 'harbour'} - ${where || '?'} - tile ${tile(field.tile)} facing ${field.facing}${field.walking ? ' (walking)' : ''}`);
  if (field.dialogue) lines.push(`SAYS: "${field.dialogue.text}"${field.dialogue.complete ? '' : ' (still typing)'}${field.dialogue.boxesLeft > 1 ? ` (+${field.dialogue.boxesLeft - 1} more)` : ''}`);
  if (field.choice) lines.push(`QUESTION: ${field.choice.question ? `"${field.choice.question}" ` : ''}${field.choice.options.map((o, i) => (i === field.choice.selected ? `[${o}]` : o)).join(' / ')}`);
  if (field.hint) lines.push(`HINT: ${field.hint}`);
  const raid = field.raid;
  if (raid) {
    lines.push(`RAID: ${clock(raid.remainingMs)} left${raid.enraged ? ' (ENRAGED)' : ''}${raid.contract ? ` - job: ${raid.contract}` : ''}`);
    if (raid.way) lines.push(`ARROW: ${raid.way.cue ?? ''}${raid.way.toward ? ` -> ${tile(raid.way.toward)}${raid.way.out ? ' (way out)' : ''}` : ''}`);
    if (raid.stopsLeft.length) lines.push(`STOPS LEFT: ${list(raid.stopsLeft.map((s) => `${s.label}${s.tile ? ` ${tile(s.tile)}` : ''}`))}`);
    if (raid.exits.length) lines.push(`NEAREST EXITS: ${list(raid.exits.map((e) => `${e.label} ${tile(e.tile)} ${e.open ? 'open' : 'shut'}`), 4)}`);
    const hunter = raid.hunter;
    if (hunter.coming || hunter.here) lines.push(`HUNTER: ${hunter.here ? `on screen at ${hunter.here.map(tile).join(', ')}` : 'coming'}`);
    if (raid.found.length) lines.push(`FOUND THIS RAID: ${list(raid.found)}`);
  }
  const near = field.near ?? {};
  const seen = [
    ...(near.doors ?? []).map((d) => `door ${d.name} ${tile(d.tile)}`),
    ...(near.things ?? []).map((t) => `${t.name} ${tile(t.tile)}`),
    ...(near.trainers ?? []).map((t) => `trainer ${t.name} ${tile(t.tile)}${t.beaten ? ' (beaten)' : ''}${t.boss ? ' (boss)' : ''}`),
    ...(near.people ?? []).map((p) => `${p.pokemon ? `pokemon ${p.pokemon}` : p.kind} ${tile(p.tile)}`),
    ...(near.loot ?? []).map((l) => `item ${l.item} ${tile(l.tile)}`),
    ...(near.landmarks ?? []).map((l) => `landmark ${l.label} ${tile(l.tile)}${l.searched ? ' (searched)' : ''}`),
  ];
  if (near.exit) seen.push(`way out of the room ${tile(near.exit)}`);
  if (near.rim) seen.push(`the rim (jump in from here) ${tile(near.rim)}`);
  if (seen.length) lines.push(`ON SCREEN: ${list(seen, 24)}`);
  const captions = (near.captions ?? []).map((c) => c.text).filter(Boolean);
  if (captions.length) lines.push(`CAPTIONS: ${list([...new Set(captions)], 12)}`);
  return lines;
}

const member = (m) => `${m.name} L${m.level} ${m.hp}/${m.maxHp}${m.status ? ` ${m.status}` : ''}`;

export function renderScreen(screen, { events = [], advice = null, note = null } = {}) {
  if (!screen) return 'NO SCREEN';
  const lines = [];
  if (note) lines.push(`RESULT: ${note}`);
  lines.push(`SCENES: ${screen.scenes.join(' > ')}${screen.busy ? ` (busy: ${screen.busy})` : ''}`);
  const topKey = screen.scenes[screen.scenes.length - 1];
  const battle = screen.scene.battle;
  if (battle && battle.yours) {
    lines.push(`BATTLE${battle.trainer ? ` vs ${battle.trainer}` : ' (wild)'}: ${member({ ...battle.yours, name: battle.yours.name })} vs ${battle.foe ? member(battle.foe) : '?'}${battle.foesLeft ? ` (${battle.foesLeft} left)` : ''}`);
    if (battle.message) lines.push(`BATTLE SAYS: "${battle.message.text}"`);
    if (battle.commands.length) lines.push(`COMMANDS (${battle.mode}): ${battle.commands.map((c, i) => (i === battle.cursor ? `[${c}]` : c)).join(' / ')}`);
    if (battle.mode === 'moves') lines.push(`MOVES: ${battle.moves.map((m) => `${m.name} ${m.type} pow ${m.power} pp ${m.pp}/${m.maxPp} ${m.against}`).join('; ')}`);
  }
  for (const key of ['world', 'base']) {
    if (screen.scene[key] && (topKey === key || (!battle && screen.scenes.includes(key) && !screen.scene.world))) {
      lines.push(...renderField(key, screen.scene[key]));
    }
  }
  const listed = Object.values(screen.scene).find((part) => Array.isArray(part?.choices));
  if (listed) {
    if (listed.question) lines.push(`ASKS: ${listed.question}`);
    lines.push(`CHOICES: ${listed.choices.map((c) => `${c.cursor ? '[' : ''}${c.label}${c.cursor ? ']' : ''}${c.off ? '(off)' : ''}${c.detail ? ` (${c.detail})` : ''}`).join(' / ')}`);
  }
  const result = screen.scene.extraction;
  if (result?.outcome) lines.push(`RAID OVER: ${result.outcome} - ${result.headline} (${result.clock})`);
  if (screen.menu) {
    lines.push(`MENU: ${screen.menu.heading ?? '(no heading)'}`);
    lines.push(`MENU TEXT: ${screen.menu.text.slice(0, 400)}`);
    lines.push(`CONTROLS: ${list(screen.menu.controls.map((c) => `[${c.label}]${c.disabled ? '(off)' : ''}${c.focused ? '(focus)' : ''}${c.selected ? '(on)' : ''}`), 30)}`);
  }
  if (!screen.menu && !battle && !['world', 'base'].includes(topKey)) {
    const words = [...new Set(screen.texts.map((t) => t.text))];
    if (words.length) lines.push(`ON SCREEN TEXT: ${list(words, 20)}`);
  }
  const team = screen.scene.world?.team ?? screen.scene.base?.team;
  if (team?.length) lines.push(`TEAM: ${team.map(member).join('; ')}`);
  const bag = screen.scene.world?.bag ?? screen.scene.base?.vault;
  if (bag && Object.keys(bag).length) lines.push(`${screen.scene.world ? 'PACK' : 'VAULT'}: ${list(Object.entries(bag).map(([k, v]) => `${k} x${v}`), 14)}`);
  if (screen.progress) {
    const p = screen.progress;
    lines.push(`PROGRESS ${p.done}/${p.total}: ${p.milestones.map((m) => `${m.done ? '[x]' : '[ ]'} ${m.label}${m.count ? ` ${m.count.have}/${m.count.need}` : ''}`).join('; ')}`);
  }
  const story = events.filter((e) => e.kind !== 'scene');
  if (story.length) {
    lines.push('SINCE LAST ACTION:');
    for (const e of story.slice(-15)) {
      const detail = e.text ?? e.label ?? e.place ?? e.outcome ?? e.foe ?? e.milestone ?? e.message ?? '';
      lines.push(`  ${e.kind}${detail ? `: ${detail}` : ''}`);
    }
  }
  if (advice) lines.push(`ADVICE: ${advice}`);
  return lines.join('\n');
}
