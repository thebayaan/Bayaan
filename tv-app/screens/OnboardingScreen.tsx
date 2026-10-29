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
import {SidePanel} from '../components/listening/SidePanel';
import {GlowBackdrop} from '../components/listening/GlowBackdrop';
import {LogoMark} from '../components/brand/LogoMark';
import {useOnboarded} from '../hooks/useOnboarded';
import {useReciters} from '../hooks/useReciters';
import {useVerseSync} from '../hooks/useVerseSync';
import {useTVBackHandler} from '../hooks/useTVBackHandler';
import {setTVMenuKeyEnabled} from '../hooks/tvMenuKey';
import {useSettingsStore} from '../store/settingsStore';
import {
  findTranslation,
  translationLanguages,
  useDisplayStore,
  type OnScreenMode,
} from '../store/displayStore';
import {getReciterArtwork} from '../services/reciterArtwork';
import {popularReciters} from '../services/listeningChoices';
import type {Reciter} from '../types/reciter';
import {colors} from '../theme/colors';
import {quranTextFontAvailable} from '../theme/calligraphy';
import {fonts, quranTextFontFamily} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

/** Portraits on the first step. */
const FEATURED_COUNT = 6;
/** Reciters in the "Browse all reciters" panel. */
const BROWSE_LIMIT = 80;
/** The verse the step-two cards preview (Al-Mulk 1). */
const PREVIEW_SURAH = 67;
const FALLBACK_TRANSLATION = 'Blessed is He in whose hand is dominion…';

const MODE_CHOICES: readonly {value: OnScreenMode; label: string}[] = [
  {value: 'both', label: 'Arabic + translation'},
  {value: 'arabic', label: 'Arabic'},
  {value: 'translation', label: 'Translation'},
];

function styleLabel(reciter: Reciter): string {
  const style = reciter.rewayat[0]?.style.trim() ?? '';
  return style ? style.charAt(0).toUpperCase() + style.slice(1) : '';
}

/**
 * First launch in two steps, then Home: whose voice everything plays in
 * (round portraits of the best-known reciters, or the full list), and what
 * the listening room shows (Arabic, translation or both, and in which
 * language). Back on step two returns to step one.
 */
