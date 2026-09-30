# LORE

**Library Of RPG Essentials**

*[Dieses Dokument auf Deutsch: README.de.md](README.de.md)*

Tools for tabletop RPG campaigns in one window. No account, no cloud:
everything stays on your disk. The only exception is the optional AI
connection you set up yourself.

- **Initiative Tracker**: turn order, hit points, conditions with a duration,
  terrain events, groups for hordes.
- **Dice**: d4 to d100 plus a custom die, flat or 3D, subtraction included.
- **Story Creator**: characters, places, relationships as Markdown notes with
  wiki links.
- **Character Sheet**: a small D&D 5.5e sheet that does the maths.
- **NPC Creator**: background characters from tables or AI.
- **Inspiration**: scaffold for a new campaign (hook, factions, characters,
  places, connections, timeline).
- **Monster Creator**: homebrew monsters, checked against CR baselines.
- **Status Effect Creator**: custom conditions with levels, weighed against
  the official ones.
- **Encounter Creator**: encounters from 331 SRD monsters and your own,
  difficulty per the rules, one click into the tracker.
- **Magic Item Creator**: magic items by type and rarity, values per the SRD.
- **Loot Generator**: your own nested random tables.
- **Reference**: SRD glossary, equipment, 339 spells, 258 magic items,
  offline in both languages, with house rules and notes.
- **TTRPG Map Editor**: battlemaps and world maps, export as Universal VTT.

Names and icons are provisional.

## Download

1. **Actions** tab → topmost **Build** run
2. **Artifacts** → download and unpack `lore-windows`
3. `LORE-Setup-<version>.exe` (installer) or `LORE-portable-<version>.exe`

- SmartScreen warns because the file is unsigned: "More info" → "Run anyway".
- Artifacts expire after one day; releases keep the files permanently.

## Building

Run commands inside the project folder, and **run `npm install` after every
`git pull`** (`scripts/pruefe-installation.mjs` checks this).

```bash
npm install
npm run dev             # shell with hot reload
npm start               # production build
npm test                # core logic, all workspaces
npm run typecheck
npm run smoke           # smoke test of the built shell
npm run smoke:backstory # Story Creator smoke test (separate run)
npm run roundtrip       # saving does not change the Markdown
npm run dist:win        # Windows installer into apps/shell/release/
```

- `scripts\bauen-win.cmd`: pull, install and build in one go on Windows.
- One tool alone: `npm run dev:backstory` (also `dev:mapmaker`,
  `dev:initiative`, `dev:dice`, `dev:npc`).
- One workspace: `npm run <script> -w apps/backstory`.
- Suite packages: `npm run dist:suite:win`, `dist:suite:linux`, then
  `npm run verify:package:suite -- <path>`.

### Layout

```
apps/shell/           Shell: window, start menu, rail, settings, sharing
apps/backstory/       Story Creator
apps/mapmaker/        TTRPG Map Editor (also a Tauri app)
apps/initiative/      Initiative Tracker
apps/dice/            Dice
apps/npc/             NPC Creator
apps/inspiration/     Inspiration
apps/monster/         Monster Creator
apps/zustaende/       Status Effect Creator
apps/encounter/       Encounter Creator
apps/nachschlagewerk/ Reference
apps/magicitems/      Magic Item Creator
apps/loot/            Loot Generator
packages/dice/        Dice expressions
packages/i18n/        Language and text substitution
packages/motion/      Timings and animations
packages/ki/          Language models (Ollama, Claude, OpenAI-compatible)
packages/umgebungen/  Environments
packages/einstellungen/ Tool settings described for the shell
packages/foundry/     Foundry VTT JSON export
packages/farben/      Colour roles and themes
packages/eintraege/   Entries every tool understands (search, sharing)
packages/tabellen/    Random tables
packages/uebergabe/   Encounter handover between tools
packages/srd/         SRD 5.2.1 content in both languages
```

`packages/*` are platform-free (no `node:*`, no `electron`, no browser
globals).

