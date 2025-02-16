import React from 'react';
import {View, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LoveButton} from './LoveButton';

export const AdditionalControls = () => {
  return (
    <View style={styles.container}>
      <LoveButton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: moderateScale(10),
  },
});
