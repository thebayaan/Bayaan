// @ai-generated
import type {ReactNode} from 'react';
import type {SFSymbol} from 'sf-symbols-typescript';

/** One row of the Settings list. */
export type NativeSettingsRow =
  | {
      kind: 'link';
      key: string;
      title: string;
      systemImage: SFSymbol;
      /** Shown before the chevron (the current language). */
      value?: string;
      /** Opens outside the app: an up-right arrow instead of a chevron. */
      external: boolean;
      onPress: () => void;
    }
  | {
      kind: 'toggle';
      key: string;
      title: string;
      systemImage: SFSymbol;
      value: boolean;
      onChange: (value: boolean) => void;
    };

export interface NativeSettingsSection {
  key: string;
  title: string;
  footer?: string;
  rows: NativeSettingsRow[];
}

export interface NativeSettingsFormProps {
  appearanceTitle: string;
  /** The Light/Dark/Auto tiles, hosted in the first row. */
  appearance: ReactNode;
  sections: NativeSettingsSection[];
}