## The shell

- **Ctrl+K** searches all tools at once, read fresh from disk.
- **Backup**: Settings → Backup writes one ZIP of the whole data folder
  (without the API key). Restore by unpacking into the data folder.
- **Share**: pack entries (notes, monsters, house rules, …) into one Markdown
  file, or open a room on the local network with chat and packages. With a
  password the room is encrypted; without one it is not, and the app says so.
- **Themes and interface size** (80–200 %) apply to every tool.
- **Settings in one place**: each tool describes its fields
  (`packages/einstellungen`), the shell draws them.
- **Back/forward** with the mouse side buttons or Alt+arrow.
- Tools stay loaded once opened (about 130 MB each), each in its own Electron
  session. The Story Creator is loaded in the background when another tool
  sends it something.
- An introduction on first start and per tool; can be reset in the settings.
- Data folder: `%APPDATA%\LORE` (older installs: `%APPDATA%\TTRPG-Tools`).
- Start in one tool: `TTRPG_TOOLS_START_APP=backstory`.

**Own icons**: put `<tool id>.png` (PNG, JPG, WebP, GIF, max 2 MB, no SVG)
into `symbole/` in the data folder (local) or `apps/shell/symbole/` (ships
with the app). See `apps/shell/symbole/LIESMICH.md`.

## AI

Set up once in the shell's settings: **Ollama** (local), **Claude API** or
any **OpenAI-compatible** service. The key is encrypted with the system
keychain and never reaches a renderer. Everything works without AI.

## Story Creator

Notes are Markdown with a YAML header, readable in any editor or Obsidian.

| Action | How |
| --- | --- |
| Link, create from a link, link selected text | type `[[` |
| Open a link | Ctrl+click |
| Find and replace | Ctrl+F, F3 / Shift+F3 |
| Rename, delete (with undo) | right-click in the note list |
| Cut, copy, paste, spelling suggestions | right-click in the text |
| Zoom (20–500 %) | Ctrl+wheel, Ctrl+Plus/Minus/0 |
| Backup, restore, note types | "Campaign" menu |
| Image | ▣ button or drag in |
| Export (MD, PDF), history, graph, help | header buttons |

- A note belongs to one **campaign** and links only within it.
- **Note types** are defined per campaign in `campaign.json`.
- **Wiki links** follow renames; missing targets are listed under "Open
  links". Renaming by title happens when you leave the field.
- **Relationships** are directed and stored per note pair.
- **Images** are copied into `assets/`.
- **History** saves at most every two minutes; restoring can be undone.
- **Deleted notes** go to a trash folder (`trash/` in the storage folder, the
  last 20 per campaign); "Undo" in the notice brings them back with their
  relationships.
- **Spelling** checks like the interface, fixed German or English, or not at
  all (settings).
- **Writing prompts** insert at the cursor; prompts for the note type
  (character, place, faction, event) come first.
- **The assistant** never writes into your text.
- **The Markdown survives**: comments, link titles, `<angle>` links and tight
  lists come out as they went in.
- **Export**: PDF with table of contents, graph and jump links; Markdown with
  an alias header where the file name differs from the title.

## Character Sheet

- A small sheet for D&D 5.5e (2024): abilities, saves, 18 skills with
  proficiency and expertise, AC, initiative, HP, Hit Point Dice, conditions,
  exhaustion, Heroic Inspiration, attacks, notes.
- Works out modifiers, proficiency bonus, skills and passive Perception.
- **Damage / Healing**: `-7` or `7` subtracts, `+5` heals, dice work
  (`2d6+3`); temporary HP first. Rests follow SRD 5.2.
- **Spells**: save DC and attack, slots per level (Pact Magic too), list
  from the 339 SRD spells or your own; casting spends a slot.
- **Inventory**: items with weight and value, money in PP/GP/EP/SP/CP,
  party inventories, give and split between sheets; weights in lb and kg.
