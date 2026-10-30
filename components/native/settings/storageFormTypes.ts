// @ai-generated
import type {ReactElement} from 'react';

export interface StorageFormCategory {
  key: string;
  label: string;
  /** Already formatted and localized, e.g. "1.2 GB". */
  size: string;
  color: string;
}

export interface StorageFormAction {
  key: string;
  title: string;
  description: string;
  onPress: () => void;
}

export interface NativeStorageFormProps {
  breakdownHeader: string;
  manageHeader: string;
  /** The stacked usage bar, drawn in React Native and hosted in the first row. */
  bar: ReactElement;
  categories: StorageFormCategory[];
  actions: StorageFormAction[];
  /** A clear is running; the action rows are disabled. */
  busy: boolean;
}
