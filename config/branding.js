/**
 * Bayaan app identity config.
 *
 * CJS (not ESM) — app.config.js calls require() before Expo CLI transpiles.
 * Forks override by replacing this file; the shape is typed in branding.d.ts.
 *
 * See docs/rfcs/007-app-layer-multi-tenancy.md for the design rationale.
 */
module.exports = {
  appName: 'Bayaan',
  appSlug: 'Bayaan',
  urlScheme: 'bayaan',
  bundleId: {
    ios: 'com.bayaan.app',
    android: 'com.bayaan.app',
  },
  supportUrl: 'https://thebayaan.com/support',
  termsUrl: 'https://thebayaan.com/terms',
  privacyUrl: 'https://thebayaan.com/privacy',
  shareBaseUrl: 'https://app.thebayaan.com',
  emailProductName: 'Bayaan',
  catalog: {
    source: 'bundled',
    fallbackPath: undefined,
  },
  /**
   * Order + visibility of Listen-tab home rows. Bayaan's default mirrors
   * the historical hardcoded order in RecitersView.tsx for parity. Forks
   * override this to reorder, hide, or omit rows entirely.
   */
  homeRowConfig: [
    {id: 'continue-listening', enabled: true},
    {id: 'new-to-quran', enabled: true},
    {id: 'favorites', enabled: true},
    {id: 'featured', enabled: true},
    {id: 'adhkar', enabled: true},
    {id: 'follow-along', enabled: true},
    {id: 'playlists', enabled: true},
    {id: 'exclusives', enabled: true},
    {id: 'tajweed', enabled: true},
    {id: 'memorization', enabled: true},
    {id: 'rewayat', enabled: true},
    {id: 'collection', enabled: true},
  ],
  // RFC-018 — community-reflections seam. Bayaan ships no community-content
  // backend, so both `communityReflectionsProvider` and
  // `ayahCommunityReflectionsComponent` are left undefined: the whole
  // surface (Mushaf-settings toggle, inline render, action-sheet row) stays
  // off. A fork sets both to its own provider + render component (see
  // docs/rfcs/018-community-reflections-provider.md).
};
