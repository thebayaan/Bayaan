import React from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import {useRouter} from 'expo-router';
import {Category} from '@/data/categories';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {TouchableOpacity} from 'react-native-gesture-handler';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';

interface CategoryScreenProps {
  category: Category;
  backgroundColor: string;
  icon: {
    name: string;
    type: string;
  };
}

export function CategoryScreen({
  category,
  backgroundColor,
  icon,
}: CategoryScreenProps) {
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  const handleSurahPress = (surahId: number) => {
    router.push(`/surah/${surahId}`);
  };

  const renderItem = ({
    item: surah,
    index,
  }: {
    item: Category['surahs'][0];
    index: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(index * 50)}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSurahPress(surah.id)}
        style={[
          styles.surahItem,
          {
            backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
            borderColor: Color(theme.colors.border).alpha(0.1).toString(),
          },
        ]}>
        <View style={styles.surahNumberContainer}>
          <Text style={[styles.surahNumber, {color: theme.colors.text}]}>
            {surah.id}
          </Text>
        </View>
        <View style={styles.surahInfo}>
          <Text style={[styles.surahName, {color: theme.colors.text}]}>
            {surah.name}
          </Text>
          {surah.verses && (
            <Text
              style={[styles.surahVerses, {color: theme.colors.textSecondary}]}>
              {surah.verses} verses
            </Text>
          )}
          {surah.period && (
            <Text
              style={[styles.surahPeriod, {color: theme.colors.textSecondary}]}>
              {surah.period}
            </Text>
          )}
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor,
            paddingTop: insets.top + moderateScale(16),
          },
        ]}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={'#FFFFFF'} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Feather
            name={icon.name as any}
            size={24}
            color={'#FFFFFF'}
            style={styles.titleIcon}
          />
          <Text style={[styles.title, {color: '#FFFFFF'}]}>
            {category.title}
          </Text>
        </View>
        {category.description && (
          <Text style={[styles.description, {color: '#FFFFFF'}]}>
            {category.description}
          </Text>
        )}
      </View>

      <FlatList
        data={category.surahs}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          {paddingBottom: insets.bottom + moderateScale(20)},
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(16),
    position: 'relative',
  },
  backButton: {
    padding: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: moderateScale(16),
    zIndex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  titleIcon: {
    marginRight: moderateScale(12),
  },
  title: {
    fontSize: moderateScale(24),
    fontFamily: 'Manrope-Bold',
  },
  description: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    opacity: 0.8,
  },
  listContent: {
    padding: moderateScale(16),
  },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    marginBottom: moderateScale(8),
    borderWidth: 1,
  },
  surahNumberContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  surahNumber: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
  },
  surahInfo: {
    flex: 1,
  },
  surahName: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: moderateScale(4),
  },
  surahVerses: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
  },
  surahPeriod: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    textTransform: 'capitalize',
  },
});
