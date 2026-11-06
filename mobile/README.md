# Time Capsule mobile foundation

Expo SDK 57 / React Native / TypeScript. The root Vite app remains the production web app.

## Run

1. Install Node LTS and run `npm install` in `mobile/`.
2. Copy `.env.example` to `.env` and fill in the Supabase **publishable** URL and key. Never put a service key here.
3. Run `npx expo start` and scan the QR code with Expo Go on a phone on the same network. Use `npx expo start --tunnel` when LAN is unavailable. Press `w` for web or run `npm run web`.
4. Use `npm run typecheck` for TypeScript. The root web app still builds with `npm run build` from the repository root.

Expo Go cannot support the app-specific OAuth scheme; Google sign-in requires an Expo development build. Before testing link-based email flows, add the exact Expo Go URL shown by the running server and its `/--/auth/callback` path to Supabase Authentication → URL Configuration; keep existing entries. Web testing also requires the exact localhost callback URL. Production `timecapsule://auth/callback` is separately allowlisted. The native application IDs are placeholders.

## Layout and conventions

- `app/`: Expo Router entry points, auth callback, modal create route, and developer playground.
- `src/features/`: one folder per screen; F1 owns home/capsule, F2 create, F3 journey, and F4 shop/me/friends/invite/cabinet. F0 owns auth/profile and shared foundation.
- `src/components/`: shared UI; `src/art/manifest.ts` registers bundled illustrated assets as they become available. Legacy SVG artwork remains available and can be selected in the dev setting.
- `src/services/`: Supabase client, auth state, and existing table/RPC access. Do not read `capsule_contents` directly.
- `src/theme.ts`: colours, font names, spacing, shadows, motion; `src/components/haptics.ts` is the haptic vocabulary.
- `src/i18n/webStrings.ts` mirrors the web keys; add translations to both languages and use `useLanguage().t` in UI.

The six scenes from the feel demo remain in the development-only Playground. Illustration assets are not bundled yet, so avatars and vessels use SVG fallbacks.
