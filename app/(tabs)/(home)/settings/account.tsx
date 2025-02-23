import React, {useState} from 'react';
import {View, Text, Alert, TextInput} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {signOut, deleteAccount} from '@/services/auth';
import {ScreenHeader} from '@/components/ScreenHeader';
import {useAuthStore} from '@/store/authStore';

export default function AccountScreen() {
  const {theme} = useTheme();
  const {isSigningOut, setSigningOut} = useAuthStore();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const styles = createStyles(theme);

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
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Account" />
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Management</Text>
          <Text style={styles.description}>
            Manage your account settings and preferences
          </Text>
        </View>

        {showPasswordInput ? (
          <View style={styles.passwordSection}>
            <Text style={styles.passwordLabel}>
              Please enter your password to confirm account deletion
            </Text>
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
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <Button
              title="Logout"
              onPress={handleLogout}
              loading={isSigningOut}
              disabled={isSigningOut}
              style={styles.logoutButton}
              textStyle={styles.buttonText}
              size="medium"
            />

            <Button
              title="Delete Account"
              onPress={handleDeleteAccount}
              loading={isDeletingAccount}
              disabled={isDeletingAccount}
              style={styles.deleteButton}
              textStyle={styles.buttonText}
              size="medium"
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: moderateScale(20),
    },
    section: {
      marginVertical: moderateScale(20),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(8),
    },
    description: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(20),
    },
    buttonContainer: {
      gap: moderateScale(15),
    },
    logoutButton: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(30),
    },
    deleteButton: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(30),
      opacity: 0.8,
    },
    buttonText: {
      color: 'white',
      fontFamily: theme.fonts.bold,
      fontSize: moderateScale(16),
    },
    passwordSection: {
      marginTop: moderateScale(20),
    },
    passwordLabel: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
      marginBottom: moderateScale(10),
    },
    passwordInput: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(8),
      padding: moderateScale(12),
      color: theme.colors.text,
      fontSize: moderateScale(16),
      marginBottom: moderateScale(15),
    },
    passwordButtons: {
      flexDirection: 'row',
      gap: moderateScale(10),
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.card,
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(30),
    },
    confirmDeleteButton: {
      flex: 1,
      backgroundColor: theme.colors.error,
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(30),
    },
  });
