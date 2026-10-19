import React, {createContext, useContext, useEffect, useState} from 'react';
import {StyleSheet, Text, TVFocusGuideView, View} from 'react-native';
import {Image} from 'expo-image';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {FocusIcon} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {GradientFill} from '../brand/GradientFill';
import {HandsGlyph} from './SearchGlyphs';
import {
  HeartIcon,
  PlayIcon,
  RepeatIcon,
  ShuffleIcon,
  type IconProps,
} from '../../../components/Icons';
import type {SearchItem, VerseRef} from '../../services/search/tvSearch';
import {pickRewayah} from '../../services/search/playback';
import {
  adhkarCount,
  adhkarForList,
  adhkarImageUrl,
} from '../../services/adhkarData';
import {rewayahLabel} from '../../services/listeningChoices';
import {
  ADHKAR_WHEN,
  adhkarGradient,
  countLabel,
  estimateMinutes,
} from '../../services/search/adhkarArt';
import {
  DEFAULT_TRANSLATION,
  fetchTranslation,
  getArabicVerses,
} from '../../services/verseData';
import {ReciterPortrait} from '../browse/ReciterPortrait';
import {useFavorites} from '../../hooks/useFavorites';
import {surahGradient} from '../../theme/surahColors';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts, quranTextFontFamily, typography} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';
import type {SearchActions, VerseAction} from './useSearchActions';
import type {Surah} from '../../../data/surahData';

type Props = {
  top: SearchItem;
  /** Who a surah plays in, for the card's meta line. */
  surahReciter: (surah: Surah) => Reciter | null;
  actions: SearchActions;
  onChooseReciter: (surah: Surah) => void;
  /** Take focus on the first button as the card appears. */
  takeFocus: boolean;
  /** Focus "Choose reciter" instead (coming back from the picker). */
  focusChooser: boolean;
  /**
   * Handed the first (primary) button's view, for the focus guide that sends
   * Right from the keyboard to it.
   */
  primaryRef?: React.Ref<View>;
};

/** The card's primary button takes this ref (one per card). */
const PrimaryRef = createContext<React.Ref<View> | undefined>(undefined);

/**
 * The best match, large, with the buttons its kind needs. The first button is
 * always the one most people want, so Right from the keyboard and OK does the
 * obvious thing.
 */
export function TopResultCard(props: Props): React.ReactElement {
  return (
    <PrimaryRef.Provider value={props.primaryRef}>
      <TopResultBody {...props} />
    </PrimaryRef.Provider>
  );
}

function TopResultBody(props: Props): React.ReactElement {
  const {top} = props;
  switch (top.type) {
    case 'surah':
      return <SurahTop {...props} surah={top.item} />;
    case 'reciter':
      return <ReciterTop {...props} reciter={top.item} />;
    case 'adhkar':
      return <AdhkarTop {...props} />;
    case 'verse':
      return <VerseTop {...props} verse={top.item} />;
  }
}

function SurahTop({
  surah,
  surahReciter,
  actions,
  onChooseReciter,
  takeFocus,
  focusChooser,
}: Props & {surah: Surah}): React.ReactElement {
  const [note, setNote] = useState<string | null>(null);
  const reciter = surahReciter(surah);
  const place =
    surah.revelation_place.toLowerCase() === 'makkah' ? 'Makki' : 'Madani';
  const play = async (repeat: boolean) => {
    const ok = await actions.playSurah(surah, {repeat});
    if (!ok) setNote('No reciter has this surah yet.');
  };
  return (
    <Card
      art={
        <View style={styles.art}>
          <SurahArtwork
            surahNumber={surah.id}
            glyphSize={150}
            id={`search-top-${surah.id}`}
          />
        </View>
      }
      eyebrow={`Top result · Surah ${surah.id} · ${place}`}
      title={surah.name}
      meta={[
        surah.translated_name_english,
        `${surah.verses_count} verses`,
        reciter?.name,
      ]}
      note={note}>
      <Action
        label="Play"
        icon={PlayIcon}
        primary
        focus={takeFocus && !focusChooser}
        onPress={() => play(false)}
      />
      <Action
        label="Choose reciter"
        focus={focusChooser}
        onPress={() => onChooseReciter(surah)}
      />
      <Action
        label="Play on repeat"
        icon={RepeatIcon}
        onPress={() => play(true)}
      />
    </Card>
  );
}

