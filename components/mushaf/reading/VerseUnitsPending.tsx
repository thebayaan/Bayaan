// @ai-generated
import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import type {RewayahVerseUnitsStatus} from '@/hooks/useRewayahVerseUnits';
import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

/**
 * In place of the verse rows of a non-Hafs mushaf (list and reading modes)
 * while its verse units are not ready: a spinner while its words load, else
 * a short message. Never the Hafs verse rows meanwhile: they would show Hafs
 * verses and numbers under the rewayah's name. Same wording as the player's
 * verse list.
 */
export function VerseUnitsPending({
  status,
  rewayah,
  color,
}: {
  status: RewayahVerseUnitsStatus;
  rewayah: RewayahId;
  color: string;
}) {
  return (
    <View style={styles.pending} testID="verse-units-pending">
      {status === 'loading' ? (
        <ActivityIndicator
          size="small"
          color={color}
          accessibilityLabel={`Loading the ${getShortLabel(rewayah)} verses`}
        />
      ) : (
        <Text style={[styles.pendingText, {color}]}>
          {`Couldn't load the ${getShortLabel(rewayah)} verses.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pending: {
    flex: 1,
    width: '100%',
    minHeight: moderateScale(160),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(24),
  },
  pendingText: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(13),
    textAlign: 'center',
  },
});
