---
name: Ionicons Android Fix
description: How to import @expo/vector-icons in pnpm monorepos so Android Hermes doesn't crash
---

## Rule
Always use the **direct file import** for `@expo/vector-icons` in pnpm monorepos:

```js
// ✅ Works on Android (Hermes + pnpm)
import Ionicons from "@expo/vector-icons/Ionicons";

// ❌ Crashes on Android — Hermes throws: "Property 'Ionicons' doesn't exist"
import { Ionicons } from "@expo/vector-icons";
```

Also applies to `_layout.tsx` useFonts — use the direct import for `Ionicons.font` too.

**Why:** pnpm does not hoist packages by default. Android's Hermes JS engine cannot resolve barrel exports from `@expo/vector-icons` when the package lives in a non-hoisted symlink location. The direct file import bypasses the barrel and resolves correctly.

**How to apply:** Any file importing from `@expo/vector-icons` must use the direct path (e.g. `@expo/vector-icons/Ionicons`), never the named barrel export `{ Ionicons }`.

## Other Android crash causes found in this project
- `react-native-keyboard-controller` (KeyboardProvider) — native module not configured as expo plugin → crashes Expo Go on Android. Removed from `_layout.tsx`.
- `newArchEnabled: false` in `app.json` — Expo Go always uses New Architecture; conflict causes instability. Removed.
- `lucide-react-native` — uses `react-native-svg` which mismatches Expo Go 54's bundled native side. Do NOT use.
