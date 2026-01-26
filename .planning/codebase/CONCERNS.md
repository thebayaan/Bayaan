# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Global Debug Counters in usePlayback:**
- Issue: Module-level mutable state (`playFromSurahCount`, `loadNextBatchCount`, `trackChangedCount`) persists across component lifecycle, violating React patterns
- Files: `hooks/usePlayback.ts` (lines 32-34)
- Impact: Debug counters continuously increment and never reset; difficult to trace actual call sequences in production debugging
- Fix approach: Move counters to Zustand store or remove entirely; use proper instrumentation/logging framework instead

**Unimplemented Backend Sync:**
- Issue: Future sync infrastructure exists but is stubbed out (TODO comment at line 133)
- Files: `services/player/store/lovedStore.ts` (line 133)
- Impact: Users cannot sync liked tracks across devices or back up preferences
- Fix approach: Implement Supabase sync for `loved_tracks` table; add sync error recovery and conflict resolution

**Hard-coded Rewayat Selection:**
- Issue: First rewayat is always selected; users cannot choose alternate reading styles
- Files: `services/queue/BatchLoader.ts` (line 92), `hooks/usePlayback.ts` (line 54)
- Impact: Users with reciters offering multiple rewayat styles only get one option
- Fix approach: Add rewayat selection UI; pass rewayat selection through queue context; update URL generation to use selected rewayat

**Verse Selection Not Implemented:**
- Issue: Placeholder comment indicates incomplete feature
- Files: `components/player/v2/PlayerContent/index.tsx` (line 90)
- Impact: Users cannot navigate to specific verses within surahs
- Fix approach: Implement verse-level seeking; requires metadata for verse timestamps

**Placeholder Surah Names in Queue:**
- Issue: Surah titles not loaded from data; generic "Surah N" naming used
- Files: `services/queue/BatchLoader.ts` (line 191)
- Impact: Queue display shows generic names instead of proper Surah names (e.g., "Al-Fatiha" vs "Surah 1")
- Fix approach: Import `getSurahById` and populate actual surah names during track creation

## Known Bugs

