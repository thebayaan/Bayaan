import type React from 'react';
import {Linking} from 'react-native';
import type {Href} from 'expo-router';
import type {TFunction} from 'i18next';
import branding from '@/config/branding';
import {openAppStoreForReview, markAsRated} from '@/utils/reviewUtils';
import {
  QuranIcon,
  DualPagesIcon,
  PersonAudioIcon,
  SelectionListIcon,
  DatabaseIcon,
  ThreeStarsReviewIcon,
  LightbulbIcon,
  ChatBubbleIcon,
  GiftBoxIcon,
  InfoRoundedIcon,
  MedalIcon,
  DocCheckIcon,
  ShieldLockIcon,
} from '@/components/Icons';

// The Settings list, shared by the phone screen and the iPad list. @ai

export const isExternalLink = (type: string): boolean => {
  return [
    'support',
    'featureRequest',
    'terms',
    'privacy',
    'rateApp',
    'github',
  ].includes(type);
};

// @ai-start
export const getSettingsSections = (t: TFunction<['settings', 'common']>) => {
  const appName = branding.appName;
  return [
    {
      section: t('settings:index.sections.quran'),
      items: [
        {
          title: t('settings:index.items.mushafSettings.title'),
          type: 'mushafSettings',
          description: t('settings:index.items.mushafSettings.description'),
          icon: 'quran',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.translations.title'),
          type: 'translations',
          description: t('settings:index.items.translations.description'),
          icon: 'dualPages',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.audio'),
      items: [
        {
          title: t('settings:index.items.defaultReciter.title'),
          type: 'defaultReciter',
          description: t('settings:index.items.defaultReciter.description'),
          icon: 'personAudio',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.reciterChoice.title'),
          type: 'reciterChoice',
          description: t('settings:index.items.reciterChoice.description'),
          icon: 'selectionList',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.appData'),
      items: [
        {
          title: t('common:language.title'),
          type: 'language',
          description: t('common:language.description'),
          icon: 'globe',
          iconType: 'feather',
        },
        {
          title: t('settings:index.items.storage.title'),
          type: 'storage',
          description: t('settings:index.items.storage.description'),
          icon: 'database',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.feedback'),
      items: [
        {
          title: t('settings:index.items.rateApp.title'),
          type: 'rateApp',
          description: t('settings:index.items.rateApp.description'),
          icon: 'star',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.featureRequest.title'),
          type: 'featureRequest',
          description: t('settings:index.items.featureRequest.description'),
          icon: 'lightbulb',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.support.title'),
          type: 'support',
          description: t('settings:index.items.support.description', {appName}),
          icon: 'chatBubble',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.about', {appName}),
      items: [
        {
          title: t('settings:index.items.whatsNew.title'),
          type: 'whatsNew',
          description: t('settings:index.items.whatsNew.description'),
          icon: 'giftBox',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.about.title', {appName}),
          type: 'about',
          description: t('settings:index.items.about.description'),
          icon: 'infoRounded',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.credits.title'),
          type: 'credits',
          description: t('settings:index.items.credits.description'),
          icon: 'medal',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.github.title'),
          type: 'github',
          description: t('settings:index.items.github.description', {appName}),
          icon: 'github',
          iconType: 'feather',
        },
        {
          title: t('settings:index.items.terms.title'),
          type: 'terms',
          description: t('settings:index.items.terms.description'),
          icon: 'docCheck',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.privacy.title'),
          type: 'privacy',
          description: t('settings:index.items.privacy.description'),
          icon: 'shieldLock',
          iconType: 'custom',
        },
      ],
    },
  ];
};
// @ai-end

export const customIconMap: Record<
  string,
  React.FC<{size: number; color: string}>
> = {
  quran: QuranIcon,
  dualPages: DualPagesIcon,
  personAudio: PersonAudioIcon,
  selectionList: SelectionListIcon,
  database: DatabaseIcon,
  star: ThreeStarsReviewIcon,
  lightbulb: LightbulbIcon,
  chatBubble: ChatBubbleIcon,
  giftBox: GiftBoxIcon,
  infoRounded: InfoRoundedIcon,
  medal: MedalIcon,
  docCheck: DocCheckIcon,
  shieldLock: ShieldLockIcon,
};

// @ai-start
/** The Settings pages, by the route name of each one in `(d.settings)`. */
export const SETTINGS_ROUTE_NAMES: Record<string, string> = {
  mushafSettings: 'mushaf-settings',
  translations: 'translations',
  defaultReciter: 'default-reciter',
  reciterChoice: 'reciter-choice',
  language: 'language',
  storage: 'storage',
  whatsNew: 'whats-new',
  about: 'about',
  credits: 'credits',
};

export const settingsHref = (routeName: string): Href =>
  `/(d.settings)/${routeName}` as Href;

/**
 * Opens a Settings item: `navigate` gets the page's route for items that
 * have one, and the rest open their link or the App Store review.
 */
export async function openSettingsItem(
  type: string,
  navigate: (routeName: string) => void,
): Promise<void> {
  const routeName = SETTINGS_ROUTE_NAMES[type];
  if (routeName) {
    navigate(routeName);
    return;
  }
  switch (type) {
    case 'rateApp':
      await markAsRated();
      await openAppStoreForReview();
      break;
    case 'support':
    case 'featureRequest':
      await Linking.openURL(branding.supportUrl);
      break;
    case 'terms':
      await Linking.openURL(branding.termsUrl);
      break;
    case 'privacy':
      await Linking.openURL(branding.privacyUrl);
      break;
    case 'github':
      await Linking.openURL('https://github.com/thebayaan/Bayaan');
      break;
    default:
      break;
  }
}

/**
 * Narrowest window that shows Settings as a list beside its page
 * (ipad-standards §6, `expanded` and up).
 */
export const SETTINGS_SPLIT_MIN_WIDTH = 900;
export const SETTINGS_LIST_WIDTH = 340;
/** Forms and settings pages are held to 640pt (ipad-standards §5.3). */
export const SETTINGS_PAGE_MAX_WIDTH = 640;

/** The page the split shows before anything is picked: the stack's first screen. */
export const SETTINGS_DEFAULT_ROUTE = 'mushaf-settings';

/** Pages opened from inside another page, and the list row they belong to. */
const NESTED_ROUTES: Record<string, string> = {
  'reading-theme': 'mushaf-settings',
};

/** The page whose row the list marks while `current` is on screen. */
export function selectedSettingsRoute(current: string): string {
  if (current === 'index') {
    return SETTINGS_DEFAULT_ROUTE;
  }
  return NESTED_ROUTES[current] ?? current;
}

export type SettingsSplitNav =
  | {kind: 'none'}
  /** Back to the first screen, which shows the default page. */
  | {kind: 'home'}
  | {kind: 'push' | 'replace' | 'reset'; routeName: string};

/**
 * How the split's page stack moves when a list row is picked. Pages are
 * siblings, so one replaces another instead of stacking on it; the stack
 * keeps its first screen under them, so back still works if the window
 * narrows and the list goes away.
 */
export function settingsSplitNav(
  target: string,
  current: string,
): SettingsSplitNav {
  if (selectedSettingsRoute(current) === target && !NESTED_ROUTES[current]) {
    return {kind: 'none'};
  }
  if (target === SETTINGS_DEFAULT_ROUTE) {
    return {kind: 'home'};
  }
  if (current === 'index') {
    return {kind: 'push', routeName: target};
  }
  if (NESTED_ROUTES[current]) {
    return {kind: 'reset', routeName: target};
  }
  return {kind: 'replace', routeName: target};
}
// @ai-end
