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
  opacity,
  offset,
} from '@expo/ui/swift-ui/modifiers';
import {shapes} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type NowPlayingProps = {
  title: string;
  subtitle: string;
  statusLabel: string;
};

function NowPlayingView(
  props: NowPlayingProps,
  environment: WidgetEnvironment,
) {
  'widget';

  const isDark = environment.colorScheme === 'dark';

  // Deep teal/green palette — player feel
  const bg = isDark ? '#0F1A1A' : '#F0F7F5';
  const accent = isDark ? '#5BBAA0' : '#1A6B52';
  const primary = isDark ? '#E8F4F0' : '#0F2B22';
  const secondary = isDark ? 'rgba(232,244,240,0.45)' : 'rgba(15,43,34,0.4)';
  const label = isDark ? 'rgba(91,186,160,0.6)' : 'rgba(26,107,82,0.5)';
  const decorCircle = isDark
    ? 'rgba(91,186,160,0.07)'
    : 'rgba(26,107,82,0.05)';
  const statusBg = isDark ? 'rgba(91,186,160,0.15)' : 'rgba(26,107,82,0.1)';

  const family = environment.widgetFamily;
  const openApp = widgetURL('bayaan://');
  const isIdle = props.title === 'Bayaan';

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
            frame({width: 100, height: 100}),
            foregroundStyle(decorCircle),
            offset({x: -50, y: 50}),
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
              NOW PLAYING
            </Text>
            <Spacer />
          </HStack>
          <Spacer />
          {isIdle ? (
            <Text
              modifiers={[
                font({size: 13, weight: 'medium'}),
                foregroundStyle(secondary),
                multilineTextAlignment('center'),
                frame({maxWidth: 10000}),
              ]}>
              Tap to start listening
            </Text>
          ) : (
            <VStack spacing={3} modifiers={[frame({maxWidth: 10000})]}>
              <Text
                modifiers={[
                  font({size: 16, weight: 'semibold'}),
                  foregroundStyle(primary),
                  lineLimit(2),
                  frame({maxWidth: 10000}),
                ]}>
                {props.title}
              </Text>
              <Text
                modifiers={[
                  font({size: 11, weight: 'regular'}),
                  foregroundStyle(secondary),
                  lineLimit(1),
                ]}>
                {props.subtitle}
              </Text>
            </VStack>
          )}
          <Spacer />
          {!isIdle && (
            <HStack modifiers={[frame({maxWidth: 10000})]}>
              <Spacer />
              <Text
                modifiers={[
                  font({size: 9, weight: 'semibold'}),
                  foregroundStyle(accent),
                  padding({horizontal: 7, vertical: 3}),
                  background(
                    statusBg,
                    shapes.roundedRectangle({cornerRadius: 6}),
                  ),
                ]}>
                {props.statusLabel}
              </Text>
            </HStack>
          )}
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
          frame({width: 160, height: 160}),
          foregroundStyle(decorCircle),
          offset({x: 130, y: -40}),
        ]}
      />
      <Circle
        modifiers={[
          frame({width: 90, height: 90}),
          foregroundStyle(decorCircle),
          offset({x: -130, y: 40}),
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
            NOW PLAYING
          </Text>
          <Spacer />
          {!isIdle && (
            <Text
              modifiers={[
                font({size: 9, weight: 'semibold'}),
                foregroundStyle(accent),
                padding({horizontal: 7, vertical: 3}),
                background(
                  statusBg,
                  shapes.roundedRectangle({cornerRadius: 6}),
                ),
              ]}>
              {props.statusLabel}
            </Text>
          )}
        </HStack>
        <Spacer />
        {isIdle ? (
          <Text
            modifiers={[
              font({size: 15, weight: 'medium'}),
              foregroundStyle(secondary),
              multilineTextAlignment('center'),
              frame({maxWidth: 10000}),
            ]}>
            Nothing playing — tap to open Bayaan
          </Text>
        ) : (
          <VStack spacing={3} modifiers={[frame({maxWidth: 10000})]}>
            <Text
              modifiers={[
                font({size: 20, weight: 'semibold'}),
                foregroundStyle(primary),
                lineLimit(2),
                frame({maxWidth: 10000}),
              ]}>
              {props.title}
            </Text>
            <Text
              modifiers={[
                font({size: 13, weight: 'regular'}),
                foregroundStyle(secondary),
                lineLimit(1),
              ]}>
              {props.subtitle}
            </Text>
          </VStack>
        )}
        <Spacer />
        {!isIdle && (
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Text
              modifiers={[
                font({size: 11, weight: 'regular'}),
                foregroundStyle(secondary),
              ]}>
              Tap to continue listening
            </Text>
            <Spacer />
          </HStack>
        )}
      </VStack>
    </ZStack>
  );
}

export const nowPlayingWidget = createWidget('NowPlaying', NowPlayingView);
