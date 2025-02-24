import React, {useState} from 'react';
import {
  View,
  Text,
  Alert,
  TextInput,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {signOut, deleteAccount} from '@/services/auth';
import {useAuthStore} from '@/store/authStore';
import {Icon} from '@rneui/base';
import Animated, {FadeInDown, FadeIn, FadeOut} from 'react-native-reanimated';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur';

export default function AccountScreen() {
  const {theme} = useTheme();
  const {isSigningOut, setSigningOut} = useAuthStore();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  // Custom colors for different levels of danger
  const dangerColors = {
    warning: '#FF6B6B', // Softer red for less dangerous actions
    critical: '#FF0000', // Bright red for critical actions
  };

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      const {success, error} = await signOut();

      if (!success) {
        console.error('Logout failed:', error);
        Alert.alert('Error', 'Failed to logout. Please try again.');
        return;
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setShowPasswordInput(true),
        },
      ],
    );
  };

  const handleConfirmDelete = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const {success, error} = await deleteAccount(password);

      if (!success) {
        Alert.alert(
          'Error',
          error || 'Failed to delete account. Please try again.',
        );
        return;
      }
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowPasswordInput(false);
      setPassword('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top}]}>
        <BlurView
          blurAmount={10}
          blurType={theme.isDarkMode ? 'dark' : 'light'}
          style={[styles.blurContainer]}>
          <View
            style={[
              styles.overlay,
              {
                backgroundColor: theme.colors.background,
              },
            ]}
          />
        </BlurView>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => router.back()}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
            Account
          </Text>
        </View>
      </View>
      <ScrollView
        style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}
        contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Account Management</Text>
          <Text style={styles.description}>
            Manage your account settings and preferences
          </Text>
        </Animated.View>

        {showPasswordInput ? (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.passwordSection}>
            <Text style={styles.passwordLabel}>
              Please enter your password to confirm account deletion
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.iconWrapper}>
                <Icon
                  name="lock"
                  type="feather"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </View>
            </View>
            <View style={styles.passwordButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowPasswordInput(false);
                  setPassword('');
                }}
                style={styles.cancelButton}
                textStyle={styles.buttonText}
                size="medium"
              />
              <Button
                title="Confirm Delete"
                onPress={handleConfirmDelete}
                loading={isDeletingAccount}
                disabled={isDeletingAccount || !password}
                style={styles.confirmDeleteButton}
                textStyle={styles.buttonText}
                size="medium"
              />
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={styles.buttonContainer}>
            <Pressable
              style={({pressed}) => [
                styles.actionButton,
                {backgroundColor: dangerColors.warning},
                pressed && styles.buttonPressed,
              ]}
              onPress={handleLogout}
              disabled={isSigningOut}>
              <View style={styles.iconWrapper}>
                <Icon name="log-out" type="feather" size={20} color="white" />
              </View>
              <Text style={styles.actionButtonText}>
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [
                styles.actionButton,
                {backgroundColor: dangerColors.critical},
                pressed && styles.buttonPressed,
              ]}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}>
              <View style={styles.iconWrapper}>
                <Icon name="trash-2" type="feather" size={20} color="white" />
              </View>
              <Text style={styles.actionButtonText}>Delete Account</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    blurContainer: {
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.85,
    },
    headerContent: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      marginRight: moderateScale(16),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      flex: 1,
      textAlign: 'center',
      marginRight: moderateScale(40),
    },
    content: {
      flex: 1,
    },
    section: {
      marginVertical: moderateScale(20),
      backgroundColor: theme.colors.card,
      padding: moderateScale(20),
      borderRadius: moderateScale(15),
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(8),
      fontFamily: theme.fonts.bold,
    },
    description: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(10),
      fontFamily: theme.fonts.regular,
    },
    buttonContainer: {
      gap: moderateScale(12),
      marginTop: moderateScale(20),
      paddingHorizontal: moderateScale(20),
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: moderateScale(12),
      borderRadius: moderateScale(12),
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 3.84,
      elevation: 3,
      maxWidth: '100%',
      alignSelf: 'center',
      minWidth: moderateScale(200),
    },
    buttonPressed: {
      opacity: 0.8,
      transform: [{scale: 0.98}],
    },
    iconWrapper: {
      marginRight: moderateScale(8),
    },
    actionButtonText: {
      color: 'white',
      fontSize: moderateScale(14),
      fontWeight: '600',
      fontFamily: theme.fonts.bold,
    },
    passwordSection: {
      marginTop: moderateScale(20),
      backgroundColor: theme.colors.card,
      padding: moderateScale(20),
      borderRadius: moderateScale(15),
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    passwordLabel: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginBottom: moderateScale(15),
      fontFamily: theme.fonts.medium,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: moderateScale(12),
      marginBottom: moderateScale(20),
      paddingHorizontal: moderateScale(15),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    passwordInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: moderateScale(16),
      padding: moderateScale(12),
      fontFamily: theme.fonts.regular,
    },
    passwordButtons: {
      flexDirection: 'row',
      gap: moderateScale(8),
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(10),
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: moderateScale(10),
    },
    confirmDeleteButton: {
      flex: 1,
      backgroundColor: theme.colors.error,
      borderRadius: moderateScale(10),
      padding: moderateScale(10),
    },
    buttonText: {
      fontFamily: theme.fonts.bold,
      fontSize: moderateScale(14),
    },
    scrollContent: {
      padding: moderateScale(20),
    },
  });