export function OnboardingScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const {markOnboarded} = useOnboarded();
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const [step, setStep] = useState<1 | 2>(1);
  const [browsing, setBrowsing] = useState(false);
  // The portrait to focus when coming back to step one.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const featured = useMemo(
    () =>
      popularReciters(
        reciters,
        FEATURED_COUNT,
        r => getReciterArtwork(r) !== null,
      ),
    [reciters],
  );

  const pick = (id: string): void => {
    setDefaultReciterId(id);
    setPickedId(id);
    setBrowsing(false);
    setStep(2);
  };

  const handleBack = useCallback((): boolean => {
    if (browsing) {
      setBrowsing(false);
      return true;
    }
    if (step === 2) {
      setStep(1);
      return true;
    }
    return false;
  }, [browsing, step]);
  useTVBackHandler(handleBack, browsing || step === 2);
  // Home opens as a root place, where the Menu key leaves the app again.
  useEffect(() => () => setTVMenuKeyEnabled(false), []);

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
          selectedId={defaultReciterId}
          focusId={pickedId}
          onPick={pick}
          onBrowse={() => setBrowsing(true)}
          hidden={browsing}
        />
      ) : (
        <StepTwo onDone={markOnboarded} />
      )}

      <View style={styles.dots} pointerEvents="none">
        <View style={[styles.dot, step === 1 && styles.dotOn]} />
        <View style={[styles.dot, step === 2 && styles.dotOn]} />
      </View>

      {browsing ? (
        <SidePanel
          title="All reciters"
          onActivity={noop}
          sections={[
            {
              title: 'Everything plays in this voice',
              options: reciters.slice(0, BROWSE_LIMIT).map(r => ({
                value: r.id,
                label: r.name,
                detail: styleLabel(r) || undefined,
                face: {source: getReciterArtwork(r), name: r.name},
              })),
              selected: defaultReciterId,
              onSelect: pick,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function noop(): void {}

function StepOne({
  featured,
  selectedId,
  focusId,
  onPick,
  onBrowse,
  hidden,
}: {
  featured: Reciter[];
  selectedId: string | null;
  focusId: string | null;
  onPick: (id: string) => void;
  onBrowse: () => void;
  /** The browse panel is open over the right side. */
  hidden: boolean;
}): React.ReactElement {
  const focusIndex = Math.max(
    0,
    featured.findIndex(r => r.id === focusId),
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
            hasTVPreferredFocus={!hidden && i === focusIndex}
          />
        ))}
      </TVFocusGuideView>
      <TVFocusGuideView autoFocus style={styles.browseRow}>
        <FocusableButton
          onPress={onBrowse}
          accessibilityLabel="Browse all reciters"
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
      <FocusText
        style={styles.portraitName}
        color={selected ? colors.text : colors.textSecondary}
        focusedColor={colors.text}
        numberOfLines={1}>
        {reciter.name}
      </FocusText>
      <Text style={styles.portraitSub} numberOfLines={1}>
        {styleLabel(reciter)}
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

function StepTwo({onDone}: {onDone: () => void}): React.ReactElement {
  const mode = useDisplayStore(s => s.mode);
  const setMode = useDisplayStore(s => s.setMode);
  const edition = useDisplayStore(s => s.edition);
  const setEdition = useDisplayStore(s => s.setEdition);
  const languages = useMemo(translationLanguages, []);
  const {arabic, translation} = useVerseSync(
    PREVIEW_SURAH,
    undefined,
    '',
    edition,
  );
  const currentLanguage = findTranslation(edition).language;
  const sample = {
    arabic: arabic[0] ?? '',
    translation:
      translation?.[0] ?? (edition === 'en.sahih' ? FALLBACK_TRANSLATION : ''),
  };
  // Calligraphy-only from Settings counts as Arabic here.
  const selectedMode: OnScreenMode = mode === 'calligraphy' ? 'arabic' : mode;

  return (
    <View style={styles.step}>
      <Text style={styles.kicker}>Welcome · Step 2 of 2</Text>
      <Text style={styles.title}>What should show while you listen?</Text>
      <Text style={styles.sub}>
        The verse being recited, on screen. You can change this from the player
        anytime.
      </Text>
      <TVFocusGuideView autoFocus style={styles.modes}>
        {MODE_CHOICES.map(choice => (
          <ModeCard
            key={choice.value}
            mode={choice.value}
            label={choice.label}
            selected={selectedMode === choice.value}
            sample={sample}
            onSelect={() => setMode(choice.value)}
          />
        ))}
      </TVFocusGuideView>
      {selectedMode !== 'arabic' ? (
        <View style={styles.languageBlock}>
          <Text style={styles.languageTitle}>Translation language</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.languageRow}>
            <TVFocusGuideView autoFocus style={styles.languageGuide}>
              {languages.map(l => (
                <LanguageChip
                  key={l.edition}
                  label={l.language}
                  selected={l.language === currentLanguage}
                  onSelect={() => setEdition(l.edition)}
                />
              ))}
            </TVFocusGuideView>
          </ScrollView>
        </View>
      ) : null}
      <TVFocusGuideView autoFocus style={styles.browseRow}>
        <FocusableButton
          onPress={onDone}
          accessibilityLabel="Start listening"
          outlined
          style={styles.button}>
          <FocusText style={styles.buttonText}>Start listening</FocusText>
        </FocusableButton>
      </TVFocusGuideView>
    </View>
  );
}

function ModeCard({
  mode,
  label,
  selected,
  sample,
  onSelect,
}: {
  mode: OnScreenMode;
  label: string;
  selected: boolean;
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
      hasTVPreferredFocus={selected}
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
            numberOfLines={3}>
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
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onSelect}
      accessibilityLabel={selected ? `${label}, selected` : label}
      style={styles.chip}>
      <FocusText
        style={styles.chipText}
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
  // Keeps step one visible left of the browse panel.
  stepBesidePanel: {paddingRight: 620 + 48, opacity: 0.35},
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
  },
  portraitSub: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 17,
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
    height: 220,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
  },
  modeSample: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
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
    fontSize: 17,
    lineHeight: 24,
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
    fontSize: 14,
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
  },
  chipText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 19},
  chipLine: {
    position: 'absolute',
    bottom: 4,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
