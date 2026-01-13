export interface ChangelogHighlight {
  title: string;
  description: string;
  icon: string;
}

export interface ChangelogFullDetails {
  features?: string[];
  improvements?: string[];
  fixes?: string[];
  technical?: string[];
}

export interface ChangelogEntry {
  version: string;
  releaseDate: string;
  title: string;
  highlights: ChangelogHighlight[];
  fullChangelog?: ChangelogFullDetails;
}
