import React from 'react';
import {StyleSheet, Text, TVFocusGuideView, View} from 'react-native';
import {Image} from 'expo-image';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusIcon, FocusText} from '../primitives/focusContext';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {HomeGlow} from '../home/HomeGlow';
import {arabicFontStyle} from '../adhkar/arabicFont';
import {ShelfSurahTile, SHELF_RING, TileLabels} from './ShelfTile';
import {
  HeartIcon,
  PersonAudioIcon,
  PlayIcon,
  type IconProps,
} from '../../../components/Icons';
import {adhkarImageUrl, adhkarList} from '../../services/adhkarData';
import {listGradient, listSubtitle} from '../../services/adhkarBrowse';
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
    icon: PlayIcon,
    title: 'Continue listening',
    text: 'Stop partway and it waits here, to the verse.',
  },
  {
    icon: HeartIcon,
    title: 'Loved surahs',
    text: 'While a surah plays, press OK and choose the heart.',
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
  /** The adhkar list for this time of day (morning, evening, before sleep). */
  adhkarListId: string;
  onPlaySurah: (surahNumber: number) => void;
  onBrowseReciters: () => void;
  onOpenAdhkar: (listId: string) => void;
};

/**
 * The Library before anything is kept: one clear first step (Play
 * Al-Fatihah, focused), what will gather here (not focusable), and a row of
 * good places to start in the default voice.
 */
export function LibraryFirstRun({
  reciter,
  adhkarListId,
  onPlaySurah,
  onBrowseReciters,
  onOpenAdhkar,
}: Props): React.ReactElement {
  const voice = reciter ? shortReciterName(reciter.name) : '';
  const list = adhkarList(adhkarListId);
  return (
    <View style={styles.root}>
      <HomeGlow palette={GLOW} />
      <View style={styles.calligraphy} pointerEvents="none" accessible={false}>
        <SurahGlyph surahNumber={1} size={250} color={colors.textSecondary} />
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>YOUR LIBRARY</Text>
          <Text style={styles.title}>Start with one surah</Text>
          <Text style={styles.sentence}>
            Whatever you begin, love or come back to collects here on its own.
          </Text>
          <TVFocusGuideView autoFocus style={styles.actions}>
            <FocusableButton
              onPress={() => onPlaySurah(1)}
              hasTVPreferredFocus
              outlined
              accessibilityLabel={
                voice ? `Play Al-Fatihah with ${voice}` : 'Play Al-Fatihah'
              }
              style={styles.button}>
              <View style={styles.buttonInner}>
                <FocusIcon icon={PlayIcon} size={20} />
                <FocusText style={styles.buttonText}>Play Al-Fatihah</FocusText>
              </View>
            </FocusableButton>
            <FocusableButton
              onPress={onBrowseReciters}
              accessibilityLabel="Browse reciters"
              style={styles.button}>
              <FocusText style={styles.buttonText}>Browse reciters</FocusText>
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
          <TVFocusGuideView autoFocus style={styles.starterRow}>
            {STARTER_SURAHS.map(s => (
              <ShelfSurahTile
                key={s.n}
                surahNumber={s.n}
                surahName={s.name}
                reciter={reciter}
                caption={voice}
                loved={false}
                progress={null}
                art={STARTER_ART}
                idPrefix="lib-start"
                onPress={() => onPlaySurah(s.n)}
                accessibilityLabel={
                  voice ? `Play ${s.name} with ${voice}` : `Play ${s.name}`
                }
              />
            ))}
            {list ? (
              <FocusableCard
                ring={false}
                style={styles.adhkarCard}
                onPress={() => onOpenAdhkar(list.id)}
                accessibilityLabel={`${list.title} adhkar, ${listSubtitle(list.id, true)}`}>
                <FocusFrame radius={18} style={styles.adhkarFrame}>
                  <GradientFill
                    colors={listGradient(list.color)}
                    id={`lib-start-adhkar-${list.id}`}
                  />
                  <Image
                    source={{uri: adhkarImageUrl(list.id)}}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                    accessible={false}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.adhkarArabic, arabicFontStyle]}>
                    {list.arabicTitle}
                  </Text>
                </FocusFrame>
                <TileLabels
                  small
                  title={adhkarTitle(list.title)}
                  caption={listSubtitle(list.id, true)}
                />
              </FocusableCard>
            ) : null}
          </TVFocusGuideView>
        </View>
      </View>
    </View>
  );
}

/** "Evening adhkar" for the two daily lists; other titles stand alone. */
function adhkarTitle(title: string): string {
  return title === 'Morning' || title === 'Evening' ? `${title} adhkar` : title;
}

const STARTER_FRAME = STARTER_ART + SHELF_RING * 2;

const styles = createScaledStyles({
  root: {flex: 1},
  // The glow spans the whole screen; the content keeps the side gutters.
  content: {flex: 1, paddingLeft: 72, paddingRight: 84},
  calligraphy: {position: 'absolute', right: 150, top: 120},
  hero: {marginTop: 88, width: 1000},
  kicker: {
    color: colors.accent,
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
  explainers: {flexDirection: 'row', gap: 40, marginTop: 96},
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
  starter: {marginTop: 84},
  starterTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 28,
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
  adhkarCard: {width: STARTER_FRAME},
  adhkarFrame: {width: STARTER_FRAME, height: STARTER_FRAME},
  adhkarArabic: {
    position: 'absolute',
    top: 10,
    right: 14,
    left: 14,
    textAlign: 'right',
    color: colors.text,
    fontSize: 24,
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
});
