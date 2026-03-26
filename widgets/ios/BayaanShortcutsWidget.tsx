import {Text, VStack} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type BayaanShortcutsProps = {
  headline: string;
  detail: string;
};

function BayaanShortcutsView(
  props: BayaanShortcutsProps,
  environment: WidgetEnvironment,
) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const primary = isDark ? '#F2F0E8' : '#141414';
  const secondary = isDark ? '#9A968C' : '#5E5E5E';
  const openApp = widgetURL('bayaan://');

  const family = environment.widgetFamily;

  if (family === 'systemSmall') {
    return (
      <VStack modifiers={[padding({all: 12}), openApp]}>
        <Text
          modifiers={[
            font({size: 20, weight: 'bold'}),
            foregroundStyle(primary),
          ]}>
          {props.headline}
        </Text>
        <Text
          modifiers={[
            font({size: 11, weight: 'regular'}),
            foregroundStyle(secondary),
          ]}>
          {props.detail}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack modifiers={[padding({all: 14}), openApp]}>
      <Text
        modifiers={[
          font({size: 22, weight: 'bold'}),
          foregroundStyle(primary),
        ]}>
        {props.headline}
      </Text>
      <Text
        modifiers={[
          font({size: 13, weight: 'regular'}),
          foregroundStyle(secondary),
        ]}>
        {props.detail}
      </Text>
      <Text
        modifiers={[
          font({size: 11, weight: 'medium'}),
          foregroundStyle(secondary),
        ]}>
        Tap to open Bayaan
      </Text>
    </VStack>
  );
}

export const bayaanShortcutsWidget = createWidget(
  'BayaanShortcuts',
  BayaanShortcutsView,
);
