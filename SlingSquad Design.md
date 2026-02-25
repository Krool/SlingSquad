# Sling Squad
## Game Design Doc v0.2

## High Concept
A mobileweb landscape physics destruction roguelike where the player launches a squad of fantasy class heroes (warrior, priest, ranger, mage, etc.) into enemy encampments. Heroes have impact effects and post-landing combat behaviors, allowing overlapping chain reactions, physics collapse, and unit combat. Runs end on failure, and players spend meta currency to unlock classes and improve future runs.

## One-Line Pitch
Sling Squad is a physics siege roguelike where you fling a fantasy party into enemy encampments, chain collapses and explosions, then finish the survivors with post-landing hero combat.

## Design Intent
The game combines
- precision launch input (Angry Birds style)
- real physics destruction and collapse
- squad build synergy and class interactions
- roguelike map progression and node decisions
- readable, heavily telegraphed outcomes on mobileweb landscape

The target feel is planned chaos
- precision shots create setups
- chain reactions and collapses pay them off
- heroes and enemies fight after impact
- players solve encounters through environmental kills, direct combat, or hybrids

## Core Fun Pillars
- Chain reactions
- Physics collapse
- Build synergy leading to catastrophic destruction
- Meaningful decision making
- Precision shots with heavy telegraphing
- Readable overlapping hero effects and destruction
- Roguelike progression and unlock motivation

## Key Differentiators
1. Thrown heroes are actual combat units
   - They have impact behavior and post-landing behavior.
   - They continue acting after launch and can fight enemies.

2. Overlapping action windows with pacing control
   - Player can launch additional heroes while previous heroes are still active.
   - A short global launch cooldown preserves readability.

3. Environmental kills are a primary strategy
   - Encounters are balanced around collapsing structures, hazards, and chain explosions killing enemies.
   - Direct combat supports and finishes, rather than replacing destruction play.

4. DnD-class squad fantasy
   - Team identity, class roles, passives, and relics create replayability.

## Platform and Presentation
- Platforms Mobile and Web
- Orientation Landscape (mobile-first landscape)
- Input Drag and launch (touch + mouse)
- Telegraph style Clear game overlay telegraphing (explicit arcs, radii, indicators)

## Visual Direction (current)
- Initial concept considered ASCII-heavy visuals
- Current direction is to test using existing 2D art folder assets
- Priority is readability in collapse-heavy action
- Hybrid UI  overlay telegraphs remain a core requirement regardless of art style

## Audio Direction
- Programmatic SFX by default in early development
- User-provided music planned for
  - menu scene
  - team select scene
  - map scene
  - battle scene
- Settings page includes sound controls

## Core Loop
1. Start run
2. Travel across roguelike map (Slay the Spire style node structure)
3. Enter node (battle  shop  forge  event  elite battle  boss)
4. In battles, launch squad heroes to clear enemy encampment
5. Destroy structureshazards and reveal hidden rewards
6. Kill all enemies to win battle
7. Resolve node rewards and events between battles
8. Recruitupgradepick relicspassivescurses during run
9. Continue until failure
10. Spend meta currency for future-run unlocks and power

## Roguelike Map Structure (locked direction)
Map structure is inspired by Slay the Spire
- Node-based progression
- Branching path decisions
- Node types include
  - Battle
  - Shop
  - Forge
  - Event
  - Elite Battle
  - Boss

## Battle Core Rules (v1 foundation)
### Win Condition
- Kill all enemies

### Loss Condition
Battle is lost when all are true
- At least one enemy remains alive
- No remaining launches
- No active heroes remain capable of acting

### Launch Rules
- Player launches one hero at a time
- Short global launch cooldown between launches
- Active heroes continue acting during cooldown
- Player can aimprepare while cooldown is active (recommended)
- Clear cooldown readiness telegraph is required

## Squad and Launch Economy (locked)
### Squad Structure
- First run uses a locked starter squad
- Starter squad size 4
- Squad can increase during run through recruitmentevents between battles
- Squad UI and battle logic must support dynamic squad size

### Launch Consumption
- One launch per squad hero per battle
- Exception hero-specific abilitiespassives may allow re-entering the queue if conditions are met
- This is a special-case rule, not baseline behavior

### Squad Refresh Between Battles
- Full squad refresh every battle
- Fully heal and restore the party each battle

### Recruitment Timing (locked)
- In-run recruited heroes do not appear during a battle
- Recruitment happens between battles via events  map nodes
- Recruited hero joins squad for subsequent battles

