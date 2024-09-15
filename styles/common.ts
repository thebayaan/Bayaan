import {ScaledSheet} from 'react-native-size-matters';
import {theme} from './theme';

export const commonStyles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    color: theme.colors.text,
  },
});
