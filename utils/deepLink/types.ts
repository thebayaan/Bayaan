/**
 * Deep link route information
 */
export interface DeepLinkRoute {
  screen: string;
  params?: Record<string, any>;
}

/**
 * Content types that can be shared
 */
export type ShareableContentType = 'reciter' | 'playlist' | 'surah' | 'adhkar';

/**
 * Parameters for different content types
 */
export interface ShareableContentParams {
  reciter: {
    id: string;
    surah?: string;
    [key: string]: any;
  };
  playlist: {
    id: string;
    [key: string]: any;
  };
  surah: {
    num: string;
    reciter?: string;
    [key: string]: any;
  };
  adhkar: {
    superId: string;
    dhikrId?: string;
    [key: string]: any;
  };
}
