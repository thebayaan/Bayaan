export async function deleteAccount(password: string) {
  try {
    console.log('[Auth] Starting account deletion process...');

    // Get current user
    const {data: {user}} = await supabase.auth.getUser();
    if (!user?.email) {
      return {success: false, error: 'No user found'};
    }

    // Re-authenticate user before deletion
    console.log('[Auth] Re-authenticating user...');
    const {data: authData, error: authError} = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError || !authData.user) {
      console.error('[Auth] Re-authentication failed:', authError);
      return {success: false, error: 'Invalid password'};
    }

    // Clean up player state
    console.log('[Auth] Cleaning up player state...');
    const store = usePlayerStore.getState();
    await store.cleanup();
    console.log('[Auth] Player state cleaned up');

    // Delete the user
    console.log('[Auth] Deleting user account...');
    const {error: deleteError} = await supabase.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error('[Auth] Delete account error:', deleteError);
      return {success: false, error: deleteError.message};
    }

    console.log('[Auth] Account deleted successfully');
    return {success: true};
  } catch (error) {
    console.error('[Auth] Unexpected delete account error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
} 