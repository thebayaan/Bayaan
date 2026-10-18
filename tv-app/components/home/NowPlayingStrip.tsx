import React from 'react';
import {View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {openPlayer} from '../../services/playbackRouting';
import {nowPlayingView} from '../../hooks/homeNowPlaying';
import {PlayIcon} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  hasTVPreferredFocus: boolean;
  onFocus: () => void;
};

/**
 * "Now playing" at the top of Home's hero while the player holds a track:
 * OK opens the player (resuming, playing again or retrying when that is
 * what the hint says). Draws nothing when the player is empty.
 */
export function NowPlayingStrip({
  hasTVPreferredFocus,
  onFocus,
}: Props): React.ReactElement | null {
  const item = useTVPlayerStore(s => s.queue[s.currentIndex]);
  // A verse repeat's gap (held) is still listening, not a pause.
  const status = useTVPlayerStore(s => (s.held ? 'playing' : s.status));
  const finished = useTVPlayerStore(s => s.finished);
  const pending = useTVPlayerStore(s => s.pending);
  if (!item) return null;

  const view = nowPlayingView({status, finished, pending});
  const handlePress = (): void => {
    // toggle() resumes, plays a finished queue again, or retries an error.
    if (view.action !== 'open') useTVPlayerStore.getState().toggle();
    openPlayer();
  };
  const voice = item.subtitle ? ` · ${item.subtitle}` : '';

  return (
    <FocusableButton
      onPress={handlePress}
      onFocus={onFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      outlined
      focusScale={1.03}
      accessibilityLabel={`${view.kicker.toLowerCase()}: ${item.title}${voice}. ${view.hint}.`}
      containerStyle={styles.container}
      style={styles.strip}>
      <View style={styles.thumb}>
        <SurahArtwork
          surahNumber={item.surahNumber}
          glyphSize={22}
          id="home-now-playing"
        />
      </View>
      <View style={styles.text}>
        <FocusText
          style={styles.kicker}
          color={view.action === 'retry' ? colors.text : colors.accent}
          focusedColor={colors.onFocusSecondary}
          numberOfLines={1}>
          {view.kicker}
        </FocusText>
        <FocusText style={styles.title} numberOfLines={1}>
          {item.title}
          <FocusText
            style={styles.voice}
            color={colors.textSecondary}
            focusedColor={colors.onFocusSecondary}>
            {voice}
          </FocusText>
        </FocusText>
      </View>
      <View style={styles.hint}>
        {view.action === 'resume' || view.action === 'replay' ? (
          <FocusIcon icon={PlayIcon} size={16} />
        ) : null}
        <FocusText style={styles.hintText} numberOfLines={1}>
          {view.hint}
        </FocusText>
      </View>
    </FocusableButton>
  );
}

const styles = createScaledStyles({
  container: {alignSelf: 'flex-start', marginBottom: 6},
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    maxWidth: 820,
    paddingLeft: 10,
    paddingRight: 22,
    paddingVertical: 10,
    borderRadius: 16,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  text: {flexShrink: 1, gap: 2},
  kicker: {
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 2,
  },
  title: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 20},
  voice: {fontFamily: fonts.medium, fontWeight: '500', fontSize: 18},
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  hintText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 19},
});