function ReciterTop({
  reciter,
  actions,
  takeFocus,
}: Props & {reciter: Reciter}): React.ReactElement {
  const [note, setNote] = useState<string | null>(null);
  const favorites = useFavorites();
  const favorite = favorites.some(f => f.reciterId === reciter.id);
  const rewayah = pickRewayah(reciter.rewayat);
  return (
    <Card
      art={
        <View style={[styles.art, styles.round]}>
          <ReciterPortrait reciter={reciter} size={ART} idPrefix="search-top" />
        </View>
      }
      eyebrow={['Top result · Reciter', rewayahLabel(rewayah)]
        .filter(Boolean)
        .join(' · ')}
      title={reciter.name}
      meta={[
        reciter.name_arabic,
        rewayah ? `${rewayah.surah_total} surahs` : null,
        reciter.rewayat.length > 1
          ? `${reciter.rewayat.length} recitations`
          : null,
      ]}
      note={note}>
      <Action
        label="Shuffle play"
        icon={ShuffleIcon}
        primary
        focus={takeFocus}
        onPress={async () => {
          if (!(await actions.shuffleReciter(reciter))) {
            setNote('Nothing to play from this reciter yet.');
          }
        }}
      />
      <Action
        label="Open profile"
        onPress={() => actions.openReciter(reciter)}
      />
      <Action
        label={favorite ? 'Favourited' : 'Favourite'}
        icon={HeartIcon}
        filled={favorite}
        onPress={() => actions.favoriteReciter(reciter)}
      />
    </Card>
  );
}

