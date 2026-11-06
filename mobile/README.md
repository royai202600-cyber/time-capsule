# Time Capsule mobile foundation

Expo SDK 58 / React Native / TypeScript. The root Vite app remains the production web app.

## Run

1. Install Node LTS and run `npm install` in `mobile/`.
2. Copy `.env.example` to `.env` and fill in the Supabase **publishable** URL and key. Never put a service key here.
3. Run `npm start` (which selects Expo Go) and scan the QR code with Expo Go on a phone on the same network. Use `npx expo start --go --tunnel` when LAN is unavailable. Press `w` for web or run `npm run web`.
4. Use `npm run typecheck` for TypeScript. The root web app still builds with `npm run build` from the repository root.

Expo Go cannot support the app-specific OAuth scheme; Google sign-in requires an Expo development build. Before testing link-based email flows, add the exact Expo Go URL shown by the running server and its `/--/auth/callback` path to Supabase Authentication → URL Configuration; keep existing entries. Web testing also requires the exact localhost callback URL. Production `timecapsule://auth/callback` is separately allowlisted. The native application IDs are placeholders.

## Layout and conventions

- `app/`: Expo Router entry points, auth callback, and modal create route.
- `src/features/`: one folder per screen; F1 owns home/capsule, F2 create/shop, F3 journey, and F4 me/friends/invite/cabinet. F0 owns auth/profile and shared foundation.
- `src/components/`: shared UI; `src/art/manifest.ts` registers WebP illustrations from the repository's `public/art/` through Metro. Legacy SVG vessels and avatars remain available as fallbacks.
- `src/services/`: Supabase client, auth state, and existing table/RPC access. Do not read `capsule_contents` directly.
- `src/theme.ts`: colours, font names, spacing, shadows, motion; `src/components/haptics.ts` is the haptic vocabulary.
- `src/i18n/webStrings.ts` mirrors the web keys; add translations to both languages and use `useLanguage().t` in UI.

Metro watches the repository root and resolves packages from `mobile/node_modules`. This keeps one copy of each art file. The feel demo playground and CanvasKit bundle were removed after the app screens took over.

## Opening the project on a phone

Use Expo Go rather than the phone browser for an `exp://` or `exps://` link. If a LAN QR times out, start a separate tunnel with `npx expo start --go --tunnel --port 8085` and scan its new QR. Expo may install its ngrok helper for the tunnel. Keep the terminal process running. Each Expo Go build supports a matching SDK; this project uses SDK 58. On physical iOS, Expo may also require Expo CLI and Expo Go to be signed into the same Expo account (`npx expo login`, then the account menu on the phone).

## F0 verification and remaining checks

- Roy verified email/password sign-in, portrait/name setup, profile saving and Home on an iPhone in Expo Go. The Home buttons lead to placeholders; F1–F4 build the actual feature flows.
- Google sign-in returned to Home in the phone browser. Native Google requires a development build because Expo Go cannot own the `timecapsule` scheme. This is a build type, not a paid Time Capsule account.
- To test native Google later: choose the final app identifiers, configure an EAS project with `eas build:configure`, create an iOS development build with `eas build --profile development --platform ios`, install it, then run `npx expo start --dev-client`. EAS will walk Roy through Apple signing and device registration; Apple membership requirements depend on the distribution method. The existing native callback is `timecapsule://auth/callback`.
- End-to-end signup verification and password-reset email delivery have not been verified. The hosted project's existing built-in email restrictions remain; T2 supplies custom SMTP. Temporary LAN/Expo callbacks must match the currently running server before testing email links, or Supabase can fall back to the production Site URL. The reserved-domain test account cannot receive email.
- Native bundle identifiers (`app.timecapsule.mobile`) remain placeholders. No database schema changes were needed. The root website remains the production deployment.

## F3 Journey and place map

`src/features/journey/` contains the Journey map, Passport, capsule map page, and foreground location hook. F1's capsule screen can import `CapsuleMapPage`, `usePlaceDistance`, and `openingCoordinates`; see that folder's README. `react-native-maps` provides the real map in Expo Go on iOS and Android; the web version embeds OpenStreetMap. The location prompt follows an in-app explainer. The development map page has a fake-arrival toggle.

Background proximity reminders are not part of this foreground implementation. They would need `expo-task-manager` background updates, a development/store build (Expo Go does not provide the full background behavior), iOS/Android background location permissions and store review. Keep foreground GPS for opening itself.
