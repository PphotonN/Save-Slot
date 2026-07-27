# Save Slot Mobile

This package is the native Capacitor container for the existing Save Slot SvelteKit application. It does not contain a second frontend.

## Architecture

```text
apps/web/build
      ↓
Capacitor copy/sync
      ↓
apps/mobile/android
```

The Android WebView uses the same domain model, IndexedDB collection and responsive interface as the browser/PWA build.

On a native Capacitor platform, Save Slot deliberately disables the desktop-only project mirror at `127.0.0.1:8791`. Collection data remains in the application WebView's IndexedDB and can still be exported or imported as JSON.

## Requirements

- Node.js 24 or newer;
- pnpm 10.14;
- Android Studio with a supported Android SDK and JDK;
- USB debugging or an Android emulator for direct runs.

## Prepare the Android project

From the repository root:

```bash
pnpm mobile:android:prepare
```

The command:

1. builds `apps/web`;
2. creates `apps/mobile/android` when it does not exist;
3. synchronizes the web build and Capacitor dependencies.

The generated native project should be committed once its application ID, icons, signing strategy and SDK versions are approved.

## Open Android Studio

```bash
pnpm mobile:android:open
```

## Run on an emulator or connected device

```bash
pnpm mobile:android:run
```

## Catalogue API

A phone cannot access the development Worker through desktop `localhost`. For an online native build, set `VITE_SAVE_SLOT_API_URL` for the web build to an HTTPS deployment of the aggregation Worker before running `android:prepare`.

Without that variable, the application remains usable with the representative offline catalogue and the local personal collection.

## Application identity

Current provisional application ID:

```text
com.pphotonn.saveslot
```

Changing it after publishing creates a different Android application, so the final ID must be reviewed before signing or distributing builds.

## Current boundaries

- no account or cloud synchronization;
- no Android release signing configuration;
- no Play Store publishing workflow;
- no native file/share plugins yet;
- personal data stays local unless the user explicitly exports it.
