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
  multilineTextAlignment,
  offset,
} from '@expo/ui/swift-ui/modifiers';
import {shapes} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type FavoritesProps = {
  /** Comma-separated surah names */
  surahNames: string;
  /** Comma-separated reciter names matching each surah */
  reciterNames: string;
  /** How many loved tracks total */
  totalCount: string;
  isEmpty: string;
};

function FavoritesView(props: FavoritesProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';

  // Warm amber/honey palette — warmth, love
  const bg = isDark ? '#1A1610' : '#FBF6EE';
  const accent = isDark ? '#DBA654' : '#9B6E1A';
  const primary = isDark ? '#F5EDE0' : '#261C0C';
  const secondary = isDark ? 'rgba(245,237,224,0.45)' : 'rgba(38,28,12,0.4)';
  const label = isDark ? 'rgba(219,166,84,0.6)' : 'rgba(155,110,26,0.5)';
  const decorCircle = isDark
    ? 'rgba(219,166,84,0.06)'
    : 'rgba(155,110,26,0.04)';
  const chipBg = isDark ? 'rgba(219,166,84,0.1)' : 'rgba(155,110,26,0.06)';

  const family = environment.widgetFamily;
  const openApp = widgetURL('bayaan://');

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
              FAVORITES
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
            Heart a recitation to see it here
          </Text>
          <Spacer />
        </VStack>
      </ZStack>
    );
  }

  const names = props.surahNames.split(',');
  const reciters = props.reciterNames.split(',');

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
            offset({x: 50, y: 50}),
          ]}
        />
        <VStack
          spacing={5}
          modifiers={[padding({all: 14}), frame({maxWidth: 10000})]}>
          <HStack modifiers={[frame({maxWidth: 10000})]}>
            <Text
              modifiers={[
                font({size: 9, weight: 'bold'}),
                foregroundStyle(label),
                kerning(1),
              ]}>
              FAVORITES
            </Text>
            <Spacer />
            <Text
              modifiers={[
                font({size: 9, weight: 'semibold'}),
                foregroundStyle(accent),
              ]}>
              {props.totalCount}
            </Text>
          </HStack>
          <Spacer />
          {names.slice(0, 3).map((name, i) => (
            <VStack
              key={String(i)}
              spacing={1}
              modifiers={[
                frame({maxWidth: 10000}),
                padding({horizontal: 8, vertical: 4}),
                background(chipBg, shapes.roundedRectangle({cornerRadius: 8})),
              ]}>
              <Text
                modifiers={[
                  font({size: 12, weight: 'semibold'}),
                  foregroundStyle(primary),
                  lineLimit(1),
                ]}>
                {name}
              </Text>
              <Text
                modifiers={[
                  font({size: 9, weight: 'regular'}),
                  foregroundStyle(secondary),
                  lineLimit(1),
                ]}>
                {reciters[i] ?? ''}
              </Text>
            </VStack>
          ))}
        </VStack>
      </ZStack>
    );
  }

  // systemMedium — two columns
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
          offset({x: 130, y: -50}),
        ]}
      />
      <VStack
        spacing={0}
        modifiers={[padding({all: 14}), frame({maxWidth: 10000})]}>
        <HStack modifiers={[frame({maxWidth: 10000})]}>
          <Text
            modifiers={[
              font({size: 9, weight: 'bold'}),
              foregroundStyle(label),
              kerning(1),
            ]}>
            FAVORITES
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({size: 9, weight: 'semibold'}),
              foregroundStyle(accent),
            ]}>
            {`${props.totalCount} loved`}
          </Text>
        </HStack>
        <Spacer />
        <HStack spacing={8} modifiers={[frame({maxWidth: 10000})]}>
          <VStack spacing={5} modifiers={[frame({maxWidth: 10000})]}>
            {names.slice(0, 3).map((name, i) => (
              <VStack
                key={String(i)}
                spacing={1}
                modifiers={[
                  frame({maxWidth: 10000}),
                  padding({horizontal: 8, vertical: 5}),
                  background(
                    chipBg,
                    shapes.roundedRectangle({cornerRadius: 8}),
                  ),
                ]}>
                <Text
                  modifiers={[
                    font({size: 12, weight: 'semibold'}),
                    foregroundStyle(primary),
                    lineLimit(1),
                  ]}>
                  {name}
                </Text>
                <Text
                  modifiers={[
                    font({size: 9, weight: 'regular'}),
                    foregroundStyle(secondary),
                    lineLimit(1),
                  ]}>
                  {reciters[i] ?? ''}
                </Text>
              </VStack>
            ))}
          </VStack>
          <VStack spacing={5} modifiers={[frame({maxWidth: 10000})]}>
            {names.slice(3, 6).map((name, i) => (
              <VStack
                key={String(i + 3)}
                spacing={1}
                modifiers={[
                  frame({maxWidth: 10000}),
                  padding({horizontal: 8, vertical: 5}),
                  background(
                    chipBg,
                    shapes.roundedRectangle({cornerRadius: 8}),
                  ),
                ]}>
                <Text
                  modifiers={[
                    font({size: 12, weight: 'semibold'}),
                    foregroundStyle(primary),
                    lineLimit(1),
                  ]}>
                  {name}
                </Text>
                <Text
                  modifiers={[
                    font({size: 9, weight: 'regular'}),
                    foregroundStyle(secondary),
                    lineLimit(1),
                  ]}>
                  {reciters[i + 3] ?? ''}
                </Text>
              </VStack>
            ))}
          </VStack>
        </HStack>
        <Spacer />
      </VStack>
    </ZStack>
  );
}

export const favoritesWidget = createWidget('Favorites', FavoritesView);