function AdhkarTop({top, actions, takeFocus}: Props): React.ReactElement {
  // The hands glyph stands in until the list's illustration has loaded, and
  // stays when it can't be (offline).
  // Kept per list: another list's illustration may not be loaded (or
  // loadable) yet.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const list = top.type === 'adhkar' ? top.item : null;
  if (!list) return <View />;
  const imageShown = loadedFor === list.id;
  const count = adhkarCount(list.id);
  const minutes = estimateMinutes(adhkarForList(list.id));
  return (
    <Card
      art={
        <View style={styles.art}>
          <GradientFill
            colors={adhkarGradient(list)}
            id={`search-top-${list.id}`}
          />
          {imageShown ? null : (
            <HandsGlyph color={colors.text} size={scale(110)} />
          )}
          {/* The same illustration as the Browse tile and the Adhkar tab. */}
          <Image
            source={{uri: adhkarImageUrl(list.id)}}
            style={[StyleSheet.absoluteFill, styles.adhkarImage]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
            accessible={false}
            onLoad={() => setLoadedFor(list.id)}
          />
        </View>
      }
      eyebrow="Top result · Adhkar"
      title={list.title}
      arabic={list.arabicTitle}
      meta={[countLabel(count), `about ${minutes} min`, ADHKAR_WHEN[list.id]]}
      note={null}>
      <Action
        label="Start"
        primary
        focus={takeFocus}
        onPress={() => actions.openAdhkar(list, 'read')}
      />
      <Action
        label="Listen through"
        icon={PlayIcon}
        onPress={() => actions.openAdhkar(list, 'listen')}
      />
      <Action
        label="Count each for me"
        onPress={() => actions.openAdhkar(list, 'count')}
      />
    </Card>
  );
}

function VerseTop({
  verse,
  actions,
  takeFocus,
}: Props & {verse: VerseRef}): React.ReactElement {
  const [translation, setTranslation] = useState<string | null>(null);
  const arabic = getArabicVerses(verse.surah.id)[verse.ayah - 1] ?? '';

  useEffect(() => {
    let cancelled = false;
    setTranslation(null);
    fetchTranslation(DEFAULT_TRANSLATION, verse.surah.id)
      .then(t => {
        if (!cancelled) setTranslation(t[verse.ayah - 1] ?? null);
      })
      // Offline with nothing cached: the Arabic carries the card.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [verse.surah.id, verse.ayah]);

  // The player opens at once; any note about the verse shows as a toast.
  const run = (action: VerseAction) => {
    void actions.playVerse(verse, action);
  };

  return (
    <Card
      art={
        <View style={styles.art}>
          {/* The tile itself has no padding, so the gradient (sized from it)
              reaches every edge; the padding is the verse's own. */}
          <GradientFill
            colors={surahGradient(verse.surah.id)}
            id={`search-top-v${verse.surah.id}`}
          />
          <View style={styles.verseFrame}>
            <Text
              style={[
                styles.verseText,
                quranTextFontAvailable && {fontFamily: quranTextFontFamily},
              ]}
              numberOfLines={VERSE_LINES}>
              {arabic}
            </Text>
          </View>
        </View>
      }
      eyebrow={`Top result · ${verse.surah.name} · Verse ${verse.ayah}`}
      title={
        verse.name ?? `${verse.surah.name} ${verse.surah.id}:${verse.ayah}`
      }
      quote={translation}
      meta={
        translation
          ? []
          : [
              `${verse.surah.id}:${verse.ayah}`,
              verse.surah.translated_name_english,
            ]
      }
      note={null}>
      <Action
        label="Play verse"
        icon={PlayIcon}
        primary
        focus={takeFocus}
        onPress={() => run('verse')}
      />
      <Action
        label="Repeat verse"
        icon={RepeatIcon}
        onPress={() => run('repeat')}
      />
      <Action label="Play surah from here" onPress={() => run('from')} />
    </Card>
  );
}

function Card({
  art,
  eyebrow,
  title,
  arabic,
  quote,
  meta,
  note,
  children,
}: {
  art: React.ReactNode;
  eyebrow: string;
  title: string;
  arabic?: string;
  quote?: string | null;
  meta: readonly (string | null | undefined)[];
  note: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  const metaLine = meta.filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      {art}
      <View style={styles.info}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {arabic ? <Text style={styles.arabicTitle}>{arabic}</Text> : null}
        {quote ? (
          <Text style={styles.quote} numberOfLines={2}>
            “{quote.trim()}”
          </Text>
        ) : null}
        {metaLine ? (
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
        <TVFocusGuideView autoFocus style={styles.buttons}>
          {children}
        </TVFocusGuideView>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

function Action({
  label,
  icon,
  filled,
  primary,
  focus,
  onPress,
}: {
  label: string;
  icon?: React.FC<IconProps>;
  filled?: boolean;
  primary?: boolean;
  focus?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const primaryRef = useContext(PrimaryRef);
  return (
    <FocusableButton
      ref={primary ? primaryRef : undefined}
      onPress={onPress}
      hasTVPreferredFocus={focus}
      accessibilityLabel={label}
      style={[styles.action, primary ? styles.actionMain : styles.actionQuiet]}>
      {icon ? <FocusIcon icon={icon} size={22} filled={filled} /> : null}
      <FocusText style={styles.actionText}>{label}</FocusText>
    </FocusableButton>
  );
}

const ART = 280;
const VERSE_PAD = 22;
const VERSE_LINES = 4;

const styles = createScaledStyles({
  card: {flexDirection: 'row', gap: 40, alignItems: 'center'},
  art: {
    width: ART,
    height: ART,
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  round: {borderRadius: ART / 2},
  adhkarImage: {opacity: 0.85},
  // Four lines of 48 fit the 236 left inside the padding; the frame clips
  // anything a taller Quran face adds rather than let it run off the tile.
  verseFrame: {
    width: ART,
    maxHeight: ART,
    padding: VERSE_PAD,
    overflow: 'hidden',
  },
  verseText: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 48,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  info: {flex: 1, gap: 8},
  eyebrow: {...typography.label, color: colors.accent},
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 58,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 68,
  },
  arabicTitle: {color: colors.textSecondary, fontSize: 28},
  quote: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 30,
  },
  meta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
  },
  buttons: {flexDirection: 'row', gap: 14, marginTop: 22, flexWrap: 'wrap'},
  action: {
    height: 64,
    paddingHorizontal: 28,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // The main action wears only the faint divider line at rest, so the one
  // cream thing on screen is the focus (Ink & Cream).
  actionMain: {borderWidth: 2, borderColor: colors.border},
  actionQuiet: {paddingHorizontal: 22},
  actionText: {fontFamily: fonts.bold, fontSize: 22, fontWeight: '700'},
  note: {
    marginTop: 10,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 18,
    fontWeight: '500',
  },
});
