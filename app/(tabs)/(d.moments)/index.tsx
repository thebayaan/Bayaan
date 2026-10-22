// @ai-start
import {useState} from 'react';
import {MomentsScreen} from '@/components/moments/MomentsScreen';
import {useOnMomentsTab} from '@/hooks/useOnMomentsTab';

/**
 * Native tabs mount every tab at launch. The feed, its audio players and its
 * downloads wait for the first visit, so people who never open Moments pay
 * nothing for it. After that it stays mounted to keep the user's place.
 */
export default function MomentsTab() {
  const onMoments = useOnMomentsTab();
  const [opened, setOpened] = useState(onMoments);
  if (onMoments && !opened) setOpened(true);
  return opened ? <MomentsScreen /> : null;
}
// @ai-end
