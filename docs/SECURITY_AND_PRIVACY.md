# Security and Privacy

## Principles

Save Slot should remain useful without requiring an account. Personal collection data belongs to the user and must not be sent to catalogue providers.

## Data classification

### Public catalogue data

- game metadata;
- release metadata;
- cover and screenshot references;
- provider ratings;
- provider identifiers.

This data may be cached by the Worker according to provider terms.

### Personal local data

- collection entries;
- custom lists;
- progress status;
- personal ratings;
- notes;
- purchase information;
- custom tags;
- custom covers;
- cached translations.

This data remains on the device in v1 unless the user explicitly exports it.

### Secrets

- IGDB/Twitch credentials;
- RAWG key when enabled;
- MobyGames key when enabled;
- translation-provider credentials;
- deployment tokens.

Secrets are stored only in the backend environment secret store. They are never included in frontend bundles, repository files, client logs or export files.

## Local storage

IndexedDB is used for structured personal data. Requirements:

- schema versioning;
- transactional migrations;
- backup before destructive migrations;
- validation on load;
- export to a documented JSON format;
- no executable content in imported data;
- size limits for custom images and notes.

## Export and import

Exports include personal data and minimal game snapshots needed for offline restoration.

Exports do not include:

- provider API credentials;
- Worker secrets;
- browser session identifiers;
- cached provider responses not required by the collection.

Import requirements:

- validate format and schema version;
- preview item counts before applying;
- support merge and replace;
- preserve a rollback backup;
- reject unsupported executable or HTML content;
- sanitize all user-facing text before rendering.

## Backend privacy

The Worker should not receive collection contents in the first release.

Allowed request data:

- search query;
- selected language;
- filters needed for provider queries;
- game/release identifiers;
- translation source text only after an explicit translation action.

Do not log:

- personal notes;
- collection exports;
- personal ratings;
- full translated descriptions;
- device-specific identifiers.

## Logging

Default logs may include:

- anonymous request route;
- provider name;
- response status category;
- latency;
- cache status;
- normalized error code.

Search terms should be excluded from persistent logs or sampled only after an explicit privacy review.

## External media

Direct third-party image loading may reveal the user's IP address and referrer to the provider. The implementation must decide per provider whether to:

- load directly;
- proxy through the Worker;
- cache a permitted derivative;
- avoid the provider entirely.

The choice must comply with the provider's current terms and be recorded in `docs/DECISIONS.md`.

## Content security

Frontend requirements:

- strict Content Security Policy;
- no inline executable scripts;
- no unsanitized HTML from providers;
- `rel="noreferrer noopener"` on external links;
- validate all provider URLs;
- restrict image and API origins;
- use Subresource Integrity when appropriate for third-party static assets;
- prefer bundled dependencies over runtime CDN scripts.

## Worker security

- allow only documented routes and methods;
- validate query lengths and parameter ranges;
- rate limit abusive clients;
- enforce provider concurrency limits;
- do not expose upstream credentials or raw error bodies;
- set explicit CORS origins in production;
- validate normalized provider responses with runtime schemas;
- set safe response headers;
- use separate secrets for preview and production.

## Translation privacy

Translation is opt-in per description.

The UI must disclose when text will be sent to an external translation service. Local browser translation is preferred when available and reliable. Server translation must:

- send only the selected description;
- avoid attaching collection context;
- avoid logging translated content;
- cache by content hash where permitted;
- retain engine and language metadata locally.

## Accounts and synchronization

Accounts are out of scope for the first release. If synchronization is introduced later, it requires a separate design covering:

- authentication;
- encrypted transport;
- conflict resolution;
- deletion and export rights;
- server-side encryption strategy;
- recovery;
- privacy policy;
- breach response.

Do not add a quick login system before these questions are resolved.

## Dependency security

- lock dependencies;
- use automated vulnerability checks;
- review packages that access the network or filesystem;
- minimize runtime dependencies;
- avoid abandoned PWA and storage plugins;
- pin GitHub Actions by major version or commit where practical.

## Release checklist

Before public deployment:

- provider terms reviewed;
- secrets confirmed absent from Git history and bundles;
- CSP tested;
- import fuzz tests pass;
- migration tests pass;
- mobile storage behaviour tested;
- offline data loss scenarios tested;
- privacy disclosures written;
- public error responses reviewed;
- Pages or production deployment explicitly enabled by the owner.
