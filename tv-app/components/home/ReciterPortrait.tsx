import React from 'react';
import {Image} from 'expo-image';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {useRailFocus} from './HomeRail';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {getReciterArtwork} from '../../services/reciterArtwork';
import {portraitName} from '../../hooks/homeReciters';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';

const SIZE = 160;
const FRAME = SIZE + 18; // ring 4 + gap 5 on each side

type Props = {
  reciter: Reciter;
  onSelect: (reciter: Reciter) => void;
};

/**
 * A reciter as a round portrait with the name below (short enough for one
 * line, see portraitName; the full name is read out), sized so a full row
 * fits under the hero (the shared ReciterCard is larger). Long press opens
 * the reciter menu, like everywhere else. The initial sits under the photo,
 * so a portrait that never loads (offline, not cached) still shows it.
 */
function ReciterPortraitImpl({reciter, onSelect}: Props): React.ReactElement {
  const onFocusRail = useRailFocus();
  const artwork = getReciterArtwork(reciter);
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(reciter)}
      onLongPress={() => useContextMenuStore.getState().openReciter(reciter.id)}
      onFocus={onFocusRail}
      accessibilityLabel={reciter.name}>
      <FocusFrame radius={SIZE / 2} style={styles.frame}>
        <View style={styles.placeholder}>
          <Text style={styles.initial}>
            {reciter.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        {artwork ? (
          <Image
            source={artwork}
            style={styles.img}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}
      </FocusFrame>
      <FocusText
        style={styles.name}
        color={colors.textSecondary}
        focusedColor={colors.text}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}>
        {portraitName(reciter.name)}
      </FocusText>
    </FocusableCard>
  );
}

export const ReciterPortrait = React.memo(ReciterPortraitImpl);

const styles = createScaledStyles({
  card: {width: FRAME, alignItems: 'center', gap: 10},
  frame: {width: FRAME, height: FRAME},
  img: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  placeholder: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {color: colors.text, fontSize: 56, fontWeight: '300', opacity: 0.35},
  name: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 20,
    textAlign: 'center',
  },
});
