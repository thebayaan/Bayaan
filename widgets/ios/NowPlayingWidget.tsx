import {Text, VStack} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type NowPlayingProps = {
  title: string;
  subtitle: string;
  statusLabel: string;
};

function NowPlayingView(props: NowPlayingProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const primary = isDark ? '#F2F0E8' : '#141414';
  const secondary = isDark ? '#9A968C' : '#5E5E5E';
  const openPlayer = widgetURL('bayaan://');

  const family = environment.widgetFamily;

  if (family === 'systemSmall') {
    return (
      <VStack modifiers={[padding({all: 10}), openPlayer]}>
        <Text
          modifiers={[
            font({size: 10, weight: 'semibold'}),
            foregroundStyle(secondary),
          ]}>
          NOW PLAYING
        </Text>
        <Text
          modifiers={[
            font({size: 13, weight: 'semibold'}),
            foregroundStyle(primary),
          ]}>
          {props.title}
        </Text>
        <Text
          modifiers={[
            font({size: 11, weight: 'regular'}),
            foregroundStyle(secondary),
          ]}>
          {props.statusLabel}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack modifiers={[padding({all: 12}), openPlayer]}>
      <Text
        modifiers={[
          font({size: 10, weight: 'semibold'}),
          foregroundStyle(secondary),
        ]}>
        NOW PLAYING
      </Text>
      <Text
        modifiers={[
          font({size: 16, weight: 'semibold'}),
          foregroundStyle(primary),
        ]}>
        {props.title}
      </Text>
      <Text
        modifiers={[
          font({size: 12, weight: 'regular'}),
          foregroundStyle(secondary),
        ]}>
        {props.subtitle}
      </Text>
      <Text
        modifiers={[
          font({size: 11, weight: 'medium'}),
          foregroundStyle(secondary),
        ]}>
        {props.statusLabel}
      </Text>
    </VStack>
  );
}

export const nowPlayingWidget = createWidget('NowPlaying', NowPlayingView);
