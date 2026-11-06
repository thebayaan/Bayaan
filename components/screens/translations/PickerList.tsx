// @ai-generated
import React, {useCallback, useMemo, type ReactElement} from 'react';
import {View, Text, Pressable, ActivityIndicator, Alert} from 'react-native';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useBottomInset} from '@/hooks/useBottomInset';
import {moderateScale} from '@/utils/scale';
import i18n from '@/i18n';
import {localizeDigits} from '@/i18n/format';
import {usePickerStyles} from './pickerStyles';

// Flattened list items for FlashList.
interface MetaHeaderItem {
  type: 'meta-header';
  title: string;
}

interface LangHeaderItem {
  type: 'lang-header';
  title: string;
  count: number;
}

export interface RowItem {
  type: 'row';
  id: string;
  title: string;
  subtitle: string | null;
  // Installed (bundled or downloaded): a tap selects it.
  isReady: boolean;
  isDeletable: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

// Before any catalog is known: how to see more translations.
interface ConnectItem {
  type: 'connect';
}

export type FlatItem = MetaHeaderItem | LangHeaderItem | RowItem | ConnectItem;

export type RowFields = Omit<
  RowItem,
  'type' | 'isFirstInGroup' | 'isLastInGroup'
>;

// Rows drawn as one card: the first and last round its corners.
export function cardGroup(rows: readonly RowFields[]): RowItem[] {
  return rows.map((row, idx) => ({
    ...row,
    type: 'row',
    isFirstInGroup: idx === 0,
    isLastInGroup: idx === rows.length - 1,
  }));
}

export const showDownloadInProgressAlert = () =>
  Alert.alert(
    i18n.t('home:translations.downloadInProgress'),
    i18n.t('home:translations.waitForDownload'),
  );

function PickerHeaderItem({item}: {item: Exclude<FlatItem, RowItem>}) {
  const styles = usePickerStyles();
  const {t} = useTranslation('home');
  if (item.type === 'meta-header') {
    return (
      <View style={styles.metaHeaderContainer}>
        <Text style={styles.metaHeader}>{item.title}</Text>
      </View>
    );
  }
  if (item.type === 'lang-header') {
    return (
      <View style={styles.langHeaderContainer}>
        <Text style={styles.langHeader}>{item.title}</Text>
        <Text style={styles.langCount}>{localizeDigits(item.count)}</Text>
      </View>
    );
  }
  return (
    <Text style={styles.emptyText}>{t('translations.connectForMore')}</Text>
  );
}

// The selected edition, above the list.
export function ActiveCard({
  label,
  name,
  language,
}: {
  label: string;
  name: string;
  language: string;
}) {
  const styles = usePickerStyles();
  const {t} = useTranslation('home');
  return (
    <>
      <View style={styles.metaHeaderContainer}>
        <Text style={styles.metaHeader}>{label}</Text>
      </View>
      <View style={styles.activeCard}>
        <View style={styles.activeCardText}>
          <Text style={styles.activeCardName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.activeCardLanguage}>{language}</Text>
        </View>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>{t('translations.active')}</Text>
        </View>
      </View>
    </>
  );
}

interface CatalogRowProps {
  item: RowItem;
  isActive: boolean;
  isDownloading: boolean;
  // Download progress from 0 to 1; null shows the spinner alone.
  progress: number | null;
  onSelect: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CatalogRow({
  item,
  isActive,
  isDownloading,
  progress,
  onSelect,
  onDownload,
  onDelete,
}: CatalogRowProps) {
  const styles = usePickerStyles();
  const {theme} = useTheme();
  const isOnly = item.isFirstInGroup && item.isLastInGroup;
  const cardStyle = [
    styles.cardRow,
    item.isFirstInGroup && styles.cardRowFirst,
    item.isLastInGroup && styles.cardRowLast,
    !item.isFirstInGroup && !item.isLastInGroup && styles.cardRowMiddle,
    isOnly && styles.cardRowOnly,
  ];

  return (
    <View style={cardStyle}>
      <Pressable
        style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => {
          if (item.isReady) {
            onSelect(item.id);
          } else if (!isDownloading) {
            onDownload(item.id);
          }
        }}>
        <View style={styles.rowContent}>
          <Text
            style={[styles.rowName, isActive && styles.rowNameActive]}
            numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.rowNativeName} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
        {isDownloading ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color={theme.colors.text} />
            {progress !== null && (
              <Text style={styles.progressText}>
                {localizeDigits(`${Math.round(progress * 100)}%`)}
              </Text>
            )}
          </View>
        ) : item.isReady ? (
          <View style={styles.rowActions}>
            {isActive && <View style={styles.selectedDot} />}
            {item.isDeletable && (
              <Pressable
                style={styles.deleteButton}
                onPress={() => onDelete(item.id)}
                hitSlop={8}>
                <Feather
                  name="minus-circle"
                  size={moderateScale(14)}
                  color={Color(theme.colors.text).alpha(0.25).toString()}
                />
              </Pressable>
            )}
          </View>
        ) : (
          <Feather
            name="arrow-down"
            size={moderateScale(16)}
            color={Color(theme.colors.text).alpha(0.35).toString()}
          />
        )}
      </Pressable>
      {!item.isLastInGroup && <View style={styles.cardDivider} />}
    </View>
  );
}

const getItemType = (item: FlatItem) => item.type;

interface PickerListProps {
  data: FlatItem[];
  // Prefixes item keys so the two lists never share one.
  keyPrefix: string;
  header: ReactElement | null;
  emptyText: string;
  renderRow: (item: RowItem) => ReactElement;
}

export function PickerList({
  data,
  keyPrefix,
  header,
  emptyText,
  renderRow,
}: PickerListProps) {
  const styles = usePickerStyles();
  const bottomInset = useBottomInset();

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<FlatItem>) =>
      item.type === 'row' ? renderRow(item) : <PickerHeaderItem item={item} />,
    [renderRow],
  );

  const keyExtractor = useCallback(
    (item: FlatItem) => {
      if (item.type === 'meta-header' || item.type === 'lang-header') {
        return `${keyPrefix}-header-${item.title}`;
      }
      if (item.type === 'connect') return `${keyPrefix}-connect`;
      return `${keyPrefix}-${item.id}`;
    },
    [keyPrefix],
  );

  const emptyComponent = useMemo(
    () => <Text style={styles.emptyText}>{emptyText}</Text>,
    [styles, emptyText],
  );

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      getItemType={getItemType}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: bottomInset + moderateScale(20),
      }}
      ListEmptyComponent={emptyComponent}
    />
  );
}
