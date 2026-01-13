export type ChangeCategory =
  | 'feature'
  | 'improvement'
  | 'bugfix'
  | 'ui'
  | 'security'
  | 'performance';

export interface ChangeItem {
  category: ChangeCategory;
  title: string;
  description: string;
  platforms?: ('ios' | 'android' | 'web')[];
}

export interface VersionInfo {
  version: string;
  versionCode: number;
  releaseDate: string;
  highlights: string[];
  changes: ChangeItem[];
}

export interface CategoryConfig {
  label: string;
  icon: string;
  color: string;
}

export interface ChangelogData {
  versions: VersionInfo[];
  categories: Record<ChangeCategory, CategoryConfig>;
}
