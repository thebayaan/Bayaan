import React, {useEffect} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {LogoMark} from '../brand/LogoMark';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {refreshReciters, useCatalogState} from '../../hooks/useReciters';
import {seedDefaultReciter} from '../../services/tvDataService';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';

/**
 * Holds the app until the reciter catalog is here. The TV ships no reciter
 * data, so the first launch waits for the Bayaan API; after that the stored
 * catalog opens the app at once, online or not. With no catalog and no
 * connection it says so, with a way to try again.
 */
export function CatalogGate({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const state = useCatalogState();

  // The launch seed finds no list on a first run; seed once it arrives.
  useEffect(() => {
    if (state === 'ready') void seedDefaultReciter();
  }, [state]);

  if (state === 'ready') return <>{children}</>;
  return (
    <View style={styles.root}>
      <LogoMark size={scale(96)} color={colors.text} />
      {state === 'loading' ? (
        <ActivityIndicator
          size="large"
          color={colors.textSecondary}
          style={styles.spinner}
        />
      ) : (
        <>
          <Text style={styles.title}>Can't reach Bayaan</Text>
          <Text style={styles.body}>
            The reciters load from the internet the first time you open the
            app. Check the TV's connection, then try again.
          </Text>
          <FocusableButton
            onPress={() => void refreshReciters()}
            hasTVPreferredFocus
            outlined
            accessibilityLabel="Try again"
            style={styles.button}>
            <FocusText style={styles.buttonText}>Try again</FocusText>
          </FocusableButton>
        </>
      )}
    </View>
  );
}

const styles = createScaledStyles({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 240,
  },
  spinner: {marginTop: 48},
  title: {
    marginTop: 40,
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 44,
    textAlign: 'center',
  },
  body: {
    marginTop: 16,
    maxWidth: 900,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 26,
    lineHeight: 38,
    textAlign: 'center',
  },
  button: {
    marginTop: 40,
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 16,
  },
  buttonText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 24},
});
