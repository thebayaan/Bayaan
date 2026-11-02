// @ai-generated
import React, {useState, useCallback, useDeferredValue, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Dimensions,
  type ListRenderItemInfo,
} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {FlatList} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SearchInput} from '@/components/SearchInput';
import {ReciterImage} from '@/components/ReciterImage';
import {useTranslation} from 'react-i18next';
import {
  createSearchIndex,
  type SearchField,
} from '@/utils/search/createSearchIndex';

export interface ReciterPickerItem {
  id: string;
  name: string;
  imageUrl: string | null;
  subtitle: string;
  // Extra strings matched by search besides the name (e.g. English and Arabic
  // names, rewayah names).
  searchTerms: string[];
}

interface ReciterPickerSheetProps {
  sheetId: string;
  title: string;
  subtitle?: string;
  items: ReciterPickerItem[];
  selectedIds: ReadonlySet<string>;
  onSelect: (item: ReciterPickerItem) => void;
  // Renders a Done button in the header when provided.
  onDone?: () => void;
}

const PICKER_FIELDS: readonly SearchField<ReciterPickerItem>[] = [
  {get: item => item.name, weight: 1},
  {get: item => item.searchTerms, weight: 0.9},
];

export function ReciterPickerSheet({
  sheetId,
  title,
  subtitle,
  items,
  selectedIds,
  onSelect,
  onDone,
}: ReciterPickerSheetProps): React.ReactElement {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['sheets', 'common']);
  const [searchQuery, setSearchQuery] = useState('');

  const searchIndex = useMemo(
    () => createSearchIndex(items, {fields: PICKER_FIELDS}),
    [items],
  );
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredItems = useMemo(
    () =>
      deferredQuery.trim()
        ? searchIndex.search(deferredQuery).map(hit => hit.item)
        : items,
    [items, searchIndex, deferredQuery],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<ReciterPickerItem>) => {
      const isSelected = selectedIds.has(item.id);

      return (
        <Pressable
          style={({pressed}) => [
            styles.reciterRow,
            pressed && styles.reciterRowPressed,
          ]}
          onPress={() => onSelect(item)}>
          <View style={styles.reciterImageContainer}>
            <ReciterImage
              imageUrl={item.imageUrl || undefined}
              reciterName={item.name}
              style={styles.reciterImage}
              profileIconSize={moderateScale(20)}
            />
          </View>
          <View style={styles.reciterInfo}>
            <Text style={styles.reciterName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.reciterDetail} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
          <View
            style={[
              styles.checkCircle,
              isSelected && styles.checkCircleActive,
            ]}>
            {isSelected && (
              <Feather
                name="check"
                size={moderateScale(14)}
                color={theme.colors.text}
              />
            )}
          </View>
        </Pressable>
      );
    },
    [selectedIds, onSelect, styles, theme.colors.text],
  );

  return (
    <ActionSheet
      id={sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        {onDone ? (
          <Pressable style={styles.headerSide} onPress={onDone} hitSlop={8}>
            <Text style={styles.doneButtonText}>
              {t('common:actions.done')}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <SearchInput
            placeholder={t('reciterPicker.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
            borderColor={Color(theme.colors.text).alpha(0.06).toString()}
            iconColor={theme.colors.textSecondary}
            textColor={theme.colors.text}
            showCancelButton={false}
            containerStyle={styles.searchInputContainer}
            autoCapitalize="none"
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
          />
        </View>

        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('reciterPicker.empty')}</Text>
            </View>
          }
        />
      </View>
    </ActionSheet>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.85,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    headerSide: {
      width: moderateScale(50),
      alignItems: 'flex-end',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      gap: moderateScale(4),
    },
    headerTitle: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    doneButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    container: {
      flex: 1,
      paddingHorizontal: moderateScale(16),
    },
    searchContainer: {
      paddingVertical: moderateScale(8),
    },
    searchInputContainer: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      width: '100%',
    },
    listContainer: {
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(40),
      gap: moderateScale(6),
    },
    reciterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(12),
    },
    reciterRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    reciterImageContainer: {
      width: moderateScale(46),
      height: moderateScale(46),
      borderRadius: moderateScale(23),
      overflow: 'hidden',
      marginRight: moderateScale(12),
    },
    reciterImage: {
      width: moderateScale(46),
      height: moderateScale(46),
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: moderateScale(2),
    },
    reciterDetail: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    checkCircle: {
      width: moderateScale(26),
      height: moderateScale(26),
      borderRadius: moderateScale(13),
      borderWidth: moderateScale(1.5),
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: moderateScale(8),
    },
    checkCircleActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    emptyContainer: {
      padding: moderateScale(40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
