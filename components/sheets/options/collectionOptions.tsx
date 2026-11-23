// @ai-generated
import React, {type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import type {SFSymbol} from 'sf-symbols-typescript';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {
  OptionsMenuView,
  useNativeOptionsMenu,
  type OptionsMenuProps,
} from './OptionsMenu';

/** One row of the generic `collection-options` sheet. */
export interface CollectionOption {
  label: string;
  /** Feather icon name, mapped to an SF Symbol for native menus. */
  icon: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  customIcon?: ReactNode;
}

export interface CollectionOptionsPayload {
  title: string;
  subtitle?: string;
  options: CollectionOption[];
}

const SF_SYMBOLS: Record<string, SFSymbol> = {
  'book-open': 'book',
  'corner-down-right': 'text.line.first.and.arrowtriangle.forward',
  download: 'arrow.down.circle',
  'edit-2': 'pencil',
  heart: 'heart',
  'minus-circle': 'minus.circle',
  play: 'play',
  'trash-2': 'trash',
  user: 'person',
  'user-minus': 'person.badge.minus',
};

/** The sheet's rows as native menu entries; destructive rows go last. */
export function collectionMenuEntries(
  options: CollectionOption[],
): NativeMenuEntry[] {
  const toItem = (opt: CollectionOption) => ({
    id: String(options.indexOf(opt)),
    title: opt.label,
    systemImage: SF_SYMBOLS[opt.icon],
    destructive: opt.destructive,
    disabled: opt.disabled,
  });
  const normal = options.filter(opt => !opt.destructive).map(toItem);
  const destructive = options.filter(opt => opt.destructive).map(toItem);
  const entries: NativeMenuEntry[] = [...normal];
  if (destructive.length > 0) {
    entries.push({id: 'destructive', items: destructive});
  }
  return entries;
}

/**
 * A `collection-options` sheet as a native menu on tablets. Elsewhere it
 * renders its children (the ••• button, which still opens the sheet), or
 * nothing for an overlay. `payload` is built at render time because a
 * native menu can't be opened from a press handler.
 */
export function CollectionOptionsMenu({
  payload,
  children,
  accessibilityLabel,
  ...props
}: OptionsMenuProps & {payload: CollectionOptionsPayload | null}) {
  const {t} = useTranslation('player');
  const enabled = useNativeOptionsMenu(props.trigger);
  if (!enabled || !payload || payload.options.length === 0) {
    return <>{children ?? null}</>;
  }
  const {options} = payload;
  return (
    <OptionsMenuView
      model={{
        title: payload.title,
        entries: collectionMenuEntries(options),
        onSelect: id => options[Number(id)]?.onPress(),
      }}
      accessibilityLabel={accessibilityLabel ?? t('a11y.moreOptions')}
      {...props}>
      {children}
    </OptionsMenuView>
  );
}
