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
  lineLimit,
  kerning,
  multilineTextAlignment,
  background,
  offset,
} from '@expo/ui/swift-ui/modifiers';
import {shapes} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type LastReadProps = {
  surahName: string;
  surahNameArabic: string;
  pageNumber: string;
  versesInfo: string;
  isEmpty: string;
};

function LastReadView(props: LastReadProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';

  // Warm indigo/purple palette — bookish, reading feel
  const bg = isDark ? '#15121E' : '#F5F2FA';
  const accent = isDark ? '#A78BDB' : '#6B42B0';
  const primary = isDark ? '#EDE8F5' : '#1E1433';
  const secondary = isDark ? 'rgba(237,232,245,0.45)' : 'rgba(30,20,51,0.4)';
  const label = isDark ? 'rgba(167,139,219,0.6)' : 'rgba(107,66,176,0.5)';
  const decorCircle = isDark
    ? 'rgba(167,139,219,0.06)'
    : 'rgba(107,66,176,0.04)';
  const chipBg = isDark ? 'rgba(167,139,219,0.15)' : 'rgba(107,66,176,0.1)';

  const family = environment.widgetFamily;
  const deepLink =
    props.isEmpty === 'true'
      ? 'bayaan://mushaf'
      : `bayaan://mushaf?page=${props.pageNumber}`;
  const openApp = widgetURL(deepLink);

  if (props.isEmpty === 'true') {
    return (
      <ZStack modifiers={[openApp, frame({maxWidth: 10000, maxHeight: 10000})]}>
        <RoundedRectangle
          cornerRadius={0}
          modifiers={[
            frame({maxWidth: 10000, maxHeight: 10000}),
            foregroundStyle(bg),
          ]}
        />
        <VStack
          spacing={8}
          modifiers={[padding({all: 14}), frame({maxWidth: 10000})]}>
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Text
              modifiers={[
                font({size: 9, weight: 'bold'}),
                foregroundStyle(label),
                kerning(1),
              ]}>
              CONTINUE READING
            </Text>
            <Spacer />
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({size: 13, weight: 'medium'}),
              foregroundStyle(secondary),
              multilineTextAlignment('center'),
              frame({maxWidth: 10000}),
            ]}>
            Open the Mushaf to start reading
          </Text>
          <Spacer />
        </VStack>
      </ZStack>
    );
  }

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
            frame({width: 110, height: 110}),
            foregroundStyle(decorCircle),
            offset({x: 45, y: 45}),
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
              CONTINUE READING
            </Text>
            <Spacer />
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({size: 24, weight: 'regular', design: 'serif'}),
              foregroundStyle(primary),
              multilineTextAlignment('trailing'),
              frame({maxWidth: 10000}),
            ]}>
            {props.surahNameArabic}
          </Text>
          <Text
            modifiers={[
              font({size: 13, weight: 'medium'}),
              foregroundStyle(secondary),
              lineLimit(1),
            ]}>
            {props.surahName}
          </Text>
          <Spacer />
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Spacer />
            <Text
              modifiers={[
                font({size: 10, weight: 'semibold'}),
                foregroundStyle(accent),
                padding({horizontal: 7, vertical: 3}),
                background(chipBg, shapes.roundedRectangle({cornerRadius: 6})),
              ]}>
              {`Page ${props.pageNumber}`}
            </Text>
          </HStack>
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
          frame({width: 150, height: 150}),
          foregroundStyle(decorCircle),
          offset({x: 130, y: -30}),
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
            CONTINUE READING
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({size: 10, weight: 'semibold'}),
              foregroundStyle(accent),
              padding({horizontal: 7, vertical: 3}),
              background(chipBg, shapes.roundedRectangle({cornerRadius: 6})),
            ]}>
            {`Page ${props.pageNumber}`}
          </Text>
        </HStack>
        <Spacer />
        <HStack spacing={12} modifiers={[frame({maxWidth: 10000})]}>
          <VStack spacing={2}>
            <Text
              modifiers={[
                font({size: 28, weight: 'regular', design: 'serif'}),
                foregroundStyle(primary),
              ]}>
              {props.surahNameArabic}
            </Text>
            <Text
              modifiers={[
                font({size: 15, weight: 'medium'}),
                foregroundStyle(secondary),
              ]}>
              {props.surahName}
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
            ]}>
            {props.versesInfo}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({size: 11, weight: 'medium'}),
              foregroundStyle(accent),
            ]}>
            Tap to continue →
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
}

export const lastReadWidget = createWidget('LastRead', LastReadView);
