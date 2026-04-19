import {shareVerseToInstagramStory} from '../instagramStoryShare';
import Share from 'react-native-share';
import {Linking, Platform} from 'react-native';

jest.mock('expo/virtual/env', () => ({
  env: {EXPO_PUBLIC_FACEBOOK_APP_ID: '1522072866585359'},
}));
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    shareSingle: jest.fn(),
    Social: {INSTAGRAM_STORIES: 'instagramstories'},
  },
  Social: {INSTAGRAM_STORIES: 'instagramstories'},
}));
jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  Linking: {canOpenURL: jest.fn()},
}));

const mockedShare = Share as jest.Mocked<typeof Share>;
const mockedLinking = Linking as jest.Mocked<typeof Linking>;

describe('shareVerseToInstagramStory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not-installed when IG URL scheme cannot be opened', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(false);
    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });
    expect(result).toEqual({shared: false, reason: 'not-installed'});
    expect(mockedShare.shareSingle).not.toHaveBeenCalled();
  });

  it('calls shareSingle with correct options when IG is installed', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(true);
    mockedShare.shareSingle.mockResolvedValue({success: true} as never);

    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });

    expect(result.shared).toBe(true);
    expect(mockedShare.shareSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        social: Share.Social.INSTAGRAM_STORIES,
        backgroundImage: 'file:///tmp/bg.png',
        stickerImage: 'file:///tmp/sticker.png',
        attributionURL: 'https://app.thebayaan.com/share/verse/94/6',
        linkUrl: 'https://app.thebayaan.com/share/verse/94/6',
      }),
    );
  });

  it('returns cancelled when user dismisses share', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(true);
    mockedShare.shareSingle.mockRejectedValue(
      Object.assign(new Error('User did not share'), {error: 'User dismissed'}),
    );
    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });
    expect(result).toEqual({shared: false, reason: 'cancelled'});
  });

  it('returns share-error for unknown failures', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(true);
    mockedShare.shareSingle.mockRejectedValue(new Error('Kaboom'));
    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });
    expect(result).toEqual({shared: false, reason: 'share-error'});
  });
});
