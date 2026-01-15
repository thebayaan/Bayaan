import {useEffect} from 'react';
import {useRouter} from 'expo-router';

/**
 * Catch-all route for unmatched URLs (including deep links like bayaan:///audioShare).
 * Immediately redirects to the home screen so the app always lands on a valid route.
 * The SharedAudioLinkHandler will handle showing the appropriate modal for deep links.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home immediately
    router.replace('/(tabs)');
  }, [router]);

  // Return null since we're redirecting immediately
  return null;
}
