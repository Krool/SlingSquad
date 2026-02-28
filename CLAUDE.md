# SlingSquad — Project Instructions

## Overview
Physics-based roguelike where you sling a squad of heroes at block structures to destroy enemies. Built with Phaser 3 + Matter.js.

## Quick Start
```bash
npm run dev      # Vite dev server on port 3000
npm run build    # tsc + vite build
npm run deploy   # build + push dist/ to gh-pages branch
```

## Tech Stack
- **Phaser 3.88** with built-in **Matter.js** physics
- **TypeScript** (strict mode, ES2020 target)
- **Vite 6** bundler (port 3000, path alias `@/` → `src/`)
- No test framework — prototype stage

## Architecture

### Scene Flow
```
BootScene → MainMenuScene (camp hub)
  ├─ [Continue/New Run] → OverworldScene → Battle/Shop/Event/Forge → ResultScene → OverworldScene
  ├─ [Camp Upgrades] → CampUpgradesScene (overlay)
  ├─ [Codex] → CodexScene
  └─ [Settings] → SettingsScene (overlay)
ResultScene (defeat) → MainMenuScene
OverworldScene (run complete) → MainMenuScene
```
- MetaScene was deleted — replaced by MainMenuScene + CampUpgradesScene overlay
- SettingsScene also launchable from BattleScene and OverworldScene

### File Organization
```
src/
  main.ts                 — Phaser game config (gravity, dimensions, scene list)
  config/constants.ts     — ALL tuning values (physics, hero stats, enemy stats, materials)
  scenes/                 — 12 scenes (Boot, MainMenu, SquadSelect, Overworld, Battle, Shop, Result, CampUpgrades, Settings, Event, Forge, Codex)
  entities/               — Game objects (Hero, Enemy, Block, Barrel, Projectile, Coin)
  config/types.ts         — Shared type definitions (GameBody interface for MatterJS bodies)
  systems/                — 17 systems (Launch, Combat, Impact, Timeout, VFX, RunState, MetaState, Audio, Music, Achievement, Mastery, Ascension, RunHistory, DiscoveryLog, Tutorial, DailyChallenge, GameplaySettings)
  ui/                     — HUD components (SquadUI, DamageNumber, ScrollablePanel)
  data/                   — JSON data files (heroes, enemies, relics, nodes, upgrades, curses, events, achievements, modifiers) + campBuildings.ts
  data/maps/              — Alternate map definitions (frozen_peaks, infernal_keep) + index.ts registry
assets/
  sprites/medievalrpgpack/ — Character sprite frames (gitignored)
  music/                   — 8 category folders (gitignored): battle, boss, defeat, event, map, menu, shop, victory
public/                    — Static files: favicon.svg, .nojekyll, robots.txt, manifest.json
.github/workflows/         — GitHub Actions deploy workflow
```

### Key Patterns
- **BattleScene is the coordinator** — owns entity lists, instantiates systems, wires collision/event handlers
- **Systems receive entity refs** — LaunchSystem, CombatSystem, ImpactSystem, TimeoutSystem get heroes/enemies/blocks arrays
- **Event-driven** — systems communicate via Phaser events: `barrelExploded`, `blockDestroyed`, `bomberExploded`, `priestHealAura`, `enemyDied`, `heroDied`
- **Relic bonuses cached in constructors** — each system calls `getRelicModifiers()` once in its constructor (safe because systems are recreated every `BattleScene.create()`)
- **Module-level singletons** — RunState and MetaState are module singletons, not classes. Access via `getRunState()` / `getMetaState()`
- **AudioSystem in Phaser registry** — stored as `'audio'` key, MusicSystem as `'music'`, both accessible cross-scene

### Naming Conventions
- **Sprite keys**: `{charKey}_{animName}_{frameN}` (e.g., `warrior_idle_1`)
- **Animation keys**: `{charKey}_{animName}` (e.g., `warrior_idle`)
- **Character mapping** (charKey→folder): warrior→WARRIOR, ranger→ASSASIN (sic), mage→SORCERESS, priest→NECROMANCER, bard→SORCERESS, grunt→BARBARIAN, ranged→CENTAUR, shield→WARRIOR, bomber→BARBARIAN, healer→NECROMANCER, boss_grunt→BARBARIAN
- **localStorage keys**: `slingsquad_run_v1`, `slingsquad_meta_v1`, `slingsquad_audio_v1`, `slingsquad_music_v1`, `slingsquad_gameplay_v1`, `slingsquad_achievements_v1`, `slingsquad_achievement_stats_v1`, `slingsquad_mastery_v1`, `slingsquad_ascension_v1`, `slingsquad_discovery_v1`, `slingsquad_stats_v1`, `slingsquad_tutorial_v1`, `slingsquad_daily_v1`, `slingsquad_squad_v1`

