// @ai-generated
import React from 'react';
import {StyleSheet} from 'react-native';
import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  RNHostView,
  Section,
  Spacer,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  alignmentGuide,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparatorTint,
  listSectionSpacing,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {isRTL} from '@/utils/rtl';
import {useNativeTheme} from '../useNativeTheme';
import type {
  NativeSettingsFormProps,
  NativeSettingsRow,
} from './settingsFormTypes';

export const nativeSettingsFormAvailable = true;

/** Leading edge of the row text, where separators start. */
const ICON_WIDTH = 26;
const ICON_GAP = 14;
const ROW_INSET = 18;
const TEXT_LEADING = ROW_INSET + ICON_WIDTH + ICON_GAP;
const ROW_HEIGHT = 56;

/**
 * The phone Settings list as a SwiftUI inset-grouped `Form`: rows are cards
 * on the screen background, headers in sentence case, outline SF Symbols,
 * separators starting at the title, and system toggles. The Light/Dark/Auto
 * tiles are the React Native picker, hosted in the first row.
 */
export function NativeSettingsForm({
  appearanceTitle,
  appearance,
  sections,
}: NativeSettingsFormProps) {
  const {theme} = useTheme();
  const native = useNativeTheme();
  const text = theme.colors.text;
  const muted = Color(text).alpha(0.5).toString();
  const rowBackground = listRowBackground(
    theme.isDarkMode ? Color('#ffffff').alpha(0.07).toString() : '#ffffff',
  );
  const separator = listRowSeparatorTint(Color(text).alpha(0.14).toString());
  const body = font({family: 'Manrope-Regular', size: 16.5});
  const header = (title: string) => (
    <Text
      modifiers={[
        font({family: 'Manrope-Regular', size: 15}),
        foregroundStyle(Color(text).alpha(0.55).toString()),
      ]}>
      {title}
    </Text>
  );

  const icon = (name: NativeSettingsRow['systemImage']) => (
    <Image
      systemName={name}
      size={19}
      color={text}
      modifiers={[frame({width: ICON_WIDTH})]}
    />
  );

  const rowModifiers = [
    rowBackground,
    separator,
    listRowInsets({leading: ROW_INSET, trailing: ROW_INSET}),
    frame({minHeight: ROW_HEIGHT}),
    alignmentGuide('listRowSeparatorLeading', TEXT_LEADING - ROW_INSET),
  ];

  const renderRow = (row: NativeSettingsRow) => {
    if (row.kind === 'toggle') {
      return (
        <Toggle
          key={row.key}
          isOn={row.value}
          onIsOnChange={row.onChange}
          // The text colour would put a white knob on a white track in dark.
          modifiers={[...rowModifiers, tint(native.trackOn)]}>
          <HStack spacing={ICON_GAP}>
            {icon(row.systemImage)}
            <Text modifiers={[body, foregroundStyle(text)]}>{row.title}</Text>
          </HStack>
        </Toggle>
      );
    }
    const chevron = row.external
      ? 'arrow.up.right'
      : isRTL
        ? 'chevron.left'
        : 'chevron.right';
    return (
      <Button
        key={row.key}
        onPress={row.onPress}
        modifiers={[...rowModifiers, buttonStyle('plain')]}>
        <HStack spacing={ICON_GAP}>
          {icon(row.systemImage)}
          <Text modifiers={[body, foregroundStyle(text)]}>{row.title}</Text>
          <Spacer />
          {row.value ? (
            <Text modifiers={[body, foregroundStyle(muted)]}>{row.value}</Text>
          ) : null}
          <Image
            systemName={chevron}
            size={13}
            color={Color(text).alpha(0.3).toString()}
          />
        </HStack>
      </Button>
    );
  };

  return (
    <Host
      style={[styles.host, {backgroundColor: theme.colors.background}]}
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}>
      <Form
        modifiers={[
          scrollContentBackground('hidden'),
          tint(native.tint),
          listSectionSpacing(26),
        ]}>
        <Section header={header(appearanceTitle)}>
          <HStack
            modifiers={[
              rowBackground,
              listRowInsets({top: 0, bottom: 0, leading: 0, trailing: 0}),
            ]}>
            <RNHostView matchContents={{vertical: true}}>
              {appearance as React.ReactElement}
            </RNHostView>
          </HStack>
        </Section>
        {sections.map(section => (
          <Section
            key={section.key}
            header={header(section.title)}
            footer={
              section.footer ? (
                <Text
                  modifiers={[
                    font({family: 'Manrope-Regular', size: 13}),
                    foregroundStyle(muted),
                  ]}>
                  {section.footer}
                </Text>
              ) : undefined
            }>
            {section.rows.map(renderRow)}
          </Section>
        ))}
      </Form>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {flex: 1},
});
