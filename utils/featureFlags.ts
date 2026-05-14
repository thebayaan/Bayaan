import {usePostHog} from 'posthog-react-native';
import {useEffect, useState} from 'react';

export type FlagKey = 'search.v2';

export function useFeatureFlag(key: FlagKey, fallback = false): boolean {
  const posthog = usePostHog();
  const [value, setValue] = useState<boolean>(fallback);

  useEffect(() => {
    if (!posthog) return;
    let cancelled = false;
    Promise.resolve(posthog.isFeatureEnabled(key)).then(v => {
      if (!cancelled) setValue(Boolean(v));
    });
    return () => {
      cancelled = true;
    };
  }, [posthog, key]);

  return value;
}