- **In the room**: bring your sheet in; the host keeps the shared state.
  Each sheet shows others nothing, an overview or everything. GMs can
  change any sheet; their changes are marked for the owner unless the GM
  switches to "change quietly". Several GMs are possible, the role can be
  handed on (right-click a name under Share → Room).
- Saves itself as Markdown (`docs/charakterbogen.md`).

## Initiative Tracker

- **Groups**: one initiative, separate hit points per body.
- **Conditions** with a duration count down by themselves. SRD and your own
  conditions are suggested, with the rule text on hover.
- **Terrain events** act on initiative 20, after characters with 20.
- **Space** = next turn. The damage field calculates (`2d6+3`); a leading
  `+` or `-` heals. Enter applies, Escape discards.
- **AC, temp HP, "out"** have their own fields.
- Changing an initiative re-sorts; the active row stays and scrolls into view.
- **Stat block** on click for monsters from the Encounter Creator.
- **Ctrl+Z / Ctrl+Y** undo and redo everything in the fight.
- Encounters are Markdown files in a searchable collection; the running fight
  (including the tactics note) is saved as JSON next to them.

## NPC Creator

- Name, species, occupation, feature, goal, secret, quirk; each field can be
  rerolled, locked or edited.
- Sound of the name: feminine, masculine, neutral.
- With AI the model suggests freely; without, the tables apply.
- **Export** creates a note in the chosen campaign, species filled into the
  profile. If it already exists, the button offers "Update it there".
- The **shortlist** survives a restart.

## Inspiration

- Six blocks: hook, factions, characters, places, connections, timeline.
- Works without AI (over a million combinations per block).
- Dials: scope, region, theme, tone. Lock or edit any block.
- Existing characters from the campaign can be pulled in.
- The web of characters as a picture, full screen on click.
- "Start a map" opens the Map Editor with the place's notes as pins.
- "All from AI" drafts all six blocks in one consistent answer.
- **Taking it over** creates notes plus an overview in the chosen campaign.
  Existing ones are skipped or, on request, updated.

Concept: `docs/inspirationshilfe.md` (German).

## Monster Creator

- **The check** computes defensive and offensive CR separately and says
  what to change; each suggestion is a button.
- AI numbers are pulled onto the target CR (with a way back); your own
  numbers only get a warning.
- **2024-style stat block**: abilities, speed, initiative, passive
  perception, CR with XP, spelled-out attacks.
- Resistances and immunities are optional and priced into the hit points.
- **Edit** after rolling; the check recalculates live. "Save as new" keeps
  the original.
- **Own conditions** (separate checkbox): at most one per monster. The save
  follows the theme: CON (cold, venom, blood, …), DEX (fire), STR (storm),
  WIS (madness, dream), INT (void, time), CHA (sound, shadow, curse).
- **Check an existing monster** by typing in its numbers.
- Collection with search (`undead 4`, `cr 3-6`); files are Markdown with all
  numbers in the header.

Baselines from a CC-BY source, see [NOTICE.md](NOTICE.md).

## Status Effect Creator

- Conditions with levels, seventeen themes, levels as bullet points.
- **Weight** compared to known conditions ("about Exhaustion 5").
- **Timescales** of duration, relief and worsening must match; a mismatch
  is flagged.
- **Deadline** (round, hour, day) and saving throw with DC and timing.
- Blessings read "stronger/weaker" instead of "worse/better".
- **Packages**: several conditions sharing a theme.
- **Card to read aloud**: player text in front, rule on the back.
- "Save as new" keeps the original.

## Encounter Creator

- The rating sits under the opponents and names all three budgets.
- Build to a target CR or to the difficulty for your party.
- Into the tracker in one click, each monster with its stat block.

More: `docs/encounter.md` (German).

## Reference

- SRD rules offline, with cross-references and hover previews.
- House rules in Markdown; `[[` suggests entries to link.
- Notes on any passage.

More: `docs/nachschlagewerk.md` (German).

