# UX and Visual Specification

## Core layout

Save Slot uses a permanent left information rail and a right working area on desktop. On narrow screens the same functions collapse into a stacked mobile interface with bottom navigation.

The interface is designed around two primary tasks:

1. find a game or a concrete platform release;
2. manage the user's own collection.

## Desktop layout

```text
┌──────────────────────┬────────────────────────────────────────────┐
│                      │ Search                          Filters ▾   │
│  PS1 SLOT            ├────────────────────────────────────────────┤
│  + cartridge         │                                            │
│                      │ Search results / collection / details      │
│  selected game info  │                                            │
│                      │                                            │
│  navigation          │                                            │
└──────────────────────┴────────────────────────────────────────────┘
```

### Left rail

Target width: 300–360 px on large screens.

When no game is selected:

- Save Slot cartridge in the slot;
- primary navigation;
- no placeholder fact cards;
- no descriptive filler panels;
- no empty information tiles.

When a release is selected:

- its cartridge is inserted into the slot;
- game title;
- year;
- exact platform;
- sourced player rating;
- personal rating;
- short official or editorial description;
- collection action;
- screenshots when available.

The rail remains visible while the catalogue scrolls.

### Right workspace

The upper area contains:

- search field;
- random discovery action;
- filter drawer;
- platform selection;
- sorting;
- result count;
- loading and provider status.

Filters must not consume a second permanent sidebar.

## Result flow

Catalogue cards and cartridge shelves always build **from left to right**.

Rules:

- the first accepted item occupies the leftmost free position;
- following items append to the right;
- after the row is full, the next row starts again at the left edge;
- DOM order and visual order are identical;
- the stagger animation follows the same left-to-right sequence;
- sorting changes order only;
- filtering changes visibility only;
- media loading never depends on changing the sort control;
- existing cards do not flash, remount or jump when new cards arrive.

Animation:

- short opacity and translation from the left;
- slight stagger between newly accepted cards;
- no repeated animation for already visible cards;
- reduced-motion mode removes movement.

## Mobile layout

```text
┌──────────────────────────┐
│ compact slot / game info │
├──────────────────────────┤
│ search             filter│
├──────────────────────────┤
│ results / collection     │
│                          │
├──────────────────────────┤
│ Search Collection Lists  │
└──────────────────────────┘
```

Bottom navigation:

- Search;
- Collection;
- Discovery;
- Settings.

Touch requirements:

- comfortable touch targets;
- no hover-only actions;
- swipe is optional and never the only control;
- filter controls support one-handed use;
- dialogs respect safe areas;
- cartridge animation is shorter on mobile;
- result rows still fill left to right.

## Search states

### Initial state

Every fresh application start loads a varied discovery selection. It is not a fixed local catalogue.

The selection should:

- cover several platforms;
- avoid immediate repetition where practical;
- include only releases with accepted cover art;
- show partial provider progress without clearing stable cards.

### Active search

1. The user submits a query.
2. Search status appears without requiring a sort interaction.
3. Normalized candidates arrive.
4. Accepted release cards append from left to right.
5. Media and ratings update inside existing cards.
6. Provider warnings are summarized without replacing results.

### Empty and error states

Differentiate:

- no matching game;
- matches removed by filters;
- provider unavailable;
- no verified box art;
- offline fallback;
- rate limit;
- project library file unavailable.

## Search card content

Default card:

- release-specific box art;
- title;
- platform;
- release year;
- concise player rating;
- add/remove collection action.

Do not overload every card with technical source annotations. Source details belong in the selected game view or a compact diagnostic panel.

## Game details

Required information:

- title and localized title when available;
- concrete release and platform;
- year;
- developer and publisher;
- genres;
- short description;
- translate action;
- sourced ratings with vote count;
- personal rating;
- screenshots;
- collection record.

Screenshots:

- horizontal scroll or swipe gallery;
- platform labels when mixed;
- thumbnail-first loading;
- fullscreen viewer later;
- never silently used as box art.

## Collection views

### Compact list

Dense rows for large libraries:

- title;
- platform;
- format;
- status;
- personal rating;
- tags.

### Medium rows

- thumbnail;
- title and release;
- progress/status;
- rating;
- quick actions;
- note preview.

### Cartridge shelf

- PS1-style cartridges;
- platform variants;
- cover texture on the label;
- grouping by platform or custom list;
- readable fallback when a cover is missing;
- rows fill from left to right.

The chosen view is stored per list.

## Collection persistence

The local desktop application uses two coordinated stores:

1. IndexedDB is the responsive browser working copy.
2. `.save-slot-data/library.json` is the persistent project-folder copy.

Requirements:

- the project file is restored when the application starts;
- every collection mutation is mirrored automatically;
- writes are atomic;
- the previous file is retained as `library.backup.json`;
- the cache folder is excluded from Git;
- manual JSON export/import remains available;
- file-cache failure must not destroy the IndexedDB copy;
- settings show whether the project file is connected and saved.

Direct smartphone access to the desktop project folder is not assumed. Mobile synchronization will use a later explicit sync layer rather than exposing the local cache service publicly.

## PS1 visual system

PS1 treatment applies to:

- slot hardware;
- cartridge geometry;
- insertion transitions;
- optional background details.

It must not reduce text readability or distort original artwork.

Rendering direction:

- low-poly cartridge and slot;
- low-resolution textures;
- nearest-neighbour filtering;
- limited lighting precision;
- optional vertex jitter and dither;
- restrained CRT overlay;
- modern readable UI around the scene.

### Box art

Default: original artwork with preserved aspect ratio.

Optional display filters:

- clean;
- subtle PS1 dither;
- CRT.

Filters are visual only and never modify the cached original.

### Cartridge insertion

The cartridge is a rigid body.

Allowed transforms:

- translation;
- rotation;
- uniform scale;
- shadow and light response.

Forbidden:

- independent X/Y scaling;
- cover stretching;
- slot stretching;
- shape morphing;
- aspect-ratio changes.

Insertion sequence:

1. lift from the source card;
2. travel toward the slot with depth;
3. align above the slot;
4. move vertically into place;
5. short impact response;
6. show game information immediately.

## Localization and translation

Initial interface languages:

- Ukrainian;
- English.

Descriptions support:

- visible source language;
- translate-to-interface-language action;
- original/translated toggle;
- cached translation;
- machine-translation label.

## Accessibility

- keyboard support;
- visible focus states;
- semantic headings and landmarks;
- useful cover alt text;
- reduced motion;
- sufficient contrast;
- font scaling without layout failure;
- screen-reader progress announcements;
- non-WebGL fallback for the 3D scene.

## Performance targets

- usable application shell on a mid-range smartphone;
- card thumbnails lazy-loaded;
- full screenshots loaded on demand;
- short cartridge animation targets 60 fps when supported;
- effects simplify on low-power or reduced-motion devices;
- collection file writes do not block card interaction.
