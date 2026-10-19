import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Image} from 'expo-image';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {
  FocusFrame,
  FocusText,
  useButtonFocused,
} from '../components/primitives/focusContext';
import {ReciterPickerPanel} from '../components/settings/ReciterPickerPanel';
import {GlowBackdrop} from '../components/listening/GlowBackdrop';
import {LogoMark} from '../components/brand/LogoMark';
import {NowPlayingPill} from '../components/nav/NowPlayingPill';
import {useOnboarded} from '../hooks/useOnboarded';
import {useReciters} from '../hooks/useReciters';
import {usePreviewTranslation} from '../hooks/usePreviewTranslation';
import {pushScreenBack} from '../services/screenBack';
import {getArabicVerses} from '../services/verseData';
import {reciterSubtitle} from '../services/browseCatalog';
import {useSettingsStore} from '../store/settingsStore';
import {
  findTranslation,
  translationLanguages,
  useDisplayStore,
  type OnScreenMode,
} from '../store/displayStore';
import {getReciterArtwork} from '../services/reciterArtwork';
import {popularReciters, shortReciterName} from '../services/listeningChoices';
import {defaultReciterChoices} from '../services/reciterPicker';
import type {Reciter} from '../types/reciter';
import {colors} from '../theme/colors';
import {quranTextFontAvailable} from '../theme/calligraphy';
import {fonts, quranTextFontFamily} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

/** Portraits on the first step. */
const FEATURED_COUNT = 6;
/** The verse the step-two cards preview (Al-Mulk 1). */
const PREVIEW_SURAH = 67;

const MODE_CHOICES: readonly {value: OnScreenMode; label: string}[] = [
  {value: 'both', label: 'Arabic + translation'},
  {value: 'arabic', label: 'Arabic'},
  {value: 'translation', label: 'Translation'},
];

/** Arabic-script labels (اردو), which Manrope has no glyphs for. */
const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/**
 * First launch in two steps, then Home: whose voice everything plays in
 * (round portraits of the best-known reciters, or the full list), and what
 * the listening room shows (Arabic, translation or both, and in which
 * language). Back on step two returns to step one. Opened again from
 * Settings, it starts on your current choices and Back on step one closes it.
 */
export function OnboardingScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const {markOnboarded, rerun} = useOnboarded();
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const [step, setStep] = useState<1 | 2>(1);
  const [browsing, setBrowsing] = useState(false);
  // Closing the browse panel puts focus back on its button.
  const [returnToBrowse, setReturnToBrowse] = useState(false);
  // The reciter picked here. On first launch the stored default was only
  // seeded, so it is not shown as a choice until one is made.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const shownId = pickedId ?? (rerun ? defaultReciterId : null);

  const popular = useMemo(
    () =>
      popularReciters(
        reciters,
        FEATURED_COUNT,
        r => getReciterArtwork(r) !== null,
      ),
    [reciters],
  );
  // A pick from the full list takes the last portrait, so step one still
  // shows (and focuses) it when you come back.
  const featured = useMemo(() => {
    const chosen = reciters.find(r => r.id === shownId);
    if (!chosen || popular.includes(chosen)) return popular;
    return [...popular.slice(0, FEATURED_COUNT - 1), chosen];
  }, [popular, reciters, shownId]);
  // Led by your pick; on first launch the seeded default is not one, so the
  // popular voices lead instead.
  const browseList = useMemo(
    () => (browsing ? defaultReciterChoices(reciters, shownId) : []),
    [browsing, reciters, shownId],
  );

  const pick = useCallback(
    (id: string): void => {
      setDefaultReciterId(id);
      setPickedId(id);
      setReturnToBrowse(false);
      setBrowsing(false);
      setStep(2);
    },
    [setDefaultReciterId],
  );

  const handleBack = useCallback((): boolean => {
    if (browsing) {
      setBrowsing(false);
      return true;
    }
    if (step === 2) {
      setStep(1);
      return true;
    }
    if (rerun) {
      markOnboarded();
      return true;
    }
    return false;
  }, [browsing, step, rerun, markOnboarded]);
  // Back is the Router's; it asks this first while there is a step to undo,
  // or a rerun to close (and keeps the tvOS Menu key for it until then).
  useEffect(() => {
    if (!browsing && step !== 2 && !rerun) return;
    return pushScreenBack(handleBack);
  }, [browsing, step, rerun, handleBack]);

  return (
    <View style={styles.container}>
      <GlowBackdrop surahNumber={PREVIEW_SURAH} dim={0.25} />
      <View style={styles.brand}>
        <LogoMark size={scale(34)} color={colors.text} />
        <Text style={styles.brandText}>BAYAAN</Text>
      </View>

      {step === 1 ? (
        <StepOne
          featured={featured}
          selectedId={shownId}
          returnToBrowse={returnToBrowse}
          onPick={pick}
          onBrowse={() => {
            setReturnToBrowse(true);
            setBrowsing(true);
          }}
          hidden={browsing}
        />
      ) : (
        <StepTwo onDone={markOnboarded} rerun={rerun} />
      )}

      <View style={styles.dots} pointerEvents="none">
        <View style={[styles.dot, step === 1 && styles.dotOn]} />
        <View style={[styles.dot, step === 2 && styles.dotOn]} />
      </View>

      {browsing ? (
        <ReciterPickerPanel
          title="All reciters"
          subtitle="Everything plays in this voice"
          reciters={browseList}
          selectedId={shownId}
          onSelect={pick}
          detail={reciterSubtitle}
        />
      ) : null}

      {/* Over Settings, a recitation may be playing: the player stays one
          press away (opening it ends the rerun; see endRerunForPlayer). The
          browse panel holds focus while open, so the pill steps aside. */}
      {rerun && !browsing ? <NowPlayingPill /> : null}
    </View>
  );
}

