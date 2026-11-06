import {useLeaveLinkRoute} from '@/hooks/useLeaveLinkRoute';

// An unknown link (an old widget, a typo) shows the screen underneath.
export default function NotFound(): null {
  useLeaveLinkRoute();
  return null;
}
