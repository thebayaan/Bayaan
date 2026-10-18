import React from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {SurahGlyph} from '../brand/SurahGlyph';
import {HomeGlow} from '../home/HomeGlow';
import {ShelfSurahTile, SHELF_RING} from './ShelfTile';
import {PlusIcon} from './LibraryIcons';
import {
  HeartIcon,
  PersonAudioIcon,
  PlaylistIcon,
  type IconProps,
} from '../../../components/Icons';
import {shortReciterName} from '../../services/listeningChoices';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';

/** Surahs most people start with: Al-Fatihah, Al-Kahf, Al-Mulk, Ya-Sin. */
const STARTER_SURAHS: ReadonlyArray<{n: number; name: string}> = [
  {n: 1, name: 'Al-Fatihah'},
  {n: 18, name: 'Al-Kahf'},
  {n: 67, name: 'Al-Mulk'},
  {n: 36, name: 'Ya-Sin'},
];

const STARTER_ART = 186;
const GLOW = ['#38bdf8', '#818cf8'] as const;

type Explainer = {
  icon: React.FC<IconProps>;
  round?: boolean;
  title: string;
  text: string;
};

const EXPLAINERS: readonly Explainer[] = [
  {
    icon: PlaylistIcon,
    title: 'Playlists',
    text: 'Hold OK on any surah and choose Add to playlist.',
  },
  {
    icon: HeartIcon,
    title: 'Loved surahs',
    text: 'Hold OK on a surah and choose Love, or press Love in the player.',
  },
  {
    icon: PersonAudioIcon,
    round: true,
    title: 'Your reciters',
    text: 'Open a reciter and choose Favorite.',
  },
];

type Props = {
  /** The voice the starter surahs play in. */
  reciter: Reciter | null;
  onNewPlaylist: () => void;
  onBrowseSurahs: () => void;
  onPlaySurah: (surahNumber: number) => void;
  /** Hold OK on a starter surah: its menu (like, add to a playlist). */
  onSurahMenu: (surahNumber: number) => void;
};

/**
 * The Library before anything is kept: what lives here (playlists, loved
 * surahs, favourite reciters; not focusable), one clear first step (New
 * playlist, focused) and a row of good places to start in the default
 * voice, where holding OK shows how to keep a surah.
 */
export function LibraryFirstRun({
  reciter,
  onNewPlaylist,
  onBrowseSurahs,
  onPlaySurah,
  onSurahMenu,
}: Props): React.ReactElement {
  const voice = reciter ? shortReciterName(reciter.name) : '';
  return (
    <View style={styles.root}>
      <HomeGlow palette={GLOW} />
      <View style={styles.calligraphy} pointerEvents="none" accessible={false}>
        <SurahGlyph surahNumber={1} size={250} color={colors.textSecondary} />
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>YOUR LIBRARY</Text>
          <Text style={styles.title}>Keep what you love</Text>
          <Text style={styles.sentence}>
            Surahs you love, reciters you favorite and your playlists live
            here.
          </Text>
          <TVFocusGuideView autoFocus style={styles.actions}>
            <FocusableButton
              onPress={onNewPlaylist}
              hasTVPreferredFocus
              outlined
              accessibilityLabel="New playlist"
              style={styles.button}>
              <View style={styles.buttonInner}>
                <FocusIcon icon={PlusIcon} size={22} />
                <FocusText style={styles.buttonText}>New playlist</FocusText>
              </View>
            </FocusableButton>
            <FocusableButton
              onPress={onBrowseSurahs}
              accessibilityLabel="Browse surahs"
              style={styles.button}>
              <FocusText style={styles.buttonText}>Browse surahs</FocusText>
            </FocusableButton>
          </TVFocusGuideView>
        </View>

        <View style={styles.explainers} accessible={false}>
          {EXPLAINERS.map(e => (
            <View key={e.title} style={styles.explainer}>
              <View style={[styles.ghost, e.round && styles.ghostRound]}>
                <e.icon color={colors.textTertiary} size={scale(34)} />
              </View>
              <View style={styles.explainerText}>
                <Text style={styles.explainerTitle}>{e.title}</Text>
                <Text style={styles.explainerSub}>{e.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.starter}>
          <Text style={styles.starterTitle}>Good places to start</Text>
          <Text style={styles.starterHint}>
            Hold OK on a surah to love it or add it to a playlist.
          </Text>
          <TVFocusGuideView autoFocus style={styles.starterRow}>
            {STARTER_SURAHS.map(s => (
              <ShelfSurahTile
                key={s.n}
                surahNumber={s.n}
                surahName={s.name}
                reciter={reciter}
                caption={voice}
                loved={false}
                art={STARTER_ART}
                idPrefix="lib-start"
                onPress={() => onPlaySurah(s.n)}
                onLongPress={() => onSurahMenu(s.n)}
                accessibilityLabel={
                  voice ? `Play ${s.name} with ${voice}` : `Play ${s.name}`
                }
              />
            ))}
          </TVFocusGuideView>
        </View>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1},
  // The glow spans the whole screen; the content keeps the side gutters.
  content: {flex: 1, paddingLeft: 72, paddingRight: 84},
  calligraphy: {position: 'absolute', right: 150, top: 120},
  hero: {marginTop: 88, width: 1000},
  kicker: {
    color: colors.textTertiary,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: 3.8,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 84,
    letterSpacing: -2.4,
    marginTop: 12,
  },
  sentence: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 26,
    lineHeight: 38,
    marginTop: 12,
  },
  actions: {flexDirection: 'row', gap: 16, marginTop: 30},
  button: {paddingHorizontal: 30, paddingVertical: 16, borderRadius: 16},
  buttonInner: {flexDirection: 'row', alignItems: 'center', gap: 12},
  buttonText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 24},
  explainers: {flexDirection: 'row', gap: 40, marginTop: 80},
  explainer: {flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 24},
  ghost: {
    width: 92,
    height: 92,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(244,243,236,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostRound: {borderRadius: 46},
  explainerText: {flex: 1, gap: 4, paddingTop: 6},
  explainerTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 25,
  },
  explainerSub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
    lineHeight: 28,
  },
  starter: {marginTop: 72},
  starterTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 28,
  },
  starterHint: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
    marginTop: 6,
  },
  // Pull the row left by the focus ring's reserved space so the artwork
  // lines up with the heading.
  starterRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 34 - SHELF_RING * 2,
    marginTop: 22 - SHELF_RING,
    marginLeft: -SHELF_RING,
  },
});