**Modal Race Condition (Fixed in PR #58):**
- Symptoms: Edit playlist modal fails to open intermittently
- Files: Previously in playlist edit components
- Trigger: Rapid modal open/close or state updates during modal initialization
- Status: Fixed in commit 5ce96d4; related race conditions remain in other state-driven modals

**Downloaded Track Playback Issues (Fixed in PR #60):**
- Symptoms: Downloaded tracks fail to play; app falls back to remote streaming
- Files: `utils/audioUtils.ts`, `services/downloadService.ts`
- Cause: File path resolution on iOS after app updates; absolute paths stored instead of relative paths
- Fix: Implemented `resolveFilePath()` to reconstruct paths at runtime using current documentDirectory

**Local Reciter Upload Data Inconsistencies:**
- Symptoms: Local uploaded reciters may not appear in loved tracks or search results
- Files: Recent refactor in commit e503032 and related changes
- Trigger: Mixing of local vs. remote reciter data; inconsistent IDs or missing metadata
- Workaround: Clear and rebuild loved tracks; reimport reciters
- Risk: Data loss potential if migration between local and remote formats fails

## Security Considerations

**Unencrypted Local Storage:**
- Risk: All user data (loved tracks, playlists, preferences, download metadata) stored in plain AsyncStorage
- Files: `store/playerStore.ts`, `services/player/store/lovedStore.ts`, `services/player/store/downloadStore.ts`, and 10+ other store files
- Current mitigation: App-level security only; relies on device-level encryption
- Recommendations:
  - Consider using `react-native-encrypted-storage` for sensitive data (loved tracks, playlist contents)
  - At minimum, encrypt loved tracks and playlist data before AsyncStorage persistence
  - Document data sensitivity assumptions for end users

**File Path Injection Vulnerability (Partially Mitigated):**
- Risk: Download filenames sanitized but full download URL validation weak
- Files: `services/downloadService.ts` (lines 64-65)
- Current mitigation: Regex sanitization of reciter/rewayat IDs
- Recommendations:
  - Add URL validation and origin checking before download attempts
  - Implement download size limits to prevent disk space exhaustion attacks
  - Add virus scanning integration for downloaded files

**Supabase Anonymous Access:**
- Risk: Audio storage bucket uses anonymous read access; relies solely on URL obscurity
- Files: Configuration in app.json and Supabase project
- Current mitigation: URLs are not easily discoverable but are potentially exposable
- Recommendations:
  - Implement authenticated access to download routes if GDPR/licensing requires
  - Add rate limiting to prevent mass downloads
  - Monitor for unusual download patterns indicating abuse

## Performance Bottlenecks

**Synchronous Zustand Store Access During Track Creation:**
- Problem: Multiple calls to `useDownloadStore.getState()` during URL generation; happens in hot path
- Files: `utils/audioUtils.ts` (lines 42-78), `hooks/usePlayback.ts` (line 352)
- Cause: Store must be "warm" before checks; includes synchronous download status lookups
- Current impact: ~5-50ms per track depending on store size; multiplied by batch operations
- Improvement path:
  - Memoize download status checks; debounce store updates
  - Pre-load download state before batch operations
  - Consider lazy loading downloads incrementally instead of all-at-once

**Large Component Files with Complex State:**
- Problem: ReciterProfile.tsx (1138 lines), BrowseReciters.tsx (955 lines), and others exceed practical size limits
- Files: `components/reciter-profile/ReciterProfile.tsx`, `components/browse/BrowseReciters.tsx`, `components/collection/CollectionSearchModal.tsx` (909 lines)
- Cause: Multiple concerns (display, filtering, playback control, navigation) in single component
- Impact: Hard to test; difficult to optimize; high cognitive load; potential re-render cascades
- Improvement path:
  - Split by domain (view + search + playback actions)
  - Extract sub-components to separate files
  - Use memoization to prevent child re-renders
  - Consider state machine pattern for complex flows

**Debounced Batch Loading with Global State:**
- Problem: `debouncedLoadNextBatch` in usePlayback uses 500ms debounce with loose state management
- Files: `hooks/usePlayback.ts` (lines 82-172)
- Cause: Module-level `queueState` and `isLoadingBatch` variables; complex lifecycle interactions
- Impact: Batch loading may fail silently if debounce timing conflicts with track changes; hard to debug
- Improvement path:
  - Move state to Zustand store with proper state machine (IDLE → LOADING → READY)
  - Implement proper abort/cancellation for loading requests
  - Add timeout handling for stalled batch loads

**Track Creation in Parallel Loop Bug:**
- Problem: Promise.all map creates tracks with incorrect variables (closure bug)
- Files: `hooks/usePlayback.ts` (lines 391-402)
- Details: All tracks created with same `surah.id` instead of iterating surah
- Impact: Remaining tracks all point to same surah, breaking queue continuity
- Fix: Use proper mapping function: `remainingSurahs.map(surah => createTrack(surah))`

## Fragile Areas

**usePlayback Hook:**
- Files: `hooks/usePlayback.ts`
- Why fragile:
  - Global state management outside of stores (queueState, isLoadingBatch)
  - Complex async flow with multiple race conditions (track change, debounce, batch loading)
  - Tight coupling to TrackPlayer events and Zustand stores
  - Hard-coded batch sizes (INITIAL_BATCH_SIZE=3, NEXT_BATCH_SIZE=5, LOAD_THRESHOLD=2)
- Safe modification:
  - Extract state to proper Zustand store before making changes
  - Write integration tests for track change → batch load scenarios
  - Test with different batch sizes to verify thresholds
  - Add loading state visualization so users know when batches are loading
- Test coverage: Insufficient; hook integration not testable in current form

**ReciterProfile Component:**
- Files: `components/reciter-profile/ReciterProfile.tsx` (1138 lines)
- Why fragile:
  - Mixed concerns (display, search, filtering, playback)
  - Heavy use of useState for complex state (search query, view mode, sort, filters)
  - Multiple animated values and refs that may not clean up properly
  - Nested component tree makes re-render optimization difficult
- Safe modification:
  - Make changes in smallest isolated sections (e.g., SearchView sub-component only)
  - Test specific filter/sort combinations exhaustively before committing
  - Use React DevTools Profiler to verify no unexpected re-renders
  - Consider extracting hooks (useReciterSearch, useSurahFiltering) first
- Test coverage: No visible unit tests for filtering/sorting logic

**BrowseReciters Component:**
- Files: `components/browse/BrowseReciters.tsx` (955 lines)
- Why fragile:
  - Dual purpose (browse + search); extensive conditional rendering
  - Complex FlatList optimization with teacher/student selection logic
  - DEBUG logging statements left in (line 475+)
  - State synchronization between search input and filtered results
- Safe modification:
  - Remove DEBUG logging blocks (lines 475-495) before changes
  - Test list scrolling performance after any changes
  - Verify teacher/student selection filtering works in all combinations
- Test coverage: Gaps around search filtering logic

**Download Store State Synchronization:**
- Files: `services/player/store/downloadStore.ts`
- Why fragile:
  - Throttled progress updates may lose data during rapid download completion
  - Multiple stores (playerStore, downloadStore) must stay in sync but have no coordination
  - Download metadata migration from old format (no rewayatId) may fail silently
- Safe modification:
  - Test with large numbers of concurrent downloads (10+) to verify throttling
  - Verify progress reaches exactly 1.0 even with throttling active
  - Test migration of old download records in isolated environment
- Test coverage: No visible tests for concurrent download scenarios

## Scaling Limits

**AsyncStorage Performance with Growing Data:**
- Current capacity: ~1000 loved tracks, ~500 playlist entries before noticeable slowdown
- Limit: AsyncStorage becomes noticeably slow (>200ms operations) at ~10,000 items
- Risk: App can store unlimited downloads; no cleanup mechanism
- Scaling path:
  - Implement SQLite migration for loved tracks and playlists (infrastructure exists via databaseService)
  - Add automatic cleanup for old downloaded files (>30 days)
  - Implement pagination for large playlists instead of loading all at once
  - Consider lazy-loading for loved tracks collection

**Track Queue Memory:**
- Current capacity: ~500 tracks in queue before noticeable slowdown
- Limit: React Native Track Player queues entire playlist in memory
- Risk: Very long surahs collections (all 114 surahs) queued at once consume ~30MB
- Scaling path:
  - Maintain queue at fixed size (current ~50 tracks) via batch loading (already implemented)
  - Add memory monitoring to detect queue bloat
  - Implement virtual list for queue display if users scroll large queues

**Reciter Data Size:**
- Current: ~120 reciters × 5 fields per reciter ≈ 60KB
- Limit: Adding reciter-specific metadata (cover art URLs, detailed biographies) could balloon to 500KB+
- Risk: App initialization could slow if reciter data grows significantly
- Scaling path:
  - Keep reciter data in separate file; load on-demand
  - Implement reciter data caching with expiry
  - Use image URLs instead of base64 embedded images

## Dependencies at Risk

**React Navigation @ v7:**
- Risk: Relatively new major version; fewer production deployment reports
- Impact: Navigation edge cases may cause crashes; library updates sometimes require app refactor
- Current usage: File-based routing via Expo Router (v4) mitigates but navigation state still used
- Migration plan: Expo Router (v5+) is more stable; consider full migration away from React Navigation

**react-native-track-player @ v4.1.1:**
- Risk: Audio library; critical to app function; known issues with some device codecs
- Impact: Download playback may fail on some devices; audio format compatibility issues
- Current workaround: Smart URL generation with local fallback (working)
- Migration plan: Monitor issue tracker; update to v5 when available (breaking changes expected)

**@rneui/base @ v4.0.0-rc.7 (Release Candidate):**
- Risk: Pre-release version used in production; may have stability issues
- Impact: UI components may behave unexpectedly; props may change without warning
- Recommendation: Upgrade to stable release (v4.0.0+) as soon as available

**expo-router @ v4.0.20:**
- Risk: File-based routing can cause unexpected behavior with dynamic routes
- Impact: Deep linking, state persistence across navigation changes
- Current issues: Race condition in edit playlist modal (partially fixed in PR #58) suggests routing/state timing issues
- Recommendation: Upgrade to v5+ when available; test all route transitions thoroughly

## Missing Critical Features

**Cross-Device Sync:**
- Problem: No mechanism to sync loved tracks, playlists, or progress across devices
- Blocks: Users cannot switch phones; must manually rebuild preferences
- Impact: Low for casual users; critical for power users with extensive loved tracks
- Estimated effort: 2-3 weeks (requires Supabase schema design, conflict resolution, offline queue)

**Offline Mode with Selective Download:**
- Problem: Users must download entire surahs; cannot download specific verses or ranges
- Blocks: Storage-conscious users cannot download long surahs
- Impact: Users with limited storage must choose between few complete surahs or no offline playback
- Estimated effort: 1-2 weeks (requires verse metadata, segmented downloads)

**Rewayat Selection UI:**
- Problem: App always uses first rewayat; no UI to switch reading styles
- Blocks: Users with multi-rewayat reciters forced to listen to single style
- Impact: Lower feature parity with other Quran apps
- Estimated effort: 3-5 days (requires UI + state plumbing)

**Playback Statistics:**
- Problem: No tracking of listening time, completed surahs, or progress analytics
- Blocks: Users cannot see personal learning metrics
- Impact: Lower engagement; users don't see value of offline downloads
- Estimated effort: 1 week (requires tracking infrastructure + UI)

## Test Coverage Gaps

**usePlayback Hook:**
- What's not tested: Batch loading logic, race conditions between track changes and batch loads, debounce timing
- Files: `hooks/usePlayback.ts`
- Risk: High - core playback feature; race conditions can cause silent failures or skipped surahs
- Priority: **High** - implement integration tests for playback scenarios
- Approach: Mock TrackPlayer, test queue state after track changes, verify batch loading thresholds

**ReciterProfile Component:**
- What's not tested: Filtering logic, sorting combinations (by name, by revelation order), search functionality
- Files: `components/reciter-profile/ReciterProfile.tsx`
- Risk: High - complex filtering can break silently; users may not realize filters are wrong
- Priority: **High** - implement unit tests for filter/sort functions
- Approach: Extract filter/sort logic to utilities; write tests for all combinations

**Download Service:**
- What's not tested: Concurrent downloads, file path resolution edge cases, download resumption, quota checking
- Files: `services/downloadService.ts`
- Risk: Medium - downloads may fail silently or leave orphaned files
- Priority: **High** - implement integration tests for download scenarios
- Approach: Mock FileSystem; test download states, verify file cleanup on failure

**Local Reciter Upload Feature:**
- What's not tested: Upload validation, data migration, playback of local reciters, mixing with remote reciters
- Files: Recent features (commits e503032+)
- Risk: High - new feature likely has edge cases; data migration between local/remote unstable
- Priority: **High** - implement comprehensive tests for upload/migration workflows
- Approach: Create test fixtures for local files; test all state combinations

**Loved Tracks Migration:**
- What's not tested: Data persistence across store schema changes, backward compatibility with old format
- Files: `services/player/store/lovedStore.ts` (lines 52-62)
- Risk: Medium - silent data loss during format migration
- Priority: **Medium** - add integration tests for store hydration
- Approach: Create test AsyncStorage with old format data; verify migration succeeds without data loss

---

*Concerns audit: 2026-01-26*
