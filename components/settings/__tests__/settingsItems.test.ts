// @ai-generated
jest.mock('@/utils/reviewUtils', () => ({
  canOpenAppStoreForReview: jest.fn(() => true),
  markAsRated: jest.fn().mockResolvedValue(undefined),
  openAppStoreForReview: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/Icons', () => ({}));
// A copy of Bayaan's branding that a test may change.
jest.mock('@/config/branding', () => ({
  __esModule: true,
  default: {...jest.requireActual('@/config/branding')},
}));

import {Linking} from 'react-native';
import branding from '@/config/branding';
import {
  canOpenAppStoreForReview,
  openAppStoreForReview,
} from '@/utils/reviewUtils';
import {
  getSettingsSections,
  openSettingsItem,
  selectedSettingsRoute,
  settingsSplitNav,
} from '../settingsItems';

const bayaanGithubUrl = branding.githubUrl;

afterEach(() => {
  branding.githubUrl = bayaanGithubUrl;
  jest.mocked(canOpenAppStoreForReview).mockReturnValue(true);
});

/** The item types of every Settings section, in order. */
const itemTypes = (): string[] => {
  const t = ((key: string) => key) as unknown as Parameters<
    typeof getSettingsSections
  >[0];
  return getSettingsSections(t).flatMap(s => s.items.map(i => i.type));
};

describe('selectedSettingsRoute', () => {
  it('marks Mushaf settings on the first screen and under Reading theme', () => {
    expect(selectedSettingsRoute('index')).toBe('mushaf-settings');
    expect(selectedSettingsRoute('reading-theme')).toBe('mushaf-settings');
    expect(selectedSettingsRoute('storage')).toBe('storage');
  });
});

describe('settingsSplitNav', () => {
  it.each([
    ['storage', 'index', {kind: 'push', routeName: 'storage'}],
    ['about', 'storage', {kind: 'replace', routeName: 'about'}],
    ['storage', 'storage', {kind: 'none'}],
    ['mushaf-settings', 'index', {kind: 'none'}],
    ['mushaf-settings', 'storage', {kind: 'home'}],
    ['mushaf-settings', 'reading-theme', {kind: 'home'}],
    ['language', 'reading-theme', {kind: 'reset', routeName: 'language'}],
  ])('opens %s from %s', (target, current, nav) => {
    expect(settingsSplitNav(target, current)).toEqual(nav);
  });
});

describe('openSettingsItem', () => {
  it('navigates to pages and opens links for the rest', async () => {
    const navigate = jest.fn();
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);

    await openSettingsItem('defaultReciter', navigate);
    expect(navigate).toHaveBeenCalledWith('default-reciter');

    await openSettingsItem('github', navigate);
    expect(openURL).toHaveBeenCalledWith('https://github.com/thebayaan/Bayaan');

    await openSettingsItem('rateApp', navigate);
    expect(openAppStoreForReview).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    openURL.mockRestore();
  });
});

describe('getSettingsSections', () => {
  it("lists both link rows with Bayaan's branding", () => {
    expect(itemTypes()).toEqual(expect.arrayContaining(['rateApp', 'github']));
  });

  it('drops the GitHub row when branding.githubUrl is absent', () => {
    delete branding.githubUrl;
    expect(itemTypes()).not.toContain('github');
  });

  it('drops the review row when no store page can open', () => {
    jest.mocked(canOpenAppStoreForReview).mockReturnValue(false);
    expect(itemTypes()).not.toContain('rateApp');
    expect(itemTypes()).toContain('featureRequest');
  });
});

describe('openSettingsItem without branding.githubUrl', () => {
  it('opens no link', async () => {
    delete branding.githubUrl;
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);

    await openSettingsItem('github', jest.fn());
    expect(openURL).not.toHaveBeenCalled();
    openURL.mockRestore();
  });
});
