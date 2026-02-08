import {ScaledSheet} from 'react-native-size-matters';
import {createTheme} from './theme';

const defaultTheme = createTheme('light', 'Green');

export const commonStyles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultTheme.colors.background,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: '20@s',
  },
  title: {
    fontSize: '24@s',
    fontWeight: 'bold',
    marginBottom: '20@vs',
    color: defaultTheme.colors.text,
  },
});
