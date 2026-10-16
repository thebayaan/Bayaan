import branding from '@/config/branding';
// @ai-start
import i18n from '@/i18n';
// @ai-end

export interface OnboardingPage {
  id: string;
  icon: string;
  isCustomIcon?: boolean;
  gradientColors?: [string, string];
  title: string;
  subtitle?: string;
  description: string;
  /** The minimum app version where this page was introduced (e.g. "2.0") */
  minVersion: string;
}

/**
 * Onboarding pages factory. Brand strings (e.g. `branding.appName`)
 * resolve at call time, not module load — this lets a fork override
 * `branding` without having to fork this file. Originally a top-level
 * const, but top-level const arrays evaluate before any `branding`
 * resolution, baking the upstream brand name into the bundle.
 */
// @ai-start
export function getOnboardingPages(): OnboardingPage[] {
  return [
    {
      id: 'welcome',
      icon: 'app-icon',
      title: i18n.t('content:onboarding.welcome.title', {
        appName: branding.appName,
      }),
      subtitle: i18n.t('content:onboarding.welcome.subtitle'),
      description: i18n.t('content:onboarding.welcome.description'),
      minVersion: '2.0',
    },
    {
      id: 'mushaf',
      icon: 'book-outline',
      isCustomIcon: true,
      gradientColors: ['#3B82F6', '#1D4ED8'],
      title: i18n.t('content:onboarding.mushaf.title'),
      description: i18n.t('content:onboarding.mushaf.description'),
      minVersion: '2.0',
    },
    {
      id: 'highlighting',
      icon: 'locate-outline',
      gradientColors: ['#8B5CF6', '#6D28D9'],
      title: i18n.t('content:onboarding.highlighting.title'),
      description: i18n.t('content:onboarding.highlighting.description'),
      minVersion: '2.0',
    },
    {
      id: 'memorize',
      icon: 'repeat-outline',
      isCustomIcon: true,
      gradientColors: ['#6366F1', '#4338CA'],
      title: i18n.t('content:onboarding.memorize.title'),
      description: i18n.t('content:onboarding.memorize.description'),
      minVersion: '2.0',
    },
    {
      id: 'uploads',
      icon: 'cloud-upload-outline',
      gradientColors: ['#06B6D4', '#0891B2'],
      title: i18n.t('content:onboarding.uploads.title'),
      description: i18n.t('content:onboarding.uploads.description'),
      minVersion: '2.0',
    },
    {
      id: 'ambient',
      icon: 'leaf-outline',
      isCustomIcon: true,
      gradientColors: ['#10B981', '#059669'],
      title: i18n.t('content:onboarding.ambient.title'),
      description: i18n.t('content:onboarding.ambient.description'),
      minVersion: '2.0',
    },
    {
      id: 'verse-interactions',
      icon: 'bookmark-outline',
      gradientColors: ['#F59E0B', '#D97706'],
      title: i18n.t('content:onboarding.verseInteractions.title'),
      description: i18n.t('content:onboarding.verseInteractions.description'),
      minVersion: '2.0',
    },
    {
      id: 'adhkar',
      icon: 'flower-outline',
      isCustomIcon: true,
      gradientColors: ['#EC4899', '#DB2777'],
      title: i18n.t('content:onboarding.adhkar.title'),
      description: i18n.t('content:onboarding.adhkar.description'),
      minVersion: '2.0',
    },
    {
      id: 'wbw',
      icon: 'text-outline',
      isCustomIcon: true,
      gradientColors: ['#0EA5E9', '#0284C7'],
      title: i18n.t('content:onboarding.wbw.title'),
      description: i18n.t('content:onboarding.wbw.description'),
      minVersion: '2.1',
    },
    {
      id: 'translations',
      icon: 'language-outline',
      isCustomIcon: true,
      gradientColors: ['#A855F7', '#7C3AED'],
      title: i18n.t('content:onboarding.translations.title'),
      description: i18n.t('content:onboarding.translations.description'),
      minVersion: '2.1',
    },
    {
      id: 'themes',
      icon: 'color-palette-outline',
      isCustomIcon: true,
      gradientColors: ['#F43F5E', '#E11D48'],
      title: i18n.t('content:onboarding.themes.title'),
      description: i18n.t('content:onboarding.themes.description'),
      minVersion: '2.1',
    },
    {
      id: 'indopak',
      icon: 'globe-outline',
      gradientColors: ['#22D3EE', '#06B6D4'],
      title: i18n.t('content:onboarding.indopak.title'),
      description: i18n.t('content:onboarding.indopak.description'),
      minVersion: '2.1',
    },
    {
      id: 'downloads',
      icon: 'download-outline',
      isCustomIcon: true,
      gradientColors: ['#14B8A6', '#0D9488'],
      title: i18n.t('content:onboarding.downloads.title'),
      description: i18n.t('content:onboarding.downloads.description'),
      minVersion: '1.3',
    },
    {
      id: 'playlists',
      icon: 'list-outline',
      isCustomIcon: true,
      gradientColors: ['#F97316', '#EA580C'],
      title: i18n.t('content:onboarding.playlists.title'),
      description: i18n.t('content:onboarding.playlists.description'),
      minVersion: '1.3',
    },
  ];
}
// @ai-end
