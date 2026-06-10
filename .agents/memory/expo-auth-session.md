---
name: Expo Auth Session in pnpm workspace
description: How to use Google OAuth with expo-auth-session without the providers/google subpath that breaks Metro bundler
---

## Rule
Do NOT import `expo-auth-session/providers/google`. Metro cannot resolve pnpm-symlinked subpath exports for this package.

**Why:** In a pnpm workspace, Metro's resolver walks `node_modules` and `../../node_modules` but cannot follow the deep `.pnpm` symlink for subpath exports like `expo-auth-session/providers/google`. This causes `UnableToResolveError` on native and Expo Go even though the web preview works fine (Vite handles it differently).

**How to apply:** Use the base `expo-auth-session` import with a manual Google OAuth discovery document:

```typescript
import * as AuthSession from "expo-auth-session";

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const [request, response, promptAsync] = AuthSession.useAuthRequest(
  { clientId, redirectUri, scopes: ["openid","profile","email"], responseType: AuthSession.ResponseType.Token },
  GOOGLE_DISCOVERY,
);
```

## Version pinning
For Expo SDK ~54, pin: `expo-auth-session@~7.0.11` (devDependencies).
`pnpm add` without version installs ^56.x which is incompatible — always pin explicitly.

## CI flag
Use `CI=1` in the dev script to suppress Expo's interactive "log in to your account" prompt. `--non-interactive` flag is deprecated and prints a warning.
