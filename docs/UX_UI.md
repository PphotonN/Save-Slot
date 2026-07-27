# UX and Visual Specification

## Layout direction

Save Slot v1 uses a left information rail and a right working area on desktop. The layout collapses into a mobile-first stacked interface on narrow screens.

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

Width target: 300–360 px on large screens.

When no game is selected:

- Save Slot cartridge in the slot;
- primary navigation;
- no placeholder fact cards;
- no descriptive filler panels;
- subtle source/online status only when relevant.

When a game is selected:

- selected release cartridge inserted into the slot;
- game title;
- year;
- selected platform;
- sourced player ratings;
- personal rating;
- short official or editorial description;
- add/update collection action;
- expandable screenshots and release details.

The left rail remains visible during catalogue scrolling.

### Right workspace header

- search field;
- random selection action;
- view mode;
- sorting;
- filter button opening a popover or drawer;
- active-filter chips;
- result count and loading status.

Filters must not consume a permanent wide sidebar.

### Results area

- cards are stable after insertion into the DOM;
- new cards appear progressively;
- existing cards do not flash or remount when ratings or media arrive;
- sorting changes order only;
- filtering changes visibility only;
- loading new media never depends on a sort-control event.

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

### Mobile navigation

Bottom navigation:

- Search;
- Collection;
- Lists;
- Settings.

The selected game opens as a bottom sheet or full-height details panel. The compact slot remains part of the visual identity but must not occupy excessive vertical space.

### Touch requirements

- minimum comfortable touch targets;
- no hover-only actions;
- swipe is optional, never the only control;
- filter drawer supports one-handed use;
- dialogs respect safe areas;
- cartridge animation is shorter on mobile.

## Search states

### Initial state

Each new application session loads a varied discovery selection. It is not a hardcoded local catalogue.

The selection should:

- span several platforms;
- avoid repeating the previous session where practical;
- include games with and without ratings;
- include only cards with accepted cover art;
- clearly indicate ongoing provider loading.

### Active search

1. User submits or pauses typing.
2. Search status appears without clearing existing cards immediately.
3. First normalized candidates arrive.
4. Accepted cards appear progressively from right to left.
5. Media and ratings update inside existing cards.
6. Final provider warnings are summarized without replacing results.

### Empty and error states

Differentiate:

- no matching game;
- all matches removed by filters;
- provider temporarily unavailable;
- no verified box art;
- offline mode;
- rate limited.

## Progressive card appearance

Desktop insertion order is visually right-to-left within a row. The data order remains logical and accessible.

Animation rules:

- short opacity and translation animation;
- slight stagger between newly accepted cards;
- no reanimation of existing cards;
- reduced-motion mode removes movement but preserves immediate appearance;
- screen-reader order follows DOM order.

## Search card content

Default card:

- release-specific box art;
- title;
- selected or primary platform;
- release year;
- concise rating summary;
- save button.

Avoid technical source annotations on every card. Source detail belongs in the game page or a compact tooltip.

## Game detail content

Required sections:

1. Overview.
2. Releases and platforms.
3. Screenshots.
4. Ratings.
5. Collection record.
6. Source information.

### Overview

- title and alternate localized title;
- selected release;
- year;
- developer and publisher;
- genres;
- short description;
- `Translate` action when needed.

### Screenshots

- horizontal swipe/scroll gallery;
- platform labels when mixed;
- thumbnail-first loading;
- fullscreen viewer;
- no screenshot used as an unlabeled cover.

### Ratings

Show separate tiles, for example:

- IGDB community;
- Steam users for PC;
- other approved player sources;
- personal rating.

The interface includes vote counts and source names without overloading catalogue cards.

## Collection views

### List

Dense table-like presentation for large libraries.

Fields:

- title;
- platform;
- format;
- status;
- personal rating;
- tags.

### Medium rows

- thumbnail;
- title and release;
- progress;
- rating;
- quick actions;
- note preview.

### Cartridge shelf

- PS1-style 3D or pseudo-3D cartridges;
- platform visual variants;
- cover texture on the cartridge label;
- grouping by platform or custom list;
- readable title fallback for missing cover.

View choice is saved per list.

## PS1 visual system

### Scope

PS1 treatment applies to:

- slot hardware;
- cartridge geometry;
- selected transitions;
- optional background details.

It does not reduce text readability or distort original artwork.

### Geometry and rendering

- low-poly cartridge and slot;
- low-resolution textures;
- nearest-neighbour filtering;
- limited lighting precision;
- optional vertex jitter/dither;
- restrained CRT overlay;
- modern UI typography around the scene.

### Box-art treatment

Default: original artwork with preserved aspect ratio.

Optional user setting:

- clean;
- subtle PS1 dither;
- CRT filter.

The filter is visual only and never modifies the cached original.

### Cartridge insertion

The cartridge is a rigid body.

Allowed animation properties:

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

The insertion should be unmistakable:

1. lift from the source card;
2. travel toward the slot with depth;
3. align above the slot;
4. move vertically into place;
5. short impact and light response;
6. show game information immediately.

## Accessibility

- full keyboard support;
- visible focus states;
- semantic headings and landmarks;
- alt text for box art when informative;
- reduced-motion setting;
- sufficient contrast;
- font scaling without layout failure;
- screen-reader announcements for search progress and new results;
- 3D scene has a functional non-canvas alternative.

## Localization

Initial interface languages:

- Ukrainian;
- English.

All interface strings use message keys. No user-facing strings are embedded directly in feature components.

Description translation:

- visible source language;
- translate-to-interface-language action;
- original/translated toggle;
- cached result;
- clear machine-translation label.

## Performance targets

- application shell usable quickly on a mid-range smartphone;
- no Three.js bundle on routes that do not show the slot, when code splitting permits;
- card thumbnails lazy-loaded;
- full screenshots on demand;
- stable 60 fps target for short cartridge animation on supported devices;
- automatically simplify 3D effects on low-power or reduced-motion devices.
