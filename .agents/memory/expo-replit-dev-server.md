---
name: Expo dev server on Replit — Expo Go connection hangs
description: Why Expo Go times out connecting to the Metro dev server on Replit, and the correct env-var fix
---

# Expo Go "request timed out" / "Opening project… taking longer than it should"

## Symptom
Expo Go on a device cannot open the app: "Opening project… taking longer than
it should" then "There was a problem running the requested app. Unknown error:
The request timed out." Web preview bundles fine; the device never gets the
manifest/bundle.

## Root cause
The Expo CLI dev server blocks on an **interactive login prompt** when an
anonymous Expo Go client connects to a dev server not signed into an Expo
account:

```
? It is recommended to log in with your Expo account before proceeding.
  Learn more: https://expo.fyi/unverified-app-expo-go
❯ Log in
  Proceed anonymously
```

In a Replit workflow there is no TTY to answer it, so the packager stalls and
the device times out. `expo start --non-interactive` does NOT fix this — the CLI
prints `--non-interactive is not supported` and prompts anyway.

## Fix
Set **`EXPO_OFFLINE=1`** as an env prefix on the `dev` script in the mobile
artifact's `package.json`. It stops the CLI from contacting Expo's account
servers (the thing that triggers the prompt) while keeping interactive watch
mode and hot reload.

**Why not `CI=1`:** it suppresses the prompt but then crashes with
`CommandError: Input is required, but 'npx expo' is in non-interactive mode`
and disables reloads/watch mode (`Metro is running in CI mode, reloads are
disabled`). Wrong tool. Use `EXPO_OFFLINE=1`.

## How to apply
The dev script env prefix should include `EXPO_OFFLINE=1` alongside the existing
`EXPO_PACKAGER_PROXY_URL` / `REACT_NATIVE_PACKAGER_HOSTNAME` vars. After editing,
restart the `artifacts/mobile: expo` workflow.

## Verifying from the shell
- Metro/web port comes from the artifact's `PORT` (e.g. 18115); the proxy domain
  is `$REPLIT_EXPO_DEV_DOMAIN`.
- Manifest: `curl -s -H "expo-platform: ios" http://localhost:<PORT>/` → HTTP 200.
- Force-compile native bundle (first cold compile is ~16s, warm ~1s):
  fetch the `expo-router/entry.bundle?platform=ios&dev=true&...&transform.engine=hermes`
  URL from the manifest's `launchAsset`. A clean HTTP 200 with multi-MB body and
  no trailing JSON `errors` array means the bundle is healthy.
- Confirm the running flag: `ps aux | grep "expo start"` should show
  `EXPO_OFFLINE=1`. Note: the rotated workflow log file may show stale buffered
  content from the previous run — trust `ps` over the log head.

## Related gotcha
Running `pnpm --filter @workspace/api-spec run codegen` (Orval) momentarily
deletes `lib/api-client-react/src/generated/{api,api.schemas}.ts` during its
"Cleaning output folder" step. Metro/Vite can cache that transient "module not
found" failure, crashing the app even after the files are regenerated. Fix:
restart the affected workflow to clear the bundler cache.
