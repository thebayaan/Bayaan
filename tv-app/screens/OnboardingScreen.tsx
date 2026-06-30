import React, {useMemo} from 'react';
import {Image} from 'expo-image';
import {ScrollView, StyleSheet, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {useOnboarded} from '../hooks/useOnboarded';
import {useReciters} from '../hooks/useReciters';
import type {Reciter} from '../types/reciter';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';

export function OnboardingScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const {defaultReciterId, setDefaultReciter} = useDefaultReciter();
  const {markOnboarded} = useOnboarded();

  const options = useMemo(() => {
    const featured = reciters.filter(r => r.is_featured);
    if (featured.length >= 8) return featured.slice(0, 12);
    return reciters.slice(0, 12);
  }, [reciters]);

  function pick(id: string): void {
    setDefaultReciter(id);
  }

  function finish(): void {
    markOnboarded();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>WELCOME TO BAYAAN</Text>
        <Text style={styles.title}>Pick a reciter to start with</Text>
        <Text style={styles.sub}>
          You can change this anytime in Settings. Your pick becomes the default
          when you tap Quick Play on the home page.
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {options.map((r, i) => (
          <ReciterChoice
            key={r.id}
            reciter={r}
            selected={defaultReciterId === r.id}
            onSelect={() => pick(r.id)}
            hasTVPreferredFocus={i === 0}
          />
        ))}
      </ScrollView>
      <TVFocusGuideView autoFocus style={styles.actions}>
        <FocusableButton
          onPress={finish}
          accessibilityLabel={defaultReciterId ? 'Continue' : 'Skip for now'}
          style={[styles.cta, defaultReciterId && styles.ctaActive]}>
          <Text
            style={[styles.ctaText, defaultReciterId && styles.ctaTextActive]}>
            {defaultReciterId ? 'Continue' : 'Skip for now'}
          </Text>
        </FocusableButton>
      </TVFocusGuideView>
    </View>
  );
}

type ChoiceProps = {
  reciter: Reciter;
  selected: boolean;
  onSelect: () => void;
  hasTVPreferredFocus: boolean;
};

function reciterSubtitle(reciter: Reciter): string {
  const count = reciter.rewayat.length;
  if (count === 0) return '';
  if (count === 1) return reciter.rewayat[0].name;
  return `${count} rewayat`;
}

function ReciterChoice({
  reciter,
  selected,
  onSelect,
  hasTVPreferredFocus,
}: ChoiceProps): React.ReactElement {
  const subtitle = reciterSubtitle(reciter);
  return (
    <FocusableCard
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={reciter.name}>
      <View style={styles.artwork}>
        {reciter.image_url ? (
          <Image
            source={{uri: reciter.image_url}}
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
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {reciter.name}
        </Text>
        {selected ? (
          <Text style={styles.selectedTag}>SELECTED</Text>
        ) : subtitle ? (
          <Text style={styles.cardSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </FocusableCard>
  );
}

const CARD_W = 240;
const CARD_H = 320;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 80,
    paddingBottom: spacing.xl,
  },
  header: {paddingHorizontal: spacing.xxl, marginBottom: spacing.xl, gap: 6},
  kicker: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    ...typography.titleXL,
    letterSpacing: -0.8,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
    maxWidth: 820,
    opacity: 0.8,
    marginTop: 10,
  },
  rail: {
    paddingHorizontal: spacing.xxl,
    gap: 20,
    paddingVertical: spacing.md,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardSelected: {borderColor: colors.text},
  artwork: {flex: 1, backgroundColor: colors.surfaceElevated},
  img: {width: '100%', height: '100%'},
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.text,
    fontFamily: fonts.light,
    fontSize: 84,
    fontWeight: '300',
    opacity: 0.35,
  },
  meta: {paddingHorizontal: 14, paddingVertical: 12},
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.65,
    marginTop: 4,
  },
  selectedTag: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    opacity: 0.85,
    marginTop: 4,
  },
  actions: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  cta: {
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ctaActive: {backgroundColor: colors.text},
  ctaText: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ctaTextActive: {color: colors.background},
});
