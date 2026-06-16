---
name: Ionicons Android Fix
description: Why @expo/vector-icons fails on Android Expo Go in pnpm monorepos and how it was resolved.
---

## The Problem
`@expo/vector-icons` (Ionicons, Feather, etc.) uses font files loaded via `useFonts`. In a pnpm monorepo, Metro bundler fails to resolve the font files through pnpm symlinks on Android Expo Go — icons render as blank squares or don't show at all. iOS works because Expo Go pre-bundles the fonts.

## The Fix
Replace `@expo/vector-icons` entirely with `lucide-react-native`, which uses SVG components (via `react-native-svg`). No font loading is required. Works on Android, iOS, and web.

**How:** Created `artifacts/mobile/components/Icon.tsx` — a wrapper that maps Ionicons/Feather icon name strings to the corresponding lucide-react-native component. Accepts `name`, `size`, `color`, `strokeWidth` props — same API as `Ionicons`.

**Why:** SVG-based icons bypass the font loading pipeline entirely. `react-native-svg` was already installed in the project.

## How to Apply
- When adding new icons, add them to the `ICON_MAP` in `components/Icon.tsx`
- Import `{ Icon }` from `@/components/Icon` everywhere, never `@expo/vector-icons`
- `strokeWidth` defaults to 1.5 for outline icons, 2 for filled ones
- Icon names come from Ionicons naming convention (the app's existing names)