## Dice

- Shape tells the kinds apart; colour and pattern apply to all.
- One number per kind, negative allowed: left-click adds, right-click
  subtracts.
- Effects on max roll and on a 1, switchable.
- History of 40 rolls per session.
- **3D** (off by default, needs graphics acceleration): the result comes
  from `wuerfle()`, the physics only animates it.

## TTRPG Map Editor

`apps/mapmaker` has its own history and `CLAUDE.md`. Workspace changes:
`base: './'` in `vite.config.ts` and a typing workaround for the Vite
plugins. The Rust side, `e2e/` and `build:portable` are not part of CI.

## Where the data lives

```
<Story Creator location>/        changeable under Settings → Storage location
  campaigns/<id>/campaign.json
  campaigns/<id>/notes/<noteId>.md
  campaigns/<id>/assets/
  campaigns/<id>/history/<noteId>/
  writing-prompts.<lang>.json

<user data directory>/
  einstellungen.json             language, AI, encrypted key
  fenster.json                   window size and position
  symbole/                       your own icons
```

- Markdown files dropped into `notes/` are read along.
- A restored campaign always gets a new ID.
- Every file carries a `schemaVersion`.

## Tests

| Command | Checks |
| --- | --- |
| `npm test` | core logic |
| `npm run typecheck` | types |
| `npm run smoke` | built shell and all tools |
| `npm run smoke:backstory` | Story Creator (separate run!) |
| `npm run roundtrip` | Markdown unchanged by saving |
| `npm run verify:package:suite -- <path>` | packaged build starts |

## Limits

- Switching campaigns loads every note (fine for a few hundred).
- Renaming writes files one by one; a crash in between leaves some links on
  the old name.
- Ambiguous titles or aliases are not flagged in the interface.

Open tasks: [BACKLOG.md](BACKLOG.md). Manual release checks:
[TESTLISTE.md](TESTLISTE.md) (both German).

## Trademarks

Not affiliated with, endorsed or reviewed by Foundry Gaming LLC, Roll20,
Owlbear Rodeo, Obsidian, Anthropic or Ollama. The names only describe which
programs and services the tools work with.

## About

Code, architecture and documentation were largely written with
[Claude Code](https://claude.com/claude-code). Contributions are welcome,
with or without AI.

Comments, commits and project docs (`KONVENTIONEN.md`, `BACKLOG.md`,
`docs/`) are in German; the interface is German and English.

| `docs/` | Content |
|---|---|
| `inspirationshilfe.md` | Inspiration |
| `monster.md` | Monster Creator |
| `statuseffekte.md` | Status Effect Creator |
| `encounter.md` | Encounter Creator |
| `austausch.md` | Sharing and rooms |
| `raum-online.md` | How to: room over the internet (port forwarding, IPv6) |
| `magicitems.md` | Magic Item Creator |
| `nachschlagewerk.md` | Reference |
| `loot.md` | Loot Generator |
| `inventar.md` | Inventory (concept, not built) |
| `charakterbogen.md` | Character sheet with inventory, room roles and live sheets (steps 1 to 5 built) |

## License

[GNU Affero General Public License v3.0 or later](LICENSE). If a modified
version is offered over a network, its source must be available too. No
warranty.

**Exception: the icons** in `apps/shell/symbole/` are © ItsLunasDream, all
rights reserved ([LIZENZ.md](apps/shell/symbole/LIZENZ.md)). A modified
version passed on replaces or omits them.

### Third-party content

Attributions are in [NOTICE.md](NOTICE.md) and must travel with the project.
The monster baselines come from the *Lazy GM's 5e Monster Builder Resource
Document* by Teos Abadía, Scott Fitzgerald Gray and Michael E. Shea
(CC-BY-4.0, including SRD 5.1 material). SRD 5.2.1 content (CC-BY-4.0) uses
the attribution prescribed in NOTICE.md. Nothing is taken from the Dungeon
Master's Guide.
