import React from 'react';
import {View, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ProgressBar} from './ProgressBar';
import {Controls} from './Controls';

export const PlaybackControls = () => {
  return (
    <View style={styles.container}>
      <View style={styles.progressBarContainer}>
        <ProgressBar />
      </View>
      <View style={styles.controlsContainer}>
        <Controls />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: moderateScale(16),
  },
  progressBarContainer: {
    marginBottom: moderateScale(16),
  },
  controlsContainer: {
    width: '100%',
  },
});
