// @ai-generated
import React from 'react';
import {Platform} from 'react-native';
import {Button, ContentUnavailableView, Host} from '@expo/ui/swift-ui';
import {buttonStyle, foregroundStyle, tint} from '@expo/ui/swift-ui/modifiers';
import {useNativeTheme} from './useNativeTheme';
import type {NativeEmptyStateProps} from './emptyStateTypes';

/** ContentUnavailableView is iOS 17+; the app still supports 16.4. */
const contentUnavailableAvailable =
  typeof Platform.Version === 'string' && parseInt(Platform.Version, 10) >= 17;

/**
 * A SwiftUI `ContentUnavailableView`: the system empty state, as in Music
 * and Files. The host draws no background, so the reading theme shows
 * through; title and symbol take the theme's text color, and the action is
 * a bordered button tinted the same way.
 */
export function NativeEmptyState({
  title,
  description,
  systemImage,
  action,
  fallback,
  style,
  testID,
}: NativeEmptyStateProps) {
  const native = useNativeTheme();
  if (!contentUnavailableAvailable) return <>{fallback}</>;

  return (
    <Host
      style={[{flex: 1}, style]}
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}
      testID={testID}>
      <ContentUnavailableView
        title={title}
        description={description}
        systemImage={systemImage}
        modifiers={[foregroundStyle(native.text)]}
        actions={
          action ? (
            <Button
              label={action.label}
              systemImage={action.systemImage}
              onPress={action.onPress}
              modifiers={[buttonStyle('bordered'), tint(native.tint)]}
            />
          ) : undefined
        }
      />
    </Host>
  );
}
