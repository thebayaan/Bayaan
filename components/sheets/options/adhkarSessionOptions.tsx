// @ai-generated
import React from 'react';
import {useTranslation} from 'react-i18next';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {
  OptionsMenuView,
  useNativeOptionsMenu,
  type OptionsMenuProps,
} from './OptionsMenu';

/**
 * The adhkar card's long-press options as an iPad context menu. Elsewhere
 * it renders the card as is, and the card's long press opens the sheet.
 */
export function AdhkarSessionOptionsMenu({
  title,
  children,
  ...props
}: OptionsMenuProps & {title: string}) {
  const enabled = useNativeOptionsMenu('longPress');
  const {t} = useTranslation('home');
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  if (!enabled) return <>{children}</>;
  return (
    <OptionsMenuView
      model={{
        title,
        entries: [
          {
            id: 'stop',
            title: t('adhkar.stopSession'),
            systemImage: 'xmark.circle',
            destructive: true,
          },
        ],
        onSelect: () => dispatch({type: 'stop'}),
      }}
      trigger="longPress"
      {...props}>
      {children}
    </OptionsMenuView>
  );
}
