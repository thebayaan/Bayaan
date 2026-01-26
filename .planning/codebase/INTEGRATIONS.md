# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**Supabase:**
- Service: Supabase (Firebase alternative)
- What it's used for: Data synchronization and storage for reciters, rewayat (recitation styles), and audio metadata
- SDK/Client: `@supabase/supabase-js` 2.91.0
- Auth: Environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Implementation: Fetch script at `scripts/fetchReciterData.ts` pulls reciter and rewayat data from Supabase tables and generates `data/reciters.json`
- Tables accessed:
  - `reciters` - Reciter information (id, name, date, image_url)
  - `rewayat` - Recitation style/version info (id, reciter_id, name, style, server, surah_total, surah_list)

**Audio Source Servers:**
- Service: Multiple servers hosting Quran audio files
- What it's used for: MP3 audio file hosting for streaming and download
- Server URL pattern stored in: Rewayat.server field (e.g., `https://redacted.supabase.co/storage/v1/object/public/quran-audio/reciters/{folder}`)
- Audio file format: MP3 files named with 3-digit surah numbers (001.mp3 to 114.mp3)

**Email Service (Postmark):**
- Service: Postmark email service
- What it's used for: Verification email delivery
- SDK/Client: `postmark` package (imported in `services/emailService.ts`)
- Auth: `POSTMARK_API_KEY` configured via `Constants.expoConfig?.extra?.postmarkApiKey`
- Implementation: `services/emailService.ts` - `sendVerificationEmail()` function
- Template: Template alias `email-verification-bayaan-1`

## Data Storage

**Databases:**
- Primary: SQLite via `expo-sqlite` 15.1.4
  - Database file: `playlists.db`
  - Client: Expo SQLite async API
  - Schema: `user_playlists`, `playlist_items` tables
  - Initialization: `services/database/DatabaseService.ts` creates and manages tables
  - Connection: Idempotent initialization with WAL (Write-Ahead Logging) mode enabled
  - Service registration: Handled by `services/AppInitializer.ts` at priority 1 (critical)

**Local File Storage:**
- AsyncStorage: Device-local key-value storage
  - Managed via `@react-native-async-storage/async-storage` 1.23.1
  - Used for: Recent reciters, favorite reciters, playlist cache, playback state, theme settings
  - Storage keys: Stored in stores (`store/` directory) with Zustand persistence
  - Persistence: AsyncStorage integrated with Zustand using `persist` middleware

**File System Storage:**
- Expo FileSystem: Local file storage for downloaded audio files
  - Location: App document directory (`FileSystem.documentDirectory`)
  - Files stored relative to prevent iOS app container UUID issues on updates
  - Used for: Offline Quran recitations
  - Implementation: `services/downloadService.ts` - `downloadSurah()` function
  - File naming: Padded surah number + reciter ID + rewayat ID (e.g., `001_reciter-id_rewayat-id.mp3`)

**Caching:**
- React Query-like patterns: Zustand stores with derived state
- FastImage caching: `react-native-fast-image` 8.6.3 handles image caching
- Color extraction caching: Dynamic palette cached in `playerStore.cachedColors`

## Authentication & Identity

**Auth Provider:**
- Type: Custom/Anonymous
- Implementation approach:
  - Supabase anonymous auth for read-only data access
  - No user account system currently in place
  - Postmark email verification for future feature integration
- No user login/registration UI in current version

## Monitoring & Observability

**Error Tracking:**
- Status: Not detected
- Errors logged to console via native logging

**Logs:**
- Approach: Console logging throughout services
- Key logging locations:
  - `services/AppInitializer.ts` - Service initialization logs with timing
  - `services/player/events/playbackService.ts` - Playback event logs
  - `services/database/DatabaseService.ts` - Database operation logs
  - All services use `console.log()`, `console.error()`, `console.warn()`

## CI/CD & Deployment

**Hosting:**
- iOS: Apple App Store (via TestFlight for beta)
- Android: Google Play Store
- Deployment: EAS (Expo Application Services)
- Build configuration: `expo prebuild` generates native code before compilation

**CI Pipeline:**
- Status: Not detected in codebase
- Manual build process documented in `docs/deployment/deployment.md`
- Build scripts: `ios-archive.sh` for iOS archival

**OTA Updates:**
- Service: Expo Updates
- Configuration: `expo-updates` 0.27.4
- Enabled in `app.config.js`: `updates.enabled = true`, `checkAutomatically = 'ON_LOAD'`
- Fallback timeout: 2 seconds

## Environment Configuration

**Required env vars:**
- `NODE_ENV` - Set to "production" in .env
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous API key
- `APPLE_TEAM_ID` - Apple Developer Team ID for iOS signing
- `POSTMARK_API_KEY` - Email service API key (optional, for email features)
- `POSTMARK_FROM_EMAIL` - Sender email address (optional)

**Build-time vars (gradle.properties for Android):**
- `BAYAAN_UPLOAD_KEYSTORE_PATH` - Path to Android signing keystore
- `BAYAAN_UPLOAD_KEYSTORE_PASSWORD` - Keystore password
- `BAYAAN_UPLOAD_KEY_ALIAS` - Key alias
- `BAYAAN_UPLOAD_KEY_PASSWORD` - Key password

**Secrets location:**
- `.env` file at project root (not committed, must be created locally)
- `~/.gradle/gradle.properties` - Android signing credentials
- Keystore: `~/Documents/app-credentials/bayaan/keystore/bayaan-upload-key.keystore`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected
- Note: Email verification flow in `services/emailService.ts` is setup-ready but may not be fully integrated

---

*Integration audit: 2026-01-26*
