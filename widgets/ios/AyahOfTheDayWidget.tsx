import {Text, VStack} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';

export type AyahOfTheDayProps = {
  arabicText: string;
  translation: string;
  reference: string;
  dateLabel: string;
};

function AyahOfTheDayView(
  props: AyahOfTheDayProps,
  environment: WidgetEnvironment,
) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const primary = isDark ? '#F2F0E8' : '#141414';
  const secondary = isDark ? '#9A968C' : '#5E5E5E';
  const accent = isDark ? '#C4BFAF' : '#3D3D3D';

  const family = environment.widgetFamily;
  const openApp = widgetURL('bayaan://mushaf');
  const arabicSmall =
    props.arabicText.length > 90
      ? `${props.arabicText.slice(0, 89)}…`
      : props.arabicText;

  if (family === 'systemSmall') {
    return (
      <VStack modifiers={[padding({all: 10}), openApp]}>
        <Text
          modifiers={[
            font({size: 10, weight: 'semibold'}),
            foregroundStyle(secondary),
          ]}>
          AYAH OF THE DAY
        </Text>
        <Text
          modifiers={[
            font({size: 13, weight: 'regular'}),
            foregroundStyle(primary),
          ]}>
          {arabicSmall}
        </Text>
        <Text
          modifiers={[
            font({size: 10, weight: 'medium'}),
            foregroundStyle(accent),
          ]}>
          {props.reference}
        </Text>
      </VStack>
    );
  }

  if (family === 'systemMedium') {
    return (
      <VStack modifiers={[padding({all: 12}), openApp]}>
        <Text
          modifiers={[
            font({size: 10, weight: 'semibold'}),
            foregroundStyle(secondary),
          ]}>
          {`AYAH OF THE DAY · ${props.dateLabel}`}
        </Text>
        <Text
          modifiers={[
            font({size: 15, weight: 'regular'}),
            foregroundStyle(primary),
          ]}>
          {props.arabicText}
        </Text>
        <Text
          modifiers={[
            font({size: 12, weight: 'regular'}),
            foregroundStyle(secondary),
          ]}>
          {props.translation}
        </Text>
        <Text
          modifiers={[
            font({size: 11, weight: 'medium'}),
            foregroundStyle(accent),
          ]}>
          {props.reference}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack modifiers={[padding({all: 14}), openApp]}>
      <Text
        modifiers={[
          font({size: 11, weight: 'semibold'}),
          foregroundStyle(secondary),
        ]}>
        {`Ayah of the day · ${props.dateLabel}`}
      </Text>
      <Text
        modifiers={[
          font({size: 18, weight: 'regular'}),
          foregroundStyle(primary),
        ]}>
        {props.arabicText}
      </Text>
      <Text
        modifiers={[
          font({size: 14, weight: 'regular'}),
          foregroundStyle(secondary),
        ]}>
        {props.translation}
      </Text>
      <Text
        modifiers={[
          font({size: 12, weight: 'medium'}),
          foregroundStyle(accent),
        ]}>
        {props.reference}
      </Text>
    </VStack>
  );
}

export const ayahOfTheDayWidget = createWidget('AyahOfTheDay', AyahOfTheDayView);
