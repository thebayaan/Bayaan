// @ai-generated
import {useCallback, useRef} from 'react';
import {useFocusEffect, useRouter} from 'expo-router';

export type ReaderLinkParams = {page?: string; surah?: string; ayah?: string};

/**
 * The hand-off of a link route (app/mushaf/[page].tsx, app/quran/[surah].tsx)
 * to the one Mushaf reader. A <Redirect> replaces the link route, so with a
 * reader open it stacked a second reader, and Back showed the first one.
 * `dismissTo` (POP_TO) pops back to the open reader and gives it these
 * params. With no reader in the stack, it replaces the link route with one,
 * as <Redirect> did.
 */
export function ReaderLinkRedirect({params}: {params: ReaderLinkParams}): null {
  const router = useRouter();
  // The link's params do not change while it is on screen: hand off the
  // first ones, once for each focus (as <Redirect> does).
  const target = useRef(params).current;
  useFocusEffect(
    useCallback(() => {
      router.dismissTo({pathname: '/mushaf', params: target});
    }, [router, target]),
  );
  return null;
}
