import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {createGuardedJSONStorage} from '@/utils/guardedJSONStorage'; // @ai

/**
 * User consent for anonymous product-usage analytics.
 *
 * Opt-out model: defaults to `true` (analytics on), and the user can turn it
 * off from Settings → Privacy. The choice is persisted across launches and is
 * applied to the live PostHog instance via `analyticsService.applyConsent`.
 */
interface AnalyticsConsentState {
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
}

export const useAnalyticsConsentStore = create<AnalyticsConsentState>()(
  persist(
    set => ({
      analyticsEnabled: true,
      setAnalyticsEnabled: (enabled: boolean) =>
        set({analyticsEnabled: enabled}),
    }),
    {
      name: 'analytics-consent-store',
      storage: createGuardedJSONStorage(), // @ai
    },
  ),
);
