// @ai-generated
jest.mock('@/utils/reviewUtils', () => ({
  markAsRated: jest.fn().mockResolvedValue(undefined),
  openAppStoreForReview: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/Icons', () => ({}));

import {Linking} from 'react-native';
import {openAppStoreForReview} from '@/utils/reviewUtils';
import {
  openSettingsItem,
  selectedSettingsRoute,
  settingsSplitNav,
} from '../settingsItems';

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
