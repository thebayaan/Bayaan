import Share from 'react-native-share';
import {Linking, Platform} from 'react-native';
import type {StoryShareResult} from '@/components/share/instagram-story/types';

const FB_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

export interface ShareToInstagramStoryParams {
  backgroundUri: string;
  stickerUri: string;
  attributionUrl: string;
}

export async function shareVerseToInstagramStory(
  params: ShareToInstagramStoryParams,
): Promise<StoryShareResult> {
  if (!FB_APP_ID) {
    return {shared: false, reason: 'share-error'};
  }

  const installed = await isInstagramInstalled();
  if (!installed) {
    return {shared: false, reason: 'not-installed'};
  }

  try {
    await Share.shareSingle({
      social: Share.Social.INSTAGRAM_STORIES,
      appId: FB_APP_ID,
      backgroundImage: params.backgroundUri,
      stickerImage: params.stickerUri,
      attributionURL: params.attributionUrl,
      linkUrl: params.attributionUrl,
    } as never);
    return {shared: true};
  } catch (err: unknown) {
    if (isCancel(err)) return {shared: false, reason: 'cancelled'};
    return {shared: false, reason: 'share-error'};
  }
}

async function isInstagramInstalled(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return Linking.canOpenURL('instagram-stories://');
  }
  // Android: check package presence via Share helper.
  try {
    return Boolean(
      await (
        Share as unknown as {
          isPackageInstalled?: (pkg: string) => Promise<{isInstalled: boolean}>;
        }
      )
        .isPackageInstalled?.('com.instagram.android')
        .then(r => r.isInstalled),
    );
  } catch {
    return false;
  }
}

function isCancel(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('user did not share') || msg.includes('user dismissed')) {
      return true;
    }
  }
  const shaped = err as {error?: string; code?: string} | null;
  if (shaped?.error?.toLowerCase().includes('dismiss')) return true;
  if (shaped?.code === 'ECANCELLED') return true;
  return false;
}
