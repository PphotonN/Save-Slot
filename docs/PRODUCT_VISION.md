# Product Vision

## One-sentence definition

**Save Slot is a multilingual, cross-platform game discovery and personal collection manager that combines several trusted databases into one release-aware catalogue.**

## Problem

Game information is fragmented across stores, databases, community sites and platform-specific services. Existing collection managers often have one or more of these limitations:

- weak coverage of older consoles and handhelds;
- a PC-centric model that treats Steam as the catalogue;
- incorrect or generic cover images;
- no distinction between a game and its platform-specific releases;
- ratings without clear source, sample size or platform scope;
- poor mobile usability;
- collection tools limited to a single flat backlog.

Save Slot should solve these problems without becoming a large social network or storefront.

## Primary user outcomes

### Search and discovery

A user can search once and receive deduplicated results from several providers. Each result clearly identifies:

- the game;
- available platform releases;
- release year and region where known;
- verified box art for the selected release;
- official or editorial description;
- screenshots;
- player ratings with source and vote count.

### Collection management

A user can add a specific release to a personal collection and record:

- ownership state;
- physical or digital format;
- platform and region;
- edition;
- progress status;
- personal rating;
- priority;
- notes;
- acquisition data when desired.

### Cross-device use

The same application must remain practical on desktop and smartphone. A user can install it as a PWA, use the collection offline, and later package the same frontend for Android and iOS.

## Target scope

Save Slot should cover:

- PC;
- PlayStation platforms;
- Xbox platforms;
- Nintendo home consoles and handhelds;
- Sega systems;
- major retro platforms;
- modern handhelds;
- mobile releases when reliable provider data exists.

## Core product principles

### Release-aware, not title-only

A title such as `Doom` is a game. Its PlayStation, DOS, Super Nintendo and Game Boy Advance versions are separate releases with different dates, media and sometimes different content. The application must model this explicitly.

### Source transparency

Every imported description, image, screenshot and rating retains:

- provider name;
- provider identifier;
- source URL when permitted;
- platform scope;
- language;
- retrieval time;
- confidence or quality state.

### Box art must be box art

A screenshot, logo or horizontal banner must never silently replace a cover. Missing box art is preferable to misleading art. Users may add a custom image to their private collection record.

### Local ownership of personal data

The first release does not require an account. Collection data is stored locally and can be exported and restored. Optional synchronization may be added later without making the catalogue dependent on user accounts.

### Mobile-first interaction

Touch targets, navigation, filters, card density and game details must be designed for a phone from the beginning. Desktop receives a richer layout, not a separate product.

### Visual identity without sacrificing clarity

The PS1-style slot and cartridge are a signature interaction, not a full-screen visual effect. Text, box art and collection controls remain readable and modern.

## Main application areas

1. **Discover** — random and curated cross-platform selections.
2. **Search** — multi-provider search, filters and release selection.
3. **Game details** — description, media, ratings and releases.
4. **Collection** — owned games and custom lists.
5. **Backlog** — progress, priorities and personal ratings.
6. **Settings** — language, translation, data sources, backup and accessibility.

## Collection views

The collection must support three presentation modes:

- compact list;
- medium information rows;
- cartridge shelf.

All modes operate on the same data and preserve the same active filters and sorting.

## Language and translation

The interface language and content language are independent settings.

- Provider-localized descriptions are preferred.
- The original description remains available.
- A `Translate` action converts the description into the current interface language.
- Translations are cached locally with source language, target language and engine metadata.

## Product boundaries

Save Slot v1 is not intended to be:

- a game launcher;
- an emulator frontend;
- a marketplace;
- a social network;
- a review-writing platform;
- a replacement for provider databases.

Those integrations may be considered later only when they improve collection management.

## Definition of a successful v1

The first public-ready version is successful when a user can:

1. install the PWA on desktop or smartphone;
2. search across at least two broad catalogue providers and one retro-media provider;
3. select a platform-specific release with verified box art;
4. view description, screenshots and sourced player ratings;
5. add the release to a personal collection;
6. manage progress, notes and personal rating;
7. switch between list, row and cartridge views;
8. export and restore all personal data;
9. use the application in Ukrainian and English;
10. use core collection features offline.
