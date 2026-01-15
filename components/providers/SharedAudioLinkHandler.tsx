import {useCallback, useEffect, useRef} from 'react';
import * as Linking from 'expo-linking';
import AudioShare from 'expo-audio-share-receiver';
import {useModal} from '@/components/providers/ModalProvider';

const APP_GROUP_ID = 'group.com.bayaan.audioShare';
const SHARE_SCHEME = 'bayaan';

const isShareLink = (url?: string | null) => {
  if (!url) return false;
  const parsed = Linking.parse(url);
  return parsed.scheme === SHARE_SCHEME;
};

export const SharedAudioLinkHandler = () => {
  const {showSharedAudioImport} = useModal();
  const handlingRef = useRef(false);

  const handleShareLink = useCallback(async (url?: string | null) => {
    if (!isShareLink(url) || handlingRef.current) return;
    handlingRef.current = true;
    try {
      await AudioShare.setAppGroup(APP_GROUP_ID);
      const files = await AudioShare.getSharedAudioFiles();
      if (files.length > 0) {
        showSharedAudioImport(files);
      }
    } catch (error) {
      console.warn('[SharedAudioLinkHandler] Failed to load shared files', error);
    } finally {
      handlingRef.current = false;
    }
  }, [showSharedAudioImport]);

  useEffect(() => {
    Linking.getInitialURL().then(handleShareLink).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => {
      handleShareLink(event.url);
    });
    return () => subscription.remove();
  }, [handleShareLink]);

  return null;
};

export default SharedAudioLinkHandler;

