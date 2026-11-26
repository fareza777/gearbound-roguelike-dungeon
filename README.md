# Gearbound — Clockwork Roguelike Dungeon Duel

> Crafted by **F7 Developer** • 9:16 Portrait Offline Mobile Roguelike

## Google Play Store ASO Metadata

- **Game Title**: `Gearbound`
- **Google Play Store Title (28 / 30 chars)**: `Gearbound: Roguelike Dungeon`
- **Short Description (77 / 80 chars)**: `Offline roguelike dungeon duel! Spin clockwork gears, merge & conquer bosses.`
- **Package ID**: `com.f7developer.gearbound`
- **Primary ASO Keywords**: `Roguelike`, `Dungeon`, `Expedition`, `Strategy`, `Duel`, `Merge`, `Offline`, `Clockwork`, `Deckbuilder`, `Boss Rush`, `Turn-Based`, `One-Handed`

### Full Store Description (Ready for Google Play Console)
Pull the brass lever, align your 3×3 Clockwork Combat Console, and march into six handcrafted dungeon biomes in **Gearbound** — a deep, 100% offline roguelike dungeon duel engineered for effortless one-handed portrait play.

Every pull rotates three counterweighted iron-and-brass combat drums loaded with your curated arsenal of blades, armor-piercing arbalests, tower shields, war maces, field repair kits, and interlocking brass gear-links. Align rows, columns, and diagonals to trigger sweeping vanguard combos, clamp drums in place to engineer guaranteed synergies, and forge duplicate tiles up to **Masterwork Gold Tier IV** at the Anvil Forge.

**Key Features**
- **Tactile 3×3 Clockwork Combat Console**: Drag or tap the physical brass lever to spin curved mechanical drums with interlocked cogwheels, Column-3 anticipation slow-down, drum lock clamps, and glowing synergy conduits.
- **Frame-by-Frame Animated Duels**: Smooth multi-frame combat animations across 3 playable Vanguard classes (*Ironclad Vanguard*, *Siege Arbalest*, *Clockwork Artificer*) and 13 distinct armored enemies, elites, and monumental Act Bosses.
- **Massive 6-Biome Expedition**: Battle through *Sunlit Sandstone Ruins*, *Amber Canyon Catacombs*, *Iron Foundry Vaults*, *Highland Frost Bastion*, *Grand Clockwork Spire*, and *Sovereign Iron Citadel*, plus Masterwork Ascension tiers.
- **Deep Reel-Deckbuilding & Probability Cores**: Draft from 28 mergeable Action Symbols (Tiers I–IV) and 30 rule-bending Clockwork Relics. Merge duplicates, temper favorites, or prune weak tiles at the Anvil Forge.
- **100% Offline & F7 Quality Standards**: Play completely offline with Sunlit Parchment Light Mode (default) and Obsidian Foundry Dark Mode, 7-day Daily Supplies, 12-hour Offline Patrol Rewards, 24 Achievements, Citadel Meta-Workshop, and reliable auto-saving.

---

## Architecture & Tech Stack
- **Core Engine**: Vite + TypeScript + 60 FPS HiDPI HTML5 Canvas2D (`ArenaRenderer` + `ConsoleRenderer`).
- **Art Pipeline**: 100% bespoke art-generated raster assets (PyCairo + NumPy painterly shading, multi-frame sprite sheets, 6 painted biome backdrops, 28 beveled enamel symbol medallions, custom Light & Dark GUI panels/buttons, custom bundled typography `Cinzel Decorative`, `Cinzel`, `Crimson Pro`).
- **Audio**: Zero-music procedural Web Audio API mechanical & combat Foley synthesizer (lever clank, ratchet ticks, drum thuds, steel clashes, shield blocks, steam vents, forge anvil impacts).
- **Android Packaging**: Capacitor Android Native Shell with:
  - `@capacitor-community/admob` configured via `src/config/monetization.ts` using Google Official Test IDs (ready for production ID swap).
  - Custom Native Kotlin Google Play Billing v7 plugin (`GearboundBillingPlugin.kt`) powering the **Remove Ads (USD $4.99)** non-consumable IAP.
  - Sequential Dual Splash Screens: 1) *Gearbound* Title Key Art → 2) *F7 Developer* Silent Portrait Brand Video.

## Build & Release Instructions
```bash
# Install dependencies
npm install

# Run local portrait dev server
npm run dev

# Build production web bundle & sync Android project
npm run cap:sync

# Build Release APK & Google Play AAB
cd android
./gradlew assembleRelease bundleRelease
```
> **Note**: Release keystores (`*.jks` / `key.properties`) are strictly excluded from Git via `.gitignore`.