function StepOne({
  featured,
  selectedId,
  returnToBrowse,
  onPick,
  onBrowse,
  hidden,
}: {
  featured: Reciter[];
  /** Your pick, shown with the sky ring and focused. */
  selectedId: string | null;
  /** The browse panel just closed: focus its button, not a portrait. */
  returnToBrowse: boolean;
  onPick: (id: string) => void;
  onBrowse: () => void;
  /** The browse panel is open over the right side. */
  hidden: boolean;
}): React.ReactElement {
  const focusIndex = Math.max(
    0,
    featured.findIndex(r => r.id === selectedId),
  );
  return (
    <View style={[styles.step, hidden && styles.stepBesidePanel]}>
      <Text style={styles.kicker}>Welcome · Step 1 of 2</Text>
      <Text style={styles.title}>Whose recitation do you love?</Text>
      <Text style={styles.sub}>
        Everything plays in this voice. You can change it anytime.
      </Text>
      <TVFocusGuideView autoFocus style={styles.portraits}>
        {featured.map((r, i) => (
          <ReciterPortrait
            key={r.id}
            reciter={r}
            selected={r.id === selectedId}
            onSelect={() => onPick(r.id)}
            hasTVPreferredFocus={!hidden && !returnToBrowse && i === focusIndex}
          />
        ))}
      </TVFocusGuideView>
      <TVFocusGuideView autoFocus style={styles.browseRow}>
        <FocusableButton
          onPress={onBrowse}
          accessibilityLabel="Browse all reciters"
          hasTVPreferredFocus={!hidden && returnToBrowse}
          outlined
          style={styles.button}>
          <FocusText style={styles.buttonText}>Browse all reciters</FocusText>
        </FocusableButton>
      </TVFocusGuideView>
    </View>
  );
}

function ReciterPortrait({
  reciter,
  selected,
  onSelect,
  hasTVPreferredFocus,
}: {
  reciter: Reciter;
  selected: boolean;
  onSelect: () => void;
  hasTVPreferredFocus: boolean;
}): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.portrait}
      onPress={onSelect}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={
        selected ? `${reciter.name}, your reciter` : reciter.name
      }>
      <PortraitImage reciter={reciter} selected={selected} />
      {/* The short name on one line, as Home's portraits write it. */}
      <FocusText
        style={styles.portraitName}
        color={selected ? colors.text : colors.textSecondary}
        focusedColor={colors.text}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}>
        {shortReciterName(reciter.name)}
      </FocusText>
      {/* As the Reciters grid names it ("Hafs · Teaching"). */}
      <Text style={styles.portraitSub} numberOfLines={1}>
        {reciterSubtitle(reciter)}
      </Text>
    </FocusableCard>
  );
}

