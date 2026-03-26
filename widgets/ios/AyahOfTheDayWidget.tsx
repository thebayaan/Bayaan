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
  multilineTextAlignment,
  lineLimit,
  kerning,
  background,
  opacity,
  offset,
} from '@expo/ui/swift-ui/modifiers';
import {shapes} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type AyahOfTheDayProps = {
  arabicText: string;
  translation: string;
  reference: string;
  dateLabel: string;
  surahNumber: string;
  ayahNumber: string;
};

function AyahOfTheDayView(
  props: AyahOfTheDayProps,
  environment: WidgetEnvironment,
) {
  'widget';

  const isDark = environment.colorScheme === 'dark';

  // Rich warm palette
  const bg = isDark ? '#1A1612' : '#FDF8F0';
  const accent = isDark ? '#D4A574' : '#8B6914';
  const primary = isDark ? '#F5EDE4' : '#2C1810';
  const secondary = isDark ? 'rgba(245,237,228,0.5)' : 'rgba(44,24,16,0.4)';
  const label = isDark ? 'rgba(212,165,116,0.6)' : 'rgba(139,105,20,0.5)';
  const decorCircle = isDark
    ? 'rgba(212,165,116,0.06)'
    : 'rgba(139,105,20,0.04)';
  const chipBg = isDark ? 'rgba(212,165,116,0.12)' : 'rgba(139,105,20,0.08)';

  const family = environment.widgetFamily;
  const deepLink = `bayaan://mushaf?surah=${props.surahNumber}&ayah=${props.ayahNumber}`;
  const openApp = widgetURL(deepLink);

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
            frame({width: 120, height: 120}),
            foregroundStyle(decorCircle),
            offset({x: 50, y: -40}),
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
              AYAH OF THE DAY
            </Text>
            <Spacer />
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({size: 17, weight: 'regular', design: 'serif'}),
              foregroundStyle(primary),
              multilineTextAlignment('trailing'),
              lineLimit(4),
              frame({maxWidth: 10000}),
            ]}>
            {props.arabicText.length > 80
              ? `${props.arabicText.slice(0, 79)}…`
              : props.arabicText}
          </Text>
          <Spacer />
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Spacer />
            <Text
              modifiers={[
                font({size: 10, weight: 'semibold'}),
                foregroundStyle(accent),
                padding({horizontal: 6, vertical: 3}),
                background(chipBg, shapes.roundedRectangle({cornerRadius: 6})),
              ]}>
              {props.reference}
            </Text>
          </HStack>
        </VStack>
      </ZStack>
    );
  }

  if (family === 'systemMedium') {
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
            frame({width: 180, height: 180}),
            foregroundStyle(decorCircle),
            offset({x: 120, y: -60}),
          ]}
        />
        <Circle
          modifiers={[
            frame({width: 80, height: 80}),
            foregroundStyle(decorCircle),
            offset({x: -140, y: 50}),
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
              AYAH OF THE DAY
            </Text>
            <Spacer />
            <Text
              modifiers={[
                font({size: 9, weight: 'medium'}),
                foregroundStyle(label),
              ]}>
              {props.dateLabel}
            </Text>
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({size: 19, weight: 'regular', design: 'serif'}),
              foregroundStyle(primary),
              multilineTextAlignment('trailing'),
              lineLimit(3),
              frame({maxWidth: 10000}),
            ]}>
            {props.arabicText}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({size: 11, weight: 'regular'}),
              foregroundStyle(secondary),
              lineLimit(2),
              frame({maxWidth: 10000}),
            ]}>
            {props.translation}
          </Text>
          <Spacer />
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Spacer />
            <Text
              modifiers={[
                font({size: 10, weight: 'semibold'}),
                foregroundStyle(accent),
                padding({horizontal: 8, vertical: 3}),
                background(chipBg, shapes.roundedRectangle({cornerRadius: 6})),
              ]}>
              {props.reference}
            </Text>
          </HStack>
        </VStack>
      </ZStack>
    );
  }

  // systemLarge
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
          frame({width: 220, height: 220}),
          foregroundStyle(decorCircle),
          offset({x: 100, y: -80}),
        ]}
      />
      <Circle
        modifiers={[
          frame({width: 140, height: 140}),
          foregroundStyle(decorCircle),
          offset({x: -120, y: 120}),
        ]}
      />
      <VStack spacing={0} modifiers={[padding({all: 18}), frame({maxWidth: 10000})]}>
        <HStack modifiers={[frame({maxWidth: 10000})]}>
          <Text
            modifiers={[
              font({size: 10, weight: 'bold'}),
              foregroundStyle(label),
              kerning(1),
            ]}>
            AYAH OF THE DAY
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({size: 10, weight: 'medium'}),
              foregroundStyle(label),
            ]}>
            {props.dateLabel}
          </Text>
        </HStack>
        <Spacer />
        <Text
          modifiers={[
            font({size: 24, weight: 'regular', design: 'serif'}),
            foregroundStyle(primary),
            multilineTextAlignment('trailing'),
            frame({maxWidth: 10000}),
          ]}>
          {props.arabicText}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({size: 14, weight: 'regular'}),
            foregroundStyle(secondary),
            multilineTextAlignment('leading'),
            frame({maxWidth: 10000}),
          ]}>
          {props.translation}
        </Text>
        <Spacer />
        <HStack modifiers={[frame({maxWidth: 10000})]}>
          <Spacer />
          <Text
            modifiers={[
              font({size: 11, weight: 'semibold'}),
              foregroundStyle(accent),
              padding({horizontal: 10, vertical: 4}),
              background(chipBg, shapes.roundedRectangle({cornerRadius: 8})),
            ]}>
            {props.reference}
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
}

export const ayahOfTheDayWidget = createWidget(
  'AyahOfTheDay',
  AyahOfTheDayView,
);
