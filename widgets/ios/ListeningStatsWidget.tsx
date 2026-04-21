import {
  Text,
  VStack,
  HStack,
  Spacer,
  ZStack,
  Circle,
  RoundedRectangle,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  widgetURL,
  frame,
  kerning,
  lineLimit,
  background,
  offset,
} from '@expo/ui/swift-ui/modifiers';
import {shapes} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type ListeningStatsProps = {
  totalPlays: string;
  uniqueSurahs: string;
  topSurahName: string;
  topSurahCount: string;
  motivationalText: string;
};

function ListeningStatsView(
  props: ListeningStatsProps,
  environment: WidgetEnvironment,
) {
  'widget';

  const isDark = environment.colorScheme === 'dark';

  // Warm rose/coral palette — achievement, warmth
  const bg = isDark ? '#1C1215' : '#FDF4F2';
  const accent = isDark ? '#E8846A' : '#C04830';
  const primary = isDark ? '#F5EBE8' : '#2B1410';
  const secondary = isDark ? 'rgba(245,235,232,0.45)' : 'rgba(43,20,16,0.4)';
  const label = isDark ? 'rgba(232,132,106,0.6)' : 'rgba(192,72,48,0.5)';
  const decorCircle = isDark
    ? 'rgba(232,132,106,0.06)'
    : 'rgba(192,72,48,0.04)';
  const statBg = isDark ? 'rgba(232,132,106,0.12)' : 'rgba(192,72,48,0.08)';

  const family = environment.widgetFamily;
  const openApp = widgetURL('bayaan://');

  if (family === 'systemSmall') {
    return (
      <ZStack modifiers={[openApp, frame({maxWidth: 10000, maxHeight: 10000})]}>
        <RoundedRectangle
          cornerRadius={0}
          modifiers={[
            frame({maxWidth: 10000, maxHeight: 10000}),
            foregroundStyle(bg),
          ]}
        />
        <Circle
          modifiers={[
            frame({width: 130, height: 130}),
            foregroundStyle(decorCircle),
            offset({x: 40, y: -45}),
          ]}
        />
        <VStack spacing={0} modifiers={[padding({all: 14}), frame({maxWidth: 10000})]}>
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Text
              modifiers={[
                font({size: 9, weight: 'bold'}),
                foregroundStyle(label),
                kerning(1),
              ]}>
              LISTENING
            </Text>
            <Spacer />
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({size: 34, weight: 'bold'}),
              foregroundStyle(accent),
            ]}>
            {props.totalPlays}
          </Text>
          <Text
            modifiers={[
              font({size: 12, weight: 'medium'}),
              foregroundStyle(secondary),
            ]}>
            surahs played
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({size: 10, weight: 'regular'}),
              foregroundStyle(secondary),
              lineLimit(2),
            ]}>
            {props.motivationalText}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  // systemMedium
  return (
    <ZStack modifiers={[openApp, frame({maxWidth: 10000, maxHeight: 10000})]}>
      <RoundedRectangle
        cornerRadius={0}
        modifiers={[
          frame({maxWidth: 10000, maxHeight: 10000}),
          foregroundStyle(bg),
        ]}
      />
      <Circle
        modifiers={[
          frame({width: 170, height: 170}),
          foregroundStyle(decorCircle),
          offset({x: 120, y: -50}),
        ]}
      />
      <Circle
        modifiers={[
          frame({width: 80, height: 80}),
          foregroundStyle(decorCircle),
          offset({x: -140, y: 40}),
        ]}
      />
      <VStack spacing={0} modifiers={[padding({all: 14}), frame({maxWidth: 10000})]}>
        <HStack modifiers={[frame({maxWidth: 10000})]}>
          <Text
            modifiers={[
              font({size: 9, weight: 'bold'}),
              foregroundStyle(label),
              kerning(1),
            ]}>
            LISTENING STATS
          </Text>
          <Spacer />
        </HStack>
        <Spacer />
        <HStack spacing={12} modifiers={[frame({maxWidth: 10000})]}>
          <VStack
            spacing={2}
            modifiers={[
              padding({horizontal: 14, vertical: 10}),
              background(statBg, shapes.roundedRectangle({cornerRadius: 12})),
            ]}>
            <Text
              modifiers={[
                font({size: 28, weight: 'bold'}),
                foregroundStyle(accent),
              ]}>
              {props.totalPlays}
            </Text>
            <Text
              modifiers={[
                font({size: 10, weight: 'medium'}),
                foregroundStyle(secondary),
              ]}>
              total plays
            </Text>
          </VStack>
          <VStack
            spacing={2}
            modifiers={[
              padding({horizontal: 14, vertical: 10}),
              background(statBg, shapes.roundedRectangle({cornerRadius: 12})),
            ]}>
            <Text
              modifiers={[
                font({size: 28, weight: 'bold'}),
                foregroundStyle(accent),
              ]}>
              {props.uniqueSurahs}
            </Text>
            <Text
              modifiers={[
                font({size: 10, weight: 'medium'}),
                foregroundStyle(secondary),
              ]}>
              surahs
            </Text>
          </VStack>
          <Spacer />
        </HStack>
        <Spacer />
        <HStack modifiers={[frame({maxWidth: 10000})]}>
          <Text
            modifiers={[
              font({size: 11, weight: 'regular'}),
              foregroundStyle(secondary),
              lineLimit(1),
            ]}>
            {props.topSurahName !== ''
              ? `Most played: ${props.topSurahName} (${props.topSurahCount}×)`
              : props.motivationalText}
          </Text>
          <Spacer />
        </HStack>
      </VStack>
    </ZStack>
  );
}

export const listeningStatsWidget = createWidget(
  'ListeningStats',
  ListeningStatsView,
);
