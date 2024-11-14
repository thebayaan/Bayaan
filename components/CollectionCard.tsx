import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';

interface CollectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
  icon,
  title,
  subtitle,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: moderateScale(20),
    },
    iconContainer: {
      width: moderateScale(100),
      height: moderateScale(100),
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: moderateScale(10),
    },
    subtitle: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      marginTop: moderateScale(5),
    },
  });
