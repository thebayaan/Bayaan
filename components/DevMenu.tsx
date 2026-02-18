import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {quickTestWhatsNew, logVersionState} from '@/utils/devUtils';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {WhatsNewModalRef} from '@/components/modals/WhatsNewOnboarding';
import Color from 'color';

interface DevMenuProps {
  whatsNewModalRef?: React.RefObject<WhatsNewModalRef | null>;
}

export function DevMenu({whatsNewModalRef}: DevMenuProps) {
  const {theme} = useTheme();
  const [visible, setVisible] = useState(false);
  const [pressedItem, setPressedItem] = useState<string | null>(null);

  if (!__DEV__) return null;

  async function handleTestWhatsNew() {
    await quickTestWhatsNew();
    Alert.alert(
      "What's New Test",
      'Version tracking has been reset. Restart the app to see the modal.',
      [{text: 'OK'}],
    );
  }

  async function handleLogVersion() {
    await logVersionState();
    Alert.alert('Version State', 'Check console for details', [{text: 'OK'}]);
  }

  function handleShowModal() {
    setVisible(false);
    whatsNewModalRef?.current?.show();
  }

  return (
    <View style={styles.devMenuContainer}>
      <TouchableOpacity
        activeOpacity={1}
        style={[
          styles.devButton,
          {
            backgroundColor: Color(theme.colors.text).alpha(0.9).toString(),
          },
          pressedItem === 'toggle' && styles.devButtonPressed,
        ]}
        onPress={() => setVisible(!visible)}
        onPressIn={() => setPressedItem('toggle')}
        onPressOut={() => setPressedItem(null)}>
        <Text style={[styles.devButtonText, {color: theme.colors.background}]}>
          🛠️
        </Text>
      </TouchableOpacity>

      {visible && (
        <View
          style={[
            styles.devMenu,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              shadowColor: theme.colors.text,
            },
          ]}>
          <Text style={[styles.devTitle, {color: theme.colors.text}]}>
            Developer Tools
          </Text>

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.devMenuItem,
              {
                backgroundColor:
                  pressedItem === 'showModal'
                    ? Color(theme.colors.text).alpha(0.08).toString()
                    : 'transparent',
              },
            ]}
            onPress={handleShowModal}
            onPressIn={() => setPressedItem('showModal')}
            onPressOut={() => setPressedItem(null)}>
            <Text style={[styles.devMenuText, {color: theme.colors.text}]}>
              ✨ Show What&apos;s New Now
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.devMenuItem,
              {
                backgroundColor:
                  pressedItem === 'whatsNew'
                    ? Color(theme.colors.text).alpha(0.08).toString()
                    : 'transparent',
              },
            ]}
            onPress={handleTestWhatsNew}
            onPressIn={() => setPressedItem('whatsNew')}
            onPressOut={() => setPressedItem(null)}>
            <Text style={[styles.devMenuText, {color: theme.colors.text}]}>
              🔄 Test What&apos;s New Modal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.devMenuItem,
              {
                backgroundColor:
                  pressedItem === 'logVersion'
                    ? Color(theme.colors.text).alpha(0.08).toString()
                    : 'transparent',
              },
            ]}
            onPress={handleLogVersion}
            onPressIn={() => setPressedItem('logVersion')}
            onPressOut={() => setPressedItem(null)}>
            <Text style={[styles.devMenuText, {color: theme.colors.text}]}>
              📊 Log Version State
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.devMenuItem,
              {
                backgroundColor:
                  pressedItem === 'clearLayoutCache'
                    ? Color(theme.colors.text).alpha(0.08).toString()
                    : 'transparent',
              },
            ]}
            onPress={() => {
              mushafLayoutCacheService.clearAll();
              Alert.alert(
                'Layout Cache Cleared',
                'MMKV mushaf layout cache has been wiped. Reopen the Mushaf tab to recompute on-demand.',
                [{text: 'OK'}],
              );
            }}
            onPressIn={() => setPressedItem('clearLayoutCache')}
            onPressOut={() => setPressedItem(null)}>
            <Text style={[styles.devMenuText, {color: theme.colors.text}]}>
              🗑️ Clear Layout Cache
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.divider,
              {backgroundColor: Color(theme.colors.text).alpha(0.1).toString()},
            ]}
          />

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.devMenuItem,
              {
                backgroundColor:
                  pressedItem === 'close'
                    ? Color(theme.colors.text).alpha(0.08).toString()
                    : 'transparent',
              },
            ]}
            onPress={() => setVisible(false)}
            onPressIn={() => setPressedItem('close')}
            onPressOut={() => setPressedItem(null)}>
            <Text
              style={[styles.devMenuText, {color: theme.colors.textSecondary}]}>
              ✕ Close
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  devMenuContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 9999,
  },
  devButton: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  devButtonPressed: {
    opacity: 0.8,
  },
  devButtonText: {
    fontSize: moderateScale(20),
  },
  divider: {
    height: 1,
    marginVertical: moderateScale(8),
  },
  devMenu: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    width: moderateScale(220),
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 4.84,
    elevation: 8,
  },
  devTitle: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(8),
  },
  devMenuItem: {
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(8),
    marginBottom: moderateScale(4),
  },
  devMenuText: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
  },
});