## Hero System
Heroes are throwable class units with two primary gameplay modes
1. Projectile mode (airborne + impact)
2. Combat mode (post-landing unit behavior)

Heroes are intended to support both
- siege destruction roles
- combat roles

### Hero Class Identity Goals
- Distinct projectiledestruction profile
- Distinct combat profile
- Material interaction differences
- Strong readability and fantasy expression
- Synergy potential through passivesrelics and sequencing

### Class Count Goal
- Long-term goal 10+ classes
- Initial focus polish locked starter four before expanding

## Starter Four Classes (first spec direction)
These are role anchors and tuning targets for v1.

### Warrior
Role
- Starter tank
- Intended opener  first launch
- Can-opener for structures

Design intent
- Goes first to create access and break initial defenses
- Durable in combat mode
- Helps establish lines of attack for later heroes

### Priest
Role
- Follow-up support
- Healer in combat mode

Design intent
- Follows the tank into openings created by Warrior
- Sustains heroes during post-landing combat
- Supports attrition and clutch finishes after environmental damage

### Ranger
Role
- Damage dealer
- Spread destruction in projectile mode
- High single-target damage in combat mode
- Very low HP as combat unit

Design intent
- Strong finisher and priority target killer
- Fragile if exposed
- Encourages timing and protection through structure collapse and tanking

### Mage
Role
- Big AoE destruction projectile
- High AoE damage in combat mode
- Low single-target damage
- Low HP

Design intent
- Primary area clearer
- Great at setting up chain reactions and softening groups
- Vulnerable if not supported

## Combat Layer (Heroes and Enemies)
The game has two overlapping systems
1. Physics destruction layer
2. Unit combat layer

Design intent
- Physics and hazards should be the best way to create advantage
- Combat should be deadly enough that players want to weaken enemies via projectile modecollapse first

### Combat Pressure Target (locked tuning principle)
- Enemies should be fairly deadly in combat mode
- Screen counts should stay low for readabilityperformance
- Environmental kills and collapse damage should be strongly incentivized

Reference tuning target
- Default Warrior should barely beat a basic Grunt in a 1v1 melee fight

This keeps combat meaningful and makes pre-combat destruction important.

## Enemy System (v1 direction)
Enemies
- Have different behaviors
- Fight heroes in combat mode
- Are vulnerable to
  - hero attacks
  - hero abilities
  - impact damage
  - explosions
  - collapsing structures  crush damage

### v1 Enemy Count  Pressure Direction
- Keep on-screen counts relatively low
- Make individual enemies threatening enough to matter
- Encourage players to use projectilecollapse tools before direct melee cleanup

### Prototype-friendly first enemy types (still recommended)
- Grunt (melee)
- Ranged enemy

## Environment and Physics
### Physics Goals
- Real physics destruction and collapse
- Outcomes should be readable and learnable
- Strong telegraphing and stable material rules support fairness

### Materials (early)
- Wood
- Stone

### Hazards (early)
- Explosive barrels
- Additional chainable hazards later

### Environmental Kill Principle (locked)
Encounters should be balanced around the idea that enemies can be killed by
- collapsing roofswalls
- chain explosive barrels
- other hazards
without directly engaging in combat mode

## Hidden Rewards and In-Run Rewards
Destroying structures can reveal
- In-run currency (gold)
- Reward opportunities tied to progression

Original idea included wearable loot.
Current simplification direction for v1
- Prefer relicpassive system over swappable gear loadout complexity

## In-Run Progression (updated direction)
### Currency
- Gold (in-run currency)
- Used in shops
- Can support rerolls in certain contexts
- Passivesrelics may interact with gold gainspend
- Events may offer ways to spend gold for outcomes or to exitmodify events

### Relics and Passives (simplified direction)
To reduce complexity, avoid gear swapping systems in v1.
Use
- stackable relics
- hero passives
- curses as distinct negative passives

This supports event design such as
- remove a curse
- transform a passive
- gain power at a cost
- trade relicsresources

## Meta Progression (updated direction)
Runs end on failure.
Between runs, meta currency is spent on progression such as
- unlock classes
- more starting gold
- random relic on each character at run start
- gold gain %
- damage %
- health %
- other permanent modifiersoptions

Meta progression should support both
- variety unlocks (new classesoptions)
- controlled power growth

## UI and UX (Battle)
### Clear Game Overlay Telegraph (hard requirement)
Because the game combines physics + autonomous heroes + enemy combat, telegraphing must be explicit and readable.

