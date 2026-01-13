import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Icon} from '@rneui/base';
import {ChangelogEntry} from '@/types/changelog';
import changelogData from '@/data/changelog.json';
import {hasVersionChanged, markVersionAsSeen} from '@/utils/versionUtils';
import Animated, {FadeIn, ZoomIn} from 'react-native-reanimated';

const {width} = Dimensions.get('window');

export interface WhatsNewModalRef {
  show: () => void;
}

export const WhatsNewModal = forwardRef<WhatsNewModalRef>((props, ref) => {
  const {theme} = useTheme();
  const [visible, setVisible] = useState(false);
  const [currentChangelog, setCurrentChangelog] =
    useState<ChangelogEntry | null>(null);
  const [pressedButton, setPressedButton] = useState(false);

  // Expose show method to parent components
  useImperativeHandle(ref, () => ({
    show: () => {
      if (changelogData.length > 0) {
        const latestChangelog = changelogData[0] as ChangelogEntry;
        setCurrentChangelog(latestChangelog);
        setVisible(true);
      }
    },
  }));

  useEffect(() => {
    async function checkAndShowWhatsNew() {
      try {
        console.log('[WhatsNewModal] Checking if should show...');
        const versionChanged = await hasVersionChanged();
        console.log('[WhatsNewModal] Version changed:', versionChanged);
        console.log('[WhatsNewModal] Changelog entries:', changelogData.length);

        if (versionChanged && changelogData.length > 0) {
          const latestChangelog = changelogData[0] as ChangelogEntry;
          setCurrentChangelog(latestChangelog);
          console.log(
            '[WhatsNewModal] Will show modal for version:',
            latestChangelog.version,
          );

          setTimeout(() => {
            console.log('[WhatsNewModal] Opening modal...');
            setVisible(true);
          }, 800);
        } else {
          console.log('[WhatsNewModal] Not showing modal');
        }
      } catch (error) {
        console.error('[WhatsNewModal] Error checking version:', error);
      }
    }

    checkAndShowWhatsNew();
  }, []);

  function handleClose() {
    setVisible(false);
    markVersionAsSeen();
  }

  if (!currentChangelog) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          entering={ZoomIn.duration(300).springify()}
          style={[
            styles.modalContainer,
            {backgroundColor: theme.colors.backgroundSecondary},
          ]}>
          <Animated.View entering={FadeIn.delay(150)} style={styles.content}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
            />

            <Text style={[styles.title, {color: theme.colors.text}]}>
              What&apos;s new in <Text style={styles.bayaanText}>Bayaan</Text>
            </Text>

            <Text style={[styles.version, {color: theme.colors.textSecondary}]}>
              Version {currentChangelog.version}
            </Text>

            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}>
              <View style={styles.highlightsContainer}>
                {currentChangelog.highlights.map((highlight, index) => (
                  <View key={index} style={styles.highlightCard}>
                    <Icon
                      name={highlight.icon}
                      type="ionicon"
                      size={moderateScale(26)}
                      color={theme.colors.text}
                    />
                    <View style={styles.highlightTextContainer}>
                      <Text
                        style={[
                          styles.highlightTitle,
                          {color: theme.colors.text},
                        ]}>
                        {highlight.title}
                      </Text>
                      <Text
                        style={[
                          styles.highlightDescription,
                          {color: theme.colors.textSecondary},
                        ]}>
                        {highlight.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.button,
                {backgroundColor: theme.colors.text},
                pressedButton && styles.buttonPressed,
              ]}
              onPress={handleClose}
              onPressIn={() => setPressedButton(true)}
              onPressOut={() => setPressedButton(false)}>
              <Text
                style={[styles.buttonText, {color: theme.colors.background}]}>
                Continue
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
});

WhatsNewModal.displayName = 'WhatsNewModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: width - moderateScale(48),
    maxWidth: moderateScale(400),
    borderRadius: moderateScale(24),
    padding: moderateScale(32),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 24,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(24),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  bayaanText: {
    color: '#8dc9d6',
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(26),
  },
  version: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    marginBottom: moderateScale(16),
  },
  scrollView: {
    width: '100%',
    maxHeight: moderateScale(380),
  },
  scrollContent: {
    paddingBottom: moderateScale(8),
  },
  highlightsContainer: {
    width: '100%',
    gap: moderateScale(16),
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: moderateScale(12),
    gap: moderateScale(14),
  },
  highlightTextContainer: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(4),
  },
  highlightDescription: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
    lineHeight: moderateScale(18),
    opacity: 0.7,
  },
  button: {
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(32),
    borderRadius: moderateScale(12),
    width: '100%',
    alignItems: 'center',
    marginTop: moderateScale(16),
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
  },
});
