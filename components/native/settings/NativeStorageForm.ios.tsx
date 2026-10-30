// @ai-generated
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Button,
  Form,
  HStack,
  Host,
  LabeledContent,
  RNHostView,
  Section,
  Text,
} from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  font,
  foregroundStyle,
  listRowBackground,
  listRowSeparatorTint,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {useNativeTheme} from '../useNativeTheme';
import type {NativeStorageFormProps} from './storageFormTypes';

export const nativeStorageFormAvailable = true;

/**
 * Settings → Storage as a SwiftUI `Form`, painted with the reading theme:
 * the form's own background is hidden so the theme background shows, rows
 * take the theme's card color, and text, tint and separators come from the
 * theme's text color. Manrope is kept so the screen matches the rest of
 * Settings.
 */
export function NativeStorageForm({
  breakdownHeader,
  manageHeader,
  bar,
  categories,
  actions,
  busy,
}: NativeStorageFormProps) {
  const {theme} = useTheme();
  const native = useNativeTheme();
  const row = [
    listRowBackground(theme.colors.card),
    listRowSeparatorTint(Color(theme.colors.text).alpha(0.12).toString()),
  ];
  // Text colors go on each text, not the form, so destructive buttons stay red.
  const body = font({family: 'Manrope-Regular', size: 16});
  const primary = foregroundStyle(theme.colors.text);
  const secondary = foregroundStyle(theme.colors.textSecondary);

  return (
    <Host
      style={[styles.host, {backgroundColor: theme.colors.background}]}
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}>
      <Form modifiers={[scrollContentBackground('hidden'), tint(native.tint)]}>
        <Section title={breakdownHeader}>
          <HStack modifiers={row}>
            <RNHostView matchContents={{vertical: true}}>
              <View style={styles.barRow}>{bar}</View>
            </RNHostView>
          </HStack>
          {categories.map(category => (
            <LabeledContent
              key={category.key}
              modifiers={row}
              label={
                <HStack spacing={10}>
                  <Text modifiers={[foregroundStyle(category.color)]}>●</Text>
                  <Text modifiers={[body, primary]}>{category.label}</Text>
                </HStack>
              }>
              <Text modifiers={[body, secondary]}>{category.size}</Text>
            </LabeledContent>
          ))}
        </Section>
        {actions.map((action, index) => (
          <Section
            key={action.key}
            title={index === 0 ? manageHeader : undefined}
            footer={
              <Text
                modifiers={[
                  font({family: 'Manrope-Regular', size: 13}),
                  secondary,
                ]}>
                {action.description}
              </Text>
            }>
            <Button
              label={action.title}
              role="destructive"
              onPress={action.onPress}
              modifiers={[...row, body, disabledModifier(busy)]}
            />
          </Section>
        ))}
      </Form>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {flex: 1},
  barRow: {paddingVertical: 4},
});