function PortraitImage({
  reciter,
  selected,
}: {
  reciter: Reciter;
  selected: boolean;
}): React.ReactElement {
  const focused = useButtonFocused();
  const artwork = getReciterArtwork(reciter);
  return (
    <FocusFrame
      radius={PORTRAIT / 2}
      // Your current pick wears a sky ring until focus brings the cream one.
      style={[styles.frame, selected && !focused && styles.frameSelected]}>
      {artwork ? (
        <Image
          source={artwork}
          style={styles.img}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.initial}>
            {reciter.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </FocusFrame>
  );
}

function StepTwo({
  onDone,
  rerun,
}: {
  onDone: () => void;
  /** Opened again from Settings: the button returns there. */
  rerun: boolean;
}): React.ReactElement {
  const mode = useDisplayStore(s => s.mode);
  const setMode = useDisplayStore(s => s.setMode);
  const edition = useDisplayStore(s => s.edition);
  const setEdition = useDisplayStore(s => s.setEdition);
  const languages = useMemo(translationLanguages, []);
  // The translation keeps the last one loaded while a new language loads,
  // and says so when it can't load (offline).
  const {line} = usePreviewTranslation(PREVIEW_SURAH, 1, edition);
  const currentLanguage = findTranslation(edition).language;
  const sample = {
    arabic: getArabicVerses(PREVIEW_SURAH)[0] ?? '',
    translation: line,
  };
  // Calligraphy only (from Settings) has no card: none shows as chosen, and
  // the first card takes focus, until one is picked.
  const selectedMode: OnScreenMode | null =
    mode === 'calligraphy' ? null : mode;
  // Down from the cards lands on the language in use, not the first chip.
  const [selectedChip, setSelectedChip] = useState<View | null>(null);
  const doneLabel = rerun ? 'Done' : 'Continue';

  return (
    <View style={styles.step}>
      <Text style={styles.kicker}>Welcome · Step 2 of 2</Text>
      <Text style={styles.title}>What should show while you listen?</Text>
      <Text style={styles.sub}>
        The verse being recited, on screen. You can change this from the player
        anytime.
      </Text>
      <TVFocusGuideView autoFocus style={styles.modes}>
        {MODE_CHOICES.map((choice, i) => (
          <ModeCard
            key={choice.value}
            mode={choice.value}
            label={choice.label}
            selected={selectedMode === choice.value}
            preferred={
              selectedMode === null ? i === 0 : selectedMode === choice.value
            }
            sample={sample}
            onSelect={() => setMode(choice.value)}
          />
        ))}
      </TVFocusGuideView>
      {selectedMode === 'both' || selectedMode === 'translation' ? (
        <View style={styles.languageBlock}>
          <Text style={styles.languageTitle}>Translation language</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.languageRow}>
            <TVFocusGuideView
              autoFocus
              destinations={selectedChip ? [selectedChip] : undefined}
              style={styles.languageGuide}>
              {languages.map(l => {
                const selected = l.language === currentLanguage;
                return (
                  <LanguageChip
                    key={l.edition}
                    ref={selected ? setSelectedChip : undefined}
                    label={l.language}
                    selected={selected}
                    // The language already in use keeps its translation
                    // (Hilali stays Hilali); only a new language switches.
                    onSelect={() => {
                      if (!selected) setEdition(l.edition);
                    }}
                  />
                );
              })}
            </TVFocusGuideView>
          </ScrollView>
        </View>
      ) : null}
      <TVFocusGuideView autoFocus style={styles.browseRow}>
        <FocusableButton
          onPress={onDone}
          accessibilityLabel={doneLabel}
          outlined
          style={styles.button}>
          <FocusText style={styles.buttonText}>{doneLabel}</FocusText>
        </FocusableButton>
      </TVFocusGuideView>
    </View>
  );
}

function ModeCard({
  mode,
  label,
  selected,
  preferred,
  sample,
  onSelect,
}: {
  mode: OnScreenMode;
  label: string;
  selected: boolean;
  /** Takes focus when the step opens. */
  preferred: boolean;
  sample: {arabic: string; translation: string};
  onSelect: () => void;
}): React.ReactElement {
  const showArabic = mode !== 'translation';
  const showTranslation = mode !== 'arabic';
  return (
    <FocusableCard
      style={styles.modeCard}
      focusScale={1.04}
      onPress={onSelect}
      hasTVPreferredFocus={preferred}
      accessibilityLabel={selected ? `${label}, selected` : label}>
      <View style={styles.modeSample}>
        {showArabic ? (
          <Text
            style={[
              styles.modeArabic,
              quranTextFontAvailable && {fontFamily: quranTextFontFamily},
            ]}
            numberOfLines={2}>
            {sample.arabic}
          </Text>
        ) : null}
        {showTranslation ? (
          <Text
            style={[
              styles.modeTranslation,
              !showArabic && styles.modeTranslationAlone,
            ]}
            numberOfLines={showArabic ? 2 : 3}>
            {sample.translation}
          </Text>
        ) : null}
      </View>
      <View style={styles.modeFoot}>
        <Text
          style={[styles.modeLabel, selected && styles.modeLabelOn]}
          numberOfLines={1}>
          {label}
        </Text>
        {selected ? <View style={styles.modeMark} /> : null}
      </View>
    </FocusableCard>
  );
}

function LanguageChip({
  label,
  selected,
  onSelect,
  ref,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  ref?: React.Ref<View>;
}): React.ReactElement {
  return (
    <FocusableButton
      ref={ref}
      onPress={onSelect}
      accessibilityLabel={selected ? `${label}, selected` : label}
      selected={selected}
      style={styles.chip}>
      <FocusText
        style={[
          styles.chipText,
          ARABIC_SCRIPT.test(label) && styles.chipTextArabic,
        ]}
        color={selected ? colors.text : colors.textSecondary}>
        {label}
      </FocusText>
      {selected ? <View style={styles.chipLine} /> : null}
    </FocusableButton>
  );
}

const PORTRAIT_BOX = 220;
// Portrait diameter inside the focus frame (ring 4 + gap 5 on each side).
const PORTRAIT = PORTRAIT_BOX - 18;

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  brand: {
    position: 'absolute',
    top: 64,
    left: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandText: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 2.5,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 150,
    paddingHorizontal: 96,
  },
  // Step one stays laid out as it was (no reflow), dimmed under the browse
  // panel, which covers its right side.
  stepBesidePanel: {opacity: 0.35},
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 58,
    letterSpacing: -1,
    marginTop: 14,
    textAlign: 'center',
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 24,
    marginTop: 14,
    textAlign: 'center',
    maxWidth: 1100,
  },
  portraits: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginTop: 72,
    paddingVertical: 12,
  },
  portrait: {width: PORTRAIT_BOX, alignItems: 'center', gap: 6},
  frame: {width: PORTRAIT_BOX, height: PORTRAIT_BOX, marginBottom: 10},
  frameSelected: {borderColor: colors.accent},
  img: {width: '100%', height: '100%'},
  placeholder: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.text,
    fontFamily: fonts.light,
    fontSize: 72,
    fontWeight: '300',
    opacity: 0.35,
  },
  portraitName: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 28,
    height: 28,
    textAlign: 'center',
  },
  portraitSub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
  },
  browseRow: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 34,
    paddingVertical: 15,
    borderRadius: 16,
  },
  buttonText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 21},
  dots: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  dot: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(244,243,236,0.22)',
  },
  dotOn: {backgroundColor: colors.accent},
  modes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginTop: 44,
  },
  modeCard: {
    width: 440,
    height: 290,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
  },
  modeSample: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 8,
  },
  modeArabic: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 52,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  modeTranslation: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
  },
  modeTranslationAlone: {color: colors.text, fontSize: 22, lineHeight: 32},
  modeFoot: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    alignItems: 'flex-start',
    gap: 8,
  },
  modeLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 21,
  },
  modeLabelOn: {color: colors.text},
  modeMark: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  languageBlock: {marginTop: 28, alignItems: 'center', gap: 10},
  languageTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  languageRow: {paddingHorizontal: 24, paddingVertical: 10},
  languageGuide: {flexDirection: 'row', gap: 8},
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    // The Arabic chip is a little taller; the others centre beside it.
    justifyContent: 'center',
  },
  chipText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 19},
  // Drawn by the system Arabic font, which runs small and light at the same
  // size: bigger, so its label reads as heavy as the Latin chips beside it.
  chipTextArabic: {fontSize: 25},
  chipLine: {
    position: 'absolute',
    bottom: 4,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