## Important Constraints

### Physics — Do Not Change Without Understanding
- `gravity.y = 1.08` in main.ts → effective **0.3 px/frame²** (Matter scale 0.001)
- `GRAVITY_PER_FRAME = 0.3` in constants.ts must match — used for trajectory preview math
- `LAUNCH_POWER_MULTIPLIER = 0.11` — px/frame per px of drag, NO ×60 conversion
- `HERO_FRICTION_AIR = 0.003` — must match body frictionAir for trajectory accuracy
- Changing any of these breaks the trajectory preview ↔ actual flight alignment

### Materials
- `WOOD restitution = 0.05` (very low bounce) — intentional to prevent settling jitter
- `STONE restitution = 0.08`
- Structure templates use `GAP = 0` between blocks — also to prevent jitter

### Code Conventions
- All balance/tuning values go in `src/config/constants.ts` — never hardcode magic numbers in systems or entities
- **8 hero classes** (WARRIOR, RANGER, MAGE, PRIEST, BARD, ROGUE, PALADIN, DRUID) — BARD/ROGUE/PALADIN/DRUID unlocked=false by default
- **6 base enemy types** (GRUNT, RANGED, SHIELD, BOMBER, HEALER, BOSS_GRUNT) + 6 map-specific variants (ICE_MAGE, YETI, FROST_ARCHER, FIRE_IMP, DEMON_KNIGHT, INFERNAL_BOSS) — all reuse existing sprite folders
- **25 relics + 10 curses** — curses are negative relics (same system, `curse: true` flag, negative values)
- Relic management: `addRelic()`, `removeRelic()`, `upgradeRelic()`, `getCurses()`, `getNonCurseRelics()`
- Hero and Enemy classes use a state machine: `queued → flying → combat → dead` (heroes), `idle → combat → dead` (enemies)
- `DamageNumber` is a static utility class in `src/ui/` — call `DamageNumber.damage()`, `.heal()`, `.blockDamage()`, `.bigHit()`
- Collision filter: heroes use `category=0x0002, mask=~0x0002` so they don't collide with each other
- Sprite display size: `radius * 2.5 × radius * 2.5`, Y offset: `body.y - radius * 0.25` (feet alignment)
- HP bar positioned at `body.y - radius * 2 - 4`

### Art Pipeline
- Source sprites in `assets/sprites/medievalrpgpack/` (gitignored — not in repo)
- Manifest: `assets.manifest.json` — generated by `python export.py` from `Art/_catalog/`
- Enemies flip X (face left); heroes face right
- Frames loaded in BootScene.preload(); anims created in BootScene.create()

### MatterJS Typing Gotcha
- Phaser collision events emit `MatterJS.Body`; cast to `MatterJS.BodyType` for type compatibility

### Deployment — GitHub Pages
- `base: '/SlingSquad/'` in vite.config.ts is **required** — removing it breaks all asset paths on GitHub Pages
- Assets (sprites, music, UI) are gitignored — build locally, CI cannot build
- Deploy flow: `npm run deploy` → builds, copies+renames sprites into dist/, pushes `dist/` to gh-pages branch via `scripts/deploy.js`
- **Sprite filenames**: source files have spaces (`IDLE 1.png`) but `copy-assets` renames to underscores (`IDLE_1.png`) — GitHub Pages returns 404 for files with spaces
- BootScene loads sprites with underscore paths (`${prefix}_${i}.png`) to match renamed files
- `public/.nojekyll` prevents GitHub Pages from running Jekyll processing
- Deploy script uses manual git orphan branch (not `gh-pages` npm package) to avoid Windows ENAMETOOLONG with 1800+ files

### Bundle Size
- Phaser is ~1.5MB — expected and acceptable for prototype