High-priority telegraphs
- launch trajectory arc
- impact zone markers
- AoE radii (hero abilities, explosions)
- launch cooldown ready state
- hazard danger zones (especially explosive barrels)
- key enemy threat indicators
- hero abilitystate indicators where needed

### Squad UI
Must support dynamic squad sizes
- no hardcoded 4-slot-only layout
- clear remaining launches
- clear spent vs active status
- scalable roster presentation in landscape mobile

## Hero Lifecycle and Battle Resolution Handling
This is a major system requirement due to overlapping simulation and combat.

### Hero End Conditions (required)
Heroes can stop contributing due to
- Death
- Offscreen
- Stuck resolution
- Battle-level timeout ending the battle (see below)

Note
The previous per-hero timeout concept has been replaced by a battle-level timeout rule for v1.

### Required Edge Case Handling
- Heroes all dying
- Heroes running offscreen
- Heroes becoming stuck  no-progress
- Deadlockedstalled battles
- Battle should end cleanly and visibly in all cases

### Battle-Level Timeout  Anti-Stall Rule (locked direction)
After the last projectile is fired
- Start a battle resolution timer
- Reset the timer whenever anyone deals damage to anyone
- Show the timer clearly when it drops below 5 seconds
- If timer reaches 0, battle ends if no other winloss condition has occurred

This acts as anti-stall resolution and prevents endless deadlocked combatphysics states.

Important note for implementation
- Need exact timer duration value
- Need exact definition of deals damage event source coverage (combat, explosion, crush, impact, DoT if any)

## Settings Page (v1 requirement)
At minimum
- Music volume
- SFX volume
- Mute option

## Technical Stack (decision needed)
This is still open.

### Recommended direction for this project (web + mobile landscape + real physics)
A strong v1 stack would be
- Phaser (renderinggame loopinput)
- Matter.js (2D rigid body physics, integrated path is common)
- TypeScript (for scalable classstate logic)
- Data-driven JSON for heroesenemiesrelicsnodes

Why this fits
- Good for 2D mobileweb games
- Strong control over game loop and UI overlays
- Real-time physics support
- Easier rapid iteration for Claude Code than heavier engines in this context

Alternative
- PixiJS + Matter.js (more custom, more flexible, more setup burden)

Current recommendation
- Start with Phaser + Matter.js + TypeScript unless a strong reason emerges otherwise

## Prototype Scope Recommendation (v1  first playable)
Goal prove core fun and readability

- 1 battle scene
- Win kill all enemies
- Lose no launches and no active heroes while enemies remain
- 2 materials (wood, stone)
- 1 hazard type (explosive barrel)
- 4 locked starter heroes (Warrior, Priest, Ranger, Mage)
- 2 enemy types (melee + ranged)
- heroes and enemies have basic combat stats
- enemies can die via combat, explosions, and collapsecrush
- short global launch cooldown
- clear overlay telegraphs
- hidden gold in breakables
- battle-level anti-stall timeout after last launch
- simple post-battle node reward placeholder screen
- no full meta implementation yet (placeholder progression screens are fine)

## Open Questions and Gaps (v0.2)
### High Priority Remaining
1. Starter Four exact mechanics
- Impact effect for each
- Post-landing combat behavior
- Targeting rules
- Material strengthsweaknesses
- Ability triggers and cooldowns (if any)

2. Launch cooldown exact tuning
- duration
- pre-aim behavior details
- feedback presentation

3. Battle resolution timer exact tuning
- total duration after last launch
- visible countdown presentation style
- whether any non-damage events also reset timer (example block break)

4. Stuck state exact implementation
- exact no-progress threshold
- whether stuck itself causes immediate removal or only contributes to timeout pressure
- UI feedback for stuck heroes

5. Enemy v1 exact specs
- Grunt statsbehavior
- Ranged enemy statsbehavior
- aggro and target selection

### Medium Priority
- Forge node exact function
- Shop inventory structure
- Event templates
- Reliccurse taxonomy
- Meta progression tuning caps and sequencing
- Art pipeline and asset import conventions from existing 2D folder
- Performance budgets (debris, enemies, active effects)

## Working Design Principles (preserve)
- Physics collapse is a primary solution path
- Combat supports and pressures, not overshadows destruction
- Precision feels fair through explicit telegraphs
- Chaos remains readable and learnable
- Class identity and synergy drive replayability
- Scope protects the first fun prototype before content expansion